import "reflect-metadata";
import assert from "node:assert/strict";
import { setup } from "./verify-payroll-readiness";
import { Prisma } from "../apps/api/src/generated/prisma/client";
import { PayrollApprovalReadinessService } from "../apps/api/src/payroll/payroll-approval-readiness.service";
import { PayrollParentResolver } from "../apps/api/src/payroll/payroll-parent.resolver";
import { PayrollAttendanceCompletenessService } from "../apps/api/src/payroll/payroll-attendance-completeness.service";

const reviewer = { id: "reviewer", email: "reviewer@example.invalid", fullName: "Reviewer", roles: [{ code: "ACCOUNTANT" as const, name: "Accountant" }] };
const request = { runId: "run", expectedVersion: 1 };
const zero = () => ({ amount: "0.00", zeroConfirmed: true });
export async function fixture() {
  const f = setup(); for (let day = 1; day <= 31; day++) f.addAttendance(`2026-10-${String(day).padStart(2, "0")}`, day % 2 ? "office-a" : "office-b");
  const draft = await f.readiness.assess({ year: 2026, month: 10, deductions: [{ year: 2026, month: 10, employeeId: "employee",
    attendanceDeduction: zero(), providentFundDeduction: zero(), loanOrSalaryAdvanceDeduction: zero(), aitDeduction: zero(), otherApprovedDeductions: [], otherDeductionsZeroConfirmed: true }] });
  assert.equal(draft.status, "READY");
  const line = { ...JSON.parse(JSON.stringify(draft.candidateLines[0])), id: "line", payrollRunId: "run" };
  for (const key of ["grossSalary", "totalEarnings", "attendanceDeduction", "providentFundDeduction", "loanOrSalaryAdvanceDeduction", "aitDeduction", "otherDeductionsTotal", "totalDeductions", "netPay", "bankPay", "cashPay"]) line[key] = new Prisma.Decimal(line[key]);
  const run: any = { id: "run", companyId: "parent", payrollYear: 2026, payrollMonth: 10, status: "DRAFT", version: 1,
    snapshotSchemaVersion: 1, createdAt: new Date("2026-11-02T00:00:00Z"), createdById: "maker", approvedById: null, approvedAt: null, companySnapshot: draft.parent, lines: [line] };
  const audits: any[] = [{ userId: "maker", entityId: "run", entityType: "PayrollRun", action: "PAYROLL_RUN_DRAFT_CREATED",
    createdAt: new Date("2026-11-02T00:00:01Z"), metadata: { companyId: "parent", payrollYear: 2026, payrollMonth: 10, lineCount: 1, policyContract: "HR-3B-002B-3-ABC", sourceValidation: "IN_TRANSACTION" } }];
  for (const [model, row, action, entityType] of [["employeeSalaryAssignment", f.assignment, "SALARY_ASSIGNMENT_APPROVED", "EmployeeSalaryAssignment"],
    ["salaryStructure", f.structure, "SALARY_STRUCTURE_APPROVED", "SalaryStructure"], ["employeePaymentProfile", f.profile, "PAYMENT_PROFILE_APPROVED", "EmployeePaymentProfile"]] as const) {
    Object.assign(row, { approvedById: "maker" });
    f.prisma[model] ??= {}; f.prisma[model].findUnique = async () => row;
    audits.push({ userId: "maker", entityId: row.id, entityType, action });
  }
  let user: any = { ...reviewer, isActive: true, roles: [{ role: { code: "ACCOUNTANT" } }] }, missing = false, runReads = 0;
  f.prisma.user = { findUnique: async () => user };
  f.prisma.auditEvent = { findMany: async (args: any) => audits.filter(a => Object.entries(args.where).every(([key, value]) => a[key] === value)) };
  f.prisma.payrollRun.findUnique = async () => { runReads++; return missing ? null : run; };
  const service = new PayrollApprovalReadinessService(f.prisma, new PayrollParentResolver(f.prisma), f.service, new PayrollAttendanceCompletenessService());
  return { ...f, run, line, audits, service, setUser: (value: any) => { user = value; }, setMissing: () => { missing = true; }, runReads: () => runReads };
}
const has = (r: any, code: string) => r.blockers.some((b: any) => b.code === code);
let passed = 0;
async function check(name: string, work: () => Promise<void>) { await work(); passed++; console.log(`PASS ${name}`); }
async function main() {
  await check("consistent DRAFT permits approval by a distinct authenticated ACCOUNTANT", async () => {
    const f = await fixture(), before = JSON.stringify(f.run), calculations = f.counters().calculations;
    const r = await f.service.assess(request, reviewer);
    assert.equal(r.technicalStatus, "READY"); assert.equal(r.status, "READY"); assert.equal(r.readyForApproval, true); assert.equal(r.blockers.length, 0);
    assert.equal(r.reviewerIsCreator, false); assert.equal(JSON.stringify(f.run), before);
    assert.equal(f.counters().calculations, calculations); assert.equal(f.counters().writes, 0);
    assert(!JSON.stringify(r).includes("accountNumber")); assert.equal((r as any).lines, undefined);
  });
  await check("missing/inactive PRIMARY and foreign ownership block", async () => {
    for (const state of ["missing", "inactive", "foreign"]) {
      const f = await fixture(); if (state === "missing") f.store.parentMissing = true;
      if (state === "inactive") f.store.parentActive = false; if (state === "foreign") f.run.companyId = "office-a";
      const r = await f.service.assess(request, reviewer); assert.equal(r.technicalStatus, "BLOCKED");
      assert(has(r, state === "foreign" ? "PAYROLL_OWNERSHIP_MISMATCH" : state === "missing" ? "PAYROLL_PARENT_MISSING" : "PAYROLL_PARENT_INACTIVE"));
    }
  });
  await check("missing, inactive, revoked-role or mismatched reviewer cannot assess payroll", async () => {
    for (const user of [null, { id: "different", email: reviewer.email, isActive: true, roles: [{ role: { code: "ACCOUNTANT" } }] },
      { ...reviewer, isActive: false, roles: [{ role: { code: "ACCOUNTANT" } }] }, { ...reviewer, isActive: true, roles: [] }]) {
      const f = await fixture(); f.setUser(user); const r = await f.service.assess(request, reviewer);
      assert.equal(r.technicalStatus, "BLOCKED"); assert.equal(f.runReads(), 0);
    }
    const f = await fixture(); assert(has(await f.service.assess(request, { ...reviewer, roles: [] }), "REVIEWER_NOT_AUTHORIZED_FOR_ASSESSMENT"));
  });
  await check("missing/approved runs stop before source or attendance assessment", async () => {
    const f = await fixture(); f.run.status = "APPROVED";
    f.service["sources"].assessSourcesWithTx = () => { throw new Error("Approved history must not be reassessed"); };
    const before = JSON.stringify(f.run), r = await f.service.assess(request, reviewer);
    assert(has(r, "PAYROLL_NOT_DRAFT")); assert.equal(JSON.stringify(f.run), before);
    f.setMissing(); assert(has(await f.service.assess(request, reviewer), "PAYROLL_RUN_MISSING"));
  });
  await check("stale and invalid versions rejected; caller transaction is reused without nesting", async () => {
    const f = await fixture(); f.run.version = 2; assert(has(await f.service.assess(request, reviewer), "PAYROLL_VERSION_CONFLICT"));
    await assert.rejects(() => f.service.assess({ ...request, expectedVersion: 0 }, reviewer));
    f.run.version = 1; f.prisma.$transaction = () => { throw new Error("Nested transaction forbidden"); };
    assert.equal((await f.service.assessWithTx(request, reviewer, f.prisma)).technicalStatus, "READY");
  });
  await check("empty, missing, duplicate or newly payable employee lines block completeness", async () => {
    for (const change of ["empty", "duplicate", "new", "wrong-run"]) {
      const f = await fixture(); if (change === "empty") f.run.lines = [];
      if (change === "duplicate") f.run.lines.push({ ...f.line, id: "other" });
      if (change === "new") f.store.employees.push({ ...f.employee, id: "new" });
      if (change === "wrong-run") f.line.payrollRunId = "foreign";
      assert.equal((await f.service.assess(request, reviewer)).technicalStatus, "BLOCKED");
    }
  });
  await check("financial inconsistencies and gross-based bank allocation drift block", async () => {
    for (const change of [{ netPay: "99.00" }, { bankPay: "59.01", cashPay: "41.00" }, { grossSalary: "0.00" }]) {
      const f = await fixture(); for (const [key, value] of Object.entries(change)) f.line[key] = new Prisma.Decimal(value);
      assert.equal((await f.service.assess(request, reviewer)).technicalStatus, "BLOCKED");
    }
  });
  await check("missing or altered required snapshots, components and provenance block", async () => {
    for (const change of ["null", "identity", "salary", "profile", "components", "calc", "provenance"]) {
      const f = await fixture();
      if (change === "null") f.line.salarySnapshot = null;
      if (change === "identity") f.line.employeeSnapshot.fullName = "Altered";
      if (change === "salary") f.line.salarySnapshot.structureVersion = 2;
      if (change === "profile") f.line.paymentProfileSnapshot.accountNumber = "Altered";
      if (change === "components") f.line.salarySnapshot.components[0].amount = "1.00";
      if (change === "calc") f.line.calculationSnapshot.monthlyPolicyVerified = false;
      if (change === "provenance") f.line.calculationSnapshot.deductionProvenance = [];
      assert.equal((await f.service.assess(request, reviewer)).technicalStatus, "BLOCKED", change);
    }
  });
  await check("changed/missing/unapproved salary sources and employment changes block", async () => {
    for (const change of ["version", "missing", "unapproved", "employee", "profile"]) {
      const f = await fixture(); if (change === "version") f.assignment.updatedAt = new Date("2026-11-01T00:00:00Z");
      if (change === "missing") f.store.assignments = []; if (change === "unapproved") f.structure.status = "DRAFT";
      if (change === "employee") f.employee.isActive = false;
      if (change === "profile") f.profile.selectedBankPercentage = new Prisma.Decimal("50");
      assert.equal((await f.service.assess(request, reviewer)).technicalStatus, "BLOCKED", change);
    }
  });
  await check("missing, unfinalized, corrected or altered attendance history blocks", async () => {
    for (const change of ["missing", "unfinalized", "correction", "snapshot", "duplicate"]) {
      const f = await fixture(); if (change === "missing") f.attendance.pop();
      if (change === "unfinalized") f.attendance[0].revisions[0].finalizedAt = null;
      if (change === "correction") f.attendance[0].revisions.unshift({ ...f.attendance[0].revisions[0], id: "correction", revisionNo: 2 });
      if (change === "snapshot") f.line.calculationSnapshot.attendanceEvidence[0].revision.id = "altered";
      if (change === "duplicate") f.attendance.push({ ...f.attendance[0], id: "other-office", companyId: "office-b" });
      assert.equal((await f.service.assess(request, reviewer)).technicalStatus, "BLOCKED", change);
    }
  });
  await check("claimed positive deduction approvals never establish authority", async () => {
    const f = await fixture(); f.line.attendanceDeduction = new Prisma.Decimal("1"); f.line.totalDeductions = new Prisma.Decimal("1");
    f.line.netPay = new Prisma.Decimal("99.01"); f.line.cashPay = new Prisma.Decimal("39.00");
    f.line.calculationSnapshot.attendanceDeduction = "1.00"; f.line.calculationSnapshot.deductionProvenance[0].amount = "1.00";
    const r = await f.service.assess(request, reviewer); assert(has(r, "DEDUCTION_AUTHORITY_UNVERIFIABLE")); assert.equal(r.readyForApproval, false);
  });
  await check("missing/altered creation audit and parent snapshot are blocking", async () => {
    for (const change of ["audit", "maker", "count", "company", "approval-metadata"]) {
      const f = await fixture(); if (change === "audit") f.audits.splice(0);
      if (change === "maker") f.audits[0].userId = "wrong";
      if (change === "count") f.audits[0].metadata.lineCount = 2;
      if (change === "company") f.run.companySnapshot.id = "foreign";
      if (change === "approval-metadata") f.run.approvedById = "reviewer";
      assert.equal((await f.service.assess(request, reviewer)).technicalStatus, "BLOCKED");
    }
  });
  await check("mandatory maker-checker rejects the creator", async () => {
    const f = await fixture(); f.run.createdById = reviewer.id; f.audits[0].userId = reviewer.id;
    const r = await f.service.assess(request, reviewer); assert.equal(r.reviewerIsCreator, true);
    assert.equal(r.status, "BLOCKED"); assert(has(r, "PAYROLL_SELF_APPROVAL_FORBIDDEN")); assert.equal(r.readyForApproval, false); assert.equal(f.counters().writes, 0);
  });
  await check("input cannot inject ownership, reviewer, amounts or policy overrides", async () => {
    const f = await fixture();
    for (const invalid of [{ ...request, expectedVersion: 1.5 }, { ...request, expectedVersion: 2147483648 }, { ...request, expectedVersion: "1" },
      { ...request, companyId: "office-a" }, { ...request, reviewerId: "maker" }, { ...request, allowSelfApproval: true }, { ...request, netPay: "1.00" }]) {
      await assert.rejects(() => f.service.assess(invalid as any, reviewer));
    }
    assert.equal(f.counters().writes, 0);
  });
  await check("source and creation-audit chronology must be consistent with the DRAFT", async () => {
    for (const change of ["run", "audit", "source", "attendance"]) {
      const f = await fixture();
      if (change === "run") f.run.createdAt = new Date(NaN);
      if (change === "audit") f.audits[0].createdAt = new Date("2026-10-01T00:00:00Z");
      if (change === "source") { f.assignment.approvedAt = new Date("2026-12-01T00:00:00Z"); f.line.salarySnapshot.assignmentApprovedAt = f.assignment.approvedAt.toISOString(); }
      if (change === "attendance") { f.attendance[0].revisions[0].finalizedAt = new Date("2026-12-01T00:00:00Z"); f.line.calculationSnapshot.attendanceEvidence[0].revision.finalizedAt = "2026-12-01T00:00:00.000Z"; }
      assert.equal((await f.service.assess(request, reviewer)).technicalStatus, "BLOCKED", change);
    }
  });
  await check("approved salary status cannot substitute for missing approver or approval audit", async () => {
    for (const change of ["approver", "audit", "actor"]) {
      const f = await fixture();
      if (change === "approver") (f.assignment as any).approvedById = null;
      if (change === "audit") f.audits.splice(1, 1);
      if (change === "actor") f.audits[1].userId = "unmatched-approver";
      assert(has(await f.service.assess(request, reviewer), "PAYROLL_SOURCE_APPROVAL_PROVENANCE_UNVERIFIABLE"));
    }
  });
  await check("unsupported DRAFT revisions and correction claims never bypass reviser separation", async () => {
    for (const change of ["version", "event", "null-actor"]) {
      const f = await fixture();
      if (change === "version") f.run.version = 2;
      else f.audits.push({ entityId: "run", entityType: "PayrollRun", action: "PAYROLL_RUN_DRAFT_CORRECTED", userId: change === "null-actor" ? null : reviewer.id,
        metadata: { approved: true, before: f.run, after: f.run } });
      const result = await f.service.assess({ ...request, expectedVersion: f.run.version }, reviewer);
      assert.equal(result.readyForApproval, false); assert(has(result, "PAYROLL_REVISION_HISTORY_UNVERIFIABLE"));
    }
  });
  console.log(`${passed} approval-readiness checks passed; offline fixtures only, no database writes`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
