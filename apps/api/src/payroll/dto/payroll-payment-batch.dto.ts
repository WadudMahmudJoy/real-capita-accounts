import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsString, Matches, MaxLength, MinLength } from "class-validator";
export class PreparePayrollPaymentBatchDto {
  @IsString() @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/) payrollRunId!: string;
  @IsString() @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/) sourceAccountId!: string;
  @IsIn(["BANK", "CASH"]) channel!: "BANK" | "CASH";
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/) idempotencyKey!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ArrayUnique() @IsString({ each: true }) @MaxLength(128, { each: true }) @Matches(/^[A-Za-z0-9_-]+$/, { each: true }) employeeIds!: string[];
}
export class PayrollPaymentBatchResponseDto {
  id!: string; payrollRunId!: string; channel!: "BANK" | "CASH"; status!: "PREPARED" | "CONFIRMED" | "CANCELLED";
  createdById!: string; createdAt!: string; totalAmount!: string; employeeCount!: number;
  lines!: { employeeId: string; amount: string }[];
}
