import { IsInt, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";
import { Trim, TrimToNull } from "../../common/dto-transforms";

const LOCAL_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export class CorrectAttendanceDto {
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
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  changeReason!: string;
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  expectedRevisionNo!: number | null;
}

export class MarkNotApplicableDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  changeReason!: string;
  @IsInt()
  expectedRevisionNo!: number;
}
