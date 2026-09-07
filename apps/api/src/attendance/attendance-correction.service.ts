import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { parseDateOnly } from "../common/business-date";
import { audit } from "./attendance-audit";
import { normalizeAttendancePrismaError } from "./attendance-errors";
import { acquireAttendanceDateLock } from "./attendance-lock";
import {
  dhakaOffsetMinutes,
  formatLocalTime,
  minuteOfDayToTime,
  type LocalTime,
} from "./attendance-time";
import { evaluateAttendance, type ResolvedAttendanceExpectation } from "./attendance-evaluation";
import {
  AttendanceExpectationService,
  type ExpectationWithPolicy,
} from "./attendance-expectation.service";
import { buildPunches, cleanNote } from "./attendance-day.service";

export interface CorrectAttendanceInput {
  checkInLocalTime?: string | null;
  checkOutLocalTime?: string | null;
  note?: string | null;
  changeReason: string;
  expectedRevisionNo: number | null;
}

export interface MarkNotApplicableInput {
  changeReason: string;
  expectedRevisionNo: number;
}

export type CorrectionResultView = {
  employeeId: string;
  businessDate: string;
  revisionNo: number;
  isAttendanceApplicable: boolean;
  presenceState: string | null;
};

type Tx = Prisma.TransactionClient;

type LatestRevision = Prisma.AttendanceRevisionGetPayload<object>;

function cleanRequiredReason(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BadRequestException(`${label} is required.`);
  }
  return trimmed.slice(0, 500);
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function localTimeOfInstant(instant: Date): LocalTime {
  const shiftedMs = instant.getTime() + dhakaOffsetMinutes(instant) * 60_000;
  const minutesOfDay = Math.floor((((shiftedMs % 86_400_000) + 86_400_000) % 86_400_000) / 60_000);
  return minuteOfDayToTime(minutesOfDay);
}

function mergePunches(
  businessDate: string,
  input: { checkInLocalTime?: string | null; checkOutLocalTime?: string | null },
  prior: { checkInAt: Date | null; checkOutAt: Date | null },
): { checkInAt: Date | null; checkOutAt: Date | null } {
  const punchesProvided = input.checkInLocalTime !== undefined || input.checkOutLocalTime !== undefined;
  if (!punchesProvided) {
    return { checkInAt: prior.checkInAt, checkOutAt: prior.checkOutAt };
  }
  const checkInLocal =
    input.checkInLocalTime !== undefined
      ? input.checkInLocalTime
      : prior.checkInAt
        ? formatLocalTime(localTimeOfInstant(prior.checkInAt))
        : null;
  const checkOutLocal =
    input.checkOutLocalTime !== undefined
      ? input.checkOutLocalTime
      : prior.checkOutAt
        ? formatLocalTime(localTimeOfInstant(prior.checkOutAt))
        : null;
  return buildPunches(businessDate, checkInLocal, checkOutLocal);
}

function snapshotData(resolved: ExpectationWithPolicy) {
  return {
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
  };
}

function classificationData(classification: ReturnType<typeof evaluateAttendance>) {
  return {
    presenceState: classification.presenceState,
    isLate: classification.isLate,
    isEarlyLeave: classification.isEarlyLeave,
    isNonWorkingDayAttendance: classification.isNonWorkingDayAttendance,
    arrivalDelayMinutes: classification.arrivalDelayMinutes,
    earlyDepartureMinutes: classification.earlyDepartureMinutes,
  };
}

function expectationFromSnapshot(
  latest: LatestRevision,
  employeeId: string,
  businessDate: string,
): { expectation: ResolvedAttendanceExpectation; policy: ExpectationWithPolicy["policy"] } {
  const expectedDayKind = latest.expectedDayKind!;
  const expectation: ResolvedAttendanceExpectation = {
    employeeId,
    businessDate,
    expectedDayKind,
    attendanceRequired: expectedDayKind === "WORKING_DAY" || expectedDayKind === "SPECIAL_WORKING_DAY",
    scheduledStartMinute: latest.scheduledStartMinute,
    scheduledEndMinute: latest.scheduledEndMinute,
    crossesMidnight: latest.crossesMidnight,
    unpaidBreakMinutes: latest.unpaidBreakMinutes,
    expectedWorkMinutes: latest.expectedWorkMinutes,
    workScheduleAssignmentId: latest.workScheduleAssignmentId,
    workScheduleSource: latest.workScheduleSource,
    calendarExceptionId: latest.calendarExceptionId,
  };
  const policy =
    latest.attendancePolicyId !== null
      ? {
          id: latest.attendancePolicyId,
          lateGraceMinutes: latest.lateGraceMinutes!,
          earlyLeaveGraceMinutes: latest.earlyLeaveGraceMinutes!,
        }
      : null;
  return { expectation, policy };
}

@Injectable()
export class AttendanceCorrectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expectations: AttendanceExpectationService,
  ) {}

  async correctAttendance(
    companyId: string,
    employeeId: string,
    businessDate: string,
    input: CorrectAttendanceInput,
    user: AuthenticatedUser,
    now = new Date(),
  ): Promise<CorrectionResultView> {
    const businessDateValue = parseDateOnly(businessDate, "businessDate");
    const changeReason = cleanRequiredReason(input.changeReason, "Change Reason");
    try {
      return await this.prisma.$transaction(
        async tx => {
          await acquireAttendanceDateLock(tx, companyId, businessDate);
          await this.requireFinalizedMarker(tx, companyId, businessDateValue);

          const record = await tx.attendanceRecord.findFirst({
            where: { companyId, employeeId, businessDate: businessDateValue },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });

          if (!record) {
            return await this.correctOmittedEmployee(tx, {
              companyId,
              employeeId,
              businessDate,
              businessDateValue,
              input,
              user,
              now,
              changeReason,
            });
          }

          const latest = record.revisions[0] ?? null;
          if (!latest || latest.finalizedAt === null) {
            throw new ConflictException("The date is already finalized; the attendance entry is inconsistent.");
          }
          if (input.expectedRevisionNo === null || input.expectedRevisionNo !== latest.revisionNo) {
            throw new ConflictException(
              "The attendance entry changed after this page loaded. Please review and try again.",
            );
          }

          if (latest.isAttendanceApplicable === false) {
            return await this.restoreFromVoid(tx, {
              companyId,
              employeeId,
              businessDate,
              record,
              latest,
              input,
              user,
              now,
              changeReason,
            });
          }

          return await this.correctExistingRecord(tx, {
            employeeId,
            businessDate,
            record,
            latest,
            input,
            user,
            now,
            changeReason,
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }

  async markNotApplicable(
    companyId: string,
    employeeId: string,
    businessDate: string,
    input: MarkNotApplicableInput,
    user: AuthenticatedUser,
    now = new Date(),
  ): Promise<CorrectionResultView> {
    const businessDateValue = parseDateOnly(businessDate, "businessDate");
    const changeReason = cleanRequiredReason(input.changeReason, "Change Reason");
    try {
      return await this.prisma.$transaction(
        async tx => {
          await acquireAttendanceDateLock(tx, companyId, businessDate);
          await this.requireFinalizedMarker(tx, companyId, businessDateValue);

          const record = await tx.attendanceRecord.findFirst({
            where: { companyId, employeeId, businessDate: businessDateValue },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });
          if (!record) {
            throw new NotFoundException("Attendance entry was not found.");
          }
          const latest = record.revisions[0] ?? null;
          if (!latest || latest.finalizedAt === null) {
            throw new ConflictException("The date is already finalized; the attendance entry is inconsistent.");
          }
          if (input.expectedRevisionNo !== latest.revisionNo) {
            throw new ConflictException(
              "The attendance entry changed after this page loaded. Please review and try again.",
            );
          }
          if (latest.isAttendanceApplicable === false) {
            throw new ConflictException("The attendance entry is already marked not applicable.");
          }

          const employee = await tx.employee.findFirst({
            where: { id: employeeId },
            select: { joiningDate: true, separationDate: true },
          });
          if (!employee) {
            throw new NotFoundException("Employee was not found.");
          }
          const joiningAfter = dateOnly(employee.joiningDate) > businessDate;
          const separatedBefore =
            employee.separationDate !== null && businessDate > dateOnly(employee.separationDate);
          if (!joiningAfter && !separatedBefore) {
            throw new BadRequestException(
              "Attendance can only be marked not applicable when the employee master data proves the employee was not eligible on this date.",
              { description: "ATTENDANCE_NOT_APPLICABLE_REQUIRES_PROOF" },
            );
          }

          const revision = await tx.attendanceRevision.create({
            data: {
              attendanceRecordId: record.id,
              revisionNo: latest.revisionNo + 1,
              origin: "MANUAL_CORRECTION",
              isAttendanceApplicable: false,
              checkInAt: latest.checkInAt,
              checkOutAt: latest.checkOutAt,
              note: latest.note,
              expectedDayKind: null,
              workScheduleAssignmentId: null,
              workScheduleSource: null,
              calendarExceptionId: null,
              attendancePolicyId: null,
              scheduledStartMinute: null,
              scheduledEndMinute: null,
              crossesMidnight: null,
              unpaidBreakMinutes: null,
              expectedWorkMinutes: null,
              lateGraceMinutes: null,
              earlyLeaveGraceMinutes: null,
              timeZone: null,
              presenceState: null,
              isLate: null,
              isEarlyLeave: null,
              isNonWorkingDayAttendance: null,
              arrivalDelayMinutes: null,
              earlyDepartureMinutes: null,
              changeReason,
              createdById: user.id,
              finalizedById: user.id,
              finalizedAt: now,
            },
          });
          return await this.writeAudit(tx, {
            user,
            employeeId,
            businessDate,
            revisionId: revision.id,
            revisionNo: revision.revisionNo,
            isAttendanceApplicable: false,
            presenceState: null,
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }

  private async requireFinalizedMarker(tx: Tx, companyId: string, businessDateValue: Date): Promise<void> {
    const marker = await tx.attendanceDayFinalization.findFirst({
      where: { companyId, businessDate: businessDateValue },
      select: { id: true },
    });
    if (!marker) {
      throw new ConflictException("The date is not finalized. Attendance can only be corrected after finalization.");
    }
  }

  private async correctOmittedEmployee(
    tx: Tx,
    context: {
      companyId: string;
      employeeId: string;
      businessDate: string;
      businessDateValue: Date;
      input: CorrectAttendanceInput;
      user: AuthenticatedUser;
      now: Date;
      changeReason: string;
    },
  ): Promise<CorrectionResultView> {
    if (context.input.expectedRevisionNo !== null) {
      throw new BadRequestException("A freshness token cannot be provided for a missing attendance entry.");
    }
    const resolved = await this.expectations.resolveExpectationWithTx(
      tx,
      context.companyId,
      context.employeeId,
      context.businessDate,
    );
    if (!resolved) {
      throw new BadRequestException("The employee is not eligible for attendance on this date.");
    }
    const punches = buildPunches(
      context.businessDate,
      context.input.checkInLocalTime,
      context.input.checkOutLocalTime,
    );
    const note = context.input.note === undefined ? null : cleanNote(context.input.note);
    const created = await tx.attendanceRecord.create({
      data: {
        companyId: context.companyId,
        employeeId: context.employeeId,
        businessDate: context.businessDateValue,
      },
    });
    const revision = await tx.attendanceRevision.create({
      data: {
        attendanceRecordId: created.id,
        revisionNo: 1,
        origin: "MANUAL_CORRECTION",
        isAttendanceApplicable: true,
        checkInAt: punches.checkInAt,
        checkOutAt: punches.checkOutAt,
        note,
        ...snapshotData(resolved),
        ...classificationData(evaluateAttendance(resolved.expectation, punches, resolved.policy)),
        changeReason: context.changeReason,
        createdById: context.user.id,
        finalizedById: context.user.id,
        finalizedAt: context.now,
      },
    });
    return await this.writeAudit(tx, {
      user: context.user,
      employeeId: context.employeeId,
      businessDate: context.businessDate,
      revisionId: revision.id,
      revisionNo: revision.revisionNo,
      isAttendanceApplicable: true,
      presenceState: revision.presenceState,
    });
  }

  private async correctExistingRecord(
    tx: Tx,
    context: {
      employeeId: string;
      businessDate: string;
      record: { id: string };
      latest: LatestRevision;
      input: CorrectAttendanceInput;
      user: AuthenticatedUser;
      now: Date;
      changeReason: string;
    },
  ): Promise<CorrectionResultView> {
    const punches = mergePunches(context.businessDate, context.input, {
      checkInAt: context.latest.checkInAt,
      checkOutAt: context.latest.checkOutAt,
    });
    const note = context.input.note === undefined ? context.latest.note : cleanNote(context.input.note);
    const { expectation, policy } = expectationFromSnapshot(
      context.latest,
      context.employeeId,
      context.businessDate,
    );
    const revision = await tx.attendanceRevision.create({
      data: {
        attendanceRecordId: context.record.id,
        revisionNo: context.latest.revisionNo + 1,
        origin: "MANUAL_CORRECTION",
        isAttendanceApplicable: true,
        checkInAt: punches.checkInAt,
        checkOutAt: punches.checkOutAt,
        note,
        expectedDayKind: context.latest.expectedDayKind,
        workScheduleAssignmentId: context.latest.workScheduleAssignmentId,
        workScheduleSource: context.latest.workScheduleSource,
        calendarExceptionId: context.latest.calendarExceptionId,
        attendancePolicyId: context.latest.attendancePolicyId,
        scheduledStartMinute: context.latest.scheduledStartMinute,
        scheduledEndMinute: context.latest.scheduledEndMinute,
        crossesMidnight: context.latest.crossesMidnight,
        unpaidBreakMinutes: context.latest.unpaidBreakMinutes,
        expectedWorkMinutes: context.latest.expectedWorkMinutes,
        lateGraceMinutes: context.latest.lateGraceMinutes,
        earlyLeaveGraceMinutes: context.latest.earlyLeaveGraceMinutes,
        timeZone: context.latest.timeZone,
        ...classificationData(evaluateAttendance(expectation, punches, policy)),
        changeReason: context.changeReason,
        createdById: context.user.id,
        finalizedById: context.user.id,
        finalizedAt: context.now,
      },
    });
    return await this.writeAudit(tx, {
      user: context.user,
      employeeId: context.employeeId,
      businessDate: context.businessDate,
      revisionId: revision.id,
      revisionNo: revision.revisionNo,
      isAttendanceApplicable: true,
      presenceState: revision.presenceState,
    });
  }

  private async restoreFromVoid(
    tx: Tx,
    context: {
      companyId: string;
      employeeId: string;
      businessDate: string;
      record: { id: string };
      latest: LatestRevision;
      input: CorrectAttendanceInput;
      user: AuthenticatedUser;
      now: Date;
      changeReason: string;
    },
  ): Promise<CorrectionResultView> {
    const resolved = await this.expectations.resolveExpectationWithTx(
      tx,
      context.companyId,
      context.employeeId,
      context.businessDate,
    );
    if (!resolved) {
      throw new BadRequestException("The employee is not eligible for attendance on this date.");
    }
    const punches = mergePunches(context.businessDate, context.input, {
      checkInAt: context.latest.checkInAt,
      checkOutAt: context.latest.checkOutAt,
    });
    const note = context.input.note === undefined ? context.latest.note : cleanNote(context.input.note);
    const revision = await tx.attendanceRevision.create({
      data: {
        attendanceRecordId: context.record.id,
        revisionNo: context.latest.revisionNo + 1,
        origin: "MANUAL_CORRECTION",
        isAttendanceApplicable: true,
        checkInAt: punches.checkInAt,
        checkOutAt: punches.checkOutAt,
        note,
        ...snapshotData(resolved),
        ...classificationData(evaluateAttendance(resolved.expectation, punches, resolved.policy)),
        changeReason: context.changeReason,
        createdById: context.user.id,
        finalizedById: context.user.id,
        finalizedAt: context.now,
      },
    });
    return await this.writeAudit(tx, {
      user: context.user,
      employeeId: context.employeeId,
      businessDate: context.businessDate,
      revisionId: revision.id,
      revisionNo: revision.revisionNo,
      isAttendanceApplicable: true,
      presenceState: revision.presenceState,
    });
  }

  private async writeAudit(
    tx: Tx,
    context: {
      user: AuthenticatedUser;
      employeeId: string;
      businessDate: string;
      revisionId: string;
      revisionNo: number;
      isAttendanceApplicable: boolean;
      presenceState: string | null;
    },
  ): Promise<CorrectionResultView> {
    await audit(tx, context.user.id, "ATTENDANCE_CORRECTED", "AttendanceRevision", context.revisionId, {
      businessDate: context.businessDate,
      employeeId: context.employeeId,
      revisionNo: context.revisionNo,
      isAttendanceApplicable: context.isAttendanceApplicable,
    });
    return {
      employeeId: context.employeeId,
      businessDate: context.businessDate,
      revisionNo: context.revisionNo,
      isAttendanceApplicable: context.isAttendanceApplicable,
      presenceState: context.presenceState,
    };
  }
}
