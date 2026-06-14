import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from "class-validator";
import { VoucherLineSide } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";

export class VoucherLineDto {
  @IsEnum(VoucherLineSide)
  side!: VoucherLineSide;

  @IsString()
  @MinLength(1)
  @Trim()
  ledgerAccountId!: string;

  // Amount must be a positive monetary value with at most two decimal places.
  // Totals are always recalculated on the server; this value is only used to
  // build the line and to compute totalDebit / totalCredit.
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

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
  @IsString()
  @Trim()
  description?: string;
}
