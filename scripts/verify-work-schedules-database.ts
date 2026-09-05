import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { databaseFingerprint, rollbackOnly, verificationPg, type VerificationPg } from "./work-schedule-verification";
import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import { WorkScheduleService } from "../apps/api/src/work-schedule/work-schedule.service";

// This deliberately unprotected scaffold exists only inside the RED transaction.
// It is not a migration and is never committed to the database.
const redScaffold = `
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY');
CREATE TYPE "WorkScheduleAssignmentScope" AS ENUM ('COMPANY_DEFAULT','EMPLOYEE_OVERRIDE');
CREATE TABLE work_schedules (
 id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, code VARCHAR(32) NOT NULL, name TEXT NOT NULL,
 description TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "work_schedules_companyId_code_key" UNIQUE ("companyId",code),
 CONSTRAINT "work_schedules_id_companyId_key" UNIQUE (id,"companyId"),
 CONSTRAINT "work_schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE RESTRICT,
 CONSTRAINT "work_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES users(id) ON DELETE RESTRICT
);
CREATE TABLE work_schedule_days (
 id TEXT PRIMARY KEY, "workScheduleId" TEXT NOT NULL, "dayOfWeek" "DayOfWeek" NOT NULL,
 "isWorkingDay" BOOLEAN NOT NULL, "startMinuteOfDay" INTEGER, "endMinuteOfDay" INTEGER,
 "unpaidBreakMinutes" INTEGER NOT NULL DEFAULT 0, "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "work_schedule_days_workScheduleId_dayOfWeek_key" UNIQUE ("workScheduleId","dayOfWeek"),
 CONSTRAINT "work_schedule_days_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES work_schedules(id) ON DELETE RESTRICT
);
CREATE TABLE work_schedule_assignments (
 id TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, scope "WorkScheduleAssignmentScope" NOT NULL,
 "workScheduleId" TEXT NOT NULL, "employeeId" TEXT, "effectiveFrom" DATE NOT NULL, "effectiveTo" DATE,
 "changeReason" TEXT, "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 "cancelledAt" TIMESTAMP(3), "replacesAssignmentId" TEXT,
 CONSTRAINT "work_schedule_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE RESTRICT,
 CONSTRAINT "work_schedule_assignments_workScheduleId_companyId_fkey" FOREIGN KEY ("workScheduleId","companyId") REFERENCES work_schedules(id,"companyId") ON DELETE RESTRICT,
 CONSTRAINT "work_schedule_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES employees(id) ON DELETE RESTRICT,
 CONSTRAINT "work_schedule_assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES users(id) ON DELETE RESTRICT,
 CONSTRAINT "work_schedule_assignments_replacesAssignmentId_fkey" FOREIGN KEY ("replacesAssignmentId") REFERENCES work_schedule_assignments(id) ON DELETE RESTRICT
);`;

let passed = 0;
let failed = 0;
let sequence = 0;
const prefix = `HR2B_VERIFY_${randomUUID().replaceAll("-", "")}`;

async function probe(pg: VerificationPg, name: string, run: () => Promise<unknown>, expected?: [string, string]) {
  const savepoint = `hr2b_probe_${++sequence}`;
  await pg.query(`SAVEPOINT ${savepoint}`);
  let actual: { code?: string; constraint?: string } | undefined;
  try { await run(); } catch (error) { actual = error as typeof actual; }
  finally {
    await pg.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await pg.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
  const ok = expected ? actual?.code === expected[0] && actual?.constraint === expected[1] : !actual;
  if (ok) passed++; else failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${expected ? ` expected=${expected.join("/")} actual=${actual ? `${actual.code ?? "unknown"}/${actual.constraint ?? "none"}` : "ACCEPTED_INVALID_ROW"}` : ""}`);
}

async function fixturesAndProbes(pg: VerificationPg) {
  const c = `${prefix}_C`, c2 = `${prefix}_C2`, u = `${prefix}_U`, e = `${prefix}_E`, e2 = `${prefix}_E2`, s = `${prefix}_S`;
  await pg.query(`INSERT INTO companies (id,"singletonKey",name,"updatedAt") VALUES ($1,$1,'HR2B_VERIFY Company',now()),($2,$2,'HR2B_VERIFY Other Company',now())`, [c,c2]);
  await pg.query(`INSERT INTO users (id,email,"fullName","passwordHash","updatedAt") VALUES ($1,$2,'HR2B_VERIFY Actor','NOT_A_USABLE_PASSWORD',now())`, [u, `${prefix}@example.invalid`]);
  await pg.query(`INSERT INTO employees (id,"employeeCode","fullName",designation,"joiningDate","updatedAt") VALUES ($1,$1,'HR2B_VERIFY Employee','Verification','2026-01-01',now()),($2,$2,'HR2B_VERIFY Other Employee','Verification','2026-01-01',now())`, [e,e2]);
  const schedule = (id: string, company = c, code = "HR2B_VERIFY_S", name = "HR2B_VERIFY Schedule") => pg.query(`INSERT INTO work_schedules (id,"companyId",code,name,"createdById","updatedAt") VALUES ($1,$2,$3,$4,$5,now())`, [id,company,code,name,u]);
  await schedule(s);
  const day = (working = true, start: number | null = 540, end: number | null = 1020, rest = 60, overnight = false, weekday = "MONDAY") => pg.query(`INSERT INTO work_schedule_days (id,"workScheduleId","dayOfWeek","isWorkingDay","startMinuteOfDay","endMinuteOfDay","unpaidBreakMinutes","crossesMidnight","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`, [`${prefix}_D${++sequence}`,s,weekday,working,start,end,rest,overnight]);
  const assignment = (id: string, scope = "COMPANY_DEFAULT", employee: string | null = null, from = "2026-01-01", to: string | null = "2026-02-01", cancelled = false, company = c, predecessor: string | null = null) => pg.query(`INSERT INTO work_schedule_assignments (id,"companyId",scope,"workScheduleId","employeeId","effectiveFrom","effectiveTo","createdById","updatedAt","cancelledAt","replacesAssignmentId") VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8,now(),CASE WHEN $9 THEN now() ELSE NULL END,$10)`, [id,company,scope,s,employee,from,to,u,cancelled,predecessor]);
  const a = `${prefix}_A`, ae = `${prefix}_AE`;
  await assignment(a);
  await assignment(ae,"EMPLOYEE_OVERRIDE",e);
  const exclusionDefault: [string,string] = ["23P01","work_schedule_assignments_default_range_excl"];
  const exclusionEmployee: [string,string] = ["23P01","work_schedule_assignments_employee_range_excl"];
  await probe(pg,"default overlap", () => assignment(`${prefix}_O`),exclusionDefault);
  await probe(pg,"adjacent default", () => assignment(`${prefix}_O`,"COMPANY_DEFAULT",null,"2026-02-01",null));
  await probe(pg,"open-ended default overlap", async () => { await assignment(`${prefix}_OPEN`,"COMPANY_DEFAULT",null,"2026-02-01",null); await assignment(`${prefix}_O`,"COMPANY_DEFAULT",null,"2027-01-01",null); },exclusionDefault);
  await probe(pg,"same Employee overlap", () => assignment(`${prefix}_O`,"EMPLOYEE_OVERRIDE",e),exclusionEmployee);
  await probe(pg,"adjacent Employee override", () => assignment(`${prefix}_O`,"EMPLOYEE_OVERRIDE",e,"2026-02-01",null));
  await probe(pg,"different Employees overlap", () => assignment(`${prefix}_O`,"EMPLOYEE_OVERRIDE",e2));
  for (const [scope,employee] of [["COMPANY_DEFAULT",null],["EMPLOYEE_OVERRIDE",e]] as const) {
    await probe(pg,`${scope} cancelled overlap ignored`, () => assignment(`${prefix}_O`,scope,employee,"2026-01-01","2026-02-01",true));
    await probe(pg,`${scope} restoring conflicting cancellation rejected`, async () => { await assignment(`${prefix}_O`,scope,employee,"2026-01-01","2026-02-01",true); await pg.query(`UPDATE work_schedule_assignments SET "cancelledAt" = NULL WHERE id=$1`,[`${prefix}_O`]); }, scope === "COMPANY_DEFAULT" ? exclusionDefault : exclusionEmployee);
  }
  await probe(pg,"default cannot have Employee", () => assignment(`${prefix}_O`,"COMPANY_DEFAULT",e,"2027-01-01",null),["23514","work_schedule_assignments_scope_employee_check"]);
  await probe(pg,"override requires Employee", () => assignment(`${prefix}_O`,"EMPLOYEE_OVERRIDE",null),["23514","work_schedule_assignments_scope_employee_check"]);
  await probe(pg,"equal effective boundaries", () => assignment(`${prefix}_O`,"COMPANY_DEFAULT",null,"2027-01-01","2027-01-01"),["23514","work_schedule_assignments_effective_range_check"]);
  await probe(pg,"reversed effective boundaries", () => assignment(`${prefix}_O`,"COMPANY_DEFAULT",null,"2027-02-01","2027-01-01"),["23514","work_schedule_assignments_effective_range_check"]);
  const check: [string,string] = ["23514","work_schedule_days_shape_check"];
  for (const [label,args] of [
    ["start negative",[true,-1,1020,0,false]], ["start 1440",[true,1440,1020,0,true]],
    ["end negative",[true,540,-1,0,true]], ["end 1440",[true,540,1440,0,false]],
    ["missing start",[true,null,1020,0,false]], ["missing end",[true,540,null,0,false]],
    ["missing both times",[true,null,null,0,false]], ["rest has start",[false,540,null,0,false]],
    ["rest has end",[false,null,1020,0,false]], ["rest has break",[false,null,null,1,false]],
    ["rest has overnight",[false,null,null,0,true]], ["normal reversed",[true,1020,540,0,false]],
    ["normal equal",[true,540,540,0,false]], ["overnight equal",[true,540,540,0,true]],
    ["overnight forward",[true,540,1020,0,true]], ["break negative",[true,540,1020,-1,false]],
    ["break equal duration",[true,540,1020,480,false]], ["break exceeds duration",[true,540,1020,481,false]],
    ["overnight break equal duration",[true,1320,360,480,true]],
  ] as Array<[string,[boolean,number|null,number|null,number,boolean]]>) await probe(pg,label,() => day(...args),check);
  await probe(pg,"valid normal day", () => day());
  await probe(pg,"valid overnight day", () => day(true,1320,360,60,true));
  await probe(pg,"valid rest day", () => day(false,null,null,0,false));
  await probe(pg,"duplicate weekday", async () => { await day(); await day(); },["23505","work_schedule_days_workScheduleId_dayOfWeek_key"]);
  await probe(pg,"duplicate company code", () => schedule(`${prefix}_S2`),["23505","work_schedules_companyId_code_key"]);
  await probe(pg,"same code other company", () => schedule(`${prefix}_S2`,c2));
  for (const code of ["lowercase",""," ","BAD CODE","_BAD"]) await probe(pg,`invalid code ${JSON.stringify(code)}`,() => schedule(`${prefix}_S2`,c,code),["23514","work_schedules_code_check"]);
  await probe(pg,"blank schedule name", () => schedule(`${prefix}_S2`,c,"HR2B_VERIFY_OTHER"," "),["23514","work_schedules_name_check"]);
  await probe(pg,"untrimmed raw database name tolerated", () => schedule(`${prefix}_S2`,c,"HR2B_VERIFY_OTHER"," Untrimmed "));
  await probe(pg,"cross-company assignment",() => assignment(`${prefix}_O`,"COMPANY_DEFAULT",null,"2027-01-01",null,false,c2),["23503","work_schedule_assignments_workScheduleId_companyId_fkey"]);
  await probe(pg,"schedule history restrictive FK",() => pg.query(`DELETE FROM work_schedules WHERE id=$1`,[s]),["23503","work_schedule_assignments_workScheduleId_companyId_fkey"]);
  await probe(pg,"schedule days restrictive FK",async () => { await schedule(`${prefix}_DAYONLY`,c,"HR2B_VERIFY_DAYONLY"); await pg.query(`INSERT INTO work_schedule_days (id,"workScheduleId","dayOfWeek","isWorkingDay","updatedAt") VALUES ($1,$2,'MONDAY',false,now())`,[`${prefix}_DONLY`,`${prefix}_DAYONLY`]); await pg.query(`DELETE FROM work_schedules WHERE id=$1`,[`${prefix}_DAYONLY`]); },["23503","work_schedule_days_workScheduleId_fkey"]);
  await probe(pg,"Employee history restrictive FK",() => pg.query(`DELETE FROM employees WHERE id=$1`,[e]),["23503","work_schedule_assignments_employeeId_fkey"]);
  await probe(pg,"Company history restrictive FK",() => pg.query(`DELETE FROM companies WHERE id=$1`,[c]),["23503","work_schedules_companyId_fkey"]);
  await probe(pg,"User history restrictive FK",() => pg.query(`DELETE FROM users WHERE id=$1`,[u]),["23503","work_schedules_createdById_fkey"]);
  await probe(pg,"predecessor history restrictive FK",async () => { await assignment(`${prefix}_NEXT`,"COMPANY_DEFAULT",null,"2026-02-01",null,false,c,a); await pg.query(`DELETE FROM work_schedule_assignments WHERE id=$1`,[a]); },["23503","work_schedule_assignments_replacesAssignmentId_fkey"]);
}

async function serviceProbes() {
  const prisma = new PrismaService();
  const rollback = Symbol("service verification rollback");
  try {
    await prisma.$transaction(async tx => {
      let nestedSequence = 0;
      let failNextAudit = false;
      const serviceClient = new Proxy(tx as object, {
        get(target, property) {
          if (property === "$transaction") return async (work: (inner: typeof tx) => Promise<unknown>) => {
            const savepoint = `hr2b_service_${++nestedSequence}`;
            await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
            const inner = new Proxy(tx as object, { get(innerTarget, innerProperty) {
              if (innerProperty === "auditEvent" && failNextAudit) return { create: async () => { failNextAudit = false; throw new Error("FORCED_AUDIT_FAILURE"); } };
              return Reflect.get(innerTarget, innerProperty, innerTarget);
            } }) as unknown as typeof tx;
            try { const result = await work(inner); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`); return result; }
            catch (error) { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`); throw error; }
          };
          return Reflect.get(target, property, target);
        },
      }) as unknown as PrismaService;
      const service = new WorkScheduleService(serviceClient);
      const fixture = `HR2B_SERVICE_${randomUUID().replaceAll("-", "")}`;
      await tx.company.update({ where: { singletonKey: "PRIMARY" }, data: { singletonKey: `${fixture}_OLD` } });
      const company = await tx.company.create({ data: { singletonKey: "PRIMARY", name: "HR2B service verification" } });
      const user = await tx.user.create({ data: { email: `${fixture}@example.invalid`, fullName: "HR2B Actor", passwordHash: "NOT_A_USABLE_PASSWORD" } });
      const actor = { id: user.id, email: user.email, fullName: user.fullName, roles: [] };
      const week = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"].map(dayOfWeek => dayOfWeek === "FRIDAY"
        ? { dayOfWeek, isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false }
        : { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60, crossesMidnight: false });
      const assignment = await service.createAssignment({ scope: "COMPANY_DEFAULT", newSchedule: { code: "STANDARD_OFFICE", name: "Standard Office Schedule", days: week }, effectiveFrom: "2026-09-01", effectiveTo: null }, actor);
      assert.equal(assignment.effectiveFrom, "2026-09-01"); passed++; console.log("PASS service initial setup exact backdate");
      const resolved = await service.resolveWorkSchedule(undefined, "2026-09-01");
      assert.equal(resolved.kind, "RESOLVED"); passed++; console.log("PASS service resolves company default");
      await assert.rejects(() => service.createAssignment({ scope: "COMPANY_DEFAULT", newSchedule: { code: "STANDARD_OFFICE_2", name: "Standard Office Schedule", days: week }, effectiveFrom: "2026-09-01", effectiveTo: null }, actor));
      passed++; console.log("PASS service rejects duplicate initial backdate");
      for (const invalid of [
        { scope: "COMPANY_DEFAULT" as const, newSchedule: { code: "WRONG", name: "Standard Office Schedule", days: week }, effectiveFrom: "2026-09-01", effectiveTo: null },
        { scope: "COMPANY_DEFAULT" as const, newSchedule: { code: "STANDARD_OFFICE", name: "Wrong name", days: week }, effectiveFrom: "2026-09-01", effectiveTo: null },
        { scope: "COMPANY_DEFAULT" as const, newSchedule: { code: "STANDARD_OFFICE", name: "Standard Office Schedule", days: week.map(day => day.dayOfWeek === "MONDAY" ? { ...day, startMinuteOfDay: 601 } : day) }, effectiveFrom: "2026-09-01", effectiveTo: null },
        { scope: "COMPANY_DEFAULT" as const, newSchedule: { code: "STANDARD_OFFICE", name: "Standard Office Schedule", days: week }, effectiveFrom: "2026-09-01", effectiveTo: "2027-01-01" },
      ]) await assert.rejects(() => service.createAssignment(invalid, actor));
      passed++; console.log("PASS service rejects non-exact initial definition variants");
      await assert.rejects(() => service.createAssignment({ scope: "COMPANY_DEFAULT", workScheduleId: assignment.workSchedule.id, effectiveFrom: "2026-09-02", effectiveTo: null }, actor));
      passed++; console.log("PASS service rejects every other backdate");
      await assert.rejects(() => service.createAssignment({ scope: "COMPANY_DEFAULT", effectiveFrom: "2028-01-01", effectiveTo: null }, actor));
      passed++; console.log("PASS service revalidates schedule source XOR");
      await assert.rejects(() => service.createAssignment({ scope: "COMPANY_DEFAULT", workScheduleId: assignment.workSchedule.id, effectiveFrom: "2035-01-01", effectiveTo: null, changeReason: "x".repeat(501) }, actor), error => typeof error === "object" && error !== null && "getStatus" in error && (error as { getStatus(): number }).getStatus() === 400);
      passed++; console.log("PASS service rejects overlength optional change reason as controlled 400");
      await assert.rejects(() => service.updateSchedule(assignment.workSchedule.id, { days: week }, actor));
      passed++; console.log("PASS service rejects used definition day edits");
      const replacement = await service.replaceAssignment(assignment.id, { effectiveFrom: "2027-01-01", newSchedule: { code: "FUTURE_OFFICE", name: "Future Office", days: week }, changeReason: "Verification replacement", expectedUpdatedAt: assignment.updatedAt }, actor);
      await service.cancelAssignment(replacement.id, { changeReason: "Verification cancellation", expectedUpdatedAt: replacement.updatedAt }, actor);
      const restored = await tx.workScheduleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
      assert.equal(restored.effectiveTo, null);
      const cancelled = await tx.workScheduleAssignment.findUniqueOrThrow({ where: { id: replacement.id } });
      assert.ok(cancelled.cancelledAt);
      passed++; console.log("PASS service linked replacement cancellation restores predecessor exact prior end");
      const employee = await tx.employee.create({ data: { employeeCode: fixture, fullName: "HR2B Employee", designation: "Verification", joiningDate: new Date("2026-01-01") } });
      const draft = await service.createSchedule({ code: "EMPLOYEE_WEEK", name: "Employee Week", days: week }, actor);
      const revisedWeek = week.map(day => day.dayOfWeek === "MONDAY" ? { ...day, startMinuteOfDay: 660, endMinuteOfDay: 1140 } : day);
      await service.updateSchedule(draft.id, { days: revisedWeek }, actor);
      await service.updateSchedule(draft.id, { isActive: false }, actor);
      await assert.rejects(() => service.createAssignment({ scope: "EMPLOYEE_OVERRIDE", employeeId: employee.id, workScheduleId: draft.id, effectiveFrom: "2028-01-01", effectiveTo: "2028-02-01", changeReason: "Inactive check" }, actor));
      await service.updateSchedule(draft.id, { isActive: true }, actor);
      passed++; console.log("PASS service unassigned day edit and activation lifecycle; inactive new assignment blocked");
      const override = await service.createAssignment({ scope: "EMPLOYEE_OVERRIDE", employeeId: employee.id, workScheduleId: draft.id, effectiveFrom: "2028-01-01", effectiveTo: "2028-03-01", changeReason: "Temporary hours" }, actor);
      const overrideResolved = await service.resolveWorkSchedule(employee.id, "2028-01-03");
      assert.equal(overrideResolved.kind, "RESOLVED");
      if (overrideResolved.kind === "RESOLVED") assert.equal(overrideResolved.source, "EMPLOYEE_OVERRIDE");
      const ended = await service.endAssignment(override.id, { effectiveTo: "2028-02-01", changeReason: "End temporary hours", expectedUpdatedAt: override.updatedAt }, actor);
      await assert.rejects(() => service.endAssignment(override.id, { effectiveTo: "2028-01-20", changeReason: "Stale", expectedUpdatedAt: override.updatedAt }, actor));
      const fallback = await service.resolveWorkSchedule(employee.id, "2028-02-01");
      assert.equal(fallback.kind, "RESOLVED");
      if (fallback.kind === "RESOLVED") assert.equal(fallback.source, "COMPANY_DEFAULT");
      assert.ok(ended.updatedAt !== override.updatedAt);
      passed++; console.log("PASS service override priority, end, expiry fallback, and stale token rejection");
      const working = await service.resolveWorkSchedule(undefined, "2026-09-01");
      const rest = await service.resolveWorkSchedule(undefined, "2026-09-04");
      assert.equal(working.kind === "RESOLVED" && working.isWorkingDay, true);
      assert.equal(rest.kind === "RESOLVED" && rest.isWorkingDay, false);
      await service.updateSchedule(assignment.workSchedule.id, { isActive: false }, actor);
      assert.equal((await service.resolveWorkSchedule(undefined, "2026-09-01")).kind, "RESOLVED");
      await service.updateSchedule(assignment.workSchedule.id, { isActive: true }, actor);
      passed++; console.log("PASS service working/rest resolution and inactive historical definition usability");
      const standalone = await service.createAssignment({ scope: "EMPLOYEE_OVERRIDE", employeeId: employee.id, workScheduleId: draft.id, effectiveFrom: "2029-01-01", effectiveTo: "2029-04-01", changeReason: "Future standalone" }, actor);
      const finiteReplacement = await service.replaceAssignment(standalone.id, { effectiveFrom: "2029-02-01", workScheduleId: draft.id, changeReason: "Future replacement", expectedUpdatedAt: standalone.updatedAt }, actor);
      assert.equal(finiteReplacement.effectiveTo, "2029-04-01");
      const standaloneFresh = await tx.workScheduleAssignment.findUniqueOrThrow({ where: { id: standalone.id } });
      await assert.rejects(() => service.replaceAssignment(standalone.id, { effectiveFrom: "2029-01-15", workScheduleId: draft.id, changeReason: "Dependent conflict", expectedUpdatedAt: standaloneFresh.updatedAt.toISOString() }, actor));
      await assert.rejects(() => service.cancelAssignment(standalone.id, { changeReason: "Live child", expectedUpdatedAt: standaloneFresh.updatedAt.toISOString() }, actor));
      await service.cancelAssignment(finiteReplacement.id, { changeReason: "Cancel replacement", expectedUpdatedAt: finiteReplacement.updatedAt }, actor);
      await assert.rejects(() => service.updateSchedule(draft.id, { days: week }, actor));
      passed++; console.log("PASS service finite replacement, dependent conflict, and cancelled-use immutability");
      const cancellable = await service.createAssignment({ scope: "EMPLOYEE_OVERRIDE", employeeId: employee.id, workScheduleId: draft.id, effectiveFrom: "2030-01-01", effectiveTo: "2030-02-01", changeReason: "Standalone cancel" }, actor);
      await service.cancelAssignment(cancellable.id, { changeReason: "No longer needed", expectedUpdatedAt: cancellable.updatedAt }, actor);
      const defaultFresh = await tx.workScheduleAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
      await assert.rejects(() => service.cancelAssignment(assignment.id, { changeReason: "Valid", expectedUpdatedAt: "not-an-iso-timestamp" }, actor), error => typeof error === "object" && error !== null && "getStatus" in error && (error as { getStatus(): number }).getStatus() === 400);
      await assert.rejects(() => service.cancelAssignment(assignment.id, { changeReason: "x".repeat(501), expectedUpdatedAt: defaultFresh.updatedAt.toISOString() }, actor), error => typeof error === "object" && error !== null && "getStatus" in error && (error as { getStatus(): number }).getStatus() === 400);
      passed++; console.log("PASS service rejects invalid expected timestamp and overlength required reason as controlled 400");
      await assert.rejects(() => service.cancelAssignment(assignment.id, { changeReason: "Unsafe default cancel", expectedUpdatedAt: defaultFresh.updatedAt.toISOString() }, actor));
      passed++; console.log("PASS service standalone override cancellation and default cancellation rejection");
      await tx.employee.update({ where: { id: employee.id }, data: { isActive: false } });
      assert.equal((await service.resolveWorkSchedule(employee.id, "2028-01-03")).kind, "RESOLVED");
      await assert.rejects(() => service.createAssignment({ scope: "EMPLOYEE_OVERRIDE", employeeId: employee.id, workScheduleId: draft.id, effectiveFrom: "2031-01-01", effectiveTo: null, changeReason: "Inactive Employee" }, actor));
      await tx.employee.update({ where: { id: employee.id }, data: { isActive: false, isDeleted: true, deletedAt: new Date() } });
      assert.equal((await service.resolveWorkSchedule(employee.id, "2028-01-03")).kind, "RESOLVED");
      await assert.rejects(() => service.createAssignment({ scope: "EMPLOYEE_OVERRIDE", employeeId: employee.id, workScheduleId: draft.id, effectiveFrom: "2031-01-01", effectiveTo: null, changeReason: "Deleted Employee" }, actor));
      passed++; console.log("PASS service blocks inactive and deleted Employee overrides");
      const beforeFailure = { schedules: await tx.workSchedule.count(), days: await tx.workScheduleDay.count(), assignments: await tx.workScheduleAssignment.count(), audits: await tx.auditEvent.count() };
      failNextAudit = true;
      await assert.rejects(() => service.createAssignment({ scope: "COMPANY_DEFAULT", newSchedule: { code: "ROLLBACK_TEST", name: "Rollback Test", days: week }, effectiveFrom: "2040-01-01", effectiveTo: null }, actor));
      assert.deepEqual({ schedules: await tx.workSchedule.count(), days: await tx.workScheduleDay.count(), assignments: await tx.workScheduleAssignment.count(), audits: await tx.auditEvent.count() }, beforeFailure);
      passed++; console.log("PASS service forced inner failure rolls back schedule, days, assignment, and audit");
      const actions = await tx.auditEvent.findMany({ where: { userId: user.id }, select: { action: true, metadata: true } });
      for (const required of ["WORK_SCHEDULE_CREATED", "WORK_SCHEDULE_UPDATED", "WORK_SCHEDULE_ACTIVATED", "WORK_SCHEDULE_INACTIVATED", "WORK_SCHEDULE_DEFAULT_ASSIGNED", "WORK_SCHEDULE_EMPLOYEE_OVERRIDE_CREATED", "WORK_SCHEDULE_ASSIGNMENT_REPLACED", "WORK_SCHEDULE_ASSIGNMENT_ENDED", "WORK_SCHEDULE_FUTURE_ASSIGNMENT_CANCELLED"]) assert.ok(actions.some(item => item.action === required), required);
      assert.ok(actions.every(item => !/(reason|description|name|fullName|mobile|nationalId)/i.test(JSON.stringify(item.metadata))));
      passed++; console.log("PASS service emits every required audit action with allowlisted non-PII metadata");
      assert.equal(company.singletonKey, "PRIMARY");
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) {
      const value = error as { constructor?: { name?: string }; message?: string };
      console.error(`FAIL service probes ${value.constructor?.name ?? "Error"}: ${value.message ?? "unknown failure"}`);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  process.loadEnvFile(".env");
  const pg = verificationPg(process.env.DATABASE_URL); // target guarded before client construction
  await pg.connect();
  try {
    const before = await databaseFingerprint(pg);
    console.log(`BASELINE ${JSON.stringify(before)}`);
    await rollbackOnly(pg, async () => {
      if (process.argv.includes("--red-scaffold")) await pg.query(redScaffold);
      else if (process.argv.includes("--preview-migration")) await pg.query(readFileSync("prisma/migrations/20260902000000_hr_2b_work_schedule_foundation/migration.sql","utf8"));
      await fixturesAndProbes(pg);
    });
    if (!process.argv.includes("--red-scaffold") && !process.argv.includes("--preview-migration")) await serviceProbes();
    const after = await databaseFingerprint(pg);
    assert.deepEqual(after,before,"All public table counts and fingerprints must survive rollback unchanged.");
    passed++;
    console.log("PASS all public table counts/fingerprints unchanged after rollback");
    for (const table of Object.keys(after)) {
      const identifier = '"' + table.replaceAll('"','""') + '"';
      const result = await pg.query(`SELECT count(*)::text AS count FROM public.${identifier} t WHERE row_to_json(t)::text LIKE $1`,[`%${prefix}%`]);
      assert.equal(result.rows[0].count,"0",`Fixture residue in ${table}`);
    }
    passed++;
    console.log("PASS fixture residue = 0 in all public tables");
    console.log(`Work schedule database verification: ${passed} PASS, ${failed} FAIL`);
    if (failed) process.exitCode = 1;
  } finally { await pg.end(); }
}
main().catch(() => { console.error("Work schedule database verification aborted; transaction rolled back, inspect target/schema availability without exposing database diagnostics."); process.exitCode = 1; });
