import { IsString, Matches, MaxLength } from "class-validator";
import type { PayrollAmounts } from "../payroll-financial-integrity";

export class PayrollPayslipParamsDto {
  @IsString() @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/) id!: string;
  @IsString() @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/) employeeId!: string;
}
export class PayrollDocumentContextDto {
  runId!: string;
  year!: number;
  month!: number;
  company!: { name: string; legalName: string | null; currency: string };
  approvalStatus!: "APPROVED";
  approvedAt!: string;
  approvalVersion!: number;
  paymentNotice!: string;
}
export class PayrollDocumentEmployeeDto {
  employeeId!: string;
  employeeCode!: string;
  fullName!: string;
  designation!: string;
  departmentName!: string | null;
}
export class PayrollPayslipDto extends PayrollDocumentContextDto {
  employee!: PayrollDocumentEmployeeDto;
  earnings!: { code: string; name: string; percentage: string; displayOrder: number; amount: string }[];
  amounts!: PayrollAmounts;
  plannedAllocation!: { kind: "PLANNED"; bank: string; cash: string };
}
export class PayrollSalarySheetDto extends PayrollDocumentContextDto {
  employeeCount!: number;
  rows!: { employee: PayrollDocumentEmployeeDto; amounts: PayrollAmounts; plannedAllocation: { kind: "PLANNED"; bank: string; cash: string } }[];
  totals!: PayrollAmounts;
}
