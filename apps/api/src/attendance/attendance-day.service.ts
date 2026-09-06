import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { parseDateOnly } from "../common/business-date";
import { audit } from "./attendance-audit";
import { normalizeAttendancePrismaError } from "./attendance-errors";
import { acquireAttendanceDateLock, currentCompanyId } from "./attendance-lock";
import {
  addDaysDateOnly,
  buildDhakaInstant,
  deriveCheckOutDate,
  dhakaBusinessDate,
  isFutureInstant,
  parseLocalTime,
} from "./attendance-time";
import {
  computeFinalizationAllowedAt,
  deriveOperationalStatus,
  type ResolvedAttendanceExpectation,
} from "./attendance-evaluation";
import { AttendanceExpectationService, currentDayEligibility } from "./attendance-expectation.service";

export type AttendanceDayRowView = {
  employee: {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    department: { id: string; code: string; name: string } | null;
  };
  expectedDayKind: "WORKING_DAY" | "WEEKLY_REST" | "HOLIDAY" | "SPECIAL_WORKING_DAY";
  attendanceRequired: boolean;
  scheduledStartMinute: number | null;
  scheduledEndMinute: number | null;
  crossesMidnight: boolean | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
  status:
    | { kind: "FINALIZED"; presenceState: string; isLate: boolean; isEarlyLeave: boolean; isNonWorkingDayAttendance: boolean }
    | { kind: "NOT_APPLICABLE" }
    | { kind: "PENDING" }
    | { kind: "NON_WORKING_NO_ATTENDANCE" }
    | {
        kind: "CHECKED_IN" | "CHECKED_IN_LATE" | "INCOMPLETE" | "PRESENT";
        nonWorkingDay: boolean;
        provisionalLate: boolean | null;
        provisionalEarlyLeave: boolean | null;
      };
  expectedUpdatedAt: string | null;
};

export type AttendanceNeedsReviewRow = {
  employee: {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    department: { id: string; code: string; name: string } | null;
  };
  checkInAt: string | null;
  checkOutAt: string | null;
  expectedUpdatedAt: string;
};

export type AttendanceDayView = {
  businessDate: string;
  finalized: boolean;
  finalizationAllowedAt: string | null;
  canFinalizeNow: boolean;
  summary: { expected: number; present: number; late: number; pending: number; incomplete: number };
  rows: AttendanceDayRowView[];
  needsReview: AttendanceNeedsReviewRow[];
};

export interface AttendanceEntryInput {
  employeeId: string;
  checkInLocalTime?: string | null;
  checkOutLocalTime?: string | null;
  note?: string | null;
  expectedUpdatedAt?: string | null;
}

export interface BulkAttendanceSaveInput {
  businessDate: string;
  entries: AttendanceEntryInput[];
}

export interface DiscardAttendanceEntryInput {
  businessDate: string;
  employeeId: string;
  expectedUpdatedAt: string | null;
}

export type AttendanceHistoryStatus =
  | { kind: "FINALIZED"; presenceState: string; isLate: boolean; isEarlyLeave: boolean; isNonWorkingDayAttendance: boolean }
  | { kind: "NOT_APPLICABLE" };

export type AttendanceHistoryRowView = {
  employee: {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    department: { id: string; code: string; name: string } | null;
  };
  businessDate: string;
  status: AttendanceHistoryStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
  expectedRevisionNo: number;
};

export type AttendanceHistoryRevisionView = {
  revisionNo: number;
  isAttendanceApplicable: boolean | null;
  presenceState: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
  changeReason: string | null;
  createdByName: string | null;
  finalizedAt: string | null;
  createdAt: string;
};

export type AttendanceHistoryDetailView = {
  employee: {
    employeeId: string;
    employeeCode: string;
    fullName: string;
    department: { id: string; code: string; name: string } | null;
  };
  businessDate: string;
  finalized: boolean;
  revisions: AttendanceHistoryRevisionView[];
};

export interface ListAttendanceHistoryQuery {
  from: string;
  to: string;
  employeeId?: string;
  departmentId?: string;
  presenceState?: string;
  search?: string;
}

const employeeRosterSelect = {
  id: true,
  employeeCode: true,
  fullName: true,
  isActive: true,
  isDeleted: true,
  joiningDate: true,
  separationDate: true,
  departmentId: true,
  department: { select: { id: true, code: true, name: true } },
} as const;

type RosterEmployee = Prisma.EmployeeGetPayload<{ select: typeof employeeRosterSelect }>;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildPunches(
  businessDate: string,
  checkInLocalTime: string | null | undefined,
  checkOutLocalTime: string | null | undefined,
): { checkInAt: Date | null; checkOutAt: Date | null } {
  const checkIn = checkInLocalTime ? parseLocalTime(checkInLocalTime) : null;
  if (checkInLocalTime && !checkIn) {
    throw new BadRequestException("Check In must use HH:mm format.");
  }
  const checkOut = checkOutLocalTime ? parseLocalTime(checkOutLocalTime) : null;
  if (checkOutLocalTime && !checkOut) {
    throw new BadRequestException("Check Out must use HH:mm format.");
  }
  if (checkOut && !checkIn) {
    throw new BadRequestException("Check Out requires a Check In.");
  }
  let checkInAt: Date | null = null;
  let checkOutAt: Date | null = null;
  if (checkIn) {
    checkInAt = buildDhakaInstant(businessDate, checkIn);
  }
  if (checkIn && checkOut) {
    const derivation = deriveCheckOutDate(checkIn, checkOut);
    if (derivation === "AMBIGUOUS") {
      throw new BadRequestException("Check Out cannot equal Check In.");
    }
    checkOutAt = buildDhakaInstant(derivation === "NEXT_DAY" ? addDaysDateOnly(businessDate, 1) : businessDate, checkOut);
  }
  const now = new Date();
  if (checkInAt && isFutureInstant(checkInAt, now)) {
    throw new BadRequestException("Check In cannot be in the future.");
  }
  if (checkOutAt && isFutureInstant(checkOutAt, now)) {
    throw new BadRequestException("Check Out cannot be in the future.");
  }
  return { checkInAt, checkOutAt };
}

function cleanNote(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

type DraftRow = Prisma.AttendanceRecordGetPayload<{
  include: { revisions: true; employee: { select: typeof employeeRosterSelect } };
}>;

@Injectable()
export class AttendanceDayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expectations: AttendanceExpectationService,
  ) {}

  async getDay(
    businessDate: string,
    filters: { departmentId?: string; search?: string } = {},
  ): Promise<AttendanceDayView> {
    parseDateOnly(businessDate, "businessDate");
    const companyId = await currentCompanyId(this.prisma);
    const marker = await this.prisma.attendanceDayFinalization.findFirst({
      where: { companyId, businessDate: parseDateOnly(businessDate, "businessDate") },
      select: { id: true },
    });
    const finalized = marker !== null;

    if (finalized) {
      const records = await this.prisma.attendanceRecord.findMany({
        where: { companyId, businessDate: parseDateOnly(businessDate, "businessDate") },
        include: {
          revisions: { orderBy: { revisionNo: "desc" }, take: 1 },
          employee: { select: employeeRosterSelect },
        },
        orderBy: { employeeId: "asc" },
      });
      return this.finalizedDayView(businessDate, records);
    }

    const roster = await this.rosterFor(this.prisma, businessDate, filters);
    const expectationResults = await Promise.all(
      roster.map(async employee => ({
        employee,
        resolved: await this.expectations.resolveExpectationForView(employee.id, businessDate),
      })),
    );
    const drafts = await this.prisma.attendanceRecord.findMany({
      where: { companyId, businessDate: parseDateOnly(businessDate, "businessDate") },
      include: {
        revisions: { where: { finalizedAt: null } },
        employee: { select: employeeRosterSelect },
      },
    });
    const draftsByEmployee = new Map(drafts.map(draft => [draft.employeeId, draft]));
    const policy = await this.policiesFor(businessDate, companyId);
    const now = new Date();

    const rows: AttendanceDayRowView[] = [];
    for (const { employee, resolved } of expectationResults) {
      if (!resolved) {
        continue;
      }
      const draft = draftsByEmployee.get(employee.id);
      const draftRevision = draft?.revisions[0] ?? null;
      const status = deriveOperationalStatus({
        expectation: resolved.expectation,
        punches: { checkInAt: draftRevision?.checkInAt ?? null, checkOutAt: draftRevision?.checkOutAt ?? null },
        policy,
        now,
      });
      rows.push({
        employee: {
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          department: employee.department
            ? { id: employee.department.id, code: employee.department.code, name: employee.department.name }
            : null,
        },
        expectedDayKind: resolved.expectation.expectedDayKind,
        attendanceRequired: resolved.expectation.attendanceRequired,
        scheduledStartMinute: resolved.expectation.scheduledStartMinute,
        scheduledEndMinute: resolved.expectation.scheduledEndMinute,
        crossesMidnight: resolved.expectation.crossesMidnight,
        checkInAt: draftRevision?.checkInAt?.toISOString() ?? null,
        checkOutAt: draftRevision?.checkOutAt?.toISOString() ?? null,
        note: draftRevision?.note ?? null,
        status,
        expectedUpdatedAt: draftRevision?.updatedAt.toISOString() ?? null,
      });
    }

    const needsReview: AttendanceNeedsReviewRow[] = drafts
      .filter(draft => !roster.some(employee => employee.id === draft.employeeId) || !expectationResults.some(item => item.employee.id === draft.employeeId && item.resolved !== null))
      .filter(draft => draft.revisions.length > 0)
      .map(draft => ({
        employee: {
          employeeId: draft.employee.id,
          employeeCode: draft.employee.employeeCode,
          fullName: draft.employee.fullName,
          department: draft.employee.department
            ? { id: draft.employee.department.id, code: draft.employee.department.code, name: draft.employee.department.name }
            : null,
        },
        checkInAt: draft.revisions[0]?.checkInAt?.toISOString() ?? null,
        checkOutAt: draft.revisions[0]?.checkOutAt?.toISOString() ?? null,
        expectedUpdatedAt: draft.revisions[0]?.updatedAt.toISOString() ?? new Date(0).toISOString(),
      }));

    const expectationsList = expectationResults
      .filter((item): item is { employee: RosterEmployee; resolved: NonNullable<Awaited<ReturnType<AttendanceExpectationService["resolveExpectation"]>> & object> } => item.resolved !== null)
      .map(item => item.resolved.expectation);
    const finalizationAllowedAt = computeFinalizationAllowedAtOrEmpty(expectationsList);

    return {
      businessDate,
      finalized: false,
      finalizationAllowedAt: finalizationAllowedAt ? finalizationAllowedAt.toISOString() : null,
      canFinalizeNow: finalizationAllowedAt !== null && finalizationAllowedAt.getTime() <= now.getTime(),
      summary: summarize(rows),
      rows,
      needsReview,
    };
  }

  async saveEntries(input: BulkAttendanceSaveInput, user: AuthenticatedUser): Promise<AttendanceDayView> {
    parseDateOnly(input.businessDate, "businessDate");
    const companyId = await currentCompanyId(this.prisma);
    const today = dhakaBusinessDate();
    if (input.businessDate > today) {
      throw new BadRequestException("Attendance cannot be entered for a future date.");
    }
    const entries = input.entries;
    if (entries.length === 0) {
      throw new BadRequestException("At least one attendance entry is required.");
    }
    const uniqueIds = new Set(entries.map(entry => entry.employeeId));
    if (uniqueIds.size !== entries.length) {
      throw new BadRequestException("Each employee may appear only once per bulk save.");
    }
    try {
      await this.prisma.$transaction(
        async tx => {
          await acquireAttendanceDateLock(tx, companyId, input.businessDate);
          const marker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId, businessDate: parseDateOnly(input.businessDate, "businessDate") },
            select: { id: true },
          });
          if (marker) {
            throw new ConflictException("The date is already finalized. Use a correction instead.");
          }
          const roster = await this.rosterFor(tx, input.businessDate, {});
          const rosterIds = new Set(roster.map(employee => employee.id));
          for (const entry of entries) {
            if (!rosterIds.has(entry.employeeId)) {
              throw new BadRequestException("The employee is not eligible for attendance on this date.");
            }
            const punches = buildPunches(input.businessDate, entry.checkInLocalTime, entry.checkOutLocalTime);
            const note = cleanNote(entry.note);
            const existing = await tx.attendanceRecord.findFirst({
              where: { companyId, employeeId: entry.employeeId, businessDate: parseDateOnly(input.businessDate, "businessDate") },
              include: { revisions: { where: { finalizedAt: null } } },
            });
            if (existing) {
              const draft = existing.revisions[0];
              if (!draft) {
                throw new ConflictException("The date is already finalized. Use a correction instead.");
              }
              if (entry.expectedUpdatedAt === null || entry.expectedUpdatedAt === undefined) {
                throw new BadRequestException("The attendance entry changed after this page loaded. Refresh and try again.");
              }
              if (draft.updatedAt.toISOString() !== entry.expectedUpdatedAt) {
                throw new ConflictException("The attendance entry changed after this page loaded. Please review and try again.");
              }
              await tx.attendanceRevision.update({
                where: { id: draft.id },
                data: { checkInAt: punches.checkInAt, checkOutAt: punches.checkOutAt, note },
              });
              await audit(tx, user.id, "ATTENDANCE_ENTRY_UPDATED_BEFORE_FINALIZATION", "AttendanceRecord", existing.id, {
                attendanceRecordId: existing.id,
                businessDate: input.businessDate,
              });
            } else {
              if (entry.expectedUpdatedAt !== null && entry.expectedUpdatedAt !== undefined) {
                throw new BadRequestException("A freshness token cannot be provided for a new attendance entry.");
              }
              const record = await tx.attendanceRecord.create({
                data: {
                  companyId,
                  employeeId: entry.employeeId,
                  businessDate: parseDateOnly(input.businessDate, "businessDate"),
                },
              });
              await tx.attendanceRevision.create({
                data: {
                  attendanceRecordId: record.id,
                  revisionNo: 1,
                  origin: "MANUAL_ENTRY",
                  checkInAt: punches.checkInAt,
                  checkOutAt: punches.checkOutAt,
                  note,
                  createdById: user.id,
                },
              });
              await audit(tx, user.id, "ATTENDANCE_ENTRY_CREATED", "AttendanceRecord", record.id, {
                attendanceRecordId: record.id,
                businessDate: input.businessDate,
              });
            }
          }
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
    return this.getDay(input.businessDate);
  }

  async discardEntry(input: DiscardAttendanceEntryInput, user: AuthenticatedUser): Promise<AttendanceDayView> {
    parseDateOnly(input.businessDate, "businessDate");
    const companyId = await currentCompanyId(this.prisma);
    try {
      await this.prisma.$transaction(
        async tx => {
          await acquireAttendanceDateLock(tx, companyId, input.businessDate);
          const marker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId, businessDate: parseDateOnly(input.businessDate, "businessDate") },
            select: { id: true },
          });
          if (marker) {
            throw new ConflictException("The date is already finalized. Entries can no longer be discarded.");
          }
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId, employeeId: input.employeeId, businessDate: parseDateOnly(input.businessDate, "businessDate") },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });
          if (!record || record.revisions.length === 0) {
            throw new NotFoundException("Attendance entry was not found.");
          }
          const latest = record.revisions[0];
          if (latest.finalizedAt !== null) {
            throw new ConflictException("The date is already finalized. Entries can no longer be discarded.");
          }
          if (latest.updatedAt.toISOString() !== input.expectedUpdatedAt) {
            throw new ConflictException("The attendance entry changed after this page loaded. Please review and try again.");
          }
          const revisionNo = latest.revisionNo;
          await tx.attendanceRevision.delete({ where: { id: latest.id } });
          const remaining = await tx.attendanceRevision.count({ where: { attendanceRecordId: record.id } });
          if (remaining === 0) {
            await tx.attendanceRecord.delete({ where: { id: record.id } });
          }
          await audit(tx, user.id, "ATTENDANCE_DRAFT_DISCARDED", "AttendanceRecord", record.id, {
            attendanceRecordId: record.id,
            businessDate: input.businessDate,
            revisionNo,
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
    return this.getDay(input.businessDate);
  }

  async listHistory(query: ListAttendanceHistoryQuery): Promise<AttendanceHistoryRowView[]> {
    const from = parseDateOnly(query.from, "from");
    const to = parseDateOnly(query.to, "to");
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException("The from date must not be after the to date.");
    }
    const companyId = await currentCompanyId(this.prisma);
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        companyId,
        businessDate: { gte: from, lte: to },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        employee: {
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          ...(query.search
            ? {
                OR: [
                  { fullName: { contains: query.search, mode: "insensitive" } },
                  { employeeCode: { contains: query.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
      },
      include: {
        revisions: { orderBy: { revisionNo: "desc" }, take: 1 },
        employee: { select: employeeRosterSelect },
      },
      orderBy: [{ businessDate: "desc" }, { employeeId: "asc" }],
    });
    const rows: AttendanceHistoryRowView[] = [];
    for (const record of records) {
      const latest = record.revisions[0] ?? null;
      if (!latest || latest.finalizedAt === null) {
        continue;
      }
      const status: AttendanceHistoryStatus =
        latest.isAttendanceApplicable === false
          ? { kind: "NOT_APPLICABLE" }
          : {
              kind: "FINALIZED",
              presenceState: latest.presenceState ?? "",
              isLate: latest.isLate === true,
              isEarlyLeave: latest.isEarlyLeave === true,
              isNonWorkingDayAttendance: latest.isNonWorkingDayAttendance === true,
            };
      if (query.presenceState) {
        if (query.presenceState === "NOT_APPLICABLE" && status.kind !== "NOT_APPLICABLE") {
          continue;
        }
        if (
          query.presenceState !== "NOT_APPLICABLE" &&
          (status.kind !== "FINALIZED" || status.presenceState !== query.presenceState)
        ) {
          continue;
        }
      }
      rows.push({
        employee: {
          employeeId: record.employee.id,
          employeeCode: record.employee.employeeCode,
          fullName: record.employee.fullName,
          department: record.employee.department
            ? { id: record.employee.department.id, code: record.employee.department.code, name: record.employee.department.name }
            : null,
        },
        businessDate: dateOnly(record.businessDate),
        status,
        checkInAt: latest.checkInAt?.toISOString() ?? null,
        checkOutAt: latest.checkOutAt?.toISOString() ?? null,
        note: latest.note,
        expectedRevisionNo: latest.revisionNo,
      });
    }
    return rows;
  }

  async getHistoryDetail(employeeId: string, businessDate: string): Promise<AttendanceHistoryDetailView> {
    const businessDateValue = parseDateOnly(businessDate, "businessDate");
    const companyId = await currentCompanyId(this.prisma);
    const record = await this.prisma.attendanceRecord.findFirst({
      where: { companyId, employeeId, businessDate: businessDateValue },
      include: {
        employee: { select: employeeRosterSelect },
        revisions: {
          orderBy: { revisionNo: "desc" },
          include: { createdBy: { select: { fullName: true } } },
        },
      },
    });
    if (!record) {
      throw new NotFoundException("Attendance entry was not found.");
    }
    const marker = await this.prisma.attendanceDayFinalization.findFirst({
      where: { companyId, businessDate: businessDateValue },
      select: { id: true },
    });
    return {
      employee: {
        employeeId: record.employee.id,
        employeeCode: record.employee.employeeCode,
        fullName: record.employee.fullName,
        department: record.employee.department
          ? { id: record.employee.department.id, code: record.employee.department.code, name: record.employee.department.name }
          : null,
      },
      businessDate,
      finalized: marker !== null,
      revisions: record.revisions.map(revision => ({
        revisionNo: revision.revisionNo,
        isAttendanceApplicable: revision.isAttendanceApplicable,
        presenceState: revision.presenceState,
        checkInAt: revision.checkInAt?.toISOString() ?? null,
        checkOutAt: revision.checkOutAt?.toISOString() ?? null,
        note: revision.note,
        changeReason: revision.changeReason,
        createdByName: revision.createdBy.fullName,
        finalizedAt: revision.finalizedAt?.toISOString() ?? null,
        createdAt: revision.createdAt.toISOString(),
      })),
    };
  }

  private async rosterFor(
    client: Pick<Prisma.TransactionClient, "employee">,
    businessDate: string,
    filters: { departmentId?: string; search?: string },
  ): Promise<RosterEmployee[]> {
    const today = dhakaBusinessDate();
    const employees = await client.employee.findMany({
      where: {
        isDeleted: false,
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.search
          ? { OR: [{ fullName: { contains: filters.search, mode: "insensitive" } }, { employeeCode: { contains: filters.search, mode: "insensitive" } }] }
          : {}),
      },
      select: employeeRosterSelect,
      orderBy: [{ employeeCode: "asc" }],
    });
    return employees.filter(employee => currentDayEligibility(employee, businessDate, today));
  }

  private async policiesFor(businessDate: string, companyId: string): Promise<{ id: string; lateGraceMinutes: number; earlyLeaveGraceMinutes: number } | null> {
    return this.prisma.attendancePolicy.findFirst({
      where: {
        companyId,
        effectiveFrom: { lte: parseDateOnly(businessDate, "businessDate") },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: parseDateOnly(businessDate, "businessDate") } }],
        cancelledAt: null,
      },
      orderBy: { effectiveFrom: "desc" },
      select: { id: true, lateGraceMinutes: true, earlyLeaveGraceMinutes: true },
    });
  }

  private finalizedDayView(businessDate: string, records: DraftRow[]): AttendanceDayView {
    const rows: AttendanceDayRowView[] = [];
    let expected = 0;
    let present = 0;
    let late = 0;
    let incomplete = 0;
    for (const record of records) {
      const latest = record.revisions[0] ?? null;
      if (!latest) {
        continue;
      }
      if (latest.isAttendanceApplicable === false) {
        rows.push(this.finalizedRow(record, latest, { kind: "NOT_APPLICABLE" }));
        continue;
      }
      if (latest.expectedDayKind === "WORKING_DAY" || latest.expectedDayKind === "SPECIAL_WORKING_DAY") {
        expected += 1;
      }
      if (latest.presenceState === "PRESENT") {
        present += 1;
      }
      if (latest.isLate === true) {
        late += 1;
      }
      if (latest.presenceState === "INCOMPLETE") {
        incomplete += 1;
      }
      rows.push(
        this.finalizedRow(record, latest, {
          kind: "FINALIZED",
          presenceState: latest.presenceState ?? "",
          isLate: latest.isLate === true,
          isEarlyLeave: latest.isEarlyLeave === true,
          isNonWorkingDayAttendance: latest.isNonWorkingDayAttendance === true,
        }),
      );
    }
    return {
      businessDate,
      finalized: true,
      finalizationAllowedAt: null,
      canFinalizeNow: false,
      summary: { expected, present, late, pending: 0, incomplete },
      rows,
      needsReview: [],
    };
  }

  private finalizedRow(
    record: DraftRow,
    revision: Prisma.AttendanceRevisionGetPayload<object>,
    status: AttendanceDayRowView["status"],
  ): AttendanceDayRowView {
    return {
      employee: {
        employeeId: record.employee.id,
        employeeCode: record.employee.employeeCode,
        fullName: record.employee.fullName,
        department: record.employee.department
          ? { id: record.employee.department.id, code: record.employee.department.code, name: record.employee.department.name }
          : null,
      },
      expectedDayKind: revision.expectedDayKind ?? "WORKING_DAY",
      attendanceRequired: revision.expectedDayKind === "WORKING_DAY" || revision.expectedDayKind === "SPECIAL_WORKING_DAY",
      scheduledStartMinute: revision.scheduledStartMinute,
      scheduledEndMinute: revision.scheduledEndMinute,
      crossesMidnight: revision.crossesMidnight,
      checkInAt: revision.checkInAt?.toISOString() ?? null,
      checkOutAt: revision.checkOutAt?.toISOString() ?? null,
      note: revision.note,
      status,
      expectedUpdatedAt: revision.updatedAt.toISOString(),
    };
  }
}

function computeFinalizationAllowedAtOrEmpty(
  expectationsList: ResolvedAttendanceExpectation[],
): Date | null {
  if (expectationsList.length === 0) {
    return null;
  }
  return computeFinalizationAllowedAt(expectationsList);
}

function summarize(rows: AttendanceDayRowView[]): { expected: number; present: number; late: number; pending: number; incomplete: number } {
  let expected = 0;
  let present = 0;
  let late = 0;
  let pending = 0;
  let incomplete = 0;
  for (const row of rows) {
    if (row.attendanceRequired) {
      expected += 1;
    }
    if (row.status.kind === "PRESENT") {
      present += 1;
    }
    if (row.status.kind === "CHECKED_IN_LATE" || (row.status.kind === "PRESENT" && row.status.provisionalLate === true)) {
      late += 1;
    }
    if (row.attendanceRequired && row.status.kind === "PENDING") {
      pending += 1;
    }
    if (row.attendanceRequired && row.status.kind === "INCOMPLETE") {
      incomplete += 1;
    }
  }
  return { expected, present, late, pending, incomplete };
}

export { employeeRosterSelect, dateOnly, cleanNote, buildPunches };
export type { RosterEmployee };
