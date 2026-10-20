// Deterministic service tests only: no real client, database connection, or fixtures.
import "reflect-metadata";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Prisma } from "../apps/api/src/generated/prisma/client";
import { SalaryCalculator } from "../apps/api/src/salary/salary-calculator";
import { MonthlyPayrollCalculationService } from "../apps/api/src/payroll/monthly-payroll-calculation.service";
import { PayrollParentResolver } from "../apps/api/src/payroll/payroll-parent.resolver";
import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import { assertPayrollFinancialIntegrity } from "../apps/api/src/payroll/payroll-financial-integrity";

const { BadRequestException, ConflictException, ServiceUnavailableException } =
  createRequire(resolve(__dirname, "../apps/api/package.json"))("@nestjs/common");

const D = Prisma.Decimal;
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const explicit = () => ({ attendanceDeduction: "1.01", providentFundDeduction: "2.02", loanOrSalaryAdvanceDeduction: "3.03",
  aitDeduction: "4.04", otherApprovedDeductions: [{ amount: "0.05", description: "Synthetic supplied amount", approvalReference: "SYNTHETIC" }] });
export function fixture() {
  const approved = { status: "APPROVED", effectiveFrom: date("2026-01-01"), effectiveTo: null, approvedAt: date("2026-01-01"), updatedAt: date("2026-01-01") };
  const employee = { id: "employee", employeeCode: "SYNTHETIC", fullName: "Synthetic Employee", designation: "Synthetic Role",
    joiningDate: date("2026-01-01"), separationDate: null, isActive: true, isDeleted: false, updatedAt: date("2026-01-01"),
    department: { id: "department", code: "SYNTHETIC", name: "Synthetic Department" } };
  const structure = { ...approved, id: "structure", version: 1, code: "CUSTOM", name: "Custom Structure",
    components: [{ code: "CUSTOM_A", name: "Custom A", percentage: new D("37.5000"), displayOrder: 1 },
      { code: "CUSTOM_B", name: "Custom B", percentage: new D("62.5000"), displayOrder: 2 }] };
  const assignment = { ...approved, id: "assignment", employeeId: "employee", salaryStructureId: "structure",
    grossSalary: new D("100.01"), salaryStructure: structure };
  const profile = { ...approved, id: "profile", employeeId: "employee", selectedBankPercentage: new D("60.000000"),
    bankName: "Synthetic Bank", accountName: "Synthetic Employee", accountNumber: "SYNTHETIC-ONLY", branchName: null };
  const store: any = { employees: [employee], assignments: [assignment], profiles: [profile], parentActive: true, parentMissing: false };
  let writes = 0, calculations = 0;
  const calls: Array<{ method: string; args: any }> = [];
  const mutation = () => { writes++; throw new Error("Forbidden database write"); };
  const rangeMatches = (row: any, where: any) => row.status === where.status && row.effectiveFrom < where.effectiveFrom.lt &&
    (row.effectiveTo === null || row.effectiveTo > where.OR[1].effectiveTo.gt) && where.employeeId.in.includes(row.employeeId);
  const prisma: any = {
    company: { findUnique: async (args: any) => {
      calls.push({ method: "company", args });
      if (store.parentMissing) return null;
      return { id: "parent", isActive: store.parentActive, name: "Renamed PRIMARY Parent", legalName: null, currency: "BDT" };
    }, create: mutation, update: mutation },
    employee: { findMany: async (args: any) => {
      calls.push({ method: "employee", args });
      return store.employees.filter((e: any) => (args.where.isDeleted === undefined || e.isDeleted === args.where.isDeleted) && e.joiningDate < args.where.joiningDate.lt &&
        (e.separationDate === null || e.separationDate >= args.where.OR[1].separationDate.gte));
    }, update: mutation },
    employeeSalaryAssignment: { findMany: async (args: any) => store.assignments.filter((a: any) => rangeMatches(a, args.where)), update: mutation },
    employeePaymentProfile: { findMany: async (args: any) => store.profiles.filter((p: any) => rangeMatches(p, args.where)), update: mutation },
    attendanceRecord: { findMany: () => { throw new Error("Attendance is not a monetary deduction policy"); } },
    attendanceDayFinalization: { findMany: () => { throw new Error("Finalization is not deduction approval"); } },
    payrollRun: { create: mutation }, payrollRunLine: { create: mutation },
    $transaction: async (work: any) => work(prisma), $executeRaw: mutation,
  };
  const calculator = new SalaryCalculator();
  const actualCalculate = calculator.calculate.bind(calculator);
  calculator.calculate = input => { calculations++; return actualCalculate(input); };
  const service = new MonthlyPayrollCalculationService(prisma as PrismaService, new PayrollParentResolver(prisma), calculator);
  return { service, prisma, store, employee, assignment, profile, structure, calls,
    counters: () => ({ writes, calculations }) };
}

let passed = 0;
async function check(name: string, work: () => Promise<void> | void) { await work(); passed++; console.log(`PASS ${name}`); }
async function source(f: ReturnType<typeof fixture>) { return (await f.service.calculate({ year: 2026, month: 10 })).sources[0]; }

async function main() {
  await check("year/month validated before any reads", async () => {
    const f = fixture();
    for (const input of [{ year: 0, month: 10 }, { year: 10000, month: 10 }, { year: 2026, month: 13 }, { year: 2026, month: 1.5 }, { year: NaN, month: 10 }]) {
      await assert.rejects(() => f.service.calculate(input), BadRequestException);
    }
    assert.equal(f.calls.length, 0);
  });
  await check("PRIMARY required; no office/name ownership or writes", async () => {
    const f = fixture(); const result = await f.service.calculate({ year: 2026, month: 10 });
    assert.equal(result.companyId, "parent"); assert.equal(result.sources.length, 1);
    assert.deepEqual(f.calls[0].args.where, { singletonKey: "PRIMARY" });
    assert.equal(f.calls.find(c => c.method === "employee")?.args.where.companyId, undefined);
    assert.equal(f.counters().writes, 0);
    f.store.parentMissing = true; await assert.rejects(() => source(f), ServiceUnavailableException);
    f.store.parentMissing = false; f.store.parentActive = false; await assert.rejects(() => source(f), ServiceUnavailableException);
  });
  await check("one global employee across office attendance duplicates", async () => {
    const f = fixture(); f.store.employees.push(f.employee);
    const result = await f.service.calculate({ year: 2026, month: 10 });
    assert.equal(result.sources.length, 1); assert.equal(result.sources[0].employee.id, "employee");
  });
  await check("half-open effective boundaries select successor and ignore ended predecessor", async () => {
    const f = fixture();
    f.store.assignments.unshift({ ...f.assignment, id: "old", effectiveTo: date("2026-10-01"), grossSalary: new D("55.00") });
    f.assignment.effectiveFrom = date("2026-10-01"); f.assignment.effectiveTo = date("2026-11-01") as any;
    assert.equal((await source(f)).assignment.id, "assignment");
  });
  await check("future assignment ignored and approved full-month source selected", async () => {
    const f = fixture(); f.store.assignments.push({ ...f.assignment, id: "future", effectiveFrom: date("2026-11-01") });
    assert.equal((await source(f)).assignment.id, "assignment");
  });
  await check("in-month changes and overlap fail instead of inventing proration", async () => {
    const f = fixture(); f.store.assignments.push({ ...f.assignment, id: "revision", effectiveFrom: date("2026-10-15") });
    await assert.rejects(() => source(f), ConflictException);
    f.store.assignments.pop(); f.assignment.effectiveFrom = date("2026-10-15"); await assert.rejects(() => source(f), ConflictException);
  });
  await check("missing or unapproved assignment/profile/structure fails closed", async () => {
    for (const field of ["assignment", "profile", "structure"] as const) {
      const f = fixture(); f[field].status = "DRAFT"; await assert.rejects(() => source(f), ConflictException);
      f[field].status = "INACTIVE"; await assert.rejects(() => source(f), ConflictException);
    }
    const f = fixture(); f.store.profiles = []; await assert.rejects(() => source(f), ConflictException);
    f.store.profiles = [f.profile, { ...f.profile, id: "duplicate" }]; await assert.rejects(() => source(f), ConflictException);
  });
  await check("structure/profile effective coverage and bank metadata required", async () => {
    const f = fixture(); f.structure.effectiveTo = date("2026-10-15") as any; await assert.rejects(() => source(f), ConflictException);
    f.structure.effectiveTo = null; f.profile.effectiveTo = date("2026-10-15") as any; await assert.rejects(() => source(f), ConflictException);
    f.profile.effectiveTo = null; f.profile.accountNumber = ""; await assert.rejects(() => source(f), ConflictException);
  });
  await check("inactive and partial-month employees are reported, never silently skipped", async () => {
    const f = fixture(); f.employee.isActive = false; await assert.rejects(() => source(f), ConflictException);
    f.employee.isActive = true; f.employee.joiningDate = date("2026-10-15"); await assert.rejects(() => source(f), ConflictException);
  });
  await check("outside-month employment/deleted records excluded using existing dates", async () => {
    const f = fixture(); f.employee.joiningDate = date("2026-11-01"); assert.equal((await f.service.calculate({ year: 2026, month: 10 })).sources.length, 0);
    f.employee.joiningDate = date("2026-01-01"); f.employee.isDeleted = true; assert.equal((await f.service.calculate({ year: 2026, month: 10 })).sources.length, 0);
  });
  await check("month assessment remains blocked; attendance finalization never implies zero deductions", async () => {
    const f = fixture(); const result = await f.service.calculate({ year: 2026, month: 10 });
    assert.equal(result.readyForDraft, false); assert.equal(result.blockers.length, 3); assert.equal(f.counters().calculations, 0);
    assert.throws(() => f.service.calculateLine(result.sources[0], undefined as any), BadRequestException);
  });
  await check("custom components and existing calculator used; exact money/bank/cash reconciliation", async () => {
    const f = fixture(); const result = f.service.calculateLine(await source(f), explicit());
    assert.equal(f.counters().calculations, 1);
    assert.deepEqual(result.line.salarySnapshot.components.map(c => [c.code, c.amount]), [["CUSTOM_A", "37.50"], ["CUSTOM_B", "62.51"]]);
    assert.equal(result.line.grossSalary, "100.01"); assert.equal(result.line.totalDeductions, "10.15");
    assert.equal(result.line.netPay, "89.86"); assert.equal(result.line.bankPay, "60.01"); assert.equal(result.line.cashPay, "29.85");
    assert.equal(result.readyForDraft, false); assertPayrollFinancialIntegrity(result.line);
  });
  await check("bank allocation exceeding net pay rejected by existing calculator", async () => {
    const f = fixture(); const deductions = { ...explicit(), attendanceDeduction: "50.00" };
    const awaitedSource = await source(f);
    assert.throws(() => f.service.calculateLine(awaitedSource, deductions), BadRequestException);
  });
  await check("explicit deduction validation preserves descriptions, rejects negatives/missing amounts", async () => {
    const f = fixture(); const resolved = await source(f);
    for (const amount of ["-0.01", "1.001", "NaN", "10000000000000000.00"]) {
      assert.throws(() => f.service.calculateLine(resolved, { ...explicit(), attendanceDeduction: amount }), BadRequestException);
    }
    assert.throws(() => f.service.calculateLine(resolved, { ...explicit(), aitDeduction: undefined } as any), BadRequestException);
    assert.throws(() => f.service.calculateLine(resolved, { ...explicit(), otherApprovedDeductions: [{ amount: "1.00", description: "" }] }), BadRequestException);
    const line = f.service.calculateLine(resolved, explicit()).line;
    assert.equal(line.calculationSnapshot.otherApprovedDeductions[0].approvalReference, "SYNTHETIC");
  });
  await check("snapshots carry source references and remain independent of later master changes", async () => {
    const f = fixture(); const result = f.service.calculateLine(await source(f), explicit());
    assert.deepEqual([result.line.salaryAssignmentId, result.line.salaryStructureId, result.line.paymentProfileId], ["assignment", "structure", "profile"]);
    const saved = JSON.stringify(result);
    f.employee.fullName = "Changed"; f.employee.department.name = "Changed"; f.profile.accountNumber = "Changed";
    f.structure.components[0].name = "Changed"; f.assignment.grossSalary = new D("200.00");
    assert.equal(JSON.stringify(result), saved);
    assert.equal(result.line.calculationSnapshot.monthlyPolicyVerified, false);
  });
  await check("large exact Decimal input stays string-based and reconciled", async () => {
    const f = fixture(); f.assignment.grossSalary = new D("9999999999999999.99");
    const result = f.service.calculateLine(await source(f), explicit());
    assert.equal(result.line.grossSalary, "9999999999999999.99");
    assert.equal(result.line.netPay, "9999999999999989.84"); assertPayrollFinancialIntegrity(result.line);
  });
  await check("all six financial checks and monetary precision reject altered candidates", async () => {
    const f = fixture(); const line = f.service.calculateLine(await source(f), explicit()).line;
    for (const patch of [{ grossSalary: "0.00" }, { totalEarnings: "0.00" }, { attendanceDeduction: "-1.00" },
      { totalDeductions: "10.16" }, { netPay: "89.85" }, { cashPay: "29.84" }, { netPay: "89.860" }, { netPay: "NaN" }]) {
      assert.throws(() => assertPayrollFinancialIntegrity({ ...line, ...patch }), BadRequestException);
    }
    assert.equal(f.counters().writes, 0);
  });
  await check("invalid/duplicate component definitions and mismatched source references rejected", async () => {
    const f = fixture(); f.structure.components[0].percentage = new D("20.00"); await assert.rejects(() => source(f), ConflictException);
    f.structure.components[0].percentage = new D("37.5000"); f.structure.components[1].code = "CUSTOM_A"; await assert.rejects(() => source(f), ConflictException);
    f.structure.components[1].code = "CUSTOM_B"; const resolved = await source(f);
    f.profile.employeeId = "foreign-employee"; assert.throws(() => f.service.calculateLine(resolved, explicit()), ConflictException);
  });
  console.log(`${passed} payroll calculation checks passed; no database connection or writes`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
