import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollApprovalReadinessInputDto } from "./dto/payroll-approval-readiness.dto";
import { MonthlyPayrollCalculationService, monthWindow } from "./monthly-payroll-calculation.service";
import { PayrollParentResolver } from "./payroll-parent.resolver";
import { PayrollAttendanceCompletenessService } from "./payroll-attendance-completeness.service";
import { assertPayrollFinancialIntegrity, type PayrollAmounts } from "./payroll-financial-integrity";
import { assertPayrollApprovalSnapshots } from "./payroll-approval-snapshot-validation";
import { hasVerifiedPayrollSourceApprovals } from "./payroll-source-approval-validation";

type Blocker = { code: string; employeeId?: string };
export type PayrollApprovalReadinessResult = {
  status: "READY" | "BLOCKED"; technicalStatus: "READY" | "BLOCKED"; readyForApproval: boolean; approvalAuthority: "ACCOUNTANT_MAKER_CHECKER";
  run: { id: string; companyId: string; createdById: string; year: number; month: number; status: string; version: number } | null;
  reviewerIsCreator: boolean | null; employeeCount: number; blockers: Blocker[];
};

@Injectable()
export class PayrollApprovalReadinessService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver,
    private readonly sources: MonthlyPayrollCalculationService, private readonly attendance: PayrollAttendanceCompletenessService) {}

  // A future writer must call assessWithTx in its SERIALIZABLE transaction,
  // then conditionally update status/version and insert the audit in that same
  // transaction. This read-only result is not an approval token or permission.
  async assess(input: PayrollApprovalReadinessInputDto, reviewer: AuthenticatedUser) {
    return this.prisma.$transaction(tx => this.assessWithTx(input, reviewer, tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async assessWithTx(raw: PayrollApprovalReadinessInputDto, reviewer: AuthenticatedUser, tx: Prisma.TransactionClient): Promise<PayrollApprovalReadinessResult> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Invalid approval-readiness input.");
    const input = plainToInstance(PayrollApprovalReadinessInputDto, raw);
    if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length) throw new BadRequestException("Invalid approval-readiness input.");
    const blockers: Blocker[] = [];
    const result: PayrollApprovalReadinessResult = { status: "BLOCKED", technicalStatus: "BLOCKED", readyForApproval: false, approvalAuthority: "ACCOUNTANT_MAKER_CHECKER", run: null,
      reviewerIsCreator: null, employeeCount: 0, blockers: [] };
    const finish = () => {
      result.technicalStatus = blockers.length ? "BLOCKED" : "READY";
      result.status = result.technicalStatus;
      result.readyForApproval = blockers.length === 0;
      result.blockers = blockers;
      return result;
    };
    // The business-approved ACCOUNTANT maker-checker policy applies. The caller
    // must supply a server-authenticated identity, never a user-entered ID.
    if (!reviewer?.id || !Array.isArray(reviewer.roles) || !reviewer.roles.some(r => r.code === ACCOUNTANT_ROLE)) {
      blockers.push({ code: "REVIEWER_NOT_AUTHORIZED_FOR_ASSESSMENT" }); return finish();
    }
    const user = await tx.user.findUnique({ where: { id: reviewer.id }, select: { id: true, email: true, isActive: true, roles: { select: { role: { select: { code: true } } } } } });
    if (!user || !user.isActive || !user.roles.some(r => r.role.code === ACCOUNTANT_ROLE)) {
      blockers.push({ code: "REVIEWER_NOT_AUTHORIZED_FOR_ASSESSMENT" }); return finish();
    }
    if (user.id !== reviewer.id || user.email !== reviewer.email) { blockers.push({ code: "REVIEWER_IDENTITY_MISMATCH" }); return finish(); }
    let parentId: string;
    try { parentId = (await this.parent.resolve(tx)).id; }
    catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      blockers.push({ code: error.message.includes("inactive") ? "PAYROLL_PARENT_INACTIVE" : "PAYROLL_PARENT_MISSING" }); return finish();
    }
    const run = await tx.payrollRun.findUnique({ where: { id: input.runId }, include: { lines: { orderBy: { employeeId: "asc" } } } });
    if (!run) { blockers.push({ code: "PAYROLL_RUN_MISSING" }); return finish(); }
    if (run.companyId !== parentId) { blockers.push({ code: "PAYROLL_OWNERSHIP_MISMATCH" }); return finish(); }
    result.run = { id: run.id, companyId: run.companyId, createdById: run.createdById, year: run.payrollYear, month: run.payrollMonth, status: run.status, version: run.version };
    result.reviewerIsCreator = run.createdById === reviewer.id;
    // Never reassess/replay approved history, even with a matching version.
    if (run.status !== "DRAFT") { blockers.push({ code: "PAYROLL_NOT_DRAFT" }); return finish(); }
    if (result.reviewerIsCreator) { blockers.push({ code: "PAYROLL_SELF_APPROVAL_FORBIDDEN" }); return finish(); }
    if (run.version !== input.expectedVersion) { blockers.push({ code: "PAYROLL_VERSION_CONFLICT" }); return finish(); }
    if (run.version === 2147483647) { blockers.push({ code: "PAYROLL_VERSION_EXHAUSTED" }); return finish(); }
    // Only creation version 1 is supported today. No trusted correction-history
    // contract records every material reviser; a version/JSON claim cannot
    // establish maker-checker eligibility for a revised DRAFT.
    if (run.version !== 1) { blockers.push({ code: "PAYROLL_REVISION_HISTORY_UNVERIFIABLE" }); return finish(); }
    if (run.approvedAt !== null || run.approvedById !== null || run.snapshotSchemaVersion !== 1 || !run.createdById ||
        !(run.createdAt instanceof Date) || !Number.isFinite(run.createdAt.getTime())) blockers.push({ code: "PAYROLL_DRAFT_METADATA_INVALID" });
    const period = { year: run.payrollYear, month: run.payrollMonth };
    try { monthWindow(period); } catch { blockers.push({ code: "PAYROLL_PERIOD_INVALID" }); return finish(); }
    const current = await this.sources.assessSourcesWithTx(period, tx);
    blockers.push(...current.exceptions.map(e => ({ code: e.code, employeeId: e.employeeId })));
    const expectedIds = new Set(current.employees.map(e => e.id)), lineIds = new Set(run.lines.map(l => l.employeeId));
    result.employeeCount = run.lines.length;
    if (!run.lines.length || lineIds.size !== run.lines.length || expectedIds.size !== lineIds.size || [...expectedIds].some(id => !lineIds.has(id)) ||
        run.lines.some(l => l.payrollRunId !== run.id)) blockers.push({ code: "PAYROLL_ROSTER_INCOMPLETE_OR_CHANGED" });
    const evidence = await this.attendance.collect(period, current.employees, tx);
    blockers.push(...evidence.exceptions.map(e => ({ code: e.code, employeeId: e.employeeId })));
    const history = await tx.auditEvent.findMany({ where: { entityType: "PayrollRun", entityId: run.id }, select: { action: true, userId: true, metadata: true, createdAt: true } });
    if (history.some(event => event.action !== "PAYROLL_RUN_DRAFT_CREATED")) blockers.push({ code: "PAYROLL_REVISION_HISTORY_UNVERIFIABLE" });
    const audits = history.filter(event => event.action === "PAYROLL_RUN_DRAFT_CREATED");
    const audit = audits[0];
    const metadata = audit?.metadata !== null && typeof audit?.metadata === "object" && !Array.isArray(audit.metadata) ? audit.metadata : {};
    if (audits.length !== 1 || audit.userId !== run.createdById || metadata.companyId !== run.companyId || metadata.payrollYear !== run.payrollYear ||
        metadata.payrollMonth !== run.payrollMonth || metadata.lineCount !== run.lines.length || metadata.policyContract !== "HR-3B-002B-3-ABC" || metadata.sourceValidation !== "IN_TRANSACTION" ||
        !(audit.createdAt instanceof Date) || !Number.isFinite(audit.createdAt.getTime()) || audit.createdAt < run.createdAt) blockers.push({ code: "PAYROLL_CREATION_AUDIT_UNVERIFIABLE" });
    for (const line of run.lines) {
      const block = (code: string) => blockers.push({ code, employeeId: line.employeeId });
      let amounts: PayrollAmounts;
      try {
        amounts = Object.fromEntries((["grossSalary", "totalEarnings", "attendanceDeduction", "providentFundDeduction", "loanOrSalaryAdvanceDeduction", "aitDeduction",
          "otherDeductionsTotal", "totalDeductions", "netPay", "bankPay", "cashPay"] as const).map(field => [field, line[field].toFixed(2)])) as PayrollAmounts;
        assertPayrollFinancialIntegrity(amounts);
      } catch { block("PAYROLL_FINANCIAL_INTEGRITY_INVALID"); continue; }
      if (new Prisma.Decimal(amounts.totalDeductions).greaterThan(0)) block("DEDUCTION_AUTHORITY_UNVERIFIABLE");
      const source = current.sources.find(s => s.employee.id === line.employeeId);
      if (!source) { block("PAYROLL_APPROVED_SOURCE_UNVERIFIABLE"); continue; }
      if (!await hasVerifiedPayrollSourceApprovals(source, tx)) block("PAYROLL_SOURCE_APPROVAL_PROVENANCE_UNVERIFIABLE");
      try { assertPayrollApprovalSnapshots(run, line, amounts, source, evidence.evidence.filter(e => e.employeeId === line.employeeId)); }
      catch (error) { block(error instanceof Error && error.message.startsWith("PAYROLL_") ? error.message : "PAYROLL_SNAPSHOT_INTEGRITY_INVALID"); }
    }
    return finish();
  }
}
