import "reflect-metadata";
import assert from "node:assert/strict";
import { fixture } from "./verify-payroll-approval-readiness";
import { PayrollApprovalService } from "../apps/api/src/payroll/payroll-approval.service";
import { Prisma } from "../apps/api/src/generated/prisma/client";

const reviewer = { id: "reviewer", email: "reviewer@example.invalid", fullName: "Reviewer", roles: [{ code: "ACCOUNTANT" as const, name: "Accountant" }] };
async function setup() {
  const f = await fixture(), operations: any[] = [];
  const state = { failAudit: false, casConflict: false, serialization: false, transactions: 0, unrelatedWrites: 0 };
  let tail = Promise.resolve();
  f.prisma.$transaction = async (work: any, options: any) => {
    assert.equal(options.isolationLevel, "Serializable"); state.transactions++;
    const beforeQueue = tail; let release!: () => void; tail = new Promise<void>(resolve => { release = resolve; }); await beforeQueue;
    const before = { status: f.run.status, version: f.run.version, approvedById: f.run.approvedById, approvedAt: f.run.approvedAt }, auditBefore = [...f.audits];
    try { return await work(f.prisma); }
    catch (error) { Object.assign(f.run, before); f.audits.splice(0, f.audits.length, ...auditBefore); throw error; }
    finally { release(); }
  };
  f.prisma.payrollRun.updateMany = async (args: any) => {
    operations.push({ kind: "update", args });
    if (state.serialization) throw { code: "P2034" };
    assert.deepEqual(Object.keys(args.data).sort(), ["approvedAt", "approvedById", "status", "version"]);
    assert.equal(args.where.createdById.not, reviewer.id);
    if (state.casConflict || args.where.id !== f.run.id || args.where.companyId !== f.run.companyId || args.where.status !== f.run.status || args.where.version !== f.run.version || f.run.createdById === args.where.createdById.not) return { count: 0 };
    Object.assign(f.run, { status: args.data.status, version: f.run.version + args.data.version.increment, approvedById: args.data.approvedById, approvedAt: args.data.approvedAt }); return { count: 1 };
  };
  f.prisma.auditEvent.create = async ({ data }: any) => {
    operations.push({ kind: "audit", data }); if (state.failAudit) throw new Error("Synthetic audit failure");
    assert.equal(data.action, "PAYROLL_RUN_APPROVED"); f.audits.push(data); return data;
  };
  const forbidden = () => { state.unrelatedWrites++; throw new Error("Forbidden line/source/payment/accounting mutation"); };
  for (const model of ["payrollRunLine", "voucher", "voucherLine", "employee", "employeeSalaryAssignment", "employeePaymentProfile", "salaryStructure"]) {
    f.prisma[model] ??= {}; for (const action of ["create", "update", "delete", "createMany", "updateMany", "deleteMany", "upsert"]) f.prisma[model][action] = forbidden;
  }
  return { ...f, state, operations, approval: new PayrollApprovalService(f.prisma, f.service) };
}
const approve = (f: Awaited<ReturnType<typeof setup>>, version = 1) => f.approval.approve("run", { expectedVersion: version }, reviewer);
const status = (expected: number) => (e: any) => e.getStatus?.() === expected;
let passed = 0;
async function check(name: string, work: () => Promise<void>) { await work(); passed++; console.log(`PASS ${name}`); }
async function main() {
  await check("distinct Accountant approval changes metadata only and writes one auditable event", async () => {
    const f = await setup(), linesBefore = JSON.stringify(f.run.lines), calculations = f.counters().calculations;
    const result = await approve(f); assert.equal(result.status, "APPROVED"); assert.equal(result.version, 2);
    assert.equal(result.approvedById, reviewer.id); assert.equal(result.lineCount, 1); assert.equal(result.approvedAt, f.run.approvedAt.toISOString());
    assert.equal(JSON.stringify(f.run.lines), linesBefore); assert.equal(f.counters().calculations, calculations); assert.equal(f.state.unrelatedWrites, 0);
    const events = f.audits.filter(a => a.action === "PAYROLL_RUN_APPROVED"); assert.equal(events.length, 1);
    assert.equal(events[0].userId, reviewer.id); assert.equal(events[0].metadata.createdById, "maker");
    assert.equal(events[0].metadata.previousVersion, 1); assert.equal(events[0].metadata.newVersion, 2);
    assert.deepEqual(Object.keys(result).sort(), ["id", "companyId", "year", "month", "status", "version", "approvedById", "approvedAt", "lineCount"].sort());
  });
  await check("unauthorized identity and client approver/override fields rejected", async () => {
    const f = await setup(); await assert.rejects(() => f.approval.approve("run", { expectedVersion: 1 }, { ...reviewer, roles: [] }), status(403));
    for (const input of [{ expectedVersion: 0 }, { expectedVersion: "1" }, { expectedVersion: 1, approvedById: "maker" }, { expectedVersion: 1, allowSelfApproval: true }]) await assert.rejects(() => f.approval.approve("run", input as any, reviewer), status(400));
    assert.equal(f.state.transactions, 0);
    f.setUser(null); await assert.rejects(() => approve(f), status(403)); assert.equal(f.operations.length, 0);
  });
  await check("parent, ownership, missing run and maker-checker errors are controlled", async () => {
    for (const [change, expected] of [["missing-parent", 503], ["inactive", 503], ["foreign", 404], ["missing-run", 404], ["self", 403]] as const) {
      const f = await setup(); if (change === "missing-parent") f.store.parentMissing = true; if (change === "inactive") f.store.parentActive = false;
      if (change === "foreign") f.run.companyId = "office"; if (change === "missing-run") f.setMissing(); if (change === "self") f.run.createdById = reviewer.id;
      await assert.rejects(() => approve(f), status(expected)); assert.equal(f.operations.length, 0);
    }
  });
  await check("approved, stale and exhausted versions cannot transition", async () => {
    for (const change of ["approved", "stale", "exhausted"]) { const f = await setup();
      if (change === "approved") f.run.status = "APPROVED"; if (change === "stale") f.run.version = 2; if (change === "exhausted") f.run.version = 2147483647;
      await assert.rejects(() => approve(f, change === "exhausted" ? 2147483647 : 1), status(409)); assert.equal(f.operations.length, 0);
    }
  });
  await check("salary, attendance, coverage, snapshot and financial blockers preserve DRAFT", async () => {
    for (const change of ["salary", "attendance", "roster", "snapshot", "financial", "positive"]) { const f = await setup();
      if (change === "salary") f.assignment.updatedAt = new Date("2026-11-01T00:00:00Z"); if (change === "attendance") f.attendance.pop();
      if (change === "roster") f.run.lines = []; if (change === "snapshot") f.line.salarySnapshot = null;
      if (change === "financial") f.line.netPay = new Prisma.Decimal("1.00");
      if (change === "positive") { f.line.attendanceDeduction = new Prisma.Decimal(1); f.line.totalDeductions = new Prisma.Decimal(1); f.line.netPay = new Prisma.Decimal("99.01"); f.line.cashPay = new Prisma.Decimal("39.00"); }
      const before = JSON.stringify(f.run); await assert.rejects(() => approve(f), status(422)); assert.equal(JSON.stringify(f.run), before); assert.equal(f.operations.length, 0);
    }
  });
  await check("audit failure rolls back metadata and leaves no approval event", async () => {
    const f = await setup(), before = JSON.stringify(f.run), audits = JSON.stringify(f.audits); f.state.failAudit = true;
    await assert.rejects(() => approve(f), status(500)); assert.equal(JSON.stringify(f.run), before); assert.equal(JSON.stringify(f.audits), audits);
    assert.deepEqual(f.operations.map(o => o.kind), ["update", "audit"]);
  });
  await check("CAS loss and serialization conflict return 409 with no approval audit", async () => {
    for (const field of ["casConflict", "serialization"] as const) { const f = await setup(); f.state[field] = true; const before = JSON.stringify(f.run);
      await assert.rejects(() => approve(f), status(409)); assert.equal(JSON.stringify(f.run), before); assert.equal(f.audits.filter(a => a.action === "PAYROLL_RUN_APPROVED").length, 0);
    }
  });
  await check("concurrent/repeated requests create one transition and one audit; approved history stays unchanged", async () => {
    const f = await setup(), results = await Promise.allSettled([approve(f), approve(f)]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((results.find(r => r.status === "rejected") as PromiseRejectedResult).reason.getStatus(), 409);
    const before = JSON.stringify(f.run); await assert.rejects(() => approve(f, 2), status(409));
    assert.equal(JSON.stringify(f.run), before); assert.equal(f.audits.filter(a => a.action === "PAYROLL_RUN_APPROVED").length, 1); assert.equal(f.state.unrelatedWrites, 0);
  });
  console.log(`${passed} approval transaction checks passed; in-memory atomic test doubles only`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
