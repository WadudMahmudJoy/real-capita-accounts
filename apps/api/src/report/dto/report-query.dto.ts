import { IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import { Trim } from "../../common/dto-transforms";

export class ReportQueryDto {
  @IsString()
  @MinLength(1)
  @Trim()
  fiscalYearId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  accountingPeriodId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  ledgerAccountId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  projectId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  cashBankAccountId?: string;

  @IsOptional()
  @IsISO8601()
  asOfDate?: string;
}
