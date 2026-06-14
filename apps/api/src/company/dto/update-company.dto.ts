import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { Trim, TrimUppercase } from "../../common/dto-transforms";

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  name?: string;

  @IsOptional()
  @IsString()
  @Trim()
  legalName?: string;

  @IsOptional()
  @IsString()
  @Trim()
  address?: string;

  @IsOptional()
  @IsString()
  @Trim()
  phone?: string;

  @IsOptional()
  @IsEmail()
  @Trim()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @TrimUppercase()
  currency?: string;
}
