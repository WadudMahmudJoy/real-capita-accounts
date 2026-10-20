import { runHrAdminBrowser } from './hr-admin-browser-environment';
import { verifyConfirmationEngine } from './payroll-confirmation-acceptance';
import { reviewConfirmationSecurity } from './review-payroll-confirmation-security';
// Real PostgreSQL acceptance. Only this harness's fresh database is writable.
// No business rows are copied. Salary approvals and attendance finalizations
// are performed by the genuine application services, never mocked.
import "reflect-metadata";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { verifyPaymentFinalIntegrity } from "./payroll-payment-final-integrity";
import { verifyDirectPaymentProbes } from "./payroll-payment-direct-probes";
import { technicalPaymentAuthority, verifyPaymentLifecycle } from "./payroll-payment-lifecycle-acceptance";
import { createRoleSecurityContext, verifyScopedDatabaseSecurity } from "./db/security-acceptance";
import { reviewPaymentDatabase } from "./review-payroll-payment-integrity";

const root = resolve(__dirname, ".."), req = createRequire(join(root, "package.json"));
const apiReq = createRequire(join(root, "apps/api/package.json"));
const roleSecurity=process.argv.includes("--role-security");
const local = req("dotenv").parse(readFileSync(join(root, ".env"))).DATABASE_URL;
function validateSource(value: string | undefined) {
  assert(value, "Missing local development connection"); const url = new URL(value);
  assert(["postgres:", "postgresql:"].includes(url.protocol));
  if (roleSecurity) { assert(/^[a-f0-9]{24}$/.test(process.env.PAYROLL_SECURITY_TOKEN ?? "")); assert.equal(url.hostname,"127.0.0.1"); assert(!["55532","55432","5432"].includes(url.port)); assert.equal(url.pathname,`/rc_security_${process.env.PAYROLL_SECURITY_TOKEN}`); }
  else { assert.equal(url.hostname, "localhost"); assert.equal(url.port, "55532"); assert.equal(decodeURIComponent(url.pathname.slice(1)), "real_capita_accounts_salary_dev"); }
  assert.equal(url.hash, ""); assert.equal(url.searchParams.get("schema") ?? "public", "public");
  assert([...url.searchParams.keys()].every(k => ["schema", "sslmode", "connect_timeout", "connection_limit", "pool_timeout"].includes(k)));
  return url;
}
const sourceUrl = validateSource(roleSecurity ? process.env.PAYROLL_SECURITY_INSTANCE_URL : process.env.DATABASE_URL ?? local);
if (!roleSecurity && process.env.DATABASE_URL && local) validateSource(local);
const token = randomUUID().replaceAll("-", ""), databaseName = `real_capita_payroll_accept_${token}`;
assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(databaseName));
const isolatedUrl = new URL(sourceUrl); isolatedUrl.pathname = `/${databaseName}`;
const { Client } = createRequire(req.resolve("@prisma/adapter-pg"))("pg");
const admin = new Client({ connectionString: sourceUrl.toString() });
const output = mkdtempSync(join(root, "apps/api/.payroll-accept-verify-"));
let created = false, createdOid: number | undefined, owner: string | undefined, connected = false, app: any;
const clients: any[] = [];
let passed = 0;
const pass = (name: string) => { passed++; console.log(`PASS PostgreSQL acceptance: ${name}`); };
const originalSecret = process.env.JWT_SECRET;
const counts = async (db: any) => ({ runs: await db.payrollRun.count(), lines: await db.payrollRunLine.count(), audits: await db.auditEvent.count() });
async function sourceCounts() {
  if(roleSecurity)return (await admin.query("SELECT count(*)::text AS tables FROM pg_tables WHERE schemaname='public'")).rows[0];
  return (await admin.query(`SELECT (SELECT count(*)::text FROM payroll_runs) AS runs,
    (SELECT count(*)::text FROM payroll_run_lines) AS lines, (SELECT count(*)::text FROM audit_events) AS audits,
    (SELECT count(*)::text FROM companies) AS companies, (SELECT count(*)::text FROM employees) AS employees,
    (SELECT count(*)::text FROM employee_salary_assignments) AS assignments,
    (SELECT count(*)::text FROM employee_payment_profiles) AS profiles,
    (SELECT count(*)::text FROM attendance_records) AS attendance, (SELECT count(*)::text FROM vouchers) AS vouchers`)).rows[0];
}

async function main() {
  await admin.connect(); connected = true;
  const identity = (await admin.query(`SELECT current_database() AS db, current_user AS role,
    inet_server_addr()::text AS address, inet_server_port() AS port, version() AS version,
    pg_is_in_recovery() AS recovery, (SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname=current_user) AS can_create`)).rows[0];
  assert.equal(identity.db,decodeURIComponent(sourceUrl.pathname.slice(1))); assert.equal(identity.port, 5432);
  assert.equal(identity.recovery, false); assert.equal(identity.can_create, true);
  const databases = (await admin.query("SELECT datname, datallowconn FROM pg_database")).rows;
  assert(databases.some((d: any) => d.datname === identity.db && d.datallowconn));
  assert(!databases.some((d: any) => d.datname === databaseName));
  owner = identity.role; const baseline = await sourceCounts();
  pass(roleSecurity ? "separate task-owned PostgreSQL instance and bootstrap identity verified before database creation" : "localhost:55532, safe source identity, database catalog, creation permission and unique target verified before creation");
  // Identifier and marker are generated locally, validated, and never supplied
  // by callers. No TEMPLATE containing application/business data is used.
  await admin.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0`); created = true;
  createdOid = (await admin.query("SELECT oid FROM pg_database WHERE datname=$1", [databaseName])).rows[0].oid;
  await admin.query(`COMMENT ON DATABASE "${databaseName}" IS '${token}'`);
  if(process.argv.includes('--hr-migration-sequence')){
    assert(roleSecurity,'Migration selection review requires a disposable PostgreSQL instance');
    const {verifyHrMigrationSequence}=await import('./verify-hr-migration-sequence');
    owner=await verifyHrMigrationSequence({url:isolatedUrl,directory:output,req});
    assert.deepEqual(await sourceCounts(),baseline);return;
  }
  const configArgs:string[]=[];
  if(process.argv.includes('--hr-only-artifact')){
    assert(roleSecurity,'Curated HR application tests require the separate disposable server');
    const bundle=join(output,'hr-migrations');mkdirSync(bundle);copyFileSync(join(root,'prisma/migrations/migration_lock.toml'),join(bundle,'migration_lock.toml'));
    for(const item of readdirSync(join(root,'prisma/migrations'),{withFileTypes:true}).filter(d=>d.isDirectory()&&(d.name!=='20261019000000_leave_hr_md_workflow'||process.argv.includes('--leave-md-sprint7d'))&&d.name!=='20261015000000_payroll_confirmation_evidence'&&(d.name!=='20261018000000_md_authority_foundation'||process.argv.includes('--authority-sprint7b')))){mkdirSync(join(bundle,item.name));copyFileSync(join(root,'prisma/migrations',item.name,'migration.sql'),join(bundle,item.name,'migration.sql'));}
    const config=join(output,'hr-only.config.ts');writeFileSync(config,`import {defineConfig} from 'prisma/config';export default defineConfig({schema:${JSON.stringify(join(root,'prisma/schema.prisma'))},migrations:{path:${JSON.stringify(bundle)}},datasource:{url:process.env.MIGRATION_DATABASE_URL}});`);configArgs.push('--config',config);
  }
  execFileSync(process.execPath, [req.resolve("prisma/build/index.js"), "migrate", "deploy",...configArgs], {
    cwd: root, env: { ...process.env, MIGRATION_DATABASE_URL: isolatedUrl.toString(), DATABASE_URL: undefined }, stdio: "pipe",
  });
  execFileSync(process.execPath, [req.resolve("typescript/bin/tsc"), "-p", "apps/api/tsconfig.json", "--outDir", output,
    "--incremental", "false", "--declaration", "false", "--sourceMap", "false"], { cwd: root, stdio: "inherit" });
  const load = (name: string) => req(join(output, name));
  const { PrismaClient } = load("generated/prisma/client.js"), { PrismaPg } = req("@prisma/adapter-pg");
  const newClient = async () => {
    assert(created && /^real_capita_payroll_accept_[a-f0-9]{32}$/.test(databaseName));
    if(roleSecurity){assert.equal(isolatedUrl.hostname,"127.0.0.1");assert.equal(isolatedUrl.port,sourceUrl.port);}else{assert.equal(isolatedUrl.hostname, "localhost"); assert.equal(isolatedUrl.port, "55532");}
    assert.equal(isolatedUrl.pathname, `/${databaseName}`);
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: isolatedUrl.toString(), max: 1 }) });
    clients.push(db); await db.$connect();
    const actual = (await db.$queryRawUnsafe("SELECT current_database() AS db, inet_server_addr()::text AS address, inet_server_port() AS port, version() AS version"))[0];
    assert.equal(actual.db, databaseName); assert.equal(actual.address, identity.address); assert.equal(actual.port, identity.port); assert.equal(actual.version, identity.version);
    return db;
  };
  const db = await newClient();
  if(process.argv.includes('--hr-only-artifact')){
    const history=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations');assert.equal(history.length,process.argv.includes('--leave-md-sprint7d')?18:process.argv.includes('--authority-sprint7b')?17:16);
    for(const item of history){assert(item.finished_at&&!item.rolled_back_at);assert.notEqual(item.migration_name,'20261015000000_payroll_confirmation_evidence');assert.equal(item.checksum,createHash('sha256').update(readFileSync(join(root,'prisma/migrations',item.migration_name,'migration.sql'))).digest('hex'));}
    assert.equal((await db.$queryRawUnsafe("SELECT to_regclass('public.payroll_cash_acknowledgments')::text AS evidence_table"))[0].evidence_table,null);
    console.log(process.argv.includes('--leave-md-sprint7d')?'PASS HR-only sequence: 16 baseline migrations plus authority 18 and leave 19; exact checksums, deferred 15 absent':'PASS HR-only application environment: original 14 plus revised 16/17, exact checksums and no deferred payment evidence objects');
  }
  let security: any; let apiDb = db;
  if(roleSecurity){security=await createRoleSecurityContext({db,isolatedUrl,databaseName,load,req,clients});apiDb=security.runtimeClient;owner=security.migration;}
  pass("fresh isolated database identity independently verified; existing migrations deployed only there");
  if(process.argv.includes('--hr-admin-browser')||process.argv.includes('--payroll-ui-browser')||process.argv.includes('--attendance-leave-browser')||process.argv.includes('--hr-admin-sprint4')) {
    assert(roleSecurity,'HR browser writes require the disposable instance');
    await runHrAdminBrowser({db,apiDb,security,databaseName,load,req,apiReq});
    assert.deepEqual(await sourceCounts(),baseline);
    return;
  }

  if (process.argv.includes("--payment-review-only")) {
    const paymentSql = readFileSync(join(root, "prisma/migrations/20261014000000_payroll_payment_foundation/migration.sql"), "utf8");
    const applied = await db.$queryRawUnsafe(`SELECT checksum,finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name='20261014000000_payroll_payment_foundation'`);
    assert.equal(applied.length, 1); assert(applied[0].finished_at && !applied[0].rolled_back_at); assert.equal(applied[0].checksum, createHash("sha256").update(paymentSql).digest("hex"));
    await reviewPaymentDatabase(db, paymentSql);
    assert.equal(await db.payrollSourceAuthorization.count(), 0); assert.equal(await db.payrollPaymentBatch.count(), 0); assert.equal(await db.payrollPaymentConfirmation.count(), 0);
    assert.deepEqual(await sourceCounts(), baseline);
    console.log("PASS focused review: no grant/payroll/payment fixtures or confirmations; source counts preserved; previous acceptance suite skipped");
    return;
  }
  const sql = readFileSync(join(root, "prisma/migrations/20261013000000_hr_3b_payroll_foundation/migration.sql"), "utf8");
  const history = await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM "_prisma_migrations"');
  const completed = new Set(history.filter((m: any) => m.finished_at && !m.rolled_back_at).map((m: any) => m.migration_name));
  assert(!history.some((m: any) => !m.finished_at && !m.rolled_back_at));
  assert(readdirSync(join(root, "prisma/migrations"), { withFileTypes: true }).filter(d => d.isDirectory()).every(d => completed.has(d.name)));
  assert.equal(history.find((m: any) => m.migration_name === "20261013000000_hr_3b_payroll_foundation").checksum, createHash("sha256").update(sql).digest("hex"));
  const constraints = await db.$queryRawUnsafe(`SELECT conname,contype::text,convalidated,confdeltype::text,confupdtype::text,
    pg_get_constraintdef(oid,true) AS definition FROM pg_constraint WHERE conrelid IN ('payroll_runs'::regclass,'payroll_run_lines'::regclass)`);
  assert.equal(constraints.filter((c: any) => c.contype === "f" && c.convalidated && c.confdeltype === "r" && c.confupdtype === "r").length, 8);
  const normalize = (s: string) => s.replace(/("[^"]+") BETWEEN (\d+) AND (\d+)/g, "$1 >= $2 AND $1 <= $3")
    .replace(/::(?:numeric|"PayrollRunStatus")/g, "").replace(/[()\s"]/g, "");
  const checks = [...sql.matchAll(/ALTER TABLE "(payroll_runs|payroll_run_lines)" ADD CONSTRAINT "([^"]+)" (CHECK \([^;]+\));/g)];
  assert.equal(checks.filter(c => c[1] === "payroll_run_lines").length, 6);
  for (const [, , name, expression] of checks) { const c = constraints.find((c: any) => c.conname === name); assert(c?.convalidated); assert.equal(normalize(c.definition), normalize(expression)); }
  const columns = await db.$queryRawUnsafe(`SELECT data_type,numeric_precision,numeric_scale,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('payroll_runs','payroll_run_lines')`);
  assert.equal(columns.filter((c: any) => c.data_type === "numeric" && c.numeric_precision === 18 && c.numeric_scale === 2 && c.is_nullable === "NO").length, 11);
  assert.equal(columns.filter((c: any) => c.data_type === "jsonb" && c.is_nullable === "NO").length, 5);
  const indexes = await db.$queryRawUnsafe(`SELECT ci.relname,i.indisunique,i.indisvalid,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class ci ON ci.oid=i.indexrelid WHERE i.indrelid IN ('payroll_runs'::regclass,'payroll_run_lines'::regclass)`);
  for (const [name, keys] of [["payroll_runs_payrollYear_payrollMonth_key", '("payrollYear", "payrollMonth")'], ["payroll_run_lines_payrollRunId_employeeId_key", '("payrollRunId", "employeeId")']]) {
    const index = indexes.find((i: any) => i.relname === name); assert(index?.indisunique && index.indisvalid && index.definition.includes(keys));
  }
  pass("actual migration history, eight restrictive FKs, eleven Decimal columns, JSONB and approved CHECK expressions");

  const { PrismaService } = load("prisma/prisma.service.js"), { SalaryCalculator } = load("salary/salary-calculator.js");
  const { PayrollParentResolver } = load("payroll/payroll-parent.resolver.js");
  const { MonthlyPayrollCalculationService } = load("payroll/monthly-payroll-calculation.service.js");
  const { PayrollAttendanceCompletenessService } = load("payroll/payroll-attendance-completeness.service.js");
  const { PayrollReadinessService } = load("payroll/payroll-readiness.service.js"), { PayrollDraftService } = load("payroll/payroll-draft.service.js");
  const { PayrollService } = load("payroll/payroll.service.js"), { PayrollPreviewService } = load("payroll/payroll-preview.service.js");
  const { PayrollApprovalReadinessService } = load("payroll/payroll-approval-readiness.service.js"), { PayrollApprovalService } = load("payroll/payroll-approval.service.js");
  const { PayrollCorrectionPreflightService } = load("payroll/payroll-correction-preflight.service.js");
  const { PayrollDocumentsService } = load("payroll/payroll-documents.service.js");
  const { PayrollPaymentPreparationService } = load("payroll/payroll-payment-preparation.service.js");
  const { PayrollPaymentBatchService } = load("payroll/payroll-payment-batch.service.js");
  const { PayrollController } = load("payroll/payroll.controller.js"), { AuthController } = load("auth/auth.controller.js"), { AuthService } = load("auth/auth.service.js");
  const { AuthGuard } = load("auth/guards/auth.guard.js"), { RolesGuard } = load("auth/guards/roles.guard.js");
  const { NestFactory } = apiReq("@nestjs/core"), { Module, ValidationPipe } = apiReq("@nestjs/common"), { JwtModule } = apiReq("@nestjs/jwt");
  process.env.JWT_SECRET = randomUUID();
  const {PayrollPaymentConfirmationService,PayrollPaymentConfirmationWriter}=load('payroll/payroll-payment-confirmation.service.js');
  const {PayrollPaymentEvidenceProvider}=load('payroll/payroll-payment-evidence.provider.js');
  const {PayrollPaymentConfirmationReadinessService}=load('payroll/payroll-payment-confirmation-readiness.service.js');
  class AcceptanceModule {}
  Module({ imports: [JwtModule.register({ secret: process.env.JWT_SECRET })], controllers: [AuthController, PayrollController], providers: [
    { provide: PrismaService, useValue: apiDb }, SalaryCalculator, AuthService, AuthGuard, RolesGuard, PayrollParentResolver, PayrollPaymentConfirmationService,PayrollPaymentConfirmationWriter,PayrollPaymentEvidenceProvider,PayrollPaymentConfirmationReadinessService,
    PayrollPaymentBatchService, PayrollPaymentPreparationService, PayrollDocumentsService, PayrollService, PayrollPreviewService, MonthlyPayrollCalculationService, PayrollAttendanceCompletenessService, PayrollReadinessService, PayrollDraftService, PayrollApprovalReadinessService, PayrollApprovalService,
  ] })(AcceptanceModule);
  app = await NestFactory.create(AcceptanceModule, { logger: false, abortOnError: false }); app.use(apiReq("cookie-parser")());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })); await app.listen(0, "127.0.0.1");
  const base = await app.getUrl(); let cookie: string | undefined;
  const http = async (path: string, body?: unknown, method = body ? "POST" : "GET") => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") } as any;
  };
  // Fresh-install bootstrap: only existing ACCOUNTANT, test user/session and
  // legacy PRIMARY designation. There is no application endpoint that creates
  // this protected marker. This is fixture identity, not approval authority.
  const password = randomUUID(), role = await db.role.create({ data: { code: "ACCOUNTANT", name: "Accountant" } });
  const actor = await db.user.create({ data: { email: "payroll-acceptance@example.invalid", fullName: "Synthetic Accountant", passwordHash: await req("bcryptjs").hash(password, 10), roles: { create: { roleId: role.id } } } });
  const bootSession = await db.authSession.create({ data: { userId: actor.id, tokenId: randomUUID(), expiresAt: new Date(Date.now() + 3600000) } });
  const companies = new (load("company/company.service.js").CompanyService)(apiDb);
  const parent = await companies.create({ name: "Synthetic Payroll Parent", legalName: "Synthetic Parent Only", currency: "BDT" }, { id: bootSession.id, activeCompanyId: null });
  await db.company.update({ where: { id: parent.id }, data: { singletonKey: "PRIMARY" } });
  const office = await companies.create({ name: "Synthetic Other Office" }, { id: bootSession.id, activeCompanyId: parent.id });
  const login = await http("/auth/login", { email: actor.email, password }); assert.equal(login.status, 200); cookie = login.cookie.split(";")[0];
  const session = await db.authSession.findFirst({ where: { userId: actor.id, tokenId: { not: bootSession.tokenId } }, orderBy: { createdAt: "desc" } });
  await companies.switchCompany(office.id, { id: session.id, activeCompanyId: parent.id });
  const user = login.body.user;
  const department = await new (load("department/department.service.js").DepartmentService)(apiDb).create({ code: "TEST", name: "Synthetic Department" }, user);
  const employee = await new (load("employee/employee.service.js").EmployeeService)(apiDb).create({ employeeCode: "TEST-001", fullName: "Synthetic Employee", designation: "Test Employee", departmentId: department.id, mobileNumber: "01700000000", joiningDate: "2026-01-01" }, user);
  const employee2 = await new (load("employee/employee.service.js").EmployeeService)(apiDb).create({ employeeCode: "TEST-002", fullName: "Second Synthetic Employee", designation: "Test Employee", departmentId: department.id, mobileNumber: "01700000001", joiningDate: "2026-01-01" }, user);
  const employees = [employee, employee2];
  const salary = new (load("salary/salary.service.js").SalaryService)(apiDb, new SalaryCalculator());
  const structure = await salary.createStructure({ code: "TEST", name: "Synthetic Custom Structure", effectiveFrom: "2026-01-01", components: [
    { code: "CUSTOM_A", name: "Custom A", percentage: "37.5", displayOrder: 1 }, { code: "CUSTOM_B", name: "Custom B", percentage: "62.5", displayOrder: 2 }] }, user);
  await salary.approveStructure(structure.id, user);
  const assignment = await salary.createAssignment(employee.id, { salaryStructureId: structure.id, grossSalary: "100.01", effectiveFrom: "2026-01-01" }, user); await salary.approveAssignment(assignment.id, user);
  const profile = await salary.createProfile(employee.id, { selectedBankPercentage: "60", bankName: "Synthetic Bank", accountName: "Synthetic Employee", accountNumber: "PRIVATE_SENTINEL", effectiveFrom: "2026-01-01" }, user); await salary.approveProfile(profile.id, user);
  const assignment2 = await salary.createAssignment(employee2.id, { salaryStructureId: structure.id, grossSalary: "100.01", effectiveFrom: "2026-01-01" }, user); await salary.approveAssignment(assignment2.id, user);
  const profile2 = await salary.createProfile(employee2.id, { selectedBankPercentage: "60", bankName: "Synthetic Bank", accountName: employee2.fullName, accountNumber: "PRIVATE_SENTINEL_2", effectiveFrom: "2026-01-01" }, user); await salary.approveProfile(profile2.id, user);
  const schedules = new (load("work-schedule/work-schedule.service.js").WorkScheduleService)(apiDb);
  const policies = new (load("attendance/attendance-policy.service.js").AttendancePolicyService)(apiDb);
  for (const companyId of [parent.id, office.id]) {
    // The existing approved initial setup is the only authorized historical
    // schedule creation contract. Match it exactly instead of backdating an
    // arbitrary schedule or changing the production clock/rules.
    await schedules.createAssignment(companyId, { scope: "COMPANY_DEFAULT", effectiveFrom: "2026-09-01", newSchedule: { code: "STANDARD_OFFICE", name: "Standard Office Schedule", days:
      ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map(dayOfWeek => ({ dayOfWeek,
        isWorkingDay: dayOfWeek !== "FRIDAY", startMinuteOfDay: dayOfWeek === "FRIDAY" ? null : 600,
        endMinuteOfDay: dayOfWeek === "FRIDAY" ? null : 1080, unpaidBreakMinutes: dayOfWeek === "FRIDAY" ? 0 : 60, crossesMidnight: false })) } }, user);
    await policies.createInitialPolicy(companyId, { effectiveFrom: "2026-01-01", lateGraceMinutes: 5, earlyLeaveGraceMinutes: 5 }, user);
  }
  const expectations = new (load("attendance/attendance-expectation.service.js").AttendanceExpectationService)(apiDb, schedules);
  const attendance = new (load("attendance/attendance-day.service.js").AttendanceDayService)(apiDb, expectations);
  const finalization = new (load("attendance/attendance-finalization.service.js").AttendanceFinalizationService)(apiDb, expectations);
  const zero = () => ({ amount: "0.00", zeroConfirmed: true });
  const input = (month: number) => ({ year: 2026, month, deductions: employees.map(e => ({ year: 2026, month, employeeId: e.id,
    attendanceDeduction: zero(), providentFundDeduction: zero(), loanOrSalaryAdvanceDeduction: zero(), aitDeduction: zero(), otherApprovedDeductions: [], otherDeductionsZeroConfirmed: true })) });
  const beforeAttendance = await counts(db), blocked = await http("/payroll-runs", input(9));
  assert.equal(blocked.status, 422); assert(blocked.body.exceptions.some((e: any) => e.code === "ATTENDANCE_DATE_MISSING")); assert.deepEqual(await counts(db), beforeAttendance);
  pass("real authenticated POST rejects missing monthly attendance without payroll/line/audit writes");
  for (const month of [9]) {
    const days = new Date(Date.UTC(2026, month, 0)).getUTCDate();
    for (let day = 1; day <= days; day++) {
      const businessDate = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, companyId = day % 2 ? parent.id : office.id;
      const weekday = new Date(`${businessDate}T00:00:00Z`).getUTCDay();
      if (weekday !== 5) await attendance.saveEntries(companyId, { businessDate, entries: employees.map(e => ({ employeeId: e.id, checkInLocalTime: "10:00", checkOutLocalTime: "18:00", expectedUpdatedAt: null })) }, user);
      const finalized = await finalization.finalizeDay(companyId, { businessDate }, user);
      assert.equal(finalized.summary.incomplete, 0); assert.equal(finalized.summary.absent, 0);
    }
    console.log(`Verified fixture authority through real attendance workflows: 2026-${month}, ${days} calendar days across two offices`);
  }
  for (const action of ["SALARY_STRUCTURE_APPROVED", "SALARY_ASSIGNMENT_APPROVED", "PAYMENT_PROFILE_APPROVED"]) assert.equal(await db.auditEvent.count({ where: { action } }), action === "SALARY_STRUCTURE_APPROVED" ? 1 : 2);
  pass("real salary approval and full-month workday/rest finalization workflows produced persisted authority across offices");
  const previewBefore = await counts(db), preview = await http("/payroll-runs/preview", input(9));
  assert.equal(preview.status, 200); assert.equal(preview.body.status, "READY"); assert.equal(preview.body.parent.id, parent.id);
  assert.equal(preview.body.employees[0].attendance.recordedDateCount, 30); assert.equal(preview.body.financialTotals.amounts.netPay, "200.02");
  assert(!JSON.stringify(preview.body).includes("PRIVATE_SENTINEL")); assert.deepEqual(await counts(db), previewBefore);
  pass("real read-only READY preview uses PRIMARY despite selected other office, filters private data and leaves all three counts unchanged");
  const createdResponse = await http("/payroll-runs", input(9)); assert.equal(createdResponse.status, 201, JSON.stringify(createdResponse.body));
  const run = await db.payrollRun.findUnique({ where: { id: createdResponse.body.id }, include: { lines: true } });
  assert.equal(await db.payrollRun.count(), 1); assert.equal(await db.payrollRunLine.count(), 2);
  assert.equal(run.status, "DRAFT"); assert.equal(run.companyId, parent.id); assert.equal(run.createdById, actor.id); assert.equal(run.version, 1); assert.equal(run.approvedAt, null); assert.equal(run.approvedById, null);
  const line = run.lines.find((l: any) => l.employeeId === employee.id); assert.equal(line.grossSalary.toFixed(2), "100.01"); assert.equal(line.totalDeductions.toFixed(2), "0.00");
  assert.equal(line.netPay.toFixed(2), "100.01"); assert.equal(line.bankPay.toFixed(2), "60.01"); assert.equal(line.cashPay.toFixed(2), "40.00");
  assert.deepEqual([line.salaryAssignmentId, line.salaryStructureId, line.paymentProfileId], [assignment.id, structure.id, profile.id]);
  assert.equal(line.employeeSnapshot.fullName, employee.fullName); assert.equal(line.paymentProfileSnapshot.accountNumber, "PRIVATE_SENTINEL");
  assert.equal(line.calculationSnapshot.attendanceCoverage, "VERIFIED"); assert.equal(line.calculationSnapshot.attendanceEvidence.length, 30);
  assert.equal(new Set(line.calculationSnapshot.attendanceEvidence.map((e: any) => e.businessDate)).size, 30);
  const audit = await db.auditEvent.findMany({ where: { action: "PAYROLL_RUN_DRAFT_CREATED" } }); assert.equal(audit.length, 1);
  assert.equal(audit[0].entityId, run.id); assert.equal(audit[0].userId, actor.id); assert.equal(audit[0].metadata.sourceValidation, "IN_TRANSACTION");
  assert.equal(audit[0].metadata.lineCount, 2); assert(!JSON.stringify(audit).includes("PRIVATE_SENTINEL"));
  const approvedAssignment = await db.employeeSalaryAssignment.findUnique({ where: { id: assignment.id } });
  const approvedStructure = await db.salaryStructure.findUnique({ where: { id: structure.id } });
  const approvedProfile = await db.employeePaymentProfile.findUnique({ where: { id: profile.id } });
  assert.equal(line.salarySnapshot.structureVersion, approvedStructure.version);
  assert.equal(line.salarySnapshot.assignmentUpdatedAt, approvedAssignment.updatedAt.toISOString());
  assert.equal(line.salarySnapshot.structureUpdatedAt, approvedStructure.updatedAt.toISOString());
  assert.equal(line.paymentProfileSnapshot.sourceUpdatedAt, approvedProfile.updatedAt.toISOString());
  assert.equal(line.salarySnapshot.grossSalary, "100.01"); assert.equal(line.paymentProfileSnapshot.selectedBankPercentage, "60.000000");
  for (const evidence of line.calculationSnapshot.attendanceEvidence) assert(evidence.revision.id && evidence.revision.revisionNo === 1);
  pass("real POST creates exactly one DRAFT, two distinct lines and one creation audit; exact money and source/attendance snapshots verified");
  const probes = [
    ["gross_salary_positive", '"grossSalary"=0'],
    ["total_earnings_positive", '"totalEarnings"=0,"netPay"=0,"bankPay"=0,"cashPay"=0'],
    ["amounts_non_negative", '"attendanceDeduction"=-1,"totalDeductions"=-1,"netPay"=101.01,"cashPay"=41.00'],
    ["deductions_reconcile", '"totalDeductions"=1,"netPay"=99.01,"cashPay"=39.00'],
    ["net_pay_reconcile", '"netPay"=99.01,"cashPay"=39.00'],
    ["payments_reconcile", '"bankPay"=60.00'],
  ];
  const financialClient = new Client({ connectionString: isolatedUrl.toString() });
  await financialClient.connect();
  try {
    assert.equal((await financialClient.query("SELECT current_database() AS db")).rows[0].db, databaseName);
    await financialClient.query("BEGIN");
    for (const [name, assignments] of probes) {
      await financialClient.query("SAVEPOINT financial_probe");
      try { await financialClient.query(`UPDATE payroll_run_lines SET ${assignments} WHERE id=$1`, [line.id]); assert.fail(`Missing ${name} enforcement`); }
      catch (error: any) { assert.equal(error.code, "23514"); assert.equal(error.constraint, `payroll_run_lines_${name}_check`); }
      finally { await financialClient.query("ROLLBACK TO SAVEPOINT financial_probe"); await financialClient.query("RELEASE SAVEPOINT financial_probe"); }
    }
  } finally { try { await financialClient.query("ROLLBACK"); } finally { await financialClient.end(); } }
  await db.$transaction(async (tx: any) => {
    await tx.$executeRawUnsafe("SAVEPOINT employee_unique_probe");
    try { await tx.payrollRunLine.create({ data: { ...line, id: randomUUID() } }); assert.fail("Duplicate employee line accepted"); }
    catch (error: any) { assert.equal(error.code, "P2002"); }
    finally { await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT employee_unique_probe"); await tx.$executeRawUnsafe("RELEASE SAVEPOINT employee_unique_probe"); }
  });
  assert.deepEqual(await db.payrollRunLine.findUnique({ where: { id: line.id } }), line);
  pass("all six actual financial CHECK violations and duplicate employee line rejected; savepoints restored the exact original line");
  const detail = await http(`/payroll-runs/${run.id}`), list = await http("/payroll-runs?year=2026&month=9");
  assert.equal(detail.status, 200); assert.equal(detail.body.lines[0].netPay, "100.01"); assert(!JSON.stringify(detail.body).includes("PRIVATE_SENTINEL")); assert.equal(list.body.total, 1);
  const duplicateBefore = await counts(db); assert.equal((await http("/payroll-runs", input(9))).status, 409); assert.deepEqual(await counts(db), duplicateBefore);
  pass("real GET list/detail retrieval and duplicate-month HTTP 409 preserve existing draft and audit");

  // Reset only this harness's already-asserted disposable DRAFT fixture to test
  // the same supported historical month again. No source/approval/attendance
  // records change, and no business database is ever writable by these clients.
  assert.equal((await db.$queryRawUnsafe("SELECT current_database() AS db"))[0].db, databaseName);
  await db.$transaction(async (tx: any) => {
    assert.equal(await tx.payrollRun.count(), 1); assert.equal(await tx.payrollRunLine.count(), 2);
    assert.equal((await tx.payrollRun.findUnique({ where: { id: run.id } })).status, "DRAFT");
    await tx.payrollRunLine.deleteMany({ where: { payrollRunId: run.id } });
    await tx.auditEvent.deleteMany({ where: { action: "PAYROLL_RUN_DRAFT_CREATED", entityId: run.id } });
    await tx.payrollRun.delete({ where: { id: run.id } });
  });

  // Fault injection only in this fresh database: an audit insert raises after
  // the nested run/line insert. No validation or source authority is bypassed.
  await db.$executeRawUnsafe(`CREATE FUNCTION payroll_accept_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PAYROLL_RUN_DRAFT_CREATED' THEN RAISE EXCEPTION 'isolated acceptance audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER payroll_accept_fail_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION payroll_accept_fail_audit()`);
  const failureBefore = await counts(db);
  try { assert.equal((await http("/payroll-runs", input(9))).status, 500); assert.deepEqual(await counts(db), failureBefore); }
  finally { await db.$executeRawUnsafe("DROP TRIGGER payroll_accept_fail_audit ON audit_events"); await db.$executeRawUnsafe("DROP FUNCTION payroll_accept_fail_audit()"); }
  assert.equal(await db.payrollRun.count({ where: { payrollMonth: 9 } }), 0);
  pass("actual PostgreSQL audit failure rolls back run, lines and audit atomically");

  const c1 = roleSecurity ? await security.newRuntime() : await newClient(), c2 = roleSecurity ? await security.newRuntime() : await newClient();
  const pid1 = (await c1.$queryRawUnsafe("SELECT pg_backend_pid() AS pid"))[0].pid, pid2 = (await c2.$queryRawUnsafe("SELECT pg_backend_pid() AS pid"))[0].pid;
  assert.notEqual(pid1, pid2);
  const writer = (client: any) => { const parent = new PayrollParentResolver(client);
    return new PayrollDraftService(client, new PayrollReadinessService(client, parent,
      new MonthlyPayrollCalculationService(client, parent, new SalaryCalculator()), new PayrollAttendanceCompletenessService())); };
  // Hold the real INSERT behind an advisory-lock trigger so both distinct
  // SERIALIZABLE writers overlap before either can finish. It adds no authority
  // and does not relax any production constraint or validation.
  const lockKey = 73261013;
  await db.$executeRawUnsafe(`CREATE FUNCTION payroll_accept_overlap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${lockKey}); RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER payroll_accept_overlap BEFORE INSERT ON payroll_runs FOR EACH ROW EXECUTE FUNCTION payroll_accept_overlap()`);
  const gate = new Client({ connectionString: isolatedUrl.toString() }); await gate.connect();
  assert.equal((await gate.query("SELECT current_database() AS db")).rows[0].db, databaseName);
  let results: PromiseSettledResult<any>[];
  try {
    await gate.query("SELECT pg_advisory_lock($1)", [lockKey]);
    const pending = Promise.allSettled([writer(c1).create(input(9), user), writer(c2).create(input(9), user)]);
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const locks = (await gate.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND pid=ANY($1::int[])", [[pid1, pid2]])).rows[0].n;
      if (locks === 2) { waiting = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await gate.query("SELECT pg_advisory_unlock($1)", [lockKey]);
    results = await pending; assert(waiting, "Both independent PostgreSQL transactions must overlap at the insert boundary");
  } finally { await gate.end(); await db.$executeRawUnsafe("DROP TRIGGER payroll_accept_overlap ON payroll_runs"); await db.$executeRawUnsafe("DROP FUNCTION payroll_accept_overlap()"); }
  assert.equal(results!.filter(r => r.status === "fulfilled").length, 1);
  const rejected = results!.find(r => r.status === "rejected") as PromiseRejectedResult; assert.equal(rejected.reason.getStatus(), 409);
  assert.equal(await db.payrollRun.count({ where: { payrollYear: 2026, payrollMonth: 9 } }), 1);
  assert.equal(await db.payrollRun.count(), 1); assert.equal(await db.payrollRunLine.count(), 2);
  assert.equal(await db.auditEvent.count({ where: { action: "PAYROLL_RUN_DRAFT_CREATED" } }), 1);
  assert.equal((await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM payroll_run_lines l LEFT JOIN payroll_runs r ON r.id=l."payrollRunId" WHERE r.id IS NULL`))[0].n, 0);
  pass("two distinct real PostgreSQL connections overlapped: one successful draft, one controlled 409, no duplicate/orphan/extra creation audit");

  const approvalTarget = await db.payrollRun.findFirst({ where: { payrollYear: 2026, payrollMonth: 9 }, include: { lines: true } });
  const approvalPath = `/payroll-runs/${approvalTarget.id}/approve`, body = { expectedVersion: 1 }, makerCookie = cookie;
  assert.equal((await http(approvalPath, body)).status, 403);
  cookie = undefined; assert.equal((await http(approvalPath, body)).status, 401); cookie = makerCookie;
  const checkerPassword = randomUUID(), checker = await db.user.create({ data: { email: "payroll-checker@example.invalid", fullName: "Synthetic Checker",
    passwordHash: await req("bcryptjs").hash(checkerPassword, 10), roles: { create: { roleId: role.id } } } });
  const checkerLogin = await http("/auth/login", { email: checker.email, password: checkerPassword }); assert.equal(checkerLogin.status, 200);
  cookie = checkerLogin.cookie.split(";")[0]; const checkerUser = checkerLogin.body.user;
  const checkerSession = await db.authSession.findFirst({ where: { userId: checker.id }, orderBy: { createdAt: "desc" } });
  await companies.switchCompany(office.id, { id: checkerSession.id, activeCompanyId: parent.id });
  assert.equal((await http(approvalPath, { ...body, approvedById: actor.id })).status, 400);
  assert.equal((await http(approvalPath, { expectedVersion: 2 })).status, 409);
  pass("real approval HTTP authorization, maker-checker, strict body and stale-version rejection");
  // Correction persistence is deliberately unsupported. Assess actual inputs
  // against real sources; never manufacture a successful history revision.
  const correctionResolver = new PayrollParentResolver(db);
  const correction = new PayrollCorrectionPreflightService(db, correctionResolver,
    new MonthlyPayrollCalculationService(db, correctionResolver, new SalaryCalculator()), new PayrollAttendanceCompletenessService());
  const correctionInput = { ...input(9), runId: approvalTarget.id, expectedVersion: 1, reason: "Isolated read-only correction assessment" };
  const preflightCounts = await counts(db), preflightRun = await db.payrollRun.findUnique({ where: { id: approvalTarget.id }, include: { lines: true } });
  const preflight = await correction.assess(correctionInput, checkerUser);
  assert.equal(preflight.validationStatus, "PASS"); assert.equal(preflight.readyForCorrection, false);
  assert(preflight.blockers.some((b: any) => b.code === "CORRECTION_HISTORY_STORAGE_CONTRACT_MISSING"));
  assert(preflight.blockers.some((b: any) => b.code === "CORRECTION_REVISER_IDENTITY_CONTRACT_MISSING"));
  const staleCorrection = await correction.assess({ ...correctionInput, expectedVersion: 2 }, checkerUser);
  assert(staleCorrection.blockers.some((b: any) => b.code === "PAYROLL_VERSION_CONFLICT"));
  assert.equal((await http(`/payroll-runs/${approvalTarget.id}/correct`, correctionInput)).status, 404);
  assert.deepEqual(await counts(db), preflightCounts);
  assert.deepEqual(await db.payrollRun.findUnique({ where: { id: approvalTarget.id }, include: { lines: true } }), preflightRun);
  pass("actual correction preflight validates sources/attendance/zero inputs but fails closed; stale input and absent correction route retain the exact DRAFT");
  const auditColumns = await db.$queryRawUnsafe(`SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_events' AND column_name IN ('metadata','userId')`);
  assert(auditColumns.every((c: any) => c.is_nullable === "YES")); assert.equal(auditColumns.length, 2);
  const auditActorFk = await db.$queryRawUnsafe(`SELECT confdeltype::text AS deletion FROM pg_constraint WHERE conrelid='audit_events'::regclass AND contype='f'`);
  assert(auditActorFk.some((c: any) => c.deletion === "n"));
  pass("actual audit schema confirms nullable JSON/actor and SET NULL identity retention limitation; no revision authority claimed");
  const approvalBefore = await db.payrollRun.findUnique({ where: { id: approvalTarget.id }, include: { lines: true } }), approvalCounts = await counts(db);
  await db.$executeRawUnsafe(`CREATE FUNCTION payroll_accept_fail_approval_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PAYROLL_RUN_APPROVED' THEN RAISE EXCEPTION 'isolated approval audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER payroll_accept_fail_approval_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION payroll_accept_fail_approval_audit()`);
  try { const failed = await http(approvalPath, body); assert.equal(failed.status, 500, JSON.stringify(failed.body));
    assert.deepEqual(await db.payrollRun.findUnique({ where: { id: approvalTarget.id }, include: { lines: true } }), approvalBefore); assert.deepEqual(await counts(db), approvalCounts);
  } finally { await db.$executeRawUnsafe("DROP TRIGGER payroll_accept_fail_approval_audit ON audit_events"); await db.$executeRawUnsafe("DROP FUNCTION payroll_accept_fail_approval_audit()"); }
  pass("actual approval audit failure rolls back status, version, approver/time and preserves all lines/snapshots");
  const approver = (client: any) => { const resolver = new PayrollParentResolver(client); return new PayrollApprovalService(client,
    new PayrollApprovalReadinessService(client, resolver, new MonthlyPayrollCalculationService(client, resolver, new SalaryCalculator()), new PayrollAttendanceCompletenessService())); };
  const mainPid = (await apiDb.$queryRawUnsafe("SELECT pg_backend_pid() AS pid"))[0].pid;
  const approvalGate = new Client({ connectionString: isolatedUrl.toString() }); await approvalGate.connect();
  assert.equal((await approvalGate.query("SELECT current_database() AS db")).rows[0].db, databaseName);
  let firstRequest: Promise<any> | undefined, secondRequest: Promise<any> | undefined, successful: any;
  const waitLocks = async (pids: number[]) => {
    for (let i = 0; i < 100; i++) {
      const row = (await approvalGate.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND wait_event_type='Lock'", [pids])).rows[0];
      if (row.n === pids.length) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new assert.AssertionError({ message: "Approval connections did not overlap at the row-update boundary" });
  };
  try {
    await approvalGate.query("BEGIN"); await approvalGate.query('SELECT id FROM payroll_runs WHERE id=$1 FOR UPDATE', [approvalTarget.id]);
    firstRequest = http(approvalPath, body); await waitLocks([mainPid]);
    // Separate pool/connection and the same genuine authenticated checker.
    // It must independently run every production readiness check.
    secondRequest = approver(c1).approve(approvalTarget.id, body, checkerUser).then((result: any) => ({ status: 200, body: result }), (e: any) => ({ status: e.getStatus?.() }));
    await waitLocks([mainPid, pid1]); await approvalGate.query("COMMIT");
    const responses = await Promise.all([firstRequest, secondRequest]); assert.equal(responses[0].status, 200, JSON.stringify(responses[0].body));
    assert.equal(responses[1].status, 409); successful = responses[0].body;
  } finally {
    await approvalGate.query("ROLLBACK"); await approvalGate.end(); await Promise.allSettled([firstRequest, secondRequest].filter(Boolean));
  }
  const approvedRun = await db.payrollRun.findUnique({ where: { id: approvalTarget.id }, include: { lines: true } });
  assert.equal(approvedRun.status, "APPROVED"); assert.equal(approvedRun.version, 2); assert.equal(approvedRun.approvedById, checker.id);
  assert.equal(successful.approvedAt, approvedRun.approvedAt.toISOString()); assert(approvedRun.approvedAt >= approvedRun.createdAt);
  assert.notEqual(approvedRun.createdById, approvedRun.approvedById); assert.deepEqual(approvedRun.lines, approvalBefore.lines); assert.deepEqual(approvedRun.companySnapshot, approvalBefore.companySnapshot);
  const approvalAudits = await db.auditEvent.findMany({ where: { action: "PAYROLL_RUN_APPROVED", entityId: approvedRun.id } }); assert.equal(approvalAudits.length, 1);
  assert.equal(approvalAudits[0].userId, checker.id); assert.equal(approvalAudits[0].metadata.createdById, actor.id);
  assert.equal(approvalAudits[0].metadata.previousVersion, 1); assert.equal(approvalAudits[0].metadata.newVersion, 2);
  assert(!JSON.stringify(successful).includes("PRIVATE_SENTINEL")); assert(!JSON.stringify(approvalAudits).includes("PRIVATE_SENTINEL"));
  pass("actual HTTP approval and separate-connection overlapping contender: one APPROVED/version 2, one 409 and one atomic approval audit");
  const documents = new PayrollDocumentsService(db, new PayrollParentResolver(db));
  const docPaths = employees.map(e => `/payroll-runs/${approvedRun.id}/payslips/${e.id}`);
  const sheetPath = `/payroll-runs/${approvedRun.id}/salary-sheet`, documentBefore = await counts(db);
  const sheetResponse = await http(sheetPath); assert.equal(sheetResponse.status, 200, JSON.stringify(sheetResponse.body));
  const originalSheet = sheetResponse.body, originalSlips: any[] = [];
  assert.equal(originalSheet.employeeCount, 2); assert.equal(originalSheet.rows.length, 2);
  assert.equal(new Set(originalSheet.rows.map((r: any) => r.employee.employeeId)).size, 2);
  assert.deepEqual(originalSheet, await documents.salarySheet(approvedRun.id));
  for (let i = 0; i < employees.length; i++) {
    const response = await http(docPaths[i]); assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.employee.employeeId, employees[i].id); assert.equal(response.body.employee.fullName, employees[i].fullName);
    assert.deepEqual(response.body, await documents.payslip(approvedRun.id, employees[i].id)); originalSlips.push(response.body);
    assert.equal(response.body.plannedAllocation.kind, "PLANNED"); assert(response.body.paymentNotice.includes("does not confirm payment"));
    assert.equal(response.body.approvedAt, approvedRun.approvedAt.toISOString()); assert.equal(response.body.company.name, parent.name);
  }
  for (const [key, total] of Object.entries(originalSheet.totals)) {
    const actual = originalSlips.reduce((sum, slip) => sum.plus(slip.amounts[key]), new (load("generated/prisma/client.js").Prisma.Decimal)(0));
    assert.equal(actual.toFixed(2), total);
  }
  for (const value of [...originalSlips, originalSheet]) {
    const encoded = JSON.stringify(value); assert(!/PRIVATE_SENTINEL|paymentProfileSnapshot|employeeSnapshot|salarySnapshot|calculationSnapshot|accountNumber|nationalId|auditPayload/.test(encoded));
    assert(!encoded.includes('"PAID"'));
  }
  assert.deepEqual(await counts(db), documentBefore);
  pass("actual HTTP/services retrieve two unique approved payslips and complete sheet, exact category totals, historical branding, planned allocations and safe DTOs without mutations");
  cookie = undefined; for (const path of [...docPaths, sheetPath]) assert.equal((await http(path)).status, 401); cookie = checkerLogin.cookie.split(";")[0];
  const deniedPassword = randomUUID(); const deniedUser = await db.user.create({ data: { email: "document-denied@example.invalid", fullName: "Denied Test User", passwordHash: await req("bcryptjs").hash(deniedPassword, 10), roles: { create: { roleId: role.id } } } });
  const deniedLogin = await http("/auth/login", { email: deniedUser.email, password: deniedPassword }); assert.equal(deniedLogin.status, 200);
  // Login requires ACCOUNTANT too. Revoke this isolated identity's assignment
  // after genuine login to prove document guards re-read current permissions.
  await db.userRole.deleteMany({ where: { userId: deniedUser.id } });
  cookie = deniedLogin.cookie.split(";")[0]; for (const path of [...docPaths, sheetPath]) assert.equal((await http(path)).status, 403);
  cookie = checkerLogin.cookie.split(";")[0];
  assert.equal((await http(`/payroll-runs/${approvedRun.id}/payslips/nonexistent`)).status, 404);
  assert.equal((await http('/payroll-runs/nonexistent/salary-sheet')).status, 404);
  assert.equal((await http('/payroll-runs/nonexistent/payslips/nonexistent')).status, 404);
  // Negative ownership/status fixtures only in this harness-owned database.
  const { lines: fixtureLines, ...fixtureRun } = approvedRun;
  assert.equal(fixtureLines.length, 2);
  const foreign = await db.payrollRun.create({ data: { ...fixtureRun, id: randomUUID(), companyId: office.id, payrollMonth: 8 } });
  const draftDocument = await db.payrollRun.create({ data: { ...fixtureRun, id: randomUUID(), payrollMonth: 7, status: "DRAFT", version: 1, approvedAt: null, approvedById: null } });
  try {
    for (const suffix of ['salary-sheet', `payslips/${employee.id}`]) {
      assert.equal((await http(`/payroll-runs/${foreign.id}/${suffix}`)).status, 404);
      assert.equal((await http(`/payroll-runs/${draftDocument.id}/${suffix}`)).status, 409);
    }
  } finally { await db.payrollRun.deleteMany({ where: { id: { in: [foreign.id, draftDocument.id] } } }); }
  pass("actual document HTTP rejects unauthenticated/non-ACCOUNTANT, foreign, DRAFT, missing-run and missing-employee requests");
  const immutableBefore = await counts(db);
  const approvedCorrection = await correction.assess({ ...correctionInput, expectedVersion: 2 }, checkerUser);
  assert(approvedCorrection.blockers.some((b: any) => b.code === "PAYROLL_NOT_DRAFT"));
  assert.equal((await http(approvalPath, body)).status, 409); assert.equal((await http(approvalPath, { expectedVersion: 2 })).status, 409);
  for (const path of [`/payroll-runs/${approvedRun.id}`, `/payroll-runs/${approvedRun.id}/lines/${approvedRun.lines[0].id}`]) {
    for (const method of ["PATCH", "PUT", "DELETE"]) assert.equal((await http(path, undefined, method)).status, 404);
  }
  assert.equal((await http("/payroll-runs", input(9))).status, 409);
  const approvedPreview = await http("/payroll-runs/preview", input(9)); assert.equal(approvedPreview.body.status, "BLOCKED"); assert(approvedPreview.body.exceptions.some((e: any) => e.code === "PAYROLL_ALREADY_APPROVED"));
  assert.deepEqual(await counts(db), immutableBefore);
  // Explicit grant fixtures exist ONLY in this harness-owned database. They
  // exercise persisted relationships, not an invented production grant API.
  const asset = await db.accountClass.create({ data: { code: "ASSET", name: "Synthetic Assets", normalBalance: "DEBIT" } });
  const group = await db.accountGroup.create({ data: { accountClassId: asset.id, code: "FUNDS", name: "Synthetic Funds" } });
  const bankLedger = await db.ledgerAccount.create({ data: { accountGroupId: group.id, code: "TESTBANK", name: "Synthetic Bank Ledger", normalBalance: "DEBIT", isCashBank: true } });
  const cashLedger = await db.ledgerAccount.create({ data: { accountGroupId: group.id, code: "TESTCASH", name: "Synthetic Cash Ledger", normalBalance: "DEBIT", isCashBank: true } });
  const funds = new (load("cash-bank/cash-bank.service.js").CashBankService)(apiDb);
  const bankSource = await funds.create({ ledgerAccountId: bankLedger.id, displayName: "Synthetic Source Bank", accountType: "BANK", isActive: true });
  const cashSource = await funds.create({ ledgerAccountId: cashLedger.id, displayName: "Synthetic Source Cash", accountType: "CASH", isActive: true });
  const paymentService = (original: any) => { const client = roleSecurity && original === db ? apiDb : original; return new PayrollPaymentBatchService(client, new PayrollParentResolver(client), new PayrollPaymentPreparationService(client, new PayrollDocumentsService(client, new PayrollParentResolver(client)))); };
  const payment = paymentService(db);
  const paymentFks = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid IN ('payroll_source_authorizations'::regclass,'payroll_payment_batches'::regclass,'payroll_payment_lines'::regclass,'payroll_payment_confirmations'::regclass) AND contype='f' AND confdeltype='r' AND confupdtype='r' AND convalidated`);
  assert.equal(paymentFks[0].n, 13);
  const batchInput = (employeeId: string, channel = "BANK", key = randomUUID()) => ({ payrollRunId: approvedRun.id, sourceAccountId: channel === "BANK" ? bankSource.id : cashSource.id, channel, employeeIds: [employeeId], idempotencyKey: key });
  const paymentCounts = async () => ({ batches: await db.payrollPaymentBatch.count(), lines: await db.payrollPaymentLine.count(), confirmations: await db.payrollPaymentConfirmation.count(), audits: await db.auditEvent.count() });
  const deniedBefore = await paymentCounts();
  const paymentDraft = await db.payrollRun.create({ data: { ...fixtureRun, id: randomUUID(), payrollMonth: 6, status: "DRAFT", version: 1, approvedAt: null, approvedById: null } });
  try { await assert.rejects(() => payment.prepare({ ...batchInput(employee.id), payrollRunId: paymentDraft.id }, user), (e: any) => e.getStatus() === 409); }
  finally { await db.payrollRun.delete({ where: { id: paymentDraft.id } }); }
  await assert.rejects(() => payment.prepare(batchInput(employee.id), user), (e: any) => e.getStatus() === 422);
  await assert.rejects(() => payment.prepare({ ...batchInput(employee.id), sourceAccountId: cashSource.id }, user), (e: any) => e.getStatus() === 422);
  await assert.rejects(() => payment.prepare(batchInput(employee.id), { ...user, roles: [] }), (e: any) => e.getStatus() === 403);
  await assert.rejects(() => payment.prepare({ ...batchInput(employee.id), payrollRunId: "missing" }, user), (e: any) => e.getStatus() === 404);
  assert.deepEqual(await paymentCounts(), deniedBefore);
  const { PayrollPaymentAuthority, PayrollPaymentLifecycleService } = load("payroll/payroll-payment-lifecycle.service.js");
  const evidence = new Map<string, { digest: string; batchId: string }>();
  const technicalAuthority = technicalPaymentAuthority(databaseName, evidence);
  const lifecycleFor = (client: any) => new PayrollPaymentLifecycleService(roleSecurity ? security.financeFor(client) : client, new PayrollParentResolver(roleSecurity ? security.financeFor(client) : client), technicalAuthority);
  const lifecycle = lifecycleFor(db);
  await assert.rejects(() => new PayrollPaymentLifecycleService(db, new PayrollParentResolver(db), new PayrollPaymentAuthority()).requestGrant({ sourceAccountId: bankSource.id, channel: "BANK", idempotencyKey: randomUUID() }, user), (e: any) => e.getResponse?.().code === "FINANCE_DELEGATE_AUTHORITY_UNAVAILABLE");
  for (const identity of [actor, checker]) await (roleSecurity ? security.financeClient : db).payrollFinanceDelegate.create({ data: { companyId: parent.id, userId: identity.id, canInitiate: true, canReview: true, generation: 1, initiatedById: actor.id, reviewedById: checker.id, authorityReference: "ISOLATED_TECHNICAL_NOT_BUSINESS_DELEGATION", auditSnapshot: { fixtureOnly: true, actorId: actor.id, reviewerId: checker.id } } });
  for (const [source, channel] of [[bankSource, "BANK"], [cashSource, "CASH"]]) {
    const grant = await lifecycle.requestGrant({ sourceAccountId: source.id, channel, idempotencyKey: randomUUID() }, user);
    await lifecycle.reviewSourceAction(grant.actionId, checkerUser);
  }
  pass("payment migration applied; explicit PRIMARY BANK/CASH grant relationships and unauthorized/wrong-channel/actor/missing-run rejection verified");
  await db.$executeRawUnsafe(`CREATE FUNCTION payment_accept_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PAYROLL_PAYMENT_BATCH_PREPARED' THEN RAISE EXCEPTION 'isolated payment audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER payment_accept_fail_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION payment_accept_fail_audit()`);
  const paymentFailureBefore = await paymentCounts();
  try { await assert.rejects(() => payment.prepare(batchInput(employee.id), user), (e: any) => e.getStatus() === 500); assert.deepEqual(await paymentCounts(), paymentFailureBefore); }
  finally { await db.$executeRawUnsafe("DROP TRIGGER payment_accept_fail_audit ON audit_events"); await db.$executeRawUnsafe("DROP FUNCTION payment_accept_fail_audit()"); }
  const firstInput = batchInput(employee.id), savedCheckerCookie = cookie; cookie = makerCookie;
  const firstHttpBatch = await http("/payroll-runs/payment-batches", firstInput); assert.equal(firstHttpBatch.status, 201, JSON.stringify(firstHttpBatch.body));
  const firstBatch = firstHttpBatch.body; cookie = savedCheckerCookie;
  assert.equal(firstBatch.status, "PREPARED"); assert.equal(firstBatch.createdById, actor.id); assert.equal(firstBatch.totalAmount, "60.01");
  const replayCounts = await paymentCounts(); assert.deepEqual(await payment.prepare(firstInput, user), firstBatch); assert.deepEqual(await paymentCounts(), replayCounts);
  await assert.rejects(() => payment.prepare({ ...firstInput, employeeIds: [employee2.id] }, user), (e: any) => e.getStatus() === 409);
  const secondBatch = await payment.prepare(batchInput(employee2.id), user); assert.notEqual(secondBatch.id, firstBatch.id);
  await assert.rejects(() => payment.prepare(batchInput(employee.id), user), (e: any) => e.getStatus() === 409);
  assert.equal(await db.payrollPaymentLine.count(), 2); assert.equal(await db.payrollPaymentConfirmation.count(), 0);
  assert(!/PRIVATE_SENTINEL|obligationSnapshot|paymentProfileSnapshot/.test(JSON.stringify(firstBatch)));
  pass("atomic payment audit rollback; separate full-allocation employee batches, exact totals, maker, idempotent replay and duplicate reservation protection");
  const preparationReadBefore = await paymentCounts();
  for (const [channel, total, source] of [['BANK','120.02',bankSource.id],['CASH','80.00',cashSource.id]]) {
    const response = await http(`/payroll-runs/${approvedRun.id}/payment-preparation?channel=${channel}&sourceAccountId=${source}`);
    assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.totalPlanned,total);
    assert.equal(response.body.employeeCount,2);assert.equal(new Set(response.body.rows.map((r: any)=>r.employeeId)).size,2);
    assert.equal(response.body.status,'PREPARATION_NOT_DISBURSED');assert.equal(response.body.canDisburse,false);
    assert(!/PRIVATE_SENTINEL|accountNumber|paymentProfileSnapshot|obligationSnapshot/.test(JSON.stringify(response.body)));
  }
  assert.deepEqual(await paymentCounts(),preparationReadBefore);
  pass('genuine authenticated HTTP BANK/CASH preparation returns exact two-employee totals, safe DTOs and no payment mutations');
  const readinessDocuments=new PayrollDocumentsService(apiDb,new PayrollParentResolver(apiDb));
  const assessWith=(provider: any)=>new PayrollPaymentConfirmationReadinessService(apiDb,new PayrollParentResolver(apiDb),new PayrollPaymentPreparationService(apiDb,readinessDocuments),provider);
  const readinessBefore=await paymentCounts();
  const blockedEvidence=await assessWith(new PayrollPaymentEvidenceProvider()).assess(firstBatch.id,1,checkerUser);
  assert.deepEqual(blockedEvidence.blockers,[{code:'TRUSTED_EVIDENCE_VERIFIER_UNAVAILABLE'}]);
  const technicalProvider={isConfigured:()=>true,verify:async()=>null}; // Isolated fixture only, no claimed payment proof.
  const available=await assessWith(technicalProvider).assess(firstBatch.id,1,checkerUser);
  assert.equal(available.status,'READY_FOR_EVIDENCE_VERIFICATION');assert.equal(available.settlementVerified,false);
  const maker=await assessWith(technicalProvider).assess(firstBatch.id,1,user);assert(maker.blockers.some((b: any)=>b.code==='MAKER_CHECKER_REQUIRED'));
  const stale=await assessWith(technicalProvider).assess(firstBatch.id,2,checkerUser);assert(stale.blockers.some((b: any)=>b.code==='STALE_BATCH_VERSION'));
  assert(!/Snapshot|accountNumber|employeeId|PRIVATE_SENTINEL/.test(JSON.stringify(available)));
  assert.deepEqual(await paymentCounts(),readinessBefore);
  pass('real restricted PostgreSQL readiness verifies approved obligations/reservations/current grants, maker-checker, version and fail-closed provider without writes');
  if(process.argv.includes('--confirmation-security-review')) {
    assert(roleSecurity);
    await reviewConfirmationSecurity({db,apiDb,security,load,pass,databaseName});
    await verifyConfirmationEngine({db,apiDb,security,load,app,parent,bankSource,cashSource,approvedRun,user,checkerUser,lifecycle,lifecycleFor,evidence,payment,pass,http});
    assert.deepEqual(await sourceCounts(),baseline);
    console.log(`${passed} focused PostgreSQL confirmation review groups passed; legacy lifecycle suite skipped after genuine workflow fixture setup`);
    return;
  }
  const paymentProbe = new Client({ connectionString: isolatedUrl.toString() }); await paymentProbe.connect();
  try {
    assert.equal((await paymentProbe.query("SELECT current_database() AS db")).rows[0].db, databaseName); await paymentProbe.query("BEGIN");
    const savedLine = await db.payrollPaymentLine.findFirst({ where: { batchId: firstBatch.id } });
    const probes = [
      ["partial", `INSERT INTO payroll_payment_lines SELECT $1,"batchId","payrollRunLineId","employeeId",channel,1.00,jsonb_set("obligationSnapshot",'{amount}','"1.00"') FROM payroll_payment_lines WHERE id=$2`, [randomUUID(), savedLine.id], "23514"],
      ["excess", `INSERT INTO payroll_payment_lines SELECT $1,"batchId","payrollRunLineId","employeeId",channel,999.00,jsonb_set("obligationSnapshot",'{amount}','"999.00"') FROM payroll_payment_lines WHERE id=$2`, [randomUUID(), savedLine.id], "23514"],
      ["zero", `INSERT INTO payroll_payment_lines SELECT $1,"batchId","payrollRunLineId","employeeId",channel,0.00,"obligationSnapshot" FROM payroll_payment_lines WHERE id=$2`, [randomUUID(), savedLine.id], "23514"],
      ["immutable", `UPDATE payroll_payment_lines SET amount=1 WHERE id=$1`, [savedLine.id], "23514"],
      ["invalid grantor", `INSERT INTO payroll_source_authorizations SELECT $1,"companyId","sourceAccountId",channel,'missing',"grantedAt","expiresAt","auditSnapshot",generation+1,"sourceRevision","sourceSnapshot" FROM payroll_source_authorizations WHERE "sourceAccountId"=$2 ORDER BY generation DESC LIMIT 1`, [randomUUID(), bankSource.id], "23514"],
      ["wrong grant channel", `INSERT INTO payroll_source_authorizations(id,"companyId","sourceAccountId",channel,"grantedById","generation","sourceRevision","sourceSnapshot","auditSnapshot") SELECT $1,"companyId","sourceAccountId",'CASH',"grantedById",generation+1,"sourceRevision","sourceSnapshot","auditSnapshot" FROM payroll_source_authorizations WHERE "sourceAccountId"=$2 ORDER BY generation DESC LIMIT 1`, [randomUUID(), bankSource.id], "23514"],
    ];
    for (const [label, statement, params, expected] of probes) {
      await paymentProbe.query("SAVEPOINT payment_probe");
      try { await paymentProbe.query(statement, params); assert.fail(`Accepted ${label}`); } catch (e: any) { assert.equal(e.code, expected, String(label)); }
      finally { await paymentProbe.query("ROLLBACK TO SAVEPOINT payment_probe"); }
    }
    await paymentProbe.query("SAVEPOINT total_probe");
    try {
      const badBatchId = randomUUID();
      await paymentProbe.query(`INSERT INTO payroll_payment_batches SELECT $1,"companyId","payrollRunId","sourceAccountId","sourceAuthorizationId",channel,status,version,"createdById","createdAt",$2,"requestHash",61.01,"creationAudit" FROM payroll_payment_batches WHERE id=$3`, [badBatchId, randomUUID(), firstBatch.id]);
      await paymentProbe.query("SET CONSTRAINTS ALL IMMEDIATE"); assert.fail("Empty/mismatched batch committed");
    } catch (e: any) { assert.equal(e.code, "23514"); }
    finally { await paymentProbe.query("ROLLBACK TO SAVEPOINT total_probe"); }
  } finally { await paymentProbe.query("ROLLBACK"); await paymentProbe.end(); }
  pass("actual PostgreSQL partial/excess/zero allocations, immutable lines, missing grantor FK and incompatible source grants rejected with rollback-only probes");
  const concurrentInput = batchInput(employee.id, "CASH", randomUUID());
  await db.$executeRawUnsafe(`CREATE FUNCTION payment_accept_overlap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(73261014); RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER payment_accept_overlap BEFORE INSERT ON payroll_payment_batches FOR EACH ROW EXECUTE FUNCTION payment_accept_overlap()`);
  const paymentGate = new Client({ connectionString: isolatedUrl.toString() }); await paymentGate.connect();
  assert.equal((await paymentGate.query("SELECT current_database() AS db")).rows[0].db, databaseName);
  let cashResults: PromiseSettledResult<any>[];
  try {
    await paymentGate.query("SELECT pg_advisory_lock(73261014)");
    const pending = Promise.allSettled([paymentService(c1).prepare(concurrentInput, user), paymentService(c2).prepare(concurrentInput, user)]);
    let overlapped = false;
    for (let i = 0; i < 100; i++) { const n = (await paymentGate.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND pid=ANY($1::int[])", [[pid1, pid2]])).rows[0].n;
      const waiting = (await paymentGate.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE pid=ANY($1::int[]) AND wait_event_type='Lock'", [[pid1, pid2]])).rows[0].n;
      if (n >= 1 && waiting === 2) { overlapped = true; break; } await new Promise(resolve => setTimeout(resolve, 20)); }
    await paymentGate.query("SELECT pg_advisory_unlock(73261014)"); cashResults = await pending; assert(overlapped, "Payment writers must overlap at protected parent/insert locks");
  } finally { await paymentGate.end(); await db.$executeRawUnsafe("DROP TRIGGER payment_accept_overlap ON payroll_payment_batches"); await db.$executeRawUnsafe("DROP FUNCTION payment_accept_overlap()"); }
  assert.equal(cashResults!.filter(r => r.status === "fulfilled").length, 1);
  for (const r of cashResults!) if (r.status === "rejected") assert.equal(r.reason.getStatus(), 409);
  assert.equal(await db.payrollPaymentBatch.count({ where: { idempotencyKey: concurrentInput.idempotencyKey } }), 1);
  assert.equal(await db.payrollPaymentLine.count(), 3); assert.equal(await db.payrollPaymentConfirmation.count(), 0);
  assert.equal(await db.auditEvent.count({ where: { action: "PAYROLL_PAYMENT_BATCH_PREPARED" } }), 3);
  assert.deepEqual(await db.payrollRun.findUnique({ where: { id: approvedRun.id }, include: { lines: true } }), approvedRun);
  pass("two PostgreSQL connections protect concurrent CASH idempotency, one batch/line/audit, unchanged payroll history and zero confirmations");
  await reviewPaymentDatabase(db, readFileSync(join(root,"prisma/migrations/20261014000000_payroll_payment_foundation/migration.sql"),"utf8"));
  await verifyPaymentLifecycle({ db, c1, c2, lifecycle, lifecycleFor, payment, paymentFor: paymentService, batchInput, user, checkerUser, parent, bankSource, cashSource, firstBatch, secondBatch, evidence, employee, pass });
  const pendingProbe = await lifecycle.requestGrant({ sourceAccountId: bankSource.id, channel: "BANK", idempotencyKey: randomUUID() }, user);
  const sqlProbe = new Client({ connectionString: isolatedUrl.toString() }); await sqlProbe.connect();
  try { await verifyDirectPaymentProbes({ probe: sqlProbe, databaseName, db, parent, user, checkerUser, bankSource, firstBatch: await payment.prepare(batchInput(employee2.id),user), cancelledBatch: firstBatch, sourceActionId: pendingProbe.actionId, pass }); }
  finally { await sqlProbe.end(); }
  await verifyPaymentFinalIntegrity({ db, privilegesSeparated: roleSecurity, c1: roleSecurity ? security.finance1 : c1, c2: roleSecurity ? security.finance2 : c2, lifecycle, lifecycleFor, parent, actor, checker, user, checkerUser, bankSource, pass, databaseName });
  if(roleSecurity) await verifyScopedDatabaseSecurity({ db, security, lifecycleFor, isolatedUrl, databaseName, load, req, clients, parent, office, actor, checker, user, checkerUser, employees, bankSource, cashSource, approvedRun, input, pass });
  if(roleSecurity) await verifyConfirmationEngine({db,apiDb,security,load,app,parent,bankSource,cashSource,approvedRun,user,checkerUser,lifecycle,lifecycleFor,evidence,payment,pass,http}).catch((e: any)=>{console.error(JSON.stringify({confirmationError:e?.cause?.originalCode??e?.meta?.driverAdapterError?.cause?.originalCode,locations:e?.stack?.split("\n").filter((l: string)=>/^\s+at /.test(l)).slice(0,3)}));throw e;});
  await salary.inactivateStructure(structure.id, user); // Genuine isolated source change, not a payroll modification.
  const historical = await http(`/payroll-runs/${approvedRun.id}`); assert.equal(historical.status, 200); assert.equal(historical.body.status, "APPROVED");
  assert.equal(historical.body.lines[0].grossSalary, "100.01"); assert.equal((await http(approvalPath, { expectedVersion: 2 })).status, 409);
  assert.deepEqual(await db.payrollRun.findUnique({ where: { id: approvedRun.id }, include: { lines: true } }), approvedRun);
  assert.equal(await db.auditEvent.count({ where: { action: "PAYROLL_RUN_APPROVED" } }), 1); assert.equal(await db.voucher.count(), 0);
  pass("approved history survives repeated approval, mutation/regeneration attempts and later genuine source change; no vouchers/payments invoked");
  await companies.update(parent.id, { name: "Renamed Current Synthetic Parent", legalName: "Changed Current Legal Name" });
  assert.notEqual((await db.company.findUnique({ where: { id: parent.id } })).name, parent.name);
  assert.deepEqual((await http(sheetPath)).body, originalSheet);
  for (let i = 0; i < docPaths.length; i++) assert.deepEqual((await http(docPaths[i])).body, originalSlips[i]);
  assert.deepEqual(await db.payrollRun.findUnique({ where: { id: approvedRun.id }, include: { lines: true } }), approvedRun);
  pass("approved document identity, branding, components and all amounts remain byte-equivalent after genuine salary inactivation and company display-name changes");
  assert.deepEqual(await sourceCounts(), baseline); pass("safe development business-table counts unchanged; no existing business fixtures modified");
  console.log("BLOCKED correction-specific acceptance: correction writes/version increments, before/after revision preservation, correction concurrency/audit rollback, reviser exclusion and approval of corrected DRAFTs require a reviewed history/identity contract. No correction success was simulated.");
  console.log(`${passed} real PostgreSQL acceptance checks passed using isolated synthetic fixtures; no business payroll authorization implied`);
}

main().catch(e => { console.error(`FAIL isolated PostgreSQL acceptance: ${e?.code ?? e?.name ?? "ERROR"}${e instanceof assert.AssertionError ? ` (${e.message})` : ""}`);
  // Child migration diagnostics: expose only PostgreSQL error text, never URL,
  // process command/environment or credential-bearing connection diagnostics.
  if (e?.stderr) { const diagnostic = String(e.stderr).match(/ERROR: ([^\r\n]+)/); if (diagnostic && !/password|postgresql:\/\/|postgres:\/\//i.test(diagnostic[1])) console.error(`PostgreSQL migration: ${diagnostic[1]}`); }
  // Application validation messages concern only synthetic fixtures; never log
  // connection errors, connection strings, child-process output or credentials.
  if (e?.getResponse) console.error(JSON.stringify(e.getResponse())); process.exitCode = 1;
}).finally(async () => {
  try {
    if (app) await app.close();
    await Promise.all(clients.map(db => db.$disconnect()));
    if (created && connected) {
      assert.equal((await admin.query("SELECT current_database() AS db")).rows[0].db, decodeURIComponent(sourceUrl.pathname.slice(1)));
      const record = (await admin.query("SELECT oid,pg_get_userbyid(datdba) AS owner,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [databaseName])).rows[0];
      assert.equal(record?.oid, createdOid); assert.equal(record?.owner, owner); assert.equal(record?.marker, token);
      assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1", [databaseName])).rows[0].n, 0, "Other sessions exist; disposable database retained for safety");
      await admin.query(`DROP DATABASE "${databaseName}"`);
      assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_database WHERE datname=$1", [databaseName])).rows[0].n, 0);
      console.log("PASS cleanup: exact harness-owned disposable database removed after identity and zero-session checks");
    }
  } catch { console.error(`BLOCKED cleanup: retained ${databaseName}; ownership or session verification failed`); process.exitCode = 1; }
  finally {
    if (connected) await admin.end();
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    assert(output.startsWith(join(root, "apps/api/.payroll-accept-verify-"))); rmSync(output, { recursive: true, force: true });
  }
});
