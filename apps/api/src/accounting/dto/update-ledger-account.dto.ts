import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { NormalBalanceSide } from "../../generated/prisma/client";
import { Trim, TrimUppercase } from "../../common/dto-transforms";

export class UpdateLedgerAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  accountGroupId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @TrimUppercase()
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  name?: string;

  @IsOptional()
  @IsEnum(NormalBalanceSide)
  normalBalance?: NormalBalanceSide;

  @IsOptional()
  @IsBoolean()
  requiresProject?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresCostCenter?: boolean;

  @IsOptional()
  @IsBoolean()
  isCashBank?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Trim()
  description?: string;
}
