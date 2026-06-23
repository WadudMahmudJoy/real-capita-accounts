import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { CustomerType } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";

export class UpdateCustomerDto {
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  phone?: string;

  @IsOptional()
  @IsEmail()
  @Trim()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  nidOrPassport?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  address?: string;

  @IsOptional()
  @IsString()
  @Trim()
  professionOrBusiness?: string | null;

  @IsOptional()
  @IsString()
  @Trim()
  nomineeOrReference?: string | null;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
