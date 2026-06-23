import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import {
  BookableItemCategory,
  BookableItemStatus,
} from "../../generated/prisma/client";
import { ParseBooleanQuery, Trim } from "../../common/dto-transforms";

export class ListBookableItemsQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  projectId?: string;

  @IsOptional()
  @IsEnum(BookableItemCategory)
  category?: BookableItemCategory;

  @IsOptional()
  @IsEnum(BookableItemStatus)
  status?: BookableItemStatus;

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
