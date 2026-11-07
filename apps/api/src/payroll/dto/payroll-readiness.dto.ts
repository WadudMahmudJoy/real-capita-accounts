import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsDefined, IsIn, IsISO8601, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from "class-validator";
import { PayrollMonthDto } from "./payroll-month.dto";

export class DeductionApprovalClaimDto {
  @IsIn(["EXTERNAL_DOCUMENT", "SYSTEM_RECORD"]) evidenceType!: "EXTERNAL_DOCUMENT" | "SYSTEM_RECORD";
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) reference!: string;
  @IsString() @MinLength(1) @MaxLength(200) @Matches(/\S/) approvedByClaim!: string;
  @IsISO8601() approvedAtClaim!: string;
}
export class ManualDeductionAmountDto {
  @IsString() @Matches(/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/) amount!: string;
  @IsBoolean() zeroConfirmed!: boolean;
  // These are untrusted claims, never proof of approval or a verification flag.
  @IsOptional() @IsObject() @ValidateNested() @Type(() => DeductionApprovalClaimDto) approvalClaim?: DeductionApprovalClaimDto;
}
export class ManualOtherDeductionDto extends ManualDeductionAmountDto {
  @IsString() @MinLength(1) @MaxLength(500) @Matches(/\S/) description!: string;
}
export class EmployeeManualDeductionsDto extends PayrollMonthDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,128}$/) employeeId!: string;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => ManualDeductionAmountDto) attendanceDeduction!: ManualDeductionAmountDto;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => ManualDeductionAmountDto) providentFundDeduction!: ManualDeductionAmountDto;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => ManualDeductionAmountDto) loanOrSalaryAdvanceDeduction!: ManualDeductionAmountDto;
  @IsDefined() @IsObject() @ValidateNested() @Type(() => ManualDeductionAmountDto) aitDeduction!: ManualDeductionAmountDto;
  @IsArray() @ArrayMaxSize(100) @IsObject({ each: true }) @ValidateNested({ each: true }) @Type(() => ManualOtherDeductionDto) otherApprovedDeductions!: ManualOtherDeductionDto[];
  @IsBoolean() otherDeductionsZeroConfirmed!: boolean;
}
export class PayrollReadinessInputDto extends PayrollMonthDto {
  @IsArray() @ArrayMaxSize(10000) @IsObject({ each: true }) @ValidateNested({ each: true }) @Type(() => EmployeeManualDeductionsDto)
  deductions: EmployeeManualDeductionsDto[] = [];
}
