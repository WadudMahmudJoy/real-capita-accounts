import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

let passed = 0;
let failed = 0;

async function check(name: string, verification: () => unknown | Promise<unknown>) {
  try {
    await verification();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

type CapturedRequest = {
  url: string;
  method: string;
  body: unknown;
  credentials: RequestCredentials | undefined;
  contentType: string | undefined;
};

function exactRequest(actual: CapturedRequest, expected: { path: string; method: string; body?: unknown; query?: Array<[string, string]> }) {
  const parsed = new URL(actual.url);
  assert.equal(parsed.pathname, expected.path, "path mismatch");
  assert.equal(actual.method, expected.method, "method mismatch");
  assert.equal(actual.credentials, "include", "credentials must be include");
  if (expected.query !== undefined) {
    assert.deepEqual(
      [...parsed.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)),
      [...expected.query].sort(([a], [b]) => a.localeCompare(b)),
      "query mismatch",
    );
  } else {
    assert.equal(parsed.search, "", "expected no query string");
  }
  if (expected.body !== undefined) {
    assert.equal(actual.contentType, "application/json", "body must be JSON");
    assert.deepEqual(actual.body, expected.body, "body mismatch");
  } else {
    assert.equal(actual.body, undefined, "expected no body");
  }
}

async function main() {
  const root = process.cwd();
  const clientPath = path.join(root, "apps/web/src/lib/attendance-api.ts");
  const sharedApiPath = path.join(root, "apps/web/src/lib/api.ts");
  const clientSource = await readFile(clientPath, "utf8");

  const attendance = await import("../apps/web/src/lib/attendance-api");

  const requests: CapturedRequest[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      contentType: init?.headers instanceof Headers
        ? init.headers.get("content-type") ?? undefined
        : init?.headers && typeof init.headers === "object" && "Content-Type" in init.headers
          ? String((init.headers as Record<string, string>)["Content-Type"])
          : undefined,
      credentials: init?.credentials,
      method: init?.method ?? "GET",
      url: String(input),
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }) as typeof fetch;

  try {
    await attendance.getAttendanceDay({ businessDate: "2026-09-05" });
    await check("getAttendanceDay sends date-only query", () =>
      exactRequest(requests.at(-1)!, { method: "GET", path: "/attendance/day", query: [["businessDate", "2026-09-05"]] }));

    await attendance.getAttendanceDay({ businessDate: "2026-09-05", departmentId: "dep 1", search: "Ali Hasan" });
    await check("getAttendanceDay encodes department and search filters", () =>
      exactRequest(requests.at(-1)!, {
        method: "GET",
        path: "/attendance/day",
        query: [
          ["businessDate", "2026-09-05"],
          ["departmentId", "dep 1"],
          ["search", "Ali Hasan"],
        ],
      }));

    await attendance.saveAttendanceEntries({
      businessDate: "2026-09-05",
      entries: [
        { employeeId: "e1", checkInLocalTime: "10:20", checkOutLocalTime: "18:00", note: "late bus", expectedUpdatedAt: "2026-09-05T04:00:00.000Z" },
        { employeeId: "e2" },
        { employeeId: "e3", checkInLocalTime: "09:00", expectedUpdatedAt: null },
      ],
    });
    await check("saveAttendanceEntries sends exact bulk draft payload", () =>
      exactRequest(requests.at(-1)!, {
        method: "PUT",
        path: "/attendance/entries",
        body: {
          businessDate: "2026-09-05",
          entries: [
            { employeeId: "e1", checkInLocalTime: "10:20", checkOutLocalTime: "18:00", note: "late bus", expectedUpdatedAt: "2026-09-05T04:00:00.000Z" },
            { employeeId: "e2" },
            { employeeId: "e3", checkInLocalTime: "09:00", expectedUpdatedAt: null },
          ],
        },
      }));

    await attendance.discardAttendanceEntry({ businessDate: "2026-09-05", employeeId: "e1", expectedUpdatedAt: null });
    await check("discardAttendanceEntry preserves null freshness token", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/entries/discard",
        body: { businessDate: "2026-09-05", employeeId: "e1", expectedUpdatedAt: null },
      }));

    await attendance.finalizeAttendanceDay({ businessDate: "2026-09-05" });
    await check("finalizeAttendanceDay posts the business date", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/finalize",
        body: { businessDate: "2026-09-05" },
      }));

    await attendance.getAttendanceHistory({ from: "2026-09-01", to: "2026-09-30" });
    await check("getAttendanceHistory sends required range only", () =>
      exactRequest(requests.at(-1)!, {
        method: "GET",
        path: "/attendance/history",
        query: [
          ["from", "2026-09-01"],
          ["to", "2026-09-30"],
        ],
      }));

    await attendance.getAttendanceHistory({ from: "2026-09-01", to: "2026-09-30", employeeId: "emp/1", presenceState: "ABSENT", search: "Ali" });
    await check("getAttendanceHistory encodes optional filters", () =>
      exactRequest(requests.at(-1)!, {
        method: "GET",
        path: "/attendance/history",
        query: [
          ["from", "2026-09-01"],
          ["to", "2026-09-30"],
          ["employeeId", "emp/1"],
          ["presenceState", "ABSENT"],
          ["search", "Ali"],
        ],
      }));

    await attendance.getAttendanceHistoryDetail("emp/1", "2026-09-05");
    await check("getAttendanceHistoryDetail encodes path segments", () =>
      exactRequest(requests.at(-1)!, { method: "GET", path: "/attendance/history/emp%2F1/2026-09-05" }));

    await attendance.correctAttendance("emp/1", "2026-09-05", { changeReason: "gate pass correction", checkInLocalTime: "10:00", expectedRevisionNo: null });
    await check("correctAttendance preserves null revision token for Path B", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/history/emp%2F1/2026-09-05/corrections",
        body: { changeReason: "gate pass correction", checkInLocalTime: "10:00", expectedRevisionNo: null },
      }));

    await attendance.markAttendanceNotApplicable("emp/1", "2026-09-05", { changeReason: "separation proof", expectedRevisionNo: 2 });
    await check("markAttendanceNotApplicable posts the void payload", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/history/emp%2F1/2026-09-05/not-applicable",
        body: { changeReason: "separation proof", expectedRevisionNo: 2 },
      }));

    await attendance.getAttendancePolicies();
    await check("getAttendancePolicies lists without query", () =>
      exactRequest(requests.at(-1)!, { method: "GET", path: "/attendance/policies" }));

    await attendance.createInitialAttendancePolicy({ effectiveFrom: "2026-10-01", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 });
    await check("createInitialAttendancePolicy omits optional reason", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/policies",
        body: { effectiveFrom: "2026-10-01", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 },
      }));

    await attendance.replaceAttendancePolicy("pol/1", { effectiveFrom: "2026-11-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "tighter grace" });
    await check("replaceAttendancePolicy posts the splice payload", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/policies/pol%2F1/replace",
        body: { effectiveFrom: "2026-11-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "tighter grace" },
      }));

    await attendance.cancelFutureAttendancePolicy("pol/1", { cancellationReason: "plan changed" });
    await check("cancelFutureAttendancePolicy posts the reason", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/policies/pol%2F1/cancel-future",
        body: { cancellationReason: "plan changed" },
      }));

    await attendance.getCalendarExceptions("2026-09-01", "2026-12-31");
    await check("getCalendarExceptions sends the range", () =>
      exactRequest(requests.at(-1)!, {
        method: "GET",
        path: "/attendance/calendar",
        query: [
          ["from", "2026-09-01"],
          ["to", "2026-12-31"],
        ],
      }));

    await attendance.createCalendarException({ businessDate: "2026-10-15", exceptionType: "HOLIDAY", name: "Test Holiday" });
    await check("createCalendarException omits undefined optional fields", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/calendar/exceptions",
        body: { businessDate: "2026-10-15", exceptionType: "HOLIDAY", name: "Test Holiday" },
      }));

    await attendance.updateCalendarException("exc/1", { name: "Renamed Holiday", unpaidBreakMinutes: 30 });
    await check("updateCalendarException patches partial shape", () =>
      exactRequest(requests.at(-1)!, {
        method: "PATCH",
        path: "/attendance/calendar/exceptions/exc%2F1",
        body: { name: "Renamed Holiday", unpaidBreakMinutes: 30 },
      }));

    await attendance.cancelCalendarException("exc/1", { cancellationReason: "no longer needed" });
    await check("cancelCalendarException posts the reason", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/calendar/exceptions/exc%2F1/cancel",
        body: { cancellationReason: "no longer needed" },
      }));

    await attendance.historicalCalendarCorrect({ businessDate: "2026-09-05", target: "HOLIDAY", name: "Late notice", changeReason: "correct the record" });
    await check("historicalCalendarCorrect posts the correction", () =>
      exactRequest(requests.at(-1)!, {
        method: "POST",
        path: "/attendance/calendar/historical-corrections",
        body: { businessDate: "2026-09-05", target: "HOLIDAY", name: "Late notice", changeReason: "correct the record" },
      }));
  } finally {
    globalThis.fetch = originalFetch;
  }

  await check("client exposes exactly the 17 approved Attendance functions", () => {
    const exported = [...clientSource.matchAll(/export function (\w+)/g)].map(match => match[1]);
    assert.deepEqual(
      [...exported].sort(),
      [
        "cancelCalendarException",
        "cancelFutureAttendancePolicy",
        "correctAttendance",
        "createCalendarException",
        "createInitialAttendancePolicy",
        "discardAttendanceEntry",
        "finalizeAttendanceDay",
        "getAttendanceDay",
        "getAttendanceHistory",
        "getAttendanceHistoryDetail",
        "getAttendancePolicies",
        "getCalendarExceptions",
        "historicalCalendarCorrect",
        "markAttendanceNotApplicable",
        "replaceAttendancePolicy",
        "saveAttendanceEntries",
        "updateCalendarException",
      ].sort(),
    );
  });

  await check("client never issues a DELETE request", () => {
    assert.doesNotMatch(clientSource, /method:\s*"DELETE"/);
    assert.doesNotMatch(clientSource, /"DELETE"/);
  });

  await check("mutation payloads never contain server-owned fields", () => {
    const codeOnly = clientSource
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of ["companyId", "createdById", "finalizedById", "timeZone"]) {
      assert.doesNotMatch(codeOnly, new RegExp(`\\b${forbidden}\\b`), `${forbidden} must not appear in the attendance client contract`);
    }
  });

  await check("client reuses the shared apiFetch transport", () => {
    assert.match(clientSource, /import \{ apiFetch \} from "\.\/api"/);
    assert.doesNotMatch(clientSource, /export (async )?function apiFetch/);
  });

  const sharedApiSource = await readFile(sharedApiPath, "utf8");
  await check("shared api.ts still has no Attendance endpoints of its own", () => {
    assert.doesNotMatch(sharedApiSource, /\/attendance/);
  });

  await verifyDailyUi(root);
  await verifyHistoryUi(root);
  await verifySettingsUi(root);
  await verifyEmployeesEntryLink(root);

  console.log(`Attendance Web verification: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

const FORBIDDEN_UI_TERMS = [
  "COMPANY_DEFAULT",
  "EMPLOYEE_OVERRIDE",
  "revisionNo",
  "minuteOfDay",
  "_check",
  "_excl",
  "timeZone",
  "expectedRevisionNo",
  "expectedUpdatedAt",
  "calendarExceptionId",
  "attendancePolicyId",
  "finalizationAllowedAt",
];

function renderedTexts(source: string): string[] {
  const texts: string[] = [];
  for (const match of source.matchAll(/>([^<\n]*)</g)) texts.push(match[1]);
  for (const match of source.matchAll(/"([^"\n]*)"/g)) texts.push(match[1]);
  for (const match of source.matchAll(/'([^'\n]*)'/g)) texts.push(match[1]);
  for (const match of source.matchAll(/`([^`]*)`/g)) texts.push(match[1]);
  return texts;
}

async function verifyDailyUi(root: string) {
  const attendanceDir = path.join(root, "apps/web/src/app/app/employees/attendance");
  const pageSource = await readFile(path.join(attendanceDir, "page.tsx"), "utf8");
  const workspaceSource = await readFile(path.join(attendanceDir, "attendance-workspace.tsx"), "utf8");
  const viewSource = await readFile(path.join(attendanceDir, "attendance-view.ts"), "utf8");
  const panelSource = await readFile(path.join(attendanceDir, "daily-attendance-panel.tsx"), "utf8");
  const rowSource = await readFile(path.join(attendanceDir, "attendance-day-row.tsx"), "utf8");
  const uiSources = `${pageSource}\n${workspaceSource}\n${panelSource}\n${rowSource}`;

  const view = await import("../apps/web/src/app/app/employees/attendance/attendance-view");

  const employee = { employeeId: "e1", employeeCode: "RC001", fullName: "Verifier Employee", department: null };

  await check("Expected counts only attendance-required rows", () => {
    assert.equal(view.expectedCount?.([{ attendanceRequired: true }, { attendanceRequired: false }, { attendanceRequired: true }]), 2);
  });

  await check("a rest day shows Expected zero", () => {
    const friday = [
      { employee, expectedDayKind: "WEEKLY_REST" as const, attendanceRequired: false, status: { kind: "NON_WORKING_NO_ATTENDANCE" as const } },
      { employee, expectedDayKind: "WEEKLY_REST" as const, attendanceRequired: false, status: { kind: "NON_WORKING_NO_ATTENDANCE" as const } },
    ];
    assert.equal(view.expectedCount?.(friday), 0);
    const chips = view.daySummaryChips?.({ rows: friday });
    assert.equal(chips?.expected, 0);
  });

  await check("summary chips match the day view semantics", () => {
    const chips = view.daySummaryChips?.({
      rows: [
        { employee, attendanceRequired: true, status: { kind: "PRESENT", nonWorkingDay: false, provisionalLate: true, provisionalEarlyLeave: null } },
        { employee, attendanceRequired: true, status: { kind: "PENDING" } },
        { employee, attendanceRequired: false, status: { kind: "NON_WORKING_NO_ATTENDANCE" } },
      ],
    });
    assert.deepEqual(chips, { expected: 2, present: 1, late: 1, pending: 1, incomplete: 0 });
  });

  await check("pending rows use clear text", () => {
    assert.equal(view.statusLabel?.({ expectedDayKind: "WORKING_DAY", status: { kind: "PENDING" } }), "Pending");
  });

  await check("non-working one-punch attendance is never called incomplete", () => {
    const label = view.statusLabel?.({
      expectedDayKind: "WEEKLY_REST",
      status: { kind: "CHECKED_IN", nonWorkingDay: true, provisionalLate: false, provisionalEarlyLeave: false },
    });
    assert.equal(label, "Checked In · Non-working Day");
    assert.doesNotMatch(label ?? "", /incomplete/i);
  });

  await check("checked-in late wording includes text", () => {
    assert.equal(
      view.statusLabel?.({ expectedDayKind: "WORKING_DAY", status: { kind: "CHECKED_IN_LATE", nonWorkingDay: false, provisionalLate: true, provisionalEarlyLeave: false } }),
      "Checked In · Late",
    );
  });

  await check("weekly rest and holiday wording stays human", () => {
    assert.equal(view.statusLabel?.({ expectedDayKind: "WEEKLY_REST", status: { kind: "NON_WORKING_NO_ATTENDANCE" } }), "Weekly Rest");
    assert.equal(view.statusLabel?.({ expectedDayKind: "HOLIDAY", status: { kind: "NON_WORKING_NO_ATTENDANCE" } }), "Holiday");
  });

  await check("present wording distinguishes late and early leave", () => {
    assert.equal(view.statusLabel?.({ expectedDayKind: "WORKING_DAY", status: { kind: "PRESENT", nonWorkingDay: false, provisionalLate: true, provisionalEarlyLeave: false } }), "Present · Late");
    assert.equal(view.statusLabel?.({ expectedDayKind: "WORKING_DAY", status: { kind: "PRESENT", nonWorkingDay: false, provisionalLate: false, provisionalEarlyLeave: true } }), "Present · Early Leave");
    assert.equal(view.statusLabel?.({ expectedDayKind: "WORKING_DAY", status: { kind: "PRESENT", nonWorkingDay: false, provisionalLate: false, provisionalEarlyLeave: false } }), "Present");
  });

  await check("finalized wording covers absent, incomplete, and not applicable", () => {
    assert.equal(
      view.statusLabel?.({ expectedDayKind: "WORKING_DAY", status: { kind: "FINALIZED", presenceState: "ABSENT", isLate: false, isEarlyLeave: false, isNonWorkingDayAttendance: false } }),
      "Absent",
    );
    assert.equal(
      view.statusLabel?.({ expectedDayKind: "WORKING_DAY", status: { kind: "FINALIZED", presenceState: "INCOMPLETE", isLate: false, isEarlyLeave: false, isNonWorkingDayAttendance: false } }),
      "Incomplete",
    );
    assert.equal(view.statusLabel?.({ expectedDayKind: "WORKING_DAY", status: { kind: "NOT_APPLICABLE" } }), "Not Applicable");
  });

  await check("expected window stays human-readable", () => {
    assert.equal(
      view.expectedWindowLabel?.({ expectedDayKind: "WORKING_DAY", scheduledStartMinute: 600, scheduledEndMinute: 1080, crossesMidnight: false }),
      "10:00 AM – 6:00 PM",
    );
    assert.match(
      view.expectedWindowLabel?.({ expectedDayKind: "WORKING_DAY", scheduledStartMinute: 600, scheduledEndMinute: 360, crossesMidnight: true }) ?? "",
      /ends next day/,
    );
    assert.equal(view.expectedWindowLabel?.({ expectedDayKind: "WEEKLY_REST", scheduledStartMinute: null, scheduledEndMinute: null, crossesMidnight: null }), "Weekly Rest");
    assert.equal(view.expectedWindowLabel?.({ expectedDayKind: "HOLIDAY", scheduledStartMinute: null, scheduledEndMinute: null, crossesMidnight: null }), "Holiday");
    assert.equal(
      view.expectedWindowLabel?.({ expectedDayKind: "SPECIAL_WORKING_DAY", scheduledStartMinute: 600, scheduledEndMinute: 960, crossesMidnight: false }),
      "10:00 AM – 4:00 PM",
    );
  });

  await check("finalization availability text hides the raw field name", () => {
    const text = view.finalizationAvailabilityText?.("2026-09-05T12:00:00.000Z");
    assert.match(text ?? "", /can be finalized after/);
    assert.doesNotMatch(text ?? "", /finalizationAllowedAt/);
    assert.equal(view.finalizationAvailabilityText?.(null), null);
  });

  await check("punch times display in local words", () => {
    assert.equal(view.punchTimeLabel?.("2026-09-05T04:20:00.000Z"), "10:20 AM");
    assert.equal(view.punchTimeLabel?.(null), "—");
  });

  await check("daily page delegates to the attendance workspace", () => {
    assert.match(pageSource, /AttendanceWorkspace/);
  });

  await check("workspace shell keeps the daily panel pluggable", () => {
    assert.match(workspaceSource, /DailyAttendancePanel/);
  });

  await check("daily filters offer date, department, and search", () => {
    assert.match(panelSource, /type="date"/);
    assert.match(panelSource, /Department/);
    assert.match(panelSource, /Search/);
  });

  await check("summary chips show all five day counters", () => {
    for (const label of ["Expected", "Present", "Late", "Pending", "Incomplete"]) {
      assert.match(panelSource, new RegExp(label));
    }
  });

  await check("grid keeps the approved operational columns", () => {
    for (const label of ["Employee", "Expected", "Check In", "Check Out", "Status", "Action"]) {
      assert.match(panelSource, new RegExp(`>${label}<`));
    }
  });

  await check("row component supports table and card presentations", () => {
    assert.match(rowSource, /variant\s*[:=]/);
    assert.match(panelSource, /hidden[^"\n]*sm:block|hidden[^"\n]*sm:table/);
    assert.match(panelSource, /sm:hidden/);
  });

  await check("mobile cards keep readable labels", () => {
    assert.match(rowSource, /Check In/);
    assert.match(rowSource, /Check Out/);
    assert.match(rowSource, /Status/);
  });

  await check("discard entry uses the confirmation dialog", () => {
    assert.match(uiSources, /Discard Entry/);
    assert.match(workspaceSource, /ConfirmationDialog/);
  });

  await check("finalize day is gated behind the dialog and availability", () => {
    assert.match(uiSources, /Finalize Day/);
    assert.match(workspaceSource, /ConfirmationDialog/);
    assert.match(workspaceSource, /canFinalizeNow/);
    assert.match(workspaceSource, /finalizationAvailabilityText/);
  });

  await check("stale conflicts surface an explicit review message", () => {
    assert.match(workspaceSource, /changed after this page loaded/);
    assert.match(workspaceSource, /review and try again/);
  });

  await check("needs review area surfaces stranded drafts", () => {
    assert.match(panelSource, /Needs review/);
    assert.match(panelSource, /discard/i);
  });

  await check("finalized days disable editing clearly", () => {
    assert.match(panelSource, /finalized/i);
    assert.match(panelSource, /disabled/);
  });

  await check("users enter only actual attendance times", () => {
    assert.doesNotMatch(uiSources, /Office Time|Office Hours/i);
  });

  await check("employee presentation stays privacy-safe", () => {
    assert.match(rowSource, /employeeCode/);
    assert.match(rowSource, /fullName/);
    assert.match(rowSource, /department/);
    assert.doesNotMatch(rowSource, /nationalId|dateOfBirth|personalEmail|emergencyContact|mobileNumber|bankName/i);
  });

  await check("expected is not derived from active employee counts", () => {
    assert.doesNotMatch(panelSource, /isActive/);
    assert.doesNotMatch(workspaceSource, /isActive/);
  });

  await check("statuses always include text through badges", () => {
    assert.match(rowSource, /StatusBadge/);
    assert.match(rowSource, /statusLabel/);
  });

  await check("controls keep accessible labels and disabled states", () => {
    assert.match(rowSource, /aria-label/);
    assert.match(panelSource, /disabled/);
  });

  await check("touch targets use the shared button styles", () => {
    assert.match(uiSources, /buttonClassName|<Button/);
  });

  await check("daily panel data flows through the typed attendance client", () => {
    assert.match(workspaceSource, /from "@\/lib\/attendance-api"/);
    assert.match(workspaceSource, /getAttendanceDay/);
    assert.match(workspaceSource, /saveAttendanceEntries/);
    assert.match(workspaceSource, /discardAttendanceEntry/);
    assert.match(workspaceSource, /finalizeAttendanceDay/);
  });

  await check("user-facing copy never leaks internal terminology", () => {
    for (const text of renderedTexts(uiSources)) {
      for (const term of FORBIDDEN_UI_TERMS) {
        assert.ok(!text.includes(term), `rendered copy leaks "${term}": ${text}`);
      }
    }
  });

  await check("display helpers never render internal terminology", () => {
    for (const text of renderedTexts(viewSource)) {
      for (const term of FORBIDDEN_UI_TERMS) {
        assert.ok(!text.includes(term), `display helper copy leaks "${term}": ${text}`);
      }
    }
  });

  await check("display helpers make no api calls and hold no react state", () => {
    assert.doesNotMatch(viewSource, /\bfetch\b|useState|useEffect|useMemo|useCallback/);
  });

  const { readdir } = await import("node:fs/promises");
  await check("attendance directory holds exactly the approved files", async () => {
    const files = (await readdir(attendanceDir)).sort();
    assert.deepEqual(files, [
      "attendance-day-row.tsx",
      "attendance-history-detail.tsx",
      "attendance-view.ts",
      "attendance-workspace.tsx",
      "daily-attendance-panel.tsx",
      "history-panel.tsx",
      "page.tsx",
      "settings-calendar-panel.tsx",
      "settings-rules-panel.tsx",
    ]);
  });
}

const HISTORY_FORBIDDEN_TERMS = [
  ...FORBIDDEN_UI_TERMS,
  "workScheduleAssignmentId",
  "AttendanceRecordId",
  "Prisma",
  "SQL",
];

function stripImports(source: string): string {
  return source
    .replace(/^import\s*["'][^"']+["'];?\s*$/gm, "")
    .replace(/^import[\s\S]*?from\s*["'][^"']+["'];?\s*$/gm, "");
}

async function verifyHistoryUi(root: string) {
  const attendanceDir = path.join(root, "apps/web/src/app/app/employees/attendance");
  const panelSource = await readFile(path.join(attendanceDir, "history-panel.tsx"), "utf8");
  const detailSource = await readFile(path.join(attendanceDir, "attendance-history-detail.tsx"), "utf8");
  const historySources = `${panelSource}\n${detailSource}`;
  const historyTexts = renderedTexts(stripImports(historySources));

  await check("history status labels are defined for every history state", () => {
    for (const branch of [
      'kind === "NOT_APPLICABLE") return "Not Applicable"',
      'presenceState === "NOT_REQUIRED") return "Not Required"',
      'presenceState === "ABSENT") return "Absent"',
      'presenceState === "INCOMPLETE") return "Incomplete"',
      'isNonWorkingDayAttendance) return "Present · Non-working Day"',
      'isLate) return "Present · Late"',
      'isEarlyLeave) return "Present · Early Leave"',
      'return "Present"',
    ]) {
      assert.ok(detailSource.includes(branch), `missing history status branch: ${branch}`);
    }
  });

  await check("Not Applicable is never presented as Absent", () => {
    assert.match(detailSource, /kind === "NOT_APPLICABLE"\)\s*return "Not Applicable"/);
    assert.match(detailSource, /presenceState === "ABSENT"\)\s*return "Absent"/);
  });

  await check("history list offers From and To date filters", () => {
    assert.match(panelSource, /label="From date"/);
    assert.match(panelSource, /label="To date"/);
    assert.match(panelSource, /type="date"/);
  });

  await check("history list offers employee, department, and status filters", () => {
    assert.match(panelSource, /label="Employee"/);
    assert.match(panelSource, /label="Department"/);
    assert.match(panelSource, /label="Status"/);
  });

  await check("history status filter includes Not Applicable as a distinct option", () => {
    for (const option of ["PRESENT", "ABSENT", "INCOMPLETE", "NOT_REQUIRED", "NOT_APPLICABLE"]) {
      assert.match(panelSource, new RegExp(`value="${option}"`));
    }
    assert.match(panelSource, />Not Applicable</);
    assert.match(panelSource, />Absent</);
  });

  await check("history search is debounced and sent through the typed client", () => {
    assert.match(panelSource, /label="Search"/);
    assert.match(panelSource, /setAppliedSearch/);
    assert.match(panelSource, /search:\s*appliedSearch/);
  });

  await check("history reference data comes from the existing typed clients", () => {
    assert.match(panelSource, /getEmployees\(/);
    assert.match(panelSource, /getDepartments\(/);
  });

  await check("history list loads through the typed attendance client", () => {
    assert.match(panelSource, /getAttendanceHistory\(/);
  });

  await check("history rows offer a detail action", () => {
    assert.match(panelSource, /View History/);
    assert.match(panelSource, /setSelected\(/);
  });

  await check("history list stays responsive with stacked cards on mobile", () => {
    assert.match(panelSource, /hidden[^"\n]*sm:block|hidden[^"\n]*sm:table/);
    assert.match(panelSource, /sm:hidden/);
  });

  await check("Path B explains the missing-record purpose", () => {
    assert.match(panelSource, /missing attendance record/i);
  });

  await check("Path B submits through the correction route with a null token internally", () => {
    assert.match(panelSource, /correctAttendance\(/);
    assert.match(panelSource, /expectedRevisionNo:\s*null/);
  });

  await check("Path B concurrent-create conflict copy is explicit", () => {
    assert.match(panelSource, /An attendance record was created while this form was open/);
  });

  await check("Path B requires employee, date, and reason before submission", () => {
    assert.match(panelSource, /Select an employee and a business date/);
    assert.match(panelSource, /Change reason is required/);
  });

  await check("history detail loads through the typed client", () => {
    assert.match(detailSource, /getAttendanceHistoryDetail\(/);
  });

  await check("timeline shows when, who, reason, and punches", () => {
    assert.match(detailSource, /recordedAtLabel/);
    assert.match(detailSource, /createdByName/);
    assert.match(detailSource, /changeReason/);
    assert.match(detailSource, /punchTimeLabel/);
  });

  await check("timeline follows the API order without re-sorting", () => {
    assert.doesNotMatch(detailSource, /\.sort\(/);
  });

  await check("Path A edits only user-editable correction facts", () => {
    assert.match(detailSource, /label="Check In"/);
    assert.match(detailSource, /label="Check Out"/);
    assert.match(detailSource, /label="Note"/);
    assert.match(detailSource, /label="Change reason"/);
    assert.doesNotMatch(
      detailSource,
      /expectedDayKind|lateGraceMinutes|earlyLeaveGraceMinutes|scheduledStartMinute|scheduledEndMinute|attendancePolicyId|calendarExceptionId/,
    );
  });

  await check("Path A uses the latest internal token for the request only", () => {
    assert.match(detailSource, /expectedRevisionNo:\s*latest\.revisionNo/);
  });

  await check("Path A stale conflicts reload with clear copy", () => {
    assert.match(detailSource, /changed after you opened it/);
  });

  await check("Mark Attendance Not Applicable is offered for applicable entries", () => {
    assert.match(detailSource, /Mark Attendance Not Applicable/);
  });

  await check("Path V explains the eligibility proof requirement", () => {
    assert.match(detailSource, /only valid when the employee/);
    assert.match(detailSource, /joining or separation/);
  });

  await check("Path V uses the confirmation dialog and the dedicated client call", () => {
    assert.match(detailSource, /ConfirmationDialog/);
    assert.match(detailSource, /markAttendanceNotApplicable\(/);
  });

  await check("void entries explain that recorded history remains", () => {
    assert.match(detailSource, /remain in the history/);
  });

  await check("restore is offered for Not Applicable entries", () => {
    assert.match(detailSource, /Restore Attendance/);
    assert.match(detailSource, /isAttendanceApplicable === false/);
  });

  await check("restore keeps blank punches to preserve recorded times", () => {
    assert.match(detailSource, /blank to keep/);
  });

  await check("all correction flows require a change reason", () => {
    const requiredReasonFields = detailSource.match(/label="Change reason" required/g) ?? [];
    assert.equal(requiredReasonFields.length, 3);
  });

  await check("punch editing uses HH:mm time controls", () => {
    assert.match(detailSource, /type="time"/);
  });

  await check("no delete or reopen actions exist", () => {
    assert.doesNotMatch(historySources, /Delete|Reopen|Remove History/);
  });

  await check("history copy never leaks internal terminology", () => {
    for (const text of historyTexts) {
      for (const term of HISTORY_FORBIDDEN_TERMS) {
        assert.ok(!text.includes(term), `history copy leaks "${term}": ${text}`);
      }
      assert.ok(!/\bRevision\s+\d/.test(text), `history copy displays revision numbers: ${text}`);
      assert.ok(!/\bRevision ID\b/i.test(text), `history copy displays revision identifiers: ${text}`);
      assert.ok(!/\bExpected revision\b/i.test(text), `history copy displays revision tokens: ${text}`);
    }
  });

  await check("history presentation never exposes employee PII", () => {
    for (const text of historyTexts) {
      assert.ok(
        !/national id|date of birth|personal email|emergency contact|\bsalary\b|\bbank\b|\bnid\b/i.test(text),
        `history copy exposes employee PII: ${text}`,
      );
    }
  });

  await check("history keeps only the approved employee projection", () => {
    assert.match(panelSource, /employeeCode/);
    assert.match(panelSource, /fullName/);
    assert.match(detailSource, /department/);
  });

  await check("detail provides loading, missing, and failure states", () => {
    assert.match(detailSource, /LoadingPanel/);
    assert.match(detailSource, /was not found/);
    assert.match(detailSource, /Notice/);
  });

  await check("detail refreshes the list after corrections", () => {
    assert.match(panelSource, /onChanged=/);
    assert.match(detailSource, /onChanged\(\)/);
  });

  await check("unfinalized dates explain that corrections wait for finalization", () => {
    assert.match(detailSource, /not finalized yet/i);
  });
}

const SETTINGS_FORBIDDEN_TERMS = [
  ...HISTORY_FORBIDDEN_TERMS,
  "replacesPolicyId",
];

async function verifySettingsUi(root: string) {
  const attendanceDir = path.join(root, "apps/web/src/app/app/employees/attendance");
  const workspaceSource = await readFile(path.join(attendanceDir, "attendance-workspace.tsx"), "utf8");
  const rulesSource = await readFile(path.join(attendanceDir, "settings-rules-panel.tsx"), "utf8");
  const calendarSource = await readFile(path.join(attendanceDir, "settings-calendar-panel.tsx"), "utf8");
  const settingsSources = `${rulesSource}\n${calendarSource}`;
  const settingsTexts = renderedTexts(stripImports(settingsSources));

  await check("workspace activates the History panel", () => {
    assert.match(workspaceSource, /import \{ HistoryPanel \} from "\.\/history-panel"/);
    assert.match(workspaceSource, /activeTab === "history" \? <HistoryPanel \/> : null/);
  });

  await check("workspace activates both Settings panels", () => {
    assert.match(workspaceSource, /import \{ SettingsRulesPanel \} from "\.\/settings-rules-panel"/);
    assert.match(workspaceSource, /import \{ SettingsCalendarPanel \} from "\.\/settings-calendar-panel"/);
    assert.match(workspaceSource, /activeTab === "settings"/);
    assert.match(workspaceSource, /<SettingsRulesPanel \/>/);
    assert.match(workspaceSource, /<SettingsCalendarPanel \/>/);
  });

  await check("workspace keeps the Daily panel as the default tab", () => {
    assert.match(workspaceSource, /useState<AttendanceTab>\("daily"\)|useState\("daily"\)/);
    assert.match(workspaceSource, /activeTab === "daily"/);
    assert.match(workspaceSource, /DailyAttendancePanel/);
  });

  await check("workspace tabs switch without disabled placeholders", () => {
    assert.doesNotMatch(workspaceSource, /<Button disabled[^>]*>\s*History/);
    assert.doesNotMatch(workspaceSource, /<Button disabled[^>]*>\s*Settings/);
    assert.match(workspaceSource, /setActiveTab\("history"\)/);
    assert.match(workspaceSource, /setActiveTab\("settings"\)/);
    assert.match(workspaceSource, /setActiveTab\("daily"\)/);
  });

  await check("rules panel loads policies through the typed client", () => {
    assert.match(rulesSource, /getAttendancePolicies\(/);
  });

  await check("initial rules creation requires accountant input", () => {
    assert.match(rulesSource, /createInitialAttendancePolicy\(/);
    assert.match(rulesSource, /label="Effective from"/);
    assert.match(rulesSource, /label="Late grace \(minutes\)"/);
    assert.match(rulesSource, /label="Early leave grace \(minutes\)"/);
    assert.doesNotMatch(rulesSource, /useState\("(?:15|10)"\)/);
    assert.doesNotMatch(rulesSource, /value=\{(?:15|10)\}/);
  });

  await check("initial creation is only offered when no rules exist yet", () => {
    assert.match(rulesSource, /no Attendance Rules|no Attendance Rules are configured|initialPolicyAvailable|No Attendance Rules/);
  });

  await check("replace rules is a distinct action with required reason", () => {
    assert.match(rulesSource, /Replace Rules/);
    assert.match(rulesSource, /replaceAttendancePolicy\(/);
    const reasonFields = rulesSource.match(/label="Change reason" required/g) ?? [];
    assert.equal(reasonFields.length, 1);
  });

  await check("cancel future rules uses the dialog and dedicated call", () => {
    assert.match(rulesSource, /Cancel Future Rules/);
    assert.match(rulesSource, /cancelFutureAttendancePolicy\(/);
    assert.match(rulesSource, /ConfirmationDialog/);
    const cancelReasonFields = rulesSource.match(/label="Cancellation reason" required/g) ?? [];
    assert.equal(cancelReasonFields.length, 1);
  });

  await check("cancel future rules is offered only for future versions", () => {
    assert.match(rulesSource, /effectiveFrom\.slice\(0, 10\) > today|isFuture/);
  });

  await check("initial-vs-replacement conflict copy is user-facing", () => {
    assert.match(rulesSource, /already exist\. Use Replace Rules/i);
  });

  await check("rules presentation stays human-readable without lineage IDs", () => {
    assert.match(rulesSource, /formatEffectivePeriod|Effective/);
    assert.match(rulesSource, /grace/i);
    assert.doesNotMatch(rulesSource, /"Current"|policy\.id}/);
  });

  await check("calendar panel loads exceptions through the typed client", () => {
    assert.match(calendarSource, /getCalendarExceptions\(/);
    assert.match(calendarSource, /createCalendarException\(/);
    assert.match(calendarSource, /updateCalendarException\(/);
    assert.match(calendarSource, /cancelCalendarException\(/);
    assert.match(calendarSource, /historicalCalendarCorrect\(/);
  });

  await check("calendar create supports holiday and special working day", () => {
    assert.match(calendarSource, /value="HOLIDAY"/);
    assert.match(calendarSource, /value="SPECIAL_WORKING_DAY"/);
    assert.match(calendarSource, />Holiday</);
    assert.match(calendarSource, />Special Working Day</);
  });

  await check("calendar forms use HH:mm controls without minute terminology", () => {
    assert.match(calendarSource, /type="time"/);
    assert.match(calendarSource, /minuteLabel\(|toMinutes\(/);
  });

  await check("holiday creation skips working-time inputs", () => {
    assert.match(calendarSource, /exceptionType === "HOLIDAY"/);
  });

  await check("calendar cancel uses the dialog with a required reason", () => {
    assert.match(calendarSource, /Cancel Exception/);
    assert.match(calendarSource, /ConfirmationDialog/);
    const cancelReasonFields = calendarSource.match(/label="Cancellation reason" required/g) ?? [];
    assert.equal(cancelReasonFields.length, 1);
  });

  await check("historical calendar correction is a separate action", () => {
    assert.match(calendarSource, /Correct Historical Calendar/);
    assert.match(calendarSource, /label="Change reason" required/);
    assert.match(calendarSource, /value="NONE"/);
    assert.match(calendarSource, />None — return to normal schedule</);
  });

  await check("historical correction shows the explicit warning", () => {
    assert.match(calendarSource, /This changes the historical calendar interpretation for a finalized attendance date/);
    assert.match(calendarSource, /re-evaluated/);
    assert.match(calendarSource, /Existing history is not deleted/);
  });

  await check("historical correction result summary uses the API count", () => {
    assert.match(calendarSource, /attendanceRevisionsCreated/);
    assert.match(calendarSource, /re-evaluated/);
  });

  await check("finalized ordinary calendar edits get controlled guidance", () => {
    assert.match(calendarSource, /historical correction/i);
  });

  await check("settings panels keep responsive stacked layouts", () => {
    assert.match(settingsSources, /sm:grid-cols|sm:flex-row/);
    assert.match(settingsSources, /flex flex-col/);
  });

  await check("settings panels provide loading and error states", () => {
    assert.match(rulesSource, /LoadingPanel/);
    assert.match(calendarSource, /LoadingPanel/);
    assert.match(rulesSource, /Notice/);
    assert.match(calendarSource, /Notice/);
  });

  await check("settings copy never leaks internal terminology", () => {
    for (const text of settingsTexts) {
      for (const term of SETTINGS_FORBIDDEN_TERMS) {
        assert.ok(!text.includes(term), `settings copy leaks "${term}": ${text}`);
      }
    }
  });

  await check("settings copy never renders identifiers or PII", () => {
    for (const text of settingsTexts) {
      assert.ok(!/national id|date of birth|personal email|emergency contact|\bnid\b/i.test(text), `settings copy exposes PII: ${text}`);
    }
  });
}

async function verifyEmployeesEntryLink(root: string) {
  const employeesPageSource = await readFile(
    path.join(root, "apps/web/src/app/app/employees/page.tsx"),
    "utf8",
  );

  await check("employees page links to the Attendance workspace", () => {
    assert.match(employeesPageSource, /href="\/app\/employees\/attendance"/);
    assert.match(employeesPageSource, /ClipboardCheck/);
    assert.match(employeesPageSource, /Work Schedule Settings/);
  });
}

void main();
