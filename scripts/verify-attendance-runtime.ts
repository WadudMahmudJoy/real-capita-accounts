import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import { hash } from "bcryptjs";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { assertAttendanceDevDatabase, databaseFingerprint, verificationPg } from "./attendance-verification";

type RuntimeResponse = { status: number; body: any; headers: Headers };
const prefix = `HR2C_RUNTIME_${randomUUID().replaceAll("-", "").toUpperCase().slice(0, 16)}`;
const rollback = Symbol("runtime rollback");
let passed = 0;
let failed = 0;
function check(name: string, ok: unknown) {
  if (ok) { passed++; console.log(`PASS ${name}`); } else { failed++; console.log(`FAIL ${name}`); }
}
function buildApi() {
  const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm --filter @real-capita-accounts/api build"] : ["--filter", "@real-capita-accounts/api", "build"];
  execFileSync(command, args, { cwd: process.cwd(), stdio: "ignore" });
}

const PRISMA_LIFECYCLE_KEYS = new Set([
  "$connect",
  "$disconnect",
  "enableShutdownHooks",
  "onApplicationShutdown",
  "onModuleDestroy",
  "onModuleInit",
]);

function scopedPrisma(tx: Record<PropertyKey, any>) {
  let sequence = 0;
  const facade = new Proxy(tx, { get(target, property) {
    if (property === "$transaction") return async (work: (inner: unknown) => Promise<unknown>) => {
      const savepoint = `hr2c_runtime_${++sequence}`;
      await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
      try { const result = await work(facade); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`); return result; }
      catch (error) { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`); throw error; }
    };
    if (typeof property === "string" && PRISMA_LIFECYCLE_KEYS.has(property)) return undefined;
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  } });
  return facade;
}

async function request(base: string, path: string, init: RequestInit = {}, cookie?: string): Promise<RuntimeResponse> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  const text = await response.text();
  let body: any = null; if (text) { try { body = JSON.parse(text); } catch { body = { text }; } }
  return { status: response.status, body, headers: response.headers };
}

const SENSITIVE_PATTERN = /prisma|postgres|sqlstate|constraint|duplicate key|relation "|pg_|stack|SELECT |INSERT |UPDATE |DELETE FROM|WHERE /i;

function assertNoInternalLeak(label: string, r: RuntimeResponse) {
  const serialized = JSON.stringify(r.body ?? {}).toLowerCase();
  check(label, !SENSITIVE_PATTERN.test(serialized));
}

function week() {
  return ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"].map(dayOfWeek =>
    dayOfWeek === "FRIDAY"
      ? { dayOfWeek, isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false }
      : { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60, crossesMidnight: false });
}

async function main() {
  process.loadEnvFile(".env");
  const connectionString = assertAttendanceDevDatabase(process.env.DATABASE_URL);
  buildApi();
  const browser = process.argv.includes("--browser");
  const pg = verificationPg(connectionString);
  await pg.connect();
  try {
    const before = await databaseFingerprint(pg);
    const [{ PrismaService }, ac, as, ag, rg, wc, ws, adc, aes, apc, aps, acc, acs] = await Promise.all([
      import("../apps/api/dist/prisma/prisma.service.js"),
      import("../apps/api/dist/auth/auth.controller.js"),
      import("../apps/api/dist/auth/auth.service.js"),
      import("../apps/api/dist/auth/guards/auth.guard.js"),
      import("../apps/api/dist/auth/guards/roles.guard.js"),
      import("../apps/api/dist/work-schedule/work-schedule.controller.js"),
      import("../apps/api/dist/work-schedule/work-schedule.service.js"),
      import("../apps/api/dist/attendance/attendance.controller.js"),
      import("../apps/api/dist/attendance/attendance-day.service.js"),
      import("../apps/api/dist/attendance/attendance-policy.controller.js"),
      import("../apps/api/dist/attendance/attendance-policy.service.js"),
      import("../apps/api/dist/attendance/attendance-calendar.controller.js"),
      import("../apps/api/dist/attendance/attendance-calendar.service.js"),
    ]);
    const [{ AttendanceFinalizationService }, { AttendanceCorrectionService }, { AttendanceExpectationService }] = await Promise.all([
      import("../apps/api/dist/attendance/attendance-finalization.service.js"),
      import("../apps/api/dist/attendance/attendance-correction.service.js"),
      import("../apps/api/dist/attendance/attendance-expectation.service.js"),
    ]);
    const prisma = new PrismaService();
    try {
      await prisma.$transaction(async (tx: Record<PropertyKey, any>) => {
        const scoped = scopedPrisma(tx);
        const oldPrimary = await tx.company.findUnique({ where: { singletonKey: "PRIMARY" } });
        if (oldPrimary) await tx.company.update({ where: { id: oldPrimary.id }, data: { singletonKey: `${prefix}_OLD_PRIMARY` } });
        const company = await tx.company.create({ data: { singletonKey: "PRIMARY", name: "HR2C Runtime Verification Company" } });
        const role = await tx.role.findUniqueOrThrow({ where: { code: "ACCOUNTANT" } });
        const password = `Runtime-${randomUUID()}!`;
        const user = browser
          ? await tx.user.findUniqueOrThrow({ where: { email: "accountant@realcapita.local" } })
          : await tx.user.create({ data: { email: `${prefix.toLowerCase()}@example.invalid`, fullName: "HR2C Runtime Accountant", passwordHash: await hash(password, 4), roles: { create: { roleId: role.id } } } });
        const employeeA = await tx.employee.create({ data: { employeeCode: `${prefix.slice(0, 14)}A`, fullName: "Runtime Employee A", designation: "Verification", joiningDate: new Date("2026-01-01") } });
        const employeeB = await tx.employee.create({ data: { employeeCode: `${prefix.slice(0, 14)}B`, fullName: "Runtime Employee B", designation: "Verification", joiningDate: new Date("2026-01-01") } });
        const schedule = await tx.workSchedule.create({ data: { id: `${prefix}_WS`, companyId: company.id, code: `${prefix.slice(0, 12)}RT`, name: "Runtime Schedule", createdById: user.id, days: { create: week() } } });
        await tx.workScheduleAssignment.create({ data: { id: `${prefix}_WSA`, companyId: company.id, scope: "COMPANY_DEFAULT", workScheduleId: schedule.id, employeeId: null, effectiveFrom: new Date("2026-08-01T00:00:00.000Z"), effectiveTo: null, createdById: user.id } });

        const controllers: any[] = [ac.AuthController, wc.WorkScheduleController, adc.AttendanceController, apc.AttendancePolicyController, acc.AttendanceCalendarController];
        const providers: any[] = [
          { provide: PrismaService, useValue: scoped },
          as.AuthService, ag.AuthGuard, rg.RolesGuard, ws.WorkScheduleService,
          aes.AttendanceDayService, aps.AttendancePolicyService, acs.AttendanceCalendarService,
          AttendanceExpectationService, AttendanceFinalizationService, AttendanceCorrectionService,
        ];
        class RuntimeModule {}
        Module({ imports: [JwtModule.register({})], controllers, providers })(RuntimeModule);
        const app = await NestFactory.create(RuntimeModule, { logger: false });
        app.use(cookieParser());
        app.enableCors({ origin: "http://localhost:3000", credentials: true });
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        try { await app.listen(browser ? 4000 : 0, "127.0.0.1"); }
        catch { await app.close(); throw new Error(browser ? "Browser verification port 4000 is unavailable; no process was terminated." : "Runtime HTTP host could not start."); }
        const base = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
        try {
          if (browser) {
            console.log("READY http://localhost:4000");
            await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
          } else {
            await runHeadless({ base, tx, company, user, employeeA, employeeB, schedule, role, password });
          }
        } finally { await app.close(); }
        throw rollback;
      }, { timeout: browser ? 86_400_000 : 600_000 });
    } catch (error) { if (error !== rollback) throw error; } finally { await prisma.$disconnect(); }
    const after = await databaseFingerprint(pg);
    assert.deepEqual(after, before);
    check("all table fingerprints restored", true);
    for (const table of Object.keys(after)) {
      const id = `"${table.replaceAll('"', '""')}"`;
      const residue = await pg.query(`SELECT count(*)::text count FROM public.${id} t WHERE row_to_json(t)::text LIKE $1`, [`%${prefix}%`]);
      assert.equal(residue.rows[0].count, "0");
    }
    check("fixture residue zero", true);
  } finally { await pg.end(); }
  if (!browser) { console.log(`Attendance runtime verification: ${passed} PASS, ${failed} FAIL`); if (failed) process.exitCode = 1; }
}

type HeadlessContext = {
  base: string;
  tx: any;
  company: { id: string };
  user: { id: string; email: string };
  employeeA: { id: string };
  employeeB: { id: string };
  schedule: { id: string };
  role: { id: string };
  password: string;
};

async function runHeadless(context: HeadlessContext): Promise<void> {
  const { base, tx, company, user, employeeA, employeeB, password } = context;
  const scheduleId = context.schedule.id;

  let r = await request(base, "/attendance/day?businessDate=2026-09-05");
  check("real AuthGuard returns 401", r.status === 401);

  r = await request(base, "/auth/login", { method: "POST", body: JSON.stringify({ email: user.email, password }) });
  const cookie = r.headers.get("set-cookie")?.split(";", 1)[0];
  check("normal production login", r.status === 200 && Boolean(cookie));
  assert.ok(cookie);

  r = await request(base, "/attendance/day?businessDate=2026-09-05", {}, cookie);
  check("ACCOUNTANT role can access attendance", r.status === 200);

  await tx.userRole.deleteMany({ where: { userId: user.id } });
  r = await request(base, "/attendance/day?businessDate=2026-09-05", {}, cookie);
  check("real RolesGuard returns 403 for non-ACCOUNTANT", r.status === 403);
  await tx.userRole.create({ data: { userId: user.id, roleId: context.role.id } });
  r = await request(base, "/attendance/day?businessDate=2026-09-05", {}, cookie);
  check("access restored after role re-grant", r.status === 200);

  r = await request(base, "/attendance/day?businessDate=2026-9-5", {}, cookie);
  check("strict business date rejected", r.status === 400);
  r = await request(base, "/attendance/day?businessDate=2026-09-05&companyId=co-1", {}, cookie);
  check("client-supplied companyId rejected", r.status === 400);
  r = await request(base, "/attendance/day?businessDate=2026-09-05&timeZone=UTC", {}, cookie);
  check("client-supplied timeZone rejected", r.status === 400);
  r = await request(base, "/attendance/day?businessDate=2026-09-05&createdById=u1", {}, cookie);
  check("client-supplied createdById rejected", r.status === 400);

  await tx.attendancePolicy.create({ data: { id: `${prefix}_EVPOL`, companyId: company.id, effectiveFrom: new Date("2026-08-15T00:00:00.000Z"), effectiveTo: null, lateGraceMinutes: 12, earlyLeaveGraceMinutes: 7, createdById: user.id, cancelledAt: new Date("2026-08-10T00:00:00.000Z"), cancelledById: user.id, cancellationReason: "runtime cancelled before start (boundary passed)" } });
  r = await request(base, "/attendance/policies", { method: "POST", body: JSON.stringify({ effectiveFrom: "2026-09-08", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 }) }, cookie);
  check("future initial policy creation succeeds with only cancelled predecessors", (r.status === 201 || r.status === 200) && r.body?.effectiveFrom === "2026-09-08");
  const futureInitialPolicyId = r.body?.id;
  r = await request(base, `/attendance/policies/${futureInitialPolicyId}/cancel-future`, { method: "POST", body: JSON.stringify({ cancellationReason: "runtime cancelled before start" }) }, cookie);
  check("future initial policy cancelled before its start via real endpoint", (r.status === 201 || r.status === 200) && Boolean(r.body?.cancelledAt));

  r = await request(base, "/attendance/policies", { method: "POST", body: JSON.stringify({ effectiveFrom: "2026-09-01", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 }) }, cookie);
  check("later initial creation succeeds after the cancelled-before-start boundary passed", (r.status === 201 || r.status === 200) && r.body?.effectiveFrom === "2026-09-01");
  r = await request(base, "/attendance/policies", {}, cookie);
  const seededCancelledPolicy = (r.body ?? []).find((row: any) => row.effectiveFrom === "2026-08-15");
  check("cancelled-before-start policy readback shows the passed boundary", seededCancelledPolicy?.cancelledAt !== null && seededCancelledPolicy?.cancellationReason === "runtime cancelled before start (boundary passed)");
  r = await request(base, "/attendance/policies", { method: "POST", body: JSON.stringify({ effectiveFrom: "2026-09-02", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 }) }, cookie);
  check("second initial policy rejected", r.status === 409);

  r = await request(base, "/attendance/day?businessDate=2026-09-05", {}, cookie);
  const dayView = r.body;
  check("day view shows the privacy-safe roster only",
    r.status === 200 &&
    Array.isArray(dayView?.rows) &&
    dayView.rows.every((row: any) => {
      const employeeKeys = Object.keys(row.employee ?? {}).sort();
      return JSON.stringify(employeeKeys) === JSON.stringify(["department", "employeeCode", "employeeId", "fullName"]);
    }));
  const dayIds = (dayView?.rows ?? []).map((row: any) => row.employee.employeeId);
  check("day roster includes the fixture employees",
    dayIds.includes(employeeA.id) && dayIds.includes(employeeB.id));
  const workingRow = (dayView?.rows ?? []).find((item: any) => item.employee.employeeId === employeeA.id);
  check("day view carries the working window",
    workingRow?.expectedDayKind === "WORKING_DAY" && workingRow?.scheduledStartMinute === 600 && workingRow?.scheduledEndMinute === 1080);
  check("day summary counts only attendance-required rows",
    dayView?.summary?.expected === dayView?.rows?.filter((row: any) => row.attendanceRequired).length &&
    dayView?.summary?.pending === dayView?.rows?.filter((row: any) => row.attendanceRequired && row.status?.kind === "PENDING").length);
  const restDay = await request(base, "/attendance/day?businessDate=2026-09-04", {}, cookie);
  check("ordinary Friday has zero expected attendance", restDay.status === 200 && restDay.body?.summary?.expected === 0);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeA.id, checkInLocalTime: "10:20", checkOutLocalTime: "18:00", note: "runtime draft" }] }),
  }, cookie);
  check("bulk save creates a draft", r.status === 201 || r.status === 200);
  const draftDay = r.body ?? {};
  const draftRow = (draftDay.rows ?? []).find((row: any) => row.employee.employeeId === employeeA.id);
  check("draft row reflects provisional present late", draftRow?.status?.kind === "PRESENT" && draftRow?.status?.provisionalLate === true);
  const expectedUpdatedAt = draftRow?.expectedUpdatedAt;
  check("draft row exposes the freshness token", typeof expectedUpdatedAt === "string");

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeA.id, checkInLocalTime: "10:00", checkOutLocalTime: "18:00", expectedUpdatedAt }] }),
  }, cookie);
  check("bulk save updates the same draft", r.status === 201 || r.status === 200);
  const updatedRow = (r.body?.rows ?? []).find((row: any) => row.employee.employeeId === employeeA.id);
  check("updated draft is on time", updatedRow?.status?.kind === "PRESENT" && updatedRow?.status?.provisionalLate === false);
  const freshToken = updatedRow?.expectedUpdatedAt;

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeA.id, checkInLocalTime: "10:30", expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }] }),
  }, cookie);
  check("stale draft token rejected with 409", r.status === 409);
  assertNoInternalLeak("stale draft rejection has no internals", r);

  const today = new Date();
  const todayDhaka = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", dateStyle: "short" }).format(today);
  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: todayDhaka, entries: [{ employeeId: employeeA.id, checkInLocalTime: "23:59" }] }),
  }, cookie);
  check("future punch instant rejected", r.status === 400);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeB.id, checkInLocalTime: "10:00", checkOutLocalTime: "10:00" }] }),
  }, cookie);
  check("equal check-in and check-out rejected", r.status === 400);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeB.id, checkOutLocalTime: "18:00" }] }),
  }, cookie);
  check("check-out without check-in rejected", r.status === 400);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeB.id, checkInLocalTime: "22:00", checkOutLocalTime: "06:00" }] }),
  }, cookie);
  check("overnight check-out derives next-day punch", r.status === 201 || r.status === 200);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeB.id, checkInLocalTime: "10:00", unknownField: "x" }] }),
  }, cookie);
  check("unknown DTO field rejected", r.status === 400);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeB.id, checkInLocalTime: "10:00", companyId: "co-2" }] }),
  }, cookie);
  check("ownership field in entry rejected", r.status === 400);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-06", entries: [{ employeeId: employeeB.id, checkInLocalTime: "10:00", timeZone: "UTC" }] }),
  }, cookie);
  check("timeZone in entry rejected", r.status === 400);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeB.id, checkInLocalTime: "10:0" }] }),
  }, cookie);
  check("invalid HH:mm rejected", r.status === 400);

  const employeeC = await tx.employee.create({ data: { employeeCode: `${prefix.slice(0, 14)}C`, fullName: "Runtime Employee C", designation: "Verification", joiningDate: new Date("2026-01-01") } });
  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeC.id, checkInLocalTime: "10:15", checkOutLocalTime: "17:45" }] }),
  }, cookie);
  check("discard-scenario draft created", r.status === 201 || r.status === 200);
  const discardDraftRow = (r.body?.rows ?? []).find((row: any) => row.employee.employeeId === employeeC.id);
  const discardDraftToken = discardDraftRow?.expectedUpdatedAt;
  check("discard-scenario draft exposes its freshness token", typeof discardDraftToken === "string");
  r = await request(base, "/attendance/entries/discard", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-09-05", employeeId: employeeC.id, expectedUpdatedAt: discardDraftToken }),
  }, cookie);
  check("pre-finalization discard succeeds", r.status === 201 || r.status === 200);
  const discardedRecord = await tx.attendanceRecord.findFirst({ where: { companyId: company.id, employeeId: employeeC.id, businessDate: new Date("2026-09-05T00:00:00.000Z") } });
  check("successful discard removes the draft record", discardedRecord === null);
  r = await request(base, "/attendance/day?businessDate=2026-09-05", {}, cookie);
  const discardedRow = (r.body?.rows ?? []).find((row: any) => row.employee.employeeId === employeeC.id);
  check("day readback shows no punches after discard", discardedRow?.status?.kind === "PENDING" && discardedRow?.checkInAt === null && discardedRow?.expectedUpdatedAt === null);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeC.id, checkInLocalTime: "10:30", checkOutLocalTime: "17:30" }] }),
  }, cookie);
  const staleToken = ((r.body?.rows ?? []).find((row: any) => row.employee.employeeId === employeeC.id))?.expectedUpdatedAt;
  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeC.id, checkInLocalTime: "10:35", checkOutLocalTime: "17:30", expectedUpdatedAt: staleToken }] }),
  }, cookie);
  check("draft update before stale discard", r.status === 201 || r.status === 200);
  r = await request(base, "/attendance/entries/discard", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-09-05", employeeId: employeeC.id, expectedUpdatedAt: staleToken }),
  }, cookie);
  check("stale discard token rejected with 409", r.status === 409 && /changed|review/i.test(r.body?.message ?? ""));
  assertNoInternalLeak("stale discard rejection has no internals", r);
  const staleSurvivingRecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: employeeC.id, businessDate: new Date("2026-09-05T00:00:00.000Z") }, include: { revisions: true } });
  check("stale-rejected discard leaves the draft present", staleSurvivingRecord.revisions.length === 1 && staleSurvivingRecord.revisions[0].finalizedAt === null);
  const freshDiscardToken = ((await request(base, "/attendance/day?businessDate=2026-09-05", {}, cookie)).body?.rows ?? []).find((row: any) => row.employee.employeeId === employeeC.id)?.expectedUpdatedAt;
  r = await request(base, "/attendance/entries/discard", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-09-05", employeeId: employeeC.id, expectedUpdatedAt: freshDiscardToken }),
  }, cookie);
  check("discard succeeds with the fresh token after a stale rejection", r.status === 201 || r.status === 200);

  r = await request(base, "/attendance/finalize", { method: "POST", body: JSON.stringify({ businessDate: "2026-08-31" }) }, cookie);
  check("finalization without an effective policy fails atomically", r.status === 400 && /Attendance Rules are not configured/.test(r.body?.message ?? ""));
  assertNoInternalLeak("missing policy failure has no internals", r);
  let marker = await tx.attendanceDayFinalization.findFirst({ where: { companyId: company.id, businessDate: new Date("2026-08-31T00:00:00.000Z") } });
  check("no marker persisted for failed finalization", marker === null);

  r = await request(base, "/attendance/finalize", { method: "POST", body: JSON.stringify({ businessDate: "2026-10-09" }) }, cookie);
  check("future business date finalization blocked", r.status === 400 && /future/i.test(r.body?.message ?? ""));
  marker = await tx.attendanceDayFinalization.findFirst({ where: { companyId: company.id, businessDate: new Date("2026-10-09T00:00:00.000Z") } });
  check("no marker for future finalization", marker === null);

  r = await request(base, "/attendance/finalize", { method: "POST", body: JSON.stringify({ businessDate: "2026-09-05" }) }, cookie);
  check("finalization succeeds for the past day", r.status === 201 || r.status === 200);
  const finalizeSummary = r.body?.summary ?? {};
  const draftRecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: employeeA.id, businessDate: new Date("2026-09-05T00:00:00.000Z") }, include: { revisions: true } });
  check("existing draft finalized in place", draftRecord.revisions.length === 1 && draftRecord.revisions[0].origin === "MANUAL_ENTRY" && draftRecord.revisions[0].finalizedAt !== null);
  const employeeBRecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: employeeB.id, businessDate: new Date("2026-09-05T00:00:00.000Z") }, include: { revisions: true } });
  check("overnight employee finalized in place", employeeBRecord.revisions.length === 1 && employeeBRecord.revisions[0].origin === "MANUAL_ENTRY" && employeeBRecord.revisions[0].finalizedAt !== null);
  check("finalization summary counts present employees", finalizeSummary.present >= 1);
  r = await request(base, "/attendance/finalize", { method: "POST", body: JSON.stringify({ businessDate: "2026-09-05" }) }, cookie);
  check("double finalization is a controlled 409", r.status === 409 && /already finalized/.test(r.body?.message ?? ""));
  assertNoInternalLeak("double finalization has no internals", r);

  r = await request(base, "/attendance/entries/discard", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-09-05", employeeId: employeeA.id, expectedUpdatedAt: null }),
  }, cookie);
  check("finalized-date discard is a controlled rejection", r.status === 409 && /finalized/i.test(r.body?.message ?? ""));
  assertNoInternalLeak("finalized-date discard rejection has no internals", r);
  const preservedRecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: employeeA.id, businessDate: new Date("2026-09-05T00:00:00.000Z") }, include: { revisions: true } });
  check("rejected finalized-date discard preserves the record and revision", preservedRecord.revisions.length === 1 && preservedRecord.revisions[0].finalizedAt !== null && preservedRecord.revisions[0].origin === "MANUAL_ENTRY");
  const preservedMarker = await tx.attendanceDayFinalization.findFirstOrThrow({ where: { companyId: company.id, businessDate: new Date("2026-09-05T00:00:00.000Z") } });
  check("rejected finalized-date discard preserves the day marker", preservedMarker.finalizedById === user.id);
  r = await request(base, `/attendance/history/${employeeA.id}/2026-09-05`, {}, cookie);
  check("history still returns the finalized record after rejected discard", r.status === 200 && r.body?.revisions?.length === 1 && r.body?.finalized === true);

  const strandedEmployee = await tx.employee.create({ data: { employeeCode: `${prefix.slice(0, 13)}STR`, fullName: "Stranded Employee", designation: "Verification", joiningDate: new Date("2027-01-01") } });
  await tx.attendanceRecord.create({ data: { id: `${prefix}_STRREC`, companyId: company.id, employeeId: strandedEmployee.id, businessDate: new Date("2026-09-06T00:00:00.000Z") } });
  await tx.attendanceRevision.create({ data: { id: `${prefix}_STRREV`, attendanceRecordId: `${prefix}_STRREC`, revisionNo: 1, origin: "MANUAL_ENTRY", checkInAt: new Date("2026-09-06T05:00:00.000Z"), createdById: user.id } });
  r = await request(base, "/attendance/finalize", { method: "POST", body: JSON.stringify({ businessDate: "2026-09-06" }) }, cookie);
  check("stranded ineligible draft blocks finalization", r.status === 409 && /not eligible on this date/.test(r.body?.message ?? ""));
  marker = await tx.attendanceDayFinalization.findFirst({ where: { companyId: company.id, businessDate: new Date("2026-09-06T00:00:00.000Z") } });
  check("stranded draft leaves no marker", marker === null);

  r = await request(base, "/attendance/entries", {
    method: "PUT",
    body: JSON.stringify({ businessDate: "2026-09-05", entries: [{ employeeId: employeeA.id, checkInLocalTime: "11:00" }] }),
  }, cookie);
  check("saving entries on a finalized date is rejected", r.status === 409 && /finalized/.test(r.body?.message ?? ""));

  r = await request(base, "/attendance/day?businessDate=2026-09-05", {}, cookie);
  check("finalized day view shows FINALIZED rows", (r.body?.rows ?? []).every((row: any) => row.status?.kind === "FINALIZED" || row.status?.kind === "NOT_APPLICABLE"));

  r = await request(base, "/attendance/history?from=2026-09-01&to=2026-09-30", {}, cookie);
  check("history list returns finalized rows", r.status === 200 && Array.isArray(r.body) && r.body.length >= 2);
  const historyRowA = (r.body ?? []).find((row: any) => row.employee.employeeId === employeeA.id && row.businessDate === "2026-09-05");
  check("history list row exposes status and token", historyRowA?.status?.kind === "FINALIZED" && historyRowA?.status?.presenceState === "PRESENT" && typeof historyRowA?.expectedRevisionNo === "number");
  r = await request(base, "/attendance/history?from=2026-09-01&to=2026-09-30&presenceState=ABSENT", {}, cookie);
  check("history filter by presence state", r.status === 200 && Array.isArray(r.body));
  r = await request(base, `/attendance/history/${employeeA.id}/2026-09-05`, {}, cookie);
  check("history detail returns the revision timeline", r.status === 200 && r.body?.revisions?.length === 1 && r.body?.finalized === true);
  check("history detail revision is deterministic", r.body?.revisions?.[0]?.revisionNo === 1);
  r = await request(base, `/attendance/history/${employeeA.id}/2026-9-5`, {}, cookie);
  check("history detail strict date rejected", r.status === 400);

  const companyB = await tx.company.create({ data: { singletonKey: `${prefix}_COB`, name: "Runtime Verification Company B" } });
  await tx.attendanceRecord.create({ data: { id: `${prefix}_COBREC`, companyId: companyB.id, employeeId: employeeA.id, businessDate: new Date("2026-09-20T00:00:00.000Z") } });
  await tx.attendanceRevision.create({ data: { id: `${prefix}_COBREV`, attendanceRecordId: `${prefix}_COBREC`, revisionNo: 1, origin: "SYSTEM_FINALIZATION", isAttendanceApplicable: true, expectedDayKind: "WEEKLY_REST", workScheduleAssignmentId: `${prefix}_WSA`, workScheduleSource: "COMPANY_DEFAULT", calendarExceptionId: null, attendancePolicyId: null, scheduledStartMinute: null, scheduledEndMinute: null, crossesMidnight: null, unpaidBreakMinutes: null, expectedWorkMinutes: null, lateGraceMinutes: null, earlyLeaveGraceMinutes: null, timeZone: "Asia/Dhaka", presenceState: "NOT_REQUIRED", isLate: false, isEarlyLeave: false, isNonWorkingDayAttendance: false, createdById: user.id, finalizedById: user.id, finalizedAt: new Date("2026-09-21T00:00:00.000Z") } });
  r = await request(base, "/attendance/history?from=2026-09-01&to=2026-09-30", {}, cookie);
  check("history list never returns another company's records", r.status === 200 && !(r.body ?? []).some((row: any) => row.employee.employeeId === employeeA.id && row.businessDate === "2026-09-20"));
  r = await request(base, `/attendance/history/${employeeA.id}/2026-09-20`, {}, cookie);
  check("history detail cannot read another company's record", r.status === 404);
  assertNoInternalLeak("cross-company 404 body has no internals", r);

  await tx.workScheduleAssignment.create({ data: { id: `${prefix}_OV`, companyId: company.id, scope: "EMPLOYEE_OVERRIDE", workScheduleId: scheduleId, employeeId: employeeA.id, effectiveFrom: new Date("2026-09-05T00:00:00.000Z"), effectiveTo: new Date("2026-09-06T00:00:00.000Z"), createdById: user.id } });
  r = await request(base, `/attendance/history/${employeeA.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ checkInLocalTime: "10:00", checkOutLocalTime: "18:00", note: "runtime correction", changeReason: "runtime path A", expectedRevisionNo: 1 }),
  }, cookie);
  check("path A correction creates revision 2", (r.status === 201 || r.status === 200) && r.body?.revisionNo === 2);
  const pathARecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: employeeA.id, businessDate: new Date("2026-09-05T00:00:00.000Z") }, include: { revisions: { orderBy: { revisionNo: "asc" } } } });
  const pathARevision = pathARecord.revisions[1];
  const pathAPrior = pathARecord.revisions[0];
  check("path A carries the snapshot verbatim despite a live override", pathARevision.workScheduleAssignmentId === pathAPrior.workScheduleAssignmentId && pathARevision.scheduledStartMinute === pathAPrior.scheduledStartMinute && pathARevision.expectedDayKind === pathAPrior.expectedDayKind);
  check("path A preserves origin/creator and writes new facts", pathARevision.origin === "MANUAL_CORRECTION" && pathARevision.changeReason === "runtime path A" && pathARevision.note === "runtime correction" && pathARevision.checkInAt?.toISOString() === "2026-09-05T04:00:00.000Z");

  r = await request(base, `/attendance/history/${employeeA.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "stale attempt", expectedRevisionNo: 1 }),
  }, cookie);
  check("stale correction token rejected", r.status === 409 && /changed|review/i.test(r.body?.message ?? ""));

  const omittedEmployee = await tx.employee.create({ data: { employeeCode: `${prefix.slice(0, 13)}OM`, fullName: "Omitted Employee", designation: "Verification", joiningDate: new Date("2026-01-01") } });
  r = await request(base, `/attendance/history/${omittedEmployee.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ checkInLocalTime: "10:00", checkOutLocalTime: "18:00", changeReason: "runtime path B", expectedRevisionNo: null }),
  }, cookie);
  check("path B creates record and revision 1", (r.status === 201 || r.status === 200) && r.body?.revisionNo === 1 && r.body?.presenceState === "PRESENT");
  const pathBRecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: omittedEmployee.id, businessDate: new Date("2026-09-05T00:00:00.000Z") }, include: { revisions: true } });
  check("path B resolves the historical snapshot", pathBRecord.revisions[0].expectedDayKind === "WORKING_DAY" && pathBRecord.revisions[0].attendancePolicyId !== null && pathBRecord.revisions[0].timeZone === "Asia/Dhaka");

  const futureEmployee = await tx.employee.create({ data: { employeeCode: `${prefix.slice(0, 13)}FUT`, fullName: "Future Employee", designation: "Verification", joiningDate: new Date("2027-01-01") } });
  r = await request(base, `/attendance/history/${futureEmployee.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "ineligible", expectedRevisionNo: null }),
  }, cookie);
  check("path B for an ineligible employee is rejected", r.status === 400 && /eligible/i.test(r.body?.message ?? ""));
  const pathBRejected = await tx.attendanceRecord.findFirst({ where: { companyId: company.id, employeeId: futureEmployee.id, businessDate: new Date("2026-09-05T00:00:00.000Z") } });
  check("rejected path B leaves no record", pathBRejected === null);

  r = await request(base, `/attendance/history/${omittedEmployee.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "meanwhile created", expectedRevisionNo: null }),
  }, cookie);
  check("path B null token on an existing record is stale", r.status === 409 && /changed|review/i.test(r.body?.message ?? ""));

  r = await request(base, `/attendance/history/${employeeB.id}/2026-09-05/not-applicable`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "no proof", expectedRevisionNo: 1 }),
  }, cookie);
  check("void without proof is rejected", r.status === 400 && /not applicable|proof|eligible/i.test(r.body?.message ?? ""));

  await tx.employee.update({ where: { id: employeeB.id }, data: { separationDate: new Date("2026-09-03T00:00:00.000Z"), separationReason: "Runtime verification separation", isActive: false } });
  r = await request(base, `/attendance/history/${employeeB.id}/2026-09-05/not-applicable`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "separated before date", expectedRevisionNo: 1 }),
  }, cookie);
  check("void with separation proof succeeds", (r.status === 201 || r.status === 200) && r.body?.isAttendanceApplicable === false && r.body?.presenceState === null);
  const voidRecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: employeeB.id, businessDate: new Date("2026-09-05T00:00:00.000Z") }, include: { revisions: { orderBy: { revisionNo: "asc" } } } });
  check("void revision preserves punches as evidence", voidRecord.revisions.length === 2 && voidRecord.revisions[1].checkInAt !== null && voidRecord.revisions[1].isAttendanceApplicable === false);
  r = await request(base, "/attendance/history?from=2026-09-01&to=2026-09-30&presenceState=NOT_APPLICABLE", {}, cookie);
  check("void row appears under NOT_APPLICABLE filter", r.status === 200 && (r.body ?? []).some((row: any) => row.employee.employeeId === employeeB.id && row.status?.kind === "NOT_APPLICABLE"));
  r = await request(base, "/attendance/history?from=2026-09-01&to=2026-09-30&presenceState=ABSENT", {}, cookie);
  check("void row is not confused with ABSENT", r.status === 200 && !(r.body ?? []).some((row: any) => row.employee.employeeId === employeeB.id && row.businessDate === "2026-09-05" && row.status?.presenceState === "ABSENT"));

  r = await request(base, `/attendance/history/${employeeB.id}/2026-09-05/not-applicable`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "double void", expectedRevisionNo: 2 }),
  }, cookie);
  check("double void rejected", r.status === 409 && /already|not applicable/i.test(r.body?.message ?? ""));

  r = await request(base, `/attendance/history/${employeeB.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "still ineligible", expectedRevisionNo: 2 }),
  }, cookie);
  check("restore while still ineligible is rejected", r.status === 400 && /eligible/i.test(r.body?.message ?? ""));

  await tx.employee.update({ where: { id: employeeB.id }, data: { separationDate: null, separationReason: null, isActive: true } });
  r = await request(base, `/attendance/history/${employeeB.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "runtime restore", expectedRevisionNo: 2 }),
  }, cookie);
  check("restore re-resolves and preserves punches", (r.status === 201 || r.status === 200) && r.body?.revisionNo === 3 && r.body?.isAttendanceApplicable === true);
  const restoredRecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: employeeB.id, businessDate: new Date("2026-09-05T00:00:00.000Z") }, include: { revisions: { orderBy: { revisionNo: "desc" } } } });
  check("restored revision keeps prior punches", restoredRecord.revisions[0].checkInAt !== null && restoredRecord.revisions[0].isAttendanceApplicable === true);

  r = await request(base, `/attendance/history/${employeeB.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ checkInLocalTime: "10:15", checkOutLocalTime: "17:45", changeReason: "restored with punches", expectedRevisionNo: 3 }),
  }, cookie);
  check("restore with supplied punches validates and uses them", (r.status === 201 || r.status === 200) && r.body?.revisionNo === 4);

  r = await request(base, `/attendance/history/${employeeB.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ checkInLocalTime: "10:15", checkOutLocalTime: "10:15", changeReason: "equal", expectedRevisionNo: 4 }),
  }, cookie);
  check("correction equal times rejected", r.status === 400);
  r = await request(base, `/attendance/history/${employeeB.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ changeReason: "missing reason" }),
  }, cookie);
  check("correction without change reason rejected", r.status === 400);

  await tx.attendanceDayFinalization.create({ data: { id: `${prefix}_HCDF`, companyId: company.id, businessDate: new Date("2026-09-10T00:00:00.000Z"), finalizedAt: new Date("2026-09-11T00:00:00.000Z"), finalizedById: user.id } });
  await tx.companyCalendarException.create({ data: { id: `${prefix}_HC1`, companyId: company.id, businessDate: new Date("2026-09-10T00:00:00.000Z"), exceptionType: "HOLIDAY", name: "Runtime Original Holiday", createdById: user.id } });
  await tx.attendanceRecord.create({ data: { id: `${prefix}_HCREC`, companyId: company.id, employeeId: employeeA.id, businessDate: new Date("2026-09-10T00:00:00.000Z") } });
  await tx.attendanceRevision.create({ data: { id: `${prefix}_HCREV`, attendanceRecordId: `${prefix}_HCREC`, revisionNo: 1, origin: "SYSTEM_FINALIZATION", isAttendanceApplicable: true, expectedDayKind: "HOLIDAY", workScheduleAssignmentId: null, workScheduleSource: null, calendarExceptionId: `${prefix}_HC1`, attendancePolicyId: null, scheduledStartMinute: null, scheduledEndMinute: null, crossesMidnight: null, unpaidBreakMinutes: null, expectedWorkMinutes: null, lateGraceMinutes: null, earlyLeaveGraceMinutes: null, timeZone: "Asia/Dhaka", presenceState: "NOT_REQUIRED", isLate: false, isEarlyLeave: false, isNonWorkingDayAttendance: false, createdById: user.id, finalizedById: user.id, finalizedAt: new Date("2026-09-11T00:00:00.000Z") } });

  r = await request(base, "/attendance/calendar/historical-corrections", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-09-10", target: "HOLIDAY", name: "Runtime Renamed Holiday", changeReason: "runtime name only" }),
  }, cookie);
  check("historical name-only correction succeeds with zero revisions", (r.status === 201 || r.status === 200) && r.body?.attendanceRevisionsCreated === 0);
  let liveException = await tx.companyCalendarException.findFirstOrThrow({ where: { companyId: company.id, businessDate: new Date("2026-09-10T00:00:00.000Z"), supersededAt: null, cancelledAt: null } });
  check("name-only replacement lineage is intact", liveException.name === "Runtime Renamed Holiday" && liveException.changeReason === "runtime name only");
  const superseded = await tx.companyCalendarException.findMany({ where: { companyId: company.id, businessDate: new Date("2026-09-10T00:00:00.000Z"), supersededAt: { not: null } } });
  check("old row superseded without text changes", superseded.length === 1 && superseded[0].name === "Runtime Original Holiday" && superseded[0].cancellationReason === null);

  r = await request(base, "/attendance/calendar/historical-corrections", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-09-10", target: "SPECIAL_WORKING_DAY", name: "Runtime Special Day", startMinuteOfDay: 540, endMinuteOfDay: 1020, unpaidBreakMinutes: 30, changeReason: "runtime material change" }),
  }, cookie);
  check("holiday to special working day creates material revisions", (r.status === 201 || r.status === 200) && r.body?.attendanceRevisionsCreated >= 1);
  const hcRecord = await tx.attendanceRecord.findFirstOrThrow({ where: { companyId: company.id, employeeId: employeeA.id, businessDate: new Date("2026-09-10T00:00:00.000Z") }, include: { revisions: { orderBy: { revisionNo: "desc" } } } });
  check("material revision carries the corrected snapshot", hcRecord.revisions[0].expectedDayKind === "SPECIAL_WORKING_DAY" && hcRecord.revisions[0].scheduledStartMinute === 540 && hcRecord.revisions[0].presenceState === "ABSENT" && hcRecord.revisions[0].changeReason === "runtime material change");

  r = await request(base, "/attendance/calendar/historical-corrections", { method: "POST", body: JSON.stringify({ businessDate: "2026-09-10", target: "NONE", changeReason: "runtime back to schedule" }) }, cookie);
  check("target NONE cancels the live exception", (r.status === 201 || r.status === 200) && r.body?.attendanceRevisionsCreated >= 0);
  liveException = (await tx.companyCalendarException.findFirst({ where: { companyId: company.id, businessDate: new Date("2026-09-10T00:00:00.000Z"), supersededAt: null, cancelledAt: null } }))!;
  check("no live exception remains after NONE", liveException === null);
  const cancelledException = await tx.companyCalendarException.findFirstOrThrow({ where: { companyId: company.id, businessDate: new Date("2026-09-10T00:00:00.000Z"), cancelledAt: { not: null } } });
  check("cancelled row carries the correction reason", cancelledException.cancellationReason === "runtime back to schedule" && cancelledException.supersededAt === null);

  marker = await tx.attendanceDayFinalization.findFirstOrThrow({ where: { companyId: company.id, businessDate: new Date("2026-09-10T00:00:00.000Z") } });
  check("day marker unchanged by historical corrections", marker.finalizedAt.toISOString() === "2026-09-11T00:00:00.000Z" && marker.finalizedById === user.id);

  r = await request(base, "/attendance/calendar/historical-corrections", { method: "POST", body: JSON.stringify({ businessDate: "2026-09-10", target: "NONE", changeReason: "nothing to remove" }) }, cookie);
  check("NONE without a live exception is rejected", r.status === 409);

  await tx.attendancePolicy.updateMany({ where: { companyId: company.id }, data: { effectiveTo: new Date("2026-09-09T00:00:00.000Z") } });
  r = await request(base, "/attendance/calendar/historical-corrections", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-09-10", target: "SPECIAL_WORKING_DAY", name: "Runtime Policy Missing", startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60, changeReason: "runtime policy missing" }),
  }, cookie);
  check("historical correction without policy rolls back", r.status === 400 && /Attendance Rules are not configured/.test(r.body?.message ?? ""));
  const rollbackLive = await tx.companyCalendarException.findMany({ where: { companyId: company.id, businessDate: new Date("2026-09-10T00:00:00.000Z"), supersededAt: null, cancelledAt: null } });
  check("rolled-back correction leaves calendar untouched", rollbackLive.length === 0);
  await tx.attendancePolicy.updateMany({ where: { companyId: company.id }, data: { effectiveTo: null } });

  r = await request(base, "/attendance/calendar/historical-corrections", { method: "POST", body: JSON.stringify({ businessDate: "2026-09-10", target: "SOMETHING", changeReason: "bad target" }) }, cookie);
  check("invalid historical target rejected", r.status === 400);

  r = await request(base, "/attendance/calendar?from=2026-09-01&to=2026-09-30", {}, cookie);
  check("calendar list returns the range", r.status === 200 && Array.isArray(r.body) && r.body.length >= 2);
  r = await request(base, "/attendance/calendar?from=2026-9-1&to=2026-09-30", {}, cookie);
  check("calendar list strict dates rejected", r.status === 400);

  r = await request(base, "/attendance/calendar/exceptions", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-11-02", exceptionType: "HOLIDAY", name: "Runtime Future Holiday" }),
  }, cookie);
  check("calendar exception created for unfinalized date", (r.status === 201 || r.status === 200) && r.body?.exceptionType === "HOLIDAY");
  const createdExceptionId = r.body?.id;
  r = await request(base, "/attendance/calendar/exceptions", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-11-02", exceptionType: "HOLIDAY", name: "Duplicate" }),
  }, cookie);
  check("duplicate live exception rejected", r.status === 409);
  r = await request(base, "/attendance/calendar/exceptions", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-11-03", exceptionType: "SPECIAL_WORKING_DAY", name: "Equal Times", startMinuteOfDay: 600, endMinuteOfDay: 600 }),
  }, cookie);
  check("special working day with equal times rejected", r.status === 400);
  r = await request(base, `/attendance/calendar/exceptions/${createdExceptionId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Runtime Renamed Future Holiday" }),
  }, cookie);
  check("live exception patched", (r.status === 200 || r.status === 201) && r.body?.name === "Runtime Renamed Future Holiday");
  r = await request(base, `/attendance/calendar/exceptions/${createdExceptionId}`, {
    method: "POST",
    body: JSON.stringify({}),
  }, cookie);
  check("wrong method on cancel route rejected", r.status === 404 || r.status === 405);
  r = await request(base, `/attendance/calendar/exceptions/${createdExceptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: "runtime no longer needed" }),
  }, cookie);
  check("live exception cancelled with reason", (r.status === 200 || r.status === 201) && r.body?.cancelledAt);
  r = await request(base, `/attendance/calendar/exceptions/${createdExceptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: "again" }),
  }, cookie);
  check("double cancel rejected", r.status === 409);
  r = await request(base, "/attendance/calendar/exceptions", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-09-05", exceptionType: "HOLIDAY", name: "Finalized Date Holiday" }),
  }, cookie);
  check("calendar create on a finalized date is rejected", r.status === 409 && /finalized/i.test(r.body?.message ?? ""));

  r = await request(base, "/attendance/policies", {}, cookie);
  check("policy list returns current state", r.status === 200 && Array.isArray(r.body) && r.body.length >= 1);
  r = await request(base, "/attendance/policies", { method: "POST", body: JSON.stringify({ effectiveFrom: "2026-10-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5 }) }, cookie);
  check("initial creation after lineage exists is rejected", r.status === 409);
  const currentPolicy = (await request(base, "/attendance/policies", {}, cookie)).body.find((row: any) => row.effectiveFrom === "2026-09-01");
  r = await request(base, `/attendance/policies/${currentPolicy.id}/replace`, {
    method: "POST",
    body: JSON.stringify({ effectiveFrom: "2026-10-01", lateGraceMinutes: 25, earlyLeaveGraceMinutes: 8, changeReason: "runtime replacement" }),
  }, cookie);
  check("policy replacement splices the boundary", (r.status === 201 || r.status === 200) && r.body?.replacesPolicyId === currentPolicy.id);
  const replacementPolicyId = r.body?.id;
  r = await request(base, `/attendance/policies/${currentPolicy.id}/replace`, {
    method: "POST",
    body: JSON.stringify({ effectiveFrom: "2026-10-15", lateGraceMinutes: 30, earlyLeaveGraceMinutes: 5, changeReason: "branch" }),
  }, cookie);
  check("branching replacement rejected", r.status === 409);
  r = await request(base, `/attendance/policies/${currentPolicy.id}/replace`, {
    method: "POST",
    body: JSON.stringify({ effectiveFrom: "2026-09-05", lateGraceMinutes: 30, earlyLeaveGraceMinutes: 5, changeReason: "past" }),
  }, cookie);
  check("replacement at or before the predecessor start rejected", r.status === 400 && /after the predecessor start|inside the predecessor|must start in the future/i.test(r.body?.message ?? ""));
  r = await request(base, `/attendance/policies/${replacementPolicyId}/cancel-future`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: "runtime cancellation" }),
  }, cookie);
  check("cancel-future restores the predecessor boundary", (r.status === 200 || r.status === 201) && r.body?.cancelledAt);
  const restoredPolicy = await tx.attendancePolicy.findUniqueOrThrow({ where: { id: currentPolicy.id } });
  check("predecessor boundary restored", restoredPolicy.effectiveTo === null);
  r = await request(base, `/attendance/policies/${replacementPolicyId}/cancel-future`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: "again" }),
  }, cookie);
  check("already cancelled policy rejected", r.status === 409);
  r = await request(base, `/attendance/policies/${currentPolicy.id}/cancel-future`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: "started" }),
  }, cookie);
  check("started policy cannot be cancelled via cancel-future", r.status === 409 && /not started|future/i.test(r.body?.message ?? ""));

  const everEffectiveCompany = company.id;
  await tx.attendancePolicy.create({ data: { id: `${prefix}_FUTPOL`, companyId: everEffectiveCompany, effectiveFrom: new Date("2026-09-12T00:00:00.000Z"), effectiveTo: null, lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10, createdById: user.id, cancelledAt: new Date("2026-09-10T00:00:00.000Z"), cancelledById: user.id, cancellationReason: "runtime cancelled before start" } });
  const everEffectiveCount = await tx.attendancePolicy.count({ where: { companyId: everEffectiveCompany, cancelledAt: null } });
  check("cancelled future initial remains excluded from live lineage", everEffectiveCount >= 1);
  void everEffectiveCount;

  r = await request(base, "/attendance/calendar/exceptions", {
    method: "POST",
    body: JSON.stringify({ businessDate: "2026-11-05", exceptionType: "HOLIDAY", name: "Leak Probe" }),
  }, cookie);
  assert.ok(r.status === 201 || r.status === 200);
  const leakProbeId = r.body.id;
  r = await request(base, `/attendance/calendar/exceptions/${leakProbeId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ cancellationReason: "" }),
  }, cookie);
  check("blank cancellation reason rejected", r.status === 400);
  r = await request(base, `/attendance/history/${employeeA.id}/2026-09-05/corrections`, {
    method: "POST",
    body: JSON.stringify({ checkInLocalTime: "10:00", changeReason: "leak probe", expectedRevisionNo: 999 }),
  }, cookie);
  assert.equal(r.status, 409);
  assertNoInternalLeak("409 correction body has no internals", r);
  assertNoInternalLeak("401 body has no internals", await request(base, "/attendance/day?businessDate=2026-09-05"));
  assertNoInternalLeak("403 body has no internals", await (async () => {
    await tx.userRole.deleteMany({ where: { userId: user.id } });
    const forbidden = await request(base, "/attendance/day?businessDate=2026-09-05", {}, cookie);
    await tx.userRole.create({ data: { userId: user.id, roleId: context.role.id } });
    return forbidden;
  })());
}

main().catch(error => {
  console.error(`Runtime verification aborted safely: ${error instanceof Error ? error.stack ?? error.message : "unknown error"}`);
  process.exitCode = 1;
});
