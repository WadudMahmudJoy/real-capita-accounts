import { IsISO8601, IsString, MinLength } from "class-validator";
import { Trim } from "../../common/dto-transforms";

export class CreateFiscalYearDto {
  @IsString()
  @MinLength(1)
  @Trim()
  companyId!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  name!: string;

  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;
}
