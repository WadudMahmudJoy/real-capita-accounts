import 'reflect-metadata';
import assert from 'node:assert/strict';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateWorkScheduleDto, UpdateWorkScheduleDto, CreateWorkScheduleAssignmentDto, ReplaceWorkScheduleAssignmentDto, EndWorkScheduleAssignmentDto, CancelWorkScheduleAssignmentDto, EffectiveWorkScheduleQueryDto, ListWorkSchedulesQueryDto, ListWorkScheduleAssignmentsQueryDto } from '../apps/api/src/work-schedule/dto/work-schedule.dto';
import { resolveWorkSchedule, WorkScheduleAssignmentCandidate } from '../apps/api/src/work-schedule/work-schedule-resolver';
import { parseDateOnly, bangladeshTodayDateOnly, REAL_CAPITA_TIME_ZONE } from '../apps/api/src/common/business-date';
import { assertWeeklyRules, assertDefinitionMutable, assertScopeEmployee, assertEffectiveRange, assertScheduleSource, normalizeScheduleCode, normalizeScheduleName, normalizeScheduleDescription, scheduledMinutes, WEEKDAYS, WorkScheduleDayInput, WorkScheduleRuleError, WorkScheduleDefinitionImmutableError } from '../apps/api/src/work-schedule/work-schedule-rules';
import { BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { normalizeWorkSchedulePrismaError } from '../apps/api/src/work-schedule/work-schedule-prisma-errors';
let passed = 0, failed = 0;
function check(name: string, fn: () => void) { try {
    fn();
    passed++;
    console.log(`PASS ${name}`);
}
catch (error) {
    failed++;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
} }
const days = (): WorkScheduleDayInput[] => WEEKDAYS.map(dayOfWeek => ({ dayOfWeek, isWorkingDay: true, startMinuteOfDay: 540, endMinuteOfDay: 1020, unpaidBreakMinutes: 60, crossesMidnight: false }));
check('code normalization', () => assert.equal(normalizeScheduleCode(' ws-01 '), 'WS-01'));
check('invalid code', () => assert.throws(() => normalizeScheduleCode('!bad'), WorkScheduleRuleError));
check('code length', () => assert.throws(() => normalizeScheduleCode('A'.repeat(33)), WorkScheduleRuleError));
check('valid week', () => assert.doesNotThrow(() => assertWeeklyRules(days())));
check('seven required', () => assert.throws(() => assertWeeklyRules(days().slice(1)), WorkScheduleRuleError));
check('unique weekdays', () => { const d = days(); d[1].dayOfWeek = 'MONDAY'; assert.throws(() => assertWeeklyRules(d), WorkScheduleRuleError); });
for (const [label, change] of Object.entries({ unknownDay: { dayOfWeek: 'HOLIDAY' }, fraction: { startMinuteOfDay: 1.5 }, negative: { startMinuteOfDay: -1 }, overflow: { endMinuteOfDay: 1440 }, missingTime: { startMinuteOfDay: null }, equal: { endMinuteOfDay: 540 }, reverse: { endMinuteOfDay: 500 }, badOvernight: { crossesMidnight: true }, negativeBreak: { unpaidBreakMinutes: -1 }, wholeBreak: { unpaidBreakMinutes: 480 }, fractionBreak: { unpaidBreakMinutes: 0.5 }, restTime: { isWorkingDay: false }, restBreak: { isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 1 }, restOvernight: { isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: true } })) {
    check(`invalid ${label}`, () => { const d = days(); Object.assign(d[0], change); assert.throws(() => assertWeeklyRules(d), WorkScheduleRuleError); });
}
check('ordinary duration', () => assert.deepEqual(scheduledMinutes(days()[0]), { grossScheduledMinutes: 480, expectedWorkMinutes: 420 }));
check('overnight duration', () => assert.deepEqual(scheduledMinutes({ ...days()[0], startMinuteOfDay: 1320, endMinuteOfDay: 360, crossesMidnight: true }), { grossScheduledMinutes: 480, expectedWorkMinutes: 420 }));
check('rest duration', () => assert.deepEqual(scheduledMinutes({ ...days()[0], isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0 }), { grossScheduledMinutes: 0, expectedWorkMinutes: 0 }));
check('ever assigned including cancelled immutable', () => assert.throws(() => assertDefinitionMutable(true, true), WorkScheduleRuleError));
check('metadata mutable', () => assert.doesNotThrow(() => assertDefinitionMutable(true, false)));
check('unassigned days mutable', () => assert.doesNotThrow(() => assertDefinitionMutable(false, true)));
check('company employee forbidden', () => assert.throws(() => assertScopeEmployee('COMPANY_DEFAULT', 'e1'), WorkScheduleRuleError));
check('override employee required', () => assert.throws(() => assertScopeEmployee('EMPLOYEE_OVERRIDE', null), WorkScheduleRuleError));
check('equal range rejected', () => assert.throws(() => assertEffectiveRange('2026-01-01', '2026-01-01'), WorkScheduleRuleError));
check('backward range rejected', () => assert.throws(() => assertEffectiveRange('2026-01-02', '2026-01-01'), WorkScheduleRuleError));
check('open range accepted', () => assert.doesNotThrow(() => assertEffectiveRange('2026-01-01', null)));
const candidate = (override: Partial<WorkScheduleAssignmentCandidate> = {}): WorkScheduleAssignmentCandidate => ({ id: 'a1', scope: 'COMPANY_DEFAULT', companyId: 'c1', employeeId: null, effectiveFrom: '2026-01-01', effectiveTo: null, cancelledAt: null, workSchedule: { id: 's1', code: 'TEST', name: 'Test', isActive: true, days: days() }, ...override });
const resolve = (items: WorkScheduleAssignmentCandidate[], date = '2026-09-02'): Record<string, unknown> => ({ ...resolveWorkSchedule(items, 'c1', 'e1', date) });
check('resolver configured', () => { const r = resolve([candidate()]); assert.equal(r.kind, 'RESOLVED'); assert.equal(r.expectedWorkMinutes, 420); assert.equal(r.dayOfWeek, 'WEDNESDAY'); assert.equal(r.timeZone, 'Asia/Dhaka'); });
check('half open start included', () => assert.equal(resolve([candidate()], '2026-01-01').kind, 'RESOLVED'));
check('half open end excluded', () => assert.equal(resolve([candidate({ effectiveTo: '2026-09-02' })]).kind, 'NOT_CONFIGURED'));
check('before start excluded', () => assert.equal(resolve([candidate()], '2025-12-31').kind, 'NOT_CONFIGURED'));
check('override priority', () => assert.equal(resolve([candidate(), candidate({ id: 'a2', scope: 'EMPLOYEE_OVERRIDE', employeeId: 'e1' })]).assignmentId, 'a2'));
check('cancelled override fallback', () => assert.equal(resolve([candidate(), candidate({ id: 'a2', scope: 'EMPLOYEE_OVERRIDE', employeeId: 'e1', cancelledAt: new Date() })]).assignmentId, 'a1'));
check('rest override wins', () => { const a = candidate({ id: 'rest', scope: 'EMPLOYEE_OVERRIDE', employeeId: 'e1' }); a.workSchedule.days[2] = { dayOfWeek: 'WEDNESDAY', isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false }; const r = resolve([candidate(), a]); assert.equal(r.assignmentId, 'rest'); assert.equal(r.expectedWorkMinutes, 0); assert.equal(r.isWorkingDay, false); });
check('inactive historical schedule works', () => { const a = candidate(); a.workSchedule.isActive = false; assert.equal(resolve([a]).kind, 'RESOLVED'); });
check('missing explicit state', () => assert.deepEqual(resolve([]), { kind: 'NOT_CONFIGURED', code: 'WORK_SCHEDULE_NOT_CONFIGURED', businessDate: '2026-09-02' }));
check('other company ignored', () => assert.equal(resolve([candidate({ companyId: 'c2' })]).kind, 'NOT_CONFIGURED'));
check('other employee ignored', () => assert.equal(resolve([candidate({ scope: 'EMPLOYEE_OVERRIDE', employeeId: 'e2' })]).kind, 'NOT_CONFIGURED'));
check('ambiguous rejected', () => assert.throws(() => resolve([candidate(), candidate({ id: 'a2' })]), WorkScheduleRuleError));
check('incomplete definition rejected', () => { const a = candidate(); a.workSchedule.days.pop(); assert.throws(() => resolve([a]), WorkScheduleRuleError); });
for (const [label, field, value] of [
    ['missing id', 'id', undefined],
    ['blank id', 'id', ' '],
    ['missing code', 'code', undefined],
    ['blank code', 'code', ''],
    ['noncanonical code', 'code', ' test '],
    ['invalid code', 'code', '!BAD'],
    ['missing name', 'name', undefined],
    ['blank name', 'name', ' '],
    ['untrimmed name', 'name', ' Test '],
    ['overlength name', 'name', 'x'.repeat(151)],
] as const)
    check(`resolver rejects definition ${label}`, () => {
        const a = candidate();
        Object.assign(a.workSchedule, { [field]: value });
        assert.throws(() => resolve([a]), WorkScheduleRuleError);
    });
check('malformed resolver date rejected', () => assert.throws(() => resolve([], '2026-02-30'), WorkScheduleRuleError));
for (const value of ['2026-02-30', '2026-2-01', '2026-01-01T00:00:00Z', '2025-02-29'])
    check(`strict date ${value}`, () => assert.throws(() => parseDateOnly(value, 'date')));
check('leap date accepted', () => assert.equal(parseDateOnly('2024-02-29', 'date').toISOString(), '2024-02-29T00:00:00.000Z'));
check('Dhaka before boundary', () => assert.equal(bangladeshTodayDateOnly(new Date('2026-09-01T17:59:59Z')).toISOString().slice(0, 10), '2026-09-01'));
check('Dhaka at boundary', () => assert.equal(bangladeshTodayDateOnly(new Date('2026-09-01T18:00:00Z')).toISOString().slice(0, 10), '2026-09-02'));
check('fixed timezone', () => assert.equal(REAL_CAPITA_TIME_ZONE, 'Asia/Dhaka'));
const dtoErrors = (value: object) => validateSync(plainToInstance(CreateWorkScheduleDto, value), { whitelist: true, forbidNonWhitelisted: true });
check('DTO valid definition', () => assert.equal(dtoErrors({ name: 'Day schedule', days: days() }).length, 0));
check('DTO null name rejected', () => assert.ok(dtoErrors({ name: null, days: days() }).length));
check('DTO impossible days rejected', () => assert.ok(dtoErrors({ name: 'Test', days: [] }).length));
check('DTO unknown/system fields rejected', () => assert.ok(dtoErrors({ name: 'Test', days: days(), companyId: 'c1', timeZone: 'UTC', createdById: 'u1' }).length));
check('resolver projects only approved day fields', () => { const a = candidate(); Object.assign(a.workSchedule.days[2], { privateField: 'should-not-escape' }); assert.equal(resolve([a]).privateField, undefined); });
check('overnight remains anchored to starting date', () => { const a = candidate(); a.workSchedule.days[2] = { dayOfWeek: 'WEDNESDAY', isWorkingDay: true, startMinuteOfDay: 1430, endMinuteOfDay: 7, crossesMidnight: true, unpaidBreakMinutes: 2 }; const r = resolve([a]); assert.equal(r.grossScheduledMinutes, 17); assert.equal(r.expectedWorkMinutes, 15); assert.equal(r.businessDate, '2026-09-02'); });
check('all weekdays mapped', () => { for (let i = 0; i < 7; i++)
    assert.equal(resolve([candidate()], `2026-09-${String(7 + i).padStart(2, '0')}`).dayOfWeek, WEEKDAYS[i]); });
check('name normalization', () => assert.equal(normalizeScheduleName(' Test '), 'Test'));
check('name blank rejected', () => assert.throws(() => normalizeScheduleName(' '), WorkScheduleRuleError));
check('name length rejected', () => assert.throws(() => normalizeScheduleName('x'.repeat(151)), WorkScheduleRuleError));
check('description normalization', () => assert.equal(normalizeScheduleDescription(' '), null));
check('description length rejected', () => assert.throws(() => normalizeScheduleDescription('x'.repeat(501)), WorkScheduleRuleError));
check('source neither rejected', () => assert.throws(() => assertScheduleSource(undefined, undefined), WorkScheduleRuleError));
check('source both rejected', () => assert.throws(() => assertScheduleSource('s1', {}), WorkScheduleRuleError));
check('source existing accepted', () => assert.doesNotThrow(() => assertScheduleSource('s1', undefined)));
check('source new accepted', () => assert.doesNotThrow(() => assertScheduleSource(undefined, {})));
function errorsFor<T extends object>(type: new () => T, value: object) { return validateSync(plainToInstance(type, value), { whitelist: true, forbidNonWhitelisted: true }); }
check('DTO trims name and code', () => { const d = plainToInstance(CreateWorkScheduleDto, { name: ' Test ', code: ' ws-01 ', days: days() }); assert.equal(d.name, 'Test'); assert.equal(d.code, 'WS-01'); });
check('DTO nested system fields rejected', () => { const d = days(); Object.assign(d[0], { companyId: 'c1' }); assert.ok(dtoErrors({ name: 'Test', days: d }).length); });
check('DTO null update fields rejected', () => { for (const key of ['name', 'isActive', 'days'])
    assert.ok(errorsFor(UpdateWorkScheduleDto, { [key]: null }).length, key); });
check('DTO description clears with null', () => assert.equal(errorsFor(UpdateWorkScheduleDto, { description: null }).length, 0));
check('DTO immutable update fields rejected', () => { for (const key of ['code', 'companyId', 'createdById', 'timeZone'])
    assert.ok(errorsFor(UpdateWorkScheduleDto, { [key]: 'x' }).length, key); });
check('DTO valid assignment', () => assert.equal(errorsFor(CreateWorkScheduleAssignmentDto, { scope: 'COMPANY_DEFAULT', workScheduleId: 's1', effectiveFrom: '2026-09-02' }).length, 0));
check('DTO valid inline assignment', () => assert.equal(errorsFor(CreateWorkScheduleAssignmentDto, { scope: 'EMPLOYEE_OVERRIDE', employeeId: 'e1', newSchedule: { name: 'Test', days: days() }, effectiveFrom: '2026-09-02' }).length, 0));
check('DTO assignment null mandatory values rejected', () => { for (const key of ['scope', 'effectiveFrom'])
    assert.ok(errorsFor(CreateWorkScheduleAssignmentDto, { scope: 'COMPANY_DEFAULT', workScheduleId: 's1', effectiveFrom: '2026-09-02', [key]: null }).length, key); });
check('DTO assignment impossible date rejected', () => assert.ok(errorsFor(CreateWorkScheduleAssignmentDto, { scope: 'COMPANY_DEFAULT', workScheduleId: 's1', effectiveFrom: '2026-02-30' }).length));
check('DTO assignment null source rejected', () => assert.ok(errorsFor(CreateWorkScheduleAssignmentDto, { scope: 'COMPANY_DEFAULT', workScheduleId: null, effectiveFrom: '2026-09-02' }).length));
const mutation = { changeReason: 'Test reason', expectedUpdatedAt: '2026-09-02T10:00:00.000Z' };
check('DTO valid replace', () => assert.equal(errorsFor(ReplaceWorkScheduleAssignmentDto, { ...mutation, effectiveFrom: '2026-09-02', workScheduleId: 's1' }).length, 0));
check('DTO valid end', () => assert.equal(errorsFor(EndWorkScheduleAssignmentDto, { ...mutation, effectiveTo: '2026-09-03' }).length, 0));
check('DTO valid cancel', () => assert.equal(errorsFor(CancelWorkScheduleAssignmentDto, mutation).length, 0));
check('DTO mutation null reason rejected', () => assert.ok(errorsFor(CancelWorkScheduleAssignmentDto, { ...mutation, changeReason: null }).length));
check('DTO mutation blank reason rejected', () => assert.ok(errorsFor(CancelWorkScheduleAssignmentDto, { ...mutation, changeReason: ' ' }).length));
check('DTO expected timestamp required', () => assert.ok(errorsFor(CancelWorkScheduleAssignmentDto, { changeReason: 'Test' }).length));
check('DTO expected timestamp date only rejected', () => assert.ok(errorsFor(CancelWorkScheduleAssignmentDto, { ...mutation, expectedUpdatedAt: '2026-09-02' }).length));
check('DTO effective business date required', () => assert.ok(errorsFor(EffectiveWorkScheduleQueryDto, {}).length));
check('DTO effective impossible business date rejected', () => assert.ok(errorsFor(EffectiveWorkScheduleQueryDto, { businessDate: '2026-02-30' }).length));
check('DTO effective timezone injection rejected', () => assert.ok(errorsFor(EffectiveWorkScheduleQueryDto, { businessDate: '2026-09-02', timeZone: 'UTC' }).length));
check('DTO include inactive boolean parsed', () => { const d = plainToInstance(ListWorkSchedulesQueryDto, { includeInactive: 'false' }); assert.equal(d.includeInactive, false); assert.equal(validateSync(d).length, 0); });
check('DTO include inactive invalid boolean rejected', () => assert.ok(errorsFor(ListWorkSchedulesQueryDto, { includeInactive: 'yes' }).length));
check('DTO assignment list employee id trimmed', () => assert.equal(plainToInstance(ListWorkScheduleAssignmentsQueryDto, { employeeId: ' e1 ' }).employeeId, 'e1'));
function normalized(error: unknown): unknown { try { normalizeWorkSchedulePrismaError(error); } catch (value) { return value; } }
check('normalizer preserves HTTP exception', () => { const source = new BadRequestException('safe'); assert.equal(normalized(source), source); });
check('normalizer rule error is controlled 400', () => assert.ok(normalized(new WorkScheduleRuleError('bad rule')) instanceof BadRequestException));
check('normalizer used definition immutability is controlled 409', () => assert.ok(normalized(new WorkScheduleDefinitionImmutableError('used')) instanceof ConflictException));
check('normalizer unique is generic 409', () => { const value = normalized({ code: 'P2002', meta: { target: 'private_column' } }); assert.ok(value instanceof ConflictException); assert.equal((value as Error).message, 'A Work Schedule record with those values already exists.'); });
check('normalizer reference error is controlled 400', () => assert.ok(normalized({ code: 'P2003', meta: { field_name: 'private' } }) instanceof BadRequestException));
check('normalizer missing is 404', () => assert.ok(normalized({ code: 'P2025' }) instanceof NotFoundException));
check('normalizer retry conflict is 409', () => assert.ok(normalized({ code: 'P2034' }) instanceof ConflictException));
check('normalizer exact adapter overlap is 409', () => { const value = normalized({ cause: { kind: 'postgres', code: '23P01', originalMessage: 'conflicting key value violates exclusion constraint "work_schedule_assignments_default_range_excl"' } }); assert.ok(value instanceof ConflictException); });
check('normalizer exact P2004 overlap is 409', () => assert.ok(normalized({ code: 'P2004', meta: { cause: { kind: 'postgres', code: '23P01', originalMessage: 'violates exclusion constraint "work_schedule_assignments_employee_range_excl"' } } }) instanceof ConflictException));
check('normalizer unrelated P2004 remains generic', () => assert.ok(normalized({ code: 'P2004', meta: { cause: { kind: 'postgres', code: '23P01', originalMessage: 'other exclusion' } } }) instanceof InternalServerErrorException));
check('normalizer unrelated adapter 23P01 remains generic', () => assert.ok(normalized({ cause: { kind: 'postgres', code: '23P01', originalMessage: 'other exclusion' } }) instanceof InternalServerErrorException));
check('normalizer diagnostic text does not classify overlap', () => assert.ok(normalized({ message: '23P01 work_schedule_assignments_default_range_excl' }) instanceof InternalServerErrorException));
console.log(`${passed} PASS / ${failed} FAIL`);
if (failed)
    process.exitCode = 1;
