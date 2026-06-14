import { IsEnum, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import { AccountingPeriodStatus } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";

export class CreateAccountingPeriodDto {
  @IsString()
  @MinLength(1)
  @Trim()
  fiscalYearId!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  name!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsEnum(AccountingPeriodStatus)
  status?: AccountingPeriodStatus;
}
