import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { VoucherType } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";
import { VoucherLineDto } from "./voucher-line.dto";

// The client never supplies status, systemVoucherNo, companyId, totals,
// postedById, or postingDate. The global ValidationPipe is configured with
// forbidNonWhitelisted, so any attempt to send those fields is rejected with a
// 400 rather than silently accepted. companyId is derived from the fiscal year.
export class CreateVoucherDto {
  @IsString()
  @MinLength(1)
  @Trim()
  fiscalYearId!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  accountingPeriodId!: string;

  @IsEnum(VoucherType)
  voucherType!: VoucherType;

  @IsISO8601()
  voucherDate!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  narration!: string;

  @IsOptional()
  @IsString()
  @Trim()
  physicalSiNo?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => VoucherLineDto)
  lines!: VoucherLineDto[];
}
