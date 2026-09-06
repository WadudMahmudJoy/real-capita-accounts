import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { parseDateOnly } from "../common/business-date";
import { audit } from "./attendance-audit";
import { normalizeAttendancePrismaError } from "./attendance-errors";
import { acquireAttendanceDateLock, currentCompanyId } from "./attendance-lock";
import { validateCalendarExceptionShape, type CompanyCalendarExceptionTypeValue } from "./attendance-calendar-rules";
import {
  evaluateAttendance,
  isMaterialAttendanceChange,
  type AttendanceRevisionComparisonView,
} from "./attendance-evaluation";
import { AttendanceExpectationService, type ExpectationWithPolicy } from "./attendance-expectation.service";

type ExceptionRow = Prisma.CompanyCalendarExceptionGetPayload<object>;

export type CalendarExceptionView = {
  id: string;
  businessDate: string;
  exceptionType: CompanyCalendarExceptionTypeValue;
  name: string;
  startMinuteOfDay: number | null;
  endMinuteOfDay: number | null;
  unpaidBreakMinutes: number;
  crossesMidnight: boolean;
  changeReason: string | null;
  replacesExceptionId: string | null;
  supersededAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
};

export interface CreateCalendarExceptionInput {
  businessDate: string;
  exceptionType: CompanyCalendarExceptionTypeValue;
  name: string;
  startMinuteOfDay?: number | null;
  endMinuteOfDay?: number | null;
  unpaidBreakMinutes?: number;
  crossesMidnight?: boolean;
}

export interface UpdateCalendarExceptionInput {
  name?: string;
  startMinuteOfDay?: number | null;
  endMinuteOfDay?: number | null;
  unpaidBreakMinutes?: number;
  crossesMidnight?: boolean;
}

export interface CancelCalendarExceptionInput {
  cancellationReason: string;
}

export type HistoricalCalendarCorrectionTarget =
  | "HOLIDAY"
  | "SPECIAL_WORKING_DAY"
  | "NONE";

export interface HistoricalCalendarCorrectionInput {
  businessDate: string;
  target: HistoricalCalendarCorrectionTarget;
  changeReason: string;
  name?: string;
  startMinuteOfDay?: number | null;
  endMinuteOfDay?: number | null;
  unpaidBreakMinutes?: number;
  crossesMidnight?: boolean;
}

export type HistoricalCalendarCorrectionResult = {
  businessDate: string;
  target: HistoricalCalendarCorrectionTarget;
  attendanceRevisionsCreated: number;
};

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function view(row: ExceptionRow): CalendarExceptionView {
  return {
    id: row.id,
    businessDate: dateOnly(row.businessDate),
    exceptionType: row.exceptionType,
    name: row.name,
    startMinuteOfDay: row.startMinuteOfDay,
    endMinuteOfDay: row.endMinuteOfDay,
    unpaidBreakMinutes: row.unpaidBreakMinutes,
    crossesMidnight: row.crossesMidnight,
    changeReason: row.changeReason,
    replacesExceptionId: row.replacesExceptionId,
    supersededAt: row.supersededAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
  };
}

function cleanName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException("Name is required.");
  }
  return trimmed.slice(0, 150);
}

function cleanReason(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException(`${label} is required.`);
  }
  return trimmed.slice(0, 500);
}

function resolvedShape(
  exceptionType: CompanyCalendarExceptionTypeValue,
  input: { startMinuteOfDay?: number | null; endMinuteOfDay?: number | null; unpaidBreakMinutes?: number; crossesMidnight?: boolean },
): { startMinuteOfDay: number | null; endMinuteOfDay: number | null; unpaidBreakMinutes: number; crossesMidnight: boolean } {
  const startMinuteOfDay = input.startMinuteOfDay ?? null;
  const endMinuteOfDay = input.endMinuteOfDay ?? null;
  const unpaidBreakMinutes = exceptionType === "HOLIDAY" ? 0 : (input.unpaidBreakMinutes ?? 0);
  const crossesMidnight = exceptionType === "HOLIDAY" ? false : (input.crossesMidnight ?? false);
  validateCalendarExceptionShape({ exceptionType, startMinuteOfDay, endMinuteOfDay, unpaidBreakMinutes, crossesMidnight });
  return { startMinuteOfDay, endMinuteOfDay, unpaidBreakMinutes, crossesMidnight };
}

@Injectable()
export class AttendanceCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expectations: AttendanceExpectationService,
  ) {}

  async listExceptions(from: string, to: string): Promise<CalendarExceptionView[]> {
    const companyId = await currentCompanyId(this.prisma);
    const rows = await this.prisma.companyCalendarException.findMany({
      where: {
        companyId,
        businessDate: { gte: parseDateOnly(from, "from"), lte: parseDateOnly(to, "to") },
      },
      orderBy: [{ businessDate: "asc" }, { id: "asc" }],
    });
    return rows.map(view);
  }

  async createException(input: CreateCalendarExceptionInput, user: AuthenticatedUser): Promise<CalendarExceptionView> {
    try {
      const name = cleanName(input.name);
      const businessDateValue = parseDateOnly(input.businessDate, "businessDate");
      const shape = resolvedShape(input.exceptionType, input);
      const companyId = await currentCompanyId(this.prisma);
      return await this.prisma.$transaction(
        async tx => {
          await acquireAttendanceDateLock(tx, companyId, input.businessDate);
          const finalized = await tx.attendanceDayFinalization.findFirst({
            where: { companyId, businessDate: businessDateValue },
            select: { id: true },
          });
          if (finalized) {
            throw new ConflictException("The date is already finalized. Use a historical calendar correction instead.");
          }
          const row = await tx.companyCalendarException.create({
            data: {
              companyId,
              businessDate: businessDateValue,
              exceptionType: input.exceptionType,
              name,
              startMinuteOfDay: shape.startMinuteOfDay,
              endMinuteOfDay: shape.endMinuteOfDay,
              unpaidBreakMinutes: shape.unpaidBreakMinutes,
              crossesMidnight: shape.crossesMidnight,
              createdById: user.id,
            },
          });
          await audit(tx, user.id, "CALENDAR_EXCEPTION_CREATED", "CompanyCalendarException", row.id, {
            calendarExceptionId: row.id,
            businessDate: input.businessDate,
            exceptionType: input.exceptionType,
          });
          return view(row);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }

  async updateException(id: string, input: UpdateCalendarExceptionInput, user: AuthenticatedUser): Promise<CalendarExceptionView> {
    try {
      const companyId = await currentCompanyId(this.prisma);
      return await this.prisma.$transaction(
        async tx => {
          const row = await tx.companyCalendarException.findFirst({ where: { id, companyId } });
          if (!row) {
            throw new NotFoundException("Calendar exception was not found.");
          }
          if (row.supersededAt !== null || row.cancelledAt !== null) {
            throw new ConflictException("Only a live calendar exception can be edited.");
          }
          await acquireAttendanceDateLock(tx, companyId, dateOnly(row.businessDate));
          const finalized = await tx.attendanceDayFinalization.findFirst({
            where: { companyId, businessDate: row.businessDate },
            select: { id: true },
          });
          if (finalized) {
            throw new ConflictException("The date is already finalized. Use a historical calendar correction instead.");
          }
          const merged = {
            name: input.name !== undefined ? cleanName(input.name) : row.name,
            startMinuteOfDay: input.startMinuteOfDay !== undefined ? input.startMinuteOfDay : row.startMinuteOfDay,
            endMinuteOfDay: input.endMinuteOfDay !== undefined ? input.endMinuteOfDay : row.endMinuteOfDay,
            unpaidBreakMinutes: input.unpaidBreakMinutes !== undefined ? input.unpaidBreakMinutes : row.unpaidBreakMinutes,
            crossesMidnight: input.crossesMidnight !== undefined ? input.crossesMidnight : row.crossesMidnight,
          };
          validateCalendarExceptionShape({
            exceptionType: row.exceptionType,
            startMinuteOfDay: merged.startMinuteOfDay,
            endMinuteOfDay: merged.endMinuteOfDay,
            unpaidBreakMinutes: merged.unpaidBreakMinutes,
            crossesMidnight: merged.crossesMidnight,
          });
          const updated = await tx.companyCalendarException.update({
            where: { id },
            data: {
              name: merged.name,
              startMinuteOfDay: merged.startMinuteOfDay,
              endMinuteOfDay: merged.endMinuteOfDay,
              unpaidBreakMinutes: merged.unpaidBreakMinutes,
              crossesMidnight: merged.crossesMidnight,
            },
          });
          await audit(tx, user.id, "CALENDAR_EXCEPTION_UPDATED", "CompanyCalendarException", updated.id, {
            calendarExceptionId: updated.id,
            businessDate: dateOnly(updated.businessDate),
          });
          return view(updated);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }

  async cancelException(id: string, input: CancelCalendarExceptionInput, user: AuthenticatedUser): Promise<CalendarExceptionView> {
    const cancellationReason = cleanReason(input.cancellationReason, "Cancellation Reason");
    const companyId = await currentCompanyId(this.prisma);
    try {
      return await this.prisma.$transaction(
        async tx => {
          const row = await tx.companyCalendarException.findFirst({ where: { id, companyId } });
          if (!row) {
            throw new NotFoundException("Calendar exception was not found.");
          }
          if (row.cancelledAt !== null) {
            throw new ConflictException("The calendar exception is already cancelled.");
          }
          if (row.supersededAt !== null) {
            throw new ConflictException("A superseded calendar exception cannot be cancelled.");
          }
          await acquireAttendanceDateLock(tx, companyId, dateOnly(row.businessDate));
          const finalized = await tx.attendanceDayFinalization.findFirst({
            where: { companyId, businessDate: row.businessDate },
            select: { id: true },
          });
          if (finalized) {
            throw new ConflictException("The date is already finalized. Use a historical calendar correction instead.");
          }
          const updated = await tx.companyCalendarException.update({
            where: { id },
            data: { cancelledAt: new Date(), cancelledById: user.id, cancellationReason },
          });
          await audit(tx, user.id, "CALENDAR_EXCEPTION_CANCELLED", "CompanyCalendarException", updated.id, {
            calendarExceptionId: updated.id,
            businessDate: dateOnly(updated.businessDate),
          });
          return view(updated);
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }

  async historicalCorrect(
    input: HistoricalCalendarCorrectionInput,
    user: AuthenticatedUser,
    now = new Date(),
  ): Promise<HistoricalCalendarCorrectionResult> {
    try {
      const businessDateValue = parseDateOnly(input.businessDate, "businessDate");
      const changeReason = cleanReason(input.changeReason, "Change Reason");
      const name = input.target === "NONE" ? null : cleanName(input.name ?? "");
      const shape =
        input.target === "NONE"
          ? { startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false }
          : resolvedShape(input.target, input);
      const companyId = await currentCompanyId(this.prisma);
      return await this.prisma.$transaction(
        async tx => {
          await acquireAttendanceDateLock(tx, companyId, input.businessDate);
          const marker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId, businessDate: businessDateValue },
            select: { id: true },
          });
          if (!marker) {
            throw new ConflictException(
              "The date is not finalized. Historical calendar correction requires a finalized date.",
            );
          }

          const live = await tx.companyCalendarException.findFirst({
            where: { companyId, businessDate: businessDateValue, supersededAt: null, cancelledAt: null },
          });

          let affectedExceptionId: string;
          if (input.target === "NONE") {
            if (!live) {
              throw new ConflictException("No live calendar exception exists for this date.");
            }
            await tx.companyCalendarException.update({
              where: { id: live.id },
              data: { cancelledAt: now, cancelledById: user.id, cancellationReason: changeReason },
            });
            affectedExceptionId = live.id;
          } else if (live) {
            await tx.companyCalendarException.update({
              where: { id: live.id },
              data: { supersededAt: now, supersededById: user.id },
            });
            const replacement = await tx.companyCalendarException.create({
              data: {
                companyId,
                businessDate: businessDateValue,
                exceptionType: input.target,
                name: name!,
                startMinuteOfDay: shape.startMinuteOfDay,
                endMinuteOfDay: shape.endMinuteOfDay,
                unpaidBreakMinutes: shape.unpaidBreakMinutes,
                crossesMidnight: shape.crossesMidnight,
                changeReason,
                replacesExceptionId: live.id,
                createdById: user.id,
              },
            });
            affectedExceptionId = replacement.id;
          } else {
            const created = await tx.companyCalendarException.create({
              data: {
                companyId,
                businessDate: businessDateValue,
                exceptionType: input.target,
                name: name!,
                startMinuteOfDay: shape.startMinuteOfDay,
                endMinuteOfDay: shape.endMinuteOfDay,
                unpaidBreakMinutes: shape.unpaidBreakMinutes,
                crossesMidnight: shape.crossesMidnight,
                changeReason,
                createdById: user.id,
              },
            });
            affectedExceptionId = created.id;
          }

          const records = await tx.attendanceRecord.findMany({
            where: { companyId, businessDate: businessDateValue },
            include: { revisions: { orderBy: { revisionNo: "desc" }, take: 1 } },
            orderBy: { employeeId: "asc" },
          });

          let attendanceRevisionsCreated = 0;
          for (const record of records) {
            const latest = record.revisions[0] ?? null;
            if (!latest || latest.finalizedAt === null) {
              continue;
            }
            if (latest.isAttendanceApplicable === false) {
              continue;
            }

            const resolved = await this.expectations.resolveExpectationWithTx(
              tx,
              companyId,
              record.employeeId,
              input.businessDate,
            );
            if (!resolved) {
              continue;
            }
            const punches = { checkInAt: latest.checkInAt, checkOutAt: latest.checkOutAt };
            const classification = evaluateAttendance(resolved.expectation, punches, resolved.policy);
            const currentView = revisionComparisonView(latest);
            const correctedView = correctedComparisonView(resolved, classification);
            if (!isMaterialAttendanceChange(currentView, correctedView)) {
              continue;
            }

            const revision = await tx.attendanceRevision.create({
              data: {
                attendanceRecordId: record.id,
                revisionNo: latest.revisionNo + 1,
                origin: "MANUAL_CORRECTION",
                isAttendanceApplicable: true,
                checkInAt: latest.checkInAt,
                checkOutAt: latest.checkOutAt,
                note: latest.note,
                expectedDayKind: resolved.expectation.expectedDayKind,
                workScheduleAssignmentId: resolved.expectation.workScheduleAssignmentId,
                workScheduleSource: resolved.expectation.workScheduleSource,
                calendarExceptionId: resolved.expectation.calendarExceptionId,
                attendancePolicyId: resolved.policy?.id ?? null,
                scheduledStartMinute: resolved.expectation.scheduledStartMinute,
                scheduledEndMinute: resolved.expectation.scheduledEndMinute,
                crossesMidnight: resolved.expectation.crossesMidnight,
                unpaidBreakMinutes: resolved.expectation.unpaidBreakMinutes,
                expectedWorkMinutes: resolved.expectation.expectedWorkMinutes,
                lateGraceMinutes: resolved.policy?.lateGraceMinutes ?? null,
                earlyLeaveGraceMinutes: resolved.policy?.earlyLeaveGraceMinutes ?? null,
                timeZone: "Asia/Dhaka",
                presenceState: classification.presenceState,
                isLate: classification.isLate,
                isEarlyLeave: classification.isEarlyLeave,
                isNonWorkingDayAttendance: classification.isNonWorkingDayAttendance,
                arrivalDelayMinutes: classification.arrivalDelayMinutes,
                earlyDepartureMinutes: classification.earlyDepartureMinutes,
                changeReason,
                createdById: user.id,
                finalizedById: user.id,
                finalizedAt: now,
              },
            });
            attendanceRevisionsCreated += 1;
            await audit(tx, user.id, "ATTENDANCE_CORRECTED", "AttendanceRevision", revision.id, {
              businessDate: input.businessDate,
              employeeId: record.employeeId,
              revisionNo: revision.revisionNo,
              isAttendanceApplicable: true,
            });
          }

          await audit(tx, user.id, "CALENDAR_EXCEPTION_HISTORICAL_CORRECTED", "CompanyCalendarException", affectedExceptionId, {
            businessDate: input.businessDate,
            target: input.target,
            calendarExceptionId: affectedExceptionId,
            attendanceRevisionsCreated,
          });

          return {
            businessDate: input.businessDate,
            target: input.target,
            attendanceRevisionsCreated,
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }
}

function revisionComparisonView(
  revision: Prisma.AttendanceRevisionGetPayload<object>,
): AttendanceRevisionComparisonView {
  return {
    expectedDayKind: revision.expectedDayKind ?? "WORKING_DAY",
    scheduledStartMinute: revision.scheduledStartMinute,
    scheduledEndMinute: revision.scheduledEndMinute,
    crossesMidnight: revision.crossesMidnight,
    unpaidBreakMinutes: revision.unpaidBreakMinutes,
    expectedWorkMinutes: revision.expectedWorkMinutes,
    lateGraceMinutes: revision.lateGraceMinutes,
    earlyLeaveGraceMinutes: revision.earlyLeaveGraceMinutes,
    presenceState: revision.presenceState ?? "ABSENT",
    isLate: revision.isLate === true,
    isEarlyLeave: revision.isEarlyLeave === true,
    isNonWorkingDayAttendance: revision.isNonWorkingDayAttendance === true,
    arrivalDelayMinutes: revision.arrivalDelayMinutes,
    earlyDepartureMinutes: revision.earlyDepartureMinutes,
    calendarExceptionId: revision.calendarExceptionId,
    attendancePolicyId: revision.attendancePolicyId,
  };
}

function correctedComparisonView(
  resolved: ExpectationWithPolicy,
  classification: ReturnType<typeof evaluateAttendance>,
): AttendanceRevisionComparisonView {
  return {
    expectedDayKind: resolved.expectation.expectedDayKind,
    scheduledStartMinute: resolved.expectation.scheduledStartMinute,
    scheduledEndMinute: resolved.expectation.scheduledEndMinute,
    crossesMidnight: resolved.expectation.crossesMidnight,
    unpaidBreakMinutes: resolved.expectation.unpaidBreakMinutes,
    expectedWorkMinutes: resolved.expectation.expectedWorkMinutes,
    lateGraceMinutes: resolved.policy?.lateGraceMinutes ?? null,
    earlyLeaveGraceMinutes: resolved.policy?.earlyLeaveGraceMinutes ?? null,
    presenceState: classification.presenceState,
    isLate: classification.isLate,
    isEarlyLeave: classification.isEarlyLeave,
    isNonWorkingDayAttendance: classification.isNonWorkingDayAttendance,
    arrivalDelayMinutes: classification.arrivalDelayMinutes,
    earlyDepartureMinutes: classification.earlyDepartureMinutes,
    calendarExceptionId: resolved.expectation.calendarExceptionId,
    attendancePolicyId: resolved.policy?.id ?? null,
  };
}
