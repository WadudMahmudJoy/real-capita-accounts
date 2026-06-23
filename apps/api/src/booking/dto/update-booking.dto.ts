import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { BookingAdministrativeStatus } from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";
import { BookingInstallmentDto } from "./create-booking.dto";

export class UpdateBookingDto {
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
  @IsISO8601()
  bookingDate?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalAgreedPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bookingMoney?: number | null;

  @IsOptional()
  @IsEnum(BookingAdministrativeStatus)
  administrativeStatus?: BookingAdministrativeStatus;

  @IsOptional()
  @IsString()
  @Trim()
  remarks?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingInstallmentDto)
  installments?: BookingInstallmentDto[];
}
