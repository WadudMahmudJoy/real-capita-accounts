import "reflect-metadata";
import assert from "node:assert/strict";
import { setup } from "./verify-payroll-readiness";
import { PayrollPreviewService } from "../apps/api/src/payroll/payroll-preview.service";

const zero = () => ({ amount: "0.00", zeroConfirmed: true });
const input = () => ({ year: 2026, month: 10, deductions: [{ year: 2026, month: 10, employeeId: "employee",
  attendanceDeduction: zero(), providentFundDeduction: zero(), loanOrSalaryAdvanceDeduction: zero(), aitDeduction: zero(),
  otherApprovedDeductions: [], otherDeductionsZeroConfirmed: true }] });
let passed = 0;
async function check(name: string, work: () => Promise<void>) { await work(); passed++; console.log(`PASS ${name}`); }
async function main() {
  await check("blocked preview returns structured exceptions and no partial payable totals", async () => {
    const f = setup(), p = new PayrollPreviewService(f.readiness as any);
    const r = await p.preview(input()); assert.equal(r.status, "BLOCKED");
    assert(r.exceptions.some(e => e.code === "ATTENDANCE_DATE_MISSING")); assert.equal(r.financialTotals.amounts, null);
    assert.equal(r.creationRequiresRevalidation, true); assert.equal(f.counters().writes, 0);
  });
  await check("ready preview reuses exact calculator and omits sensitive snapshots", async () => {
    const f = setup(); for (let d = 1; d <= 31; d++) f.addAttendance(`2026-10-${String(d).padStart(2, "0")}`, d % 2 ? "office-a" : "office-b");
    f.profile.accountNumber = "PRIVATE_SENTINEL";
    const assessment = await f.readiness.assess(input());
    const p = new PayrollPreviewService(f.readiness as any), r = await p.preview(input());
    assert.equal(r.status, "READY"); assert.equal(r.parent?.id, "parent"); assert.equal(r.employees.length, 1);
    assert.equal(r.employees[0].attendance.recordedDateCount, 31);
    for (const [field, amount] of Object.entries(r.financialTotals.amounts!)) assert.equal(amount, (assessment.candidateLines[0] as any)[field]);
    assert(!JSON.stringify(r).includes("PRIVATE_SENTINEL")); assert.equal((r as any).candidateLines, undefined);
    assert.equal((r.employees[0] as any).salarySnapshot, undefined); assert.equal((r.employees[0].attendance as any).records, undefined);
    assert.equal(r.employees[0].designation,assessment.candidateLines[0].employeeSnapshot.designation);
    assert.equal(r.employees[0].departmentName,assessment.candidateLines[0].employeeSnapshot.departmentName);
    assert.deepEqual(r.employees[0].earnings,assessment.candidateLines[0].salarySnapshot.components.map(c=>({code:c.code,name:c.name,percentage:c.percentage,amount:c.amount})));
    assert.equal(f.counters().writes, 0);
  });
  await check("positive claims and unconfirmed zeros remain blocking in preview", async () => {
    const f = setup(), p = new PayrollPreviewService(f.readiness as any), request = input();
    request.deductions[0].aitDeduction = { amount: "1.00", zeroConfirmed: false };
    (request.deductions[0].aitDeduction as any).approvalClaim = { evidenceType: "SYSTEM_RECORD", reference: "SECRET_REFERENCE", approvedByClaim: "SECRET_PERSON", approvedAtClaim: "2026-10-01T00:00:00Z" };
    let r = await p.preview(request); assert(r.exceptions.some(e => e.code === "EVIDENCE_AUTHORITY_UNAVAILABLE"));
    assert(!JSON.stringify(r).includes("SECRET_")); request.deductions[0].aitDeduction = { amount: "0", zeroConfirmed: false };
    r = await p.preview(request); assert(r.exceptions.some(e => e.code === "ZERO_CONFIRMATION_REQUIRED")); assert.equal(f.counters().writes, 0);
  });
  await check("preview revalidates every request and rejects invalid input", async () => {
    const f = setup(), p = new PayrollPreviewService(f.readiness as any);
    await assert.rejects(() => p.preview({ ...input(), month: 13 }));
    f.setExisting({ status: "DRAFT", id: "run", companyId: "parent" });
    assert((await p.preview(input())).exceptions.some(e => e.code === "PAYROLL_RUN_ALREADY_EXISTS"));
    assert.equal(f.counters().writes, 0);
  });
  await check("missing or inactive parent remains fail-closed in preview", async () => {
    for (const field of ["parentMissing", "parentActive"]) {
      const f = setup(); f.store[field] = field === "parentMissing";
      const r = await new PayrollPreviewService(f.readiness as any).preview(input());
      assert.equal(r.status, "BLOCKED"); assert.equal(r.parent, null); assert.equal(r.financialTotals.amounts, null);
      assert(r.exceptions.some(e => e.code === (field === "parentMissing" ? "PAYROLL_PARENT_MISSING" : "PAYROLL_PARENT_INACTIVE")));
      assert.equal(f.counters().writes, 0);
    }
  });
  console.log(`${passed} preview service checks passed; offline test doubles`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
