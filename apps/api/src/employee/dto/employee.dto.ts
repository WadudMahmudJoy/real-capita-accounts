import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import { ParseBooleanQuery, Trim } from "../../common/dto-transforms";

export class ListEmployeesQueryDto {
  @IsOptional() @ParseBooleanQuery() @IsBoolean() includeInactive?: boolean;
  @IsOptional() @ParseBooleanQuery() @IsBoolean() includeDeleted?: boolean;
}

export class CreateEmployeeDto {
  @IsString() @MinLength(1) @Trim() employeeCode!: string;
  @IsString() @MinLength(1) @Trim() fullName!: string;
  @IsString() @MinLength(1) @Trim() designation!: string;
  @IsISO8601() joiningDate!: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @MinLength(1) @Trim() employeeCode?: string;
  @IsOptional() @IsString() @MinLength(1) @Trim() fullName?: string;
  @IsOptional() @IsString() @MinLength(1) @Trim() designation?: string;
  @IsOptional() @IsISO8601() joiningDate?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isDeleted?: boolean;
}
