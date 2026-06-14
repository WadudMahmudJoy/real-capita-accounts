import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { Trim, TrimUppercase } from "../../common/dto-transforms";

export class CreateProjectDto {
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
  location?: string;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
