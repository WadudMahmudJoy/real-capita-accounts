import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { REAL_CAPITA_TIME_ZONE } from "../common/business-date";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EmployeeManualDeductionsDto, ManualDeductionAmountDto, PayrollReadinessInputDto } from "./dto/payroll-readiness.dto";
import { MonthlyPayrollCalculationService, monthWindow } from "./monthly-payroll-calculation.service";
import { PayrollParentResolver } from "./payroll-parent.resolver";
import { PayrollAttendanceCompletenessService } from "./payroll-attendance-completeness.service";

type Blocker = { code: string; employeeId?: string; category?: string; message: string };
type Provenance = { category: string; amount: string; status: "ZERO_CONFIRMED" | "BLOCKED"; code?: string };
const categories = ["attendanceDeduction", "providentFundDeduction", "loanOrSalaryAdvanceDeduction", "aitDeduction"] as const;

// Shared read-only deduction-input checks. Claims never grant authority.
export function assessManualDeductionProvenance(input: EmployeeManualDeductionsDto) {
  const results: Provenance[] = [], exceptions: Blocker[] = [];
  const assess = (category: string, item: ManualDeductionAmountDto) => {
    const amount = new Prisma.Decimal(item.amount).toFixed(2);
    let code: string | undefined;
    if (new Prisma.Decimal(amount).isZero()) {
      if (!item.zeroConfirmed) code = "ZERO_CONFIRMATION_REQUIRED";
    } else if (item.zeroConfirmed) code = "ZERO_CONFIRMATION_CONTRADICTS_AMOUNT";
    else code = item.approvalClaim ? "EVIDENCE_AUTHORITY_UNAVAILABLE" : "POSITIVE_DEDUCTION_EVIDENCE_MISSING";
    // An external reference, asserted approver/date, or SYSTEM_RECORD string
    // cannot be verified by any existing deduction-approval authority.
    results.push({ category, amount, status: code ? "BLOCKED" : "ZERO_CONFIRMED", ...(code ? { code } : {}) });
    if (code) exceptions.push({ code, employeeId: input.employeeId, category,
      message: code === "EVIDENCE_AUTHORITY_UNAVAILABLE" ? "Approval claims cannot be verified by an existing trusted authority." : "Deduction amount or confirmation/evidence requires resolution." });
  };
  for (const category of categories) assess(category, input[category]);
  input.otherApprovedDeductions.forEach((item, index) => assess(`otherApprovedDeductions[${index}]`, item));
  const otherTotal = input.otherApprovedDeductions.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0));
  if (otherTotal.isZero() && !input.otherDeductionsZeroConfirmed) exceptions.push({ code: "ZERO_CONFIRMATION_REQUIRED", employeeId: input.employeeId,
    category: "otherApprovedDeductions", message: "The zero total for other deductions must be explicitly confirmed." });
  if (!otherTotal.isZero() && input.otherDeductionsZeroConfirmed) exceptions.push({ code: "ZERO_CONFIRMATION_CONTRADICTS_AMOUNT", employeeId: input.employeeId,
    category: "otherApprovedDeductions", message: "Other deductions are positive but claimed to be zero." });
  results.push({ category: "otherDeductionsTotal", amount: otherTotal.toFixed(2),
    status: exceptions.some(e => e.category?.startsWith("other")) ? "BLOCKED" : "ZERO_CONFIRMED" });
  return { results, exceptions };
}

@Injectable()
export class PayrollReadinessService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver,
    private readonly calculation: MonthlyPayrollCalculationService, private readonly attendance: PayrollAttendanceCompletenessService) {}

  // Internal assessment only. No endpoint or persistence. Later DRAFT creation
  // must repeat these reads/validation inside its own transaction; READY is not
  // a durable approval token. Sensitive candidate snapshots stay internal.
  async assess(raw: PayrollReadinessInputDto) {
    return this.prisma.$transaction(tx => this.assessWithTx(raw, tx), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  // Write callers must supply their transaction. Never open a nested transaction
  // or use a previous READY response as an authorization/persistence token.
  async assessWithTx(raw: PayrollReadinessInputDto, tx: Prisma.TransactionClient) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Invalid restricted payroll readiness input.");
    const input = plainToInstance(PayrollReadinessInputDto, raw);
    if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length) {
      throw new BadRequestException("Invalid restricted payroll readiness input.");
    }
    const { end, startText } = monthWindow(input);
    const period = { year: input.year, month: input.month, timeZone: REAL_CAPITA_TIME_ZONE,
      startDate: startText, endDateExclusive: end.toISOString().slice(0, 10) };
      let parentId: string;
      try { parentId = (await this.parent.resolve(tx)).id; }
      catch (error) {
        if (!(error instanceof ServiceUnavailableException)) throw error;
        return { period, parent: null, status: "BLOCKED" as const, readyForDraft: false,
          exceptions: [{ code: error.message.includes("inactive") ? "PAYROLL_PARENT_INACTIVE" : "PAYROLL_PARENT_MISSING", message: error.message }],
          employees: [], candidateLines: [] };
      }
      const existing = await tx.payrollRun.findUnique({ where: { payrollYear_payrollMonth: { payrollYear: input.year, payrollMonth: input.month } },
        select: { id: true, companyId: true, status: true } });
      // An existing run is retrieved through the read backend; never recalculate
      // approved history or attempt to overwrite a global monthly run here.
      if (existing) {
        return { period, parent: { id: parentId, singletonKey: "PRIMARY" }, status: "BLOCKED" as const, readyForDraft: false,
          exceptions: [{ code: existing.status === "APPROVED" ? "PAYROLL_ALREADY_APPROVED" : "PAYROLL_RUN_ALREADY_EXISTS",
            message: "An existing monthly run requires its own auditable lifecycle; candidate recalculation is blocked." }], employees: [], candidateLines: [] };
      }
      const sourceAssessment = await this.calculation.assessSourcesWithTx(input, tx);
      const exceptions: Blocker[] = [...sourceAssessment.exceptions];
      if (!sourceAssessment.employees.length) exceptions.push({ code: "PAYROLL_ROSTER_EMPTY", message: "No potentially payable employee was found; an empty payroll cannot be declared ready." });
      const ids = sourceAssessment.employees.map(e => e.id);
      const byEmployee = new Map<string, EmployeeManualDeductionsDto>();
      for (const entry of input.deductions) {
        if (entry.year !== input.year || entry.month !== input.month) exceptions.push({ code: "DEDUCTION_PERIOD_MISMATCH", employeeId: entry.employeeId, message: "Deduction period does not match payroll." });
        if (!ids.includes(entry.employeeId)) exceptions.push({ code: "DEDUCTION_EMPLOYEE_OUTSIDE_ROSTER", employeeId: entry.employeeId, message: "Deduction employee is outside the potential roster." });
        if (byEmployee.has(entry.employeeId)) exceptions.push({ code: "DUPLICATE_DEDUCTION_INPUT", employeeId: entry.employeeId, message: "Multiple deduction inputs exist for one global employee." });
        else byEmployee.set(entry.employeeId, entry);
      }
      const attendance = await this.attendance.collect(input, sourceAssessment.employees, tx);
      const evidence = attendance.evidence;
      exceptions.push(...attendance.exceptions);
      const calculated: ReturnType<MonthlyPayrollCalculationService["calculateLine"]>[] = [];
      const employees = sourceAssessment.employees.map(employee => {
        const source = sourceAssessment.sources.find(s => s.employee.id === employee.id);
        const manual = byEmployee.get(employee.id);
        const p = manual ? assessManualDeductionProvenance(manual) : { results: [], exceptions: [{ code: "DEDUCTION_INPUT_MISSING", employeeId: employee.id, message: "Every deduction category, including explicit zeros, is required." }] };
        exceptions.push(...p.exceptions);
        let financial: { status: "PASS" | "NOT_CALCULATED" | "FAIL"; code?: string } = { status: "NOT_CALCULATED" };
        if (source && manual) {
          try {
            const candidate = this.calculation.calculateLine(source, {
              attendanceDeduction: manual.attendanceDeduction.amount, providentFundDeduction: manual.providentFundDeduction.amount,
              loanOrSalaryAdvanceDeduction: manual.loanOrSalaryAdvanceDeduction.amount, aitDeduction: manual.aitDeduction.amount,
              otherApprovedDeductions: manual.otherApprovedDeductions.map(d => ({ amount: d.amount, description: d.description,
                ...(d.approvalClaim ? { approvalReference: d.approvalClaim.reference } : {}) })),
            });
            financial = { status: "PASS" };
            calculated.push(candidate);
          } catch (error) {
            if (!(error instanceof BadRequestException)) throw error;
            financial = { status: "FAIL", code: "FINANCIAL_RECONCILIATION_FAILED" };
            exceptions.push({ code: "FINANCIAL_RECONCILIATION_FAILED", employeeId: employee.id, message: "Calculation violates salary allocation or financial integrity rules." });
          }
        }
        return { employeeId: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName,
          sourceStatus: source ? "VALID" : "BLOCKED", deductionProvenance: p.results, financial,
          attendance: { coverage: attendance.coverage.find(c => c.employeeId === employee.id)?.status ?? "BLOCKED", status: evidence.some(e => e.employeeId === employee.id) ? "RECORDED_EVIDENCE" : "NO_RECORDED_EVIDENCE",
            records: evidence.filter(e => e.employeeId === employee.id) } };
      });
      exceptions.sort((a, b) => (a.employeeId ?? "").localeCompare(b.employeeId ?? "") || a.code.localeCompare(b.code) || (a.category ?? "").localeCompare(b.category ?? ""));
      const ready = exceptions.length === 0;
      return { period, parent: { ...sourceAssessment.company, singletonKey: "PRIMARY" }, status: ready ? "READY" as const : "BLOCKED" as const,
        readyForDraft: ready, exceptions, employees,
        // All-or-nothing candidate release prevents unresolved roster omissions.
        candidateLines: ready ? calculated.map(c => ({ ...c.line, calculationSnapshot: { ...c.line.calculationSnapshot,
          monthlyPolicyVerified: true, restrictedPolicyContract: "HR-3B-002B-3-ABC",
          deductionProvenance: employees.find(e => e.employeeId === c.line.employeeId)!.deductionProvenance,
          attendanceEvidence: evidence.filter(e => e.employeeId === c.line.employeeId),
          attendanceCoverage: "VERIFIED" } })) : [],
      };
  }
}
