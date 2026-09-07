import { Transform } from "class-transformer";
import type { TransformFnParams } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { CompanyBackgroundMode } from "../../generated/prisma/client";
import { Trim, TrimToNull, TrimUppercase } from "../../common/dto-transforms";

// Normalizes a client-supplied hex color to the canonical uppercase form
// ("#1a2b3c" -> "#1A2B3C"). Non-string values — including the explicit null
// clear — pass through untouched so validation decides them.
const NormalizeHexColor = () =>
  Transform(({ value }: TransformFnParams): unknown =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  );

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Trim()
  name?: string;

  @IsOptional()
  @IsString()
  @Trim()
  legalName?: string;

  @IsOptional()
  @IsString()
  @Trim()
  address?: string;

  @IsOptional()
  @IsString()
  @Trim()
  phone?: string;

  @IsOptional()
  @IsEmail()
  @Trim()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  @TrimUppercase()
  currency?: string;

  // The single controlled office accent color. Exact six-digit hex only; the
  // application derives every other shade from this one value. Null clears
  // the office-specific accent.
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/)
  @NormalizeHexColor()
  brandAccentColor?: string | null;

  // Exactly DEFAULT_PREMIUM or CUSTOM. Undefined leaves the mode unchanged;
  // null is not a valid mode (the field is required at the schema level).
  // CUSTOM with a missing future background asset falls back visually to
  // DEFAULT_PREMIUM; no path is fabricated here.
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(CompanyBackgroundMode)
  backgroundMode?: CompanyBackgroundMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @TrimToNull()
  printHeaderName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  @TrimToNull()
  printFooterText?: string | null;
}
