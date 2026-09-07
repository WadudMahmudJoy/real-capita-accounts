import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import { hash } from "bcryptjs";
import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { assertWorkScheduleVerificationDatabase, databaseFingerprint, verificationPg } from "./work-schedule-verification";

type RuntimeResponse = { status: number; body: any; headers: Headers };
const prefix = `HR2B_RUNTIME_${randomUUID().replaceAll("-", "")}`;
const rollback = Symbol("runtime rollback");
let passed = 0, failed = 0;
function check(name: string, ok: unknown) { if (ok) { passed++; console.log(`PASS ${name}`); } else { failed++; console.log(`FAIL ${name}`); } }
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
      const savepoint = `hr2b_runtime_${++sequence}`;
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
function week() { return ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"].map(dayOfWeek => dayOfWeek === "FRIDAY" ? { dayOfWeek, isWorkingDay:false, startMinuteOfDay:null, endMinuteOfDay:null, unpaidBreakMinutes:0, crossesMidnight:false } : { dayOfWeek, isWorkingDay:true, startMinuteOfDay:600, endMinuteOfDay:1080, unpaidBreakMinutes:60, crossesMidnight:false }); }

async function main() {
  process.loadEnvFile(".env");
  const connectionString = assertWorkScheduleVerificationDatabase(process.env.DATABASE_URL);
  buildApi();
  const browser = process.argv.includes("--browser");
  const pg = verificationPg(connectionString); await pg.connect();
  try {
  const before = await databaseFingerprint(pg);
  const [{ PrismaService }, ac, as, ag, rg, wc, ws] = await Promise.all([
    import("../apps/api/dist/prisma/prisma.service.js"), import("../apps/api/dist/auth/auth.controller.js"),
    import("../apps/api/dist/auth/auth.service.js"), import("../apps/api/dist/auth/guards/auth.guard.js"),
    import("../apps/api/dist/auth/guards/roles.guard.js"), import("../apps/api/dist/work-schedule/work-schedule.controller.js"),
    import("../apps/api/dist/work-schedule/work-schedule.service.js"),
  ]);
  const prisma = new PrismaService();
  try {
    await prisma.$transaction(async (tx: Record<PropertyKey, any>) => {
      const scoped = scopedPrisma(tx);
      const company = await tx.company.create({ data: { name: "HR2B Runtime Verification Company" } });
      const role = await tx.role.findUniqueOrThrow({ where: { code: "ACCOUNTANT" } });
      const password = `Runtime-${randomUUID()}!`;
      const user = browser ? await tx.user.findUniqueOrThrow({ where: { email: "accountant@realcapita.local" } }) : await tx.user.create({ data: { email: `${prefix.toLowerCase()}@example.invalid`, fullName: "HR2B Runtime Accountant", passwordHash: await hash(password, 4), roles: { create: { roleId: role.id } } } });
      const employee = await tx.employee.create({ data: { employeeCode: prefix.slice(-20), fullName: "HR2B Runtime Employee", designation: "Verification", joiningDate: new Date("2026-01-01") } });
      const controllers: any[] = [ac.AuthController, wc.WorkScheduleController];
      const providers: any[] = [{ provide: PrismaService, useValue: scoped }, as.AuthService, ag.AuthGuard, rg.RolesGuard, ws.WorkScheduleService];
      if (browser) {
        const [ec, es, dc, ds, sc, ss, calc] = await Promise.all([
          import("../apps/api/dist/employee/employee.controller.js"), import("../apps/api/dist/employee/employee.service.js"),
          import("../apps/api/dist/department/department.controller.js"), import("../apps/api/dist/department/department.service.js"),
          import("../apps/api/dist/salary/salary.controller.js"), import("../apps/api/dist/salary/salary.service.js"), import("../apps/api/dist/salary/salary-calculator.js"),
        ]);
        controllers.push(ec.EmployeeController, dc.DepartmentController, sc.SalaryController);
        providers.push(es.EmployeeService, ds.DepartmentService, ss.SalaryService, calc.SalaryCalculator);
      }
      class RuntimeModule {}
      Module({ imports: [JwtModule.register({})], controllers, providers })(RuntimeModule);
      const app = await NestFactory.create(RuntimeModule, { logger: false });
      app.use(cookieParser()); app.enableCors({ origin: "http://localhost:3000", credentials: true });
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      try { await app.listen(browser ? 4000 : 0, "127.0.0.1"); }
      catch { await app.close(); throw new Error(browser ? "Browser verification port 4000 is unavailable; no process was terminated." : "Runtime HTTP host could not start."); }
      const base = `http://127.0.0.1:${(app.getHttpServer().address() as {port:number}).port}`;
      try {
        if (browser) {
          console.log("READY http://localhost:4000");
          await new Promise<void>(resolve => { process.once("SIGINT", resolve); process.once("SIGTERM", resolve); });
        } else {
          let r = await request(base, "/work-schedules"); check("real AuthGuard returns 401", r.status === 401);
          r = await request(base, "/auth/login", { method:"POST", body:JSON.stringify({ email:user.email, password }) });
          const cookie = r.headers.get("set-cookie")?.split(";",1)[0]; check("normal production login", r.status === 200 && cookie); assert.ok(cookie);
          // Bind the freshly created session to the fixture company, exactly
          // as POST /company/:id/switch does in production. The harness acts
          // as the trusted office switch for this synthetic company id.
          const cookieToken = cookie?.split("=")[1];
          const jwtPayload = JSON.parse(Buffer.from(cookieToken.split(".")[1], "base64url").toString("utf8"));
          await tx.authSession.update({ where: { id: jwtPayload.sid }, data: { activeCompanyId: company.id } });
          r = await request(base, "/work-schedules?companyId=client", {}, cookie); check("unknown system query rejected", r.status === 400);
          r = await request(base, "/work-schedules/effective?businessDate=2026-9-1", {}, cookie); check("strict date rejected by compiled DTO metadata", r.status === 400);
          r = await request(base, "/work-schedules", { method:"POST", body:JSON.stringify({ companyId:"client", name:"Unsafe", days:week() }) }, cookie); check("unknown system body rejected", r.status === 400);
          const duplicate = week(); duplicate[6] = { ...duplicate[5] };
          r = await request(base, "/work-schedules/assignments", { method:"POST", body:JSON.stringify({ scope:"COMPANY_DEFAULT", effectiveFrom:"2026-09-01", newSchedule:{ code:"STANDARD_OFFICE", name:"Standard Office Schedule", days:duplicate } }) }, cookie); check("nested duplicate weekday rejected", r.status === 400);
          r = await request(base, "/work-schedules/assignments", { method:"POST", body:JSON.stringify({ scope:"COMPANY_DEFAULT", effectiveFrom:"2026-09-01", newSchedule:{ code:"STANDARD_OFFICE", name:"Standard Office Schedule", days:week() } }) }, cookie);
          const initial = r.body; check("atomic approved initial setup", r.status === 201 && initial.effectiveFrom === "2026-09-01");
          r = await request(base, "/work-schedules/effective?businessDate=2026-09-01", {}, cookie); check("effective default resolution", r.status === 200 && r.body.kind === "RESOLVED" && r.body.timeZone === "Asia/Dhaka");
          r = await request(base, `/work-schedules/${initial.workSchedule.id}`, {}, cookie); check("single no-store view", r.status === 200 && r.headers.get("cache-control") === "no-store");
          r = await request(base, "/work-schedules", {}, cookie); check("schedule list", r.status === 200 && Array.isArray(r.body) && r.body.length === 1);
          r = await request(base, `/work-schedules/${initial.workSchedule.id}`, { method:"PATCH", body:JSON.stringify({ description:"Runtime metadata update" }) }, cookie); check("metadata update", r.status === 200 && r.body.description === "Runtime metadata update");
          r = await request(base, `/work-schedules/assignments/${initial.id}/replace`, { method:"POST", body:JSON.stringify({ effectiveFrom:"2030-01-01", newSchedule:{ code:"FUTURE_OFFICE", name:"Future Office", days:week() }, changeReason:"Runtime replacement", expectedUpdatedAt:initial.updatedAt }) }, cookie);
          const replacement = r.body; check("default replacement", r.status === 201 && replacement.replacesAssignmentId === initial.id);
          r = await request(base, `/work-schedules/assignments/${replacement.id}/cancel`, { method:"POST", body:JSON.stringify({ changeReason:"Runtime cancellation", expectedUpdatedAt:replacement.updatedAt }) }, cookie); check("future cancellation", r.status === 201 && r.body.cancelledAt);
          r = await request(base, "/work-schedules/assignments", { method:"POST", body:JSON.stringify({ scope:"EMPLOYEE_OVERRIDE", employeeId:employee.id, workScheduleId:initial.workSchedule.id, effectiveFrom:"2031-01-01", effectiveTo:"2031-03-01" }) }, cookie);
          const override = r.body; check("Employee override", r.status === 201 && override.employeeId === employee.id);
          r = await request(base, `/work-schedules/assignments/${override.id}/end`, { method:"POST", body:JSON.stringify({ effectiveTo:"2031-02-01", changeReason:"Runtime end", expectedUpdatedAt:override.updatedAt }) }, cookie); check("override end", r.status === 201 && r.body.effectiveTo === "2031-02-01");
          r = await request(base, "/work-schedules", { method:"POST", body:JSON.stringify({ code:"STANDARD_OFFICE", name:"Duplicate", days:week() }) }, cookie); check("controlled conflict privacy", r.status === 409 && !/prisma|sql|constraint|database/i.test(JSON.stringify(r.body)));
          await tx.userRole.deleteMany({ where: { userId:user.id } }); r = await request(base, "/work-schedules", {}, cookie); check("real RolesGuard returns 403", r.status === 403); await tx.userRole.create({ data:{ userId:user.id, roleId:role.id } });
        }
      } finally { await app.close(); }
      throw rollback;
    }, { timeout: browser ? 86_400_000 : 120_000 });
  } catch (error) { if (error !== rollback) throw error; } finally { await prisma.$disconnect(); }
  const after = await databaseFingerprint(pg); assert.deepEqual(after, before); check("all table fingerprints restored", true);
  for (const table of Object.keys(after)) { const id = `"${table.replaceAll('"','""')}"`; const residue = await pg.query(`SELECT count(*)::text count FROM public.${id} t WHERE row_to_json(t)::text LIKE $1`, [`%${prefix}%`]); assert.equal(residue.rows[0].count,"0"); }
  check("fixture residue zero", true);
  } finally { await pg.end(); }
  if (!browser) { console.log(`Work schedule runtime verification: ${passed} PASS, ${failed} FAIL`); if (failed) process.exitCode = 1; }
}
main().catch(error => { console.error(`Runtime verification aborted safely: ${error instanceof Error ? error.stack ?? error.message : "unknown error"}`); process.exitCode = 1; });
