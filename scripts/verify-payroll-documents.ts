import "reflect-metadata";
import assert from "node:assert/strict";
import { fixture } from "./verify-payroll-approval-readiness";
import { Prisma } from "../apps/api/src/generated/prisma/client";
import { PayrollDocumentsService } from "../apps/api/src/payroll/payroll-documents.service";
import { PayrollParentResolver } from "../apps/api/src/payroll/payroll-parent.resolver";

export async function documentFixture() {
  const f = await fixture(); f.run.status = "APPROVED"; f.run.version = 2; f.run.approvedById = "reviewer"; f.run.approvedAt = new Date("2026-11-03T00:00:00Z");
  let reads = 0, writes = 0;
  const forbidden = () => { writes++; throw new Error("Document mutation forbidden"); };
  const checkSelect = (args: any) => { assert.equal(args.select?.paymentProfileSnapshot, undefined); assert.equal(args.select?.employee, undefined); assert.equal(args.select?.salaryAssignment, undefined); };
  f.prisma.payrollRun.findFirst = async (args: any) => { reads++; assert.equal(args.where.companyId, "parent"); return args.where.id === f.run.id && f.run.companyId === "parent" ? f.run : null; };
  f.prisma.payrollRunLine = {
    findFirst: async (args: any) => { reads++; checkSelect(args); return f.run.lines.find((l: any) => l.payrollRunId === args.where.payrollRunId && l.employeeId === args.where.employeeId) ?? null; },
    findMany: async (args: any) => { reads++; checkSelect(args); assert.equal(args.where.payrollRunId, "run"); return f.run.lines.slice(0, args.take); },
  };
  for (const model of [f.prisma.payrollRun, f.prisma.payrollRunLine, f.prisma.auditEvent]) for (const action of ["create", "update", "delete", "createMany", "updateMany", "deleteMany", "upsert"]) model[action] = forbidden;
  for (const model of [f.prisma.employee, f.prisma.employeeSalaryAssignment, f.prisma.salaryStructure, f.prisma.employeePaymentProfile]) {
    model.findMany = () => { throw new Error("Live salary/employee lookup forbidden"); }; model.findUnique = model.findMany;
  }
  f.prisma.$executeRaw = forbidden; f.prisma.$executeRawUnsafe = forbidden;
  const service = new PayrollDocumentsService(f.prisma, new PayrollParentResolver(f.prisma));
  return { ...f, service, counts: () => ({ reads, writes }) };
}
const status = (expected: number) => (e: any) => e.getStatus?.() === expected;
let passed = 0;
async function check(name: string, work: () => Promise<void>) { await work(); passed++; console.log(`PASS ${name}`); }
async function main() {
  await check("approved payslip uses frozen identity, branding, earnings and planned allocations", async () => {
    const f = await documentFixture(), r = await f.service.payslip("run", "employee");
    assert(r.employee, "Missing required historical employee identity");
    assert.equal(r.employee.fullName, f.line.employeeSnapshot.fullName); assert.equal(r.company.name, f.run.companySnapshot.name);
    assert.equal(r.month, 10); assert.equal(r.year, 2026); assert.equal(r.earnings.length, 2); assert.equal(r.amounts.grossSalary, "100.01");
    assert.equal(r.amounts.netPay, "100.01"); assert.equal(r.plannedAllocation.bank, "60.01"); assert.equal(r.plannedAllocation.kind, "PLANNED");
    assert.equal(r.approvedAt, "2026-11-03T00:00:00.000Z"); assert.equal(f.counts().writes, 0);
  });
  await check("draft, foreign, missing parent/run and outside employee fail closed", async () => {
    const f = await documentFixture(); await assert.rejects(() => f.service.payslip("run", "other"), status(404));
    f.run.status = "DRAFT"; await assert.rejects(() => f.service.payslip("run", "employee"), status(409)); await assert.rejects(() => f.service.salarySheet("run"), status(409));
    f.run.status = "APPROVED"; f.run.companyId = "other"; await assert.rejects(() => f.service.salarySheet("run"), status(404));
    f.store.parentMissing = true; await assert.rejects(() => f.service.payslip("run", "employee"), status(503));
    f.store.parentMissing = false; f.store.parentActive = false; await assert.rejects(() => f.service.salarySheet("run"), status(503));
  });
  await check("historical output survives all live source changes and does not leak credentials", async () => {
    const f = await documentFixture(), before = await f.service.payslip("run", "employee");
    f.employee.fullName = "New name"; f.assignment.grossSalary = new Prisma.Decimal("999"); f.structure.status = "INACTIVE";
    f.line.paymentProfileSnapshot.accountNumber = "PRIVATE_SENTINEL"; f.line.employeeSnapshot.nationalId = "PRIVATE_SENTINEL";
    f.line.calculationSnapshot.auditPayload = "PRIVATE_SENTINEL";
    assert.deepEqual(await f.service.payslip("run", "employee"), before);
    assert(!JSON.stringify(await f.service.salarySheet("run")).includes("PRIVATE_SENTINEL")); assert.equal(f.counts().writes, 0);
  });
  await check("multi-employee sheet totals use exact decimals and include the entire roster", async () => {
    const f = await documentFixture(); f.run.lines.push({ ...f.line, id: "second", employeeId: "second", employeeSnapshot: { ...f.line.employeeSnapshot, employeeCode: "SECOND" } });
    const r = await f.service.salarySheet("run"); assert.equal(r.employeeCount, 2); assert.equal(r.rows.length, 2);
    assert.equal(r.totals.grossSalary, "200.02"); assert.equal(r.totals.netPay, "200.02"); assert.equal(r.totals.bankPay, "120.02"); assert.equal(r.totals.cashPay, "80.00");
  });
  await check("all frozen deduction categories reconcile without exposing evidence payloads", async () => {
    const f = await documentFixture();
    const values = { attendanceDeduction: "1.01", providentFundDeduction: "2.02", loanOrSalaryAdvanceDeduction: "3.03", aitDeduction: "4.04", otherDeductionsTotal: "0.05", totalDeductions: "10.15", netPay: "89.86", cashPay: "29.85" };
    for (const [key, value] of Object.entries(values)) f.line[key] = new Prisma.Decimal(value);
    for (const key of ["attendanceDeduction", "providentFundDeduction", "loanOrSalaryAdvanceDeduction", "aitDeduction"]) f.line.calculationSnapshot[key] = values[key as keyof typeof values];
    f.line.calculationSnapshot.otherApprovedDeductions = [{ amount: "0.05", description: "PRIVATE_SENTINEL" }];
    const slip = await f.service.payslip("run", "employee");
    for (const [key, value] of Object.entries(values)) assert.equal(slip.amounts[key as keyof typeof slip.amounts], value);
    assert(!JSON.stringify(slip).includes("PRIVATE_SENTINEL")); assert.equal(f.counts().writes, 0);
  });
  await check("full bounded sheets preserve totals beyond single-line DECIMAL precision", async () => {
    const f = await documentFixture(), max = "9999999999999999.99";
    for (const key of ["grossSalary", "totalEarnings", "netPay"]) f.line[key] = new Prisma.Decimal(max);
    f.line.bankPay = new Prisma.Decimal("5999999999999999.99"); f.line.cashPay = new Prisma.Decimal("4000000000000000.00");
    f.line.salarySnapshot.grossSalary = max;
    f.line.salarySnapshot.components[0].amount = "3750000000000000.00";
    f.line.salarySnapshot.components[1].amount = "6249999999999999.99";
    f.run.lines = Array.from({ length: 1000 }, (_, i) => ({ ...f.line, id: String(i), employeeId: String(i) }));
    const r = await f.service.salarySheet("run"); assert.equal(r.employeeCount, 1000); assert.equal(r.totals.netPay, "9999999999999999990.00");
    assert.equal(f.counts().writes, 0);
  });
  await check("no malformed/inconsistent snapshot or line is silently omitted", async () => {
    for (const field of ["identity", "company", "components", "sum", "calc", "financial", "approval", "duplicate"]) { const f = await documentFixture();
      if (field === "identity") delete f.line.employeeSnapshot.fullName; if (field === "company") f.run.companySnapshot.name = null;
      if (field === "components") f.line.salarySnapshot.components = []; if (field === "sum") f.line.salarySnapshot.components[0].amount = "1.00";
      if (field === "calc") f.line.calculationSnapshot.month = 9; if (field === "financial") f.line.netPay = new Prisma.Decimal("1.00");
      if (field === "approval") f.run.approvedAt = null; if (field === "duplicate") f.run.lines.push({ ...f.line, id: "duplicate" });
      await assert.rejects(() => f.service.salarySheet("run"), status(422)); assert.equal(f.counts().writes, 0);
    }
  });
  await check("oversized and empty sheets reject instead of returning partial totals", async () => {
    const f = await documentFixture(); f.run.lines = []; await assert.rejects(() => f.service.salarySheet("run"), status(422));
    f.run.lines = Array.from({ length: 1001 }, (_, i) => ({ ...f.line, id: String(i), employeeId: String(i) }));
    await assert.rejects(() => f.service.salarySheet("run"), status(422));
  });
  console.log(`${passed} payroll document checks passed; no database connections or writes`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
