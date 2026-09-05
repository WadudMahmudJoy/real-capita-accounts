export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type Weekday = typeof WEEKDAYS[number];
export type AssignmentScope = 'COMPANY_DEFAULT' | 'EMPLOYEE_OVERRIDE';
export type WorkScheduleDayInput = {
    dayOfWeek: Weekday;
    isWorkingDay: boolean;
    startMinuteOfDay: number | null;
    endMinuteOfDay: number | null;
    unpaidBreakMinutes: number;
    crossesMidnight: boolean;
};
export class WorkScheduleRuleError extends Error {
}
export class WorkScheduleDefinitionImmutableError extends WorkScheduleRuleError {
}
export function normalizeScheduleCode(value: string): string {
    const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!/^[A-Z0-9][A-Z0-9/_-]{0,31}$/.test(code))
        throw new WorkScheduleRuleError('Schedule code has an invalid format.');
    return code;
}
export function assertWeeklyRules(days: WorkScheduleDayInput[]): void {
    if (!Array.isArray(days) || days.length !== 7 || new Set(days.map(day => day?.dayOfWeek)).size !== 7)
        throw new WorkScheduleRuleError('Exactly seven unique weekdays are required.');
    for (const day of days) {
        if (!day || !WEEKDAYS.includes(day.dayOfWeek) || typeof day.isWorkingDay !== 'boolean' || typeof day.crossesMidnight !== 'boolean')
            throw new WorkScheduleRuleError('Invalid weekday or working-day flags.');
        if (!Number.isInteger(day.unpaidBreakMinutes) || day.unpaidBreakMinutes < 0)
            throw new WorkScheduleRuleError('Unpaid break must be a nonnegative integer.');
        if (!day.isWorkingDay) {
            if (day.startMinuteOfDay !== null || day.endMinuteOfDay !== null || day.unpaidBreakMinutes !== 0 || day.crossesMidnight)
                throw new WorkScheduleRuleError('Rest days require null times, zero break, and no midnight crossing.');
            continue;
        }
        const { startMinuteOfDay: start, endMinuteOfDay: end } = day;
        if (start === null || end === null || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > 1439 || end < 0 || end > 1439)
            throw new WorkScheduleRuleError('Working times must be integer minutes from 0 to 1439.');
        if (day.crossesMidnight ? end >= start : end <= start)
            throw new WorkScheduleRuleError('Working times do not match midnight-crossing flag.');
        if (day.unpaidBreakMinutes >= scheduledMinutes(day).grossScheduledMinutes)
            throw new WorkScheduleRuleError('Unpaid break must be shorter than scheduled duration.');
    }
}
export function assertDefinitionMutable(everAssigned: boolean, changesDays: boolean): void {
    if (everAssigned && changesDays)
        throw new WorkScheduleDefinitionImmutableError('An ever-assigned schedule cannot change its weekly rules.');
}
export function assertScopeEmployee(scope: AssignmentScope, employeeId: string | null | undefined): void {
    if ((scope === 'COMPANY_DEFAULT' && employeeId != null) || (scope === 'EMPLOYEE_OVERRIDE' && (typeof employeeId !== 'string' || !employeeId.trim())) || !['COMPANY_DEFAULT', 'EMPLOYEE_OVERRIDE'].includes(scope))
        throw new WorkScheduleRuleError('Assignment scope and employee do not match.');
}
export function assertBusinessDate(value: string): void {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new WorkScheduleRuleError('Date must use YYYY-MM-DD format.');
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
        throw new WorkScheduleRuleError('Date must be a valid calendar date.');
}
export function assertEffectiveRange(from: string, to: string | null | undefined): void {
    assertBusinessDate(from);
    if (to != null) {
        assertBusinessDate(to);
        if (to <= from)
            throw new WorkScheduleRuleError('Effective end must be after effective start.');
    }
}
export function matchesEffectiveDate(businessDate: string, from: string, to: string | null): boolean {
    assertBusinessDate(businessDate);
    assertEffectiveRange(from, to);
    return from <= businessDate && (to === null || businessDate < to);
}
export function scheduledMinutes(day: WorkScheduleDayInput) {
    const grossScheduledMinutes = day.isWorkingDay ? day.endMinuteOfDay! - day.startMinuteOfDay! + (day.crossesMidnight ? 1440 : 0) : 0;
    return { grossScheduledMinutes, expectedWorkMinutes: day.isWorkingDay ? grossScheduledMinutes - day.unpaidBreakMinutes : 0 };
}
export function normalizeScheduleName(value: string): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 150)
        throw new WorkScheduleRuleError('Schedule name is required and limited to 150 characters.');
    return value.trim();
}
export function normalizeScheduleDescription(value: string | null | undefined): string | null {
    if (value == null)
        return null;
    if (typeof value !== 'string' || value.trim().length > 500)
        throw new WorkScheduleRuleError('Description is limited to 500 characters.');
    return value.trim() || null;
}
export function assertScheduleSource(workScheduleId: string | undefined, newSchedule: unknown): void {
    if ((typeof workScheduleId === 'string' && !!workScheduleId.trim()) === (newSchedule != null))
        throw new WorkScheduleRuleError('Exactly one existing schedule or new schedule is required.');
}
