import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { Trim, TrimUppercase } from "../../common/dto-transforms";

export class UpdateCostCenterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  projectId?: string;

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
  @IsString()
  @Trim()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
