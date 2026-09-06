import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { parseDateOnly } from "../common/business-date";
import { audit } from "./attendance-audit";
import { normalizeAttendancePrismaError } from "./attendance-errors";
import { acquireAttendanceDateLock, currentCompanyId } from "./attendance-lock";
import { computeFinalizationAllowedAt, evaluateAttendance } from "./attendance-evaluation";
import { dhakaBusinessDate } from "./attendance-time";
import {
  AttendanceExpectationService,
  currentDayEligibility,
  type ExpectationWithPolicy,
} from "./attendance-expectation.service";

export interface FinalizeAttendanceDayInput {
  businessDate: string;
}

export type FinalizeAttendanceDayResult = {
  businessDate: string;
  finalizedAt: Date;
  summary: { present: number; absent: number; incomplete: number; notRequired: number };
};

type Tx = Prisma.TransactionClient;

type EligibleEmployee = Prisma.EmployeeGetPayload<{
  select: {
    id: true;
    employeeCode: true;
    fullName: true;
    isActive: true;
    isDeleted: true;
    joiningDate: true;
    separationDate: true;
    departmentId: true;
    department: { select: { id: true; code: true; name: true } };
  };
}>;

const finalizationRosterSelect = {
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

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class AttendanceFinalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expectations: AttendanceExpectationService,
  ) {}

  async finalizeDay(
    input: FinalizeAttendanceDayInput,
    user: AuthenticatedUser,
    now = new Date(),
  ): Promise<FinalizeAttendanceDayResult> {
    const businessDateValue = parseDateOnly(input.businessDate, "businessDate");
    const companyId = await currentCompanyId(this.prisma);
    const today = dhakaBusinessDate(now);
    if (input.businessDate > today) {
      throw new BadRequestException("A future business date cannot be finalized.");
    }

    try {
      return await this.prisma.$transaction(
        async tx => {
          await acquireAttendanceDateLock(tx, companyId, input.businessDate);

          const existingMarker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId, businessDate: businessDateValue },
            select: { id: true },
          });
          if (existingMarker) {
            throw new ConflictException("The date is already finalized.");
          }

          const roster = await this.finalRoster(tx, input.businessDate, today);
          const expectations = await Promise.all(
            roster.map(async employee => ({
              employee,
              resolved: await this.expectations.resolveExpectationWithTx(
                tx,
                companyId,
                employee.id,
                input.businessDate,
              ),
            })),
          );

          const resolvedList: Array<{ employee: EligibleEmployee } & ExpectationWithPolicy> = [];
          for (const item of expectations) {
            if (item.resolved !== null) {
              resolvedList.push({ employee: item.employee, ...item.resolved });
            }
          }

          const businessDate = input.businessDate;
          const records = await tx.attendanceRecord.findMany({
            where: { companyId, businessDate: businessDateValue },
            include: { revisions: true },
            orderBy: { employeeId: "asc" },
          });
          const recordsByEmployee = new Map(records.map(record => [record.employeeId, record]));

          const eligibleIds = new Set(resolvedList.map(item => item.employee.id));
          for (const record of records) {
            if (!eligibleIds.has(record.employeeId) && record.revisions.some(row => row.finalizedAt === null)) {
              throw new ConflictException(
                "An attendance entry exists for an employee who is not eligible on this date. Review or discard the entry before finalizing.",
                { description: "ATTENDANCE_DRAFT_FOR_INELIGIBLE_EMPLOYEE" },
              );
            }
          }

          const resolvedExpectations = resolvedList.map(item => item.expectation);
          const allowedAt = computeFinalizationAllowedAt(
            resolvedExpectations.length > 0
              ? resolvedExpectations
              : [{ employeeId: "", businessDate, expectedDayKind: "WEEKLY_REST", attendanceRequired: false, scheduledStartMinute: null, scheduledEndMinute: null, crossesMidnight: null, unpaidBreakMinutes: null, expectedWorkMinutes: null, workScheduleAssignmentId: null, workScheduleSource: null, calendarExceptionId: null }],
          );
          if (allowedAt.getTime() > now.getTime()) {
            throw new ConflictException(
              `This day can be finalized after ${allowedAt.toISOString()}.`,
            );
          }

          const marker = await tx.attendanceDayFinalization.create({
            data: {
              companyId,
              businessDate: businessDateValue,
              finalizedAt: now,
              finalizedById: user.id,
            },
          });

          const summary = { present: 0, absent: 0, incomplete: 0, notRequired: 0 };
          for (const item of resolvedList) {
            const record = recordsByEmployee.get(item.employee.id);
            const draft = record?.revisions.find(row => row.finalizedAt === null) ?? null;
            const punches = {
              checkInAt: draft?.checkInAt ?? null,
              checkOutAt: draft?.checkOutAt ?? null,
            };
            const classification = evaluateAttendance(item.expectation, punches, item.policy);

            if (draft) {
              await tx.attendanceRevision.update({
                where: { id: draft.id },
                data: {
                  isAttendanceApplicable: true,
                  expectedDayKind: item.expectation.expectedDayKind,
                  workScheduleAssignmentId: item.expectation.workScheduleAssignmentId,
                  workScheduleSource: item.expectation.workScheduleSource,
                  calendarExceptionId: item.expectation.calendarExceptionId,
                  attendancePolicyId: item.policy?.id ?? null,
                  scheduledStartMinute: item.expectation.scheduledStartMinute,
                  scheduledEndMinute: item.expectation.scheduledEndMinute,
                  crossesMidnight: item.expectation.crossesMidnight,
                  unpaidBreakMinutes: item.expectation.unpaidBreakMinutes,
                  expectedWorkMinutes: item.expectation.expectedWorkMinutes,
                  lateGraceMinutes: item.policy?.lateGraceMinutes ?? null,
                  earlyLeaveGraceMinutes: item.policy?.earlyLeaveGraceMinutes ?? null,
                  timeZone: "Asia/Dhaka",
                  presenceState: classification.presenceState,
                  isLate: classification.isLate,
                  isEarlyLeave: classification.isEarlyLeave,
                  isNonWorkingDayAttendance: classification.isNonWorkingDayAttendance,
                  arrivalDelayMinutes: classification.arrivalDelayMinutes,
                  earlyDepartureMinutes: classification.earlyDepartureMinutes,
                  finalizedAt: now,
                  finalizedById: user.id,
                  updatedAt: now,
                },
              });
            } else {
              const targetRecord =
                record ??
                (await tx.attendanceRecord.create({
                  data: {
                    companyId,
                    employeeId: item.employee.id,
                    businessDate: businessDateValue,
                  },
                }));
              await tx.attendanceRevision.create({
                data: {
                  attendanceRecordId: targetRecord.id,
                  revisionNo: 1,
                  origin: "SYSTEM_FINALIZATION",
                  isAttendanceApplicable: true,
                  checkInAt: punches.checkInAt,
                  checkOutAt: punches.checkOutAt,
                  expectedDayKind: item.expectation.expectedDayKind,
                  workScheduleAssignmentId: item.expectation.workScheduleAssignmentId,
                  workScheduleSource: item.expectation.workScheduleSource,
                  calendarExceptionId: item.expectation.calendarExceptionId,
                  attendancePolicyId: item.policy?.id ?? null,
                  scheduledStartMinute: item.expectation.scheduledStartMinute,
                  scheduledEndMinute: item.expectation.scheduledEndMinute,
                  crossesMidnight: item.expectation.crossesMidnight,
                  unpaidBreakMinutes: item.expectation.unpaidBreakMinutes,
                  expectedWorkMinutes: item.expectation.expectedWorkMinutes,
                  lateGraceMinutes: item.policy?.lateGraceMinutes ?? null,
                  earlyLeaveGraceMinutes: item.policy?.earlyLeaveGraceMinutes ?? null,
                  timeZone: "Asia/Dhaka",
                  presenceState: classification.presenceState,
                  isLate: classification.isLate,
                  isEarlyLeave: classification.isEarlyLeave,
                  isNonWorkingDayAttendance: classification.isNonWorkingDayAttendance,
                  arrivalDelayMinutes: classification.arrivalDelayMinutes,
                  earlyDepartureMinutes: classification.earlyDepartureMinutes,
                  createdById: user.id,
                  finalizedById: user.id,
                  finalizedAt: now,
                },
              });
            }

            summary[classification.presenceState === "PRESENT"
              ? "present"
              : classification.presenceState === "ABSENT"
                ? "absent"
                : classification.presenceState === "INCOMPLETE"
                  ? "incomplete"
                  : "notRequired"] += 1;
          }

          await audit(tx, user.id, "ATTENDANCE_DAY_FINALIZED", "AttendanceDayFinalization", marker.id, {
            businessDate: input.businessDate,
            ...summary,
          });

          return { businessDate: input.businessDate, finalizedAt: now, summary };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      normalizeAttendancePrismaError(error);
    }
  }

  private async finalRoster(tx: Tx, businessDate: string, today: string): Promise<EligibleEmployee[]> {
    const employees = await tx.employee.findMany({
      where: { isDeleted: false },
      select: finalizationRosterSelect,
      orderBy: { employeeCode: "asc" },
    });
    return employees.filter(employee => currentDayEligibility(employee, businessDate, today));
  }
}

export { dateOnly };
