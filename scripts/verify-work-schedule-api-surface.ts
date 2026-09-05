import "reflect-metadata";
import assert from "node:assert/strict";
import { GUARDS_METADATA, HEADERS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { ACCOUNTANT_ROLE, ROLES_METADATA_KEY } from "../apps/api/src/auth/auth.constants";
import { AuthModule } from "../apps/api/src/auth/auth.module";
import { AuthGuard } from "../apps/api/src/auth/guards/auth.guard";
import { RolesGuard } from "../apps/api/src/auth/guards/roles.guard";
import { PrismaModule } from "../apps/api/src/prisma/prisma.module";
import { AppModule } from "../apps/api/src/app.module";
import { WorkScheduleController } from "../apps/api/src/work-schedule/work-schedule.controller";
import { WorkScheduleModule } from "../apps/api/src/work-schedule/work-schedule.module";
import type {
  CancelWorkScheduleAssignmentDto,
  CreateWorkScheduleAssignmentDto,
  CreateWorkScheduleDto,
  EndWorkScheduleAssignmentDto,
  ReplaceWorkScheduleAssignmentDto,
  UpdateWorkScheduleDto,
} from "../apps/api/src/work-schedule/dto/work-schedule.dto";

type AsyncCall = { method: string; args: unknown[]; result: unknown };
const calls: AsyncCall[] = [];
const service = new Proxy({}, {
  get: (_target, property) => (...args: unknown[]) => {
    const result = { from: String(property) };
    calls.push({ method: String(property), args, result });
    return result;
  },
});

const expectedRoutes = [
  ["listSchedules", "/", RequestMethod.GET],
  ["resolveWorkSchedule", "effective", RequestMethod.GET],
  ["listAssignments", "assignments", RequestMethod.GET],
  ["createSchedule", "/", RequestMethod.POST],
  ["createAssignment", "assignments", RequestMethod.POST],
  ["replaceAssignment", "assignments/:id/replace", RequestMethod.POST],
  ["endAssignment", "assignments/:id/end", RequestMethod.POST],
  ["cancelAssignment", "assignments/:id/cancel", RequestMethod.POST],
  ["getSchedule", ":id", RequestMethod.GET],
  ["updateSchedule", ":id", RequestMethod.PATCH],
] as const;

assert.equal(Reflect.getMetadata(PATH_METADATA, WorkScheduleController), "work-schedules");
assert.deepEqual(Reflect.getMetadata(ROLES_METADATA_KEY, WorkScheduleController), [ACCOUNTANT_ROLE]);
assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, WorkScheduleController), [AuthGuard, RolesGuard]);

const prototype = WorkScheduleController.prototype as unknown as Record<string, Function>;
const decorated = Object.getOwnPropertyNames(prototype).filter(name => name !== "constructor" && Reflect.hasMetadata(METHOD_METADATA, prototype[name]));
assert.deepEqual(decorated, expectedRoutes.map(([name]) => name), "static routes must be declared before :id routes");
for (const [name, path, method] of expectedRoutes) {
  assert.equal(Reflect.getMetadata(PATH_METADATA, prototype[name]), path, `${name} path`);
  assert.equal(Reflect.getMetadata(METHOD_METADATA, prototype[name]), method, `${name} verb`);
  assert.notEqual(method, RequestMethod.DELETE);
}
for (const name of ["resolveWorkSchedule", "listAssignments", "getSchedule"]) {
  assert.deepEqual(Reflect.getMetadata(HEADERS_METADATA, prototype[name]), [{ name: "Cache-Control", value: "no-store" }], `${name} cache header`);
}

const moduleImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, WorkScheduleModule) as unknown[];
assert.deepEqual(moduleImports, [AuthModule, PrismaModule]);
assert.deepEqual(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, WorkScheduleModule), [WorkScheduleController]);
assert.deepEqual(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, WorkScheduleModule).map((item: Function) => item.name), ["WorkScheduleService"]);
assert.deepEqual(Reflect.getMetadata(MODULE_METADATA.EXPORTS, WorkScheduleModule).map((item: Function) => item.name), ["WorkScheduleService"]);
const appImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as unknown[];
assert.equal(appImports.filter(item => item === WorkScheduleModule).length, 1);

const controller = new WorkScheduleController(service as never) as unknown as Record<string, (...args: never[]) => unknown>;
const user = { id: "user-1", email: "accountant@example.test", role: ACCOUNTANT_ROLE };
const cases: Array<[string, unknown[], string, unknown[]]> = [
  ["listSchedules", [{}], "listSchedules", [false]],
  ["listSchedules", [{ includeInactive: true }], "listSchedules", [true]],
  ["resolveWorkSchedule", [{ businessDate: "2026-09-05", employeeId: "employee-1" }], "resolveWorkSchedule", ["employee-1", "2026-09-05"]],
  ["listAssignments", [{ employeeId: "employee-1" }], "listAssignments", ["employee-1"]],
  ["getSchedule", ["schedule-1"], "getSchedule", ["schedule-1"]],
  ["createSchedule", [{ name: "Office" } as CreateWorkScheduleDto, user], "createSchedule", [{ name: "Office" }, user]],
  ["updateSchedule", ["schedule-1", { name: "New" } as UpdateWorkScheduleDto, user], "updateSchedule", ["schedule-1", { name: "New" }, user]],
  ["createAssignment", [{ scope: "COMPANY_DEFAULT" } as CreateWorkScheduleAssignmentDto, user], "createAssignment", [{ scope: "COMPANY_DEFAULT" }, user]],
  ["replaceAssignment", ["assignment-1", { effectiveFrom: "2026-09-06" } as ReplaceWorkScheduleAssignmentDto, user], "replaceAssignment", ["assignment-1", { effectiveFrom: "2026-09-06" }, user]],
  ["endAssignment", ["assignment-1", { effectiveTo: "2026-09-06" } as EndWorkScheduleAssignmentDto, user], "endAssignment", ["assignment-1", { effectiveTo: "2026-09-06" }, user]],
  ["cancelAssignment", ["assignment-1", { changeReason: "Cancelled" } as CancelWorkScheduleAssignmentDto, user], "cancelAssignment", ["assignment-1", { changeReason: "Cancelled" }, user]],
];
for (const [controllerMethod, args, serviceMethod, expectedArgs] of cases) {
  const result = controller[controllerMethod](...(args as never[]));
  assert.deepEqual(calls.at(-1), { method: serviceMethod, args: expectedArgs, result });
}

console.log(`Work Schedule API surface verified: ${expectedRoutes.length} exact routes and ${cases.length} wiring cases.`);
