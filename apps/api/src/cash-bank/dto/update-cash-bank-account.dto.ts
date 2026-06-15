import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { CashBankAccountType, MfsProvider } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";

export class UpdateCashBankAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  ledgerAccountId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  displayName?: string;

  @IsOptional()
  @IsEnum(CashBankAccountType)
  accountType?: CashBankAccountType;

  @IsOptional()
  @IsString()
  @Trim()
  bankName?: string;

  @IsOptional()
  @IsString()
  @Trim()
  branch?: string;

  @IsOptional()
  @IsString()
  @Trim()
  accountNumber?: string;

  @IsOptional()
  @IsEnum(MfsProvider)
  provider?: MfsProvider | null;

  @IsOptional()
  @IsString()
  @Trim()
  providerOtherName?: string | null;

  @IsOptional()
  @IsString()
  @Trim()
  walletNumber?: string | null;

  @IsOptional()
  @IsString()
  @Trim()
  accountHolderName?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
