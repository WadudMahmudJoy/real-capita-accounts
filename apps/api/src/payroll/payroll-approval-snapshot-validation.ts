import { Prisma } from "../generated/prisma/client";
import type { ResolvedMonthlyPayrollSource } from "./monthly-payroll-calculation.service";
import type { PayrollAmounts } from "./payroll-financial-integrity";

type Run = Prisma.PayrollRunGetPayload<{ include: { lines: true } }>;
type Line = Run["lines"][number];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PAYROLL_SNAPSHOT_REQUIRED");
  return value as Record<string, unknown>;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
function equal(left: unknown, right: unknown, code: string) {
  if (JSON.stringify(canonical(left)) !== JSON.stringify(canonical(right))) throw new Error(code);
}
function project(value: Record<string, unknown>, expected: Record<string, unknown>) {
  return Object.fromEntries(Object.keys(expected).map(key => [key, value[key]]));
}
function amount(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,16}\.\d{2}$/.test(value)) throw new Error("PAYROLL_SNAPSHOT_INTEGRITY_INVALID");
  return new Prisma.Decimal(value);
}

// Assertions compare persisted values. They never generate a new candidate,
// call SalaryCalculator, or return substitute historical amounts. Component
// and bank checks follow the existing salary-foundation rounding contract.
export function assertPayrollApprovalSnapshots(run: Run, line: Line, money: PayrollAmounts, source: ResolvedMonthlyPayrollSource, attendanceEvidence: unknown[]) {
  const employee = object(line.employeeSnapshot), salary = object(line.salarySnapshot), payment = object(line.paymentProfileSnapshot), calc = object(line.calculationSnapshot);
  const { assignment, profile } = source, structure = assignment.salaryStructure;
  equal(run.companySnapshot, { ...source.company, singletonKey: "PRIMARY" }, "PAYROLL_PARENT_SNAPSHOT_CHANGED");
  if (line.salaryAssignmentId !== assignment.id || line.salaryStructureId !== structure.id || line.paymentProfileId !== profile.id ||
      !assignment.approvedAt || !structure.approvedAt || !profile.approvedAt) throw new Error("PAYROLL_SOURCE_REFERENCE_OR_APPROVAL_CHANGED");
  const createdAt = run.createdAt.getTime();
  if (!Number.isFinite(createdAt) || [source.employee.updatedAt, assignment.updatedAt, structure.updatedAt, profile.updatedAt,
    assignment.approvedAt, structure.approvedAt, profile.approvedAt].some(date => !Number.isFinite(date.getTime()) || date.getTime() > createdAt)) throw new Error("PAYROLL_SOURCE_CHRONOLOGY_INVALID");
  for (const item of attendanceEvidence) {
    const evidence = object(item), revision = object(evidence.revision);
    for (const value of [evidence.markerFinalizedAt, revision.finalizedAt]) {
      if (typeof value !== "string" || !Number.isFinite(new Date(value).getTime()) || new Date(value).getTime() > createdAt) throw new Error("PAYROLL_ATTENDANCE_CHRONOLOGY_INVALID");
    }
  }
  equal(employee, { employeeCode: source.employee.employeeCode, fullName: source.employee.fullName, designation: source.employee.designation,
    sourceUpdatedAt: source.employee.updatedAt.toISOString(), departmentName: source.employee.department?.name ?? null,
    department: source.employee.department, joiningDate: source.employee.joiningDate.toISOString(), separationDate: source.employee.separationDate?.toISOString() ?? null }, "PAYROLL_EMPLOYEE_SOURCE_CHANGED");
  const expectedSalary = { assignmentId: assignment.id, structureId: structure.id, structureCode: structure.code, structureName: structure.name,
    structureVersion: structure.version, assignmentUpdatedAt: assignment.updatedAt.toISOString(), structureUpdatedAt: structure.updatedAt.toISOString(),
    assignmentEffectiveFrom: assignment.effectiveFrom.toISOString(), assignmentEffectiveTo: assignment.effectiveTo?.toISOString() ?? null,
    structureEffectiveFrom: structure.effectiveFrom.toISOString(), structureEffectiveTo: structure.effectiveTo?.toISOString() ?? null,
    assignmentApprovedAt: assignment.approvedAt.toISOString(), structureApprovedAt: structure.approvedAt.toISOString(), grossSalary: money.grossSalary };
  equal(project(salary, expectedSalary), expectedSalary, "PAYROLL_SALARY_SOURCE_CHANGED");
  if (money.grossSalary !== assignment.grossSalary.toFixed(2) || money.totalEarnings !== money.grossSalary) throw new Error("PAYROLL_SALARY_SOURCE_CHANGED");
  equal(payment, { profileId: profile.id, effectiveFrom: profile.effectiveFrom.toISOString(), effectiveTo: profile.effectiveTo?.toISOString() ?? null,
    sourceUpdatedAt: profile.updatedAt.toISOString(), approvedAt: profile.approvedAt.toISOString(), selectedBankPercentage: profile.selectedBankPercentage.toFixed(6),
    bankName: profile.bankName, accountName: profile.accountName, accountNumber: profile.accountNumber, branchName: profile.branchName }, "PAYROLL_PAYMENT_SOURCE_CHANGED");
  if (!new Prisma.Decimal(money.bankPay).equals(new Prisma.Decimal(money.grossSalary).times(profile.selectedBankPercentage).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP))) throw new Error("PAYROLL_BANK_ALLOCATION_INVALID");
  if (!Array.isArray(salary.components) || salary.components.length !== structure.components.length) throw new Error("PAYROLL_COMPONENT_SNAPSHOT_INVALID");
  const components = [...structure.components].sort((a, b) => a.displayOrder - b.displayOrder);
  let allocated = new Prisma.Decimal(0);
  salary.components.forEach((entry: unknown, index: number) => {
    const component = object(entry), original = components[index];
    const metadata = { code: original.code, name: original.name, percentage: original.percentage.toFixed(4), displayOrder: original.displayOrder };
    equal(project(component, metadata), metadata, "PAYROLL_COMPONENT_SNAPSHOT_INVALID");
    const stored = amount(component.amount), expected = index === components.length - 1 ? new Prisma.Decimal(money.grossSalary).minus(allocated)
      : new Prisma.Decimal(money.grossSalary).times(original.percentage).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (!stored.equals(expected)) throw new Error("PAYROLL_COMPONENT_SNAPSHOT_INVALID");
    allocated = allocated.plus(stored);
  });
  if (!allocated.equals(money.totalEarnings) || calc.year !== run.payrollYear || calc.month !== run.payrollMonth || calc.snapshotSchemaVersion !== 1 ||
      calc.calculationRuleVersion !== "salary-foundation-v1" || calc.monthlyPolicyVerified !== true || calc.restrictedPolicyContract !== "HR-3B-002B-3-ABC" ||
      calc.roundingPolicy !== "ROUND_HALF_UP; final earning component and Cash Pay receive residuals." || calc.attendanceCoverage !== "VERIFIED") throw new Error("PAYROLL_CALCULATION_SNAPSHOT_INVALID");
  const categories = ["attendanceDeduction", "providentFundDeduction", "loanOrSalaryAdvanceDeduction", "aitDeduction"] as const;
  for (const category of categories) if (calc[category] !== money[category]) throw new Error("PAYROLL_DEDUCTION_SNAPSHOT_INVALID");
  if (!Array.isArray(calc.otherApprovedDeductions) || !Array.isArray(calc.deductionProvenance)) throw new Error("PAYROLL_DEDUCTION_PROVENANCE_INVALID");
  const expectedProvenance: { category: string; amount: string; status: string }[] = categories.map(category => ({ category, amount: money[category], status: "ZERO_CONFIRMED" }));
  let other = new Prisma.Decimal(0);
  calc.otherApprovedDeductions.forEach((entry: unknown, index: number) => {
    const item = object(entry), value = amount(item.amount); if (typeof item.description !== "string") throw new Error("PAYROLL_DEDUCTION_SNAPSHOT_INVALID");
    other = other.plus(value); expectedProvenance.push({ category: `otherApprovedDeductions[${index}]`, amount: value.toFixed(2), status: "ZERO_CONFIRMED" });
  });
  if (!other.equals(money.otherDeductionsTotal)) throw new Error("PAYROLL_DEDUCTION_SNAPSHOT_INVALID");
  expectedProvenance.push({ category: "otherDeductionsTotal", amount: other.toFixed(2), status: "ZERO_CONFIRMED" });
  // There is no positive-deduction approval authority. A ZERO_CONFIRMED string
  // cannot establish authority for a positive amount.
  if (expectedProvenance.some(p => !amount(p.amount).isZero())) throw new Error("PAYROLL_DEDUCTION_AUTHORITY_UNVERIFIABLE");
  equal(calc.deductionProvenance, expectedProvenance, "PAYROLL_DEDUCTION_PROVENANCE_INVALID");
  equal(calc.attendanceEvidence, attendanceEvidence, "PAYROLL_ATTENDANCE_EVIDENCE_CHANGED");
}
