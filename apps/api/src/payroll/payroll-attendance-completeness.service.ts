import { Injectable } from "@nestjs/common";
import { formalDateEligibility, calendarExpectedWorkMinutes } from "../attendance/attendance-expectation.service";
import { computeFinalizationAllowedAt, evaluateAttendance, type ResolvedAttendanceExpectation } from "../attendance/attendance-evaluation";
import { dhakaBusinessDate } from "../attendance/attendance-time";
import { Prisma } from "../generated/prisma/client";
import { resolveWorkSchedule } from "../work-schedule/work-schedule-resolver";
import { monthWindow } from "./monthly-payroll-calculation.service";
import { PayrollMonthDto } from "./dto/payroll-month.dto";

const revisionSelect = {
  id: true, revisionNo: true, origin: true, finalizedAt: true, finalizedById: true, isAttendanceApplicable: true,
  presenceState: true, expectedDayKind: true, isLate: true, isEarlyLeave: true, isNonWorkingDayAttendance: true,
  arrivalDelayMinutes: true, earlyDepartureMinutes: true, checkInAt: true, checkOutAt: true,
  workScheduleAssignmentId: true, workScheduleSource: true, attendancePolicyId: true, calendarExceptionId: true,
  scheduledStartMinute: true, scheduledEndMinute: true, crossesMidnight: true, unpaidBreakMinutes: true,
  expectedWorkMinutes: true, lateGraceMinutes: true, earlyLeaveGraceMinutes: true, timeZone: true,
  workScheduleAssignment: { include: { workSchedule: { include: { days: true } } } },
  calendarException: true, attendancePolicy: true,
} satisfies Prisma.AttendanceRevisionSelect;
type Revision = Prisma.AttendanceRevisionGetPayload<{ select: typeof revisionSelect }>;
type Employee = { id: string; joiningDate: Date; separationDate: Date | null };
export type AttendanceCompletenessBlocker = { code: string; employeeId: string; businessDate?: string; message: string };

function historicalExpectation(revision: Revision, employeeId: string, companyId: string, businessDate: string) {
  if (revision.timeZone !== "Asia/Dhaka" || !revision.expectedDayKind || revision.isAttendanceApplicable !== true) throw new Error("ATTENDANCE_HISTORY_SNAPSHOT_INVALID");
  const exception = revision.calendarException;
  if (revision.expectedDayKind === "HOLIDAY" || revision.expectedDayKind === "SPECIAL_WORKING_DAY") {
    if (!exception || exception.id !== revision.calendarExceptionId || exception.companyId !== companyId || exception.businessDate.toISOString().slice(0, 10) !== businessDate ||
        (revision.expectedDayKind === "HOLIDAY" ? exception.exceptionType !== "HOLIDAY" : exception.exceptionType !== "SPECIAL_WORKING_DAY")) throw new Error("ATTENDANCE_EXCEPTION_SOURCE_INVALID");
    if (revision.workScheduleAssignmentId !== null || revision.workScheduleSource !== null) throw new Error("ATTENDANCE_HISTORY_SNAPSHOT_INVALID");
    if (revision.expectedDayKind === "SPECIAL_WORKING_DAY" &&
        (revision.scheduledStartMinute !== exception.startMinuteOfDay || revision.scheduledEndMinute !== exception.endMinuteOfDay || revision.crossesMidnight !== exception.crossesMidnight ||
         revision.unpaidBreakMinutes !== exception.unpaidBreakMinutes || revision.expectedWorkMinutes !== calendarExpectedWorkMinutes(exception.startMinuteOfDay!, exception.endMinuteOfDay!, exception.unpaidBreakMinutes, exception.crossesMidnight))) throw new Error("ATTENDANCE_SOURCE_SNAPSHOT_MISMATCH");
  } else {
    const assignment = revision.workScheduleAssignment;
    if (!assignment || assignment.id !== revision.workScheduleAssignmentId || assignment.companyId !== companyId || assignment.scope !== revision.workScheduleSource ||
        (assignment.scope === "EMPLOYEE_OVERRIDE" && assignment.employeeId !== employeeId) || revision.calendarExceptionId !== null) throw new Error("ATTENDANCE_SCHEDULE_SOURCE_INVALID");
    const resolved = resolveWorkSchedule([{ ...assignment, effectiveFrom: assignment.effectiveFrom.toISOString().slice(0, 10), effectiveTo: assignment.effectiveTo?.toISOString().slice(0, 10) ?? null }], companyId, employeeId, businessDate);
    if (resolved.kind !== "RESOLVED" || (resolved.isWorkingDay ? "WORKING_DAY" : "WEEKLY_REST") !== revision.expectedDayKind) throw new Error("ATTENDANCE_SCHEDULE_SOURCE_INVALID");
    if (resolved.isWorkingDay && (revision.scheduledStartMinute !== resolved.startMinuteOfDay || revision.scheduledEndMinute !== resolved.endMinuteOfDay || revision.crossesMidnight !== resolved.crossesMidnight ||
        revision.unpaidBreakMinutes !== resolved.unpaidBreakMinutes || revision.expectedWorkMinutes !== resolved.expectedWorkMinutes)) throw new Error("ATTENDANCE_SOURCE_SNAPSHOT_MISMATCH");
  }
  const working = ["WORKING_DAY", "SPECIAL_WORKING_DAY"].includes(revision.expectedDayKind);
  const policy = revision.attendancePolicy;
  if (working && (!policy || policy.companyId !== companyId || policy.id !== revision.attendancePolicyId || policy.lateGraceMinutes !== revision.lateGraceMinutes || policy.earlyLeaveGraceMinutes !== revision.earlyLeaveGraceMinutes ||
      policy.effectiveFrom.toISOString().slice(0, 10) > businessDate || (policy.effectiveTo !== null && policy.effectiveTo.toISOString().slice(0, 10) <= businessDate))) throw new Error("ATTENDANCE_POLICY_SOURCE_INVALID");
  if (!working && [revision.scheduledStartMinute, revision.scheduledEndMinute, revision.crossesMidnight, revision.unpaidBreakMinutes, revision.expectedWorkMinutes,
    revision.attendancePolicyId, revision.lateGraceMinutes, revision.earlyLeaveGraceMinutes].some(v => v !== null)) throw new Error("ATTENDANCE_HISTORY_SNAPSHOT_INVALID");
  const expectation: ResolvedAttendanceExpectation = { employeeId, businessDate, expectedDayKind: revision.expectedDayKind, attendanceRequired: working,
    scheduledStartMinute: revision.scheduledStartMinute, scheduledEndMinute: revision.scheduledEndMinute, crossesMidnight: revision.crossesMidnight,
    unpaidBreakMinutes: revision.unpaidBreakMinutes, expectedWorkMinutes: revision.expectedWorkMinutes,
    workScheduleAssignmentId: revision.workScheduleAssignmentId, workScheduleSource: revision.workScheduleSource, calendarExceptionId: revision.calendarExceptionId };
  return { expectation, policy: working ? { id: policy!.id, lateGraceMinutes: revision.lateGraceMinutes!, earlyLeaveGraceMinutes: revision.earlyLeaveGraceMinutes! } : null };
}

@Injectable()
export class PayrollAttendanceCompletenessService {
  // Existing finalization explicitly records working and non-working dates for
  // every eligible employee. Coverage is proved by these persisted snapshots,
  // never by extrapolating today's office default or treating gaps as leave.
  async collect(input: PayrollMonthDto, employees: Employee[], tx: Prisma.TransactionClient) {
    const { start, end } = monthWindow(input), ids = [...new Set(employees.map(e => e.id))];
    const records = await tx.attendanceRecord.findMany({ where: { employeeId: { in: ids }, businessDate: { gte: start, lt: end } },
      select: { id: true, employeeId: true, companyId: true, businessDate: true, revisions: { select: revisionSelect, orderBy: { revisionNo: "desc" } } },
      orderBy: [{ employeeId: "asc" }, { businessDate: "asc" }, { id: "asc" }] });
    const markers = await tx.attendanceDayFinalization.findMany({ where: { companyId: { in: [...new Set(records.map(r => r.companyId))] }, businessDate: { gte: start, lt: end } },
      select: { id: true, companyId: true, businessDate: true, finalizedAt: true, finalizedById: true } });
    const exceptions: AttendanceCompletenessBlocker[] = [], seen = new Map<string, string>();
    const evidence = records.flatMap(record => {
      const day = record.businessDate.toISOString().slice(0, 10), key = `${record.employeeId}|${day}`;
      const block = (code: string) => exceptions.push({ code, employeeId: record.employeeId, businessDate: day, message: "Monthly attendance history requires review; no deduction is inferred." });
      if (seen.has(key)) { if (seen.get(key) !== record.id) block("ATTENDANCE_EMPLOYEE_DATE_CONFLICT"); return []; }
      seen.set(key, record.id);
      const revision = [...record.revisions].sort((a, b) => b.revisionNo - a.revisionNo)[0];
      const marker = markers.find(m => m.companyId === record.companyId && m.businessDate.getTime() === record.businessDate.getTime());
      if (!revision?.finalizedAt || !revision.finalizedById || !marker?.finalizedById || !marker.finalizedAt ||
          dhakaBusinessDate(revision.finalizedAt) < day || dhakaBusinessDate(marker.finalizedAt) < day) block("ATTENDANCE_EVIDENCE_UNFINALIZED");
      if (revision) {
        if (revision.isAttendanceApplicable === false) block("ATTENDANCE_APPLICABILITY_CONFLICT");
        if (revision.presenceState === "INCOMPLETE") block("ATTENDANCE_INCOMPLETE_REQUIRES_REVIEW");
        try {
          const historical = historicalExpectation(revision, record.employeeId, record.companyId, day);
          const allowedAt = computeFinalizationAllowedAt([historical.expectation]);
          if (!marker || marker.finalizedAt < allowedAt || !revision.finalizedAt || revision.finalizedAt < allowedAt) block("ATTENDANCE_EVIDENCE_UNFINALIZED");
          const classification = evaluateAttendance(historical.expectation, { checkInAt: revision.checkInAt, checkOutAt: revision.checkOutAt }, historical.policy);
          if (Object.entries(classification).some(([field, value]) => revision[field as keyof Revision] !== value)) block("ATTENDANCE_CLASSIFICATION_MISMATCH");
        } catch (error) { block(error instanceof Error && error.message.startsWith("ATTENDANCE_") ? error.message : "ATTENDANCE_HISTORY_SNAPSHOT_INVALID"); }
      }
      if (record.revisions.some(r => r !== revision && r.revisionNo === revision?.revisionNo)) block("ATTENDANCE_REVISION_CONFLICT");
      // Relation definitions are checked above but not copied wholesale; retain
      // immutable IDs and historical expectation/classification fields only.
      const snapshot = revision ? Object.fromEntries(Object.entries(revision).filter(([field]) => !["workScheduleAssignment", "attendancePolicy", "calendarException"].includes(field))
        .map(([field, value]) => [field, value instanceof Date ? value.toISOString() : value])) : null;
      return [{ employeeId: record.employeeId, companyId: record.companyId, recordId: record.id, businessDate: day,
        markerId: marker?.id ?? null, markerFinalizedAt: marker?.finalizedAt.toISOString() ?? null, markerFinalizedById: marker?.finalizedById ?? null, revision: snapshot }];
    });
    const coverage = [...new Map(employees.map(e => [e.id, e])).values()].map(employee => {
      let expectedDates = 0;
      for (let date = new Date(start); date < end; date.setUTCDate(date.getUTCDate() + 1)) {
        const day = date.toISOString().slice(0, 10);
        if (!formalDateEligibility(employee, day)) continue;
        expectedDates++;
        if (!seen.has(`${employee.id}|${day}`)) exceptions.push({ code: "ATTENDANCE_DATE_MISSING", employeeId: employee.id, businessDate: day,
          message: "An eligible date lacks finalized working/non-working evidence; no office, absence or exemption can be inferred." });
      }
      return { employeeId: employee.id, status: expectedDates > 0 && !exceptions.some(e => e.employeeId === employee.id) ? "VERIFIED" : "BLOCKED", expectedDates,
        observedDates: evidence.filter(e => e.employeeId === employee.id).length };
    });
    return { evidence, exceptions, coverage };
  }
}
