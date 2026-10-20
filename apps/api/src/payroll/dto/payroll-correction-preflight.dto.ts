import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsObject, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { PayrollMonthDto } from "./payroll-month.dto";
import { EmployeeManualDeductionsDto } from "./payroll-readiness.dto";

// Internal read-only input contract; no correction endpoint is registered.
export class PayrollCorrectionPreflightDto extends PayrollMonthDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,100}$/) runId!: string;
  @IsInt() @Min(1) @Max(2147483647) expectedVersion!: number;
  @IsString() @MaxLength(1000) @Matches(/\S/) reason!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10000) @IsObject({ each: true }) @ValidateNested({ each: true }) @Type(() => EmployeeManualDeductionsDto)
  deductions!: EmployeeManualDeductionsDto[];
}
