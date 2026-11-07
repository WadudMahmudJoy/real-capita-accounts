import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, Validate, ValidateIf, ValidateNested, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ParseBooleanQuery, Trim, TrimToNull, TrimUppercase } from '../../common/dto-transforms';
import { AssignmentScope, WorkScheduleDayInput, Weekday, WEEKDAYS, assertBusinessDate, assertWeeklyRules } from '../work-schedule-rules';
@ValidatorConstraint({ name: 'businessDate', async: false })
class BusinessDateConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean { try {
        assertBusinessDate(value as string);
        return true;
    }
    catch {
        return false;
    } }
    defaultMessage(): string { return '$property must be a valid YYYY-MM-DD date.'; }
}
@ValidatorConstraint({ name: 'weeklyRules', async: false })
class WeeklyRulesConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean { try {
        assertWeeklyRules(value as WorkScheduleDayInput[]);
        return true;
    }
    catch {
        return false;
    } }
    defaultMessage(): string { return 'days must contain seven valid unique weekly rules.'; }
}
export class WorkScheduleDayDto implements WorkScheduleDayInput {
    @IsIn(WEEKDAYS)
    dayOfWeek!: Weekday;
    @IsBoolean()
    isWorkingDay!: boolean;
    @ValidateIf((_object, value) => value !== null)
    @IsInt()
    @Min(0)
    @Max(1439)
    startMinuteOfDay!: number | null;
    @ValidateIf((_object, value) => value !== null)
    @IsInt()
    @Min(0)
    @Max(1439)
    endMinuteOfDay!: number | null;
    @IsInt()
    @Min(0)
    unpaidBreakMinutes!: number;
    @IsBoolean()
    crossesMidnight!: boolean;
}
export class CreateWorkScheduleDto {
    @ValidateIf((_object, value) => value !== undefined)
    @TrimUppercase()
    @IsString()
    @Matches(/^[A-Z0-9][A-Z0-9/_-]{0,31}$/)
    code?: string;
    @Trim()
    @IsString()
    @MinLength(1)
    @MaxLength(150)
    name!: string;
    @IsOptional()
    @TrimToNull()
    @IsString()
    @MaxLength(500)
    description?: string | null;
    @IsArray()
    @ArrayMinSize(7)
    @ArrayMaxSize(7)
    @Validate(WeeklyRulesConstraint)
    @ValidateNested({ each: true })
    @Type(() => WorkScheduleDayDto)
    days!: WorkScheduleDayDto[];
}
export class UpdateWorkScheduleDto {
    @ValidateIf((_object, value) => value !== undefined)
    @Trim()
    @IsString()
    @MinLength(1)
    @MaxLength(150)
    name?: string;
    @IsOptional()
    @TrimToNull()
    @IsString()
    @MaxLength(500)
    description?: string | null;
    @ValidateIf((_object, value) => value !== undefined)
    @IsBoolean()
    isActive?: boolean;
    @ValidateIf((_object, value) => value !== undefined)
    @IsArray()
    @ArrayMinSize(7)
    @ArrayMaxSize(7)
    @Validate(WeeklyRulesConstraint)
    @ValidateNested({ each: true })
    @Type(() => WorkScheduleDayDto)
    days?: WorkScheduleDayDto[];
}
export class CreateWorkScheduleAssignmentDto {
    @IsIn(['COMPANY_DEFAULT', 'EMPLOYEE_OVERRIDE'])
    scope!: AssignmentScope;
    @IsOptional()
    @Trim()
    @IsString()
    @MinLength(1)
    employeeId?: string | null;
    @ValidateIf((_object, value) => value !== undefined)
    @Trim()
    @IsString()
    @MinLength(1)
    workScheduleId?: string;
    @ValidateIf((_object, value) => value !== undefined)
    @ValidateNested()
    @Type(() => CreateWorkScheduleDto)
    newSchedule?: CreateWorkScheduleDto;
    @Validate(BusinessDateConstraint)
    effectiveFrom!: string;
    @IsOptional()
    @Validate(BusinessDateConstraint)
    effectiveTo?: string | null;
    @IsOptional()
    @TrimToNull()
    @IsString()
    @MaxLength(500)
    changeReason?: string | null;
}
export class ReplaceWorkScheduleAssignmentDto {
    @Validate(BusinessDateConstraint)
    effectiveFrom!: string;
    @ValidateIf((_object, value) => value !== undefined)
    @Trim()
    @IsString()
    @MinLength(1)
    workScheduleId?: string;
    @ValidateIf((_object, value) => value !== undefined)
    @ValidateNested()
    @Type(() => CreateWorkScheduleDto)
    newSchedule?: CreateWorkScheduleDto;
    @Trim()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    changeReason!: string;
    @IsString()
    @IsISO8601({ strict: true })
    @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
    expectedUpdatedAt!: string;
}
export class EndWorkScheduleAssignmentDto {
    @Validate(BusinessDateConstraint)
    effectiveTo!: string;
    @Trim()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    changeReason!: string;
    @IsString()
    @IsISO8601({ strict: true })
    @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
    expectedUpdatedAt!: string;
}
export class CancelWorkScheduleAssignmentDto {
    @Trim()
    @IsString()
    @MinLength(1)
    @MaxLength(500)
    changeReason!: string;
    @IsString()
    @IsISO8601({ strict: true })
    @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/)
    expectedUpdatedAt!: string;
}
export class ListWorkSchedulesQueryDto {
    @ValidateIf((_object, value) => value !== undefined)
    @ParseBooleanQuery()
    @IsBoolean()
    includeInactive?: boolean;
}
export class EffectiveWorkScheduleQueryDto {
    @Validate(BusinessDateConstraint)
    businessDate!: string;
    @ValidateIf((_object, value) => value !== undefined)
    @Trim()
    @IsString()
    @MinLength(1)
    employeeId?: string;
}
export class ListWorkScheduleAssignmentsQueryDto {
    @ValidateIf((_object, value) => value !== undefined)
    @Trim()
    @IsString()
    @MinLength(1)
    employeeId?: string;
}
