import "reflect-metadata";
import assert from "node:assert/strict";
import { fixture } from "./verify-payroll-approval-readiness";
import { PayrollCorrectionPreflightService } from "../apps/api/src/payroll/payroll-correction-preflight.service";
import { PayrollParentResolver } from "../apps/api/src/payroll/payroll-parent.resolver";
import { PayrollAttendanceCompletenessService } from "../apps/api/src/payroll/payroll-attendance-completeness.service";
import { Prisma } from "../apps/api/src/generated/prisma/client";
const actor = { id: "reviewer", email: "reviewer@example.invalid", fullName: "Reviewer", roles: [{ code: "ACCOUNTANT" as const, name: "Accountant" }] };
const zero = () => ({ amount: "0.00", zeroConfirmed: true });
const input = () => ({ runId: "run", expectedVersion: 1, year: 2026, month: 10, reason: "Review authoritative source drift",
  deductions: [{ employeeId: "employee", year: 2026, month: 10, attendanceDeduction: zero(), providentFundDeduction: zero(), loanOrSalaryAdvanceDeduction: zero(), aitDeduction: zero(), otherApprovedDeductions: [], otherDeductionsZeroConfirmed: true }] });
async function setup() { const f = await fixture(); return { ...f, preflight: new PayrollCorrectionPreflightService(f.prisma, new PayrollParentResolver(f.prisma), f.service["sources"], new PayrollAttendanceCompletenessService()) }; }
const has = (r: any, code: string) => r.blockers.some((b: any) => b.code === code);
let passed = 0;
async function check(name: string, work: () => Promise<void>) { await work(); passed++; console.log(`PASS ${name}`); }
async function main() {
  await check("valid inputs pass checks but history and reviser authority keep correction disabled", async () => {
    const f = await setup(), before = JSON.stringify(f.run), audits = JSON.stringify(f.audits);
    const r = await f.preflight.assess(input(), actor); assert.equal(r.validationStatus, "PASS"); assert.equal(r.readyForCorrection, false);
    assert(has(r, "CORRECTION_HISTORY_STORAGE_CONTRACT_MISSING")); assert(has(r, "CORRECTION_REVISER_IDENTITY_CONTRACT_MISSING"));
    assert.equal(JSON.stringify(f.run), before); assert.equal(JSON.stringify(f.audits), audits); assert.equal(f.counters().writes, 0);
    assert.equal((r as any).candidateLines, undefined); assert(!JSON.stringify(r).includes("accountNumber"));
  });
  await check("invalid or override inputs rejected", async () => {
    const f = await setup(); for (const change of [{ expectedVersion: 0 }, { reason: " " }, { deductions: [] }, { correctedById: "maker" }, { auditVerified: true }, { year: "2026" }]) {
      await assert.rejects(() => f.preflight.assess({ ...input(), ...change } as any, actor));
    }
  });
  await check("unauthorized/inactive/mismatched correctors and unavailable parent are blocked", async () => {
    const f = await setup(); assert(has(await f.preflight.assess(input(), { ...actor, roles: [] }), "CORRECTOR_NOT_AUTHORIZED"));
    f.setUser(null); assert(has(await f.preflight.assess(input(), actor), "CORRECTOR_NOT_AUTHORIZED"));
    for (const state of ["missing", "inactive"]) { const g = await setup(); g.store.parentMissing = state === "missing"; g.store.parentActive = state !== "inactive"; assert.equal((await g.preflight.assess(input(), actor)).validationStatus, "BLOCKED"); }
  });
  await check("approved, foreign, missing, stale-version and wrong-month targets stop without calculations", async () => {
    for (const change of ["approved", "foreign", "missing", "version", "month"]) { const f = await setup(), request = input();
      if (change === "approved") f.run.status = "APPROVED"; if (change === "foreign") f.run.companyId = "other"; if (change === "missing") f.setMissing();
      if (change === "version") f.run.version = 2; if (change === "month") request.month = 9;
      const before = f.counters().calculations; assert.equal((await f.preflight.assess(request, actor)).validationStatus, "BLOCKED"); assert.equal(f.counters().calculations, before);
    }
  });
  await check("missing deduction categories, unconfirmed zeros and positive claims cannot pass", async () => {
    const f = await setup(), a = input(); a.deductions[0].aitDeduction.zeroConfirmed = false;
    assert(has(await f.preflight.assess(a, actor), "ZERO_CONFIRMATION_REQUIRED"));
    a.deductions[0].aitDeduction = { amount: "1.00", zeroConfirmed: false };
    (a.deductions[0].aitDeduction as any).approvalClaim = { evidenceType: "SYSTEM_RECORD", reference: "untrusted", approvedByClaim: "maker", approvedAtClaim: "2026-10-01T00:00:00Z" };
    assert(has(await f.preflight.assess(a, actor), "EVIDENCE_AUTHORITY_UNAVAILABLE"));
    delete (a.deductions[0] as any).aitDeduction; await assert.rejects(() => f.preflight.assess(a, actor));
  });
  await check("global roster inputs never silently omit employees or remove existing lines", async () => {
    for (const change of ["new", "removed", "duplicate", "period"]) { const f = await setup(), a = input();
      if (change === "new") f.store.employees.push({ ...f.employee, id: "new" }); if (change === "removed") f.store.employees = [];
      if (change === "duplicate") a.deductions.push(a.deductions[0]); if (change === "period") a.deductions[0].month = 9;
      assert.equal((await f.preflight.assess(a, actor)).validationStatus, "BLOCKED");
    }
  });
  await check("missing sources, source approval audits and unfinalized attendance block", async () => {
    for (const change of ["salary", "audit", "attendance"]) { const f = await setup();
      if (change === "salary") f.store.assignments = []; if (change === "audit") f.audits.splice(1, 1); if (change === "attendance") f.attendance[0].revisions[0].finalizedAt = null;
      assert.equal((await f.preflight.assess(input(), actor)).validationStatus, "BLOCKED");
    }
  });
  await check("current valid source drift can be assessed but cannot authorize an overwrite", async () => {
    const f = await setup(); f.assignment.updatedAt = new Date("2026-11-01T00:00:00Z"); const before = JSON.stringify(f.run);
    const r = await f.preflight.assess(input(), actor); assert.equal(r.validationStatus, "PASS"); assert.equal(r.readyForCorrection, false); assert.equal(JSON.stringify(f.run), before);
    f.prisma.$transaction = () => { throw new Error("Nested transaction forbidden"); };
    assert.equal((await f.preflight.assessWithTx(input(), actor, f.prisma)).readyForCorrection, false);
  });
  await check("approved components that cannot reconcile at currency precision are blocked", async () => {
    const f = await setup(); f.assignment.grossSalary = new Prisma.Decimal("0.02");
    f.structure.components = [1, 2, 3, 4].map(i => ({ code: `C${i}`, name: `Component ${i}`, percentage: new Prisma.Decimal("25"), displayOrder: i }));
    const r = await f.preflight.assess(input(), actor); assert(has(r, "FINANCIAL_RECONCILIATION_FAILED")); assert.equal(r.readyForCorrection, false); assert.equal(f.counters().writes, 0);
  });
  console.log(`${passed} correction preflight checks passed; correction persistence BLOCKED, no database writes`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
