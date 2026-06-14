import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { NormalBalanceSide } from "../../generated/prisma/client";
import { Trim, TrimUppercase } from "../../common/dto-transforms";

export class CreateLedgerAccountDto {
  @IsString()
  @MinLength(1)
  @Trim()
  accountGroupId!: string;

  @IsString()
  @MinLength(1)
  @TrimUppercase()
  code!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  name!: string;

  @IsEnum(NormalBalanceSide)
  normalBalance!: NormalBalanceSide;

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
