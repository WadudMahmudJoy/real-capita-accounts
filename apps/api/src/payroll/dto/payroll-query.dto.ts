import { Transform, type TransformFnParams } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { PayrollRunStatus } from "../../generated/prisma/client";

const QueryInteger = () => Transform(({ value }: TransformFnParams): unknown =>
  typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value);

export class ListPayrollRunsQueryDto {
  @QueryInteger() @IsInt() @Min(1) @Max(10000) page: number = 1;
  @QueryInteger() @IsInt() @Min(1) @Max(100) pageSize: number = 20;
  @IsOptional() @QueryInteger() @IsInt() @Min(1) @Max(9999) year?: number;
  @IsOptional() @QueryInteger() @IsInt() @Min(1) @Max(12) month?: number;
  @IsOptional() @IsEnum(PayrollRunStatus) status?: PayrollRunStatus;
}

export class PayrollRunIdParamsDto {
  @IsString() @MaxLength(128) @Matches(/^[A-Za-z0-9_-]+$/) id!: string;
}
