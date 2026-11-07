import { REAL_CAPITA_TIME_ZONE } from '../common/business-date';
import { AssignmentScope, WorkScheduleDayInput, Weekday, WEEKDAYS, WorkScheduleRuleError, assertBusinessDate, assertScopeEmployee, assertWeeklyRules, matchesEffectiveDate, normalizeScheduleCode, normalizeScheduleName, scheduledMinutes } from './work-schedule-rules';
export type WorkScheduleAssignmentCandidate = {
    id: string;
    scope: AssignmentScope;
    companyId: string;
    employeeId: string | null;
    effectiveFrom: string;
    effectiveTo: string | null;
    cancelledAt: Date | string | null;
    workSchedule: {
        id: string;
        code: string;
        name: string;
        isActive: boolean;
        days: WorkScheduleDayInput[];
    };
};
export type EffectiveWorkSchedule = {
    kind: 'RESOLVED';
    businessDate: string;
    assignmentId: string;
    source: AssignmentScope;
    workScheduleId: string;
    code: string;
    name: string;
    dayOfWeek: Weekday;
    isWorkingDay: boolean;
    startMinuteOfDay: number | null;
    endMinuteOfDay: number | null;
    crossesMidnight: boolean;
    unpaidBreakMinutes: number;
    grossScheduledMinutes: number;
    expectedWorkMinutes: number;
    timeZone: typeof REAL_CAPITA_TIME_ZONE;
} | {
    kind: 'NOT_CONFIGURED';
    code: 'WORK_SCHEDULE_NOT_CONFIGURED';
    businessDate: string;
};
export function resolveWorkSchedule(candidates: WorkScheduleAssignmentCandidate[], companyId: string, employeeId: string | null, businessDate: string): EffectiveWorkSchedule {
    assertBusinessDate(businessDate);
    const matching = candidates.filter(candidate => {
        if (candidate.companyId !== companyId || candidate.cancelledAt !== null)
            return false;
        assertScopeEmployee(candidate.scope, candidate.employeeId);
        return (candidate.scope === 'COMPANY_DEFAULT' || candidate.employeeId === employeeId) && matchesEffectiveDate(businessDate, candidate.effectiveFrom, candidate.effectiveTo);
    });
    const overrides = matching.filter(candidate => candidate.scope === 'EMPLOYEE_OVERRIDE');
    const defaults = matching.filter(candidate => candidate.scope === 'COMPANY_DEFAULT');
    if (overrides.length > 1 || defaults.length > 1)
        throw new WorkScheduleRuleError('Ambiguous effective work schedule assignments.');
    const assignment = overrides[0] ?? defaults[0];
    if (!assignment)
        return { kind: 'NOT_CONFIGURED', code: 'WORK_SCHEDULE_NOT_CONFIGURED', businessDate };
    if (!assignment.workSchedule)
        throw new WorkScheduleRuleError('Schedule definition is missing.');
    const definition = assignment.workSchedule;
    if (typeof definition.id !== 'string' || !definition.id.trim() || definition.id !== definition.id.trim())
        throw new WorkScheduleRuleError('Schedule definition id is missing or invalid.');
    try {
        if (normalizeScheduleCode(definition.code) !== definition.code)
            throw new WorkScheduleRuleError('Schedule definition code is not canonical.');
        if (normalizeScheduleName(definition.name) !== definition.name)
            throw new WorkScheduleRuleError('Schedule definition name is not canonical.');
    }
    catch (error) {
        if (error instanceof WorkScheduleRuleError)
            throw error;
        throw new WorkScheduleRuleError('Schedule definition identity or metadata is invalid.');
    }
    assertWeeklyRules(assignment.workSchedule.days);
    const dayOfWeek = WEEKDAYS[(new Date(`${businessDate}T00:00:00.000Z`).getUTCDay() + 6) % 7];
    const day = assignment.workSchedule.days.find(value => value.dayOfWeek === dayOfWeek)!;
    return { kind: 'RESOLVED', businessDate, assignmentId: assignment.id, source: assignment.scope, workScheduleId: assignment.workSchedule.id, code: assignment.workSchedule.code, name: assignment.workSchedule.name, dayOfWeek: day.dayOfWeek, isWorkingDay: day.isWorkingDay, startMinuteOfDay: day.startMinuteOfDay, endMinuteOfDay: day.endMinuteOfDay, crossesMidnight: day.crossesMidnight, unpaidBreakMinutes: day.unpaidBreakMinutes, ...scheduledMinutes(day), timeZone: REAL_CAPITA_TIME_ZONE };
}
