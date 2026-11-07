import assert from "node:assert/strict";
import {
  LOCAL_TIME_PATTERN,
  addDaysDateOnly,
  buildDhakaInstant,
  deriveCheckOutDate,
  dhakaBusinessDate,
  expectedEndInstant,
  formatLocalTime,
  isCanonicalDateOnly,
  isFutureInstant,
  minuteOfDayToTime,
  nextDhakaMidnight,
  parseLocalTime,
} from "../apps/api/src/attendance/attendance-time";
import {
  computeFinalizationAllowedAt,
  countExpected,
  deriveOperationalStatus,
  evaluateAttendance,
  isMaterialAttendanceChange,
  isValidApplicabilityShape,
} from "../apps/api/src/attendance/attendance-evaluation";
import {
  canCreateInitial,
  computeCancellationRestore,
  computeReplacementSplice,
  isEverEffective,
  policyStartInstant,
  uncancelledDependentsOf,
  type AttendancePolicyView,
} from "../apps/api/src/attendance/attendance-policy-rules";
import {
  validateCalendarExceptionShape,
  type CalendarExceptionShapeInput,
} from "../apps/api/src/attendance/attendance-calendar-rules";

let passed = 0;
let failed = 0;

function check(name: string, verification: () => unknown): void {
  try {
    verification();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function iso(instant: Date): string {
  return instant.toISOString();
}

check("local time pattern accepts 00:00 through 23:59", () => {
  assert.equal(LOCAL_TIME_PATTERN.test("00:00"), true);
  assert.equal(LOCAL_TIME_PATTERN.test("23:59"), true);
  assert.equal(LOCAL_TIME_PATTERN.test("10:30"), true);
  assert.equal(LOCAL_TIME_PATTERN.test("24:00"), false);
  assert.equal(LOCAL_TIME_PATTERN.test("9:30"), false);
  assert.equal(LOCAL_TIME_PATTERN.test("10:6"), false);
  assert.equal(LOCAL_TIME_PATTERN.test("10:60"), false);
  assert.equal(LOCAL_TIME_PATTERN.test("10:30 "), false);
  assert.equal(LOCAL_TIME_PATTERN.test(" 10:30"), false);
  assert.equal(LOCAL_TIME_PATTERN.test("10:30:00"), false);
  assert.equal(LOCAL_TIME_PATTERN.test("1030"), false);
  assert.equal(LOCAL_TIME_PATTERN.test(""), false);
});

check("parseLocalTime parses valid times", () => {
  assert.deepEqual(parseLocalTime("10:30"), { hours: 10, minutes: 30 });
  assert.deepEqual(parseLocalTime("00:00"), { hours: 0, minutes: 0 });
  assert.deepEqual(parseLocalTime("23:59"), { hours: 23, minutes: 59 });
});

check("parseLocalTime rejects invalid times", () => {
  assert.equal(parseLocalTime("9:30"), null);
  assert.equal(parseLocalTime("24:00"), null);
  assert.equal(parseLocalTime("10:6"), null);
  assert.equal(parseLocalTime("10:30:00"), null);
  assert.equal(parseLocalTime(""), null);
  assert.equal(parseLocalTime("10:30 "), null);
});

check("formatLocalTime zero-pads hours and minutes", () => {
  assert.equal(formatLocalTime({ hours: 9, minutes: 5 }), "09:05");
  assert.equal(formatLocalTime(parseLocalTime("10:30")!), "10:30");
  assert.equal(formatLocalTime({ hours: 0, minutes: 0 }), "00:00");
});

check("minuteOfDayToTime converts minutes to local time", () => {
  assert.deepEqual(minuteOfDayToTime(0), { hours: 0, minutes: 0 });
  assert.deepEqual(minuteOfDayToTime(1080), { hours: 18, minutes: 0 });
  assert.deepEqual(minuteOfDayToTime(605), { hours: 10, minutes: 5 });
  assert.deepEqual(minuteOfDayToTime(1439), { hours: 23, minutes: 59 });
});

check("isCanonicalDateOnly accepts only real YYYY-MM-DD dates", () => {
  assert.equal(isCanonicalDateOnly("2026-09-01"), true);
  assert.equal(isCanonicalDateOnly("2026-02-29"), false);
  assert.equal(isCanonicalDateOnly("2024-02-29"), true);
  assert.equal(isCanonicalDateOnly("2026-9-1"), false);
  assert.equal(isCanonicalDateOnly("2026-09-01T00:00:00Z"), false);
  assert.equal(isCanonicalDateOnly(""), false);
});

check("dhakaBusinessDate advances before UTC midnight", () => {
  assert.equal(dhakaBusinessDate(new Date("2026-09-01T18:00:00.000Z")), "2026-09-02");
  assert.equal(dhakaBusinessDate(new Date("2026-09-01T18:30:00.000Z")), "2026-09-02");
  assert.equal(dhakaBusinessDate(new Date("2026-09-01T17:59:59.000Z")), "2026-09-01");
  assert.equal(dhakaBusinessDate(new Date("2026-09-01T00:00:00.000Z")), "2026-09-01");
});

check("addDaysDateOnly shifts calendar dates", () => {
  assert.equal(addDaysDateOnly("2026-09-30", 1), "2026-10-01");
  assert.equal(addDaysDateOnly("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysDateOnly("2026-09-05", -1), "2026-09-04");
  assert.equal(addDaysDateOnly("2026-09-05", 0), "2026-09-05");
});

check("buildDhakaInstant converts Dhaka wall time to UTC instants", () => {
  assert.equal(iso(buildDhakaInstant("2026-09-01", { hours: 10, minutes: 0 })), "2026-09-01T04:00:00.000Z");
  assert.equal(iso(buildDhakaInstant("2026-09-01", { hours: 18, minutes: 0 })), "2026-09-01T12:00:00.000Z");
  assert.equal(iso(buildDhakaInstant("2026-09-01", { hours: 0, minutes: 30 })), "2026-08-31T18:30:00.000Z");
  assert.equal(iso(buildDhakaInstant("2026-09-01", { hours: 23, minutes: 15 })), "2026-09-01T17:15:00.000Z");
});

check("buildDhakaInstant rejects non-canonical business dates", () => {
  assert.throws(() => buildDhakaInstant("2026-9-1", { hours: 10, minutes: 0 }));
  assert.throws(() => buildDhakaInstant("2026-02-30", { hours: 10, minutes: 0 }));
});

check("deriveCheckOutDate derivation rules", () => {
  assert.equal(deriveCheckOutDate({ hours: 10, minutes: 0 }, { hours: 18, minutes: 30 }), "SAME_DAY");
  assert.equal(deriveCheckOutDate({ hours: 0, minutes: 0 }, { hours: 0, minutes: 1 }), "SAME_DAY");
  assert.equal(deriveCheckOutDate({ hours: 22, minutes: 0 }, { hours: 6, minutes: 0 }), "NEXT_DAY");
  assert.equal(deriveCheckOutDate({ hours: 10, minutes: 0 }, { hours: 10, minutes: 0 }), "AMBIGUOUS");
  assert.equal(deriveCheckOutDate({ hours: 0, minutes: 0 }, { hours: 0, minutes: 0 }), "AMBIGUOUS");
});

check("expectedEndInstant anchors normal windows to the business date", () => {
  assert.equal(iso(expectedEndInstant("2026-09-05", 1080, false)), "2026-09-05T12:00:00.000Z");
  assert.equal(iso(expectedEndInstant("2026-09-05", 600, false)), "2026-09-05T04:00:00.000Z");
});

check("expectedEndInstant anchors overnight windows to the next day", () => {
  assert.equal(iso(expectedEndInstant("2026-09-05", 360, true)), "2026-09-06T00:00:00.000Z");
  assert.equal(iso(expectedEndInstant("2026-09-30", 600, true)), "2026-10-01T04:00:00.000Z");
});

check("nextDhakaMidnight is the next Dhaka calendar date at 00:00", () => {
  assert.equal(iso(nextDhakaMidnight("2026-09-05")), "2026-09-05T18:00:00.000Z");
  assert.equal(iso(nextDhakaMidnight("2026-09-30")), "2026-09-30T18:00:00.000Z");
});

check("isFutureInstant compares against the provided now", () => {
  assert.equal(isFutureInstant(new Date("2026-09-07T12:00:01.000Z"), new Date("2026-09-07T12:00:00.000Z")), true);
  assert.equal(isFutureInstant(new Date("2026-09-07T11:59:59.000Z"), new Date("2026-09-07T12:00:00.000Z")), false);
  assert.equal(isFutureInstant(new Date("2026-09-07T12:00:00.000Z"), new Date("2026-09-07T12:00:00.000Z")), false);
});

const workingExpectation = {
  employeeId: "e1",
  businessDate: "2026-09-07",
  expectedDayKind: "WORKING_DAY",
  attendanceRequired: true,
  scheduledStartMinute: 600,
  scheduledEndMinute: 1080,
  crossesMidnight: false,
  unpaidBreakMinutes: 60,
  expectedWorkMinutes: 420,
  workScheduleAssignmentId: "wsa-1",
  workScheduleSource: "COMPANY_DEFAULT",
  calendarExceptionId: null,
} as const;

const overnightExpectation = {
  ...workingExpectation,
  employeeId: "e2",
  businessDate: "2026-09-05",
  scheduledStartMinute: 1320,
  scheduledEndMinute: 360,
  crossesMidnight: true,
};

const restExpectation = {
  ...workingExpectation,
  employeeId: "e3",
  expectedDayKind: "WEEKLY_REST",
  attendanceRequired: false,
  scheduledStartMinute: null,
  scheduledEndMinute: null,
  crossesMidnight: null,
  unpaidBreakMinutes: null,
  expectedWorkMinutes: null,
} as const;

const holidayExpectation = {
  ...restExpectation,
  employeeId: "e4",
  expectedDayKind: "HOLIDAY",
  workScheduleAssignmentId: null,
  workScheduleSource: null,
  calendarExceptionId: "cal-1",
};

const specialExpectation = {
  ...workingExpectation,
  employeeId: "e5",
  businessDate: "2026-09-11",
  expectedDayKind: "SPECIAL_WORKING_DAY",
  workScheduleAssignmentId: null,
  workScheduleSource: null,
  calendarExceptionId: "cal-2",
};

const policy = { id: "pol-1", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 };

function punch(businessDate: string, hours: number, minutes: number): Date {
  return buildDhakaInstant(businessDate, { hours, minutes });
}

check("working day with no punches classifies ABSENT", () => {
  const result = evaluateAttendance(
    { ...workingExpectation },
    { checkInAt: null, checkOutAt: null },
    policy,
  );
  assert.deepEqual(result, {
    presenceState: "ABSENT",
    isLate: false,
    isEarlyLeave: false,
    isNonWorkingDayAttendance: false,
    arrivalDelayMinutes: null,
    earlyDepartureMinutes: null,
  });
});

check("working day single punch classifies INCOMPLETE with factual minutes", () => {
  const result = evaluateAttendance(
    { ...workingExpectation },
    { checkInAt: punch("2026-09-07", 10, 20), checkOutAt: null },
    policy,
  );
  assert.deepEqual(result, {
    presenceState: "INCOMPLETE",
    isLate: true,
    isEarlyLeave: false,
    isNonWorkingDayAttendance: false,
    arrivalDelayMinutes: 20,
    earlyDepartureMinutes: null,
  });
});

check("working day single punch within grace is not late", () => {
  const result = evaluateAttendance(
    { ...workingExpectation },
    { checkInAt: punch("2026-09-07", 10, 10), checkOutAt: null },
    policy,
  );
  assert.equal(result.isLate, false);
  assert.equal(result.arrivalDelayMinutes, 10);
});

check("working day exact grace boundary is not late", () => {
  const result = evaluateAttendance(
    { ...workingExpectation },
    { checkInAt: punch("2026-09-07", 10, 15), checkOutAt: null },
    policy,
  );
  assert.equal(result.isLate, false);
});

check("working day full punches classify PRESENT with both factual minutes", () => {
  const result = evaluateAttendance(
    { ...workingExpectation },
    { checkInAt: punch("2026-09-07", 10, 20), checkOutAt: punch("2026-09-07", 17, 40) },
    policy,
  );
  assert.deepEqual(result, {
    presenceState: "PRESENT",
    isLate: true,
    isEarlyLeave: true,
    isNonWorkingDayAttendance: false,
    arrivalDelayMinutes: 20,
    earlyDepartureMinutes: 20,
  });
});

check("working day early-leave grace boundary is not early", () => {
  const result = evaluateAttendance(
    { ...workingExpectation },
    { checkInAt: punch("2026-09-07", 10, 0), checkOutAt: punch("2026-09-07", 17, 50) },
    policy,
  );
  assert.equal(result.isEarlyLeave, false);
  assert.equal(result.earlyDepartureMinutes, 10);
});

check("working day on-time full attendance has zero factual minutes", () => {
  const result = evaluateAttendance(
    { ...workingExpectation },
    { checkInAt: punch("2026-09-07", 10, 0), checkOutAt: punch("2026-09-07", 18, 0) },
    policy,
  );
  assert.equal(result.isLate, false);
  assert.equal(result.isEarlyLeave, false);
  assert.equal(result.arrivalDelayMinutes, 0);
  assert.equal(result.earlyDepartureMinutes, 0);
});

check("overnight window anchors scheduled end to the next day", () => {
  const onTime = evaluateAttendance(
    { ...overnightExpectation },
    { checkInAt: punch("2026-09-05", 22, 0), checkOutAt: punch("2026-09-06", 6, 0) },
    policy,
  );
  assert.equal(onTime.presenceState, "PRESENT");
  assert.equal(onTime.arrivalDelayMinutes, 0);
  assert.equal(onTime.earlyDepartureMinutes, 0);

  const delayed = evaluateAttendance(
    { ...overnightExpectation },
    { checkInAt: punch("2026-09-05", 22, 20), checkOutAt: punch("2026-09-06", 5, 50) },
    policy,
  );
  assert.equal(delayed.presenceState, "PRESENT");
  assert.equal(delayed.arrivalDelayMinutes, 20);
  assert.equal(delayed.earlyDepartureMinutes, 10);
  assert.equal(delayed.isLate, true);
  assert.equal(delayed.isEarlyLeave, false);
});

check("working day evaluation without policy is rejected", () => {
  assert.throws(() =>
    evaluateAttendance({ ...workingExpectation }, { checkInAt: null, checkOutAt: null }, null),
  );
});

check("non-working days classify without policy", () => {
  const result = evaluateAttendance(
    { ...restExpectation },
    { checkInAt: null, checkOutAt: null },
    null,
  );
  assert.equal(result.presenceState, "NOT_REQUIRED");
});

check("rest day single punch classifies INCOMPLETE with non-working flag", () => {
  const result = evaluateAttendance(
    { ...restExpectation },
    { checkInAt: punch("2026-09-07", 11, 0), checkOutAt: null },
    null,
  );
  assert.deepEqual(result, {
    presenceState: "INCOMPLETE",
    isLate: false,
    isEarlyLeave: false,
    isNonWorkingDayAttendance: true,
    arrivalDelayMinutes: null,
    earlyDepartureMinutes: null,
  });
});

check("rest day full punches classify PRESENT with non-working flag", () => {
  const result = evaluateAttendance(
    { ...restExpectation },
    { checkInAt: punch("2026-09-07", 11, 0), checkOutAt: punch("2026-09-07", 15, 0) },
    null,
  );
  assert.deepEqual(result, {
    presenceState: "PRESENT",
    isLate: false,
    isEarlyLeave: false,
    isNonWorkingDayAttendance: true,
    arrivalDelayMinutes: null,
    earlyDepartureMinutes: null,
  });
});

check("holiday punches carry the non-working flag", () => {
  const single = evaluateAttendance(
    { ...holidayExpectation },
    { checkInAt: punch("2026-09-07", 11, 0), checkOutAt: null },
    null,
  );
  assert.equal(single.presenceState, "INCOMPLETE");
  assert.equal(single.isNonWorkingDayAttendance, true);
});

check("special working day requires policy and evaluates like a working day", () => {
  assert.throws(() =>
    evaluateAttendance({ ...specialExpectation }, { checkInAt: null, checkOutAt: null }, null),
  );
  const result = evaluateAttendance(
    { ...specialExpectation },
    { checkInAt: punch("2026-09-11", 10, 5), checkOutAt: punch("2026-09-11", 18, 0) },
    policy,
  );
  assert.equal(result.presenceState, "PRESENT");
  assert.equal(result.arrivalDelayMinutes, 5);
});

check("check out without check in is rejected by the evaluator", () => {
  assert.throws(() =>
    evaluateAttendance(
      { ...workingExpectation },
      { checkInAt: null, checkOutAt: punch("2026-09-07", 18, 0) },
      policy,
    ),
  );
});

check("misordered punches are rejected by the evaluator", () => {
  assert.throws(() =>
    evaluateAttendance(
      { ...workingExpectation },
      { checkInAt: punch("2026-09-07", 18, 0), checkOutAt: punch("2026-09-07", 10, 0) },
      policy,
    ),
  );
});

check("operational states on working days before the window closes", () => {
  const pending = deriveOperationalStatus({
    expectation: { ...workingExpectation },
    punches: { checkInAt: null, checkOutAt: null },
    policy,
    now: punch("2026-09-07", 12, 0),
  });
  assert.deepEqual(pending, { kind: "PENDING" });

  const checkedIn = deriveOperationalStatus({
    expectation: { ...workingExpectation },
    punches: { checkInAt: punch("2026-09-07", 10, 10), checkOutAt: null },
    policy,
    now: punch("2026-09-07", 12, 0),
  });
  assert.equal(checkedIn.kind, "CHECKED_IN");
  assert.equal(checkedIn.nonWorkingDay, false);
  assert.equal(checkedIn.provisionalLate, false);

  const checkedInLate = deriveOperationalStatus({
    expectation: { ...workingExpectation },
    punches: { checkInAt: punch("2026-09-07", 10, 20), checkOutAt: null },
    policy,
    now: punch("2026-09-07", 12, 0),
  });
  assert.equal(checkedInLate.kind, "CHECKED_IN_LATE");

  const withoutPolicy = deriveOperationalStatus({
    expectation: { ...workingExpectation },
    punches: { checkInAt: punch("2026-09-07", 10, 20), checkOutAt: null },
    policy: null,
    now: punch("2026-09-07", 12, 0),
  });
  assert.equal(withoutPolicy.kind, "CHECKED_IN");
  assert.equal(withoutPolicy.provisionalLate, null);
});

check("operational incomplete appears only after the expected window closes", () => {
  const duringShift = deriveOperationalStatus({
    expectation: { ...workingExpectation },
    punches: { checkInAt: punch("2026-09-07", 10, 20), checkOutAt: null },
    policy,
    now: punch("2026-09-07", 17, 0),
  });
  assert.equal(duringShift.kind, "CHECKED_IN_LATE");

  const afterShift = deriveOperationalStatus({
    expectation: { ...workingExpectation },
    punches: { checkInAt: punch("2026-09-07", 10, 20), checkOutAt: null },
    policy,
    now: punch("2026-09-07", 18, 30),
  });
  assert.equal(afterShift.kind, "INCOMPLETE");
});

check("operational present carries provisional flags on working days", () => {
  const result = deriveOperationalStatus({
    expectation: { ...workingExpectation },
    punches: { checkInAt: punch("2026-09-07", 10, 20), checkOutAt: punch("2026-09-07", 17, 40) },
    policy,
    now: punch("2026-09-07", 18, 30),
  });
  assert.equal(result.kind, "PRESENT");
  assert.equal(result.provisionalLate, true);
  assert.equal(result.provisionalEarlyLeave, true);
});

check("non-working day check-in is never prematurely incomplete", () => {
  const noPunches = deriveOperationalStatus({
    expectation: { ...restExpectation },
    punches: { checkInAt: null, checkOutAt: null },
    policy: null,
    now: punch("2026-09-07", 12, 0),
  });
  assert.deepEqual(noPunches, { kind: "NON_WORKING_NO_ATTENDANCE" });

  const checkedIn = deriveOperationalStatus({
    expectation: { ...restExpectation },
    punches: { checkInAt: punch("2026-09-07", 11, 0), checkOutAt: null },
    policy,
    now: punch("2026-09-07", 12, 0),
  });
  assert.equal(checkedIn.kind, "CHECKED_IN");
  assert.equal(checkedIn.nonWorkingDay, true);
  assert.equal(checkedIn.provisionalLate, false);

  const present = deriveOperationalStatus({
    expectation: { ...restExpectation },
    punches: { checkInAt: punch("2026-09-07", 11, 0), checkOutAt: punch("2026-09-07", 15, 0) },
    policy,
    now: punch("2026-09-07", 16, 0),
  });
  assert.equal(present.kind, "PRESENT");
  assert.equal(present.nonWorkingDay, true);
});

check("applicability truth table A draft B finalized C void D rejected", () => {
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: null, isAttendanceApplicable: null, origin: "MANUAL_ENTRY" }),
    true,
  );
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: new Date("2026-09-07T12:00:00Z"), isAttendanceApplicable: true, origin: "SYSTEM_FINALIZATION" }),
    true,
  );
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: new Date("2026-09-07T12:00:00Z"), isAttendanceApplicable: true, origin: "MANUAL_ENTRY" }),
    true,
  );
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: new Date("2026-09-08T12:00:00Z"), isAttendanceApplicable: false, origin: "MANUAL_CORRECTION" }),
    true,
  );
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: new Date("2026-09-07T12:00:00Z"), isAttendanceApplicable: null, origin: "MANUAL_CORRECTION" }),
    false,
  );
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: null, isAttendanceApplicable: true, origin: "MANUAL_ENTRY" }),
    false,
  );
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: new Date("2026-09-07T12:00:00Z"), isAttendanceApplicable: false, origin: "SYSTEM_FINALIZATION" }),
    false,
  );
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: new Date("2026-09-07T12:00:00Z"), isAttendanceApplicable: false, origin: "MANUAL_ENTRY" }),
    false,
  );
  assert.equal(
    isValidApplicabilityShape({ finalizedAt: null, isAttendanceApplicable: null, origin: "MANUAL_CORRECTION" }),
    false,
  );
});

const semanticView = {
  expectedDayKind: "WORKING_DAY",
  scheduledStartMinute: 600,
  scheduledEndMinute: 1080,
  crossesMidnight: false,
  unpaidBreakMinutes: 60,
  expectedWorkMinutes: 420,
  lateGraceMinutes: 15,
  earlyLeaveGraceMinutes: 10,
  presenceState: "PRESENT",
  isLate: true,
  isEarlyLeave: false,
  isNonWorkingDayAttendance: false,
  arrivalDelayMinutes: 20,
  earlyDepartureMinutes: 0,
  calendarExceptionId: null,
  attendancePolicyId: "pol-1",
} as const;

check("configuration record ids alone are not a material change", () => {
  assert.equal(
    isMaterialAttendanceChange(
      { ...semanticView },
      { ...semanticView, calendarExceptionId: "cal-9", attendancePolicyId: "pol-9" },
    ),
    false,
  );
});

check("semantic field changes are material", () => {
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, expectedDayKind: "HOLIDAY" }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, scheduledStartMinute: 540 }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, scheduledEndMinute: 1020 }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, crossesMidnight: true }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, unpaidBreakMinutes: 45 }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, expectedWorkMinutes: 435 }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, lateGraceMinutes: 20 }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, earlyLeaveGraceMinutes: 20 }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, presenceState: "ABSENT" }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, isLate: false }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, isEarlyLeave: true }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, isNonWorkingDayAttendance: true }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, arrivalDelayMinutes: 21 }),
    true,
  );
  assert.equal(
    isMaterialAttendanceChange({ ...semanticView }, { ...semanticView, earlyDepartureMinutes: 5 }),
    true,
  );
});

check("finalization allowed time uses the latest expected end", () => {
  const normal = computeFinalizationAllowedAt([
    { ...workingExpectation, businessDate: "2026-09-05" },
    { ...workingExpectation, employeeId: "e9", businessDate: "2026-09-05", scheduledEndMinute: 1020 },
  ]);
  assert.equal(normal.toISOString(), "2026-09-05T12:00:00.000Z");
});

check("finalization allowed time crosses midnight for overnight windows", () => {
  const overnight = computeFinalizationAllowedAt([
    { ...overnightExpectation },
    { ...workingExpectation, businessDate: "2026-09-05" },
  ]);
  assert.equal(overnight.toISOString(), "2026-09-06T00:00:00.000Z");
  assert.equal(overnight > new Date("2026-09-06T00:30:00.000Z"), false);
  assert.equal(overnight > new Date("2026-09-05T22:00:00.000Z"), true);
});

check("finalization allowed time for zero work windows is the next Dhaka midnight", () => {
  const allRest = computeFinalizationAllowedAt([
    { ...restExpectation, businessDate: "2026-09-05" },
    { ...holidayExpectation, businessDate: "2026-09-05" },
  ]);
  assert.equal(allRest.toISOString(), "2026-09-05T18:00:00.000Z");
});

check("expected count counts only attendance-required expectations", () => {
  const roster = Array.from({ length: 20 }, (_, index) => ({
    ...restExpectation,
    employeeId: `r-${index}`,
  }));
  assert.equal(countExpected(roster), 0);
  assert.equal(countExpected([...roster, { ...specialExpectation }]), 1);
  assert.equal(
    countExpected([{ ...workingExpectation }, { ...restExpectation }, { ...specialExpectation }]),
    2,
  );
  assert.equal(countExpected([{ ...holidayExpectation }]), 0);
});

const policyA: AttendancePolicyView = {
  id: "A",
  companyId: "c1",
  effectiveFrom: "2026-09-01",
  effectiveTo: null,
  lateGraceMinutes: 15,
  earlyLeaveGraceMinutes: 10,
  replacesPolicyId: null,
  cancelledAt: null,
};

const policyAFinite: AttendancePolicyView = {
  ...policyA,
  effectiveTo: "2026-12-01",
};

const policyB: AttendancePolicyView = {
  id: "B",
  companyId: "c1",
  effectiveFrom: "2026-10-01",
  effectiveTo: "2026-12-01",
  lateGraceMinutes: 20,
  earlyLeaveGraceMinutes: 5,
  replacesPolicyId: "A",
  cancelledAt: null,
};

const today = "2026-09-06";

check("replacement splice closes the predecessor and inherits its boundary", () => {
  const openEnded = computeReplacementSplice(policyA, "2026-10-01");
  assert.deepEqual(openEnded.predecessor, { id: "A", effectiveFrom: "2026-09-01", effectiveTo: "2026-10-01" });
  assert.deepEqual(openEnded.replacement, { effectiveFrom: "2026-10-01", effectiveTo: null, replacesPolicyId: "A" });

  const finite = computeReplacementSplice(policyAFinite, "2026-10-01");
  assert.deepEqual(finite.predecessor, { id: "A", effectiveFrom: "2026-09-01", effectiveTo: "2026-10-01" });
  assert.deepEqual(finite.replacement, { effectiveFrom: "2026-10-01", effectiveTo: "2026-12-01", replacesPolicyId: "A" });
});

check("replacement date must lie strictly inside the live range after its start", () => {
  assert.throws(() => computeReplacementSplice(policyA, "2026-09-01"));
  assert.throws(() => computeReplacementSplice(policyA, "2026-08-31"));
  assert.throws(() => computeReplacementSplice(policyAFinite, "2026-12-01"));
  assert.throws(() => computeReplacementSplice(policyAFinite, "2026-12-02"));
  assert.doesNotThrow(() => computeReplacementSplice(policyAFinite, "2026-11-30"));
});

check("replacement of a cancelled predecessor is rejected", () => {
  const cancelled: AttendancePolicyView = { ...policyA, cancelledAt: new Date("2026-09-02T00:00:00Z") };
  assert.throws(() => computeReplacementSplice(cancelled, "2026-10-01"));
});

check("cancellation restore returns the replacement boundary for the predecessor", () => {
  const predecessorClosed: AttendancePolicyView = { ...policyA, effectiveTo: "2026-10-01" };
  const restore = computeCancellationRestore(policyB, predecessorClosed);
  assert.deepEqual(restore, { restoredEffectiveTo: "2026-12-01" });
});

check("cancellation restore requires a matching predecessor boundary and lineage", () => {
  const predecessorClosed: AttendancePolicyView = { ...policyA, effectiveTo: "2026-10-01" };
  assert.throws(() => computeCancellationRestore(policyB, { ...predecessorClosed, effectiveTo: "2026-11-01" }));
  assert.throws(() =>
    computeCancellationRestore({ ...policyB, replacesPolicyId: "Z" }, predecessorClosed),
  );
  assert.throws(() =>
    computeCancellationRestore({ ...policyB, cancelledAt: new Date("2026-09-05T00:00:00Z") }, predecessorClosed),
  );
});

check("ever effective treats uncancelled started policies as effective", () => {
  assert.equal(isEverEffective(policyA, today), true);
  assert.equal(isEverEffective(policyA, "2026-08-31"), false);
  assert.equal(isEverEffective(policyB, today), false);
});

check("a policy cancelled before its Dhaka start never becomes effective", () => {
  const futureInitial: AttendancePolicyView = {
    id: "F",
    companyId: "c1",
    effectiveFrom: "2026-10-01",
    effectiveTo: null,
    lateGraceMinutes: 15,
    earlyLeaveGraceMinutes: 10,
    replacesPolicyId: null,
    cancelledAt: new Date("2026-09-20T10:00:00Z"),
  };
  assert.equal(isEverEffective(futureInitial, "2026-09-06"), false);
  assert.equal(isEverEffective(futureInitial, "2026-10-05"), false);
  assert.equal(policyStartInstant(futureInitial).toISOString(), "2026-09-30T18:00:00.000Z");

  const cancelledAfterStart: AttendancePolicyView = {
    ...futureInitial,
    cancelledAt: new Date("2026-10-02T00:00:00Z"),
  };
  assert.equal(isEverEffective(cancelledAfterStart, "2026-10-05"), true);
});

check("initial creation is allowed only without ever-effective or uncancelled lineage", () => {
  assert.equal(canCreateInitial([], today), true);
  assert.equal(canCreateInitial([policyA], today), false);
  assert.equal(
    canCreateInitial(
      [
        {
          id: "F",
          companyId: "c1",
          effectiveFrom: "2026-10-01",
          effectiveTo: null,
          lateGraceMinutes: 15,
          earlyLeaveGraceMinutes: 10,
          replacesPolicyId: null,
          cancelledAt: new Date("2026-09-20T10:00:00Z"),
        },
      ],
      "2026-10-05",
    ),
    true,
  );
  assert.equal(canCreateInitial([policyB], today), false);
});

check("uncancelled dependents block cancellation", () => {
  const dependentCancelled: AttendancePolicyView = {
    id: "C",
    companyId: "c1",
    effectiveFrom: "2027-01-01",
    effectiveTo: null,
    lateGraceMinutes: 15,
    earlyLeaveGraceMinutes: 10,
    replacesPolicyId: "B",
    cancelledAt: new Date("2026-09-10T00:00:00Z"),
  };
  const dependentLive: AttendancePolicyView = { ...dependentCancelled, id: "D", cancelledAt: null };
  const dependents = uncancelledDependentsOf([policyA, policyB, dependentCancelled, dependentLive], "B");
  assert.deepEqual(dependents.map((row) => row.id), ["D"]);
  assert.deepEqual(uncancelledDependentsOf([policyA, policyB], "A").map((row) => row.id), ["B"]);
  assert.deepEqual(uncancelledDependentsOf([policyA], "A"), []);
});

const holidayShape: CalendarExceptionShapeInput = {
  exceptionType: "HOLIDAY",
  startMinuteOfDay: null,
  endMinuteOfDay: null,
  unpaidBreakMinutes: 0,
  crossesMidnight: false,
};

const normalSpecialShape: CalendarExceptionShapeInput = {
  exceptionType: "SPECIAL_WORKING_DAY",
  startMinuteOfDay: 600,
  endMinuteOfDay: 1080,
  unpaidBreakMinutes: 60,
  crossesMidnight: false,
};

const overnightSpecialShape: CalendarExceptionShapeInput = {
  exceptionType: "SPECIAL_WORKING_DAY",
  startMinuteOfDay: 1320,
  endMinuteOfDay: 360,
  unpaidBreakMinutes: 60,
  crossesMidnight: true,
};

check("holiday shape requires null times, zero break, and no midnight crossing", () => {
  assert.doesNotThrow(() => validateCalendarExceptionShape(holidayShape));
  assert.throws(() => validateCalendarExceptionShape({ ...holidayShape, startMinuteOfDay: 600 }));
  assert.throws(() => validateCalendarExceptionShape({ ...holidayShape, endMinuteOfDay: 1080 }));
  assert.throws(() => validateCalendarExceptionShape({ ...holidayShape, unpaidBreakMinutes: 30 }));
  assert.throws(() => validateCalendarExceptionShape({ ...holidayShape, crossesMidnight: true }));
});

check("special working day accepts normal and overnight windows", () => {
  assert.doesNotThrow(() => validateCalendarExceptionShape(normalSpecialShape));
  assert.doesNotThrow(() => validateCalendarExceptionShape(overnightSpecialShape));
  assert.doesNotThrow(() =>
    validateCalendarExceptionShape({ ...overnightSpecialShape, unpaidBreakMinutes: 479 }),
  );
});

check("special working day requires both times within bounds", () => {
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, startMinuteOfDay: null }));
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, endMinuteOfDay: null }));
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, startMinuteOfDay: 1440 }));
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, startMinuteOfDay: -1 }));
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, endMinuteOfDay: 1440 }));
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, endMinuteOfDay: -1 }));
});

check("special working day rejects equal times as ambiguous", () => {
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, endMinuteOfDay: 600 }));
  assert.throws(() => validateCalendarExceptionShape({ ...overnightSpecialShape, endMinuteOfDay: 1320 }));
});

check("special working day enforces overnight direction", () => {
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, endMinuteOfDay: 540 }));
  assert.throws(() => validateCalendarExceptionShape({ ...overnightSpecialShape, crossesMidnight: false }));
  assert.throws(() =>
    validateCalendarExceptionShape({ ...normalSpecialShape, crossesMidnight: true }),
  );
});

check("special working day bounds the unpaid break against gross duration", () => {
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, unpaidBreakMinutes: -1 }));
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, unpaidBreakMinutes: 480 }));
  assert.throws(() => validateCalendarExceptionShape({ ...normalSpecialShape, unpaidBreakMinutes: 481 }));
  assert.throws(() => validateCalendarExceptionShape({ ...overnightSpecialShape, unpaidBreakMinutes: 480 }));
  assert.doesNotThrow(() => validateCalendarExceptionShape({ ...normalSpecialShape, unpaidBreakMinutes: 479 }));
});


console.log(`Attendance pure verification: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) {
  process.exitCode = 1;
}
