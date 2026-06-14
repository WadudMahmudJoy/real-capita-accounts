import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from "class-validator";
import { Trim } from "../../common/dto-transforms";

export class UpdateFiscalYearDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  name?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}
