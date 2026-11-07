import "reflect-metadata";
import assert from "node:assert/strict";
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ACCOUNTANT_ROLE, ROLES_METADATA_KEY } from "../apps/api/src/auth/auth.constants";
import { AuthModule } from "../apps/api/src/auth/auth.module";
import { AuthGuard } from "../apps/api/src/auth/guards/auth.guard";
import { RolesGuard } from "../apps/api/src/auth/guards/roles.guard";
import { PrismaModule } from "../apps/api/src/prisma/prisma.module";
import { AppModule } from "../apps/api/src/app.module";
import { WorkScheduleModule } from "../apps/api/src/work-schedule/work-schedule.module";
import { AttendanceModule } from "../apps/api/src/attendance/attendance.module";
import { AttendanceController } from "../apps/api/src/attendance/attendance.controller";
import { AttendancePolicyController } from "../apps/api/src/attendance/attendance-policy.controller";
import { AttendanceCalendarController } from "../apps/api/src/attendance/attendance-calendar.controller";
import {
  AttendanceDayQueryDto,
  AttendanceEntryDto,
  BulkAttendanceSaveDto,
  DiscardAttendanceEntryDto,
  FinalizeAttendanceDayDto,
  ListAttendanceHistoryQueryDto,
} from "../apps/api/src/attendance/dto/attendance-day.dto";
import { CorrectAttendanceDto, MarkNotApplicableDto } from "../apps/api/src/attendance/dto/attendance-correction.dto";
import {
  CancelFutureAttendancePolicyDto,
  CreateInitialAttendancePolicyDto,
  ReplaceAttendancePolicyDto,
} from "../apps/api/src/attendance/dto/attendance-policy.dto";
import {
  CancelCalendarExceptionDto,
  CreateCalendarExceptionDto,
  HistoricalCalendarCorrectionDto,
  UpdateCalendarExceptionDto,
} from "../apps/api/src/attendance/dto/attendance-calendar.dto";

let passed = 0;
let failed = 0;

function check(name: string, verification: () => unknown): void {
  try {
    verification();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

type ServiceCall = { service: string; method: string; args: unknown[]; result: unknown };

const calls: ServiceCall[] = [];

function proxyService(service: string): unknown {
  return new Proxy(
    {},
    {
      get: (_target, property) =>
        (...args: unknown[]) => {
          const result = { service, method: String(property) };
          calls.push({ service, method: String(property), args, result });
          return result;
        },
    },
  );
}

const dayService = proxyService("day");
const finalizationService = proxyService("finalization");
const correctionService = proxyService("correction");
const policyService = proxyService("policy");
const calendarService = proxyService("calendar");

const attendanceRoutes = [
  ["getDay", "day", RequestMethod.GET],
  ["saveEntries", "entries", RequestMethod.PUT],
  ["discardEntry", "entries/discard", RequestMethod.POST],
  ["finalizeDay", "finalize", RequestMethod.POST],
  ["listHistory", "history", RequestMethod.GET],
  ["getHistoryDetail", "history/:employeeId/:businessDate", RequestMethod.GET],
  ["correctAttendance", "history/:employeeId/:businessDate/corrections", RequestMethod.POST],
  ["markNotApplicable", "history/:employeeId/:businessDate/not-applicable", RequestMethod.POST],
] as const;

const policyRoutes = [
  ["listPolicies", "/", RequestMethod.GET],
  ["createInitialPolicy", "/", RequestMethod.POST],
  ["replacePolicy", ":id/replace", RequestMethod.POST],
  ["cancelFuturePolicy", ":id/cancel-future", RequestMethod.POST],
] as const;

const calendarRoutes = [
  ["listExceptions", "/", RequestMethod.GET],
  ["createException", "exceptions", RequestMethod.POST],
  ["historicalCorrect", "historical-corrections", RequestMethod.POST],
  ["updateException", "exceptions/:id", RequestMethod.PATCH],
  ["cancelException", "exceptions/:id/cancel", RequestMethod.POST],
] as const;

function controllerChecks(
  label: string,
  controllerClass: Function,
  baseName: string,
  routes: ReadonlyArray<readonly [string, string, RequestMethod]>,
): void {
  check(`${label} controller base path`, () => {
    assert.equal(Reflect.getMetadata(PATH_METADATA, controllerClass), baseName);
  });
  check(`${label} controller requires the ACCOUNTANT role`, () => {
    assert.deepEqual(Reflect.getMetadata(ROLES_METADATA_KEY, controllerClass), [ACCOUNTANT_ROLE]);
  });
  check(`${label} controller applies AuthGuard and RolesGuard`, () => {
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, controllerClass), [AuthGuard, RolesGuard]);
  });
  check(`${label} controller declares exactly ${routes.length} routes in safe order`, () => {
    const prototype = controllerClass.prototype as unknown as Record<string, Function>;
    const decorated = Object.getOwnPropertyNames(prototype).filter(
      name => name !== "constructor" && Reflect.hasMetadata(METHOD_METADATA, prototype[name]),
    );
    assert.deepEqual(decorated, routes.map(([name]) => name), "route declaration order must be static-before-parameterized");
  });
  for (const [name, path, method] of routes) {
    check(`${label} ${name} maps ${method === RequestMethod.GET ? "GET" : method === RequestMethod.POST ? "POST" : method === RequestMethod.PUT ? "PUT" : "PATCH"} ${baseName === "" ? "/" : `/${path}`}`, () => {
      const prototype = controllerClass.prototype as unknown as Record<string, Function>;
      const handler = prototype[name];
      assert.ok(typeof handler === "function", `${name} handler must exist`);
      assert.equal(Reflect.getMetadata(PATH_METADATA, handler), path, `${name} path`);
      assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), method, `${name} verb`);
      assert.notEqual(method, RequestMethod.DELETE, "DELETE routes are forbidden");
    });
  }
}

controllerChecks("attendance", AttendanceController, "attendance", attendanceRoutes);
controllerChecks("policy", AttendancePolicyController, "attendance/policies", policyRoutes);
controllerChecks("calendar", AttendanceCalendarController, "attendance/calendar", calendarRoutes);

check("read routes set Cache-Control no-store", () => {
  const attendancePrototype = AttendanceController.prototype as unknown as Record<string, Function>;
  const policyPrototype = AttendancePolicyController.prototype as unknown as Record<string, Function>;
  const calendarPrototype = AttendanceCalendarController.prototype as unknown as Record<string, Function>;
  const expected = [{ name: "Cache-Control", value: "no-store" }];
  for (const [controller, name] of [
    [attendancePrototype, "getDay"],
    [attendancePrototype, "listHistory"],
    [attendancePrototype, "getHistoryDetail"],
    [policyPrototype, "listPolicies"],
    [calendarPrototype, "listExceptions"],
  ] as Array<[Record<string, Function>, string]>) {
    assert.deepEqual(Reflect.getMetadata(HEADERS_METADATA, controller[name]), expected, `${name} cache header`);
  }
});

check("module registers the three attendance controllers", () => {
  assert.deepEqual(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AttendanceModule), [
    AttendanceController,
    AttendancePolicyController,
    AttendanceCalendarController,
  ]);
  assert.deepEqual(Reflect.getMetadata(MODULE_METADATA.IMPORTS, AttendanceModule), [AuthModule, PrismaModule, WorkScheduleModule]);
  assert.deepEqual(
    Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AttendanceModule).map((item: Function) => item.name),
    [
      "AttendanceExpectationService",
      "AttendancePolicyService",
      "AttendanceCalendarService",
      "AttendanceDayService",
      "AttendanceFinalizationService",
      "AttendanceCorrectionService",
    ],
  );
  assert.deepEqual(
    Reflect.getMetadata(MODULE_METADATA.EXPORTS, AttendanceModule).map((item: Function) => item.name),
    [
      "AttendanceExpectationService",
      "AttendancePolicyService",
      "AttendanceCalendarService",
      "AttendanceDayService",
      "AttendanceFinalizationService",
      "AttendanceCorrectionService",
    ],
  );
  const appImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];
  assert.equal(appImports.filter(item => item === AttendanceModule).length, 1);
});

const user = { id: "user-1", email: "accountant@example.test", role: ACCOUNTANT_ROLE };

const attendanceController = new AttendanceController(
  dayService as never,
  finalizationService as never,
  correctionService as never,
) as unknown as Record<string, (...args: never[]) => unknown>;

const policyController = new AttendancePolicyController(
  policyService as never,
) as unknown as Record<string, (...args: never[]) => unknown>;

const calendarController = new AttendanceCalendarController(
  calendarService as never,
) as unknown as Record<string, (...args: never[]) => unknown>;

function wiringCase(
  name: string,
  controller: Record<string, (...args: never[]) => unknown>,
  controllerMethod: string,
  args: unknown[],
  expected: { service: string; method: string; args: unknown[] },
): void {
  check(name, () => {
    const handler = controller[controllerMethod];
    assert.ok(typeof handler === "function", `${controllerMethod} must exist before wiring can be verified`);
    calls.length = 0;
    const result = handler.apply(controller, args as never[]);
    assert.equal(calls.length, 1, "exactly one service call");
    assert.deepEqual(calls[0], { ...expected, result });
  });
}

wiringCase("day wiring passes parsed filters", attendanceController, "getDay", [{ businessDate: "2026-09-05" }], {
  service: "day",
  method: "getDay",
  args: ["2026-09-05", { departmentId: undefined, search: undefined }],
});
wiringCase("day wiring forwards filters", attendanceController, "getDay", [{ businessDate: "2026-09-05", departmentId: "dep-1", search: "Ali" }], {
  service: "day",
  method: "getDay",
  args: ["2026-09-05", { departmentId: "dep-1", search: "Ali" }],
});
wiringCase("bulk save wiring forwards the actor", attendanceController, "saveEntries", [{ businessDate: "2026-09-05", entries: [{ employeeId: "emp-1" }] }, user], {
  service: "day",
  method: "saveEntries",
  args: [{ businessDate: "2026-09-05", entries: [{ employeeId: "emp-1" }] }, user],
});
wiringCase("discard wiring forwards the actor", attendanceController, "discardEntry", [{ businessDate: "2026-09-05", employeeId: "emp-1", expectedUpdatedAt: "2026-09-06T00:00:00.000Z" }, user], {
  service: "day",
  method: "discardEntry",
  args: [{ businessDate: "2026-09-05", employeeId: "emp-1", expectedUpdatedAt: "2026-09-06T00:00:00.000Z" }, user],
});
wiringCase("finalize wiring forwards the actor", attendanceController, "finalizeDay", [{ businessDate: "2026-09-05" }, user], {
  service: "finalization",
  method: "finalizeDay",
  args: [{ businessDate: "2026-09-05" }, user],
});
wiringCase("history list wiring forwards the query", attendanceController, "listHistory", [{ from: "2026-09-01", to: "2026-09-30" }], {
  service: "day",
  method: "listHistory",
  args: [{ from: "2026-09-01", to: "2026-09-30" }],
});
wiringCase("history detail wiring forwards path parameters", attendanceController, "getHistoryDetail", ["emp-1", "2026-09-05"], {
  service: "day",
  method: "getHistoryDetail",
  args: ["emp-1", "2026-09-05"],
});
wiringCase("correction wiring forwards the actor", attendanceController, "correctAttendance", ["emp-1", "2026-09-05", { changeReason: "fixed", expectedRevisionNo: 2 }, user], {
  service: "correction",
  method: "correctAttendance",
  args: ["emp-1", "2026-09-05", { changeReason: "fixed", expectedRevisionNo: 2 }, user],
});
wiringCase("not-applicable wiring forwards the actor", attendanceController, "markNotApplicable", ["emp-1", "2026-09-05", { changeReason: "ineligible", expectedRevisionNo: 2 }, user], {
  service: "correction",
  method: "markNotApplicable",
  args: ["emp-1", "2026-09-05", { changeReason: "ineligible", expectedRevisionNo: 2 }, user],
});
wiringCase("policy list wiring", policyController, "listPolicies", [], {
  service: "policy",
  method: "listPolicies",
  args: [],
});
wiringCase("initial policy wiring forwards the actor", policyController, "createInitialPolicy", [{ effectiveFrom: "2026-09-01", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 }, user], {
  service: "policy",
  method: "createInitialPolicy",
  args: [{ effectiveFrom: "2026-09-01", lateGraceMinutes: 15, earlyLeaveGraceMinutes: 10 }, user],
});
wiringCase("policy replace wiring forwards the actor", policyController, "replacePolicy", ["pol-1", { effectiveFrom: "2026-10-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "shift" }, user], {
  service: "policy",
  method: "replacePolicy",
  args: ["pol-1", { effectiveFrom: "2026-10-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5, changeReason: "shift" }, user],
});
wiringCase("policy cancel-future wiring forwards the actor", policyController, "cancelFuturePolicy", ["pol-1", { cancellationReason: "not needed" }, user], {
  service: "policy",
  method: "cancelFuturePolicy",
  args: ["pol-1", { cancellationReason: "not needed" }, user],
});
wiringCase("calendar list wiring forwards the range", calendarController, "listExceptions", [{ from: "2026-09-01", to: "2026-09-30" }], {
  service: "calendar",
  method: "listExceptions",
  args: ["2026-09-01", "2026-09-30"],
});
wiringCase("calendar create wiring forwards the actor", calendarController, "createException", [{ businessDate: "2026-11-02", exceptionType: "HOLIDAY", name: "Holiday" }, user], {
  service: "calendar",
  method: "createException",
  args: [{ businessDate: "2026-11-02", exceptionType: "HOLIDAY", name: "Holiday" }, user],
});
wiringCase("calendar patch wiring forwards the actor", calendarController, "updateException", ["exc-1", { name: "Renamed" }, user], {
  service: "calendar",
  method: "updateException",
  args: ["exc-1", { name: "Renamed" }, user],
});
wiringCase("calendar cancel wiring forwards the actor", calendarController, "cancelException", ["exc-1", { cancellationReason: "not needed" }, user], {
  service: "calendar",
  method: "cancelException",
  args: ["exc-1", { cancellationReason: "not needed" }, user],
});
wiringCase("historical correction wiring forwards the actor", calendarController, "historicalCorrect", [{ businessDate: "2026-09-05", target: "NONE", changeReason: "back to schedule" }, user], {
  service: "calendar",
  method: "historicalCorrect",
  args: [{ businessDate: "2026-09-05", target: "NONE", changeReason: "back to schedule" }, user],
});

function dtoErrors(cls: Function, value: Record<string, unknown>) {
  const instance = plainToInstance(cls as never, value);
  return validateSync(instance as never, {
    whitelist: true,
    forbidNonWhitelisted: true,
    validationError: { target: false },
  });
}

function flattened(errors: unknown[]): string {
  return JSON.stringify(errors);
}

check("day query DTO requires a business date", () => {
  const errors = dtoErrors(AttendanceDayQueryDto, {});
  assert.ok(errors.length > 0);
  assert.ok(flattened(errors).includes("businessDate"));
});
check("day query DTO accepts a valid query", () => {
  assert.equal(dtoErrors(AttendanceDayQueryDto, { businessDate: "2026-09-05" }).length, 0);
});
check("bulk save DTO requires entries", () => {
  const errors = dtoErrors(BulkAttendanceSaveDto, { businessDate: "2026-09-05" });
  assert.ok(flattened(errors).includes("entries"));
});
check("bulk save DTO rejects invalid local times", () => {
  const errors = dtoErrors(BulkAttendanceSaveDto, {
    businessDate: "2026-09-05",
    entries: [{ employeeId: "emp-1", checkInLocalTime: "9:30" }],
  });
  assert.ok(flattened(errors).includes("checkInLocalTime"));
});
check("bulk save DTO rejects oversized arrays", () => {
  const entries = Array.from({ length: 501 }, () => ({ employeeId: "emp-1" }));
  const errors = dtoErrors(BulkAttendanceSaveDto, { businessDate: "2026-09-05", entries });
  assert.ok(flattened(errors).includes("entries"));
});
check("entry DTO validates required fields", () => {
  const errors = dtoErrors(AttendanceEntryDto, {});
  assert.ok(flattened(errors).includes("employeeId"));
});
check("discard DTO requires all fields", () => {
  const errors = dtoErrors(DiscardAttendanceEntryDto, {});
  const text = flattened(errors);
  assert.ok(text.includes("businessDate"));
  assert.ok(text.includes("employeeId"));
  assert.ok(text.includes("expectedUpdatedAt"));
});
check("finalize DTO requires a business date", () => {
  assert.ok(flattened(dtoErrors(FinalizeAttendanceDayDto, {})).includes("businessDate"));
});
check("history query DTO requires from and to", () => {
  const errors = dtoErrors(ListAttendanceHistoryQueryDto, {});
  const text = flattened(errors);
  assert.ok(text.includes("from"));
  assert.ok(text.includes("to"));
});
check("history query DTO restricts presence states", () => {
  const errors = dtoErrors(ListAttendanceHistoryQueryDto, { from: "2026-09-01", to: "2026-09-30", presenceState: "SOMETHING" });
  assert.ok(flattened(errors).includes("presenceState"));
});
check("correction DTO requires a change reason", () => {
  assert.ok(flattened(dtoErrors(CorrectAttendanceDto, {})).includes("changeReason"));
});
check("correction DTO accepts the Path B null token", () => {
  assert.equal(dtoErrors(CorrectAttendanceDto, { changeReason: "restored", expectedRevisionNo: null }).length, 0);
});
check("correction DTO accepts a revision token", () => {
  assert.equal(dtoErrors(CorrectAttendanceDto, { changeReason: "fixed", expectedRevisionNo: 2 }).length, 0);
});
check("not-applicable DTO requires both fields", () => {
  const errors = dtoErrors(MarkNotApplicableDto, {});
  const text = flattened(errors);
  assert.ok(text.includes("changeReason"));
  assert.ok(text.includes("expectedRevisionNo"));
});
check("initial policy DTO requires effective date and graces", () => {
  const errors = dtoErrors(CreateInitialAttendancePolicyDto, {});
  const text = flattened(errors);
  assert.ok(text.includes("effectiveFrom"));
  assert.ok(text.includes("lateGraceMinutes"));
  assert.ok(text.includes("earlyLeaveGraceMinutes"));
});
check("initial policy DTO rejects negative grace", () => {
  const errors = dtoErrors(CreateInitialAttendancePolicyDto, { effectiveFrom: "2026-09-01", lateGraceMinutes: -1, earlyLeaveGraceMinutes: 10 });
  assert.ok(flattened(errors).includes("lateGraceMinutes"));
});
check("replace policy DTO requires a change reason", () => {
  const errors = dtoErrors(ReplaceAttendancePolicyDto, { effectiveFrom: "2026-10-01", lateGraceMinutes: 20, earlyLeaveGraceMinutes: 5 });
  assert.ok(flattened(errors).includes("changeReason"));
});
check("cancel-future DTO requires a cancellation reason", () => {
  assert.ok(flattened(dtoErrors(CancelFutureAttendancePolicyDto, {})).includes("cancellationReason"));
});
check("calendar create DTO requires type and name", () => {
  const errors = dtoErrors(CreateCalendarExceptionDto, { businessDate: "2026-11-02" });
  const text = flattened(errors);
  assert.ok(text.includes("exceptionType"));
  assert.ok(text.includes("name"));
});
check("calendar create DTO restricts exception types", () => {
  const errors = dtoErrors(CreateCalendarExceptionDto, { businessDate: "2026-11-02", exceptionType: "PARTIAL", name: "Day" });
  assert.ok(flattened(errors).includes("exceptionType"));
});
check("calendar DTOs validate minute bounds", () => {
  const errors = dtoErrors(CreateCalendarExceptionDto, {
    businessDate: "2026-11-02",
    exceptionType: "SPECIAL_WORKING_DAY",
    name: "Day",
    startMinuteOfDay: 1440,
  });
  assert.ok(flattened(errors).includes("startMinuteOfDay"));
});
check("historical correction DTO requires target and reason", () => {
  const errors = dtoErrors(HistoricalCalendarCorrectionDto, { businessDate: "2026-09-05" });
  const text = flattened(errors);
  assert.ok(text.includes("target"));
  assert.ok(text.includes("changeReason"));
});
check("historical correction DTO accepts NONE", () => {
  assert.equal(
    dtoErrors(HistoricalCalendarCorrectionDto, { businessDate: "2026-09-05", target: "NONE", changeReason: "back to schedule" }).length,
    0,
  );
});
check("historical correction DTO restricts targets", () => {
  const errors = dtoErrors(HistoricalCalendarCorrectionDto, { businessDate: "2026-09-05", target: "SOMETHING", changeReason: "reason" });
  assert.ok(flattened(errors).includes("target"));
});
check("calendar update DTO accepts partial input", () => {
  assert.equal(dtoErrors(UpdateCalendarExceptionDto, { name: "Renamed" }).length, 0);
});
check("calendar cancel DTO requires a reason", () => {
  assert.ok(flattened(dtoErrors(CancelCalendarExceptionDto, {})).includes("cancellationReason"));
});

const dtoClasses = [
  AttendanceDayQueryDto,
  AttendanceEntryDto,
  BulkAttendanceSaveDto,
  DiscardAttendanceEntryDto,
  FinalizeAttendanceDayDto,
  ListAttendanceHistoryQueryDto,
  CorrectAttendanceDto,
  MarkNotApplicableDto,
  CreateInitialAttendancePolicyDto,
  ReplaceAttendancePolicyDto,
  CancelFutureAttendancePolicyDto,
  CreateCalendarExceptionDto,
  UpdateCalendarExceptionDto,
  CancelCalendarExceptionDto,
  HistoricalCalendarCorrectionDto,
];

for (const dtoClass of dtoClasses) {
  check(`${dtoClass.name} rejects company, creator, and timezone ownership fields`, () => {
    const errors = dtoErrors(dtoClass, { companyId: "co-1", createdById: "user-1", timeZone: "UTC" });
    const text = flattened(errors);
    assert.ok(text.includes("companyId"), `${dtoClass.name} must reject companyId`);
    assert.ok(text.includes("createdById"), `${dtoClass.name} must reject createdById`);
    assert.ok(text.includes("timeZone"), `${dtoClass.name} must reject timeZone`);
  });
}

const routeCount = attendanceRoutes.length + policyRoutes.length + calendarRoutes.length;
console.log(`Attendance API surface verification: ${passed} PASS, ${failed} FAIL (${routeCount} exact routes)`);
if (failed > 0) {
  process.exitCode = 1;
}
