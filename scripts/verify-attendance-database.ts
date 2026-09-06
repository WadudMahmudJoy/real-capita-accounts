import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../apps/api/src/generated/prisma/client";
import {
  assertAttendanceDevDatabase,
  databaseFingerprint,
  verificationPg,
  type VerificationPg,
} from "./attendance-verification";
import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import { WorkScheduleService } from "../apps/api/src/work-schedule/work-schedule.service";
import { AttendanceExpectationService } from "../apps/api/src/attendance/attendance-expectation.service";
import { AttendancePolicyService } from "../apps/api/src/attendance/attendance-policy.service";
import { AttendanceCalendarService } from "../apps/api/src/attendance/attendance-calendar.service";
import { AttendanceDayService } from "../apps/api/src/attendance/attendance-day.service";
import { AttendanceFinalizationService } from "../apps/api/src/attendance/attendance-finalization.service";
import { AttendanceCorrectionService } from "../apps/api/src/attendance/attendance-correction.service";
import { dhakaBusinessDate } from "../apps/api/src/attendance/attendance-time";
import { scopedPrismaFacade } from "./attendance-verification";
import type { Prisma } from "../apps/api/src/generated/prisma/client";

const prefix = `HR2C_DB_${randomUUID().replaceAll("-", "").toUpperCase().slice(0, 16)}`;
const rollback = Symbol("attendance database verification rollback");

let passed = 0;
let failed = 0;

async function check(name: string, verification: () => unknown) {
  try {
    await verification();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function seedResolverFixture(tx: Prisma.TransactionClient) {
  const companyId = `${prefix}_CO`;
  const userId = `${prefix}_U`;
  const employeeId = `${prefix}_E`;
  const scheduleId = `${prefix}_WS`;
  await tx.company.create({
    data: { id: companyId, singletonKey: companyId, name: "HR2C Verification Company" },
  });
  await tx.user.create({
    data: {
      id: userId,
      email: `${prefix.toLowerCase()}@example.invalid`,
      fullName: "HR2C Verifier",
      passwordHash: "not-a-real-hash",
    },
  });
  await tx.employee.create({
    data: {
      id: employeeId,
      employeeCode: prefix.slice(-20),
      fullName: "HR2C Employee",
      designation: "Verification",
      joiningDate: new Date("2026-01-01T00:00:00.000Z"),
    },
  });
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map(
    (dayOfWeek) =>
      dayOfWeek === "FRIDAY"
        ? { dayOfWeek, isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false }
        : { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60, crossesMidnight: false },
  );
  await tx.workSchedule.create({
    data: {
      id: scheduleId,
      companyId,
      code: prefix.slice(0, 20),
      name: "HR2C Verification Schedule",
      createdById: userId,
      days: { create: days },
    },
  });
  await tx.workScheduleAssignment.create({
    data: {
      id: `${prefix}_WSA`,
      companyId,
      scope: "COMPANY_DEFAULT",
      workScheduleId: scheduleId,
      employeeId: null,
      effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
      effectiveTo: null,
      createdById: userId,
    },
  });
  return { companyId, userId, employeeId, scheduleId };
}

async function main() {
  if (process.env.DATABASE_URL === undefined) {
    process.loadEnvFile(".env");
  }
  const connectionString = assertAttendanceDevDatabase(process.env.DATABASE_URL);
  const pg: VerificationPg = verificationPg(connectionString);
  await pg.connect();
  try {
    const before = await databaseFingerprint(pg);

    const prisma = new PrismaService();
    const service = new WorkScheduleService(prisma);
    try {
      await prisma.$transaction(async tx => {
        const fixture = await seedResolverFixture(tx);

        const txResult = await service.resolveWorkScheduleWithTx(
          tx,
          fixture.companyId,
          undefined,
          "2026-10-01",
        );
        await check("tx-aware resolver sees uncommitted assignment rows", () => {
          assert.equal(txResult.kind, "RESOLVED");
          assert.equal(txResult.source, "COMPANY_DEFAULT");
        });

        const nonTxResult = await service.resolveWorkScheduleWithTx(
          prisma as unknown as Prisma.TransactionClient,
          fixture.companyId,
          undefined,
          "2026-10-01",
        );
        await check("non-transactional resolver cannot see uncommitted rows", () => {
          assert.equal(nonTxResult.kind, "NOT_CONFIGURED");
        });

        const primary = await prisma.company.findUnique({
          where: { singletonKey: "PRIMARY" },
          select: { id: true },
        });
        await check("primary company context exists", () => {
          assert.ok(primary);
        });
        if (primary) {
          for (const businessDate of ["2026-09-10", "2026-09-11", "2026-08-31"]) {
            const publicResult = await service.resolveWorkSchedule(undefined, businessDate);
            const txAwareResult = await service.resolveWorkScheduleWithTx(
              tx,
              primary.id,
              undefined,
              businessDate,
            );
            check(`public and tx-aware resolvers agree on ${businessDate}`, () => {
              assert.deepStrictEqual(txAwareResult, publicResult);
            });
          }
        }

        const expectationService = new AttendanceExpectationService(prisma, service);
        const today = dhakaBusinessDate();

        await tx.attendancePolicy.create({
          data: {
            id: `${prefix}_POL`,
            companyId: fixture.companyId,
            effectiveFrom: new Date("2026-08-10T00:00:00.000Z"),
            effectiveTo: null,
            lateGraceMinutes: 15,
            earlyLeaveGraceMinutes: 10,
            createdById: fixture.userId,
          },
        });

        const working = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          fixture.employeeId,
          "2026-10-01",
        );
        await check("working day expectation resolves with policy", () => {
          assert.ok(working);
          assert.equal(working.expectation.expectedDayKind, "WORKING_DAY");
          assert.equal(working.expectation.attendanceRequired, true);
          assert.equal(working.expectation.scheduledStartMinute, 600);
          assert.equal(working.expectation.scheduledEndMinute, 1080);
          assert.equal(working.expectation.crossesMidnight, false);
          assert.equal(working.expectation.unpaidBreakMinutes, 60);
          assert.equal(working.expectation.expectedWorkMinutes, 420);
          assert.equal(working.expectation.workScheduleAssignmentId, `${prefix}_WSA`);
          assert.equal(working.expectation.workScheduleSource, "COMPANY_DEFAULT");
          assert.equal(working.expectation.calendarExceptionId, null);
          assert.deepEqual(working.policy, { id: `${prefix}_POL`, lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 });
        });

        const rest = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          fixture.employeeId,
          "2026-10-02",
        );
        await check("weekly rest expectation resolves without policy", () => {
          assert.ok(rest);
          assert.equal(rest.expectation.expectedDayKind, "WEEKLY_REST");
          assert.equal(rest.expectation.attendanceRequired, false);
          assert.equal(rest.policy, null);
          assert.equal(rest.expectation.workScheduleAssignmentId, `${prefix}_WSA`);
          assert.equal(rest.expectation.scheduledStartMinute, null);
          assert.equal(rest.expectation.scheduledEndMinute, null);
        });

        await check("missing work schedule is a controlled error", async () => {
          await assert.rejects(
            () => expectationService.resolveExpectationWithTx(tx, fixture.companyId, fixture.employeeId, "2026-07-25"),
            /No Work Schedule is configured for this date\./,
          );
        });

        await check("missing policy on a working day is a controlled error", async () => {
          await assert.rejects(
            () => expectationService.resolveExpectationWithTx(tx, fixture.companyId, fixture.employeeId, "2026-08-05"),
            /Attendance Rules are not configured for this date\./,
          );
        });

        await tx.companyCalendarException.create({
          data: {
            id: `${prefix}_HOL`,
            companyId: fixture.companyId,
            businessDate: new Date("2026-07-20T00:00:00.000Z"),
            exceptionType: "HOLIDAY",
            name: "Verification Holiday",
            createdById: fixture.userId,
          },
        });
        const holiday = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          fixture.employeeId,
          "2026-07-20",
        );
        await check("holiday resolves without any work schedule", () => {
          assert.ok(holiday);
          assert.equal(holiday.expectation.expectedDayKind, "HOLIDAY");
          assert.equal(holiday.expectation.attendanceRequired, false);
          assert.equal(holiday.expectation.calendarExceptionId, `${prefix}_HOL`);
          assert.equal(holiday.expectation.workScheduleAssignmentId, null);
          assert.equal(holiday.policy, null);
        });

        await tx.companyCalendarException.create({
          data: {
            id: `${prefix}_SPL`,
            companyId: fixture.companyId,
            businessDate: new Date("2026-10-02T00:00:00.000Z"),
            exceptionType: "SPECIAL_WORKING_DAY",
            name: "Verification Special Day",
            startMinuteOfDay: 540,
            endMinuteOfDay: 900,
            unpaidBreakMinutes: 30,
            crossesMidnight: false,
            createdById: fixture.userId,
          },
        });
        const special = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          fixture.employeeId,
          "2026-10-02",
        );
        await check("special working day overrides the weekly rest day", () => {
          assert.ok(special);
          assert.equal(special.expectation.expectedDayKind, "SPECIAL_WORKING_DAY");
          assert.equal(special.expectation.attendanceRequired, true);
          assert.equal(special.expectation.scheduledStartMinute, 540);
          assert.equal(special.expectation.scheduledEndMinute, 900);
          assert.equal(special.expectation.unpaidBreakMinutes, 30);
          assert.equal(special.expectation.expectedWorkMinutes, 330);
          assert.equal(special.expectation.calendarExceptionId, `${prefix}_SPL`);
          assert.equal(special.expectation.workScheduleAssignmentId, null);
          assert.equal(special.expectation.workScheduleSource, null);
          assert.deepEqual(special.policy, { id: `${prefix}_POL`, lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 });
        });

        const futureJoin = await tx.employee.create({
          data: {
            id: `${prefix}_FJ`,
            employeeCode: `${prefix.slice(0, 16)}FJ`,
            fullName: "Future Join Employee",
            designation: "Verification",
            joiningDate: new Date("2027-01-01T00:00:00.000Z"),
          },
        });
        const futureJoinExpectation = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          futureJoin.id,
          "2026-10-01",
        );
        await check("employee joining later is not eligible", () => {
          assert.equal(futureJoinExpectation, null);
        });

        const separated = await tx.employee.create({
          data: {
            id: `${prefix}_SP`,
            employeeCode: `${prefix.slice(0, 16)}SP`,
            fullName: "Separated Employee",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
            separationDate: new Date("2026-08-12T00:00:00.000Z"),
            separationReason: "Verification separation",
            isActive: false,
          },
        });
        const separatedExpectation = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          separated.id,
          "2026-08-25",
        );
        await check("separated employee is not eligible after separation", () => {
          assert.equal(separatedExpectation, null);
        });

        const separatedBefore = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          separated.id,
          "2026-08-11",
        );
        await check("separated employee stays eligible before separation on past dates", () => {
          assert.ok(separatedBefore);
          assert.equal(separatedBefore.expectation.expectedDayKind, "WORKING_DAY");
        });

        const separatedToday = await tx.employee.create({
          data: {
            id: `${prefix}_ST`,
            employeeCode: `${prefix.slice(0, 16)}ST`,
            fullName: "Separated Today Employee",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
            separationDate: new Date(`${today}T00:00:00.000Z`),
            separationReason: "Verification separation",
            isActive: false,
          },
        });
        const separatedTodayExpectation = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          separatedToday.id,
          today,
        );
        await check("separation-day employee stays eligible on the current date", () => {
          assert.ok(separatedTodayExpectation);
        });

        const inactivePast = await expectationService.resolveExpectationWithTx(
          tx,
          fixture.companyId,
          separated.id,
          today,
        );
        await check("inactive separated employee is not eligible on the current date", () => {
          assert.equal(inactivePast, null);
        });

        await tx.company.update({
          where: { singletonKey: "PRIMARY" },
          data: { singletonKey: `${prefix}_OLD_PRIMARY` },
        });
        const policyCompanyId = await tx.company.create({
          data: { id: `${prefix}_PRI`, singletonKey: "PRIMARY", name: "HR2C Policy Verification Company" },
        });

        const scoped = scopedPrismaFacade(tx as unknown as Record<PropertyKey, unknown>) as unknown as PrismaService;
        const policyService = new AttendancePolicyService(scoped);
        const actor = { id: fixture.userId } as never;

        await tx.attendancePolicy.create({
          data: {
            id: `${prefix}_F0`,
            companyId: policyCompanyId.id,
            effectiveFrom: new Date("2026-08-01T00:00:00.000Z"),
            effectiveTo: null,
            lateGraceMinutes: 10,
            earlyLeaveGraceMinutes: 5,
            cancelledAt: new Date("2026-07-20T00:00:00.000Z"),
            cancelledById: fixture.userId,
            cancellationReason: "cancelled before start",
            createdById: fixture.userId,
          },
        });

        const futureInitial = await policyService.createInitialPolicy(
          { effectiveFrom: "2026-10-01", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 },
          actor,
        );
        await check("initial policy creation ignores a cancelled-before-start predecessor", () => {
          assert.equal(futureInitial.effectiveFrom, "2026-10-01");
          assert.equal(futureInitial.cancelledAt, null);
        });

        const cancelledInitial = await policyService.cancelFuturePolicy(
          futureInitial.id,
          { cancellationReason: "wrong values" },
          actor,
        );
        await check("unstarted initial policy can be cancelled", () => {
          assert.ok(cancelledInitial.cancelledAt);
          assert.equal(cancelledInitial.cancellationReason, "wrong values");
        });

        const initial = await policyService.createInitialPolicy(
          { effectiveFrom: "2026-09-01", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 },
          actor,
        );
        await check("a new initial policy is creatable after a cancelled future initial", () => {
          assert.equal(initial.effectiveFrom, "2026-09-01");
          assert.equal(initial.lateGraceMinutes, 15);
        });

        await check("initial policy creation rejects when an uncancelled policy exists", async () => {
          await assert.rejects(
            () =>
              policyService.createInitialPolicy(
                { effectiveFrom: "2026-09-02", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 },
                actor,
              ),
            /already exists/,
          );
        });

        const replacement = await policyService.replacePolicy(
          initial.id,
          { effectiveFrom: "2026-10-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "shifted hours" },
          actor,
        );
        await check("replacement splices the predecessor boundary", async () => {
          assert.equal(replacement.effectiveFrom, "2026-10-01");
          assert.equal(replacement.effectiveTo, null);
          assert.equal(replacement.replacesPolicyId, initial.id);
          assert.equal(replacement.lateGraceMinutes, 20);
          const predecessor = await tx.attendancePolicy.findUniqueOrThrow({ where: { id: initial.id } });
          assert.equal(predecessor.effectiveTo?.toISOString().slice(0, 10), "2026-10-01");
        });

        await check("replacement date must be strictly inside the live range", async () => {
          await assert.rejects(
            () =>
              policyService.replacePolicy(
                initial.id,
                { effectiveFrom: "2026-10-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "boundary" },
                actor,
              ),
            /live range|predecessor start|already replaces/,
          );
          await assert.rejects(
            () =>
              policyService.replacePolicy(
                replacement.id,
                { effectiveFrom: "2026-10-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "boundary" },
                actor,
              ),
            /after the predecessor start/,
          );
        });

        await check("replacement must start in the future", async () => {
          await assert.rejects(
            () =>
              policyService.replacePolicy(
                initial.id,
                { effectiveFrom: "2026-09-05", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "past" },
                actor,
              ),
            /future/,
          );
        });

        await check("branching replacement is rejected", async () => {
          await assert.rejects(
            () =>
              policyService.replacePolicy(
                initial.id,
                { effectiveFrom: "2026-09-15", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "branch" },
                actor,
              ),
            /already replaces|already exists/,
          );
        });

        const secondReplacement = await policyService.replacePolicy(
          replacement.id,
          { effectiveFrom: "2027-01-01", lateGraceMinutes: 25, earlyLeaveGraceMinutes: 5, changeReason: "second shift" },
          actor,
        );
        await check("a replacement can itself be replaced", async () => {
          assert.equal(secondReplacement.replacesPolicyId, replacement.id);
          const closedFirst = await tx.attendancePolicy.findUniqueOrThrow({ where: { id: replacement.id } });
          assert.equal(closedFirst.effectiveTo?.toISOString().slice(0, 10), "2027-01-01");
        });

        await tx.attendancePolicy.update({
          where: { id: secondReplacement.id },
          data: { effectiveTo: new Date("2027-06-01T00:00:00.000Z") },
        });
        const dependent = await tx.attendancePolicy.create({
          data: {
            id: `${prefix}_B3`,
            companyId: policyCompanyId.id,
            effectiveFrom: new Date("2027-06-01T00:00:00.000Z"),
            effectiveTo: null,
            lateGraceMinutes: 15,
            earlyLeaveGraceMinutes: 10,
            replacesPolicyId: secondReplacement.id,
            changeReason: "dependent replacement",
            createdById: fixture.userId,
          },
        });

        await check("cancellation with a live dependent is rejected", async () => {
          await assert.rejects(
            () =>
              policyService.cancelFuturePolicy(
                secondReplacement.id,
                { cancellationReason: "blocked" },
                actor,
              ),
            /later replacement depends|Cancel it first/,
          );
        });

        const cancelledDependent = await policyService.cancelFuturePolicy(
          dependent.id,
          { cancellationReason: "not needed" },
          actor,
        );
        await check("dependent can be cancelled once it has no dependents", () => {
          assert.ok(cancelledDependent.cancelledAt);
        });

        await check("blank cancellation reason is rejected", async () => {
          await assert.rejects(
            () =>
              policyService.cancelFuturePolicy(
                secondReplacement.id,
                { cancellationReason: "   " },
                actor,
              ),
            /reason/i,
          );
        });

        const cancelledReplacement = await policyService.cancelFuturePolicy(
          secondReplacement.id,
          { cancellationReason: "no longer needed" },
          actor,
        );
        await check("cancel-future restores the predecessor boundary", async () => {
          assert.ok(cancelledReplacement.cancelledAt);
          assert.equal(cancelledReplacement.cancellationReason, "no longer needed");
          const predecessor = await tx.attendancePolicy.findUniqueOrThrow({ where: { id: replacement.id } });
          assert.equal(predecessor.effectiveTo, null);
        });

        await check("started policy cannot be cancelled through cancel-future", async () => {
          await assert.rejects(
            () =>
              policyService.cancelFuturePolicy(
                initial.id,
                { cancellationReason: "too late" },
                actor,
              ),
            /not started|future/,
          );
        });

        await check("already cancelled policy cannot be cancelled again", async () => {
          await assert.rejects(
            () =>
              policyService.cancelFuturePolicy(
                secondReplacement.id,
                { cancellationReason: "again" },
                actor,
              ),
            /already cancelled/,
          );
        });

        await tx.attendancePolicy.create({
          data: {
            id: `${prefix}_CO_POL`,
            companyId: fixture.companyId,
            effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
            effectiveTo: new Date("2026-08-10T00:00:00.000Z"),
            lateGraceMinutes: 15,
            earlyLeaveGraceMinutes: 10,
            createdById: fixture.userId,
          },
        });
        await check("cross-company policy access is rejected", async () => {
          await assert.rejects(
            () =>
              policyService.replacePolicy(
                `${prefix}_CO_POL`,
                { effectiveFrom: "2026-10-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "cross" },
                actor,
              ),
            /not found/i,
          );
        });

        await check("policy lifecycle audits are written", async () => {
          const actions = await tx.auditEvent.findMany({
            where: {
              action: {
                in: ["ATTENDANCE_POLICY_CREATED", "ATTENDANCE_POLICY_REPLACED", "ATTENDANCE_POLICY_FUTURE_CANCELLED"],
              },
            },
            select: { action: true, entityId: true, metadata: true },
          });
          const created = actions.filter(row => row.action === "ATTENDANCE_POLICY_CREATED");
          const replaced = actions.filter(row => row.action === "ATTENDANCE_POLICY_REPLACED");
          const cancelledEvents = actions.filter(row => row.action === "ATTENDANCE_POLICY_FUTURE_CANCELLED");
          assert.equal(created.length, 2);
          assert.equal(replaced.length, 2);
          assert.ok(cancelledEvents.length >= 3);
          for (const row of actions) {
            const metadata = JSON.stringify(row.metadata ?? {});
            assert.equal(metadata.includes("lateGrace"), false, `audit leaked policy fields: ${metadata}`);
          }
        });

        const calendarService = new AttendanceCalendarService(
          scoped,
          new AttendanceExpectationService(scoped, service),
        );

        const calendarHoliday = await calendarService.createException(
          { businessDate: "2026-11-02", exceptionType: "HOLIDAY", name: "Verification Holiday" },
          actor,
        );
        await check("holiday exception creation stores a live row", () => {
          assert.equal(calendarHoliday.businessDate, "2026-11-02");
          assert.equal(calendarHoliday.exceptionType, "HOLIDAY");
          assert.equal(calendarHoliday.startMinuteOfDay, null);
          assert.equal(calendarHoliday.endMinuteOfDay, null);
          assert.equal(calendarHoliday.unpaidBreakMinutes, 0);
          assert.equal(calendarHoliday.crossesMidnight, false);
          assert.equal(calendarHoliday.cancelledAt, null);
          assert.equal(calendarHoliday.supersededAt, null);
        });

        await check("holiday shape violations are rejected", async () => {
          await assert.rejects(
            () =>
              calendarService.createException(
                { businessDate: "2026-11-04", exceptionType: "HOLIDAY", name: "Bad", startMinuteOfDay: 600, endMinuteOfDay: 1080 },
                actor,
              ),
            /holiday/i,
          );
        });

        const calendarSpecial = await calendarService.createException(
          {
            businessDate: "2026-11-03",
            exceptionType: "SPECIAL_WORKING_DAY",
            name: "Verification Special Day",
            startMinuteOfDay: 600,
            endMinuteOfDay: 1080,
            unpaidBreakMinutes: 60,
          },
          actor,
        );
        await check("special working day creation stores the window", () => {
          assert.equal(calendarSpecial.exceptionType, "SPECIAL_WORKING_DAY");
          assert.equal(calendarSpecial.startMinuteOfDay, 600);
          assert.equal(calendarSpecial.endMinuteOfDay, 1080);
          assert.equal(calendarSpecial.unpaidBreakMinutes, 60);
          assert.equal(calendarSpecial.crossesMidnight, false);
        });

        await check("special working day shape violations are rejected", async () => {
          await assert.rejects(
            () =>
              calendarService.createException(
                { businessDate: "2026-11-05", exceptionType: "SPECIAL_WORKING_DAY", name: "Bad", startMinuteOfDay: 600, endMinuteOfDay: 600 },
                actor,
              ),
            /same minute/i,
          );
        });

        await check("duplicate live exception per date is rejected", async () => {
          await assert.rejects(
            () =>
              calendarService.createException(
                { businessDate: "2026-11-02", exceptionType: "HOLIDAY", name: "Duplicate" },
                actor,
              ),
            /already exists|overlap/i,
          );
        });

        const renamed = await calendarService.updateException(
          calendarHoliday.id,
          { name: "Renamed Holiday" },
          actor,
        );
        await check("live exception can be renamed before finalization", () => {
          assert.equal(renamed.name, "Renamed Holiday");
        });

        await check("live exception update rejects invalid shapes", async () => {
          await assert.rejects(
            () =>
              calendarService.updateException(
                calendarSpecial.id,
                { endMinuteOfDay: 540, unpaidBreakMinutes: 30 },
                actor,
              ),
            /later than it starts/i,
          );
        });

        await tx.attendanceDayFinalization.create({
          data: {
            id: `${prefix}_DF`,
            companyId: policyCompanyId.id,
            businessDate: new Date("2026-09-07T00:00:00.000Z"),
            finalizedAt: new Date("2026-09-08T00:00:00.000Z"),
            finalizedById: fixture.userId,
          },
        });
        await tx.companyCalendarException.create({
          data: {
            id: `${prefix}_FIN_EXC`,
            companyId: policyCompanyId.id,
            businessDate: new Date("2026-09-07T00:00:00.000Z"),
            exceptionType: "HOLIDAY",
            name: "Finalized Date Holiday",
            createdById: fixture.userId,
          },
        });

        await check("creating an exception on a finalized date is rejected", async () => {
          await assert.rejects(
            () =>
              calendarService.createException(
                { businessDate: "2026-09-07", exceptionType: "HOLIDAY", name: "Late" },
                actor,
              ),
            /finalized/i,
          );
        });

        await check("editing an exception on a finalized date is rejected", async () => {
          await assert.rejects(
            () =>
              calendarService.updateException(
                `${prefix}_FIN_EXC`,
                { name: "Late Edit" },
                actor,
              ),
            /finalized/i,
          );
        });

        const cancelledException = await calendarService.cancelException(
          calendarSpecial.id,
          { cancellationReason: "no longer needed" },
          actor,
        );
        await check("live exception cancellation records the reason", () => {
          assert.ok(cancelledException.cancelledAt);
          assert.equal(cancelledException.cancellationReason, "no longer needed");
        });

        await check("blank cancellation reason is rejected", async () => {
          await assert.rejects(
            () =>
              calendarService.cancelException(
                calendarHoliday.id,
                { cancellationReason: "   " },
                actor,
              ),
            /reason/i,
          );
        });

        await check("already cancelled exception cannot be cancelled again", async () => {
          await assert.rejects(
            () =>
              calendarService.cancelException(
                calendarSpecial.id,
                { cancellationReason: "again" },
                actor,
              ),
            /already cancelled/i,
          );
        });

        await tx.companyCalendarException.create({
          data: {
            id: `${prefix}_SUP_EXC`,
            companyId: policyCompanyId.id,
            businessDate: new Date("2026-11-06T00:00:00.000Z"),
            exceptionType: "HOLIDAY",
            name: "Superseded Holiday",
            supersededAt: new Date("2026-09-08T00:00:00.000Z"),
            supersededById: fixture.userId,
            createdById: fixture.userId,
          },
        });
        await check("superseded exception cannot be edited", async () => {
          await assert.rejects(
            () =>
              calendarService.updateException(
                `${prefix}_SUP_EXC`,
                { name: "Late Edit" },
                actor,
              ),
            /Only a live calendar exception/i,
          );
        });

        await tx.companyCalendarException.create({
          data: {
            id: `${prefix}_CO_EXC`,
            companyId: fixture.companyId,
            businessDate: new Date("2026-11-07T00:00:00.000Z"),
            exceptionType: "HOLIDAY",
            name: "Other Company Holiday",
            createdById: fixture.userId,
          },
        });
        await check("cross-company exception access is rejected", async () => {
          await assert.rejects(
            () =>
              calendarService.cancelException(
                `${prefix}_CO_EXC`,
                { cancellationReason: "cross" },
                actor,
              ),
            /not found/i,
          );
        });

        const listed = await calendarService.listExceptions("2026-11-01", "2026-11-30");
        await check("calendar listing returns live and historical rows", () => {
          assert.ok(listed.length >= 3);
          assert.ok(listed.some(row => row.id === calendarHoliday.id));
          assert.ok(listed.some(row => row.id === calendarSpecial.id));
          assert.ok(listed.some(row => row.id === `${prefix}_SUP_EXC`));
        });

        await check("calendar lifecycle audits are written", async () => {
          const actions = await tx.auditEvent.findMany({
            where: {
              action: {
                in: ["CALENDAR_EXCEPTION_CREATED", "CALENDAR_EXCEPTION_UPDATED", "CALENDAR_EXCEPTION_CANCELLED"],
              },
            },
            select: { action: true },
          });
          assert.equal(actions.filter(row => row.action === "CALENDAR_EXCEPTION_CREATED").length, 2);
          assert.equal(actions.filter(row => row.action === "CALENDAR_EXCEPTION_UPDATED").length, 1);
          assert.equal(actions.filter(row => row.action === "CALENDAR_EXCEPTION_CANCELLED").length, 1);
        });

        const dayService = new AttendanceDayService(
          scoped,
          new AttendanceExpectationService(scoped, service),
        );

        const priSchedule = await tx.workSchedule.create({
          data: {
            id: `${prefix}_DAYWS`,
            companyId: policyCompanyId.id,
            code: `${prefix.slice(0, 12)}DAYWS`,
            name: "HR2C Day Verification Schedule",
            createdById: fixture.userId,
            days: {
              create: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map(
                dayOfWeek =>
                  dayOfWeek === "FRIDAY"
                    ? { dayOfWeek, isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false }
                    : { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60, crossesMidnight: false },
              ),
            },
          },
        });
        const priAssignment = await tx.workScheduleAssignment.create({
          data: {
            id: `${prefix}_DAYWSA`,
            companyId: policyCompanyId.id,
            scope: "COMPANY_DEFAULT",
            workScheduleId: priSchedule.id,
            employeeId: null,
            effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
            effectiveTo: null,
            createdById: fixture.userId,
          },
        });
        const dayEmployeeA = await tx.employee.create({
          data: {
            id: `${prefix}_DA`,
            employeeCode: `${prefix.slice(0, 14)}DA`,
            fullName: "Day Employee A",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
          },
        });
        const dayEmployeeB = await tx.employee.create({
          data: {
            id: `${prefix}_DB`,
            employeeCode: `${prefix.slice(0, 14)}DB`,
            fullName: "Day Employee B",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
          },
        });

        await tx.attendanceDayFinalization.create({
          data: {
            id: `${prefix}_DAYDF`,
            companyId: policyCompanyId.id,
            businessDate: new Date("2026-09-02T00:00:00.000Z"),
            finalizedAt: new Date("2026-09-03T00:00:00.000Z"),
            finalizedById: fixture.userId,
          },
        });
        const finalizedRecordA = await tx.attendanceRecord.create({
          data: {
            id: `${prefix}_DAYRA`,
            companyId: policyCompanyId.id,
            employeeId: dayEmployeeA.id,
            businessDate: new Date("2026-09-02T00:00:00.000Z"),
          },
        });
        await tx.attendanceRevision.create({
          data: {
            id: `${prefix}_DAYVA`,
            attendanceRecordId: finalizedRecordA.id,
            revisionNo: 1,
            origin: "SYSTEM_FINALIZATION",
            isAttendanceApplicable: true,
            expectedDayKind: "WORKING_DAY",
            workScheduleAssignmentId: priAssignment.id,
            workScheduleSource: "COMPANY_DEFAULT",
            attendancePolicyId: initial.id,
            scheduledStartMinute: 600,
            scheduledEndMinute: 1080,
            crossesMidnight: false,
            unpaidBreakMinutes: 60,
            expectedWorkMinutes: 420,
            lateGraceMinutes: 15,
            earlyLeaveGraceMinutes: 10,
            timeZone: "Asia/Dhaka",
            presenceState: "ABSENT",
            isLate: false,
            isEarlyLeave: false,
            isNonWorkingDayAttendance: false,
            createdById: fixture.userId,
            finalizedById: fixture.userId,
            finalizedAt: new Date("2026-09-03T00:00:00.000Z"),
          },
        });
        const finalizedRecordB = await tx.attendanceRecord.create({
          data: {
            id: `${prefix}_DAYRB`,
            companyId: policyCompanyId.id,
            employeeId: dayEmployeeB.id,
            businessDate: new Date("2026-09-02T00:00:00.000Z"),
          },
        });
        await tx.attendanceRevision.create({
          data: {
            id: `${prefix}_DAYVB`,
            attendanceRecordId: finalizedRecordB.id,
            revisionNo: 1,
            origin: "SYSTEM_FINALIZATION",
            isAttendanceApplicable: true,
            checkInAt: new Date("2026-09-02T04:00:00.000Z"),
            checkOutAt: new Date("2026-09-02T12:00:00.000Z"),
            expectedDayKind: "WORKING_DAY",
            workScheduleAssignmentId: priAssignment.id,
            workScheduleSource: "COMPANY_DEFAULT",
            attendancePolicyId: initial.id,
            scheduledStartMinute: 600,
            scheduledEndMinute: 1080,
            crossesMidnight: false,
            unpaidBreakMinutes: 60,
            expectedWorkMinutes: 420,
            lateGraceMinutes: 15,
            earlyLeaveGraceMinutes: 10,
            timeZone: "Asia/Dhaka",
            presenceState: "PRESENT",
            isLate: false,
            isEarlyLeave: false,
            isNonWorkingDayAttendance: false,
            arrivalDelayMinutes: 0,
            earlyDepartureMinutes: 0,
            createdById: fixture.userId,
            finalizedById: fixture.userId,
            finalizedAt: new Date("2026-09-03T00:00:00.000Z"),
          },
        });

        const dayView = await dayService.getDay("2026-09-05");
        await check("day roster lists eligible employees only", () => {
          const ids = dayView.rows.map(row => row.employee.employeeId);
          for (const expectedId of [dayEmployeeA.id, dayEmployeeB.id, fixture.employeeId, separatedToday.id]) {
            assert.ok(ids.includes(expectedId), `missing eligible employee ${expectedId}`);
          }
          for (const excludedId of [futureJoin.id, separated.id]) {
            assert.equal(ids.includes(excludedId), false, `ineligible employee listed: ${excludedId}`);
          }
        });
        await check("day row exposes the privacy-safe employee projection", () => {
          const row = dayView.rows.find(item => item.employee.employeeId === dayEmployeeA.id)!;
          assert.deepEqual(Object.keys(row.employee).sort(), ["department", "employeeCode", "employeeId", "fullName"]);
        });
        await check("day summary counts only attendance-required expectations", () => {
          assert.equal(dayView.summary.expected, dayView.rows.length);
          assert.equal(dayView.summary.pending, dayView.rows.length);
          assert.equal(dayView.summary.present, 0);
          assert.equal(dayView.finalized, false);
          assert.equal(typeof dayView.finalizationAllowedAt, "string");
          assert.equal(typeof dayView.canFinalizeNow, "boolean");
        });
        await check("day row carries the resolved working window", () => {
          const row = dayView.rows.find(item => item.employee.employeeId === dayEmployeeA.id)!;
          assert.equal(row.expectedDayKind, "WORKING_DAY");
          assert.equal(row.attendanceRequired, true);
          assert.equal(row.scheduledStartMinute, 600);
          assert.equal(row.scheduledEndMinute, 1080);
          assert.equal(row.crossesMidnight, false);
          assert.deepEqual(row.status, { kind: "PENDING" });
          assert.equal(row.checkInAt, null);
          assert.equal(row.checkOutAt, null);
        });
        const restDayView = await dayService.getDay("2026-09-04");
        await check("ordinary Friday has zero expected attendance", () => {
          assert.equal(restDayView.summary.expected, 0);
          assert.ok(restDayView.rows.every(row => row.expectedDayKind === "WEEKLY_REST"));
        });

        await dayService.saveEntries(
          { businessDate: "2026-09-05", entries: [{ employeeId: dayEmployeeA.id, checkInLocalTime: "10:20", checkOutLocalTime: "18:10", note: "verified entry" }] },
          actor,
        );
        await check("bulk save creates one punch-only draft revision", async () => {
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-05T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.ok(record);
          assert.equal(record.revisions.length, 1);
          const draft = record.revisions[0];
          assert.equal(draft.revisionNo, 1);
          assert.equal(draft.origin, "MANUAL_ENTRY");
          assert.equal(draft.isAttendanceApplicable, null);
          assert.equal(draft.finalizedAt, null);
          assert.equal(draft.changeReason, null);
          assert.equal(draft.expectedDayKind, null);
          assert.equal(draft.presenceState, null);
          assert.equal(draft.checkInAt?.toISOString(), "2026-09-05T04:20:00.000Z");
          assert.equal(draft.checkOutAt?.toISOString(), "2026-09-05T12:10:00.000Z");
          assert.equal(draft.note, "verified entry");
          assert.equal(draft.createdById, fixture.userId);
        });

        const savedDay = await dayService.getDay("2026-09-05");
        const savedRow = savedDay.rows.find(row => row.employee.employeeId === dayEmployeeA.id)!;
        await check("day view derives provisional present with late flag", () => {
          assert.equal(savedRow.status.kind, "PRESENT");
          assert.equal((savedRow.status as { provisionalLate: boolean | null }).provisionalLate, true);
          assert.equal((savedRow.status as { provisionalEarlyLeave: boolean | null }).provisionalEarlyLeave, false);
          assert.equal(savedDay.summary.present, 1);
          assert.equal(savedDay.summary.late, 1);
        });

        await dayService.saveEntries(
          { businessDate: "2026-09-05", entries: [{ employeeId: dayEmployeeA.id, checkInLocalTime: "10:00", checkOutLocalTime: "18:00", expectedUpdatedAt: savedRow.expectedUpdatedAt }] },
          actor,
        );
        await check("repeated bulk save updates the same draft without new revisions", async () => {
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-05T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record?.revisions.length, 1);
          assert.equal(record?.revisions[0].checkInAt?.toISOString(), "2026-09-05T04:00:00.000Z");
        });

        await check("stale draft token is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.saveEntries(
                { businessDate: "2026-09-05", entries: [{ employeeId: dayEmployeeA.id, checkInLocalTime: "10:30", expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }] },
                actor,
              ),
            /changed|stale|review/i,
          );
        });

        await check("freshness token on a new record is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.saveEntries(
                { businessDate: "2026-09-05", entries: [{ employeeId: dayEmployeeB.id, checkInLocalTime: "10:30", expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }] },
                actor,
              ),
            /token|expected/i,
          );
        });

        await check("future punch instants are rejected", async () => {
          await assert.rejects(
            () =>
              dayService.saveEntries(
                { businessDate: today, entries: [{ employeeId: dayEmployeeA.id, checkInLocalTime: "23:59" }] },
                actor,
              ),
            /future/i,
          );
        });

        await check("equal check-in and check-out times are rejected", async () => {
          await assert.rejects(
            () =>
              dayService.saveEntries(
                { businessDate: "2026-09-05", entries: [{ employeeId: dayEmployeeB.id, checkInLocalTime: "10:00", checkOutLocalTime: "10:00" }] },
                actor,
              ),
            /equal|ambiguous|Check Out cannot/i,
          );
        });

        await dayService.saveEntries(
          { businessDate: "2026-09-03", entries: [{ employeeId: dayEmployeeB.id, checkInLocalTime: "22:00", checkOutLocalTime: "06:00" }] },
          actor,
        );
        await check("overnight check-out anchors to the next day", async () => {
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-03T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record?.revisions[0].checkOutAt?.toISOString(), "2026-09-04T00:00:00.000Z");
        });

        await check("check out without check in is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.saveEntries(
                { businessDate: "2026-09-05", entries: [{ employeeId: fixture.employeeId, checkOutLocalTime: "18:00" }] },
                actor,
              ),
            /requires a Check In/i,
          );
        });

        await check("saving attendance for an ineligible employee is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.saveEntries(
                { businessDate: "2026-09-05", entries: [{ employeeId: futureJoin.id, checkInLocalTime: "10:00" }] },
                actor,
              ),
            /eligible/i,
          );
        });

        await check("saving attendance on a finalized date is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.saveEntries(
                { businessDate: "2026-09-02", entries: [{ employeeId: dayEmployeeA.id, checkInLocalTime: "10:00" }] },
                actor,
              ),
            /finalized/i,
          );
        });

        await check("saving attendance for a future business date is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.saveEntries(
                { businessDate: "2026-09-08", entries: [{ employeeId: dayEmployeeA.id, checkInLocalTime: "10:00" }] },
                actor,
              ),
            /future/i,
          );
        });

        const needsReviewRecord = await tx.attendanceRecord.create({
          data: {
            id: `${prefix}_NRR`,
            companyId: policyCompanyId.id,
            employeeId: futureJoin.id,
            businessDate: new Date("2026-09-01T00:00:00.000Z"),
          },
        });
        await tx.attendanceRevision.create({
          data: {
            id: `${prefix}_NRV`,
            attendanceRecordId: needsReviewRecord.id,
            revisionNo: 1,
            origin: "MANUAL_ENTRY",
            checkInAt: new Date("2026-09-01T05:00:00.000Z"),
            createdById: fixture.userId,
          },
        });
        const needsReviewView = await dayService.getDay("2026-09-01");
        await check("ineligible draft entries surface as needs review", () => {
          assert.equal(needsReviewView.needsReview.length, 1);
          assert.equal(needsReviewView.needsReview[0].employee.employeeId, futureJoin.id);
          assert.ok(needsReviewView.needsReview[0].expectedUpdatedAt);
        });

        const discardDay = await dayService.getDay("2026-09-05");
        const discardRow = discardDay.rows.find(row => row.employee.employeeId === dayEmployeeA.id)!;
        await dayService.discardEntry(
          { businessDate: "2026-09-05", employeeId: dayEmployeeA.id, expectedUpdatedAt: discardRow.expectedUpdatedAt },
          actor,
        );
        await check("draft discard removes the record and revision", async () => {
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-05T00:00:00.000Z") },
          });
          assert.equal(record, null);
          const events = await tx.auditEvent.findMany({
            where: { action: "ATTENDANCE_DRAFT_DISCARDED", entityId: { not: null } },
          });
          assert.ok(events.length >= 1);
        });

        await check("stale discard token is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.discardEntry(
                { businessDate: "2026-09-03", employeeId: dayEmployeeB.id, expectedUpdatedAt: "2000-01-01T00:00:00.000Z" },
                actor,
              ),
            /changed|stale|review/i,
          );
        });

        await check("discarding on a finalized date is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.discardEntry(
                { businessDate: "2026-09-02", employeeId: dayEmployeeA.id, expectedUpdatedAt: null },
                actor,
              ),
            /finalized/i,
          );
        });

        await check("discarding a missing entry is rejected", async () => {
          await assert.rejects(
            () =>
              dayService.discardEntry(
                { businessDate: "2026-09-05", employeeId: dayEmployeeA.id, expectedUpdatedAt: null },
                actor,
              ),
            /not found/i,
          );
        });

        const finalizedView = await dayService.getDay("2026-09-02");
        await check("finalized day view shows materialized records only", () => {
          assert.equal(finalizedView.finalized, true);
          const ids = finalizedView.rows.map(row => row.employee.employeeId).sort();
          assert.deepEqual(ids, [dayEmployeeA.id, dayEmployeeB.id].sort());
          const rowA = finalizedView.rows.find(row => row.employee.employeeId === dayEmployeeA.id)!;
          assert.equal(rowA.status.kind, "FINALIZED");
          assert.equal((rowA.status as { presenceState: string }).presenceState, "ABSENT");
          const rowB = finalizedView.rows.find(row => row.employee.employeeId === dayEmployeeB.id)!;
          assert.equal((rowB.status as { presenceState: string }).presenceState, "PRESENT");
          assert.equal(finalizedView.summary.expected, 2);
          assert.equal(finalizedView.summary.present, 1);
          assert.equal(finalizedView.summary.pending, 0);
        });

        await check("entry lifecycle audits are written", async () => {
          const actions = await tx.auditEvent.findMany({
            where: { action: { in: ["ATTENDANCE_ENTRY_CREATED", "ATTENDANCE_ENTRY_UPDATED_BEFORE_FINALIZATION", "ATTENDANCE_DRAFT_DISCARDED"] } },
            select: { action: true },
          });
          assert.equal(actions.filter(row => row.action === "ATTENDANCE_ENTRY_CREATED").length, 2);
          assert.equal(actions.filter(row => row.action === "ATTENDANCE_ENTRY_UPDATED_BEFORE_FINALIZATION").length, 1);
          assert.ok(actions.filter(row => row.action === "ATTENDANCE_DRAFT_DISCARDED").length >= 1);
        });

        const finalizationService = new AttendanceFinalizationService(
          scoped,
          new AttendanceExpectationService(scoped, service),
        );

        await check("future business date cannot be finalized", async () => {
          await assert.rejects(
            () => finalizationService.finalizeDay({ businessDate: "2026-09-30" }, actor),
            /future/i,
          );
        });

        await check("normal day finalization before the expected end is blocked", async () => {
          await assert.rejects(
            () =>
              finalizationService.finalizeDay(
                { businessDate: "2026-09-09" },
                actor,
                new Date("2026-09-09T11:59:00.000Z"),
              ),
            /cannot be finalized yet|finalized after/i,
          );
          const marker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-09T00:00:00.000Z") },
          });
          assert.equal(marker, null);
        });

        await check("normal day finalization at the expected end is allowed", async () => {
          const result = await finalizationService.finalizeDay(
            { businessDate: "2026-09-09" },
            actor,
            new Date("2026-09-09T12:00:00.000Z"),
          );
          assert.equal(result.businessDate, "2026-09-09");
          assert.equal(result.summary.absent >= 1, true);
        });

        await check("double finalization is a controlled conflict", async () => {
          await assert.rejects(
            () => finalizationService.finalizeDay({ businessDate: "2026-09-09" }, actor, new Date("2026-09-10T00:00:00.000Z")),
            /already finalized/i,
          );
        });

        await check("day marker exists exactly once with the finalizing actor", async () => {
          const markers = await tx.attendanceDayFinalization.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-09T00:00:00.000Z") },
          });
          assert.equal(markers.length, 1);
          assert.equal(markers[0].finalizedById, fixture.userId);
        });

        await check("employees without drafts get born-finalized system rows", async () => {
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-09T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.ok(record);
          assert.equal(record.revisions.length, 1);
          const revision = record.revisions[0];
          assert.equal(revision.origin, "SYSTEM_FINALIZATION");
          assert.equal(revision.revisionNo, 1);
          assert.equal(revision.isAttendanceApplicable, true);
          assert.equal(revision.presenceState, "ABSENT");
          assert.equal(revision.checkInAt, null);
          assert.equal(revision.checkOutAt, null);
          assert.equal(revision.createdById, fixture.userId);
          assert.equal(revision.finalizedById, fixture.userId);
          assert.equal(revision.expectedDayKind, "WORKING_DAY");
          assert.equal(revision.scheduledStartMinute, 600);
          assert.equal(revision.scheduledEndMinute, 1080);
          assert.equal(revision.expectedWorkMinutes, 420);
          assert.equal(revision.lateGraceMinutes, 15);
          assert.equal(revision.earlyLeaveGraceMinutes, 10);
          assert.equal(revision.timeZone, "Asia/Dhaka");
          assert.equal(revision.isLate, false);
          assert.equal(revision.isEarlyLeave, false);
          assert.equal(revision.arrivalDelayMinutes, null);
          assert.equal(revision.earlyDepartureMinutes, null);
        });

        const overnightSchedule = await tx.workSchedule.create({
          data: {
            id: `${prefix}_OVWS`,
            companyId: policyCompanyId.id,
            code: `${prefix.slice(0, 12)}OVWS`,
            name: "HR2C Overnight Verification Schedule",
            createdById: fixture.userId,
            days: {
              create: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map(
                dayOfWeek =>
                  dayOfWeek === "SATURDAY"
                    ? { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 1320, endMinuteOfDay: 360, unpaidBreakMinutes: 60, crossesMidnight: true }
                    : { dayOfWeek, isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false },
              ),
            },
          },
        });
        const overnightEmployee = await tx.employee.create({
          data: {
            id: `${prefix}_OV`,
            employeeCode: `${prefix.slice(0, 14)}OV`,
            fullName: "Overnight Employee",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
          },
        });
        await tx.workScheduleAssignment.create({
          data: {
            id: `${prefix}_OVWSA`,
            companyId: policyCompanyId.id,
            scope: "EMPLOYEE_OVERRIDE",
            workScheduleId: overnightSchedule.id,
            employeeId: overnightEmployee.id,
            effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
            effectiveTo: null,
            createdById: fixture.userId,
          },
        });

        await check("past business date with an active overnight shift stays blocked", async () => {
          await assert.rejects(
            () =>
              finalizationService.finalizeDay(
                { businessDate: "2026-09-05" },
                actor,
                new Date("2026-09-05T18:30:00.000Z"),
              ),
            /cannot be finalized yet|finalized after/i,
          );
          const marker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-05T00:00:00.000Z") },
          });
          assert.equal(marker, null);
        });

        await check("overnight day finalizes at the next-day shift end", async () => {
          const result = await finalizationService.finalizeDay(
            { businessDate: "2026-09-05" },
            actor,
            new Date("2026-09-06T00:00:00.000Z"),
          );
          assert.equal(result.summary.absent >= 1, true);
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: overnightEmployee.id, businessDate: new Date("2026-09-05T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.ok(record);
          const revision = record.revisions[0];
          assert.equal(revision.presenceState, "ABSENT");
          assert.equal(revision.scheduledStartMinute, 1320);
          assert.equal(revision.scheduledEndMinute, 360);
          assert.equal(revision.crossesMidnight, true);
          assert.equal(revision.expectedWorkMinutes, 420);
          assert.equal(revision.timeZone, "Asia/Dhaka");
        });

        await check("existing draft transitions to finalized in place", async () => {
          const result = await finalizationService.finalizeDay(
            { businessDate: "2026-09-03" },
            actor,
            new Date("2026-09-04T06:00:00.000Z"),
          );
          assert.ok(result);
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-03T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.ok(record);
          assert.equal(record.revisions.length, 1);
          const revision = record.revisions[0];
          assert.equal(revision.origin, "MANUAL_ENTRY");
          assert.equal(revision.createdById, fixture.userId);
          assert.ok(revision.finalizedAt);
          assert.equal(revision.finalizedById, fixture.userId);
          assert.equal(revision.isAttendanceApplicable, true);
          assert.equal(revision.expectedDayKind, "WORKING_DAY");
          assert.equal(revision.presenceState, "PRESENT");
          assert.equal(revision.checkInAt?.toISOString(), "2026-09-03T16:00:00.000Z");
          assert.equal(revision.checkOutAt?.toISOString(), "2026-09-04T00:00:00.000Z");
          assert.equal(revision.scheduledStartMinute, 600);
          assert.equal(revision.scheduledEndMinute, 1080);
          assert.equal(revision.timeZone, "Asia/Dhaka");
          assert.equal(revision.attendancePolicyId, initial.id);
          assert.ok(typeof revision.arrivalDelayMinutes === "number");
          assert.ok(typeof revision.earlyDepartureMinutes === "number");
        });

        await check("non-required days produce not required rows", async () => {
          const result = await finalizationService.finalizeDay(
            { businessDate: "2026-09-04" },
            actor,
            new Date("2026-09-04T18:30:00.000Z"),
          );
          assert.equal(result.summary.notRequired >= 1, true);
          assert.equal(result.summary.absent, 0);
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-04T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.ok(record);
          assert.equal(record.revisions[0].presenceState, "NOT_REQUIRED");
          assert.equal(record.revisions[0].expectedDayKind, "WEEKLY_REST");
          assert.equal(record.revisions[0].attendancePolicyId, null);
          assert.equal(record.revisions[0].lateGraceMinutes, null);
          assert.equal(record.revisions[0].earlyLeaveGraceMinutes, null);
          assert.equal(record.revisions[0].scheduledStartMinute, null);
        });

        await check("zero required windows cannot finalize before the next Dhaka midnight", async () => {
          await assert.rejects(
            () =>
              finalizationService.finalizeDay(
                { businessDate: "2026-09-11" },
                actor,
                new Date("2026-09-11T17:59:00.000Z"),
              ),
            /cannot be finalized yet|finalized after/i,
          );
          const marker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-11T00:00:00.000Z") },
          });
          assert.equal(marker, null);
        });

        await check("zero required windows finalize at the next Dhaka midnight", async () => {
          const result = await finalizationService.finalizeDay(
            { businessDate: "2026-09-11" },
            actor,
            new Date("2026-09-11T18:00:00.000Z"),
          );
          assert.equal(result.summary.notRequired >= 1, true);
          assert.equal(result.summary.absent, 0);
        });

        await check("day finalization audit is written with aggregate counts only", async () => {
          const events = await tx.auditEvent.findMany({
            where: { action: "ATTENDANCE_DAY_FINALIZED" },
          });
          assert.ok(events.length >= 2);
          for (const event of events) {
            const metadata = JSON.stringify(event.metadata ?? {});
            assert.equal(metadata.includes("checkIn"), false, "audit leaked punches");
            assert.equal(metadata.includes("checkOut"), false, "audit leaked punches");
            assert.equal(metadata.includes("fullName"), false, "audit leaked employee identity");
            assert.equal(metadata.includes("employeeId"), false, "audit leaked employee identifiers");
            assert.equal(metadata.includes("note"), false, "audit leaked notes");
            assert.equal(metadata.includes("prisma"), false, "audit leaked internals");
          }
        });

        await tx.workScheduleAssignment.updateMany({
          where: { id: priAssignment.id },
          data: { effectiveFrom: new Date("2026-08-15T00:00:00.000Z") },
        });

        await check("missing policy for a required working day fails atomically", async () => {
          await assert.rejects(
            () =>
              finalizationService.finalizeDay(
                { businessDate: "2026-08-31" },
                actor,
                new Date("2026-09-01T12:00:00.000Z"),
              ),
            /Attendance Rules are not configured/i,
          );
          const marker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-08-31T00:00:00.000Z") },
          });
          assert.equal(marker, null);
          const records = await tx.attendanceRecord.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-08-31T00:00:00.000Z") },
          });
          assert.equal(records.length, 0);
        });

        await check("stranded draft for an ineligible employee blocks finalization", async () => {
          const strandedRecord = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: futureJoin.id, businessDate: new Date("2026-09-01T00:00:00.000Z") },
          });
          assert.ok(strandedRecord, "expected the stranded draft fixture to still exist");
          await assert.rejects(
            () =>
              finalizationService.finalizeDay(
                { businessDate: "2026-09-01" },
                actor,
                new Date("2026-09-02T12:00:00.000Z"),
              ),
            /not eligible on this date/i,
          );
          const marker = await tx.attendanceDayFinalization.findFirst({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-01T00:00:00.000Z") },
          });
          assert.equal(marker, null);
          const surviving = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: futureJoin.id, businessDate: new Date("2026-09-01T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.ok(surviving);
          assert.equal(surviving.revisions[0].finalizedAt, null, "stranded draft must not be finalized or discarded");
        });

        const correctionService = new AttendanceCorrectionService(
          scoped,
          new AttendanceExpectationService(scoped, service),
        );

        await check("correction on an unfinalized date is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(dayEmployeeA.id, "2026-09-01", {
                changeReason: "no marker",
                expectedRevisionNo: null,
              }, actor),
            /finalized/i,
          );
          await assert.rejects(
            () =>
              correctionService.markNotApplicable(dayEmployeeA.id, "2026-09-01", {
                changeReason: "no marker",
                expectedRevisionNo: 1,
              }, actor),
            /finalized/i,
          );
        });

        const altScheduleB = await tx.workSchedule.create({
          data: {
            id: `${prefix}_ALTB`,
            companyId: policyCompanyId.id,
            code: `${prefix.slice(0, 11)}ALTB`,
            name: "Alt Schedule B",
            createdById: fixture.userId,
            days: {
              create: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map(
                dayOfWeek =>
                  dayOfWeek === "WEDNESDAY"
                    ? { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 540, endMinuteOfDay: 1020, unpaidBreakMinutes: 30, crossesMidnight: false }
                    : dayOfWeek === "FRIDAY"
                      ? { dayOfWeek, isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false }
                      : { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60, crossesMidnight: false },
              ),
            },
          },
        });
        await tx.workScheduleAssignment.create({
          data: {
            id: `${prefix}_ALTB_WSA`,
            companyId: policyCompanyId.id,
            scope: "EMPLOYEE_OVERRIDE",
            workScheduleId: altScheduleB.id,
            employeeId: dayEmployeeB.id,
            effectiveFrom: new Date("2026-09-02T00:00:00.000Z"),
            effectiveTo: new Date("2026-09-03T00:00:00.000Z"),
            createdById: fixture.userId,
          },
        });

        const pathAResult = await correctionService.correctAttendance(
          dayEmployeeB.id,
          "2026-09-02",
          {
            checkInLocalTime: "10:30",
            checkOutLocalTime: "17:30",
            note: "corrected note",
            changeReason: "fixed times",
            expectedRevisionNo: 1,
          },
          actor,
        );
        await check("path A correction creates revision N+1 with reclassification", async () => {
          assert.ok(pathAResult);
          assert.equal(pathAResult.revisionNo, 2);
          assert.equal(pathAResult.isAttendanceApplicable, true);
          assert.equal(pathAResult.presenceState, "PRESENT");
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          assert.equal(record.revisions.length, 2);
          const revision = record.revisions[1];
          assert.equal(revision.origin, "MANUAL_CORRECTION");
          assert.equal(revision.changeReason, "fixed times");
          assert.equal(revision.createdById, fixture.userId);
          assert.equal(revision.finalizedById, fixture.userId);
          assert.ok(revision.finalizedAt);
          assert.equal(revision.isAttendanceApplicable, true);
          assert.equal(revision.presenceState, "PRESENT");
          assert.equal(revision.checkInAt?.toISOString(), "2026-09-02T04:30:00.000Z");
          assert.equal(revision.checkOutAt?.toISOString(), "2026-09-02T11:30:00.000Z");
          assert.equal(revision.note, "corrected note");
          assert.equal(revision.isLate, true);
          assert.equal(revision.isEarlyLeave, true);
          assert.equal(revision.arrivalDelayMinutes, 30);
          assert.equal(revision.earlyDepartureMinutes, 30);
        });

        await check("path A carries the prior snapshot verbatim despite live config changes", async () => {
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          const before = record.revisions[0];
          const after = record.revisions[1];
          assert.equal(after.expectedDayKind, before.expectedDayKind);
          assert.equal(after.workScheduleAssignmentId, before.workScheduleAssignmentId);
          assert.equal(after.workScheduleAssignmentId, priAssignment.id);
          assert.equal(after.workScheduleSource, before.workScheduleSource);
          assert.equal(after.calendarExceptionId, before.calendarExceptionId);
          assert.equal(after.attendancePolicyId, before.attendancePolicyId);
          assert.equal(after.scheduledStartMinute, before.scheduledStartMinute);
          assert.equal(after.scheduledStartMinute, 600);
          assert.equal(after.scheduledEndMinute, before.scheduledEndMinute);
          assert.equal(after.crossesMidnight, before.crossesMidnight);
          assert.equal(after.unpaidBreakMinutes, before.unpaidBreakMinutes);
          assert.equal(after.expectedWorkMinutes, before.expectedWorkMinutes);
          assert.equal(after.lateGraceMinutes, before.lateGraceMinutes);
          assert.equal(after.earlyLeaveGraceMinutes, before.earlyLeaveGraceMinutes);
          assert.equal(after.timeZone, before.timeZone);
          assert.equal(after.timeZone, "Asia/Dhaka");
        });

        await check("path A old finalized revision remains untouched", async () => {
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          const first = record.revisions[0];
          assert.equal(first.origin, "SYSTEM_FINALIZATION");
          assert.equal(first.presenceState, "PRESENT");
          assert.equal(first.checkInAt?.toISOString(), "2026-09-02T04:00:00.000Z");
          assert.equal(first.checkOutAt?.toISOString(), "2026-09-02T12:00:00.000Z");
          assert.equal(first.note, null);
        });

        await check("path A stale expectedRevisionNo is rejected without mutation", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                dayEmployeeB.id,
                "2026-09-02",
                { checkInLocalTime: "10:00", changeReason: "stale attempt", expectedRevisionNo: 1 },
                actor,
              ),
            /changed|stale|review/i,
          );
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record.revisions.length, 2);
        });

        await check("day marker remains untouched after corrections", async () => {
          const marker = await tx.attendanceDayFinalization.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
          });
          assert.equal(marker.finalizedById, fixture.userId);
          assert.equal(marker.finalizedAt.toISOString(), "2026-09-03T00:00:00.000Z");
        });

        const omittedEmployee = await tx.employee.create({
          data: {
            id: `${prefix}_OM`,
            employeeCode: `${prefix.slice(0, 14)}OM`,
            fullName: "Omitted Employee",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
          },
        });
        const pathBResult = await correctionService.correctAttendance(
          omittedEmployee.id,
          "2026-09-02",
          {
            checkInLocalTime: "10:00",
            checkOutLocalTime: "18:00",
            changeReason: "wrongly omitted",
            expectedRevisionNo: null,
          },
          actor,
        );
        await check("path B creates the record and revision 1 with historical resolution", async () => {
          assert.ok(pathBResult);
          assert.equal(pathBResult.revisionNo, 1);
          assert.equal(pathBResult.isAttendanceApplicable, true);
          assert.equal(pathBResult.presenceState, "PRESENT");
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: omittedEmployee.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record.revisions.length, 1);
          const revision = record.revisions[0];
          assert.equal(revision.origin, "MANUAL_CORRECTION");
          assert.equal(revision.changeReason, "wrongly omitted");
          assert.equal(revision.isAttendanceApplicable, true);
          assert.equal(revision.expectedDayKind, "WORKING_DAY");
          assert.equal(revision.workScheduleAssignmentId, priAssignment.id);
          assert.equal(revision.workScheduleSource, "COMPANY_DEFAULT");
          assert.equal(revision.calendarExceptionId, null);
          assert.equal(revision.attendancePolicyId, initial.id);
          assert.equal(revision.scheduledStartMinute, 600);
          assert.equal(revision.scheduledEndMinute, 1080);
          assert.equal(revision.crossesMidnight, false);
          assert.equal(revision.unpaidBreakMinutes, 60);
          assert.equal(revision.expectedWorkMinutes, 420);
          assert.equal(revision.lateGraceMinutes, 15);
          assert.equal(revision.earlyLeaveGraceMinutes, 10);
          assert.equal(revision.timeZone, "Asia/Dhaka");
          assert.equal(revision.presenceState, "PRESENT");
          assert.equal(revision.arrivalDelayMinutes, 0);
          assert.equal(revision.earlyDepartureMinutes, 0);
        });

        await check("path B on an existing record with a null token is a stale conflict", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                dayEmployeeA.id,
                "2026-09-02",
                { changeReason: "meanwhile created", expectedRevisionNo: null },
                actor,
              ),
            /changed|stale|review/i,
          );
        });

        await check("path B for a formally ineligible employee is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                futureJoin.id,
                "2026-09-02",
                { changeReason: "not eligible", expectedRevisionNo: null },
                actor,
              ),
            /eligible/i,
          );
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: futureJoin.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
          });
          assert.equal(record, null);
        });

        const deletedEmployee = await tx.employee.create({
          data: {
            id: `${prefix}_DEL`,
            employeeCode: `${prefix.slice(0, 14)}DEL`,
            fullName: "Deleted Employee",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
            isDeleted: true,
            isActive: false,
            deletedAt: new Date("2026-09-01T00:00:00.000Z"),
          },
        });
        await check("path B for a deleted employee is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                deletedEmployee.id,
                "2026-09-02",
                { changeReason: "deleted", expectedRevisionNo: null },
                actor,
              ),
            /eligible/i,
          );
        });

        const inactiveOmitted = await tx.employee.create({
          data: {
            id: `${prefix}_INA`,
            employeeCode: `${prefix.slice(0, 14)}INA`,
            fullName: "Inactive Omitted Employee",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
            isActive: false,
          },
        });
        const inactiveResult = await correctionService.correctAttendance(
          inactiveOmitted.id,
          "2026-09-02",
          { changeReason: "inactive but historically eligible", expectedRevisionNo: null },
          actor,
        );
        await check("path B ignores today's inactive state for historical dates", async () => {
          assert.ok(inactiveResult);
          assert.equal(inactiveResult.revisionNo, 1);
          assert.equal(inactiveResult.presenceState, "ABSENT");
        });

        await finalizationService.finalizeDay(
          { businessDate: "2025-12-16" },
          actor,
          new Date("2026-01-01T00:00:00.000Z"),
        );
        const lateHire = await tx.employee.create({
          data: {
            id: `${prefix}_LH`,
            employeeCode: `${prefix.slice(0, 14)}LH`,
            fullName: "Late Hire Employee",
            designation: "Verification",
            joiningDate: new Date("2025-12-01T00:00:00.000Z"),
          },
        });
        await check("path B with unresolvable historical configuration fails", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                lateHire.id,
                "2025-12-16",
                { changeReason: "no schedule back then", expectedRevisionNo: null },
                actor,
              ),
            /No Work Schedule is configured/i,
          );
          const record = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: lateHire.id, businessDate: new Date("2025-12-16T00:00:00.000Z") },
          });
          assert.equal(record, null);
        });

        const r5Employee = await tx.employee.create({
          data: {
            id: `${prefix}_R5`,
            employeeCode: `${prefix.slice(0, 14)}R5`,
            fullName: "R5 Employee",
            designation: "Verification",
            joiningDate: new Date("2025-12-01T00:00:00.000Z"),
          },
        });
        const r5Record = await tx.attendanceRecord.create({
          data: {
            id: `${prefix}_R5REC`,
            companyId: policyCompanyId.id,
            employeeId: r5Employee.id,
            businessDate: new Date("2025-12-16T00:00:00.000Z"),
          },
        });
        await tx.attendanceRevision.create({
          data: {
            id: `${prefix}_R5REV`,
            attendanceRecordId: r5Record.id,
            revisionNo: 1,
            origin: "MANUAL_CORRECTION",
            isAttendanceApplicable: false,
            checkInAt: new Date("2025-12-16T04:00:00.000Z"),
            checkOutAt: new Date("2025-12-16T12:00:00.000Z"),
            note: "void evidence",
            changeReason: "historically voided",
            createdById: fixture.userId,
            finalizedById: fixture.userId,
            finalizedAt: new Date("2026-01-02T00:00:00.000Z"),
          },
        });
        await check("restore with unresolvable historical configuration rolls back", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                r5Employee.id,
                "2025-12-16",
                { changeReason: "cannot restore", expectedRevisionNo: 1 },
                actor,
              ),
            /No Work Schedule is configured/i,
          );
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: r5Employee.id, businessDate: new Date("2025-12-16T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record.revisions.length, 1);
          assert.equal(record.revisions[0].isAttendanceApplicable, false);
          assert.equal(record.revisions[0].checkInAt?.toISOString(), "2025-12-16T04:00:00.000Z");
        });

        await check("void without formal ineligibility proof is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.markNotApplicable(
                dayEmployeeA.id,
                "2026-09-02",
                { changeReason: "no proof", expectedRevisionNo: 1 },
                actor,
              ),
            /not applicable|proof/i,
          );
        });

        await tx.employee.update({
          where: { id: dayEmployeeA.id },
          data: { joiningDate: new Date("2026-09-05T00:00:00.000Z") },
        });
        const voidResult = await correctionService.markNotApplicable(
          dayEmployeeA.id,
          "2026-09-02",
          { changeReason: "joined after this date", expectedRevisionNo: 1 },
          actor,
        );
        await check("void with a joining-date proof creates the void revision", async () => {
          assert.ok(voidResult);
          assert.equal(voidResult.revisionNo, 2);
          assert.equal(voidResult.isAttendanceApplicable, false);
          assert.equal(voidResult.presenceState, null);
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          assert.equal(record.revisions.length, 2);
          const revision = record.revisions[1];
          assert.equal(revision.origin, "MANUAL_CORRECTION");
          assert.equal(revision.isAttendanceApplicable, false);
          assert.equal(revision.changeReason, "joined after this date");
          assert.equal(revision.presenceState, null);
          assert.equal(revision.expectedDayKind, null);
          assert.equal(revision.timeZone, null);
          assert.equal(revision.workScheduleAssignmentId, null);
          assert.equal(revision.workScheduleSource, null);
          assert.equal(revision.calendarExceptionId, null);
          assert.equal(revision.attendancePolicyId, null);
          assert.equal(revision.scheduledStartMinute, null);
          assert.equal(revision.scheduledEndMinute, null);
          assert.equal(revision.crossesMidnight, null);
          assert.equal(revision.unpaidBreakMinutes, null);
          assert.equal(revision.expectedWorkMinutes, null);
          assert.equal(revision.lateGraceMinutes, null);
          assert.equal(revision.earlyLeaveGraceMinutes, null);
          assert.equal(revision.isLate, null);
          assert.equal(revision.isEarlyLeave, null);
          assert.equal(revision.isNonWorkingDayAttendance, null);
          assert.equal(revision.arrivalDelayMinutes, null);
          assert.equal(revision.earlyDepartureMinutes, null);
          assert.equal(revision.createdById, fixture.userId);
          assert.equal(revision.finalizedById, fixture.userId);
          assert.ok(revision.finalizedAt);
        });

        await check("double void is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.markNotApplicable(
                dayEmployeeA.id,
                "2026-09-02",
                { changeReason: "again", expectedRevisionNo: 2 },
                actor,
              ),
            /already|not applicable/i,
          );
        });

        const voidedDayView = await dayService.getDay("2026-09-02");
        await check("latest void is excluded from current interpretation", async () => {
          const rowA = voidedDayView.rows.find(row => row.employee.employeeId === dayEmployeeA.id);
          assert.ok(rowA);
          assert.equal(rowA.status.kind, "NOT_APPLICABLE");
          assert.equal(
            voidedDayView.rows.some(row => row.employee.employeeId === dayEmployeeA.id && row.status.kind === "FINALIZED"),
            false,
          );
        });

        await check("restore while still ineligible is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                dayEmployeeA.id,
                "2026-09-02",
                { changeReason: "still ineligible", expectedRevisionNo: 2 },
                actor,
              ),
            /eligible/i,
          );
        });

        await tx.employee.update({
          where: { id: dayEmployeeA.id },
          data: { joiningDate: new Date("2026-01-01T00:00:00.000Z") },
        });
        const altScheduleA = await tx.workSchedule.create({
          data: {
            id: `${prefix}_ALTA`,
            companyId: policyCompanyId.id,
            code: `${prefix.slice(0, 11)}ALTA`,
            name: "Alt Schedule A",
            createdById: fixture.userId,
            days: {
              create: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"].map(
                dayOfWeek =>
                  dayOfWeek === "WEDNESDAY"
                    ? { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 570, endMinuteOfDay: 1050, unpaidBreakMinutes: 30, crossesMidnight: false }
                    : dayOfWeek === "FRIDAY"
                      ? { dayOfWeek, isWorkingDay: false, startMinuteOfDay: null, endMinuteOfDay: null, unpaidBreakMinutes: 0, crossesMidnight: false }
                      : { dayOfWeek, isWorkingDay: true, startMinuteOfDay: 600, endMinuteOfDay: 1080, unpaidBreakMinutes: 60, crossesMidnight: false },
              ),
            },
          },
        });
        await tx.workScheduleAssignment.create({
          data: {
            id: `${prefix}_ALTA_WSA`,
            companyId: policyCompanyId.id,
            scope: "EMPLOYEE_OVERRIDE",
            workScheduleId: altScheduleA.id,
            employeeId: dayEmployeeA.id,
            effectiveFrom: new Date("2026-09-02T00:00:00.000Z"),
            effectiveTo: new Date("2026-09-03T00:00:00.000Z"),
            createdById: fixture.userId,
          },
        });
        const restoreResult = await correctionService.correctAttendance(
          dayEmployeeA.id,
          "2026-09-02",
          { changeReason: "restored employee", expectedRevisionNo: 2 },
          actor,
        );
        await check("restore re-resolves the historical expectation instead of carrying the void", async () => {
          assert.ok(restoreResult);
          assert.equal(restoreResult.revisionNo, 3);
          assert.equal(restoreResult.isAttendanceApplicable, true);
          assert.equal(restoreResult.presenceState, "ABSENT");
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          assert.equal(record.revisions.length, 3);
          const revision = record.revisions[2];
          assert.equal(revision.origin, "MANUAL_CORRECTION");
          assert.equal(revision.isAttendanceApplicable, true);
          assert.equal(revision.expectedDayKind, "WORKING_DAY");
          assert.equal(revision.workScheduleAssignmentId, `${prefix}_ALTA_WSA`);
          assert.equal(revision.scheduledStartMinute, 570);
          assert.equal(revision.scheduledEndMinute, 1050);
          assert.equal(revision.expectedWorkMinutes, 450);
          assert.equal(revision.attendancePolicyId, initial.id);
          assert.equal(revision.lateGraceMinutes, 15);
          assert.equal(revision.timeZone, "Asia/Dhaka");
          assert.equal(revision.presenceState, "ABSENT");
          assert.equal(revision.checkInAt, null);
          assert.equal(revision.checkOutAt, null);
        });

        await tx.employee.update({
          where: { id: dayEmployeeB.id },
          data: { separationDate: new Date("2026-09-01T00:00:00.000Z"), separationReason: "Verification separation", isActive: false },
        });
        const voidBResult = await correctionService.markNotApplicable(
          dayEmployeeB.id,
          "2026-09-02",
          { changeReason: "separated before this date", expectedRevisionNo: 2 },
          actor,
        );
        await check("void with a separation proof preserves punches and note", async () => {
          assert.ok(voidBResult);
          assert.equal(voidBResult.revisionNo, 3);
          assert.equal(voidBResult.isAttendanceApplicable, false);
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          const revision = record.revisions[2];
          assert.equal(revision.isAttendanceApplicable, false);
          assert.equal(revision.presenceState, null);
          assert.equal(revision.expectedDayKind, null);
          assert.equal(revision.checkInAt?.toISOString(), "2026-09-02T04:30:00.000Z");
          assert.equal(revision.checkOutAt?.toISOString(), "2026-09-02T11:30:00.000Z");
          assert.equal(revision.note, "corrected note");
          assert.equal(revision.isLate, null);
          assert.equal(revision.arrivalDelayMinutes, null);
        });

        await tx.employee.update({
          where: { id: dayEmployeeB.id },
          data: { separationDate: null, separationReason: null },
        });
        const restoreBResult = await correctionService.correctAttendance(
          dayEmployeeB.id,
          "2026-09-02",
          { changeReason: "restored employee B", expectedRevisionNo: 3 },
          actor,
        );
        await check("restore without punches preserves the void punches and note", async () => {
          assert.ok(restoreBResult);
          assert.equal(restoreBResult.revisionNo, 4);
          assert.equal(restoreBResult.isAttendanceApplicable, true);
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          const revision = record.revisions[3];
          assert.equal(revision.isAttendanceApplicable, true);
          assert.equal(revision.checkInAt?.toISOString(), "2026-09-02T04:30:00.000Z");
          assert.equal(revision.checkOutAt?.toISOString(), "2026-09-02T11:30:00.000Z");
          assert.equal(revision.note, "corrected note");
          assert.equal(revision.presenceState, "PRESENT");
          assert.equal(revision.workScheduleAssignmentId, `${prefix}_ALTB_WSA`);
          assert.equal(revision.scheduledStartMinute, 540);
          assert.equal(revision.scheduledEndMinute, 1020);
          assert.equal(revision.arrivalDelayMinutes, 90);
          assert.equal(revision.earlyDepartureMinutes, 0);
          assert.equal(revision.isLate, true);
          assert.equal(revision.isEarlyLeave, false);
        });

        await tx.employee.update({
          where: { id: dayEmployeeA.id },
          data: { joiningDate: new Date("2026-09-05T00:00:00.000Z") },
        });
        await correctionService.markNotApplicable(
          dayEmployeeA.id,
          "2026-09-02",
          { changeReason: "void again for provided punches", expectedRevisionNo: 3 },
          actor,
        );
        await tx.employee.update({
          where: { id: dayEmployeeA.id },
          data: { joiningDate: new Date("2026-01-01T00:00:00.000Z") },
        });
        const providedPunchesResult = await correctionService.correctAttendance(
          dayEmployeeA.id,
          "2026-09-02",
          {
            checkInLocalTime: "10:15",
            checkOutLocalTime: "17:45",
            changeReason: "restored with corrected punches",
            expectedRevisionNo: 4,
          },
          actor,
        );
        await check("restore with provided punches validates and uses them", async () => {
          assert.ok(providedPunchesResult);
          assert.equal(providedPunchesResult.revisionNo, 5);
          assert.equal(providedPunchesResult.presenceState, "PRESENT");
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          const revision = record.revisions[4];
          assert.equal(revision.checkInAt?.toISOString(), "2026-09-02T04:15:00.000Z");
          assert.equal(revision.checkOutAt?.toISOString(), "2026-09-02T11:45:00.000Z");
          assert.equal(revision.presenceState, "PRESENT");
          assert.equal(revision.workScheduleAssignmentId, `${prefix}_ALTA_WSA`);
          assert.equal(revision.scheduledStartMinute, 570);
          assert.equal(revision.arrivalDelayMinutes, 45);
          assert.equal(revision.earlyDepartureMinutes, 0);
          assert.equal(revision.isLate, true);
          assert.equal(revision.isEarlyLeave, false);
        });

        const futurePunchEmployee = await tx.employee.create({
          data: {
            id: `${prefix}_FP`,
            employeeCode: `${prefix.slice(0, 14)}FP`,
            fullName: "Future Punch Employee",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
          },
        });
        await tx.attendanceDayFinalization.create({
          data: {
            id: `${prefix}_FPDF`,
            companyId: policyCompanyId.id,
            businessDate: new Date("2026-09-10T00:00:00.000Z"),
            finalizedAt: new Date("2026-09-11T00:00:00.000Z"),
            finalizedById: fixture.userId,
          },
        });
        const futureRecord = await tx.attendanceRecord.create({
          data: {
            id: `${prefix}_FPREC`,
            companyId: policyCompanyId.id,
            employeeId: futurePunchEmployee.id,
            businessDate: new Date("2026-09-10T00:00:00.000Z"),
          },
        });
        await tx.attendanceRevision.create({
          data: {
            id: `${prefix}_FPREV`,
            attendanceRecordId: futureRecord.id,
            revisionNo: 1,
            origin: "MANUAL_CORRECTION",
            isAttendanceApplicable: true,
            expectedDayKind: "WORKING_DAY",
            workScheduleAssignmentId: priAssignment.id,
            workScheduleSource: "COMPANY_DEFAULT",
            attendancePolicyId: initial.id,
            scheduledStartMinute: 600,
            scheduledEndMinute: 1080,
            crossesMidnight: false,
            unpaidBreakMinutes: 60,
            expectedWorkMinutes: 420,
            lateGraceMinutes: 15,
            earlyLeaveGraceMinutes: 10,
            timeZone: "Asia/Dhaka",
            presenceState: "ABSENT",
            isLate: false,
            isEarlyLeave: false,
            isNonWorkingDayAttendance: false,
            changeReason: "fixture",
            createdById: fixture.userId,
            finalizedById: fixture.userId,
            finalizedAt: new Date("2026-09-11T00:00:00.000Z"),
          },
        });
        await check("correction with future punch instants is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                futurePunchEmployee.id,
                "2026-09-10",
                { checkInLocalTime: "10:00", checkOutLocalTime: "18:00", changeReason: "future", expectedRevisionNo: 1 },
                actor,
              ),
            /future/i,
          );
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: futurePunchEmployee.id, businessDate: new Date("2026-09-10T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record.revisions.length, 1);
        });

        await check("correction with equal check-in and check-out is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                dayEmployeeA.id,
                "2026-09-02",
                { checkInLocalTime: "10:00", checkOutLocalTime: "10:00", changeReason: "equal", expectedRevisionNo: 5 },
                actor,
              ),
            /equal|Check Out cannot/i,
          );
        });

        await check("correction with check out but no check in is rejected", async () => {
          await assert.rejects(
            () =>
              correctionService.correctAttendance(
                futurePunchEmployee.id,
                "2026-09-10",
                { checkOutLocalTime: "17:00", changeReason: "out only", expectedRevisionNo: 1 },
                actor,
              ),
            /requires a Check In/i,
          );
        });

        await check("revision numbers increase monotonically", async () => {
          const recordA = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          assert.deepEqual(recordA.revisions.map(row => row.revisionNo), [1, 2, 3, 4, 5]);
          const recordB = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          assert.deepEqual(recordB.revisions.map(row => row.revisionNo), [1, 2, 3, 4]);
        });

        await check("correction audits are written with allowlisted metadata only", async () => {
          const events = await tx.auditEvent.findMany({
            where: { action: "ATTENDANCE_CORRECTED" },
            select: { entityId: true, metadata: true },
          });
          assert.ok(events.length >= 9);
          const allowedKeys = new Set(["businessDate", "employeeId", "revisionNo", "isAttendanceApplicable"]);
          for (const event of events) {
            const metadata = (event.metadata ?? {}) as Record<string, unknown>;
            for (const key of Object.keys(metadata)) {
              assert.ok(allowedKeys.has(key), `unexpected audit metadata key: ${key}`);
            }
            const serialized = JSON.stringify(metadata);
            assert.equal(serialized.includes("corrected note"), false, "audit leaked notes");
            assert.equal(serialized.includes("fixed times"), false, "audit leaked change reasons");
            assert.equal(serialized.includes("checkIn"), false, "audit leaked punches");
            assert.equal(serialized.includes("Omitted Employee"), false, "audit leaked employee identity");
            assert.equal(serialized.includes("prisma"), false, "audit leaked internals");
          }
        });

        const auditFailControl = { armed: true };
        const auditFailingScoped = new Proxy(scoped, {
          get(target: Record<PropertyKey, unknown>, property: string | symbol, receiver: unknown) {
            if (property === "$transaction") {
              const original = target["$transaction"] as (work: (inner: unknown) => Promise<unknown>, options?: unknown) => Promise<unknown>;
              return (work: (inner: unknown) => Promise<unknown>, options?: unknown) =>
                original((inner: unknown) =>
                  work(
                    new Proxy(inner as Record<PropertyKey, unknown>, {
                      get(innerTarget: Record<PropertyKey, unknown>, innerProperty: string | symbol) {
                        if (innerProperty === "auditEvent" && auditFailControl.armed) {
                          return {
                            create: async () => {
                              auditFailControl.armed = false;
                              throw new Error("FORCED_AUDIT_FAILURE");
                            },
                          };
                        }
                        return Reflect.get(innerTarget, innerProperty, innerTarget);
                      },
                    }),
                  ),
                options);
            }
            return Reflect.get(target, property, receiver);
          },
        });
        const auditFailingCorrections = new AttendanceCorrectionService(
          auditFailingScoped as unknown as PrismaService,
          new AttendanceExpectationService(auditFailingScoped as unknown as PrismaService, service),
        );
        await check("forced audit failure rolls back the whole correction", async () => {
          await assert.rejects(
            () =>
              auditFailingCorrections.correctAttendance(
                dayEmployeeB.id,
                "2026-09-02",
                { changeReason: "audit failure", expectedRevisionNo: 4 },
                actor,
              ),
          );
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record.revisions.length, 4);
        });

        const calendarCorrectionService = calendarService;

        await check("historical correction on an unfinalized date is rejected", async () => {
          await assert.rejects(
            () =>
              calendarCorrectionService.historicalCorrect(
                { businessDate: "2026-09-06", target: "HOLIDAY", name: "Unfinalized Holiday", changeReason: "not finalized" },
                actor,
              ),
            /finalized/i,
          );
        });

        await check("historical correction with NONE target and no live exception is rejected", async () => {
          await assert.rejects(
            () =>
              calendarCorrectionService.historicalCorrect(
                { businessDate: "2026-09-09", target: "NONE", changeReason: "nothing to remove" },
                actor,
              ),
            /no live calendar exception/i,
          );
        });

        await tx.companyCalendarException.create({
          data: {
            id: `${prefix}_HC141`,
            companyId: policyCompanyId.id,
            businessDate: new Date("2026-09-14T00:00:00.000Z"),
            exceptionType: "HOLIDAY",
            name: "Original Holiday",
            createdById: fixture.userId,
          },
        });
        await finalizationService.finalizeDay(
          { businessDate: "2026-09-14" },
          actor,
          new Date("2026-09-15T00:00:00.000Z"),
        );
        await check("holiday-finalized fixture produces not required records", async () => {
          const recordA = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-14T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.ok(recordA);
          assert.equal(recordA.revisions[0].presenceState, "NOT_REQUIRED");
          assert.equal(recordA.revisions[0].expectedDayKind, "HOLIDAY");
          assert.equal(recordA.revisions[0].calendarExceptionId, `${prefix}_HC141`);
          assert.equal(recordA.revisions[0].attendancePolicyId, null);
        });

        const nameOnlyResult = await calendarCorrectionService.historicalCorrect(
          { businessDate: "2026-09-14", target: "HOLIDAY", name: "Renamed Verification Holiday", changeReason: "spelling fix" },
          actor,
        );
        await check("holiday name-only correction creates zero attendance revisions", async () => {
          assert.equal(nameOnlyResult.attendanceRevisionsCreated, 0);
          const events = await tx.auditEvent.findMany({
            where: { action: "CALENDAR_EXCEPTION_HISTORICAL_CORRECTED" },
          });
          assert.equal(events.length, 1);
        });

        await check("name-only replacement preserves the old row except lineage fields", async () => {
          const exceptions = await tx.companyCalendarException.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-14T00:00:00.000Z") },
          });
          assert.equal(exceptions.length, 2);
          const original = exceptions.find(row => row.replacesExceptionId === null)!;
          const replacement = exceptions.find(row => row.replacesExceptionId !== null)!;
          assert.equal(original.name, "Original Holiday");
          assert.ok(original.supersededAt);
          assert.equal(original.supersededById, fixture.userId);
          assert.equal(original.cancelledAt, null);
          assert.equal(original.changeReason, null);
          assert.equal(original.cancellationReason, null);
          assert.equal(replacement.name, "Renamed Verification Holiday");
          assert.equal(replacement.replacesExceptionId, original.id);
          assert.equal(replacement.changeReason, "spelling fix");
          assert.equal(replacement.cancelledAt, null);
          assert.equal(replacement.supersededAt, null);
          assert.equal(replacement.createdById, fixture.userId);
          assert.equal(replacement.businessDate.toISOString(), original.businessDate.toISOString());
          assert.equal(replacement.companyId, original.companyId);
          const live = exceptions.filter(row => row.supersededAt === null && row.cancelledAt === null);
          assert.equal(live.length, 1);
          assert.equal(live[0].id, replacement.id);
        });

        const firstReplacement = (
          await tx.companyCalendarException.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-14T00:00:00.000Z"), supersededAt: null, cancelledAt: null },
          })
        ).id;

        await check("id-only change with equal semantics creates zero attendance revisions", async () => {
          const result = await calendarCorrectionService.historicalCorrect(
            { businessDate: "2026-09-14", target: "HOLIDAY", name: "Renamed Verification Holiday", changeReason: "id only refresh" },
            actor,
          );
          assert.equal(result.attendanceRevisionsCreated, 0);
          const live = await tx.companyCalendarException.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-14T00:00:00.000Z"), supersededAt: null, cancelledAt: null },
          });
          assert.equal(live.length, 1);
          assert.notEqual(live[0].id, firstReplacement);
          assert.equal(live[0].name, "Renamed Verification Holiday");
        });

        const voidTargetEmployee = await tx.employee.create({
          data: {
            id: `${prefix}_VT`,
            employeeCode: `${prefix.slice(0, 14)}VT`,
            fullName: "Void Target Employee",
            designation: "Verification",
            joiningDate: new Date("2026-09-05T00:00:00.000Z"),
          },
        });
        const voidTargetRecord = await tx.attendanceRecord.create({
          data: {
            id: `${prefix}_VTREC`,
            companyId: policyCompanyId.id,
            employeeId: voidTargetEmployee.id,
            businessDate: new Date("2026-09-02T00:00:00.000Z"),
          },
        });
        await tx.attendanceRevision.create({
          data: {
            id: `${prefix}_VTREV`,
            attendanceRecordId: voidTargetRecord.id,
            revisionNo: 1,
            origin: "MANUAL_CORRECTION",
            isAttendanceApplicable: false,
            checkInAt: new Date("2026-09-02T05:00:00.000Z"),
            checkOutAt: new Date("2026-09-02T12:00:00.000Z"),
            note: "void target note",
            changeReason: "voided before calendar correction",
            createdById: fixture.userId,
            finalizedById: fixture.userId,
            finalizedAt: new Date("2026-09-03T00:00:00.000Z"),
          },
        });

        const specialResult = await calendarCorrectionService.historicalCorrect(
          {
            businessDate: "2026-09-02",
            target: "SPECIAL_WORKING_DAY",
            name: "Corrected Special Day",
            startMinuteOfDay: 540,
            endMinuteOfDay: 1020,
            unpaidBreakMinutes: 30,
            changeReason: "converted to working day",
          },
          actor,
        );
        await check("inserted special working day re-evaluates attendance materially", async () => {
          assert.ok(specialResult.attendanceRevisionsCreated >= 1);
          const liveSpecial = await tx.companyCalendarException.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-02T00:00:00.000Z"), supersededAt: null, cancelledAt: null },
          });
          assert.equal(liveSpecial.exceptionType, "SPECIAL_WORKING_DAY");
          assert.equal(liveSpecial.name, "Corrected Special Day");
          assert.equal(liveSpecial.changeReason, "converted to working day");
          assert.equal(liveSpecial.startMinuteOfDay, 540);
          assert.equal(liveSpecial.endMinuteOfDay, 1020);
          assert.equal(liveSpecial.unpaidBreakMinutes, 30);

          const recordB = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });
          const latestB = recordB.revisions[0];
          assert.equal(latestB.origin, "MANUAL_CORRECTION");
          assert.equal(latestB.isAttendanceApplicable, true);
          assert.equal(latestB.changeReason, "converted to working day");
          assert.equal(latestB.expectedDayKind, "SPECIAL_WORKING_DAY");
          assert.equal(latestB.calendarExceptionId, liveSpecial.id);
          assert.equal(latestB.workScheduleAssignmentId, null);
          assert.equal(latestB.scheduledStartMinute, 540);
          assert.equal(latestB.scheduledEndMinute, 1020);
          assert.equal(latestB.crossesMidnight, false);
          assert.equal(latestB.unpaidBreakMinutes, 30);
          assert.equal(latestB.expectedWorkMinutes, 450);
          assert.equal(latestB.attendancePolicyId, initial.id);
          assert.equal(latestB.lateGraceMinutes, 15);
          assert.equal(latestB.earlyLeaveGraceMinutes, 10);
          assert.equal(latestB.timeZone, "Asia/Dhaka");
          assert.equal(latestB.presenceState, "PRESENT");
          assert.equal(latestB.checkInAt?.toISOString(), "2026-09-02T04:30:00.000Z");
          assert.equal(latestB.checkOutAt?.toISOString(), "2026-09-02T11:30:00.000Z");
          assert.equal(latestB.note, "corrected note");
          assert.equal(latestB.arrivalDelayMinutes, 90);
          assert.equal(latestB.earlyDepartureMinutes, 0);
          assert.equal(latestB.isLate, true);
          assert.equal(latestB.isEarlyLeave, false);
          assert.equal(latestB.finalizedById, fixture.userId);
          assert.ok(latestB.finalizedAt);

          const recordA = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });
          const latestA = recordA.revisions[0];
          assert.equal(latestA.expectedDayKind, "SPECIAL_WORKING_DAY");
          assert.equal(latestA.presenceState, "PRESENT");
          assert.equal(latestA.checkInAt?.toISOString(), "2026-09-02T04:15:00.000Z");
          assert.equal(latestA.checkOutAt?.toISOString(), "2026-09-02T11:45:00.000Z");
          assert.equal(latestA.arrivalDelayMinutes, 75);
          assert.equal(latestA.isLate, true);
          assert.equal(latestA.isEarlyLeave, false);

          const recordOM = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: omittedEmployee.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });
          assert.equal(recordOM.revisions[0].presenceState, "PRESENT");
          assert.equal(recordOM.revisions[0].expectedDayKind, "SPECIAL_WORKING_DAY");
          assert.equal(recordOM.revisions[0].checkInAt?.toISOString(), "2026-09-02T04:00:00.000Z");
          assert.equal(recordOM.revisions[0].checkOutAt?.toISOString(), "2026-09-02T12:00:00.000Z");
          assert.equal(recordOM.revisions[0].arrivalDelayMinutes, 60);
          assert.equal(recordOM.revisions[0].isLate, true);
          assert.equal(recordOM.revisions[0].isEarlyLeave, false);
        });

        await check("void latest revisions are skipped by re-evaluation", async () => {
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: voidTargetEmployee.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record.revisions.length, 1);
          const revision = record.revisions[0];
          assert.equal(revision.isAttendanceApplicable, false);
          assert.equal(revision.checkInAt?.toISOString(), "2026-09-02T05:00:00.000Z");
          assert.equal(revision.checkOutAt?.toISOString(), "2026-09-02T12:00:00.000Z");
          assert.equal(revision.note, "void target note");
          assert.equal(revision.changeReason, "voided before calendar correction");
        });

        await check("prior finalized revision remains untouched after re-evaluation", async () => {
          const recordB = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          const restored = recordB.revisions.find(revision => revision.changeReason === "restored employee B");
          assert.ok(restored);
          assert.equal(restored.checkInAt?.toISOString(), "2026-09-02T04:30:00.000Z");
          assert.equal(restored.checkOutAt?.toISOString(), "2026-09-02T11:30:00.000Z");
          assert.equal(restored.note, "corrected note");
          assert.ok(restored.finalizedAt);
        });

        await check("historical correction day marker remains unchanged", async () => {
          const marker = await tx.attendanceDayFinalization.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
          });
          assert.equal(marker.finalizedById, fixture.userId);
          assert.equal(marker.finalizedAt.toISOString(), "2026-09-03T00:00:00.000Z");
        });

        const noneResult = await calendarCorrectionService.historicalCorrect(
          { businessDate: "2026-09-02", target: "NONE", changeReason: "back to schedule" },
          actor,
        );
        await check("target NONE cancels the live exception and re-resolves HR-2B", async () => {
          assert.ok(noneResult.attendanceRevisionsCreated >= 1);
          const live = await tx.companyCalendarException.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-02T00:00:00.000Z"), supersededAt: null, cancelledAt: null },
          });
          assert.equal(live.length, 0);
          const cancelled = await tx.companyCalendarException.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-02T00:00:00.000Z"), cancelledAt: { not: null } },
          });
          assert.equal(cancelled.length, 1);
          assert.equal(cancelled[0].cancelledById, fixture.userId);
          assert.equal(cancelled[0].cancellationReason, "back to schedule");
          assert.equal(cancelled[0].supersededAt, null);

          const recordB = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });
          const latestB = recordB.revisions[0];
          assert.equal(latestB.changeReason, "back to schedule");
          assert.equal(latestB.expectedDayKind, "WORKING_DAY");
          assert.equal(latestB.workScheduleAssignmentId, `${prefix}_ALTB_WSA`);
          assert.equal(latestB.calendarExceptionId, null);
          assert.equal(latestB.scheduledStartMinute, 540);
          assert.equal(latestB.presenceState, "PRESENT");
          assert.equal(latestB.checkInAt?.toISOString(), "2026-09-02T04:30:00.000Z");
          assert.equal(latestB.checkOutAt?.toISOString(), "2026-09-02T11:30:00.000Z");
          assert.equal(latestB.note, "corrected note");
          assert.equal(latestB.arrivalDelayMinutes, 90);
          assert.equal(latestB.isLate, true);
          assert.equal(latestB.isEarlyLeave, false);

          const recordA = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeA.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });
          const latestA = recordA.revisions[0];
          assert.equal(latestA.expectedDayKind, "WORKING_DAY");
          assert.equal(latestA.workScheduleAssignmentId, `${prefix}_ALTA_WSA`);
          assert.equal(latestA.scheduledStartMinute, 570);
          assert.equal(latestA.presenceState, "PRESENT");
          assert.equal(latestA.arrivalDelayMinutes, 45);
          assert.equal(latestA.isLate, true);
          assert.equal(latestA.isEarlyLeave, false);
        });

        await tx.companyCalendarException.create({
          data: {
            id: `${prefix}_HC111`,
            companyId: policyCompanyId.id,
            businessDate: new Date("2026-09-11T00:00:00.000Z"),
            exceptionType: "HOLIDAY",
            name: "Rest Day Mistake Holiday",
            createdById: fixture.userId,
          },
        });
        await check("target NONE on a rest-resolving date requires no policy", async () => {
          const result = await calendarCorrectionService.historicalCorrect(
            { businessDate: "2026-09-11", target: "NONE", changeReason: "restore weekly rest" },
            actor,
          );
          assert.ok(result.attendanceRevisionsCreated >= 0);
          const live = await tx.companyCalendarException.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-11T00:00:00.000Z"), supersededAt: null, cancelledAt: null },
          });
          assert.equal(live.length, 0);
          const recordE = await tx.attendanceRecord.findFirst({
            where: { companyId: policyCompanyId.id, employeeId: fixture.employeeId, businessDate: new Date("2026-09-11T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "desc" } } },
          });
          if (recordE) {
            const latestE = recordE.revisions[0];
            if (latestE.changeReason === "restore weekly rest") {
              assert.equal(latestE.expectedDayKind, "WEEKLY_REST");
              assert.equal(latestE.attendancePolicyId, null);
              assert.equal(latestE.lateGraceMinutes, null);
              assert.equal(latestE.presenceState, "NOT_REQUIRED");
            } else {
              assert.equal(latestE.expectedDayKind, "WEEKLY_REST");
            }
          }
        });

        await tx.attendancePolicy.update({
          where: { id: initial.id },
          data: { effectiveTo: new Date("2026-09-08T00:00:00.000Z") },
        });
        await check("working correction without historical policy rolls back fully", async () => {
          await assert.rejects(
            () =>
              calendarCorrectionService.historicalCorrect(
                {
                  businessDate: "2026-09-09",
                  target: "SPECIAL_WORKING_DAY",
                  name: "Policy Missing Special",
                  startMinuteOfDay: 600,
                  endMinuteOfDay: 1080,
                  unpaidBreakMinutes: 60,
                  changeReason: "no policy",
                },
                actor,
              ),
            /Attendance Rules are not configured/i,
          );
          const live = await tx.companyCalendarException.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-09T00:00:00.000Z"), supersededAt: null, cancelledAt: null },
          });
          assert.equal(live.length, 0);
          const revisions = await tx.attendanceRevision.findMany({
            where: { attendanceRecord: { businessDate: new Date("2026-09-09T00:00:00.000Z"), companyId: policyCompanyId.id }, changeReason: "no policy" },
          });
          assert.equal(revisions.length, 0);
          const events = await tx.auditEvent.findMany({
            where: {
              action: "CALENDAR_EXCEPTION_HISTORICAL_CORRECTED",
              metadata: { path: ["businessDate"], equals: "2026-09-09" },
            },
          });
          assert.equal(events.length, 0);
        });
        await tx.attendancePolicy.update({
          where: { id: initial.id },
          data: { effectiveTo: new Date(`${replacement.effectiveFrom}T00:00:00.000Z`) },
        });

        const atomicityEmployee = await tx.employee.create({
          data: {
            id: `${prefix}_AT`,
            employeeCode: `${prefix.slice(0, 14)}AT`,
            fullName: "Atomicity Employee",
            designation: "Verification",
            joiningDate: new Date("2026-01-01T00:00:00.000Z"),
          },
        });
        const atomicityRecord = await tx.attendanceRecord.create({
          data: {
            id: `${prefix}_ATREC`,
            companyId: policyCompanyId.id,
            employeeId: atomicityEmployee.id,
            businessDate: new Date("2026-09-02T00:00:00.000Z"),
          },
        });
        await tx.attendanceRevision.create({
          data: {
            id: `${prefix}_ATREV`,
            attendanceRecordId: atomicityRecord.id,
            revisionNo: 1,
            origin: "SYSTEM_FINALIZATION",
            isAttendanceApplicable: true,
            expectedDayKind: "WORKING_DAY",
            workScheduleAssignmentId: priAssignment.id,
            workScheduleSource: "COMPANY_DEFAULT",
            attendancePolicyId: initial.id,
            scheduledStartMinute: 600,
            scheduledEndMinute: 1080,
            crossesMidnight: false,
            unpaidBreakMinutes: 60,
            expectedWorkMinutes: 420,
            lateGraceMinutes: 15,
            earlyLeaveGraceMinutes: 10,
            timeZone: "Asia/Dhaka",
            presenceState: "ABSENT",
            isLate: false,
            isEarlyLeave: false,
            isNonWorkingDayAttendance: false,
            createdById: fixture.userId,
            finalizedById: fixture.userId,
            finalizedAt: new Date("2026-09-03T00:00:00.000Z"),
          },
        });

        const calendarAuditFailControl = { armed: true };
        const calendarAuditFailingScoped = new Proxy(scoped, {
          get(target: Record<PropertyKey, unknown>, property: string | symbol, receiver: unknown) {
            if (property === "$transaction") {
              const original = target["$transaction"] as (work: (inner: unknown) => Promise<unknown>, options?: unknown) => Promise<unknown>;
              return (work: (inner: unknown) => Promise<unknown>, options?: unknown) =>
                original((inner: unknown) =>
                  work(
                    new Proxy(inner as Record<PropertyKey, unknown>, {
                      get(innerTarget: Record<PropertyKey, unknown>, innerProperty: string | symbol) {
                        if (innerProperty === "auditEvent" && calendarAuditFailControl.armed) {
                          return {
                            create: async () => {
                              calendarAuditFailControl.armed = false;
                              throw new Error("FORCED_AUDIT_FAILURE");
                            },
                          };
                        }
                        return Reflect.get(innerTarget, innerProperty, innerTarget);
                      },
                    }),
                  ),
                options);
            }
            return Reflect.get(target, property, receiver);
          },
        });
        const calendarAuditFailingCalendar = new AttendanceCalendarService(
          calendarAuditFailingScoped as unknown as PrismaService,
          new AttendanceExpectationService(calendarAuditFailingScoped as unknown as PrismaService, service),
        );
        await check("forced audit failure rolls back the whole historical correction", async () => {
          await assert.rejects(
            () =>
              calendarAuditFailingCalendar.historicalCorrect(
                { businessDate: "2026-09-02", target: "HOLIDAY", name: "Audit Failure Holiday", changeReason: "audit failure" },
                actor,
              ),
          );
          const live = await tx.companyCalendarException.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-02T00:00:00.000Z"), supersededAt: null, cancelledAt: null },
          });
          assert.equal(live.length, 0);
          const revisions = await tx.attendanceRevision.findMany({
            where: { attendanceRecord: { businessDate: new Date("2026-09-02T00:00:00.000Z"), companyId: policyCompanyId.id }, changeReason: "audit failure" },
          });
          assert.equal(revisions.length, 0);
          const record = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: atomicityEmployee.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: true },
          });
          assert.equal(record.revisions.length, 1);
          assert.equal(record.revisions[0].presenceState, "ABSENT");
        });

        await check("historical correction audits contain allowlisted metadata only", async () => {
          const events = await tx.auditEvent.findMany({
            where: { action: { in: ["CALENDAR_EXCEPTION_HISTORICAL_CORRECTED", "ATTENDANCE_CORRECTED"] } },
            select: { action: true, metadata: true },
          });
          const calendarEvents = events.filter(row => row.action === "CALENDAR_EXCEPTION_HISTORICAL_CORRECTED");
          assert.equal(calendarEvents.length, 5);
          const calendarAllowed = new Set(["businessDate", "target", "calendarExceptionId", "attendanceRevisionsCreated"]);
          for (const event of calendarEvents) {
            const metadata = (event.metadata ?? {}) as Record<string, unknown>;
            for (const key of Object.keys(metadata)) {
              assert.ok(calendarAllowed.has(key), `unexpected calendar audit key: ${key}`);
            }
            const serialized = JSON.stringify(metadata);
            assert.equal(serialized.includes("spelling fix"), false, "audit leaked reason text");
            assert.equal(serialized.includes("checkIn"), false, "audit leaked punches");
            assert.equal(serialized.includes("note"), false, "audit leaked notes");
            assert.equal(serialized.includes("prisma"), false, "audit leaked internals");
            assert.equal(serialized.includes("Employee"), false, "audit leaked employee identity");
          }
          const attendanceEvents = events.filter(row => row.action === "ATTENDANCE_CORRECTED");
          assert.ok(attendanceEvents.length >= 15);
        });

        await check("records are processed deterministically by employeeId", async () => {
          const records = await tx.attendanceRecord.findMany({
            where: { companyId: policyCompanyId.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            orderBy: { employeeId: "asc" },
            select: { employeeId: true },
          });
          assert.ok(records.length >= 6);
          const specialRevisions = await tx.attendanceRevision.findMany({
            where: {
              attendanceRecord: { businessDate: new Date("2026-09-02T00:00:00.000Z"), companyId: policyCompanyId.id },
              changeReason: "converted to working day",
            },
            select: { attendanceRecord: { select: { employeeId: true } } },
          });
          const processedIds = specialRevisions.map(row => row.attendanceRecord.employeeId);
          assert.deepEqual(processedIds, [...processedIds].sort());
          const applicableIds = records
            .map(row => row.employeeId)
            .filter(id => id !== voidTargetEmployee.id && id !== atomicityEmployee.id);
          assert.deepEqual(processedIds, applicableIds);
        });

        await check("revision numbers increase monotonically across calendar corrections", async () => {
          const recordB = await tx.attendanceRecord.findFirstOrThrow({
            where: { companyId: policyCompanyId.id, employeeId: dayEmployeeB.id, businessDate: new Date("2026-09-02T00:00:00.000Z") },
            include: { revisions: { orderBy: { revisionNo: "asc" } } },
          });
          const numbers = recordB.revisions.map(row => row.revisionNo);
          for (let index = 1; index < numbers.length; index += 1) {
            assert.equal(numbers[index], numbers[index - 1] + 1);
          }
          assert.ok(numbers.length >= 6);
        });

      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    await prisma.$disconnect();
  }

    const after = await databaseFingerprint(pg);
    await check("database fingerprint unchanged after verification", () => {
      assert.deepStrictEqual(after, before);
    });
    let residue = 0;
    for (const table of Object.keys(after)) {
      const identifier = `"${table.replaceAll('"', '""')}"`;
      const result = await pg.query(
        `SELECT count(*)::text AS count FROM public.${identifier} t WHERE row_to_json(t)::text LIKE $1`,
        [`%${prefix}%`],
      );
      residue += Number(result.rows[0].count);
    }
    await check("verifier residue zero", () => {
      assert.equal(residue, 0);
    });
  } finally {
    await pg.end();
  }

  console.log(`Attendance database verification: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(
    `Attendance database verification aborted: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
