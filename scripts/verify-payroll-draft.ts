// Persistence contract tests use an in-memory atomic transaction double only.
// Synthetic completeness verification is test-only, never production authority.
import "reflect-metadata";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Prisma } from "../apps/api/src/generated/prisma/client";
import { PayrollDraftService } from "../apps/api/src/payroll/payroll-draft.service";
import { PayrollReadinessService } from "../apps/api/src/payroll/payroll-readiness.service";
import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import { fixture } from "./verify-payroll-calculation";
import { setup } from "./verify-payroll-readiness";
const { ConflictException, ForbiddenException, InternalServerErrorException, UnprocessableEntityException, BadRequestException } =
  createRequire(resolve(__dirname, "../apps/api/package.json"))("@nestjs/common");
const zero = () => ({ amount: "0.00", zeroConfirmed: true });
const input = () => ({ year: 2026, month: 10, deductions: [{ year: 2026, month: 10, employeeId: "employee",
  attendanceDeduction: zero(), providentFundDeduction: zero(), loanOrSalaryAdvanceDeduction: zero(), aitDeduction: zero(),
  otherApprovedDeductions: [], otherDeductionsZeroConfirmed: true }] });
const user = { id: "authenticated-creator", email: "synthetic@example.invalid", fullName: "Synthetic Accountant", roles: [{ code: "ACCOUNTANT" as const, name: "Accountant" }] };
function setupWriter() {
  const f = fixture(); let version = 0, transactions = 0, assessments = 0;
  let ledger = { runs: [] as any[], lines: [] as any[], audits: [] as any[] };
  const failures: any = { createCode: null, line: false, audit: false, completeness: false, partial: false, financial: false };
  let currentTx: any;
  const prisma: any = { $transaction: async (work: any, options: any) => {
    assert.equal(options.isolationLevel, "Serializable"); transactions++;
    const before = version, staged = structuredClone(ledger);
    const tx = { payrollRun: { create: async ({ data }: any) => {
      if (failures.createCode) throw { code: failures.createCode };
      if (staged.runs.some(r => r.payrollYear === data.payrollYear && r.payrollMonth === data.payrollMonth)) throw { code: "P2002" };
      const run = { id: "synthetic-run", ...data, createdAt: new Date("2026-11-01T00:00:00Z") };
      staged.runs.push(JSON.parse(JSON.stringify(run)));
      for (const line of data.lines.create) { staged.lines.push(JSON.parse(JSON.stringify(line))); if (failures.line) throw new Error("Synthetic nested line failure"); }
      return { ...run, _count: { lines: data.lines.create.length } };
    } }, auditEvent: { create: async ({ data }: any) => {
      staged.audits.push(data); if (failures.audit) throw new Error("Synthetic audit failure"); return data;
    } } };
    currentTx = tx;
    const result = await work(tx);
    if (version !== before) throw { code: "P2034" };
    ledger = staged; version++; return result;
  } };
  const readiness = { assess: () => { throw new Error("Nested/nontransactional assessment forbidden"); },
    assessWithTx: async (_raw: any, tx: any) => {
      assert.equal(tx, currentTx); assessments++;
      await Promise.resolve();
      // Each invocation rereads the mutable synthetic source, simulating trusted
      // transaction-side source resolution. No client candidate is used.
      const source = (await f.service.calculate({ year: 2026, month: 10 })).sources[0];
      const result = f.service.calculateLine(source, { attendanceDeduction: "0.00", providentFundDeduction: "0.00",
        loanOrSalaryAdvanceDeduction: "0.00", aitDeduction: "0.00", otherApprovedDeductions: [] });
      if (failures.financial) result.line.netPay = "1.00";
      return { status: "READY", readyForDraft: true, exceptions: [], parent: { id: "parent", name: "Synthetic Parent", currency: "BDT", singletonKey: "PRIMARY" },
        period: { year: 2026, month: 10 }, employees: [{ employeeId: "employee", attendance: { coverage: failures.completeness ? "NOT_INFERRED" : "VERIFIED" } }],
        candidateLines: failures.partial ? [] : [{ ...result.line, calculationSnapshot: { ...result.line.calculationSnapshot,
          monthlyPolicyVerified: true, attendanceCoverage: "VERIFIED" } }] };
    } };
  const service = new PayrollDraftService(prisma as PrismaService, readiness as unknown as PayrollReadinessService);
  return { service, f, failures, ledger: () => ledger, counters: () => ({ transactions, assessments }) };
}
let passed = 0;
async function check(name: string, work: () => Promise<void>) { await work(); passed++; console.log(`PASS ${name}`); }
async function main() {
  await check("creator authorization checked before transaction", async () => {
    const s = setupWriter(); await assert.rejects(() => s.service.create(input(), { ...user, roles: [] }), ForbiddenException);
    assert.equal(s.counters().transactions, 0); assert.deepEqual(s.ledger(), { runs: [], lines: [], audits: [] });
  });
  await check("synthetic trusted READY creates atomic DRAFT, exact lines and audit", async () => {
    const s = setupWriter(); const result = await s.service.create(input(), user);
    assert.equal(result.status, "DRAFT"); assert.equal(result.companyId, "parent"); assert.equal(result.lineCount, 1);
    assert.equal(s.ledger().runs[0].createdById, user.id); assert.equal(s.ledger().lines[0].grossSalary, "100.01");
    assert.equal(s.ledger().lines[0].bankPay, "60.01"); assert.equal(new Prisma.Decimal(s.ledger().lines[0].cashPay).toFixed(2), "40.00");
    assert.equal(s.ledger().audits[0].userId, user.id); assert.equal(s.ledger().audits[0].entityId, result.id);
    assert(!JSON.stringify(result).includes("SYNTHETIC-ONLY")); assert.deepEqual(s.counters(), { transactions: 1, assessments: 1 });
  });
  await check("server source changes are recalculated; client candidate ignored", async () => {
    const s = setupWriter(); s.f.assignment.grossSalary = new Prisma.Decimal("200.00");
    await s.service.create({ ...input(), candidateLines: [{ grossSalary: "1.00" }] } as any, user);
    assert.equal(new Prisma.Decimal(s.ledger().lines[0].grossSalary).toFixed(2), "200.00");
  });
  await check("line/audit failures roll back all provisional records", async () => {
    for (const failure of ["line", "audit"] as const) {
      const s = setupWriter(); s.failures[failure] = true;
      await assert.rejects(() => s.service.create(input(), user), InternalServerErrorException);
      assert.deepEqual(s.ledger(), { runs: [], lines: [], audits: [] });
    }
  });
  await check("duplicates and serialization/foreign-key conflicts controlled", async () => {
    for (const code of ["P2002", "P2034", "P2003"]) {
      const s = setupWriter(); s.failures.createCode = code; await assert.rejects(() => s.service.create(input(), user), ConflictException);
      assert.deepEqual(s.ledger(), { runs: [], lines: [], audits: [] });
    }
    const s = setupWriter(); await s.service.create(input(), user); const before = structuredClone(s.ledger());
    await assert.rejects(() => s.service.create(input(), user), ConflictException); assert.deepEqual(s.ledger(), before);
  });
  await check("concurrent synthetic creation has one winner, one controlled conflict", async () => {
    const s = setupWriter(); const results = await Promise.allSettled([s.service.create(input(), user), s.service.create(input(), user)]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const failure = results.find(r => r.status === "rejected") as PromiseRejectedResult;
    assert(failure.reason instanceof ConflictException);
    assert.equal(s.ledger().runs.length, 1); assert.equal(s.ledger().lines.length, 1); assert.equal(s.ledger().audits.length, 1);
  });
  await check("partial collections, unverified completeness and invalid money never persisted", async () => {
    for (const failure of ["partial", "completeness", "financial"] as const) {
      const s = setupWriter(); s.failures[failure] = true;
      await assert.rejects(() => s.service.create(input(), user), failure === "financial" ? BadRequestException : UnprocessableEntityException);
      assert.deepEqual(s.ledger(), { runs: [], lines: [], audits: [] });
    }
  });
  await check("real readiness cannot authorize creation with unresolved completeness", async () => {
    const f = setup(); const writer = new PayrollDraftService(f.prisma, f.readiness);
    try { await writer.create(input(), user); assert.fail("Unresolved completeness accepted"); }
    catch (error: any) {
      assert(error instanceof UnprocessableEntityException);
      assert(error.getResponse().exceptions.some((e: any) => e.code === "ATTENDANCE_DATE_MISSING"));
    }
    assert.equal(f.counters().writes, 0);
    await assert.rejects(() => writer.create({ ...input(), companyId: "office" } as any, user), BadRequestException);
    const positive: any = input(); positive.deductions[0].aitDeduction = { amount: "1.00", zeroConfirmed: false,
      approvalClaim: { evidenceType: "SYSTEM_RECORD", reference: "CLAIM-ONLY", approvedByClaim: "Owner", approvedAtClaim: "2026-10-13T00:00:00Z" } };
    try { await writer.create(positive, user); assert.fail("Claimed approval accepted"); }
    catch (error: any) { assert(error instanceof UnprocessableEntityException);
      assert(error.getResponse().exceptions.some((e: any) => e.code === "EVIDENCE_AUTHORITY_UNAVAILABLE")); }
    assert.equal(f.counters().writes, 0);
  });
  console.log(`${passed} draft contract checks passed; synthetic authority only; NO database-backed acceptance or writes`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
