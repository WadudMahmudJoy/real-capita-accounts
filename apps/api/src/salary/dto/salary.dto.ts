import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDecimal, IsISO8601, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from "class-validator";
import { Trim } from "../../common/dto-transforms";

export class SalaryComponentDto {
  @IsString() @MinLength(1) @Trim() code!: string;
  @IsString() @MinLength(1) @Trim() name!: string;
  @IsDecimal({ decimal_digits: "0,4" }) percentage!: string;
  @IsInt() @Min(1) displayOrder!: number;
}

export class CreateSalaryStructureDto {
  @IsString() @MinLength(1) @Trim() code!: string;
  @IsString() @MinLength(1) @Trim() name!: string;
  @IsOptional() @IsString() @Trim() description?: string;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SalaryComponentDto) components!: SalaryComponentDto[];
}

export class UpdateSalaryStructureDto {
  @IsOptional() @IsString() @MinLength(1) @Trim() name?: string;
  @IsOptional() @IsString() @Trim() description?: string | null;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string | null;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SalaryComponentDto) components?: SalaryComponentDto[];
}

export class CreateSalaryAssignmentDto {
  @IsString() @MinLength(1) @Trim() salaryStructureId!: string;
  @IsDecimal({ decimal_digits: "0,2" }) grossSalary!: string;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @IsString() @Trim() changeReason?: string;
}

export class UpdateSalaryAssignmentDto {
  @IsOptional() @IsString() @MinLength(1) @Trim() salaryStructureId?: string;
  @IsOptional() @IsDecimal({ decimal_digits: "0,2" }) grossSalary?: string;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string | null;
  @IsOptional() @IsString() @Trim() changeReason?: string | null;
}

export class CreatePaymentProfileDto {
  @IsOptional() @IsDecimal({ decimal_digits: "0,6" }) selectedBankPercentage?: string;
  @IsOptional() @IsString() @Trim() bankName?: string;
  @IsOptional() @IsString() @Trim() accountName?: string;
  @IsOptional() @IsString() @Trim() accountNumber?: string;
  @IsOptional() @IsString() @Trim() branchName?: string;
  @IsISO8601() effectiveFrom!: string;
  @IsOptional() @IsISO8601() effectiveTo?: string;
  @IsOptional() @IsString() @Trim() changeReason?: string;
}

export class UpdatePaymentProfileDto {
  @IsOptional() @IsDecimal({ decimal_digits: "0,6" }) selectedBankPercentage?: string;
  @IsOptional() @IsString() @Trim() bankName?: string | null;
  @IsOptional() @IsString() @Trim() accountName?: string | null;
  @IsOptional() @IsString() @Trim() accountNumber?: string | null;
  @IsOptional() @IsString() @Trim() branchName?: string | null;
  @IsOptional() @IsISO8601() effectiveFrom?: string;
  @IsOptional() @IsISO8601() effectiveTo?: string | null;
  @IsOptional() @IsString() @Trim() changeReason?: string | null;
}

export class OtherDeductionDto {
  @IsDecimal({ decimal_digits: "0,2" }) amount!: string;
  @IsString() @Trim() description!: string;
  @IsOptional() @IsString() @Trim() approvalReference?: string;
}

export class SalaryPreviewDto {
  @IsDecimal({ decimal_digits: "0,2" }) grossSalary!: string;
  @IsOptional() @IsString() @Trim() salaryStructureId?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SalaryComponentDto) components?: SalaryComponentDto[];
  @IsOptional() @IsDecimal({ decimal_digits: "0,2" }) attendanceDeduction?: string;
  @IsOptional() @IsDecimal({ decimal_digits: "0,2" }) providentFundDeduction?: string;
  @IsOptional() @IsDecimal({ decimal_digits: "0,2" }) loanOrSalaryAdvanceDeduction?: string;
  @IsOptional() @IsDecimal({ decimal_digits: "0,2" }) aitDeduction?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OtherDeductionDto) otherApprovedDeductions?: OtherDeductionDto[];
  @IsDecimal({ decimal_digits: "0,40" }) selectedBankPercentage!: string;
}
