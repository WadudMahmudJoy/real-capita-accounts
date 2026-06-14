import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { Trim, TrimUppercase } from "../../common/dto-transforms";

export class CreateCostCenterDto {
  @IsString()
  @MinLength(1)
  @Trim()
  projectId!: string;

  @IsString()
  @MinLength(1)
  @TrimUppercase()
  code!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  name!: string;

  @IsOptional()
  @IsString()
  @Trim()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
