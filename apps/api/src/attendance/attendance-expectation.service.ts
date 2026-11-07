import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WorkScheduleService } from "../work-schedule/work-schedule.service";
import { parseDateOnly } from "../common/business-date";
import { dhakaBusinessDate } from "./attendance-time";
import type {
  ResolvedAttendanceExpectation,
  ResolvedAttendancePolicy,
} from "./attendance-evaluation";

export type ExpectationWithPolicy = {
  expectation: ResolvedAttendanceExpectation;
  policy: ResolvedAttendancePolicy;
};

type ResolverClient = Prisma.TransactionClient;

export async function loadLiveException(
  client: Pick<Prisma.TransactionClient, "companyCalendarException">,
  companyId: string,
  businessDateValue: Date,
) {
  return client.companyCalendarException.findFirst({
    where: { companyId, businessDate: businessDateValue, supersededAt: null, cancelledAt: null },
  });
}

@Injectable()
export class AttendanceExpectationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workSchedules: WorkScheduleService,
  ) {}

  async resolveExpectation(companyId: string, employeeId: string, businessDate: string): Promise<ExpectationWithPolicy | null> {
    return this.resolveExpectationWithClient(this.prisma, companyId, employeeId, businessDate);
  }

  async resolveExpectationForView(companyId: string, employeeId: string, businessDate: string): Promise<ExpectationWithPolicy | null> {
    return this.resolveExpectationWithClient(this.prisma, companyId, employeeId, businessDate, true);
  }

  async resolveExpectationWithTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeId: string,
    businessDate: string,
  ): Promise<ExpectationWithPolicy | null> {
    return this.resolveExpectationWithClient(tx, companyId, employeeId, businessDate);
  }

  private async resolveExpectationWithClient(
    client: ResolverClient,
    companyId: string,
    employeeId: string,
    businessDate: string,
    forView = false,
  ): Promise<ExpectationWithPolicy | null> {
    const businessDateValue = parseBusinessDate(businessDate);
    const employee = await client.employee.findFirst({
      where: { id: employeeId, isDeleted: false },
      select: { id: true, joiningDate: true, separationDate: true, isActive: true },
    });
    if (!employee) {
      return null;
    }
    if (!currentDayEligibility(employee, businessDate, dhakaBusinessDate())) {
      return null;
    }

    const exception = await loadLiveException(client, companyId, businessDateValue);
    if (exception) {
      if (exception.exceptionType === "HOLIDAY") {
        return {
          expectation: {
            employeeId,
            businessDate,
            expectedDayKind: "HOLIDAY",
            attendanceRequired: false,
            scheduledStartMinute: null,
            scheduledEndMinute: null,
            crossesMidnight: null,
            unpaidBreakMinutes: null,
            expectedWorkMinutes: null,
            workScheduleAssignmentId: null,
            workScheduleSource: null,
            calendarExceptionId: exception.id,
          },
          policy: null,
        };
      }
      return {
        expectation: {
          employeeId,
          businessDate,
          expectedDayKind: "SPECIAL_WORKING_DAY",
          attendanceRequired: true,
          scheduledStartMinute: exception.startMinuteOfDay,
          scheduledEndMinute: exception.endMinuteOfDay,
          crossesMidnight: exception.crossesMidnight,
          unpaidBreakMinutes: exception.unpaidBreakMinutes,
          expectedWorkMinutes: calendarExpectedWorkMinutes(
            exception.startMinuteOfDay!,
            exception.endMinuteOfDay!,
            exception.unpaidBreakMinutes,
            exception.crossesMidnight,
          ),
          workScheduleAssignmentId: null,
          workScheduleSource: null,
          calendarExceptionId: exception.id,
        },
        policy: await this.requirePolicy(client, companyId, businessDateValue, forView),
      };
    }

    const resolved = await this.workSchedules.resolveWorkScheduleWithTx(
      client,
      companyId,
      employeeId,
      businessDate,
    );
    if (resolved.kind !== "RESOLVED") {
      throw new AttendanceScheduleNotConfiguredError();
    }
    if (!resolved.isWorkingDay) {
      return {
        expectation: {
          employeeId,
          businessDate,
          expectedDayKind: "WEEKLY_REST",
          attendanceRequired: false,
          scheduledStartMinute: null,
          scheduledEndMinute: null,
          crossesMidnight: null,
          unpaidBreakMinutes: null,
          expectedWorkMinutes: null,
          workScheduleAssignmentId: resolved.assignmentId,
          workScheduleSource: resolved.source,
          calendarExceptionId: null,
        },
        policy: null,
      };
    }
    return {
      expectation: {
        employeeId,
        businessDate,
        expectedDayKind: "WORKING_DAY",
        attendanceRequired: true,
        scheduledStartMinute: resolved.startMinuteOfDay,
        scheduledEndMinute: resolved.endMinuteOfDay,
        crossesMidnight: resolved.crossesMidnight,
        unpaidBreakMinutes: resolved.unpaidBreakMinutes,
        expectedWorkMinutes: resolved.expectedWorkMinutes,
        workScheduleAssignmentId: resolved.assignmentId,
        workScheduleSource: resolved.source,
        calendarExceptionId: null,
      },
      policy: await this.requirePolicy(client, companyId, businessDateValue, forView),
    };
  }

  private async requirePolicy(
    client: ResolverClient,
    companyId: string,
    businessDateValue: Date,
    forView = false,
  ): Promise<ResolvedAttendancePolicy> {
    const policy = await client.attendancePolicy.findFirst({
      where: {
        companyId,
        effectiveFrom: { lte: businessDateValue },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: businessDateValue } }],
        cancelledAt: null,
      },
      orderBy: { effectiveFrom: "desc" },
      select: { id: true, lateGraceMinutes: true, earlyLeaveGraceMinutes: true },
    });
    if (!policy) {
      if (forView) {
        return null;
      }
      throw new AttendancePolicyNotConfiguredError();
    }
    return policy;
  }
}

export class AttendanceScheduleNotConfiguredError extends BadRequestException {
  constructor() {
    super("No Work Schedule is configured for this date.");
  }
}

export class AttendancePolicyNotConfiguredError extends BadRequestException {
  constructor() {
    super("Attendance Rules are not configured for this date.");
  }
}

function parseBusinessDate(businessDate: string): Date {
  return parseDateOnly(businessDate, "businessDate");
}

function dateOnlyOf(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function formalDateEligibility(
  employee: { joiningDate: Date; separationDate: Date | null },
  businessDate: string,
): boolean {
  if (dateOnlyOf(employee.joiningDate) > businessDate) {
    return false;
  }
  if (employee.separationDate !== null && businessDate > dateOnlyOf(employee.separationDate)) {
    return false;
  }
  return true;
}

export function currentDayEligibility(
  employee: { joiningDate: Date; separationDate: Date | null; isActive: boolean },
  businessDate: string,
  today: string,
): boolean {
  if (!formalDateEligibility(employee, businessDate)) {
    return false;
  }
  if (businessDate !== today) {
    return true;
  }
  return employee.isActive || (employee.separationDate !== null && dateOnlyOf(employee.separationDate) === businessDate);
}

export function calendarExpectedWorkMinutes(
  startMinuteOfDay: number,
  endMinuteOfDay: number,
  unpaidBreakMinutes: number,
  crossesMidnight: boolean,
): number {
  const gross = crossesMidnight ? 1440 - startMinuteOfDay + endMinuteOfDay : endMinuteOfDay - startMinuteOfDay;
  return gross - unpaidBreakMinutes;
}

export { parseBusinessDate };
