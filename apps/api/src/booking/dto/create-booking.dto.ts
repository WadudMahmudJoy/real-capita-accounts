import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Trim } from "../../common/dto-transforms";

export class BookingInstallmentDto {
  @IsNumber()
  @Min(1)
  installmentNo!: number;

  @IsISO8601()
  dueDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @Trim()
  description?: string;
}

export class CreateBookingDto {
  @IsString()
  @MinLength(1)
  @Trim()
  customerId!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  projectId!: string;

  @IsString()
  @MinLength(1)
  @Trim()
  bookableItemId!: string;

  @IsISO8601()
  bookingDate!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  totalAgreedPrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bookingMoney?: number;

  @IsOptional()
  @IsString()
  @Trim()
  remarks?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingInstallmentDto)
  installments?: BookingInstallmentDto[];
}
