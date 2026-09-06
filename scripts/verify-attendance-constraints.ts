import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertAttendanceDevDatabase,
  assertAttendanceScratchDatabase,
  databaseFingerprint,
  verificationPg,
  type VerificationPg,
} from "./attendance-verification";

type SqlValue = string | number | boolean | null;

type Expected = {
  code: string;
  constraints?: string[];
  messageIncludes?: string;
};

type Probe = {
  name: string;
  run: () => Promise<unknown>;
  expected?: Expected;
  finalOnly?: boolean;
};

let sequence = 0;

function quote(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function insertSql(table: string, values: Record<string, SqlValue>): string {
  const columns = Object.keys(values);
  const literals = columns.map((column) => {
    const value = values[column];
    if (value === null) {
      return "NULL";
    }
    if (typeof value === "number") {
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "TRUE" : "FALSE";
    }
    return quote(value);
  });
  return `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${literals.join(", ")})`;
}

const BASE_DATE = "2026-09-07";

async function seedBase(pg: VerificationPg): Promise<void> {
  await pg.query(
    insertSql("companies", {
      id: "co1",
      singletonKey: "HR2C_SCRATCH_PRIMARY",
      name: "HR2C Verification Company",
      currency: "BDT",
      createdAt: "2026-09-01 00:00:00",
      updatedAt: "2026-09-01 00:00:00",
    }),
  );
  await pg.query(
    insertSql("users", {
      id: "u1",
      email: "hr2c-verifier@example.invalid",
      fullName: "HR2C Verifier",
      passwordHash: "not-a-real-hash",
      isActive: true,
      createdAt: "2026-09-01 00:00:00",
      updatedAt: "2026-09-01 00:00:00",
    }),
  );
  await pg.query(
    insertSql("employees", {
      id: "em1",
      employeeCode: "HR2C001",
      fullName: "HR2C Employee",
      designation: "Verification",
      joiningDate: "2026-01-01 00:00:00",
      isActive: true,
      isDeleted: false,
      createdAt: "2026-09-01 00:00:00",
      updatedAt: "2026-09-01 00:00:00",
    }),
  );
  await pg.query(
    insertSql("work_schedules", {
      id: "ws1",
      companyId: "co1",
      code: "HR2C_WS",
      name: "HR2C Scratch Schedule",
      description: null,
      isActive: true,
      createdById: "u1",
      createdAt: "2026-09-01 00:00:00",
      updatedAt: "2026-09-01 00:00:00",
    }),
  );
  await pg.query(
    insertSql("work_schedule_assignments", {
      id: "wsa1",
      companyId: "co1",
      scope: "COMPANY_DEFAULT",
      workScheduleId: "ws1",
      employeeId: null,
      effectiveFrom: "2026-09-01",
      effectiveTo: null,
      changeReason: null,
      createdById: "u1",
      createdAt: "2026-09-01 00:00:00",
      updatedAt: "2026-09-01 00:00:00",
      cancelledAt: null,
      replacesAssignmentId: null,
    }),
  );
}

function seedRecord(id: string, employeeId = "em1", businessDate = BASE_DATE): string {
  return insertSql("attendance_records", {
    id,
    companyId: "co1",
    employeeId,
    businessDate,
    createdAt: "2026-09-08 00:00:00",
    updatedAt: "2026-09-08 00:00:00",
  });
}

function seedDayFinalization(id: string, businessDate = BASE_DATE): string {
  return insertSql("attendance_day_finalizations", {
    id,
    companyId: "co1",
    businessDate,
    finalizedAt: "2026-09-08 00:00:00",
    finalizedById: "u1",
  });
}

function seedPolicy(
  id: string,
  overrides: Record<string, SqlValue> = {},
): string {
  return insertSql("attendance_policies", {
    id,
    companyId: "co1",
    effectiveFrom: "2026-09-01",
    effectiveTo: null,
    lateGraceMinutes: 15,
    earlyLeaveGraceMinutes: 10,
    changeReason: null,
    replacesPolicyId: null,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    createdById: "u1",
    createdAt: "2026-09-01 00:00:00",
    updatedAt: "2026-09-01 00:00:00",
    ...overrides,
  });
}

function seedException(
  id: string,
  overrides: Record<string, SqlValue> = {},
): string {
  return insertSql("company_calendar_exceptions", {
    id,
    companyId: "co1",
    businessDate: "2026-10-15",
    exceptionType: "HOLIDAY",
    name: "Scratch Holiday",
    startMinuteOfDay: null,
    endMinuteOfDay: null,
    unpaidBreakMinutes: 0,
    crossesMidnight: false,
    changeReason: null,
    replacesExceptionId: null,
    supersededAt: null,
    supersededById: null,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    createdById: "u1",
    createdAt: "2026-09-01 00:00:00",
    updatedAt: "2026-09-01 00:00:00",
    ...overrides,
  });
}

function validFinalizedWorkingRevision(
  id: string,
  recordId: string,
  overrides: Record<string, SqlValue> = {},
): string {
  return insertSql("attendance_revisions", {
    id,
    attendanceRecordId: recordId,
    revisionNo: 1,
    origin: "MANUAL_CORRECTION",
    isAttendanceApplicable: true,
    checkInAt: null,
    checkOutAt: null,
    note: null,
    expectedDayKind: "WORKING_DAY",
    workScheduleAssignmentId: "wsa1",
    workScheduleSource: "COMPANY_DEFAULT",
    calendarExceptionId: null,
    attendancePolicyId: "pol1",
    scheduledStartMinute: 600,
    scheduledEndMinute: 1080,
    crossesMidnight: false,
    unpaidBreakMinutes: 60,
    expectedWorkMinutes: 420,
    lateGraceMinutes: 15,
    earlyLeaveGraceMinutes: 10,
    timeZone: "Asia/Dhaka",
    presenceState: "ABSENT",
    isLate: false,
    isEarlyLeave: false,
    isNonWorkingDayAttendance: false,
    arrivalDelayMinutes: null,
    earlyDepartureMinutes: null,
    changeReason: "verification",
    createdById: "u1",
    finalizedById: "u1",
    finalizedAt: "2026-09-08 00:00:00",
    createdAt: "2026-09-08 00:00:00",
    updatedAt: "2026-09-08 00:00:00",
    ...overrides,
  });
}

function draftRevision(
  id: string,
  recordId: string,
  overrides: Record<string, SqlValue> = {},
): string {
  return insertSql("attendance_revisions", {
    id,
    attendanceRecordId: recordId,
    revisionNo: 1,
    origin: "MANUAL_ENTRY",
    isAttendanceApplicable: null,
    checkInAt: null,
    checkOutAt: null,
    note: null,
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
    changeReason: null,
    createdById: "u1",
    finalizedById: null,
    finalizedAt: null,
    createdAt: "2026-09-08 00:00:00",
    updatedAt: "2026-09-08 00:00:00",
    ...overrides,
  });
}

function run(query: string) {
  return async (pg: VerificationPg) => pg.query(query);
}

function multi(...queries: string[]) {
  return async (pg: VerificationPg) => {
    for (const query of queries) {
      await pg.query(query);
    }
  };
}

function buildProbes(): Probe[] {
  const probes: Probe[] = [];

  const violation = (
    name: string,
    queries: string[],
    code: string,
    constraints: string[] = [],
    messageIncludes?: string,
  ) => {
    probes.push({
      name,
      run: multi(...queries),
      expected: { code, constraints, messageIncludes },
    });
  };

  const validity = (name: string, queries: string[]) => {
    probes.push({ name, run: multi(...queries) });
  };

  const finalOnly = (
    name: string,
    run: (pg: VerificationPg) => Promise<unknown>,
    expected?: Expected,
  ) => {
    probes.push({ name, run, expected, finalOnly: true });
  };

  violation(
    "duplicate employee/businessDate rejected",
    [seedRecord("r1"), seedRecord("r2")],
    "23505",
    ["attendance_records_employeeId_businessDate_key"],
  );

  violation(
    "duplicate revision number rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1"), validFinalizedWorkingRevision("v2", "r1")],
    "23505",
    ["attendance_revisions_attendanceRecordId_revisionNo_key"],
  );

  violation(
    "second draft rejected",
    [seedRecord("r1"), draftRevision("d1", "r1"), draftRevision("d2", "r1", { revisionNo: 2 })],
    "23505",
    ["attendance_revisions_draft_unique"],
  );

  violation(
    "check out without check in rejected",
    [seedRecord("r1"), draftRevision("d1", "r1", { checkOutAt: "2026-09-07 18:00:00" })],
    "23514",
    ["attendance_revisions_checkout_requires_checkin_check"],
  );

  violation(
    "misordered punches rejected",
    [seedRecord("r1"), draftRevision("d1", "r1", { checkInAt: "2026-09-07 18:00:00", checkOutAt: "2026-09-07 10:00:00" })],
    "23514",
    ["attendance_revisions_punch_order_check"],
  );

  violation(
    "draft snapshot contamination rejected",
    [seedRecord("r1"), draftRevision("d1", "r1", { expectedDayKind: "WORKING_DAY" })],
    "23514",
    ["attendance_revisions_draft_shape_check"],
  );

  violation(
    "finalized revision with null applicability rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", { isAttendanceApplicable: null })],
    "23514",
    ["attendance_revisions_finalized_applicable_check"],
  );

  violation(
    "system finalization with applicability false rejected",
    [
      seedRecord("r1"),
      seedPolicy("pol1"),
      validFinalizedWorkingRevision("v1", "r1", {
        origin: "SYSTEM_FINALIZATION",
        isAttendanceApplicable: false,
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
        changeReason: null,
      }),
    ],
    "23514",
    ["attendance_revisions_system_finalization_applicable_check", "attendance_revisions_void_origin_check"],
  );

  violation(
    "void with non-null classification rejected",
    [seedRecord("r1"), validFinalizedWorkingRevision("v1", "r1", { isAttendanceApplicable: false, presenceState: "PRESENT", attendancePolicyId: null })],
    "23514",
    ["attendance_revisions_void_shape_check"],
  );

  violation(
    "applicable finalized missing core snapshot rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", { expectedDayKind: null })],
    "23514",
    ["attendance_revisions_finalized_core_check", "attendance_revisions_expected_kind_shape_check"],
  );

  violation(
    "working day with calendar attribution rejected",
    [seedRecord("r1"), seedPolicy("pol1"), seedException("exc1"), validFinalizedWorkingRevision("v1", "r1", { calendarExceptionId: "exc1" })],
    "23514",
    ["attendance_revisions_expected_kind_shape_check"],
  );

  violation(
    "weekly rest with working window rejected",
    [seedRecord("r1"), validFinalizedWorkingRevision("v1", "r1", {
      expectedDayKind: "WEEKLY_REST",
      presenceState: "NOT_REQUIRED",
      attendancePolicyId: null,
      lateGraceMinutes: null,
      earlyLeaveGraceMinutes: null,
      scheduledStartMinute: 600,
      scheduledEndMinute: 1080,
    })],
    "23514",
    ["attendance_revisions_expected_kind_shape_check"],
  );

  violation(
    "present without check out rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", {
      presenceState: "PRESENT",
      checkInAt: "2026-09-07 10:00:00",
      arrivalDelayMinutes: 0,
    })],
    "23514",
    ["attendance_revisions_presence_shape_check", "attendance_revisions_factual_minutes_check"],
  );

  violation(
    "absent with punches rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", { checkInAt: "2026-09-07 10:00:00" })],
    "23514",
    ["attendance_revisions_presence_shape_check"],
  );

  violation(
    "not required on working day rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", { presenceState: "NOT_REQUIRED" })],
    "23514",
    ["attendance_revisions_presence_shape_check", "attendance_revisions_factual_minutes_check"],
  );

  violation(
    "incomplete missing arrival minutes rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", {
      presenceState: "INCOMPLETE",
      checkInAt: "2026-09-07 10:20:00",
    })],
    "23514",
    ["attendance_revisions_factual_minutes_check"],
  );

  violation(
    "present missing departure minutes rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", {
      presenceState: "PRESENT",
      checkInAt: "2026-09-07 10:00:00",
      checkOutAt: "2026-09-07 18:00:00",
      arrivalDelayMinutes: 0,
    })],
    "23514",
    ["attendance_revisions_factual_minutes_check"],
  );

  violation(
    "incorrect late flag equality rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", {
      presenceState: "PRESENT",
      checkInAt: "2026-09-07 10:20:00",
      checkOutAt: "2026-09-07 18:00:00",
      arrivalDelayMinutes: 20,
      earlyDepartureMinutes: 0,
    })],
    "23514",
    ["attendance_revisions_factual_minutes_check"],
  );

  violation(
    "incorrect early leave flag equality rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", {
      presenceState: "PRESENT",
      checkInAt: "2026-09-07 10:00:00",
      checkOutAt: "2026-09-07 17:40:00",
      arrivalDelayMinutes: 0,
      earlyDepartureMinutes: 20,
    })],
    "23514",
    ["attendance_revisions_factual_minutes_check"],
  );

  violation(
    "negative arrival minutes rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1", {
      presenceState: "INCOMPLETE",
      checkInAt: "2026-09-07 10:20:00",
      arrivalDelayMinutes: -5,
    })],
    "23514",
    ["attendance_revisions_arrival_nonnegative_check", "attendance_revisions_factual_minutes_check"],
  );

  violation(
    "policy invalid effective range rejected",
    [seedPolicy("pol1", { effectiveTo: "2026-08-31" })],
    "23514",
    ["attendance_policies_effective_range_check"],
  );

  violation(
    "policy live range overlap rejected",
    [seedPolicy("pol1"), seedPolicy("pol2", { effectiveFrom: "2026-10-01" })],
    "23P01",
    ["attendance_policies_live_range_excl"],
  );

  violation(
    "policy branching replacement rejected",
    [
      seedPolicy("pol1", { effectiveTo: "2026-10-01" }),
      seedPolicy("pol2", { effectiveFrom: "2026-10-01", effectiveTo: "2027-01-01", replacesPolicyId: "pol1", changeReason: "replacement" }),
      seedPolicy("pol3", { effectiveFrom: "2027-02-01", replacesPolicyId: "pol1", changeReason: "branch" }),
    ],
    "23505",
    ["attendance_policies_replaces_policy_unique"],
  );

  violation(
    "policy cancelled metadata pair rejected",
    [seedPolicy("pol1", { cancelledAt: "2026-09-02 00:00:00", cancellationReason: "cancelled" })],
    "23514",
    ["attendance_policies_cancelled_pair_check"],
  );

  violation(
    "policy cancellation reason required",
    [seedPolicy("pol1", { cancelledAt: "2026-09-02 00:00:00", cancelledById: "u1" })],
    "23514",
    ["attendance_policies_cancellation_reason_check"],
  );

  violation(
    "policy replacement reason required",
    [seedPolicy("pol1", { effectiveTo: "2026-10-01" }), seedPolicy("pol2", { effectiveFrom: "2026-10-01", replacesPolicyId: "pol1", changeReason: null })],
    "23514",
    ["attendance_policies_replacement_reason_check"],
  );

  violation(
    "duplicate live calendar exception rejected",
    [seedException("exc1"), seedException("exc2")],
    "23505",
    ["company_calendar_exceptions_live_unique"],
  );

  violation(
    "holiday with working window rejected",
    [seedException("exc1", { startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60 })],
    "23514",
    ["company_calendar_exceptions_shape_check"],
  );

  violation(
    "special working day equal times rejected",
    [seedException("exc1", { exceptionType: "SPECIAL_WORKING_DAY", startMinuteOfDay: 600, endMinuteOfDay: 600 })],
    "23514",
    ["company_calendar_exceptions_shape_check"],
  );

  violation(
    "special working day oversized break rejected",
    [seedException("exc1", { exceptionType: "SPECIAL_WORKING_DAY", startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 480 })],
    "23514",
    ["company_calendar_exceptions_shape_check"],
  );

  violation(
    "calendar superseded metadata pair rejected",
    [seedException("exc1", { supersededAt: "2026-09-02 00:00:00" })],
    "23514",
    ["company_calendar_exceptions_superseded_pair_check"],
  );

  violation(
    "calendar superseded and cancelled rejected",
    [seedException("exc1", {
      supersededAt: "2026-09-02 00:00:00",
      supersededById: "u1",
      cancelledAt: "2026-09-03 00:00:00",
      cancelledById: "u1",
      cancellationReason: "conflict",
    })],
    "23514",
    ["company_calendar_exceptions_exclusive_states_check"],
  );

  violation(
    "calendar cancellation reason required",
    [seedException("exc1", { cancelledAt: "2026-09-02 00:00:00", cancelledById: "u1" })],
    "23514",
    ["company_calendar_exceptions_cancellation_reason_check"],
  );

  violation(
    "calendar replacement crossing dates rejected",
    [seedException("exc1"), seedException("exc2", { businessDate: "2026-10-16", replacesExceptionId: "exc1", changeReason: "replacement" })],
    "23503",
    ["company_calendar_exceptions_replacesExceptionId_companyId_busin"],
  );

  violation(
    "duplicate day finalization rejected",
    [seedDayFinalization("df1"), seedDayFinalization("df2")],
    "23505",
    ["attendance_day_finalizations_companyId_businessDate_key"],
  );

  violation(
    "update of finalized revision rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1"), `UPDATE "attendance_revisions" SET "note" = 'tamper' WHERE "id" = 'v1'`],
    "P0001",
    [],
    "immutable",
  );

  violation(
    "delete of finalized revision rejected",
    [seedRecord("r1"), seedPolicy("pol1"), validFinalizedWorkingRevision("v1", "r1"), `DELETE FROM "attendance_revisions" WHERE "id" = 'v1'`],
    "P0001",
    [],
    "immutable",
  );

  violation(
    "update of day finalization rejected",
    [seedDayFinalization("df1"), `UPDATE "attendance_day_finalizations" SET "finalizedById" = 'u1' WHERE "id" = 'df1'`],
    "P0001",
    [],
    "write-once",
  );

  violation(
    "delete of day finalization rejected",
    [seedDayFinalization("df1"), `DELETE FROM "attendance_day_finalizations" WHERE "id" = 'df1'`],
    "P0001",
    [],
    "write-once",
  );

  validity("valid draft revision accepted", [
    seedRecord("r1"),
    draftRevision("d1", "r1", { checkInAt: "2026-09-07 10:30:00", checkOutAt: "2026-09-07 18:00:00", note: "draft note" }),
  ]);

  validity("valid ordinary finalized revision accepted", [
    seedRecord("r1"),
    seedPolicy("pol1"),
    validFinalizedWorkingRevision("v1", "r1"),
  ]);

  validity("valid eligibility void with preserved punches accepted", [
    seedRecord("r1"),
    validFinalizedWorkingRevision("v1", "r1", {
      isAttendanceApplicable: false,
      checkInAt: "2026-09-07 10:30:00",
      checkOutAt: "2026-09-07 17:00:00",
      note: "kept",
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
    }),
  ]);

  finalOnly(
    "referenced employee deletion restricted",
    multi(seedRecord("r1"), `DELETE FROM "employees" WHERE "id" = 'em1'`),
    { code: "23503", constraints: ["attendance_records_employeeId_fkey"] },
  );

  finalOnly(
    "referenced company deletion restricted",
    multi(seedPolicy("pol1"), `DELETE FROM "companies" WHERE "id" = 'co1'`),
    { code: "23503" },
  );

  finalOnly(
    "btree_gist extension present",
    async (pg) => {
      const result = await pg.query(`SELECT extname FROM pg_extension WHERE extname = 'btree_gist'`);
      if ((result.rowCount ?? 0) !== 1) {
        throw Object.assign(new Error("btree_gist extension missing"), { code: "XX000" });
      }
    },
    undefined,
  );

  finalOnly(
    "draft update is not blocked by the finalized trigger",
    multi(
      seedRecord("r1"),
      draftRevision("d1", "r1"),
      `UPDATE "attendance_revisions" SET "note" = 'edited' WHERE "id" = 'd1'`,
    ),
    undefined,
  );

  return probes;
}

async function runProbes(
  pg: VerificationPg,
  mode: "red" | "final",
): Promise<{ passed: number; failed: number; invalidAccepted: number; invalidTotal: number }> {
  const probes = buildProbes();
  let passed = 0;
  let failed = 0;
  let invalidAccepted = 0;
  let invalidTotal = 0;

  for (const probe of probes) {
    if (mode === "red" && probe.finalOnly) {
      continue;
    }
    if (probe.expected !== undefined) {
      invalidTotal += 1;
    }
    const savepoint = `hr2c_probe_${++sequence}`;
    await pg.query(`SAVEPOINT ${savepoint}`);
    let actual: { code?: string; constraint?: string; message?: string } | undefined;
    try {
      await probe.run(pg);
    } catch (error) {
      actual = error as typeof actual;
    } finally {
      await pg.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await pg.query(`RELEASE SAVEPOINT ${savepoint}`);
    }

    let ok: boolean;
    if (probe.expected === undefined) {
      ok = actual === undefined;
    } else if (mode === "red") {
      ok = actual === undefined;
      if (ok) {
        invalidAccepted += 1;
      }
    } else {
      ok =
        actual !== undefined &&
        actual.code === probe.expected.code &&
        (probe.expected.constraints === undefined ||
          probe.expected.constraints.length === 0 ||
          (actual.constraint !== undefined && probe.expected.constraints.includes(actual.constraint))) &&
        (probe.expected.messageIncludes === undefined ||
          (actual.message ?? "").includes(probe.expected.messageIncludes));
    }

    if (ok) {
      passed += 1;
    } else {
      failed += 1;
    }
    const detail =
      probe.expected === undefined
        ? actual
          ? `unexpected error ${actual.code ?? "unknown"}: ${actual.message ?? ""}`
          : ""
        : mode === "red"
          ? actual
            ? `unexpectedly rejected (${actual.code ?? "unknown"}/${actual.constraint ?? "none"})`
            : ""
          : ` expected=${probe.expected.code}${probe.expected.constraints?.length ? `/${probe.expected.constraints.join("|")}` : ""} actual=${actual ? `${actual.code ?? "unknown"}/${actual.constraint ?? "none"}` : "ACCEPTED_INVALID_OPERATION"}`;
    const line = `${ok ? "PASS" : "FAIL"} ${probe.name}${detail ? ` ${detail}` : ""}`;
    if (ok) {
      console.log(line);
    } else {
      console.error(line);
    }
  }

  return { passed, failed, invalidAccepted, invalidTotal };
}

async function main(): Promise<void> {
  if (process.env.DATABASE_URL === undefined) {
    process.loadEnvFile(".env");
  }
  const schemaFlag = process.argv.find((argument) => argument.startsWith("--schema="));
  const mode = schemaFlag?.split("=")[1];
  if (mode !== "red" && mode !== "final") {
    throw new Error("Run with --schema=red or --schema=final.");
  }

  const rawUrl = process.env.DATABASE_URL;
  if (mode === "red") {
    assertAttendanceScratchDatabase(rawUrl);
  } else {
    try {
      assertAttendanceDevDatabase(rawUrl);
    } catch {
      assertAttendanceScratchDatabase(rawUrl);
    }
  }

  const pg = verificationPg(rawUrl);
  await pg.connect();
  try {
    if (mode === "red") {
      const schemaSql = await readFile(
        path.join(process.cwd(), "scripts", "attendance-scratch-red-schema.sql"),
        "utf8",
      );
      await pg.query(schemaSql);
      const { rows } = await pg.query(
        `SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('attendance_records','attendance_revisions','attendance_day_finalizations','attendance_policies','company_calendar_exceptions')`,
      );
      if (rows[0].tables !== 5) {
        throw new Error("Scratch schema did not create the five attendance tables.");
      }
      await pg.query("BEGIN");
      await seedBase(pg);
      const result = await runProbes(pg, "red");
      await pg.query("ROLLBACK");
      if (result.failed > 0) {
        console.error(`RED BROKEN: ${result.failed} probes failed; inspect the scratch schema.`);
        process.exitCode = 1;
        return;
      }
      console.log(
        `RED CONFIRMED: ${result.invalidAccepted}/${result.invalidTotal} invalid operations accepted — HR-2C business protections absent.`,
      );
      process.exitCode = 1;
      return;
    }

    const { rows } = await pg.query(
      `SELECT count(*)::int AS tables FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('attendance_records','attendance_revisions','attendance_day_finalizations','attendance_policies','company_calendar_exceptions')`,
    );
    if (rows[0].tables !== 5) {
      throw new Error("The final migration must be applied before running --schema=final.");
    }

    const before = await databaseFingerprint(pg);
    await pg.query("BEGIN");
    await seedBase(pg);
    const result = await runProbes(pg, "final");
    await pg.query("ROLLBACK");
    const after = await databaseFingerprint(pg);
    const fingerprintOk = JSON.stringify(after) === JSON.stringify(before);
    if (fingerprintOk) {
      console.log("PASS database fingerprint unchanged after verification");
    } else {
      console.error("FAIL database fingerprint changed after verification");
    }
    const totalFailed = result.failed + (fingerprintOk ? 0 : 1);
    console.log(`Attendance constraint verification: ${result.passed + (fingerprintOk ? 1 : 0)} PASS, ${totalFailed} FAIL`);
    if (totalFailed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await pg.end();
  }
}

main().catch((error) => {
  console.error(`Attendance constraint verification aborted: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
