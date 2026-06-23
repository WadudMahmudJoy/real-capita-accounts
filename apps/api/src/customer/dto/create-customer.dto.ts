import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { CustomerType } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";

export class CreateCustomerDto {
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @IsString()
  @MinLength(1)
  @Trim()
  name!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  phone!: string;

  @IsOptional()
  @IsEmail()
  @Trim()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  nidOrPassport?: string;

  @IsString()
  @MinLength(1)
  @Trim()
  address!: string;

  @IsOptional()
  @IsString()
  @Trim()
  professionOrBusiness?: string;

  @IsOptional()
  @IsString()
  @Trim()
  nomineeOrReference?: string;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
