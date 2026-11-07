import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { parseDateOnly } from "../common/business-date";
import { formalDateEligibility } from "../attendance/attendance-expectation.service";
import { Prisma, SalaryConfigurationStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SalaryCalculator, type CalculationInput } from "../salary/salary-calculator";
import { PayrollMonthDto } from "./dto/payroll-month.dto";
import { PayrollParentResolver } from "./payroll-parent.resolver";
import { assertPayrollFinancialIntegrity } from "./payroll-financial-integrity";

const structureSelect = {
  id: true, code: true, name: true, version: true, status: true,
  effectiveFrom: true, effectiveTo: true, approvedAt: true, updatedAt: true,
  components: { select: { code: true, name: true, percentage: true, displayOrder: true }, orderBy: { displayOrder: "asc" } },
} satisfies Prisma.SalaryStructureSelect;
const assignmentSelect = {
  id: true, employeeId: true, salaryStructureId: true, grossSalary: true, status: true,
  effectiveFrom: true, effectiveTo: true, approvedAt: true, updatedAt: true,
  salaryStructure: { select: structureSelect },
} satisfies Prisma.EmployeeSalaryAssignmentSelect;
const profileSelect = {
  id: true, employeeId: true, status: true, effectiveFrom: true, effectiveTo: true, approvedAt: true, updatedAt: true,
  selectedBankPercentage: true, bankName: true, accountName: true, accountNumber: true, branchName: true,
} satisfies Prisma.EmployeePaymentProfileSelect;
const employeeSelect = {
  id: true, employeeCode: true, fullName: true, designation: true,
  isActive: true, isDeleted: true, joiningDate: true, separationDate: true, updatedAt: true,
  department: { select: { id: true, code: true, name: true } },
} satisfies Prisma.EmployeeSelect;
type EmployeeSource = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;
type AssignmentSource = Prisma.EmployeeSalaryAssignmentGetPayload<{ select: typeof assignmentSelect }>;
type ProfileSource = Prisma.EmployeePaymentProfileGetPayload<{ select: typeof profileSelect }>;

export type ResolvedMonthlyPayrollSource = {
  year: number; month: number;
  company: { id: string; name: string; legalName: string | null; currency: string };
  employee: EmployeeSource; assignment: AssignmentSource; profile: ProfileSource;
};
export type ExplicitPayrollDeductions = Pick<CalculationInput,
  "attendanceDeduction" | "providentFundDeduction" | "loanOrSalaryAdvanceDeduction" | "aitDeduction" | "otherApprovedDeductions">;

export function monthWindow(input: PayrollMonthDto) {
  if (!Number.isInteger(input.year) || input.year < 1 || input.year > 9999 ||
      !Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new BadRequestException("Payroll year/month must be valid integers.");
  }
  const startText = `${String(input.year).padStart(4, "0")}-${String(input.month).padStart(2, "0")}-01`;
  const start = parseDateOnly(startText, "payrollMonth");
  const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
  const last = new Date(end.getTime() - 86400000).toISOString().slice(0, 10);
  return { start, end, startText, last };
}
function coversMonth(source: { effectiveFrom: Date; effectiveTo: Date | null }, start: Date, end: Date) {
  return source.effectiveFrom <= start && (source.effectiveTo === null || source.effectiveTo >= end);
}

function requireSource(source: ResolvedMonthlyPayrollSource) {
  const { start, end, startText, last } = monthWindow(source);
  const { employee, assignment, profile } = source;
  if (employee.isDeleted || !employee.isActive || !formalDateEligibility(employee, startText) || !formalDateEligibility(employee, last)) {
    throw new ConflictException(`Employee ${employee.id} requires monthly eligibility/proration clarification.`);
  }
  for (const [label, config] of [["assignment", assignment], ["structure", assignment.salaryStructure], ["payment profile", profile]] as const) {
    if (config.status !== SalaryConfigurationStatus.APPROVED || !coversMonth(config, start, end)) {
      throw new ConflictException(`Employee ${employee.id} requires one APPROVED ${label} covering the entire month; effective-date changes need an approved monthly policy.`);
    }
  }
  if (assignment.employeeId !== employee.id || profile.employeeId !== employee.id || assignment.salaryStructureId !== assignment.salaryStructure.id) {
    throw new ConflictException("Payroll source references are inconsistent.");
  }
  const codes = new Set<string>(), orders = new Set<number>();
  let percentageTotal = new Prisma.Decimal(0);
  for (const component of assignment.salaryStructure.components) {
    const code = component.code.trim().toUpperCase();
    if (!code || codes.has(code) || orders.has(component.displayOrder) || component.percentage.lessThanOrEqualTo(0) || component.percentage.greaterThan(100)) {
      throw new ConflictException("Approved salary components are invalid or ambiguous.");
    }
    codes.add(code); orders.add(component.displayOrder);
    percentageTotal = percentageTotal.plus(component.percentage);
  }
  if (!percentageTotal.equals(100) || assignment.grossSalary.lessThanOrEqualTo(0) ||
      profile.selectedBankPercentage.lessThan(0) || profile.selectedBankPercentage.greaterThan(100)) {
    throw new ConflictException("Approved salary/payment configuration has invalid amounts or percentages.");
  }
  if (profile.selectedBankPercentage.greaterThan(0) && (!profile.bankName?.trim() || !profile.accountName?.trim() || !profile.accountNumber?.trim())) {
    throw new ConflictException("Approved bank payment profile is missing required bank details.");
  }
}

@Injectable()
export class MonthlyPayrollCalculationService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver,
    private readonly calculator: SalaryCalculator) {}

  // Source assessment only. The approved restricted manual contract is applied
  // by PayrollReadinessService. This source-only entry point cannot establish
  // deduction provenance or attendance evidence, and never invents zero inputs.
  async calculate(input: PayrollMonthDto) {
    monthWindow(input);
    return this.prisma.$transaction(async tx => {
      const assessment = await this.assessSourcesWithTx(input, tx, false);
      if (assessment.exceptions.length) throw new ConflictException(assessment.exceptions[0].message);
      return { year: input.year, month: input.month, companyId: assessment.company.id,
        readyForDraft: false as const, sources: assessment.sources, blockers: [
          "MANUAL_DEDUCTION_INPUT_REQUIRED", "DEDUCTION_PROVENANCE_VALIDATION_REQUIRED", "ATTENDANCE_EVIDENCE_ASSESSMENT_REQUIRED",
        ] };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  // Shared source collection for restricted readiness. Return every potential
  // employee and all blocking exceptions; never stop at the first exception.
  async assessSourcesWithTx(input: PayrollMonthDto, tx: Prisma.TransactionClient, reviewDeleted = true) {
      const { start, end } = monthWindow(input);
      const parent = await this.parent.resolve(tx);
      const company = await tx.company.findUnique({ where: { id: parent.id },
        select: { id: true, name: true, legalName: true, currency: true } });
      if (!company) throw new ServiceUnavailableException("The payroll parent company is unavailable.");
      // Potential monthly roster derives from inclusive formal employment dates,
      // globally. Inactive/partial-month records require review, not silent skips.
      const employees = await tx.employee.findMany({
        where: { ...(reviewDeleted ? {} : { isDeleted: false }), joiningDate: { lt: end }, OR: [{ separationDate: null }, { separationDate: { gte: start } }] },
        select: employeeSelect, orderBy: { id: "asc" },
      });
      const uniqueEmployees = [...new Map(employees.map(employee => [employee.id, employee])).values()];
      const ids = uniqueEmployees.map(employee => employee.id);
      const effective = { status: SalaryConfigurationStatus.APPROVED, effectiveFrom: { lt: end },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: start } }] };
      // One transaction owns one PostgreSQL connection; avoid queueing concurrent
      // queries on the adapter while retaining the same consistent snapshot.
      const assignments = await tx.employeeSalaryAssignment.findMany({ where: { employeeId: { in: ids }, ...effective }, select: assignmentSelect });
      const profiles = await tx.employeePaymentProfile.findMany({ where: { employeeId: { in: ids }, ...effective }, select: profileSelect });
      const sources: ResolvedMonthlyPayrollSource[] = [];
      const exceptions: Array<{ code: string; employeeId: string; message: string }> = [];
      for (const employee of uniqueEmployees) {
        const initial = exceptions.length;
        const block = (code: string, message: string) => exceptions.push({ code, employeeId: employee.id, message });
        if (employee.isDeleted) block("EMPLOYEE_DELETED_REQUIRES_REVIEW", "Potentially payable deleted employee requires review.");
        if (!employee.isActive) block("EMPLOYEE_INACTIVE_REQUIRES_REVIEW", "Potentially payable inactive employee requires review.");
        if (employee.joiningDate > start) block("JOINER_REQUIRES_REVIEW", "Partial-month joining requires an approved exception procedure.");
        if (employee.separationDate !== null && employee.separationDate < end) block("LEAVER_REQUIRES_REVIEW", "Separation in this month requires an approved exception procedure.");
        const applicableAssignments = assignments.filter(a => a.employeeId === employee.id);
        const applicableProfiles = profiles.filter(p => p.employeeId === employee.id);
        if (applicableAssignments.length !== 1) block(applicableAssignments.length ? "SALARY_ASSIGNMENT_CONFLICT" : "APPROVED_SALARY_ASSIGNMENT_MISSING", "One approved salary assignment is required.");
        if (applicableProfiles.length !== 1) block(applicableProfiles.length ? "PAYMENT_PROFILE_CONFLICT" : "APPROVED_PAYMENT_PROFILE_MISSING", "One approved payment profile is required.");
        if (applicableAssignments.some(a => !coversMonth(a, start, end))) block("MID_MONTH_SALARY_TRANSITION", "Salary changes within the month cannot be selected or prorated automatically.");
        if (applicableProfiles.some(p => !coversMonth(p, start, end))) block("MID_MONTH_PAYMENT_TRANSITION", "Payment profile changes within the month require review.");
        if (exceptions.length !== initial) continue;
        const source = { year: input.year, month: input.month, company, employee,
          assignment: applicableAssignments[0], profile: applicableProfiles[0] };
        try { requireSource(source); sources.push(source); }
        catch (error) {
          if (!(error instanceof ConflictException)) throw error;
          block("INVALID_APPROVED_CONFIGURATION", error.message);
        }
      }
      return { company, employees: uniqueEmployees, sources, exceptions };
  }

  // Internal arithmetic utility only. Explicit amounts do NOT prove approval.
  // Never expose these sensitive snapshots through the read-response DTOs, or
  // persist this result without readiness validation and transactional revalidation.
  calculateLine(source: ResolvedMonthlyPayrollSource, deductions: ExplicitPayrollDeductions) {
    requireSource(source);
    if (!deductions || !Array.isArray(deductions.otherApprovedDeductions)) {
      throw new BadRequestException("Explicit deduction inputs are required; missing amounts cannot default to zero.");
    }
    for (const deduction of deductions.otherApprovedDeductions) {
      if (!deduction || typeof deduction.description !== "string" ||
          (deduction.approvalReference !== undefined && typeof deduction.approvalReference !== "string")) {
        throw new BadRequestException("Other deduction descriptions and references must be strings.");
      }
    }
    for (const amount of [deductions.attendanceDeduction, deductions.providentFundDeduction,
      deductions.loanOrSalaryAdvanceDeduction, deductions.aitDeduction, ...deductions.otherApprovedDeductions.map(d => d.amount)]) {
      if (typeof amount !== "string" || !/^\d{1,16}(\.\d{1,2})?$/.test(amount)) {
        throw new BadRequestException("Every explicit deduction must be a non-negative decimal string with at most two decimal places.");
      }
    }
    const { assignment, profile, employee } = source;
    const result = this.calculator.calculate({ ...deductions, grossSalary: assignment.grossSalary.toFixed(2),
      components: assignment.salaryStructure.components, selectedBankPercentage: profile.selectedBankPercentage.toFixed(6) });
    const otherDeductionsTotal = result.otherApprovedDeductions.reduce((sum, d) => sum.plus(d.amount), new Prisma.Decimal(0)).toFixed(2);
    const line = {
      employeeId: employee.id, salaryAssignmentId: assignment.id, salaryStructureId: assignment.salaryStructureId, paymentProfileId: profile.id,
      employeeSnapshot: { employeeCode: employee.employeeCode, fullName: employee.fullName, designation: employee.designation,
        sourceUpdatedAt: employee.updatedAt.toISOString(),
        departmentName: employee.department?.name ?? null, department: employee.department ? { ...employee.department } : null, joiningDate: employee.joiningDate.toISOString(),
        separationDate: employee.separationDate?.toISOString() ?? null },
      salarySnapshot: { assignmentId: assignment.id, structureId: assignment.salaryStructureId, structureCode: assignment.salaryStructure.code,
        structureName: assignment.salaryStructure.name, structureVersion: assignment.salaryStructure.version,
        assignmentUpdatedAt: assignment.updatedAt.toISOString(), structureUpdatedAt: assignment.salaryStructure.updatedAt.toISOString(),
        assignmentEffectiveFrom: assignment.effectiveFrom.toISOString(), assignmentEffectiveTo: assignment.effectiveTo?.toISOString() ?? null,
        structureEffectiveFrom: assignment.salaryStructure.effectiveFrom.toISOString(), structureEffectiveTo: assignment.salaryStructure.effectiveTo?.toISOString() ?? null,
        assignmentApprovedAt: assignment.approvedAt?.toISOString() ?? null, structureApprovedAt: assignment.salaryStructure.approvedAt?.toISOString() ?? null,
        grossSalary: result.grossSalary, components: result.earningComponents },
      paymentProfileSnapshot: { profileId: profile.id, effectiveFrom: profile.effectiveFrom.toISOString(), effectiveTo: profile.effectiveTo?.toISOString() ?? null,
        sourceUpdatedAt: profile.updatedAt.toISOString(),
        approvedAt: profile.approvedAt?.toISOString() ?? null, selectedBankPercentage: profile.selectedBankPercentage.toFixed(6),
        bankName: profile.bankName, accountName: profile.accountName, accountNumber: profile.accountNumber, branchName: profile.branchName },
      calculationSnapshot: { year: source.year, month: source.month, snapshotSchemaVersion: 1, calculationRuleVersion: "salary-foundation-v1",
        monthlyPolicyVerified: false, roundingPolicy: result.roundingPolicy, otherApprovedDeductions: result.otherApprovedDeductions,
        attendanceDeduction: result.attendanceDeduction, providentFundDeduction: result.providentFundDeduction,
        loanOrSalaryAdvanceDeduction: result.loanOrSalaryAdvanceDeduction, aitDeduction: result.aitDeduction },
      grossSalary: result.grossSalary, totalEarnings: result.totalEarnings, attendanceDeduction: result.attendanceDeduction,
      providentFundDeduction: result.providentFundDeduction, loanOrSalaryAdvanceDeduction: result.loanOrSalaryAdvanceDeduction,
      aitDeduction: result.aitDeduction, otherDeductionsTotal, totalDeductions: result.totalDeductions,
      netPay: result.netPay, bankPay: result.bankPay, cashPay: result.cashPay,
    };
    assertPayrollFinancialIntegrity(line);
    return { readyForDraft: false as const, companyId: source.company.id,
      companySnapshot: { ...source.company }, line };
  }
}
