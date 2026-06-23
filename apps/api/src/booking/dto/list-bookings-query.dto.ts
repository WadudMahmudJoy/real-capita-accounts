import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { BookingAdministrativeStatus } from "../../generated/prisma/client";
import { ParseBooleanQuery, Trim } from "../../common/dto-transforms";

export class ListBookingsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  projectId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  bookableItemId?: string;

  @IsOptional()
  @IsEnum(BookingAdministrativeStatus)
  administrativeStatus?: BookingAdministrativeStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  search?: string;

  @IsOptional()
  @ParseBooleanQuery()
  @IsBoolean()
  includeDeleted?: boolean;
}
