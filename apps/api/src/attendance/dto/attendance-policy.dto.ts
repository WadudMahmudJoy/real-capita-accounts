import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength, Validate } from "class-validator";
import { Trim, TrimToNull } from "../../common/dto-transforms";
import { AttendanceBusinessDateConstraint } from "./attendance-day.dto";

export class CreateInitialAttendancePolicyDto {
  @Validate(AttendanceBusinessDateConstraint)
  effectiveFrom!: string;
  @IsInt()
  @Min(0)
  lateGraceMinutes!: number;
  @IsInt()
  @Min(0)
  earlyLeaveGraceMinutes!: number;
  @IsOptional()
  @TrimToNull()
  @IsString()
  @MaxLength(500)
  changeReason?: string | null;
}

export class ReplaceAttendancePolicyDto {
  @Validate(AttendanceBusinessDateConstraint)
  effectiveFrom!: string;
  @IsInt()
  @Min(0)
  lateGraceMinutes!: number;
  @IsInt()
  @Min(0)
  earlyLeaveGraceMinutes!: number;
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  changeReason!: string;
}

export class CancelFutureAttendancePolicyDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cancellationReason!: string;
}
