// Offline HTTP/service verification. No real Prisma client is instantiated.
import "reflect-metadata";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..");
const requireRoot = createRequire(join(root, "package.json"));
const output = mkdtempSync(join(root, "apps/api/.payroll-read-verify-"));
let passed = 0;
async function check(name: string, work: () => Promise<void>) {
  await work();
  passed++;
  console.log(`PASS ${name}`);
}

async function main() {
  // Emit to a disposable directory, preserving the existing application build.
  execFileSync(process.execPath, [requireRoot.resolve("typescript/bin/tsc"),
    "-p", "apps/api/tsconfig.json", "--outDir", output, "--incremental", "false",
    "--declaration", "false", "--sourceMap", "false"], { cwd: root, stdio: "inherit" });
  const { ValidationPipe, BadRequestException, Module } = requireRoot("@nestjs/common");
  const { ListPayrollRunsQueryDto } = requireRoot(join(output, "payroll/dto/payroll-query.dto.js"));
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const validate = (value: unknown) => pipe.transform(value, { type: "query", metatype: ListPayrollRunsQueryDto });
  await check("invalid pagination and filters rejected", async () => {
    for (const value of [{ page: "0" }, { page: "10001" }, { pageSize: "101" }, { pageSize: "0" },
      { year: "0" }, { year: "10000" }, { month: "0" }, { month: "13" }, { status: "PAID" },
      { page: "1.5" }, { page: "1e2" }, { page: "" }, { page: true }, { page: ["1", "2"] },
      { month: "NaN" }, { year: "Infinity" }, { companyId: "office" }, { page: "999999999999999999999" }]) {
      await assert.rejects(() => validate(value), BadRequestException, JSON.stringify(value));
    }
  });
  await check("pagination defaults and valid filters", async () => {
    const defaults = await validate({});
    assert.equal(defaults.page, 1); assert.equal(defaults.pageSize, 20);
    const query = await validate({ page: "2", pageSize: "100", year: "2026", month: "10", status: "APPROVED" });
    assert.deepEqual([query.page, query.pageSize, query.year, query.month, query.status], [2, 100, 2026, 10, "APPROVED"]);
  });
  if (process.argv.includes("--validation-only")) return;

  const { NestFactory } = requireRoot("@nestjs/core");
  const { JwtModule, JwtService } = requireRoot("@nestjs/jwt");
  const cookieParser = requireRoot("cookie-parser");
  const { PayrollPaymentConfirmationService } = requireRoot(join(output, 'payroll/payroll-payment-confirmation.service.js'));
  const { PayrollController } = requireRoot(join(output, "payroll/payroll.controller.js"));
  const { PayrollService } = requireRoot(join(output, "payroll/payroll.service.js"));
  const { PayrollParentResolver } = requireRoot(join(output, "payroll/payroll-parent.resolver.js"));
  const { PayrollDraftService } = requireRoot(join(output, "payroll/payroll-draft.service.js"));
  const { PayrollPreviewService } = requireRoot(join(output, "payroll/payroll-preview.service.js"));
  const { PayrollApprovalService } = requireRoot(join(output, "payroll/payroll-approval.service.js"));
  const { PayrollDocumentsService } = requireRoot(join(output, "payroll/payroll-documents.service.js"));
  const { PayrollPaymentPreparationService } = requireRoot(join(output, "payroll/payroll-payment-preparation.service.js"));
  const { PayrollPaymentBatchService } = requireRoot(join(output, "payroll/payroll-payment-batch.service.js"));
  const { PrismaService } = requireRoot(join(output, "prisma/prisma.service.js"));
  const { AuthGuard } = requireRoot(join(output, "auth/guards/auth.guard.js"));
  const { RolesGuard } = requireRoot(join(output, "auth/guards/roles.guard.js"));
  const { Prisma } = requireRoot(join(output, "generated/prisma/client.js"));
  const { AUTH_COOKIE_DEFAULT_NAME } = requireRoot(join(output, "auth/auth.constants.js"));
  // Reuse real existing controllers/guards; replace only their database-facing
  // services so authorization regressions can be tested without a database.
  const { AccountClassController } = requireRoot(join(output, "accounting/account-class.controller.js"));
  const { AccountClassService } = requireRoot(join(output, "accounting/account-class.service.js"));
  const { SalaryController } = requireRoot(join(output, "salary/salary.controller.js"));
  const { SalaryService } = requireRoot(join(output, "salary/salary.service.js"));
  const { EmployeeController } = requireRoot(join(output, "employee/employee.controller.js"));
  const { EmployeeService } = requireRoot(join(output, "employee/employee.service.js"));
  const { AttendanceController } = requireRoot(join(output, "attendance/attendance.controller.js"));
  const { AttendanceDayService } = requireRoot(join(output, "attendance/attendance-day.service.js"));
  const { AttendanceFinalizationService } = requireRoot(join(output, "attendance/attendance-finalization.service.js"));
  const { AttendanceCorrectionService } = requireRoot(join(output, "attendance/attendance-correction.service.js"));
  const secret = "synthetic-offline-payroll-verification-secret";
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  const state = { parent: "active", office: "office-a" as string | null, roles: true, expired: false, revoked: false, disabledUser: false };
  let mutations = 0;
  const calls: Array<{ method: string; args: any }> = [];
  const forbidden = () => { mutations++; throw new Error("Database mutation attempted in read-only payroll"); };
  const writes = { create: forbidden, update: forbidden, delete: forbidden, createMany: forbidden,
    updateMany: forbidden, deleteMany: forbidden, upsert: forbidden };
  const timestamp = new Date("2026-10-01T00:00:00Z");
  const amounts = Object.fromEntries(["grossSalary", "totalEarnings", "attendanceDeduction", "providentFundDeduction",
    "loanOrSalaryAdvanceDeduction", "aitDeduction", "otherDeductionsTotal", "totalDeductions", "netPay", "bankPay", "cashPay"]
    .map(field => [field, new Prisma.Decimal(field === "grossSalary" || field === "totalEarnings" ? "100.01" :
      field === "netPay" || field === "cashPay" ? "99.01" : field === "attendanceDeduction" || field === "totalDeductions" ? "1.00" : "0.00")]));
  const line = { id: "line-1", employeeId: "employee-1", employeeSnapshot: {
    employeeCode: "SYNTHETIC-1", fullName: "Historical Employee", designation: "Synthetic Accountant",
    departmentName: "Synthetic Department", nationalId: "PRIVATE_SENTINEL", accountNumber: "PRIVATE_SENTINEL" },
    paymentProfileSnapshot: { accountNumber: "PRIVATE_SENTINEL" }, salarySnapshot: { private: "PRIVATE_SENTINEL" },
    calculationSnapshot: { private: "PRIVATE_SENTINEL" }, employee: { fullName: "Changed Live Name", nationalId: "PRIVATE_SENTINEL" },
    ...amounts };
  const run = (id: string, companyId: string, year: number, month: number, status: string) => ({
    id, companyId, payrollYear: year, payrollMonth: month, status, version: 1,
    approvedAt: status === "APPROVED" ? timestamp : null, createdAt: timestamp, updatedAt: timestamp,
    createdById: "PRIVATE_SENTINEL", companySnapshot: { accountNumber: "PRIVATE_SENTINEL" },
    _count: { lines: 1 }, lines: [line],
  });
  const runs = [run("run-new", "parent-id", 2026, 10, "APPROVED"), run("run-mid", "parent-id", 2026, 9, "DRAFT"),
    run("run-old", "parent-id", 2025, 10, "DRAFT"), run("run-foreign", "office-a", 2024, 1, "DRAFT")];
  const matches = (r: any, where: any) => Object.entries(where).every(([key, value]) => value === undefined || r[key] === value);
  const prisma = {
    $queryRaw:async()=>[{installed:null}],
    company: { ...writes,
      findUnique: async (args: any) => { calls.push({ method: "company.findUnique", args });
        if (args.where.singletonKey !== "PRIMARY" || state.parent === "missing") return null;
        // Deliberately renamed: names cannot act as ownership authorization.
        return { id: "parent-id", name: "Renamed Parent", isActive: state.parent !== "inactive" };
      },
      findFirst: async () => { throw new Error("Read payroll must not resolve the oldest active office"); },
    },
    authSession: { ...writes, findUnique: async () => ({ id: "session-id", tokenId: "token-id", userId: "user-id",
      expiresAt: new Date(state.expired ? 0 : Date.now() + 60000), revokedAt: state.revoked ? timestamp : null,
      activeCompanyId: state.office, activeCompany: state.office === null ? null : { id: state.office, name: "Unrelated office", legalName: null,
        isActive: false, officeLogoPath: null, brandAccentColor: null, backgroundMode: "DEFAULT_PREMIUM", customBackgroundPath: null },
      user: { id: "user-id", email: "synthetic@example.invalid", fullName: "Synthetic Accountant", isActive: !state.disabledUser,
        roles: state.roles ? [{ role: { code: "ACCOUNTANT", name: "Accountant" } }] : [] } }) },
    payrollRun: { ...writes,
      findMany: async (args: any) => { calls.push({ method: "payrollRun.findMany", args });
        const rows = runs.filter(r => matches(r, args.where)).sort((a, b) => b.payrollYear - a.payrollYear || b.payrollMonth - a.payrollMonth || a.id.localeCompare(b.id));
        return rows.slice(args.skip, args.skip + args.take); },
      count: async (args: any) => { calls.push({ method: "payrollRun.count", args }); return runs.filter(r => matches(r, args.where)).length; },
      findFirst: async (args: any) => { calls.push({ method: "payrollRun.findFirst", args }); return runs.find(r => matches(r, args.where)) ?? null; },
    },
    $executeRaw: forbidden, $executeRawUnsafe: forbidden,
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work(prisma),
  };
  const resolver = new PayrollParentResolver(prisma);
  await check("reusable resolver finds unique PRIMARY without using name or office", async () => {
    assert.equal((await resolver.resolve()).id, "parent-id");
    assert.deepEqual(calls.at(-1)?.args.where, { singletonKey: "PRIMARY" });
  });
  let app: any;
  try {
    class VerificationModule {}
    let existingServiceReads = 0;
    let documentReads = 0;
    const documentRead = async () => { documentReads++; return { approvalStatus: "APPROVED" }; };
    const existingRead = async () => { existingServiceReads++; return []; };
    Module({ imports: [JwtModule.register({ secret })], controllers: [PayrollController, AccountClassController, SalaryController, EmployeeController, AttendanceController], providers: [
      { provide: PayrollPaymentConfirmationService, useValue: {confirm: async()=>{throw new Error('Production confirmation disabled');}} }, { provide: PrismaService, useValue: prisma }, PayrollService, PayrollParentResolver, AuthGuard, RolesGuard,
      { provide: PayrollDocumentsService, useValue: { payslip: documentRead, salarySheet: documentRead } },
      { provide: PayrollPaymentPreparationService, useValue: { prepare: documentRead } },
      { provide: PayrollPaymentBatchService, useValue: { prepare: async (_input: any, user: any) => { assert.equal(user.id, "user-id"); return { status: "PREPARED" }; } } },
      { provide: PayrollDraftService, useValue: { create: async () => { throw new Error("Invalid creation must not reach service"); } } },
      { provide: PayrollPreviewService, useValue: { preview: async () => ({ status: "BLOCKED", readyForDraft: false }) } },
      { provide: PayrollApprovalService, useValue: { approve: async (id: string, input: any, user: any) => {
        assert.equal(user.id, "user-id"); assert.equal(input.expectedVersion, 1); assert.deepEqual(Object.keys(input), ["expectedVersion"]); return { id, status: "APPROVED", version: 2 }; } } },
      { provide: AccountClassService, useValue: { findAll: existingRead } },
      { provide: SalaryService, useValue: { listStructures: existingRead } },
      { provide: EmployeeService, useValue: { findAll: existingRead } },
      { provide: AttendanceDayService, useValue: { getDay: existingRead } },
      { provide: AttendanceFinalizationService, useValue: {} },
      { provide: AttendanceCorrectionService, useValue: {} },
    ] })(VerificationModule);
    app = await NestFactory.create(VerificationModule, { logger: false });
    app.use(cookieParser()); app.useGlobalPipes(pipe);
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const jwt = app.get(JwtService);
    const token = jwt.sign({ sub: "user-id", sid: "session-id", jti: "token-id" });
    const cookieName = process.env.COOKIE_NAME ?? AUTH_COOKIE_DEFAULT_NAME;
    const request = async (path: string, authenticated = true, method = "GET", body?: unknown) => {
      const response = await fetch(`${base}${path}`, { method, headers: { ...(authenticated ? { cookie: `${cookieName}=${token}` } : {}),
        ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() as any, headers: response.headers };
    };
    await check("payment batch POST requires write-capable ACCOUNTANT and strict server-derived maker", async () => {
      const path = "/payroll-runs/payment-batches", body = { payrollRunId: "run", sourceAccountId: "source", channel: "BANK", idempotencyKey: "test-key-1", employeeIds: ["employee"] };
      assert.equal((await request(path, false, "POST", body)).status, 401);
      state.roles = false; try { assert.equal((await request(path, true, "POST", body)).status, 403); } finally { state.roles = true; }
      for (const field of ["createdById", "confirmedById", "grantorId", "amount"]) assert.equal((await request(path, true, "POST", { ...body, [field]: "injected" })).status, 400);
      assert.equal((await request(path, true, "POST", { ...body, employeeIds: ["employee", "employee"] })).status, 400);
      assert.equal((await request(path, true, "POST", body)).status, 201);
    });
    await check("document endpoints retain session/ACCOUNTANT guards, read-only office independence and parameter validation", async () => {
      const paths = ["/payroll-runs/run-new/payslips/employee-1", "/payroll-runs/run-new/salary-sheet", "/payroll-runs/run-new/payment-preparation?channel=BANK"];
      for (const path of paths) assert.equal((await request(path, false)).status, 401);
      state.roles = false;
      try { for (const path of paths) assert.equal((await request(path)).status, 403); } finally { state.roles = true; }
      for (const key of ["expired", "revoked", "disabledUser"] as const) {
        state[key] = true;
        try { for (const path of paths) assert.equal((await request(path)).status, 401); } finally { state[key] = false; }
      }
      assert.equal(documentReads, 0);
      for (const office of ["office-a", "office-b", null]) {
        state.office = office;
        for (const path of paths) { const r = await request(path); assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "no-store"); }
      }
      const before = documentReads;
      assert.equal((await request("/payroll-runs/bad%20id/salary-sheet")).status, 400);
      assert.equal((await request("/payroll-runs/run-new/payslips/bad%20id")).status, 400);
      for (const query of ["", "?channel=MFS", "?channel=BANK&sourceAccountId=", "?channel=CASH&paid=true", "?channel=BANK&channel=CASH"]) assert.equal((await request(`/payroll-runs/run-new/payment-preparation${query}`)).status, 400);
      assert.equal(documentReads, before); assert.equal(mutations, 0); state.office = "office-a";
    });
    await check("unauthenticated list/detail rejected before payroll access", async () => {
      const before = calls.length;
      assert.equal((await request("/payroll-runs", false)).status, 401);
      assert.equal((await request("/payroll-runs/run-new", false)).status, 401);
      assert.equal((await request("/payroll-runs", false, "POST")).status, 401);
      assert.equal(calls.length, before);
    });
    await check("missing ACCOUNTANT role forbidden", async () => {
      state.roles = false;
      try { const before = calls.length; assert.equal((await request("/payroll-runs")).status, 403);
        assert.equal((await request("/payroll-runs/run-new")).status, 403); assert.equal(calls.length, before); }
      finally { state.roles = true; }
    });
    await check("expired, revoked and inactive-user sessions rejected", async () => {
      for (const key of ["expired", "revoked", "disabledUser"] as const) {
        state[key] = true;
        try { assert.equal((await request("/payroll-runs")).status, 401); } finally { state[key] = false; }
      }
    });
    await check("existing Accounting, Salary and HR routes retain authentication/role checks", async () => {
      const paths = ["/account-classes", "/salary-structures", "/employees", "/attendance/day?businessDate=2026-10-01"];
      const before = existingServiceReads;
      for (const path of paths) assert.equal((await request(path, false)).status, 401);
      state.roles = false;
      try { for (const path of paths) assert.equal((await request(path)).status, 403); }
      finally { state.roles = true; }
      for (const key of ["expired", "revoked", "disabledUser"] as const) {
        state[key] = true;
        try { for (const path of paths) assert.equal((await request(path)).status, 401); }
        finally { state[key] = false; }
      }
      assert.equal(existingServiceReads, before);
      for (const path of paths.slice(0, 3)) assert.equal((await request(path)).status, 200);
      // Attendance retains its independent active-office check; payroll's
      // context option cannot bypass the existing attendance office boundary.
      assert.equal((await request(paths[3])).status, 409);
      assert.equal(existingServiceReads, before + 3);
    });
    await check("missing/inactive PRIMARY fails closed for list and detail", async () => {
      for (const value of ["missing", "inactive"]) {
        state.parent = value; const before = calls.filter(c => c.method.startsWith("payrollRun.")).length;
        assert.equal((await request("/payroll-runs")).status, 503);
        assert.equal((await request("/payroll-runs/run-new")).status, 503);
        assert.equal(calls.filter(c => c.method.startsWith("payrollRun.")).length, before);
      }
      state.parent = "active";
    });
    await check("active office does not change payroll ownership", async () => {
      for (const office of ["office-a", "office-b", null]) {
        state.office = office;
        const response = await request("/payroll-runs");
        assert.equal(response.status, 200); assert.equal(response.body.total, 3);
        assert.deepEqual(response.body.items.map((r: any) => r.id), ["run-new", "run-mid", "run-old"]);
        assert.equal(response.headers.get("cache-control"), "no-store");
        const detail = await request("/payroll-runs/run-new");
        assert.equal(detail.status, 200); assert.equal(detail.body.companyId, "parent-id");
      }
    });
    await check("shared authentication retains legacy office initialization outside payroll", async () => {
      let initialized = 0;
      const legacyDatabase = {
        authSession: {
          findUnique: prisma.authSession.findUnique,
          update: async (args: any) => { assert.deepEqual(args, { data: { activeCompanyId: "legacy-office" }, where: { id: "session-id" } }); initialized++; },
        },
        company: { findFirst: async () => ({ id: "legacy-office", name: "Legacy Office", isActive: true }) },
      };
      const legacy = new AuthGuard(jwt, legacyDatabase);
      const req = { cookies: { [cookieName]: token } };
      const handler = () => undefined;
      class LegacyController {}
      assert.equal(await legacy.canActivate({ switchToHttp: () => ({ getRequest: () => req }), getHandler: () => handler, getClass: () => LegacyController }), true);
      assert.equal(initialized, 1);
      state.office = "office-a";
    });
    await check("cross-company and missing run detail return 404", async () => {
      assert.equal((await request("/payroll-runs/run-foreign")).status, 404);
      assert.equal((await request("/payroll-runs/does-not-exist")).status, 404);
    });
    await check("bounded pagination, stable order, totals and filters", async () => {
      const page = await request("/payroll-runs?page=2&pageSize=1");
      assert.equal(page.status, 200); assert.equal(page.body.page, 2); assert.equal(page.body.pageSize, 1);
      assert.equal(page.body.total, 3); assert.deepEqual(page.body.items.map((r: any) => r.id), ["run-mid"]);
      const filtered = await request("/payroll-runs?year=2026&month=10&status=APPROVED");
      assert.equal(filtered.status, 200); assert.equal(filtered.body.total, 1); assert.equal(filtered.body.items[0].id, "run-new");
      const empty = await request("/payroll-runs?year=2023"); assert.equal(empty.status, 200); assert.deepEqual(empty.body.items, []);
    });
    await check("HTTP validation rejects bad and ownership-injection queries", async () => {
      for (const query of ["page=0", "pageSize=101", "month=13", "status=PAID", "companyId=office-a", "page=1&page=2", "page=1e2", "year=Infinity"]) {
        const before = calls.length; assert.equal((await request(`/payroll-runs?${query}`)).status, 400); assert.equal(calls.length, before);
      }
    });
    await check("detail uses historical identity, decimal strings and response allowlist", async () => {
      const response = await request("/payroll-runs/run-new"); assert.equal(response.status, 200);
      assert.equal(response.body.isCreator,false);
      assert.equal(response.body.createdById,undefined);
      const own=await app.get(PayrollService).get("run-mid","PRIVATE_SENTINEL");assert.equal(own.isCreator,true);assert.equal(own.createdById,undefined);
      assert.equal(response.body.lines[0].employee.fullName, "Historical Employee");
      assert.equal(response.body.lines[0].grossSalary, "100.01"); assert.equal(response.body.lines[0].netPay, "99.01");
      assert(!JSON.stringify(response.body).includes("PRIVATE_SENTINEL"));
      assert(!JSON.stringify(response.body).includes("Changed Live Name"));
      assert.deepEqual(Object.keys(response.body.lines[0]).sort(), ["id", "employeeId", "employee", ...Object.keys(amounts)].sort());
      const list = await request("/payroll-runs"); assert(!JSON.stringify(list.body).includes("PRIVATE_SENTINEL"));
      for (const call of calls.filter(c => c.method.startsWith("payrollRun."))) {
        assert.equal(call.args.where.companyId, "parent-id");
        if (call.args.select) {
          assert.equal(call.args.select.companySnapshot, undefined);
          if (call.args.select.lines) {
            const select = call.args.select.lines.select;
            for (const field of ["paymentProfileSnapshot", "salarySnapshot", "calculationSnapshot", "employee"]) assert.equal(select[field], undefined);
          }
        }
      }
    });
    await check("malformed identity snapshot does not leak or break response", async () => {
      const original = line.employeeSnapshot;
      try { line.employeeSnapshot = { fullName: { private: "PRIVATE_SENTINEL" } } as any;
        const response = await request("/payroll-runs/run-new"); assert.equal(response.status, 200);
        assert.equal(response.body.isCreator,false);
      assert.equal(response.body.createdById,undefined);
      const own=await app.get(PayrollService).get("run-mid","PRIVATE_SENTINEL");assert.equal(own.isCreator,true);assert.equal(own.createdById,undefined);
      assert.equal(response.body.lines[0].employee.fullName, null); assert(!JSON.stringify(response.body).includes("PRIVATE_SENTINEL"));
      } finally { line.employeeSnapshot = original; }
    });
    await check("read routes stay read-only; POST requires validated creation input", async () => {
      for (const method of ["POST", "PATCH", "DELETE"]) assert.equal((await request("/payroll-runs/run-new", true, method)).status, 404);
      assert.equal((await request("/payroll-runs", true, "POST")).status, 400);
      state.roles = false;
      try { assert.equal((await request("/payroll-runs", true, "POST")).status, 403); }
      finally { state.roles = true; }
      const { READ_ONLY_AUTH_CONTEXT_METADATA_KEY } = requireRoot(join(output, "auth/auth.constants.js"));
      assert.equal(Reflect.getMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, PayrollController.prototype.create), false);
      assert.equal(mutations, 0);
    });
    await check("preview requires authenticated ACCOUNTANT and write-capable context", async () => {
      const path = "/payroll-runs/preview", input = { year: 2026, month: 10, deductions: [] };
      assert.equal((await request(path, false, "POST", input)).status, 401);
      state.roles = false;
      try { assert.equal((await request(path, true, "POST", input)).status, 403); } finally { state.roles = true; }
      for (const key of ["expired", "revoked", "disabledUser"] as const) {
        state[key] = true;
        try { assert.equal((await request(path, true, "POST", input)).status, 401); } finally { state[key] = false; }
      }
      for (const invalid of [{ ...input, month: 13 }, { ...input, year: 0 }, { ...input, companyId: "office-a" },
        { ...input, deductions: [{ employeeId: "employee" }] }]) assert.equal((await request(path, true, "POST", invalid)).status, 400);
      const response = await request(path, true, "POST", input);
      assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
      const { READ_ONLY_AUTH_CONTEXT_METADATA_KEY } = requireRoot(join(output, "auth/auth.constants.js"));
      assert.equal(Reflect.getMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, PayrollController.prototype.preview), false);
      assert.equal(mutations, 0);
    });
    await check("approval route requires authenticated ACCOUNTANT, strict version input and write context", async () => {
      const path = "/payroll-runs/run-mid/approve", input = { expectedVersion: 1 };
      assert.equal((await request(path, false, "POST", input)).status, 401);
      state.roles = false; try { assert.equal((await request(path, true, "POST", input)).status, 403); } finally { state.roles = true; }
      for (const key of ["expired", "revoked", "disabledUser"] as const) {
        state[key] = true; try { assert.equal((await request(path, true, "POST", input)).status, 401); } finally { state[key] = false; }
      }
      for (const invalid of [{ expectedVersion: 0 }, { expectedVersion: "1" }, { ...input, approvedById: "client-user" }, { ...input, netPay: "1" }, { ...input, allowSelfApproval: true }]) assert.equal((await request(path, true, "POST", invalid)).status, 400);
      const response = await request(path, true, "POST", input); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
      const { READ_ONLY_AUTH_CONTEXT_METADATA_KEY } = requireRoot(join(output, "auth/auth.constants.js"));
      assert.equal(Reflect.getMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, PayrollController.prototype.approve), false);
      assert.equal(mutations, 0);
    });
  } finally {
    if (app) await app.close();
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
  console.log(`${passed} payroll read checks passed; no database connections or writes`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  // This is a newly created disposable checkout-local directory only.
  assert(output.startsWith(join(root, "apps/api/.payroll-read-verify-")));
  rmSync(output, { recursive: true, force: true });
});
