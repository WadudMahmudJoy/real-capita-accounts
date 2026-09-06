import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { Trim, TrimToNull } from "../../common/dto-transforms";
import { parseDateOnly } from "../../common/business-date";

@ValidatorConstraint({ name: "attendanceBusinessDate", async: false })
export class AttendanceBusinessDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    try {
      parseDateOnly(value as string, "businessDate");
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string {
    return "$property must be a valid YYYY-MM-DD date.";
  }
}

const LOCAL_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const UPDATED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class AttendanceDayQueryDto {
  @Validate(AttendanceBusinessDateConstraint)
  businessDate!: string;
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  departmentId?: string;
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  search?: string;
}

export class AttendanceEntryDto {
  @Trim()
  @IsString()
  @MinLength(1)
  employeeId!: string;
  @IsOptional()
  @TrimToNull()
  @IsString()
  @Matches(LOCAL_TIME_PATTERN, { message: "checkInLocalTime must use HH:mm format." })
  checkInLocalTime?: string | null;
  @IsOptional()
  @TrimToNull()
  @IsString()
  @Matches(LOCAL_TIME_PATTERN, { message: "checkOutLocalTime must use HH:mm format." })
  checkOutLocalTime?: string | null;
  @IsOptional()
  @TrimToNull()
  @IsString()
  @MaxLength(500)
  note?: string | null;
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  @Matches(UPDATED_AT_PATTERN, { message: "expectedUpdatedAt must be an ISO timestamp." })
  expectedUpdatedAt?: string | null;
}

export class BulkAttendanceSaveDto {
  @Validate(AttendanceBusinessDateConstraint)
  businessDate!: string;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries!: AttendanceEntryDto[];
}

export class DiscardAttendanceEntryDto {
  @Validate(AttendanceBusinessDateConstraint)
  businessDate!: string;
  @Trim()
  @IsString()
  @MinLength(1)
  employeeId!: string;
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @IsISO8601({ strict: true })
  @Matches(UPDATED_AT_PATTERN, { message: "expectedUpdatedAt must be an ISO timestamp." })
  expectedUpdatedAt!: string | null;
}

export class FinalizeAttendanceDayDto {
  @Validate(AttendanceBusinessDateConstraint)
  businessDate!: string;
}

export class ListAttendanceHistoryQueryDto {
  @Validate(AttendanceBusinessDateConstraint)
  from!: string;
  @Validate(AttendanceBusinessDateConstraint)
  to!: string;
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  employeeId?: string;
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  departmentId?: string;
  @IsOptional()
  @Trim()
  @IsIn(["PRESENT", "ABSENT", "INCOMPLETE", "NOT_REQUIRED", "NOT_APPLICABLE"])
  presenceState?: string;
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  search?: string;
}
