import { execFileSync } from "node:child_process";
import net from "node:net";
import { attendanceDateLockKey } from "../apps/api/src/attendance/attendance-lock";
import { buildDhakaInstant } from "../apps/api/src/attendance/attendance-time";
import { AttendanceCalendarService } from "../apps/api/src/attendance/attendance-calendar.service";
import { AttendanceCorrectionService } from "../apps/api/src/attendance/attendance-correction.service";
import type { CorrectionResultView } from "../apps/api/src/attendance/attendance-correction.service";
import { AttendanceDayService } from "../apps/api/src/attendance/attendance-day.service";
import { AttendanceExpectationService } from "../apps/api/src/attendance/attendance-expectation.service";
import { AttendanceFinalizationService } from "../apps/api/src/attendance/attendance-finalization.service";
import type { FinalizeAttendanceDayResult } from "../apps/api/src/attendance/attendance-finalization.service";
import { AttendancePolicyService } from "../apps/api/src/attendance/attendance-policy.service";
import type { AttendancePolicyView } from "../apps/api/src/attendance/attendance-policy.service";
import type { AuthenticatedUser } from "../apps/api/src/auth/auth.types";
import { DayOfWeek, WorkScheduleAssignmentScope } from "../apps/api/src/generated/prisma/client";
import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import { WorkScheduleService } from "../apps/api/src/work-schedule/work-schedule.service";
import { assertAttendanceScratchDatabase, verificationPg, type VerificationPg } from "./attendance-verification";

const SCRATCH_URL = "postgresql://hr2c:hr2c-scratch@127.0.0.1:55496/hr2c?schema=public";
const CONTAINER = "hr2c-conc";
const SCRATCH_PORT = 55496;
const HR2C_MIGRATION_SHA256 = "0afd557f7f6ec5d1c5458b60c6d2f4fa42a28e6cc75d2d2b55758929dc927d2c";
const RACE_TIMEOUT_MS = 60_000;
const SENSITIVE_PATTERN = /prisma|postgres|sqlstate|constraint|duplicate key|relation "|pg_|stack|SELECT |INSERT |UPDATE |DELETE FROM|WHERE /i;

const COMPANY_ID = "hr2c-conc-co";
const USER_ID = "hr2c-conc-u";
const POLICY_BASE = "hr2c-conc-pol0";
const SCHEDULE_ID = "hr2c-conc-ws";
const ASSIGNMENT_ID = "hr2c-conc-wsa";
const USER: AuthenticatedUser = {
  id: USER_ID,
  email: "hr2c-conc@example.invalid",
  fullName: "HR2C Concurrency Verifier",
  roles: [{ code: "ACCOUNTANT", name: "Accountant" }],
};
const E = {
  a1: "hr2c-conc-e1",
  a2: "hr2c-conc-e2",
  a3: "hr2c-conc-e3",
  a4: "hr2c-conc-e4",
  a5: "hr2c-conc-e5",
  a10: "hr2c-conc-e10",
  e8: "hr2c-conc-e8",
};
const D = {
  d02: "2026-09-02",
  d03: "2026-09-03",
  d04: "2026-09-04",
  d05: "2026-09-05",
  d10: "2026-09-10",
  d11: "2026-09-11",
};

type HttpExceptionLike = { getStatus(): number; getResponse(): string | object };

function isHttpException(error: unknown): error is HttpExceptionLike {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { getStatus?: unknown; getResponse?: unknown };
  return typeof candidate.getStatus === "function" && typeof candidate.getResponse === "function";
}

type Failure = { ok: false; status: number; message: string; body: string; error: unknown };
type Outcome<T> = { ok: true; value: T } | Failure;

type ActorStack = {
  prisma: PrismaService;
  days: AttendanceDayService;
  finalize: AttendanceFinalizationService;
  corrections: AttendanceCorrectionService;
  calendar: AttendanceCalendarService;
  policies: AttendancePolicyService;
};

type Harness = {
  admin: ActorStack;
  actorA: ActorStack;
  actorB: ActorStack;
  monitor: VerificationPg;
  holder: VerificationPg;
  prober: VerificationPg;
};

let passed = 0;
let failed = 0;
let harness: Harness | undefined;
let containerStarted = false;

function check(name: string, ok: boolean, detail = ""): boolean {
  if (ok) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}${detail ? ` ${detail}` : ""}`);
  }
  return ok;
}

const sleep = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(inner => { resolve = inner; });
  return { promise, resolve };
}

function day(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function instant(businessDate: string, localTime: string): Date {
  return buildDhakaInstant(businessDate, { hours: Number(localTime.slice(0, 2)), minutes: Number(localTime.slice(3, 5)) });
}

async function attempt<T>(run: () => Promise<T>): Promise<Outcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    if (isHttpException(error)) {
      const response: unknown = error.getResponse();
      const message = typeof response === "string"
        ? response
        : String((response as { message?: unknown }).message ?? "");
      return { ok: false, status: error.getStatus(), message, body: JSON.stringify(response ?? {}), error };
    }
    return { ok: false, status: -1, message: error instanceof Error ? error.message : String(error), body: "", error };
  }
}

function checkControlled(label: string, failure: Failure, pattern: RegExp, allowed: readonly number[] = [409]): boolean {
  const leakFree = !SENSITIVE_PATTERN.test(failure.message) && !SENSITIVE_PATTERN.test(failure.body);
  return check(
    `${label} is a controlled rejection`,
    allowed.includes(failure.status) && pattern.test(failure.message) && leakFree,
    `status=${failure.status} message="${failure.message}"`,
  );
}

function checkNoLeak(label: string, failure: Failure): boolean {
  return check(
    `${label} exposes no database internals`,
    !SENSITIVE_PATTERN.test(failure.message) && !SENSITIVE_PATTERN.test(failure.body),
    `status=${failure.status} message="${failure.message}"`,
  );
}

function oneWinner<TA, TB>(a: Outcome<TA>, b: Outcome<TB>): "a" | "b" | "both" | "none" {
  if (a.ok && b.ok) return "both";
  if (!a.ok && !b.ok) return "none";
  return a.ok ? "a" : "b";
}

class Barrier {
  readonly opened: Promise<void>;
  readonly allArmed: Promise<void>;
  private readonly size: number;
  private armed = 0;
  private openResolve!: () => void;
  private allArmedResolve!: () => void;

  constructor(size: number) {
    this.size = size;
    this.opened = new Promise(resolve => { this.openResolve = resolve; });
    this.allArmed = new Promise(resolve => { this.allArmedResolve = resolve; });
  }

  arm(): void {
    this.armed += 1;
    if (this.armed >= this.size) this.allArmedResolve();
  }

  release(): void {
    this.openResolve();
  }
}

async function terminateScratchBackends(): Promise<void> {
  if (harness === undefined) return;
  try {
    await harness.monitor.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'hr2c' AND pid <> pg_backend_pid()");
  } catch {
    return;
  }
}

async function runRace<TA, TB>(
  name: string,
  timeoutMs: number,
  actorAFn: () => Promise<TA>,
  actorBFn: () => Promise<TB>,
): Promise<{ a: Outcome<TA>; b: Outcome<TB>; watchdogFired: boolean }> {
  const barrier = new Barrier(2);
  const runActor = <T>(operation: () => Promise<T>): Promise<Outcome<T>> =>
    attempt(async () => {
      barrier.arm();
      await barrier.opened;
      return operation();
    });
  const a = runActor(actorAFn);
  const b = runActor(actorBFn);
  await barrier.allArmed;
  barrier.release();
  let watchdogFired = false;
  let watchdogTimer: NodeJS.Timeout | undefined;
  const watchdog = new Promise<void>(resolve => {
    watchdogTimer = setTimeout(() => { watchdogFired = true; resolve(); }, timeoutMs);
  });
  await Promise.race([Promise.all([a, b]), watchdog]);
  if (watchdogTimer !== undefined) clearTimeout(watchdogTimer);
  if (watchdogFired) {
    console.error(`WATCHDOG ${name}: blocking detected; terminating scratch backends to settle the race`);
    await terminateScratchBackends();
    await Promise.race([Promise.all([a, b]), sleep(15_000)]);
    check(`${name} settles without watchdog termination`, false, "watchdog fired");
  }
  return { a: await a, b: await b, watchdogFired };
}

function buildStack(): ActorStack {
  const prisma = new PrismaService();
  const workSchedules = new WorkScheduleService(prisma);
  const expectations = new AttendanceExpectationService(prisma, workSchedules);
  return {
    prisma,
    days: new AttendanceDayService(prisma, expectations),
    finalize: new AttendanceFinalizationService(prisma, expectations),
    corrections: new AttendanceCorrectionService(prisma, expectations),
    calendar: new AttendanceCalendarService(prisma, expectations),
    policies: new AttendancePolicyService(prisma),
  };
}

async function backendPid(stack: ActorStack): Promise<number> {
  const rows = await stack.prisma.$queryRaw<Array<{ pid: number | bigint }>>`SELECT pg_backend_pid() AS pid`;
  return Number(rows[0]?.pid ?? 0);
}

function requireHarness(label: string): Harness {
  if (harness === undefined) throw new Error(`${label} requires an initialized harness.`);
  return harness;
}

async function assertIndependentBackends(label: string): Promise<void> {
  const current = harness;
  if (current === undefined) return;
  const [pidA, pidB] = await Promise.all([backendPid(current.actorA), backendPid(current.actorB)]);
  check(`${label} runs on independent database backends`, pidA > 0 && pidB > 0 && pidA !== pidB, `pidA=${pidA} pidB=${pidB}`);
}

async function latestRevision(h: Harness, employeeId: string, businessDate: string) {
  const record = await h.admin.prisma.attendanceRecord.findFirst({
    where: { employeeId, businessDate: day(businessDate) },
    include: { revisions: { orderBy: { revisionNo: "desc" } } },
  });
  return record?.revisions[0] ?? null;
}

async function draftToken(h: Harness, employeeId: string, businessDate: string): Promise<string> {
  const record = await h.admin.prisma.attendanceRecord.findFirstOrThrow({
    where: { employeeId, businessDate: day(businessDate) },
    include: { revisions: { where: { finalizedAt: null } } },
  });
  const draft = record.revisions[0] ?? null;
  if (!draft) throw new Error(`No draft revision exists for ${employeeId} on ${businessDate}.`);
  return draft.updatedAt.toISOString();
}

async function countMarkers(h: Harness, businessDate: string): Promise<number> {
  return h.admin.prisma.attendanceDayFinalization.count({ where: { companyId: COMPANY_ID, businessDate: day(businessDate) } });
}

async function countUnfinalizedOnDate(h: Harness, businessDate: string): Promise<number> {
  return h.admin.prisma.attendanceRevision.count({
    where: { finalizedAt: null, attendanceRecord: { companyId: COMPANY_ID, businessDate: day(businessDate) } },
  });
}

async function recordWithRevisions(h: Harness, employeeId: string, businessDate: string) {
  return h.admin.prisma.attendanceRecord.findFirst({
    where: { employeeId, businessDate: day(businessDate) },
    include: { revisions: { orderBy: { revisionNo: "desc" } } },
  });
}

function week() {
  const working = (dayOfWeek: DayOfWeek) => ({ dayOfWeek, isWorkingDay: true, startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60, crossesMidnight: false });
  return [
    working(DayOfWeek.MONDAY),
    working(DayOfWeek.TUESDAY),
    working(DayOfWeek.WEDNESDAY),
    working(DayOfWeek.THURSDAY),
    { dayOfWeek: DayOfWeek.FRIDAY, isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false },
    working(DayOfWeek.SATURDAY),
    working(DayOfWeek.SUNDAY),
  ];
}

async function seedBase(h: Harness): Promise<void> {
  await h.admin.prisma.company.create({ data: { id: COMPANY_ID, name: "HR2C Concurrency Verification Company" } });
  await h.admin.prisma.user.create({ data: { id: USER_ID, email: "hr2c-conc@example.invalid", fullName: "HR2C Concurrency Verifier", passwordHash: "not-a-real-hash" } });
  const employees = [
    { id: E.a1, employeeCode: "HR2CC01", fullName: "R1 Employee" },
    { id: E.a2, employeeCode: "HR2CC02", fullName: "R2 Employee" },
    { id: E.a3, employeeCode: "HR2CC03", fullName: "R3 Employee" },
    { id: E.a4, employeeCode: "HR2CC04", fullName: "R4 Employee" },
    { id: E.a5, employeeCode: "HR2CC05", fullName: "R5 Employee" },
    { id: E.a10, employeeCode: "HR2CC06", fullName: "R10 Employee" },
  ];
  for (const employee of employees) {
    await h.admin.prisma.employee.create({
      data: { id: employee.id, employeeCode: employee.employeeCode, fullName: employee.fullName, designation: "Verification", joiningDate: day("2026-01-01") },
    });
  }
  await h.admin.prisma.workSchedule.create({
    data: { id: SCHEDULE_ID, companyId: COMPANY_ID, code: "HR2CCWS", name: "HR2C Concurrency Schedule", createdById: USER_ID, days: { create: week() } },
  });
  await h.admin.prisma.workScheduleAssignment.create({
    data: {
      id: ASSIGNMENT_ID,
      companyId: COMPANY_ID,
      scope: WorkScheduleAssignmentScope.COMPANY_DEFAULT,
      workScheduleId: SCHEDULE_ID,
      employeeId: null,
      effectiveFrom: day("2026-08-01"),
      effectiveTo: null,
      createdById: USER_ID,
    },
  });
  await h.admin.prisma.attendancePolicy.create({
    data: { id: POLICY_BASE, companyId: COMPANY_ID, effectiveFrom: day("2026-08-01"), effectiveTo: null, lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10, createdById: USER_ID },
  });
}

async function race1(): Promise<void> {
  const h = requireHarness("R1");
  await assertIndependentBackends("R1");
  const { a, b } = await runRace("R1", RACE_TIMEOUT_MS,
    () => h.actorA.days.saveEntries(COMPANY_ID, { businessDate: D.d02, entries: [{ employeeId: E.a1, checkInLocalTime: "10:00", checkOutLocalTime: "18:00", note: "r1-a" }] }, USER),
    () => h.actorB.days.saveEntries(COMPANY_ID, { businessDate: D.d02, entries: [{ employeeId: E.a1, checkInLocalTime: "11:00", checkOutLocalTime: "19:00", note: "r1-b" }] }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R1 exactly one first-draft create wins", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    checkControlled("R1 losing first-draft create", (outcome === "a" ? b : a) as Failure, /changed after this page loaded|already exists|changed concurrently/, [400, 409]);
    const record = await recordWithRevisions(h, E.a1, D.d02);
    check(
      "R1 exactly one record with exactly one draft revision",
      record !== null && record.revisions.length === 1 && record.revisions[0].revisionNo === 1 && record.revisions[0].finalizedAt === null,
    );
    const winnerCheckIn = instant(D.d02, outcome === "a" ? "10:00" : "11:00");
    const winnerCheckOut = instant(D.d02, outcome === "a" ? "18:00" : "19:00");
    check(
      "R1 winner punches persisted",
      record !== null && record.revisions[0].checkInAt?.toISOString() === winnerCheckIn.toISOString() &&
        record.revisions[0].checkOutAt?.toISOString() === winnerCheckOut.toISOString(),
    );
  }
}

async function race2(): Promise<void> {
  const h = requireHarness("R2");
  await assertIndependentBackends("R2");
  const setup = await attempt(() => h.admin.days.saveEntries(COMPANY_ID, { businessDate: D.d02, entries: [{ employeeId: E.a2, checkInLocalTime: "10:00", checkOutLocalTime: "18:00" }] }, USER));
  if (!check("R2 setup draft created", setup.ok)) return;
  const token = await draftToken(h, E.a2, D.d02);
  const { a, b } = await runRace("R2", RACE_TIMEOUT_MS,
    () => h.actorA.days.saveEntries(COMPANY_ID, { businessDate: D.d02, entries: [{ employeeId: E.a2, checkInLocalTime: "09:30", checkOutLocalTime: "17:30", expectedUpdatedAt: token }] }, USER),
    () => h.actorB.days.saveEntries(COMPANY_ID, { businessDate: D.d02, entries: [{ employeeId: E.a2, checkInLocalTime: "09:45", checkOutLocalTime: "17:45", expectedUpdatedAt: token }] }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R2 exactly one bulk save wins the shared freshness token", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    checkControlled("R2 losing bulk save", (outcome === "a" ? b : a) as Failure, /changed after this page loaded|changed concurrently|already exists/);
    const record = await recordWithRevisions(h, E.a2, D.d02);
    const winnerCheckIn = instant(D.d02, outcome === "a" ? "09:30" : "09:45");
    check(
      "R2 single draft revision reflects the winner only",
      record !== null && record.revisions.length === 1 && record.revisions[0].finalizedAt === null &&
        record.revisions[0].checkInAt?.toISOString() === winnerCheckIn.toISOString(),
    );
    check("R2 freshness token rotated after the winning save", record !== null && record.revisions[0].updatedAt.toISOString() !== token);
  }
}

async function race3(): Promise<void> {
  const h = requireHarness("R3");
  await assertIndependentBackends("R3");
  const setup = await attempt(() => h.admin.days.saveEntries(COMPANY_ID, { businessDate: D.d02, entries: [{ employeeId: E.a3, checkInLocalTime: "10:00", checkOutLocalTime: "18:00" }] }, USER));
  if (!check("R3 setup draft created", setup.ok)) return;
  const token = await draftToken(h, E.a3, D.d02);
  const committed = deferred();
  const { a, b } = await runRace("R3", RACE_TIMEOUT_MS,
    async () => {
      const value = await h.actorA.days.saveEntries(COMPANY_ID, { businessDate: D.d02, entries: [{ employeeId: E.a3, checkInLocalTime: "09:20", checkOutLocalTime: "17:20", expectedUpdatedAt: token }] }, USER);
      committed.resolve();
      return value;
    },
    async () => {
      await committed.promise;
      return h.actorB.days.saveEntries(COMPANY_ID, { businessDate: D.d02, entries: [{ employeeId: E.a3, checkInLocalTime: "09:50", checkOutLocalTime: "17:50", expectedUpdatedAt: token }] }, USER);
    },
  );
  check("R3 committed update succeeds", a.ok, a.ok ? "" : `status=${a.status} message="${a.message}"`);
  if (!a.ok) return;
  check("R3 stale browser form rejected", !b.ok && b.status === 409 && /changed after this page loaded|changed concurrently/.test(b.message));
  if (!b.ok) checkNoLeak("R3 stale form rejection", b);
  const record = await recordWithRevisions(h, E.a3, D.d02);
  check(
    "R3 no stale overwrite of the committed update",
    record !== null && record.revisions.length === 1 && record.revisions[0].finalizedAt === null &&
      record.revisions[0].checkInAt?.toISOString() === instant(D.d02, "09:20").toISOString() &&
      record.revisions[0].checkOutAt?.toISOString() === instant(D.d02, "17:20").toISOString(),
  );
}

async function race4(): Promise<void> {
  const h = requireHarness("R4");
  await assertIndependentBackends("R4");
  const setup = await attempt(() => h.admin.days.saveEntries(COMPANY_ID, { businessDate: D.d03, entries: [{ employeeId: E.a4, checkInLocalTime: "10:00", checkOutLocalTime: "18:00" }] }, USER));
  if (!check("R4 setup draft created", setup.ok)) return;
  const token = await draftToken(h, E.a4, D.d03);
  const { a, b } = await runRace("R4", RACE_TIMEOUT_MS,
    () => h.actorA.days.saveEntries(COMPANY_ID, { businessDate: D.d03, entries: [{ employeeId: E.a4, checkInLocalTime: "10:05", checkOutLocalTime: "17:55", expectedUpdatedAt: token }] }, USER),
    () => h.actorB.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d03 }, USER),
  );
  check("R4 at least one actor commits under the attendance date lock", a.ok || b.ok);
  if (!a.ok) {
    check("R4 finalize-first ordering rejects the save as a controlled conflict", a.status === 409 && /already finalized|changed after this page loaded|changed concurrently/.test(a.message));
    checkNoLeak("R4 save rejection", a);
  }
  if (!b.ok) {
    check("R4 save-first ordering rejects the finalization as a controlled conflict", b.status === 409 && /already finalized|changed after this page loaded|changed concurrently/.test(b.message));
    checkNoLeak("R4 finalization rejection", b);
    const retry = await attempt(() => h.admin.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d03 }, USER));
    check("R4 finalization succeeds on retry after a lost race", retry.ok, retry.ok ? "" : `status=${retry.status} message="${retry.message}"`);
  }
  check("R4 exactly one finalization marker", (await countMarkers(h, D.d03)) === 1);
  check("R4 no unfinalized draft remains on the finalized date", (await countUnfinalizedOnDate(h, D.d03)) === 0);
  const latest = await latestRevision(h, E.a4, D.d03);
  check(
    "R4 final draft state reflects the committed save outcome",
    latest !== null && latest.finalizedAt !== null &&
      latest.checkInAt?.toISOString() === instant(D.d03, a.ok ? "10:05" : "10:00").toISOString(),
  );
}

async function race5(): Promise<void> {
  const h = requireHarness("R5");
  await assertIndependentBackends("R5");
  const setup = await attempt(() => h.admin.days.saveEntries(COMPANY_ID, { businessDate: D.d04, entries: [{ employeeId: E.a5, checkInLocalTime: "10:00", checkOutLocalTime: "18:00" }] }, USER));
  if (!check("R5 setup draft created", setup.ok)) return;
  const token = await draftToken(h, E.a5, D.d04);
  const { a, b } = await runRace("R5", RACE_TIMEOUT_MS,
    () => h.actorA.days.discardEntry(COMPANY_ID, { businessDate: D.d04, employeeId: E.a5, expectedUpdatedAt: token }, USER),
    () => h.actorB.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d04 }, USER),
  );
  check("R5 at least one actor commits under the attendance date lock", a.ok || b.ok);
  if (!a.ok) {
    check("R5 finalize-first ordering rejects the discard as a controlled conflict", a.status === 409 && /already finalized|changed after this page loaded|changed concurrently/.test(a.message));
    checkNoLeak("R5 discard rejection", a);
  }
  if (!b.ok) {
    check("R5 discard-first ordering rejects the finalization as a controlled conflict", b.status === 409 && /already finalized|changed after this page loaded|changed concurrently/.test(b.message));
    checkNoLeak("R5 finalization rejection", b);
    const retry = await attempt(() => h.admin.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d04 }, USER));
    check("R5 finalization succeeds on retry after a lost race", retry.ok, retry.ok ? "" : `status=${retry.status} message="${retry.message}"`);
  }
  check("R5 exactly one finalization marker", (await countMarkers(h, D.d04)) === 1);
  check("R5 no unfinalized revision remains on the finalized date", (await countUnfinalizedOnDate(h, D.d04)) === 0);
  const record = await recordWithRevisions(h, E.a5, D.d04);
  check(
    "R5 final state coherent for the discard-vs-finalize ordering",
    record !== null && record.revisions.length === 1 && record.revisions[0].finalizedAt !== null &&
      record.revisions[0].origin === (a.ok ? "SYSTEM_FINALIZATION" : "MANUAL_ENTRY"),
  );
  const latest = await latestRevision(h, E.a5, D.d04);
  check("R5 never discards destructively after finalization", latest !== null && latest.finalizedAt !== null);
}

async function race6(): Promise<void> {
  const h = requireHarness("R6");
  await assertIndependentBackends("R6");
  const { a, b } = await runRace("R6", RACE_TIMEOUT_MS,
    () => h.actorA.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d05 }, USER),
    () => h.actorB.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d05 }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R6 exactly one finalization wins", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    const winner = (outcome === "a" ? a : b) as { ok: true; value: FinalizeAttendanceDayResult };
    check("R6 winner returns the finalized summary", winner.value.finalizedAt instanceof Date);
    checkControlled("R6 losing finalization", (outcome === "a" ? b : a) as Failure, /already finalized|changed concurrently/);
  }
  check("R6 single day marker", (await countMarkers(h, D.d05)) === 1);
  const record = await recordWithRevisions(h, E.a10, D.d05);
  check(
    "R6 no duplicate final revisions",
    record !== null && record.revisions.length === 1 && record.revisions[0].revisionNo === 1 &&
      record.revisions[0].origin === "SYSTEM_FINALIZATION" && record.revisions[0].finalizedAt !== null,
  );
}

async function race7(): Promise<void> {
  const h = requireHarness("R7");
  await assertIndependentBackends("R7");
  let baseline = await latestRevision(h, E.a4, D.d03);
  if (baseline === null || baseline.finalizedAt === null) {
    const finalizeRetry = await attempt(() => h.admin.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d03 }, USER));
    if (finalizeRetry.ok) baseline = await latestRevision(h, E.a4, D.d03);
  }
  if (baseline === null || baseline.finalizedAt === null) {
    check("R7 baseline finalized revision exists", false);
    return;
  }
  check("R7 baseline finalized revision exists", true);
  const expectedRevisionNo = baseline.revisionNo;
  const { a, b } = await runRace("R7", RACE_TIMEOUT_MS,
    () => h.actorA.corrections.correctAttendance(COMPANY_ID, E.a4, D.d03, { expectedRevisionNo, changeReason: "r7-a", checkInLocalTime: "10:10", checkOutLocalTime: "18:00" }, USER),
    () => h.actorB.corrections.correctAttendance(COMPANY_ID, E.a4, D.d03, { expectedRevisionNo, changeReason: "r7-b", checkInLocalTime: "10:40", checkOutLocalTime: "18:00" }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R7 exactly one correction wins the shared revision token", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    const winner = (outcome === "a" ? a : b) as { ok: true; value: CorrectionResultView };
    check("R7 winner creates exactly revision N+1", winner.value.revisionNo === expectedRevisionNo + 1);
    checkControlled("R7 losing correction", (outcome === "a" ? b : a) as Failure, /changed after this page loaded|already exists|changed concurrently/);
    const successorCount = await h.admin.prisma.attendanceRevision.count({
      where: { attendanceRecord: { employeeId: E.a4, businessDate: day(D.d03) }, revisionNo: expectedRevisionNo + 1 },
    });
    check("R7 no duplicate N+1 revision", successorCount === 1);
    const latest = await latestRevision(h, E.a4, D.d03);
    check(
      "R7 latest revision reflects the winner",
      latest !== null && latest.revisionNo === expectedRevisionNo + 1 &&
        latest.checkInAt?.toISOString() === instant(D.d03, outcome === "a" ? "10:10" : "10:40").toISOString(),
    );
  }
}

async function race8(): Promise<void> {
  const h = requireHarness("R8");
  await h.admin.prisma.employee.create({
    data: { id: E.e8, employeeCode: "HR2CC07", fullName: "R8 Omitted Employee", designation: "Verification", joiningDate: day("2026-09-01") },
  });
  await assertIndependentBackends("R8");
  const { a, b } = await runRace("R8", RACE_TIMEOUT_MS,
    () => h.actorA.corrections.correctAttendance(COMPANY_ID, E.e8, D.d05, { expectedRevisionNo: null, changeReason: "r8-a", checkInLocalTime: "10:00", checkOutLocalTime: "16:00" }, USER),
    () => h.actorB.corrections.correctAttendance(COMPANY_ID, E.e8, D.d05, { expectedRevisionNo: null, changeReason: "r8-b", checkInLocalTime: "11:00", checkOutLocalTime: "17:00" }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R8 exactly one missing-record creation wins", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    const winner = (outcome === "a" ? a : b) as { ok: true; value: CorrectionResultView };
    check("R8 winner creates the record at revision 1", winner.value.revisionNo === 1 && winner.value.isAttendanceApplicable === true);
    checkControlled("R8 losing creation sees the post-lock existence", (outcome === "a" ? b : a) as Failure, /changed after this page loaded|already exists|changed concurrently/);
    const record = await recordWithRevisions(h, E.e8, D.d05);
    check(
      "R8 single record with a single finalized revision",
      record !== null && record.revisions.length === 1 && record.revisions[0].revisionNo === 1 &&
        record.revisions[0].finalizedAt !== null &&
        record.revisions[0].checkInAt?.toISOString() === instant(D.d05, outcome === "a" ? "10:00" : "11:00").toISOString(),
    );
  }
}

async function race9(): Promise<void> {
  const h = requireHarness("R9");
  await h.admin.prisma.employee.update({ where: { id: E.a4 }, data: { separationDate: day("2026-09-02"), separationReason: "HR2C concurrency verification separation", isActive: false } });
  const baseline = await latestRevision(h, E.a4, D.d03);
  if (baseline === null) {
    check("R9 baseline revision exists", false);
    return;
  }
  check("R9 baseline revision exists", true);
  const expectedRevisionNo = baseline.revisionNo;
  await assertIndependentBackends("R9");
  const { a, b } = await runRace("R9", RACE_TIMEOUT_MS,
    () => h.actorA.corrections.markNotApplicable(COMPANY_ID, E.a4, D.d03, { expectedRevisionNo, changeReason: "r9-void" }, USER),
    () => h.actorB.corrections.correctAttendance(COMPANY_ID, E.a4, D.d03, { expectedRevisionNo, changeReason: "r9-correct", checkInLocalTime: "10:15", checkOutLocalTime: "18:15" }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R9 exactly one winner", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    checkControlled("R9 losing actor", (outcome === "a" ? b : a) as Failure, /changed after this page loaded|already exists|changed concurrently/);
    const successorCount = await h.admin.prisma.attendanceRevision.count({
      where: { attendanceRecord: { employeeId: E.a4, businessDate: day(D.d03) }, revisionNo: expectedRevisionNo + 1 },
    });
    check("R9 exactly one successor revision", successorCount === 1);
    const latest = await latestRevision(h, E.a4, D.d03);
    const voidWon = outcome === "a";
    check(
      "R9 latest state is coherent for the winning path",
      latest !== null && latest.revisionNo === expectedRevisionNo + 1 && (voidWon
        ? latest.isAttendanceApplicable === false && latest.presenceState === null
        : latest.isAttendanceApplicable === true && latest.presenceState === "PRESENT"),
    );
  }
}

async function race10(): Promise<void> {
  const h = requireHarness("R10");
  await h.admin.prisma.employee.update({ where: { id: E.a10 }, data: { separationDate: day("2026-09-04"), separationReason: "HR2C concurrency verification separation", isActive: false } });
  const voidSetup = await attempt(() => h.admin.corrections.markNotApplicable(COMPANY_ID, E.a10, D.d05, { expectedRevisionNo: 1, changeReason: "r10-void-setup" }, USER));
  const voidOk = voidSetup.ok && voidSetup.value.revisionNo === 2 && voidSetup.value.isAttendanceApplicable === false;
  check("R10 setup void created at revision 2", voidOk, voidSetup.ok ? `revisionNo=${voidSetup.value.revisionNo}` : `status=${voidSetup.status} message="${voidSetup.message}"`);
  if (!voidOk) return;
  await h.admin.prisma.employee.update({ where: { id: E.a10 }, data: { separationDate: null, separationReason: null, isActive: true } });
  await assertIndependentBackends("R10");
  const { a, b } = await runRace("R10", RACE_TIMEOUT_MS,
    () => h.actorA.corrections.correctAttendance(COMPANY_ID, E.a10, D.d05, { expectedRevisionNo: 2, changeReason: "r10-a", checkInLocalTime: "10:00", checkOutLocalTime: "15:00" }, USER),
    () => h.actorB.corrections.correctAttendance(COMPANY_ID, E.a10, D.d05, { expectedRevisionNo: 2, changeReason: "r10-b", checkInLocalTime: "11:00", checkOutLocalTime: "16:00" }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R10 exactly one restore wins", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    const winner = (outcome === "a" ? a : b) as { ok: true; value: CorrectionResultView };
    check("R10 winner restores at revision 3", winner.value.revisionNo === 3 && winner.value.isAttendanceApplicable === true);
    checkControlled("R10 competing correction", (outcome === "a" ? b : a) as Failure, /changed after this page loaded|already exists|changed concurrently/);
    const successorCount = await h.admin.prisma.attendanceRevision.count({
      where: { attendanceRecord: { employeeId: E.a10, businessDate: day(D.d05) }, revisionNo: 3 },
    });
    check("R10 no duplicate N+1 revision", successorCount === 1);
    const latest = await latestRevision(h, E.a10, D.d05);
    check(
      "R10 restored revision is applicable with the winner punches",
      latest !== null && latest.revisionNo === 3 && latest.isAttendanceApplicable === true &&
        latest.checkInAt?.toISOString() === instant(D.d05, outcome === "a" ? "10:00" : "11:00").toISOString(),
    );
  }
}

async function race11(): Promise<void> {
  const h = requireHarness("R11");
  const exceptionSetup = await attempt(() => h.admin.calendar.createException(COMPANY_ID, { businessDate: D.d02, exceptionType: "HOLIDAY", name: "R11 Holiday" }, USER));
  check("R11 setup live holiday exception created", exceptionSetup.ok, exceptionSetup.ok ? "" : `status=${exceptionSetup.status} message="${exceptionSetup.message}"`);
  if (!exceptionSetup.ok) return;
  const holidayId = exceptionSetup.value.id;
  const finalizeSetup = await attempt(() => h.admin.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d02 }, USER));
  check(
    "R11 setup finalizes the date with the live holiday",
    finalizeSetup.ok && (await countMarkers(h, D.d02)) === 1,
    finalizeSetup.ok ? "" : `status=${finalizeSetup.status} message="${finalizeSetup.message}"`,
  );
  if (!finalizeSetup.ok) return;
  await assertIndependentBackends("R11");
  const { a, b } = await runRace("R11", RACE_TIMEOUT_MS,
    () => h.actorA.calendar.updateException(COMPANY_ID, holidayId, { name: "R11 Edited Holiday" }, USER),
    () => h.actorB.calendar.historicalCorrect(COMPANY_ID, {
      businessDate: D.d02,
      target: "SPECIAL_WORKING_DAY",
      name: "R11 Special Working Day",
      startMinuteOfDay: 600,
      endMinuteOfDay: 960,
      unpaidBreakMinutes: 0,
      changeReason: "r11-historical",
    }, USER),
  );
  check(
    "R11 ordinary calendar edit rejected on the finalized date",
    !a.ok && a.status === 409 && /already finalized/.test(a.message),
    a.ok ? "unexpectedly succeeded" : `status=${a.status} message="${a.message}"`,
  );
  if (!a.ok) checkNoLeak("R11 ordinary edit rejection", a);
  check(
    "R11 historical calendar correction succeeds",
    b.ok && b.value.attendanceRevisionsCreated >= 1,
    b.ok ? "" : `status=${b.status} message="${b.message}"`,
  );
  const exceptions = await h.admin.prisma.companyCalendarException.findMany({ where: { companyId: COMPANY_ID, businessDate: day(D.d02) } });
  const live = exceptions.filter(row => row.supersededAt === null && row.cancelledAt === null);
  check("R11 exactly one live exception remains", live.length === 1 && live[0]?.exceptionType === "SPECIAL_WORKING_DAY");
  const holiday = exceptions.find(row => row.id === holidayId);
  check(
    "R11 replacement lineage is valid",
    holiday !== undefined && holiday.supersededAt !== null && live[0]?.replacesExceptionId === holidayId,
  );
  const a1Latest = await latestRevision(h, E.a1, D.d02);
  check(
    "R11 attendance matches the final calendar semantics",
    a1Latest !== null && a1Latest.expectedDayKind === "SPECIAL_WORKING_DAY" &&
      a1Latest.calendarExceptionId === live[0]?.id &&
      a1Latest.presenceState === "PRESENT" && a1Latest.isNonWorkingDayAttendance === false,
  );
}

async function race12(): Promise<void> {
  const h = requireHarness("R12");
  await assertIndependentBackends("R12");
  const { a, b } = await runRace("R12", RACE_TIMEOUT_MS,
    () => h.actorA.policies.replacePolicy(COMPANY_ID, POLICY_BASE, { effectiveFrom: "2026-11-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "r12-a" }, USER),
    () => h.actorB.policies.replacePolicy(COMPANY_ID, POLICY_BASE, { effectiveFrom: "2026-12-01", lateGraceMinutes: 25, earlyLeaveGraceMinutes: 8, changeReason: "r12-b" }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R12 exactly one replacement wins", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    checkControlled("R12 losing replacement", (outcome === "a" ? b : a) as Failure, /already replaces this one|changed concurrently|overlaps/);
    const winnerFrom = outcome === "a" ? "2026-11-01" : "2026-12-01";
    const policies = await h.admin.prisma.attendancePolicy.findMany({ where: { companyId: COMPANY_ID } });
    const base = policies.find(row => row.id === POLICY_BASE);
    const replacement = policies.find(row => row.id !== POLICY_BASE);
    check("R12 exactly one replacement policy exists", policies.length === 2 && base !== undefined && replacement !== undefined);
    check(
      "R12 no overlap, no branching predecessor, valid range chain",
      base !== undefined && replacement !== undefined &&
        base.effectiveTo?.toISOString().slice(0, 10) === winnerFrom &&
        replacement.effectiveFrom.toISOString().slice(0, 10) === winnerFrom &&
        replacement.effectiveTo === null &&
        replacement.replacesPolicyId === POLICY_BASE &&
        replacement.cancelledAt === null &&
        policies.filter(row => row.replacesPolicyId === POLICY_BASE).length === 1,
    );
  }
}

async function race13(): Promise<void> {
  const h = requireHarness("R13");
  await assertIndependentBackends("R13");
  const replacement = await h.admin.prisma.attendancePolicy.findFirst({ where: { companyId: COMPANY_ID, id: { not: POLICY_BASE } } });
  if (replacement === null || replacement.cancelledAt !== null || replacement.effectiveFrom.toISOString().slice(0, 10) <= "2026-09-06") {
    check("R13 future replacement policy exists", false);
    return;
  }
  check("R13 future replacement policy exists", true);
  const { a, b } = await runRace("R13", RACE_TIMEOUT_MS,
    () => h.actorA.policies.cancelFuturePolicy(COMPANY_ID, replacement.id, { cancellationReason: "r13-a" }, USER),
    () => h.actorB.policies.cancelFuturePolicy(COMPANY_ID, replacement.id, { cancellationReason: "r13-b" }, USER),
  );
  const outcome = oneWinner(a, b);
  check("R13 exactly one cancellation wins", outcome === "a" || outcome === "b");
  if (outcome === "a" || outcome === "b") {
    const winner = (outcome === "a" ? a : b) as { ok: true; value: AttendancePolicyView };
    check("R13 winner returns the cancelled policy", winner.value.cancelledAt !== null);
    checkControlled("R13 losing cancellation", (outcome === "a" ? b : a) as Failure, /already cancelled|changed concurrently|overlaps/);
    const policies = await h.admin.prisma.attendancePolicy.findMany({ where: { companyId: COMPANY_ID } });
    const base = policies.find(row => row.id === POLICY_BASE);
    const cancelled = policies.find(row => row.id === replacement.id);
    check(
      "R13 predecessor restored exactly once with no overlap or broken lineage",
      policies.length === 2 && base !== undefined && cancelled !== undefined &&
        base.effectiveTo === null && base.cancelledAt === null &&
        cancelled.cancelledAt !== null &&
        policies.filter(row => row.cancelledAt === null).length === 1,
    );
  }
}

async function advisoryLockSemantics(): Promise<void> {
  const h = requireHarness("ADVISORY");
  const pidA = Number((await h.holder.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  const pidB = Number((await h.prober.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  check("ADVISORY proof uses independent backends", pidA > 0 && pidB > 0 && pidA !== pidB, `holder=${pidA} prober=${pidB}`);
  await h.holder.query("BEGIN");
  await h.holder.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [attendanceDateLockKey(COMPANY_ID, D.d10)]);
  const tryAcquire = async (key: string): Promise<boolean> =>
    (await h.prober.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired", [key])).rows[0].acquired === true;
  check("ADVISORY same company + same date conflicts", (await tryAcquire(attendanceDateLockKey(COMPANY_ID, D.d10))) === false);
  check("ADVISORY different company + same date stays independent", (await tryAcquire(attendanceDateLockKey("hr2c-conc-other-company", D.d10))) === true);
  check("ADVISORY same company + different date stays independent", (await tryAcquire(attendanceDateLockKey(COMPANY_ID, D.d11))) === true);
  check("ADVISORY different namespace stays independent", (await tryAcquire(`other|${COMPANY_ID}|${D.d10}`)) === true);
  await h.holder.query("ROLLBACK");
}

async function differentDateIndependence(): Promise<void> {
  const h = requireHarness("INDEPENDENCE");
  const holderPid = Number((await h.holder.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  const monitorPid = Number((await h.monitor.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  const productionPid = await backendPid(h.actorB);
  check("INDEPENDENCE holder and production actor use distinct backends", holderPid > 0 && productionPid > 0 && holderPid !== productionPid, `holder=${holderPid} actor=${productionPid}`);
  await h.holder.query("BEGIN");
  await h.holder.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [attendanceDateLockKey(COMPANY_ID, D.d10)]);
  const holderCompaniesLocks = Number(
    (await h.monitor.query(
      "SELECT count(*)::int AS n FROM pg_locks l JOIN pg_class c ON c.oid = l.relation WHERE c.relname = 'companies' AND l.pid = $1",
      [holderPid],
    )).rows[0].n,
  );
  const samples: Array<{ violations: number; busy: number; modes: string }> = [];
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      const result = await h.monitor.query(
        "SELECT (SELECT count(*)::int FROM pg_locks l JOIN pg_class c ON c.oid = l.relation WHERE c.relname = 'companies' AND l.mode <> 'SIReadLock' AND (l.granted <> true OR (l.locktype = 'relation' AND l.mode NOT IN ('AccessShareLock', 'RowShareLock')) OR (l.locktype = 'tuple' AND l.mode IN ('FOR UPDATE', 'FOR NO KEY UPDATE', 'FOR SHARE')))) AS violations, (SELECT coalesce(string_agg(DISTINCT l.locktype || ':' || l.mode, ','), '') FROM pg_locks l JOIN pg_class c ON c.oid = l.relation WHERE c.relname = 'companies') AS modes, (SELECT count(*)::int FROM pg_stat_activity WHERE datname = 'hr2c' AND pid <> ALL($1::int[]) AND state IN ('active', 'idle in transaction')) AS busy",
        [[monitorPid, holderPid]],
      );
      samples.push({ violations: Number(result.rows[0].violations), busy: Number(result.rows[0].busy), modes: String(result.rows[0].modes ?? "") });
      await sleep(3);
    }
  })();
  let watchdogFired = false;
  let watchdogTimer: NodeJS.Timeout | undefined;
  const watchdog = new Promise<void>(resolve => {
    watchdogTimer = setTimeout(() => { watchdogFired = true; resolve(); }, 30_000);
  });
  const production = attempt(() => h.actorB.finalize.finalizeDay(COMPANY_ID, { businessDate: D.d11 }, USER, new Date("2026-09-12T00:00:00.000Z")));
  await Promise.race([production, watchdog]);
  if (watchdogTimer !== undefined) clearTimeout(watchdogTimer);
  if (watchdogFired) {
    await h.holder.query("ROLLBACK").catch(() => undefined);
    await Promise.race([production, sleep(10_000)]);
    await terminateScratchBackends();
  }
  sampling = false;
  await sampler;
  const outcome = await production;
  check(
    "INDEPENDENCE production operation for 2026-09-11 completes while 2026-09-10 lock is held",
    !watchdogFired && outcome.ok,
    watchdogFired ? "watchdog fired: the unrelated-date operation was blocked" : outcome.ok ? "" : `status=${outcome.status} message="${outcome.message}"`,
  );
  if (outcome.ok) {
    check("INDEPENDENCE 2026-09-11 finalization really committed", (await countMarkers(h, D.d11)) === 1);
  }
  check(
    "INDEPENDENCE no serializing companies row locks during the production operation",
    samples.length > 0 && samples.every(sample => sample.violations === 0) && holderCompaniesLocks === 0,
    `${samples.length} samples, holder companies locks=${holderCompaniesLocks}, observed modes=${[...new Set(samples.map(sample => sample.modes).filter(mode => mode !== ""))].join(" / ") || "none"}`,
  );
  check("INDEPENDENCE lock sampling overlapped the live production transaction", samples.some(sample => sample.busy > 0));
  await h.holder.query("ROLLBACK").catch(() => undefined);
  const released = (await h.prober.query("SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired", [attendanceDateLockKey(COMPANY_ID, D.d10)])).rows[0].acquired === true;
  check("INDEPENDENCE 2026-09-10 lock released after rollback", released);
}

function runCommand(command: string, env?: NodeJS.ProcessEnv): void {
  execFileSync("cmd.exe", ["/d", "/s", "/c", command], { env: env === undefined ? undefined : { ...process.env, ...env }, timeout: 300_000 });
}

function containerExists(): boolean {
  const output = execFileSync("cmd.exe", ["/d", "/s", "/c", `docker ps -a --filter name=${CONTAINER} --format {{.Names}}`], { encoding: "utf8" });
  return output.trim().length > 0;
}

function portOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect({ host: "127.0.0.1", port });
    socket.once("error", () => resolve(false));
    socket.once("connect", () => { socket.destroy(); resolve(true); });
  });
}

async function waitForPostgres(): Promise<boolean> {
  for (let attemptNo = 0; attemptNo < 90; attemptNo += 1) {
    try {
      runCommand(`docker exec ${CONTAINER} pg_isready -U hr2c -d hr2c`);
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

function migrateDeploy(): void {
  runCommand("pnpm exec prisma migrate deploy", { DATABASE_URL: SCRATCH_URL });
}

async function stopContainer(): Promise<void> {
  try {
    runCommand(`docker stop --time 20 ${CONTAINER}`);
  } catch {
    return;
  }
  for (let attemptNo = 0; attemptNo < 60; attemptNo += 1) {
    if (!containerExists()) return;
    await sleep(500);
  }
}

async function cleanup(): Promise<void> {
  const current = harness;
  let prismaDisconnected = true;
  let pgClosed = true;
  if (current !== undefined) {
    for (const stack of [current.admin, current.actorA, current.actorB]) {
      try {
        await Promise.race([stack.prisma.$disconnect(), sleep(10_000)]);
      } catch {
        prismaDisconnected = false;
      }
    }
    for (const client of [current.monitor, current.holder, current.prober]) {
      try {
        await client.end();
      } catch {
        pgClosed = false;
      }
    }
  }
  check("scratch prisma clients disconnected", prismaDisconnected);
  check("scratch pg clients closed", pgClosed);
  if (containerStarted) {
    await stopContainer();
    check("hr2c-conc container stopped and removed", !containerExists());
    check("port 55496 released after cleanup", !(await portOpen(SCRATCH_PORT)));
  } else {
    check("no hr2c-conc container was left behind", !containerExists());
  }
}

async function main(): Promise<void> {
  const guard = new URL(SCRATCH_URL);
  assertAttendanceScratchDatabase(SCRATCH_URL);
  check(
    "scratch target is the fixed disposable instance on 127.0.0.1:55496/hr2c",
    guard.hostname === "127.0.0.1" && guard.port === String(SCRATCH_PORT) && decodeURIComponent(guard.pathname) === "/hr2c",
  );
  process.env.DATABASE_URL = SCRATCH_URL;

  const freeAtStart = !(await portOpen(SCRATCH_PORT));
  check("port 55496 is free before start", freeAtStart);
  if (!freeAtStart) throw new Error("Port 55496 is occupied; the disposable database cannot start.");
  const existing = containerExists();
  check("no pre-existing hr2c-conc container", !existing);
  if (existing) throw new Error("A container named hr2c-conc already exists; refusing to touch it.");

  runCommand(`docker run -d --rm --name ${CONTAINER} -e POSTGRES_USER=hr2c -e POSTGRES_PASSWORD=hr2c-scratch -e POSTGRES_DB=hr2c -p 127.0.0.1:55496:5432 --tmpfs /var/lib/postgresql/data:rw,size=1g,noexec,nosuid postgres:17`);
  containerStarted = true;
  check("disposable postgres:17 container started with tmpfs", containerExists());

  const ready = await waitForPostgres();
  check("postgres ready inside the disposable container", ready);
  if (!ready) throw new Error("Postgres did not become ready inside the disposable container.");

  const monitor = verificationPg(SCRATCH_URL);
  await monitor.connect();
  const holder = verificationPg(SCRATCH_URL);
  await holder.connect();
  const prober = verificationPg(SCRATCH_URL);
  await prober.connect();

  migrateDeploy();
  const migrationRows = (await monitor.query("SELECT migration_name, checksum, finished_at FROM _prisma_migrations")).rows;
  // The D3 multi_office_company_foundation migration raised the total from 11 to 12.
  check(
    "all 12 migrations applied to the disposable database",
    migrationRows.length === 12 && migrationRows.every(row => row.finished_at !== null),
    `${migrationRows.length} migrations`,
  );
  const hr2cRow = migrationRows.find(row => row.migration_name === "20260906000000_hr_2c_attendance_foundation");
  check("HR-2C migration checksum matches the locked baseline", hr2cRow?.checksum === HR2C_MIGRATION_SHA256);

  harness = { admin: buildStack(), actorA: buildStack(), actorB: buildStack(), monitor, holder, prober };
  await seedBase(harness);
  check("base fixtures seeded", (await harness.admin.prisma.employee.count()) === 6);

  await race1();
  await race2();
  await race3();
  await race4();
  await race5();
  await race6();
  await race7();
  await race8();
  await race9();
  await race10();
  await race11();
  await race12();
  await race13();
  await advisoryLockSemantics();
  await differentDateIndependence();

  console.log(`Attendance concurrency verification: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch(error => {
    failed += 1;
    console.error(`Attendance concurrency verification aborted: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    process.exit(process.exitCode ?? 0);
  });
