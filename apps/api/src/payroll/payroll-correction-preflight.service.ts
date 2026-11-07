import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollCorrectionPreflightDto } from "./dto/payroll-correction-preflight.dto";
import { MonthlyPayrollCalculationService } from "./monthly-payroll-calculation.service";
import { PayrollParentResolver } from "./payroll-parent.resolver";
import { PayrollAttendanceCompletenessService } from "./payroll-attendance-completeness.service";
import { assessManualDeductionProvenance } from "./payroll-readiness.service";
import { assertPayrollFinancialIntegrity } from "./payroll-financial-integrity";
import { hasVerifiedPayrollSourceApprovals } from "./payroll-source-approval-validation";

type Blocker = { code: string; employeeId?: string };
export type PayrollCorrectionPreflightResult = { status: "BLOCKED"; readyForCorrection: false; validationStatus: "PASS" | "BLOCKED";
  target: { id: string; companyId: string; year: number; month: number; version: number } | null;
  employeeCount: number; blockers: Blocker[] };

@Injectable()
export class PayrollCorrectionPreflightService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver,
    private readonly sources: MonthlyPayrollCalculationService, private readonly attendance: PayrollAttendanceCompletenessService) {}
  // This validates inputs only. It cannot authorize correction, preserve a
  // revision or release replacement lines. Future writers need a separately
  // reviewed history/identity contract and their own SERIALIZABLE transaction.
  async assess(input: PayrollCorrectionPreflightDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(tx => this.assessWithTx(input, actor, tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
  async assessWithTx(raw: PayrollCorrectionPreflightDto, actor: AuthenticatedUser, tx: Prisma.TransactionClient): Promise<PayrollCorrectionPreflightResult> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Invalid correction preflight input.");
    const input = plainToInstance(PayrollCorrectionPreflightDto, raw);
    if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length) throw new BadRequestException("Invalid correction preflight input.");
    const blockers: Blocker[] = [];
    const result: PayrollCorrectionPreflightResult = { status: "BLOCKED", readyForCorrection: false, validationStatus: "BLOCKED", target: null, employeeCount: 0, blockers: [] };
    const finish = () => { result.validationStatus = blockers.length ? "BLOCKED" : "PASS";
      result.blockers = [...blockers, { code: "CORRECTION_HISTORY_STORAGE_CONTRACT_MISSING" }, { code: "CORRECTION_REVISER_IDENTITY_CONTRACT_MISSING" }]; return result; };
    if (!actor?.id || !Array.isArray(actor.roles) || !actor.roles.some(r => r.code === ACCOUNTANT_ROLE)) { blockers.push({ code: "CORRECTOR_NOT_AUTHORIZED" }); return finish(); }
    const user = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true, email: true, isActive: true, roles: { select: { role: { select: { code: true } } } } } });
    if (!user?.isActive || user.id !== actor.id || user.email !== actor.email || !user.roles.some(r => r.role.code === ACCOUNTANT_ROLE)) { blockers.push({ code: "CORRECTOR_NOT_AUTHORIZED" }); return finish(); }
    let parentId: string;
    try { parentId = (await this.parent.resolve(tx)).id; }
    catch (error) { if (!(error instanceof ServiceUnavailableException)) throw error;
      blockers.push({ code: error.message.includes("inactive") ? "PAYROLL_PARENT_INACTIVE" : "PAYROLL_PARENT_MISSING" }); return finish(); }
    const run = await tx.payrollRun.findUnique({ where: { id: input.runId }, include: { lines: { select: { employeeId: true } } } });
    if (!run) { blockers.push({ code: "PAYROLL_RUN_MISSING" }); return finish(); }
    if (run.companyId !== parentId) { blockers.push({ code: "PAYROLL_OWNERSHIP_MISMATCH" }); return finish(); }
    if (run.status !== "DRAFT") { blockers.push({ code: "PAYROLL_NOT_DRAFT" }); return finish(); }
    if (run.version !== input.expectedVersion) { blockers.push({ code: "PAYROLL_VERSION_CONFLICT" }); return finish(); }
    if (run.version !== 1) { blockers.push({ code: "PAYROLL_REVISION_HISTORY_UNVERIFIABLE" }); return finish(); }
    if (run.payrollYear !== input.year || run.payrollMonth !== input.month) { blockers.push({ code: "CORRECTION_PERIOD_MISMATCH" }); return finish(); }
    if (run.approvedAt !== null || run.approvedById !== null || run.snapshotSchemaVersion !== 1 || !run.lines.length) { blockers.push({ code: "PAYROLL_DRAFT_METADATA_INVALID" }); return finish(); }
    result.target = { id: run.id, companyId: run.companyId, year: run.payrollYear, month: run.payrollMonth, version: run.version };
    const current = await this.sources.assessSourcesWithTx({ year: run.payrollYear, month: run.payrollMonth }, tx);
    blockers.push(...current.exceptions.map(e => ({ code: e.code, employeeId: e.employeeId })));
    const ids = new Set(current.employees.map(e => e.id)), existingIds = new Set(run.lines.map(l => l.employeeId)); result.employeeCount = ids.size;
    if (!ids.size) blockers.push({ code: "PAYROLL_ROSTER_EMPTY" });
    if (existingIds.size !== run.lines.length) blockers.push({ code: "PAYROLL_EXISTING_LINES_INVALID" });
    for (const id of existingIds) if (!ids.has(id)) blockers.push({ code: "PAYROLL_EMPLOYEE_REMOVAL_REQUIRES_REVIEW", employeeId: id });
    const manual = new Map<string, (typeof input.deductions)[number]>();
    for (const entry of input.deductions) {
      if (entry.year !== run.payrollYear || entry.month !== run.payrollMonth) blockers.push({ code: "DEDUCTION_PERIOD_MISMATCH", employeeId: entry.employeeId });
      if (!ids.has(entry.employeeId)) blockers.push({ code: "DEDUCTION_EMPLOYEE_OUTSIDE_ROSTER", employeeId: entry.employeeId });
      if (manual.has(entry.employeeId)) blockers.push({ code: "DUPLICATE_DEDUCTION_INPUT", employeeId: entry.employeeId });
      else manual.set(entry.employeeId, entry);
      blockers.push(...assessManualDeductionProvenance(entry).exceptions.map(e => ({ code: e.code, employeeId: e.employeeId })));
    }
    for (const id of ids) if (!manual.has(id)) blockers.push({ code: "DEDUCTION_INPUT_MISSING", employeeId: id });
    const attendance = await this.attendance.collect({ year: run.payrollYear, month: run.payrollMonth }, current.employees, tx);
    blockers.push(...attendance.exceptions.map(e => ({ code: e.code, employeeId: e.employeeId })));
    for (const source of current.sources) {
      if (!await hasVerifiedPayrollSourceApprovals(source, tx)) blockers.push({ code: "PAYROLL_SOURCE_APPROVAL_PROVENANCE_UNVERIFIABLE", employeeId: source.employee.id });
      const entry = manual.get(source.employee.id);
      if (!entry || assessManualDeductionProvenance(entry).exceptions.length) continue;
      try {
        const candidate = this.sources.calculateLine(source, { attendanceDeduction: entry.attendanceDeduction.amount, providentFundDeduction: entry.providentFundDeduction.amount,
          loanOrSalaryAdvanceDeduction: entry.loanOrSalaryAdvanceDeduction.amount, aitDeduction: entry.aitDeduction.amount,
          otherApprovedDeductions: entry.otherApprovedDeductions.map(d => ({ amount: d.amount, description: d.description })) });
        assertPayrollFinancialIntegrity(candidate.line);
      } catch (error) { if (!(error instanceof BadRequestException)) throw error;
        blockers.push({ code: "FINANCIAL_RECONCILIATION_FAILED", employeeId: source.employee.id }); }
    }
    return finish();
  }
}
