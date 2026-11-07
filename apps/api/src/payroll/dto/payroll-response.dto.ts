import type { PayrollRunStatus } from "../../generated/prisma/client";

// Response allowlists are populated explicitly; raw ORM records and JSON
// snapshots must never be returned or spread into a payroll response.
export class PayrollRunSummaryDto {
  id!: string;
  companyId!: string;
  year!: number;
  month!: number;
  status!: PayrollRunStatus;
  version!: number;
  approvedAt!: string | null;
  createdAt!: string;
  updatedAt!: string;
  lineCount!: number;
}

export class PayrollEmployeeIdentityDto {
  employeeCode!: string | null;
  fullName!: string | null;
  designation!: string | null;
  departmentName!: string | null;
}

export class PayrollRunLineDto {
  id!: string;
  employeeId!: string;
  employee!: PayrollEmployeeIdentityDto;
  grossSalary!: string;
  totalEarnings!: string;
  attendanceDeduction!: string;
  providentFundDeduction!: string;
  loanOrSalaryAdvanceDeduction!: string;
  aitDeduction!: string;
  otherDeductionsTotal!: string;
  totalDeductions!: string;
  netPay!: string;
  bankPay!: string;
  cashPay!: string;
}

export class PayrollRunDetailDto extends PayrollRunSummaryDto {
  isCreator!: boolean;
  lines!: PayrollRunLineDto[];
}

export class PayrollRunListDto {
  items!: PayrollRunSummaryDto[];
  page!: number;
  pageSize!: number;
  total!: number;
}
