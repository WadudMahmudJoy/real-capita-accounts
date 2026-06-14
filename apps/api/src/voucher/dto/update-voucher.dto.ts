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

// Only DRAFT vouchers may be updated. The client cannot change status, set
// posting fields, or change the systemVoucherNo: those properties are absent
// here and the global forbidNonWhitelisted ValidationPipe rejects them with a
// 400. narration, when provided, must not be blank (MinLength(1) after trim).
export class UpdateVoucherDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  fiscalYearId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  accountingPeriodId?: string;

  @IsOptional()
  @IsEnum(VoucherType)
  voucherType?: VoucherType;

  @IsOptional()
  @IsISO8601()
  voucherDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  narration?: string;

  @IsOptional()
  @IsString()
  @Trim()
  physicalSiNo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => VoucherLineDto)
  lines?: VoucherLineDto[];
}
