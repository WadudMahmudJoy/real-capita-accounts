import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { VoucherStatus, VoucherType } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";

// Optional, safe filters for the voucher list. Soft-deleted drafts are always
// excluded by the service; there is no client-controlled way to surface them.
export class ListVouchersQueryDto {
  @IsOptional()
  @IsEnum(VoucherType)
  voucherType?: VoucherType;

  @IsOptional()
  @IsEnum(VoucherStatus)
  status?: VoucherStatus;

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
}
