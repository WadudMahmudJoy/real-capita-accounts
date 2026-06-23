import { IsISO8601, IsNumber, IsOptional, IsPositive, IsString, MinLength } from "class-validator";
import { Trim } from "../../common/dto-transforms";

export class CreateReceiptAllocationDto {
  @IsString()
  @MinLength(1)
  @Trim()
  voucherId!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsISO8601()
  allocationDate!: string;

  @IsOptional()
  @IsString()
  @Trim()
  allocationReference?: string;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string;
}
