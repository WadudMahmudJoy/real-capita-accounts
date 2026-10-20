import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";

export type PayrollAmounts = {
  grossSalary: string; totalEarnings: string;
  attendanceDeduction: string; providentFundDeduction: string;
  loanOrSalaryAdvanceDeduction: string; aitDeduction: string;
  otherDeductionsTotal: string; totalDeductions: string;
  netPay: string; bankPay: string; cashPay: string;
};

// Match DECIMAL(18,2) and the six deployed payroll-line CHECK constraints.
// This validates arithmetic, never deduction authority or monthly policy.
export function assertPayrollFinancialIntegrity(amounts: PayrollAmounts): void {
  const fields: Array<keyof PayrollAmounts> = ["grossSalary", "totalEarnings", "attendanceDeduction", "providentFundDeduction",
    "loanOrSalaryAdvanceDeduction", "aitDeduction", "otherDeductionsTotal", "totalDeductions", "netPay", "bankPay", "cashPay"];
  const values = Object.fromEntries(fields.map(key => {
    const value = amounts[key];
    if (typeof value !== "string" || !/^\d{1,16}\.\d{2}$/.test(value)) {
      throw new BadRequestException(`${key} must be an exact DECIMAL(18,2) string.`);
    }
    return [key, new Prisma.Decimal(value)];
  })) as Record<keyof PayrollAmounts, Prisma.Decimal>;
  if (!values.grossSalary.greaterThan(0) || !values.totalEarnings.greaterThan(0)) {
    throw new BadRequestException("Gross Salary and Total Earnings must be positive.");
  }
  const deductions = values.attendanceDeduction.plus(values.providentFundDeduction)
    .plus(values.loanOrSalaryAdvanceDeduction).plus(values.aitDeduction).plus(values.otherDeductionsTotal);
  if (!values.totalDeductions.equals(deductions) ||
      !values.netPay.equals(values.totalEarnings.minus(values.totalDeductions)) ||
      !values.bankPay.plus(values.cashPay).equals(values.netPay)) {
    throw new BadRequestException("Payroll amounts do not reconcile.");
  }
}
