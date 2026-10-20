import "reflect-metadata";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fixture } from "./verify-payroll-calculation";
import { PayrollReadinessService } from "../apps/api/src/payroll/payroll-readiness.service";
import { PayrollParentResolver } from "../apps/api/src/payroll/payroll-parent.resolver";
import { PayrollAttendanceCompletenessService } from "../apps/api/src/payroll/payroll-attendance-completeness.service";
const { BadRequestException } = createRequire(resolve(__dirname, "../apps/api/package.json"))("@nestjs/common");
const zero = () => ({ amount: "0.00", zeroConfirmed: true });
const manual = (employeeId = "employee") => ({ employeeId, year: 2026, month: 10,
  attendanceDeduction: zero(), providentFundDeduction: zero(), loanOrSalaryAdvanceDeduction: zero(), aitDeduction: zero(),
  otherApprovedDeductions: [], otherDeductionsZeroConfirmed: true });
const input = () => ({ year: 2026, month: 10, deductions: [manual()] });
export function setup() {
  const f = fixture(); const attendance: any[] = [], markers: any[] = [];
  let existing: any = null;
  f.prisma.payrollRun.findUnique = async () => existing;
  f.prisma.attendanceRecord.findMany = async (args: any) => {
    assert.equal(args.where.companyId, undefined); // Evidence must span offices.
    return attendance.filter(r => args.where.employeeId.in.includes(r.employeeId) && r.businessDate >= args.where.businessDate.gte && r.businessDate < args.where.businessDate.lt);
  };
  f.prisma.attendanceDayFinalization = { findMany: async () => markers };
  const service = new PayrollReadinessService(f.prisma, new PayrollParentResolver(f.prisma), f.service, new PayrollAttendanceCompletenessService());
  const addAttendance = (day: string, office: string) => {
    const businessDate = new Date(`${day}T00:00:00Z`), finalizedAt = new Date("2026-11-01T00:00:00Z");
    const record = { id: `r-${day}`, employeeId: "employee", companyId: office, businessDate,
      revisions: [{ id: `rev-${day}`, revisionNo: 1, finalizedAt, finalizedById: "synthetic", presenceState: "NOT_REQUIRED", origin: "SYSTEM_FINALIZATION",
        isAttendanceApplicable: true, expectedDayKind: "WEEKLY_REST", checkInAt: null, checkOutAt: null, isLate: false, isEarlyLeave: false,
        isNonWorkingDayAttendance: false, arrivalDelayMinutes: null, earlyDepartureMinutes: null, timeZone: "Asia/Dhaka",
        scheduledStartMinute: null, scheduledEndMinute: null, crossesMidnight: null, unpaidBreakMinutes: null, expectedWorkMinutes: null,
        lateGraceMinutes: null, earlyLeaveGraceMinutes: null, workScheduleSource: "COMPANY_DEFAULT",
        workScheduleAssignmentId: `schedule-${office}`, attendancePolicyId: null, calendarExceptionId: null, attendancePolicy: null, calendarException: null,
        workScheduleAssignment: { id: `schedule-${office}`, companyId: office, employeeId: null, scope: "COMPANY_DEFAULT", cancelledAt: null,
          effectiveFrom: new Date("2020-01-01T00:00:00Z"), effectiveTo: null,
          workSchedule: { id: `definition-${office}`, code: "SYNTHETIC", name: "Synthetic Schedule", isActive: true,
            days: ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"].map(dayOfWeek => ({dayOfWeek,isWorkingDay:false,startMinuteOfDay:null,endMinuteOfDay:null,unpaidBreakMinutes:0,crossesMidnight:false})) } } }] };
    attendance.push(record); markers.push({ id: `marker-${day}`, companyId: office, businessDate, finalizedAt, finalizedById: "synthetic" }); return record;
  };
  return { ...f, readiness: service, attendance, markers, addAttendance, setExisting: (run: any) => { existing = run; } };
}
let passed = 0;
async function check(name: string, work: () => Promise<void>) { await work(); passed++; console.log(`PASS ${name}`); }
const has = (result: any, code: string) => result.exceptions.some((e: any) => e.code === code);
async function main() {
  await check("full-month sources and explicit zeros still block without authoritative completeness", async () => {
    const f = setup(); const result = await f.readiness.assess(input());
    assert.equal(result.status, "BLOCKED"); assert.equal(result.parent?.id, "parent"); assert.equal(result.period.timeZone, "Asia/Dhaka");
    assert.equal(result.candidateLines.length, 0); assert(has(result, "ATTENDANCE_DATE_MISSING"));
    assert.equal(result.employees[0].financial.status, "PASS");
    // No recorded attendance is never presented as proof of completeness or
    // converted into deductions. Zero here comes only from explicit input.
    assert.equal(result.employees[0].attendance.coverage, "BLOCKED");
    assert.equal(f.counters().writes, 0);
  });
  await check("joiners/leavers/inactive/deleted employees are blocking, not omitted", async () => {
    for (const [change, code] of [
      [{ joiningDate: new Date("2026-10-15T00:00:00Z") }, "JOINER_REQUIRES_REVIEW"],
      [{ separationDate: new Date("2026-10-31T00:00:00Z"), isActive: false }, "LEAVER_REQUIRES_REVIEW"],
      [{ isActive: false }, "EMPLOYEE_INACTIVE_REQUIRES_REVIEW"], [{ isDeleted: true }, "EMPLOYEE_DELETED_REQUIRES_REVIEW"],
    ] as const) {
      const f = setup(); Object.assign(f.employee, change); const result = await f.readiness.assess(input());
      assert(has(result, code)); assert.equal(result.employees.length, 1); assert.equal(result.candidateLines.length, 0);
    }
  });
  await check("source failures accumulated across the roster", async () => {
    const f = setup(); f.store.employees.push({ ...f.employee, id: "second" }); f.store.profiles = [];
    const result = await f.readiness.assess(input()); assert.equal(result.employees.length, 2);
    assert(has(result, "APPROVED_PAYMENT_PROFILE_MISSING")); assert(has(result, "APPROVED_SALARY_ASSIGNMENT_MISSING"));
    assert(has(result, "DEDUCTION_INPUT_MISSING")); assert.equal(result.candidateLines.length, 0);
  });
  await check("mid-month assignment/profile transitions block selection", async () => {
    const f = setup(); f.store.assignments.push({ ...f.assignment, id: "changed", effectiveFrom: new Date("2026-10-15T00:00:00Z") });
    f.profile.effectiveTo = new Date("2026-10-20T00:00:00Z") as any;
    const result = await f.readiness.assess(input()); assert(has(result, "MID_MONTH_SALARY_TRANSITION")); assert(has(result, "MID_MONTH_PAYMENT_TRANSITION"));
  });
  await check("global employee identity and cross-office evidence preserved once per date", async () => {
    const f = setup(); f.store.employees.push(f.employee);
    const a = f.addAttendance("2026-10-01", "office-a"); f.attendance.push(a); f.addAttendance("2026-10-02", "office-b");
    const result = await f.readiness.assess(input()); assert.equal(result.status, "BLOCKED"); assert.equal(result.employees.length, 1);
    assert.deepEqual(result.employees[0].attendance.records.map(r => r.companyId), ["office-a", "office-b"]);
    assert.equal(result.employees[0].attendance.records.length, 2);
  });
  await check("conflicting office records or unresolved attendance blocks", async () => {
    const f = setup(); const r = f.addAttendance("2026-10-01", "office-a");
    f.attendance.push({ ...r, id: "conflict", companyId: "office-b" });
    assert(has(await f.readiness.assess(input()), "ATTENDANCE_EMPLOYEE_DATE_CONFLICT"));
    f.attendance.pop(); r.revisions[0].finalizedAt = null as any;
    assert(has(await f.readiness.assess(input()), "ATTENDANCE_EVIDENCE_UNFINALIZED"));
    r.revisions[0].finalizedAt = new Date(); r.revisions[0].presenceState = "INCOMPLETE";
    assert(has(await f.readiness.assess(input()), "ATTENDANCE_INCOMPLETE_REQUIRES_REVIEW"));
    r.revisions[0].presenceState = "PRESENT"; r.revisions[0].isAttendanceApplicable = false;
    assert(has(await f.readiness.assess(input()), "ATTENDANCE_APPLICABILITY_CONFLICT"));
  });
  await check("missing inputs and unconfirmed/contradictory zeros block", async () => {
    const f = setup(); assert(has(await f.readiness.assess({ year: 2026, month: 10, deductions: [] }), "DEDUCTION_INPUT_MISSING"));
    const value = input(); value.deductions[0].aitDeduction.zeroConfirmed = false;
    assert(has(await f.readiness.assess(value), "ZERO_CONFIRMATION_REQUIRED"));
    value.deductions[0].aitDeduction = { amount: "1.00", zeroConfirmed: true };
    assert(has(await f.readiness.assess(value), "ZERO_CONFIRMATION_CONTRADICTS_AMOUNT"));
  });
  await check("positive amounts require evidence; reference/approver claims never authorize", async () => {
    const f = setup(); const value: any = input(); value.deductions[0].attendanceDeduction = { amount: "1.00", zeroConfirmed: false };
    assert(has(await f.readiness.assess(value), "POSITIVE_DEDUCTION_EVIDENCE_MISSING"));
    for (const evidenceType of ["EXTERNAL_DOCUMENT", "SYSTEM_RECORD"]) {
      value.deductions[0].attendanceDeduction.approvalClaim = { evidenceType, reference: "SYNTHETIC", approvedByClaim: "Owner", approvedAtClaim: "2026-10-13T00:00:00Z" };
      const result = await f.readiness.assess(value); assert(has(result, "EVIDENCE_AUTHORITY_UNAVAILABLE"));
      assert.equal(result.readyForDraft, false); assert.equal(result.candidateLines.length, 0); assert.equal(result.employees[0].financial.status, "PASS");
    }
    value.deductions[0].attendanceDeduction.approvalClaim.verified = true;
    await assert.rejects(() => f.readiness.assess(value), BadRequestException);
  });
  await check("invalid numbers, missing categories and nested arrays rejected before reads", async () => {
    const f = setup();
    for (const amount of ["-1.00", "1.001", "NaN", "1e2", 1, "10000000000000000.00"]) {
      const value: any = input(); value.deductions[0].aitDeduction.amount = amount;
      await assert.rejects(() => f.readiness.assess(value), BadRequestException);
    }
    for (const change of [undefined, [zero()]]) {
      const value: any = input(); value.deductions[0].aitDeduction = change;
      await assert.rejects(() => f.readiness.assess(value), BadRequestException);
    }
    assert.equal(f.calls.length, 0);
  });
  await check("period mismatches, duplicate inputs and foreign employees block", async () => {
    const f = setup(); const value = input(); value.deductions.push(manual(), manual("foreign")); value.deductions[0].month = 9;
    const result = await f.readiness.assess(value);
    for (const code of ["DEDUCTION_PERIOD_MISMATCH", "DUPLICATE_DEDUCTION_INPUT", "DEDUCTION_EMPLOYEE_OUTSIDE_ROSTER"]) assert(has(result, code));
  });
  await check("financial allocation failure never becomes ready", async () => {
    const f = setup(); const value = input(); value.deductions[0].attendanceDeduction = { amount: "90.00", zeroConfirmed: false };
    const result = await f.readiness.assess(value); assert(has(result, "FINANCIAL_RECONCILIATION_FAILED")); assert.equal(result.employees[0].financial.status, "FAIL");
  });
  await check("missing/inactive PRIMARY returns structured blockers without calculations", async () => {
    const f = setup(); f.store.parentMissing = true; assert(has(await f.readiness.assess(input()), "PAYROLL_PARENT_MISSING"));
    f.store.parentMissing = false; f.store.parentActive = false; assert(has(await f.readiness.assess(input()), "PAYROLL_PARENT_INACTIVE")); assert.equal(f.counters().calculations, 0);
  });
  await check("existing approved history and DRAFT collision never recalculated", async () => {
    const f = setup(); f.setExisting({ id: "old", companyId: "parent", status: "APPROVED" });
    assert(has(await f.readiness.assess(input()), "PAYROLL_ALREADY_APPROVED"));
    f.setExisting({ id: "old", companyId: "parent", status: "DRAFT" }); assert(has(await f.readiness.assess(input()), "PAYROLL_RUN_ALREADY_EXISTS"));
    assert.equal(f.counters().calculations, 0); assert.equal(f.counters().writes, 0);
  });
  console.log(`${passed} payroll readiness checks passed; no database connections or writes`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
