import {
  AttendanceRuleError,
  buildDhakaInstant,
  expectedEndInstant,
  minuteOfDayToTime,
  nextDhakaMidnight,
} from "./attendance-time";

export type AttendanceExpectedDayKind =
  | "WORKING_DAY"
  | "WEEKLY_REST"
  | "HOLIDAY"
  | "SPECIAL_WORKING_DAY";

export type AttendancePresenceState =
  | "PRESENT"
  | "ABSENT"
  | "INCOMPLETE"
  | "NOT_REQUIRED";

export type AttendanceOrigin =
  | "MANUAL_ENTRY"
  | "MANUAL_CORRECTION"
  | "SYSTEM_FINALIZATION";

export type WorkScheduleAssignmentScopeValue =
  | "COMPANY_DEFAULT"
  | "EMPLOYEE_OVERRIDE";

export type ResolvedAttendanceExpectation = {
  employeeId: string;
  businessDate: string;
  expectedDayKind: AttendanceExpectedDayKind;
  attendanceRequired: boolean;
  scheduledStartMinute: number | null;
  scheduledEndMinute: number | null;
  crossesMidnight: boolean | null;
  unpaidBreakMinutes: number | null;
  expectedWorkMinutes: number | null;
  workScheduleAssignmentId: string | null;
  workScheduleSource: WorkScheduleAssignmentScopeValue | null;
  calendarExceptionId: string | null;
};

export type ResolvedAttendancePolicy = {
  id: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
} | null;

export type AttendancePunches = {
  checkInAt: Date | null;
  checkOutAt: Date | null;
};

export type AttendanceClassification = {
  presenceState: AttendancePresenceState;
  isLate: boolean;
  isEarlyLeave: boolean;
  isNonWorkingDayAttendance: boolean;
  arrivalDelayMinutes: number | null;
  earlyDepartureMinutes: number | null;
};

export type OperationalAttendanceStatus =
  | { kind: "PENDING" }
  | { kind: "NON_WORKING_NO_ATTENDANCE" }
  | {
      kind: "CHECKED_IN" | "CHECKED_IN_LATE" | "INCOMPLETE" | "PRESENT";
      nonWorkingDay: boolean;
      provisionalLate: boolean | null;
      provisionalEarlyLeave: boolean | null;
    };

export type AttendanceApplicabilityShape = {
  finalizedAt: Date | null;
  isAttendanceApplicable: boolean | null;
  origin: AttendanceOrigin;
};

export type AttendanceRevisionComparisonView = {
  expectedDayKind: AttendanceExpectedDayKind;
  scheduledStartMinute: number | null;
  scheduledEndMinute: number | null;
  crossesMidnight: boolean | null;
  unpaidBreakMinutes: number | null;
  expectedWorkMinutes: number | null;
  lateGraceMinutes: number | null;
  earlyLeaveGraceMinutes: number | null;
  presenceState: AttendancePresenceState;
  isLate: boolean;
  isEarlyLeave: boolean;
  isNonWorkingDayAttendance: boolean;
  arrivalDelayMinutes: number | null;
  earlyDepartureMinutes: number | null;
  calendarExceptionId: string | null;
  attendancePolicyId: string | null;
};

function scheduledStartInstant(expectation: ResolvedAttendanceExpectation): Date {
  return buildDhakaInstant(
    expectation.businessDate,
    minuteOfDayToTime(expectation.scheduledStartMinute!),
  );
}

function scheduledEndInstant(expectation: ResolvedAttendanceExpectation): Date {
  return expectedEndInstant(
    expectation.businessDate,
    expectation.scheduledEndMinute!,
    expectation.crossesMidnight!,
  );
}

function elapsedMinutes(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60_000);
}

function arrivalDelayMinutesFor(
  expectation: ResolvedAttendanceExpectation,
  checkInAt: Date,
): number {
  return Math.max(0, elapsedMinutes(scheduledStartInstant(expectation), checkInAt));
}

function earlyDepartureMinutesFor(
  expectation: ResolvedAttendanceExpectation,
  checkOutAt: Date,
): number {
  return Math.max(0, elapsedMinutes(checkOutAt, scheduledEndInstant(expectation)));
}

function assertPunchShape(punches: AttendancePunches): void {
  if (punches.checkOutAt !== null && punches.checkInAt === null) {
    throw new AttendanceRuleError("Check Out requires a Check In.");
  }
  if (punches.checkInAt !== null && punches.checkOutAt !== null && punches.checkOutAt <= punches.checkInAt) {
    throw new AttendanceRuleError("Check Out must be after Check In.");
  }
}

export function evaluateAttendance(
  expectation: ResolvedAttendanceExpectation,
  punches: AttendancePunches,
  policy: ResolvedAttendancePolicy,
): AttendanceClassification {
  assertPunchShape(punches);

  if (!expectation.attendanceRequired) {
    if (punches.checkInAt === null) {
      return {
        presenceState: "NOT_REQUIRED",
        isLate: false,
        isEarlyLeave: false,
        isNonWorkingDayAttendance: false,
        arrivalDelayMinutes: null,
        earlyDepartureMinutes: null,
      };
    }
    return {
      presenceState: punches.checkOutAt === null ? "INCOMPLETE" : "PRESENT",
      isLate: false,
      isEarlyLeave: false,
      isNonWorkingDayAttendance: true,
      arrivalDelayMinutes: null,
      earlyDepartureMinutes: null,
    };
  }

  if (policy === null) {
    throw new AttendanceRuleError("An effective Attendance Policy is required to evaluate a working day.");
  }

  if (punches.checkInAt === null) {
    return {
      presenceState: "ABSENT",
      isLate: false,
      isEarlyLeave: false,
      isNonWorkingDayAttendance: false,
      arrivalDelayMinutes: null,
      earlyDepartureMinutes: null,
    };
  }

  const arrivalDelayMinutes = arrivalDelayMinutesFor(expectation, punches.checkInAt);

  if (punches.checkOutAt === null) {
    return {
      presenceState: "INCOMPLETE",
      isLate: arrivalDelayMinutes > policy.lateGraceMinutes,
      isEarlyLeave: false,
      isNonWorkingDayAttendance: false,
      arrivalDelayMinutes,
      earlyDepartureMinutes: null,
    };
  }

  const earlyDepartureMinutes = earlyDepartureMinutesFor(expectation, punches.checkOutAt);

  return {
    presenceState: "PRESENT",
    isLate: arrivalDelayMinutes > policy.lateGraceMinutes,
    isEarlyLeave: earlyDepartureMinutes > policy.earlyLeaveGraceMinutes,
    isNonWorkingDayAttendance: false,
    arrivalDelayMinutes,
    earlyDepartureMinutes,
  };
}

export function deriveOperationalStatus(input: {
  expectation: ResolvedAttendanceExpectation;
  punches: AttendancePunches;
  policy: ResolvedAttendancePolicy;
  now: Date;
}): OperationalAttendanceStatus {
  assertPunchShape(input.punches);
  const nonWorkingDay = !input.expectation.attendanceRequired;

  if (input.punches.checkInAt === null) {
    return nonWorkingDay
      ? { kind: "NON_WORKING_NO_ATTENDANCE" }
      : { kind: "PENDING" };
  }

  if (input.punches.checkOutAt !== null) {
    const provisional = nonWorkingDay || input.policy !== null
      ? evaluateAttendance(input.expectation, input.punches, input.policy)
      : null;
    return {
      kind: "PRESENT",
      nonWorkingDay,
      provisionalLate: nonWorkingDay ? false : provisional?.isLate ?? null,
      provisionalEarlyLeave: nonWorkingDay ? false : provisional?.isEarlyLeave ?? null,
    };
  }

  if (!nonWorkingDay) {
    const windowStillOpen = input.now < scheduledEndInstant(input.expectation);
    if (!windowStillOpen) {
      return {
        kind: "INCOMPLETE",
        nonWorkingDay: false,
        provisionalLate: input.policy !== null
          ? arrivalDelayMinutesFor(input.expectation, input.punches.checkInAt) > input.policy.lateGraceMinutes
          : null,
        provisionalEarlyLeave: false,
      };
    }
    if (input.policy !== null) {
      const arrivalDelayMinutes = arrivalDelayMinutesFor(input.expectation, input.punches.checkInAt);
      return {
        kind: arrivalDelayMinutes > input.policy.lateGraceMinutes ? "CHECKED_IN_LATE" : "CHECKED_IN",
        nonWorkingDay: false,
        provisionalLate: arrivalDelayMinutes > input.policy.lateGraceMinutes,
        provisionalEarlyLeave: false,
      };
    }
    return { kind: "CHECKED_IN", nonWorkingDay: false, provisionalLate: null, provisionalEarlyLeave: false };
  }

  return {
    kind: "CHECKED_IN",
    nonWorkingDay: true,
    provisionalLate: false,
    provisionalEarlyLeave: false,
  };
}

export function isValidApplicabilityShape(
  shape: AttendanceApplicabilityShape,
): boolean {
  const finalized = shape.finalizedAt !== null;
  if (finalized !== (shape.isAttendanceApplicable !== null)) {
    return false;
  }
  if (!finalized && shape.origin !== "MANUAL_ENTRY") {
    return false;
  }
  if (shape.origin === "SYSTEM_FINALIZATION" && shape.isAttendanceApplicable !== true) {
    return false;
  }
  if (shape.isAttendanceApplicable === false && shape.origin !== "MANUAL_CORRECTION") {
    return false;
  }
  return true;
}

const MATERIAL_COMPARISON_KEYS = [
  "expectedDayKind",
  "scheduledStartMinute",
  "scheduledEndMinute",
  "crossesMidnight",
  "unpaidBreakMinutes",
  "expectedWorkMinutes",
  "lateGraceMinutes",
  "earlyLeaveGraceMinutes",
  "presenceState",
  "isLate",
  "isEarlyLeave",
  "isNonWorkingDayAttendance",
  "arrivalDelayMinutes",
  "earlyDepartureMinutes",
] as const;

export function isMaterialAttendanceChange(
  current: AttendanceRevisionComparisonView,
  corrected: AttendanceRevisionComparisonView,
): boolean {
  return MATERIAL_COMPARISON_KEYS.some((key) => current[key] !== corrected[key]);
}

export function computeFinalizationAllowedAt(
  expectations: ResolvedAttendanceExpectation[],
): Date {
  if (expectations.length === 0) {
    throw new AttendanceRuleError("At least one expectation is required.");
  }
  const businessDate = expectations[0].businessDate;
  const required = expectations.filter((expectation) => expectation.attendanceRequired);
  if (required.length === 0) {
    return nextDhakaMidnight(businessDate);
  }
  return required.reduce<Date | null>((latest, expectation) => {
    if (expectation.businessDate !== businessDate) {
      throw new AttendanceRuleError("All expectations must share one business date.");
    }
    const end = scheduledEndInstant(expectation);
    return latest === null || end > latest ? end : latest;
  }, null)!;
}

export function countExpected(
  expectations: ResolvedAttendanceExpectation[],
): number {
  return expectations.filter((expectation) => expectation.attendanceRequired).length;
}
