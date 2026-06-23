import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { CustomerType } from "../../generated/prisma/client";
import { ParseBooleanQuery, Trim } from "../../common/dto-transforms";

export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  search?: string;

  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @IsOptional()
  @ParseBooleanQuery()
  @IsBoolean()
  isActive?: boolean;
}
