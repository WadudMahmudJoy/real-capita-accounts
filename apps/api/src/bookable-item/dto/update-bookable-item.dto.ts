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

export class UpdateBookableItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  projectId?: string;

  @IsOptional()
  @IsEnum(BookableItemCategory)
  category?: BookableItemCategory;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  itemIdentifier?: string;

  @IsOptional()
  @IsString()
  @Trim()
  block?: string | null;

  @IsOptional()
  @IsString()
  @Trim()
  zone?: string | null;

  @IsOptional()
  @IsString()
  @Trim()
  phase?: string | null;

  @IsOptional()
  @IsString()
  @Trim()
  sizeOrArea?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shareQuantity?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  basePrice?: number;

  @IsOptional()
  @IsEnum(BookableItemStatus)
  status?: BookableItemStatus;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string | null;
}
