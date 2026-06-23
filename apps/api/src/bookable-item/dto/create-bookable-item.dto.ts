import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import {
  BookableItemCategory,
  BookableItemStatus,
} from "../../generated/prisma/client";
import { Trim } from "../../common/dto-transforms";

export class CreateBookableItemDto {
  @IsString()
  @MinLength(1)
  @Trim()
  projectId!: string;

  @IsEnum(BookableItemCategory)
  category!: BookableItemCategory;

  @IsString()
  @MinLength(1)
  @Trim()
  itemIdentifier!: string;

  @IsOptional()
  @IsString()
  @Trim()
  block?: string;

  @IsOptional()
  @IsString()
  @Trim()
  zone?: string;

  @IsOptional()
  @IsString()
  @Trim()
  phase?: string;

  @IsOptional()
  @IsString()
  @Trim()
  sizeOrArea?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shareQuantity?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  basePrice!: number;

  @IsOptional()
  @IsEnum(BookableItemStatus)
  status?: BookableItemStatus;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string;
}
