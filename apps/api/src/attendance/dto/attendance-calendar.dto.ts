import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, Validate, ValidateIf } from "class-validator";
import { Trim } from "../../common/dto-transforms";
import { AttendanceBusinessDateConstraint } from "./attendance-day.dto";

export class CreateCalendarExceptionDto {
  @Validate(AttendanceBusinessDateConstraint)
  businessDate!: string;
  @IsIn(["HOLIDAY", "SPECIAL_WORKING_DAY"])
  exceptionType!: "HOLIDAY" | "SPECIAL_WORKING_DAY";
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinuteOfDay?: number | null;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinuteOfDay?: number | null;
  @IsOptional()
  @IsInt()
  @Min(0)
  unpaidBreakMinutes?: number;
  @IsOptional()
  @IsBoolean()
  crossesMidnight?: boolean;
}

export class UpdateCalendarExceptionDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinuteOfDay?: number | null;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinuteOfDay?: number | null;
  @IsOptional()
  @IsInt()
  @Min(0)
  unpaidBreakMinutes?: number;
  @IsOptional()
  @IsBoolean()
  crossesMidnight?: boolean;
}

export class CancelCalendarExceptionDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cancellationReason!: string;
}

export class HistoricalCalendarCorrectionDto {
  @Validate(AttendanceBusinessDateConstraint)
  businessDate!: string;
  @IsIn(["HOLIDAY", "SPECIAL_WORKING_DAY", "NONE"])
  target!: "HOLIDAY" | "SPECIAL_WORKING_DAY" | "NONE";
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinuteOfDay?: number | null;
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinuteOfDay?: number | null;
  @IsOptional()
  @IsInt()
  @Min(0)
  unpaidBreakMinutes?: number;
  @IsOptional()
  @IsBoolean()
  crossesMidnight?: boolean;
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  changeReason!: string;
}
