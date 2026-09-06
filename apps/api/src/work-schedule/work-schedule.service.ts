import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { bangladeshTodayDateOnly, parseDateOnly } from '../common/business-date';
import { Prisma, WorkScheduleAssignmentScope } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CancelWorkScheduleAssignmentDto, CreateWorkScheduleAssignmentDto, CreateWorkScheduleDto, EndWorkScheduleAssignmentDto, ReplaceWorkScheduleAssignmentDto, UpdateWorkScheduleDto } from './dto/work-schedule.dto';
import { normalizeWorkSchedulePrismaError } from './work-schedule-prisma-errors';
import { resolveWorkSchedule as resolveCandidates } from './work-schedule-resolver';
import { WorkScheduleDayInput, assertDefinitionMutable, assertEffectiveRange, assertScheduleSource, assertScopeEmployee, assertWeeklyRules, normalizeScheduleCode, normalizeScheduleDescription, normalizeScheduleName } from './work-schedule-rules';

type Tx = Prisma.TransactionClient;
const scheduleInclude = { days: { orderBy: { dayOfWeek: 'asc' as const } }, _count: { select: { assignments: true } } };
const assignmentInclude = { workSchedule: { include: { days: { orderBy: { dayOfWeek: 'asc' as const } } } } };

@Injectable()
export class WorkScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async listSchedules(includeInactive = false) {
    const companyId = await this.currentCompanyId();
    const rows = await this.prisma.workSchedule.findMany({ where: { companyId, ...(includeInactive ? {} : { isActive: true }) }, include: scheduleInclude, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    return rows.map(scheduleView);
  }

  async getSchedule(id: string) {
    const companyId = await this.currentCompanyId();
    const row = await this.prisma.workSchedule.findFirst({ where: { id, companyId }, include: scheduleInclude });
    if (!row) throw new NotFoundException('Work Schedule was not found.');
    return scheduleView(row);
  }

  async createSchedule(dto: CreateWorkScheduleDto, user: AuthenticatedUser) {
    try {
      return await this.serializable(async tx => {
        const companyId = await companyContext(tx);
        const row = await createDefinition(tx, companyId, dto, user.id);
        await audit(tx, user.id, 'WORK_SCHEDULE_CREATED', 'WorkSchedule', row.id, { workScheduleId: row.id });
        return scheduleView(row);
      });
    } catch (error) { normalizeWorkSchedulePrismaError(error); }
  }

  async updateSchedule(id: string, dto: UpdateWorkScheduleDto, user: AuthenticatedUser) {
    try {
      return await this.serializable(async tx => {
        const companyId = await companyContext(tx);
        await lockSchedule(tx, id);
        const existing = await tx.workSchedule.findFirst({ where: { id, companyId }, include: scheduleInclude });
        if (!existing) throw new NotFoundException('Work Schedule was not found.');
        assertDefinitionMutable(existing._count.assignments > 0, dto.days !== undefined);
        if (dto.days) assertWeeklyRules(dto.days);
        const changedFields = (['name', 'description', 'isActive', 'days'] as const).filter(field => dto[field] !== undefined);
        const row = await tx.workSchedule.update({ where: { id }, data: {
          ...(dto.name === undefined ? {} : { name: normalizeScheduleName(dto.name) }),
          ...(dto.description === undefined ? {} : { description: normalizeScheduleDescription(dto.description) }),
          ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
          ...(dto.days === undefined ? {} : { days: { deleteMany: {}, create: dto.days.map(dayData) } }),
        }, include: scheduleInclude });
        const action = dto.isActive === true && !existing.isActive ? 'WORK_SCHEDULE_ACTIVATED' : dto.isActive === false && existing.isActive ? 'WORK_SCHEDULE_INACTIVATED' : 'WORK_SCHEDULE_UPDATED';
        await audit(tx, user.id, action, 'WorkSchedule', id, { workScheduleId: id, changedFields });
        return scheduleView(row);
      });
    } catch (error) { normalizeWorkSchedulePrismaError(error); }
  }

  async listAssignments(employeeId?: string) {
    const companyId = await this.currentCompanyId();
    const rows = await this.prisma.workScheduleAssignment.findMany({ where: { companyId, ...(employeeId ? { employeeId } : {}) }, include: assignmentInclude, orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }] });
    return rows.map(assignmentView);
  }

  async resolveWorkSchedule(employeeId: string | undefined, businessDate: string) {
    const companyId = await this.currentCompanyId();
    if (employeeId) await this.requireEmployee(this.prisma, employeeId);
    const rows = await this.assignmentCandidates(this.prisma, companyId, employeeId, businessDate);
    return resolveCandidates(rows.map(candidateView), companyId, employeeId ?? null, businessDate);
  }

  async resolveWorkScheduleWithTx(tx: Tx, companyId: string, employeeId: string | undefined, businessDate: string) {
    if (employeeId) await requireEmployee(tx, employeeId);
    const rows = await this.assignmentCandidates(tx, companyId, employeeId, businessDate);
    return resolveCandidates(rows.map(candidateView), companyId, employeeId ?? null, businessDate);
  }

  private async assignmentCandidates(client: Pick<Tx, 'workScheduleAssignment'>, companyId: string, employeeId: string | undefined, businessDate: string) {
    return client.workScheduleAssignment.findMany({ where: { companyId, cancelledAt: null, OR: [{ scope: WorkScheduleAssignmentScope.COMPANY_DEFAULT }, ...(employeeId ? [{ scope: WorkScheduleAssignmentScope.EMPLOYEE_OVERRIDE, employeeId }] : [])], effectiveFrom: { lte: parseDateOnly(businessDate, 'businessDate') }, AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gt: parseDateOnly(businessDate, 'businessDate') } }] }] }, include: assignmentInclude });
  }

  async createAssignment(dto: CreateWorkScheduleAssignmentDto, user: AuthenticatedUser) {
    try {
      return await this.serializable(async tx => {
        const companyId = await companyContext(tx);
        assertScopeEmployee(dto.scope, dto.employeeId);
        assertScheduleSource(dto.workScheduleId, dto.newSchedule);
        assertEffectiveRange(dto.effectiveFrom, dto.effectiveTo);
        if (dto.employeeId) await requireEmployeeLocked(tx, dto.employeeId, true);
        const history = dto.scope === 'COMPANY_DEFAULT' ? await tx.workScheduleAssignment.count({ where: { companyId, scope: WorkScheduleAssignmentScope.COMPANY_DEFAULT } }) : 0;
        assertCreationDate(dto, history, today());
        const schedule = dto.newSchedule ? await createDefinition(tx, companyId, dto.newSchedule, user.id) : await activeScheduleLocked(tx, companyId, dto.workScheduleId!);
        if (dto.newSchedule) await audit(tx, user.id, 'WORK_SCHEDULE_CREATED', 'WorkSchedule', schedule.id, { workScheduleId: schedule.id });
        const row = await tx.workScheduleAssignment.create({ data: { companyId, scope: dto.scope, employeeId: dto.employeeId ?? null, workScheduleId: schedule.id, effectiveFrom: parseDateOnly(dto.effectiveFrom, 'effectiveFrom'), effectiveTo: dto.effectiveTo ? parseDateOnly(dto.effectiveTo, 'effectiveTo') : null, changeReason: cleanReason(dto.changeReason), createdById: user.id }, include: assignmentInclude });
        const action = dto.scope === 'COMPANY_DEFAULT' ? 'WORK_SCHEDULE_DEFAULT_ASSIGNED' : 'WORK_SCHEDULE_EMPLOYEE_OVERRIDE_CREATED';
        await audit(tx, user.id, action, 'WorkScheduleAssignment', row.id, assignmentMetadata(row));
        return assignmentView(row);
      });
    } catch (error) { normalizeWorkSchedulePrismaError(error); }
  }

  async replaceAssignment(id: string, dto: ReplaceWorkScheduleAssignmentDto, user: AuthenticatedUser) {
    try {
      return await this.serializable(async tx => {
        const companyId = await companyContext(tx);
        const before = await tx.workScheduleAssignment.findFirst({ where: { id, companyId } });
        if (!before) throw new NotFoundException('Work Schedule assignment was not found.');
        if (before.employeeId) await requireEmployeeLocked(tx, before.employeeId, true);
        await lockSchedule(tx, before.workScheduleId); await lockAssignments(tx, [id]);
        const old = await tx.workScheduleAssignment.findFirst({ where: { id, companyId } });
        assertLiveAndFresh(old, dto.expectedUpdatedAt);
        requireFuture(dto.effectiveFrom); requireReason(dto.changeReason); assertScheduleSource(dto.workScheduleId, dto.newSchedule);
        if (dto.effectiveFrom <= dateOnly(old.effectiveFrom) || (old.effectiveTo && dto.effectiveFrom >= dateOnly(old.effectiveTo))) throw new BadRequestException('Replacement date must be inside the assignment after its start.');
        if (await tx.workScheduleAssignment.count({ where: { replacesAssignmentId: id, cancelledAt: null } })) throw new ConflictException('A live replacement already depends on this assignment.');
        const schedule = dto.newSchedule ? await createDefinition(tx, companyId, dto.newSchedule, user.id) : await activeScheduleLocked(tx, companyId, dto.workScheduleId!);
        if (dto.newSchedule) await audit(tx, user.id, 'WORK_SCHEDULE_CREATED', 'WorkSchedule', schedule.id, { workScheduleId: schedule.id });
        const previousEnd = old.effectiveTo;
        await tx.workScheduleAssignment.update({ where: { id }, data: { effectiveTo: parseDateOnly(dto.effectiveFrom, 'effectiveFrom'), updatedAt: monotonic(old.updatedAt) } });
        const replacement = await tx.workScheduleAssignment.create({ data: { companyId, scope: old.scope, employeeId: old.employeeId, workScheduleId: schedule.id, effectiveFrom: parseDateOnly(dto.effectiveFrom, 'effectiveFrom'), effectiveTo: previousEnd, changeReason: dto.changeReason.trim(), createdById: user.id, replacesAssignmentId: id }, include: assignmentInclude });
        await audit(tx, user.id, 'WORK_SCHEDULE_ASSIGNMENT_REPLACED', 'WorkScheduleAssignment', replacement.id, { ...assignmentMetadata(replacement), predecessorId: id, replacementId: replacement.id });
        return assignmentView(replacement);
      });
    } catch (error) { normalizeWorkSchedulePrismaError(error); }
  }

  async endAssignment(id: string, dto: EndWorkScheduleAssignmentDto, user: AuthenticatedUser) {
    try {
      return await this.serializable(async tx => {
        const companyId = await companyContext(tx);
        const before = await tx.workScheduleAssignment.findFirst({ where: { id, companyId } });
        if (!before) throw new NotFoundException('Work Schedule assignment was not found.');
        if (before.employeeId) await requireEmployeeLocked(tx, before.employeeId);
        await lockSchedule(tx, before.workScheduleId); await lockAssignments(tx, [id]);
        const row = await tx.workScheduleAssignment.findFirst({ where: { id, companyId } }); assertLiveAndFresh(row, dto.expectedUpdatedAt);
        if (row.scope !== WorkScheduleAssignmentScope.EMPLOYEE_OVERRIDE) throw new BadRequestException('Company default assignments must be replaced, not ended.');
        requireFuture(dto.effectiveTo); requireReason(dto.changeReason);
        if (dto.effectiveTo <= dateOnly(row.effectiveFrom) || (row.effectiveTo && dto.effectiveTo >= dateOnly(row.effectiveTo))) throw new BadRequestException('Effective Until must shorten the Employee override.');
        if (row.replacesAssignmentId && dateOnly(row.effectiveFrom) > today()) throw new ConflictException('Cancel or change the unstarted replacement before ending it.');
        if (await tx.workScheduleAssignment.count({ where: { replacesAssignmentId: id, cancelledAt: null } })) throw new ConflictException('A live replacement depends on this assignment.');
        const updated = await tx.workScheduleAssignment.update({ where: { id }, data: { effectiveTo: parseDateOnly(dto.effectiveTo, 'effectiveTo'), changeReason: dto.changeReason.trim(), updatedAt: monotonic(row.updatedAt) }, include: assignmentInclude });
        await audit(tx, user.id, 'WORK_SCHEDULE_ASSIGNMENT_ENDED', 'WorkScheduleAssignment', id, assignmentMetadata(updated)); return assignmentView(updated);
      });
    } catch (error) { normalizeWorkSchedulePrismaError(error); }
  }

  async cancelAssignment(id: string, dto: CancelWorkScheduleAssignmentDto, user: AuthenticatedUser) {
    try {
      return await this.serializable(async tx => {
        const companyId = await companyContext(tx);
        const before = await tx.workScheduleAssignment.findFirst({ where: { id, companyId } });
        if (!before) throw new NotFoundException('Work Schedule assignment was not found.');
        if (before.employeeId) await requireEmployeeLocked(tx, before.employeeId);
        await lockSchedule(tx, before.workScheduleId); await lockAssignments(tx, [id, before.replacesAssignmentId].filter((value): value is string => Boolean(value)));
        const row = await tx.workScheduleAssignment.findFirst({ where: { id, companyId } }); assertLiveAndFresh(row, dto.expectedUpdatedAt); requireReason(dto.changeReason);
        if (dateOnly(row.effectiveFrom) <= today()) throw new BadRequestException('Only an unstarted future assignment can be cancelled.');
        if (await tx.workScheduleAssignment.count({ where: { replacesAssignmentId: id, cancelledAt: null } })) throw new ConflictException('A live replacement depends on this assignment.');
        if (!row.replacesAssignmentId && row.scope === WorkScheduleAssignmentScope.COMPANY_DEFAULT) throw new ConflictException('The initial company default cannot be cancelled without a replacement.');
        const cancelledAt = new Date();
        await tx.workScheduleAssignment.update({ where: { id }, data: { cancelledAt, changeReason: dto.changeReason.trim(), updatedAt: monotonic(row.updatedAt) } });
        if (row.replacesAssignmentId) {
          const predecessor = await tx.workScheduleAssignment.findFirst({ where: { id: row.replacesAssignmentId, companyId, scope: row.scope, employeeId: row.employeeId, cancelledAt: null } });
          if (!predecessor || !predecessor.effectiveTo || dateOnly(predecessor.effectiveTo) !== dateOnly(row.effectiveFrom)) throw new ConflictException('The predecessor boundary can no longer be restored safely.');
          await tx.workScheduleAssignment.update({ where: { id: predecessor.id }, data: { effectiveTo: row.effectiveTo, updatedAt: monotonic(predecessor.updatedAt) } });
        }
        const updated = await tx.workScheduleAssignment.findUniqueOrThrow({ where: { id }, include: assignmentInclude });
        await audit(tx, user.id, 'WORK_SCHEDULE_FUTURE_ASSIGNMENT_CANCELLED', 'WorkScheduleAssignment', id, { ...assignmentMetadata(updated), predecessorId: row.replacesAssignmentId }); return assignmentView(updated);
      });
    } catch (error) { normalizeWorkSchedulePrismaError(error); }
  }

  private serializable<T>(work: (tx: Tx) => Promise<T>) { return this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
  private async currentCompanyId() { const company = await this.prisma.company.findUnique({ where: { singletonKey: 'PRIMARY' }, select: { id: true } }); if (!company) throw new ConflictException('Current company context is not configured.'); return company.id; }
  private requireEmployee(client: PrismaService, id: string) { return requireEmployee(client, id); }
}

async function companyContext(tx: Tx): Promise<string> { const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM companies WHERE "singletonKey" = 'PRIMARY' FOR UPDATE`; if (rows.length !== 1) throw new ConflictException('Current company context is not configured.'); return rows[0].id; }
async function lockSchedule(tx: Tx, id: string) { await tx.$queryRaw`SELECT id FROM work_schedules WHERE id = ${id} FOR UPDATE`; }
async function lockAssignments(tx: Tx, ids: string[]) { if (ids.length) await tx.$queryRaw`SELECT id FROM work_schedule_assignments WHERE id IN (${Prisma.join([...new Set(ids)].sort())}) ORDER BY id FOR UPDATE`; }
async function requireEmployee(client: Pick<Tx, 'employee'> | PrismaService, id: string) { const employee = await client.employee.findUnique({ where: { id }, select: { id: true } }); if (!employee) throw new NotFoundException('Employee was not found.'); return employee; }
async function requireEmployeeLocked(tx: Tx, id: string, requireActive = false) {
  await tx.$queryRaw`SELECT id FROM employees WHERE id = ${id} FOR UPDATE`;
  const employee = await tx.employee.findUnique({ where: { id }, select: { id: true, isActive: true, isDeleted: true } });
  if (!employee) throw new NotFoundException('Employee was not found.');
  if (requireActive && (!employee.isActive || employee.isDeleted)) throw new BadRequestException('Only an active Employee can receive a new Work Schedule override.');
  return employee;
}
async function activeScheduleLocked(tx: Tx, companyId: string, id: string) { await lockSchedule(tx, id); const schedule = await tx.workSchedule.findFirst({ where: { id, companyId }, include: scheduleInclude }); if (!schedule) throw new NotFoundException('Work Schedule was not found.'); if (!schedule.isActive) throw new BadRequestException('Inactive Work Schedules cannot receive new assignments.'); if (schedule.days.length !== 7) throw new BadRequestException('Work Schedule must have seven valid days.'); assertWeeklyRules(schedule.days); return schedule; }
async function createDefinition(tx: Tx, companyId: string, dto: CreateWorkScheduleDto, userId: string) { assertWeeklyRules(dto.days); const code = normalizeScheduleCode(dto.code ?? `WS-${randomUUID().replaceAll('-', '').slice(0, 12)}`); return tx.workSchedule.create({ data: { companyId, code, name: normalizeScheduleName(dto.name), description: normalizeScheduleDescription(dto.description), createdById: userId, days: { create: dto.days.map(dayData) } }, include: scheduleInclude }); }
function dayData(day: WorkScheduleDayInput) { return { dayOfWeek: day.dayOfWeek, isWorkingDay: day.isWorkingDay, startMinuteOfDay: day.startMinuteOfDay, endMinuteOfDay: day.endMinuteOfDay, unpaidBreakMinutes: day.unpaidBreakMinutes, crossesMidnight: day.crossesMidnight }; }
function today() { return bangladeshTodayDateOnly().toISOString().slice(0, 10); }
function dateOnly(value: Date) { return value.toISOString().slice(0, 10); }
function iso(value: Date | null) { return value?.toISOString() ?? null; }
function cleanReason(value: string | null | undefined) { if (value != null && typeof value !== 'string') throw new BadRequestException('Change Reason is invalid.'); const result = value?.trim() || null; if (result && result.length > 500) throw new BadRequestException('Change Reason must not exceed 500 characters.'); return result; }
function requireReason(value: string | null | undefined) { const result = cleanReason(value); if (!result) throw new BadRequestException('Change Reason is required.'); return result; }
function monotonic(value: Date) { return new Date(Math.max(Date.now(), value.getTime() + 1)); }
function requireFuture(value: string) { if (value <= today()) throw new BadRequestException('The effective date must be after today in Asia/Dhaka.'); }
function assertLiveAndFresh<T extends { cancelledAt: Date | null; updatedAt: Date } | null>(row: T, expected: string): asserts row is NonNullable<T> { if (!row) throw new NotFoundException('Work Schedule assignment was not found.'); if (row.cancelledAt) throw new ConflictException('Work Schedule assignment is already cancelled.'); if (typeof expected !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(expected) || Number.isNaN(Date.parse(expected))) throw new BadRequestException('Expected Updated At must be a valid ISO timestamp.'); if (row.updatedAt.getTime() !== new Date(expected).getTime()) throw new ConflictException('The Work Schedule assignment changed. Refresh and try again.'); }
function approvedInitial(dto: CreateWorkScheduleAssignmentDto) { const days = dto.newSchedule?.days; return dto.scope === 'COMPANY_DEFAULT' && dto.employeeId == null && dto.effectiveFrom === '2026-09-01' && dto.effectiveTo == null && dto.newSchedule?.code === 'STANDARD_OFFICE' && dto.newSchedule.name === 'Standard Office Schedule' && days?.length === 7 && days.every(day => day.dayOfWeek === 'FRIDAY' ? !day.isWorkingDay && day.startMinuteOfDay === null && day.endMinuteOfDay === null && day.unpaidBreakMinutes === 0 && !day.crossesMidnight : day.isWorkingDay && day.startMinuteOfDay === 600 && day.endMinuteOfDay === 1080 && day.unpaidBreakMinutes === 60 && !day.crossesMidnight); }
function assertCreationDate(dto: CreateWorkScheduleAssignmentDto, defaultHistory: number, current: string) { if (dto.effectiveFrom > current) return; if (defaultHistory === 0 && approvedInitial(dto)) return; if (dto.scope === 'COMPANY_DEFAULT' && defaultHistory > 0 && approvedInitial(dto)) throw new ConflictException('Initial Work Schedule setup already exists.'); throw new BadRequestException('New assignments must start after today in Asia/Dhaka.'); }
function scheduleView(row: { id: string; companyId: string; code: string; name: string; description: string | null; isActive: boolean; createdAt: Date; updatedAt: Date; days: WorkScheduleDayInput[]; _count: { assignments: number } }) { return { id: row.id, code: row.code, name: row.name, description: row.description, isActive: row.isActive, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), days: row.days.map(dayData), everAssigned: row._count.assignments > 0 }; }
function assignmentView(row: { id: string; scope: WorkScheduleAssignmentScope; employeeId: string | null; effectiveFrom: Date; effectiveTo: Date | null; changeReason: string | null; createdAt: Date; updatedAt: Date; cancelledAt: Date | null; replacesAssignmentId: string | null; workSchedule: { id: string; code: string; name: string; description: string | null; isActive: boolean; days: WorkScheduleDayInput[] } }) { return { id: row.id, scope: row.scope, employeeId: row.employeeId, effectiveFrom: dateOnly(row.effectiveFrom), effectiveTo: row.effectiveTo ? dateOnly(row.effectiveTo) : null, changeReason: row.changeReason, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), cancelledAt: iso(row.cancelledAt), replacesAssignmentId: row.replacesAssignmentId, workSchedule: { id: row.workSchedule.id, code: row.workSchedule.code, name: row.workSchedule.name, description: row.workSchedule.description, isActive: row.workSchedule.isActive, days: row.workSchedule.days.map(dayData) } }; }
function candidateView(row: Parameters<typeof assignmentView>[0] & { companyId: string }) { return { id: row.id, scope: row.scope, companyId: row.companyId, employeeId: row.employeeId, effectiveFrom: dateOnly(row.effectiveFrom), effectiveTo: row.effectiveTo ? dateOnly(row.effectiveTo) : null, cancelledAt: row.cancelledAt, workSchedule: { id: row.workSchedule.id, code: row.workSchedule.code, name: row.workSchedule.name, isActive: row.workSchedule.isActive, days: row.workSchedule.days.map(dayData) } }; }
function assignmentMetadata(row: { id: string; scope: WorkScheduleAssignmentScope; employeeId: string | null; workScheduleId: string; effectiveFrom: Date; effectiveTo: Date | null; replacesAssignmentId?: string | null }): Prisma.InputJsonObject { return { assignmentId: row.id, workScheduleId: row.workScheduleId, scope: row.scope, ...(row.employeeId ? { employeeId: row.employeeId } : {}), effectiveFrom: dateOnly(row.effectiveFrom), effectiveTo: row.effectiveTo ? dateOnly(row.effectiveTo) : null, ...(row.replacesAssignmentId ? { predecessorId: row.replacesAssignmentId } : {}) }; }
async function audit(tx: Tx, userId: string, action: string, entityType: string, entityId: string, metadata: Prisma.InputJsonObject) { await tx.auditEvent.create({ data: { userId, action, entityType, entityId, metadata } }); }
