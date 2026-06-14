import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { CashBankAccountType } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";

export class CreateCashBankAccountDto {
  @IsString()
  @MinLength(1)
  @Trim()
  ledgerAccountId!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  displayName!: string;

  @IsEnum(CashBankAccountType)
  accountType!: CashBankAccountType;

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
  @IsBoolean()
  isActive?: boolean;
}
