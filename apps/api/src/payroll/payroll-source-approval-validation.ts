import type { Prisma } from "../generated/prisma/client";
import type { ResolvedMonthlyPayrollSource } from "./monthly-payroll-calculation.service";

// Existing SalaryService approval records and audit contract, shared unchanged
// by approval readiness and the read-only correction input preflight.
export async function hasVerifiedPayrollSourceApprovals(source: ResolvedMonthlyPayrollSource, tx: Prisma.TransactionClient) {
  const select = { id: true, status: true, approvedById: true, approvedAt: true } as const;
  const assignment = await tx.employeeSalaryAssignment.findUnique({ where: { id: source.assignment.id }, select });
  const structure = await tx.salaryStructure.findUnique({ where: { id: source.assignment.salaryStructureId }, select });
  const profile = await tx.employeePaymentProfile.findUnique({ where: { id: source.profile.id }, select });
  for (const [approval, date, action, entityType] of [
    [assignment, source.assignment.approvedAt, "SALARY_ASSIGNMENT_APPROVED", "EmployeeSalaryAssignment"],
    [structure, source.assignment.salaryStructure.approvedAt, "SALARY_STRUCTURE_APPROVED", "SalaryStructure"],
    [profile, source.profile.approvedAt, "PAYMENT_PROFILE_APPROVED", "EmployeePaymentProfile"],
  ] as const) {
    if (!approval || approval.status !== "APPROVED" || !approval.approvedById || !approval.approvedAt || !date || approval.approvedAt.getTime() !== date.getTime()) return false;
    const history = await tx.auditEvent.findMany({ where: { action, entityType, entityId: approval.id }, select: { userId: true } });
    if (history.length !== 1 || history[0].userId !== approval.approvedById) return false;
  }
  return true;
}
