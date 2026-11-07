import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
export class PayrollPaymentPreparationQueryDto {
  @IsIn(["BANK", "CASH"]) channel!: "BANK" | "CASH";
  @IsOptional() @IsString() @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/) sourceAccountId?: string;
}
export class PayrollPaymentPreparationDto {
  runId!: string; year!: number; month!: number;
  company!: { name: string; legalName: string | null; currency: string };
  channel!: "BANK" | "CASH";
  status!: "PREPARATION_NOT_DISBURSED"; canDisburse!: false;
  sourceAuthorizationVerified!: boolean;
  employeeCount!: number;
  rows!: { employeeId: string; employeeCode: string; fullName: string; plannedAmount: string; selectable: boolean }[];
  totalPlanned!: string; bankTotal!: string; cashTotal!: string; payrollNetTotal!: string;
  sourceAccounts!: { id: string; displayName: string; ledgerCode: string; registryScope: "GLOBAL_UNVERIFIED" }[];
  blockers!: { code: string; message: string }[];
  notice!: string;
}
