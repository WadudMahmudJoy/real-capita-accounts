import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Trim, TrimToNull, TrimUppercase } from "../../common/dto-transforms";

const DEPARTMENT_CODE_PATTERN = /^[A-Z0-9][A-Z0-9/_-]{0,31}$/;

export class CreateDepartmentDto {
  @IsString()
  @TrimUppercase()
  @Matches(DEPARTMENT_CODE_PATTERN, {
    message: "code has an invalid format.",
  })
  code!: string;

  @IsString() @Trim() @MinLength(1) @MaxLength(150) name!: string;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(500) description?: string | null;
}

export class UpdateDepartmentDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;
  @IsOptional() @TrimToNull() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
