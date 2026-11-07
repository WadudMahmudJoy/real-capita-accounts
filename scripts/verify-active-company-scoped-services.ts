import "reflect-metadata";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ConflictException } from "@nestjs/common";

/**
 * DB-free D6A verifier: active-company scoped Work Schedule + Attendance.
 *
 * Source-contract checks over the actual production bytes of both modules,
 * plus behavioral checks of the exported active-company context guards.
 * No database connection. Exits with code 1 on any failure.
 */

type CheckOutcome = {
  id: string;
  label: string;
  passed: boolean;
  detail: string | null;
};

const ROOT = process.cwd();

const WORK_SCHEDULE_FILES = [
  "apps/api/src/work-schedule/work-schedule.controller.ts",
  "apps/api/src/work-schedule/work-schedule.module.ts",
  "apps/api/src/work-schedule/work-schedule.service.ts",
  "apps/api/src/work-schedule/work-schedule-prisma-errors.ts",
  "apps/api/src/work-schedule/work-schedule-resolver.ts",
  "apps/api/src/work-schedule/work-schedule-rules.ts",
  "apps/api/src/work-schedule/dto/work-schedule.dto.ts",
];

const ATTENDANCE_FILES = [
  "apps/api/src/attendance/attendance.module.ts",
  "apps/api/src/attendance/attendance.controller.ts",
  "apps/api/src/attendance/attendance-policy.controller.ts",
  "apps/api/src/attendance/attendance-calendar.controller.ts",
  "apps/api/src/attendance/attendance-audit.ts",
  "apps/api/src/attendance/attendance-calendar-rules.ts",
  "apps/api/src/attendance/attendance-calendar.service.ts",
  "apps/api/src/attendance/attendance-correction.service.ts",
  "apps/api/src/attendance/attendance-day.service.ts",
  "apps/api/src/attendance/attendance-errors.ts",
  "apps/api/src/attendance/attendance-evaluation.ts",
  "apps/api/src/attendance/attendance-expectation.service.ts",
  "apps/api/src/attendance/attendance-finalization.service.ts",
  "apps/api/src/attendance/attendance-lock.ts",
  "apps/api/src/attendance/attendance-policy-rules.ts",
  "apps/api/src/attendance/attendance-policy.service.ts",
  "apps/api/src/attendance/attendance-time.ts",
  "apps/api/src/attendance/dto/attendance-calendar.dto.ts",
  "apps/api/src/attendance/dto/attendance-correction.dto.ts",
  "apps/api/src/attendance/dto/attendance-day.dto.ts",
  "apps/api/src/attendance/dto/attendance-policy.dto.ts",
];

const outcomes: CheckOutcome[] = [];

function record(
  id: string,
  label: string,
  passed: boolean,
  detail?: string,
): void {
  outcomes.push({ id, label, passed, detail: detail ?? null });
}

function stripLineComments(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

async function readSources(files: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const file of files) {
    try {
      const text = await readFile(path.join(ROOT, file), "utf8");
      map.set(file, stripLineComments(text));
    } catch {
      map.set(file, "");
    }
  }
  return map;
}

function combined(map: Map<string, string>): string {
  return [...map.values()].join("\n");
}

/** Runs fn catching both synchronous and asynchronous failures. */
async function safeCall<T>(
  fn: () => Promise<T> | T,
): Promise<{ value: T | null; error: unknown }> {
  try {
    return { value: await fn(), error: null };
  } catch (error) {
    return { value: null, error };
  }
}

function companyContextFixture(isActive: boolean) {
  return {
    id: "co-ctx-1",
    name: "Context Office",
    legalName: null,
    isActive,
    officeLogoPath: null,
    brandAccentColor: null,
    backgroundMode: "DEFAULT_PREMIUM" as const,
    customBackgroundPath: null,
  };
}

async function main(): Promise<number> {
  const ws = await readSources(WORK_SCHEDULE_FILES);
  const att = await readSources(ATTENDANCE_FILES);
  const wsAll = combined(ws);
  const attAll = combined(att);

  const wsController = ws.get(WORK_SCHEDULE_FILES[0]) ?? "";
  const wsService = ws.get(WORK_SCHEDULE_FILES[2]) ?? "";
  const attController = att.get(ATTENDANCE_FILES[1]) ?? "";
  const attPolicyController = att.get(ATTENDANCE_FILES[2]) ?? "";
  const attCalendarController = att.get(ATTENDANCE_FILES[3]) ?? "";
  const attPolicyService = att.get(ATTENDANCE_FILES[15]) ?? "";
  const attCalendarService = att.get(ATTENDANCE_FILES[6]) ?? "";
  const attDayService = att.get(ATTENDANCE_FILES[8]) ?? "";
  const attCorrectionService = att.get(ATTENDANCE_FILES[7]) ?? "";
  const attFinalizationService = att.get(ATTENDANCE_FILES[12]) ?? "";
  const attExpectationService = att.get(ATTENDANCE_FILES[11]) ?? "";
  const attLock = att.get(ATTENDANCE_FILES[13]) ?? "";

  // --- A/B/C/D: singleton removal ------------------------------------------

  record(
    "A",
    "no production singletonKey lookup remains in Work Schedule runtime",
    !/singletonKey/.test(wsAll),
  );

  record(
    "B",
    "no production PRIMARY lookup remains in Work Schedule runtime",
    !/["']PRIMARY["']/.test(wsAll),
  );

  record(
    "C",
    "no production singletonKey lookup remains in Attendance runtime",
    !/singletonKey/.test(attAll),
  );

  record(
    "D",
    "no production PRIMARY lookup remains in Attendance runtime",
    !/["']PRIMARY["']/.test(attAll),
  );

  // --- E/F/G: Work Schedule controller/service wiring -----------------------

  record(
    "E",
    "Work Schedule controller obtains company from @ActiveCompany() request context",
    /@ActiveCompany\(\)/.test(wsController),
  );

  const wsServiceCompanyScopedMethods = [
    "listSchedules",
    "getSchedule",
    "createSchedule",
    "updateSchedule",
    "listAssignments",
    "resolveWorkSchedule",
    "createAssignment",
    "replaceAssignment",
    "endAssignment",
    "cancelAssignment",
  ];

  const wsMethodsMissingCompanyId = wsServiceCompanyScopedMethods.filter(
    (method) => {
      const signature = new RegExp(
        `async ${method}\\((?:[^)]*companyId\\s*:\\s*string[^)]*)\\)`,
      ).exec(wsService);
      return signature === null;
    },
  );

  record(
    "F",
    "Work Schedule service receives companyId from trusted server context (all 10 public operations)",
    wsMethodsMissingCompanyId.length === 0,
    wsMethodsMissingCompanyId.length > 0
      ? `missing companyId param: ${wsMethodsMissingCompanyId.join(", ")}`
      : undefined,
  );

  const wsControllerGuardCalls = (
    wsController.match(/requireActiveCompanyId\(company\)/g) ?? []
  ).length;

  record(
    "G",
    "Work Schedule create/list/update/assignment operations remain company-scoped (controller passes guard result into every service call)",
    wsControllerGuardCalls >= 10 &&
      !/this\.service\.\w+\(\s*(?!\s*requireActiveCompanyId)/.test(
        wsController.replace(
          /this\.service\.\w+\(\s*requireActiveCompanyId\(company\)([^;]*)\);/g,
          "",
        ),
      ),
    `guard pass-through count: ${wsControllerGuardCalls}`,
  );

  // --- H/I: Work Schedule company row lock -----------------------------------

  record(
    "H",
    "Work Schedule company locking still exists (FOR UPDATE on companies)",
    /FOR UPDATE/.test(wsService) && /FROM companies/.test(wsService),
  );

  const lockByExactId = /FROM companies WHERE id = \$\{companyId\} FOR UPDATE/.test(
    wsService,
  );

  record(
    "I",
    "Work Schedule FOR UPDATE lock targets the exact active Company id (parameterized, no PRIMARY)",
    lockByExactId && !/companies WHERE "singletonKey"/.test(wsService),
  );

  // --- J/K/L: Attendance controllers/services ---------------------------------

  record(
    "J",
    "Attendance controllers obtain company from @ActiveCompany() context",
    /@ActiveCompany\(\)/.test(attController) &&
      /@ActiveCompany\(\)/.test(attPolicyController) &&
      /@ActiveCompany\(\)/.test(attCalendarController),
  );

  const attendanceServiceFiles: Array<[string, string]> = [
    ["attendance-day.service.ts", attDayService],
    ["attendance-policy.service.ts", attPolicyService],
    ["attendance-calendar.service.ts", attCalendarService],
    ["attendance-correction.service.ts", attCorrectionService],
    ["attendance-finalization.service.ts", attFinalizationService],
    ["attendance-expectation.service.ts", attExpectationService],
  ];

  const attendanceServicesMissingCompanyId = attendanceServiceFiles
    .filter(([, source]) => !/companyId\s*:\s*string/.test(source))
    .map(([name]) => name);

  record(
    "K",
    "Attendance services receive trusted companyId explicitly",
    attendanceServicesMissingCompanyId.length === 0,
    attendanceServicesMissingCompanyId.length > 0
      ? attendanceServicesMissingCompanyId.join(", ")
      : undefined,
  );

  const dtoFiles = [
    ...(ws.get("apps/api/src/work-schedule/dto/work-schedule.dto.ts") ?? ""),
    ...combined(
      new Map(
        [...att].filter(([file]) => file.includes("/dto/")),
      ),
    ),
  ].join("\n");

  record(
    "L",
    "no attendance/work-schedule DTO or client field becomes authority for companyId",
    !/companyId/.test(dtoFiles),
  );

  // --- M–R: company-scoped queries per attendance domain -----------------------

  record(
    "M",
    "attendance policies are scoped to the active company",
    /attendancePolicy\.findMany\(\{\s*where:\s*\{\s*companyId\s*\}/.test(
      attPolicyService,
    ) &&
      (attPolicyService.match(/companyId/g) ?? []).length >= 8,
  );

  record(
    "N",
    "attendance calendar exceptions are scoped to the active company",
    /companyCalendarException\.(findMany|findFirst)\(\{\s*where:\s*\{\s*companyId/.test(
      attCalendarService,
    ) &&
      (attCalendarService.match(/companyId/g) ?? []).length >= 8,
  );

  record(
    "O",
    "attendance day calculations/records are scoped to the active company",
    /attendanceRecord\.findMany\(\{\s*where:\s*\{[^}]*companyId/.test(
      attDayService,
    ) &&
      /attendanceDayFinalization\.findFirst\(\{\s*where:\s*\{\s*companyId/.test(
        attDayService,
      ),
  );

  record(
    "P",
    "attendance finalization is scoped to the active company",
    /attendanceDayFinalization\.findFirst\(\{\s*where:\s*\{\s*companyId/.test(
      attFinalizationService,
    ) &&
      /attendanceRecord\.findMany\(\{\s*where:\s*\{\s*companyId/.test(
        attFinalizationService,
      ),
  );

  record(
    "Q",
    "attendance corrections are scoped to the active company",
    /attendanceRecord\.findFirst\(\{\s*where:\s*{\s*companyId/.test(
      attCorrectionService,
    ) ||
      /attendanceRecord\.findFirst\(\{\s*where:\s*\{\s*companyId/.test(
        attCorrectionService,
      ),
  );

  record(
    "R",
    "attendance expectation logic is scoped to the active company",
    /companyCalendarException\.findFirst\(\{\s*where:\s*\{\s*companyId/.test(
      attExpectationService,
    ) &&
      /attendancePolicy\.findFirst\(\{\s*where:\s*\{\s*companyId/.test(
        attExpectationService,
      ),
  );

  // --- S/T/U: behavioral context guards -----------------------------------------

  type Guard = (company: unknown) => string;

  const attendanceGuard = (
    await import("../apps/api/src/attendance/attendance-lock")
  ).requireActiveCompanyId as Guard | undefined;

  const inactiveAttendance = await safeCall(() =>
    attendanceGuard?.(companyContextFixture(false)),
  );
  record(
    "S",
    "inactive activeCompany context is rejected by company-scoped Attendance operations",
    inactiveAttendance.error instanceof ConflictException,
    inactiveAttendance.error === null
      ? "no guard export or no throw"
      : String(inactiveAttendance.error),
  );

  const workScheduleGuard = (
    await import("../apps/api/src/work-schedule/work-schedule.service")
  ).requireActiveCompanyId as Guard | undefined;

  const inactiveWorkSchedule = await safeCall(() =>
    workScheduleGuard?.(companyContextFixture(false)),
  );
  record(
    "T",
    "inactive activeCompany context is rejected by company-scoped Work Schedule operations",
    inactiveWorkSchedule.error instanceof ConflictException,
    inactiveWorkSchedule.error === null
      ? "no guard export or no throw"
      : String(inactiveWorkSchedule.error),
  );

  const missingAttendance = await safeCall(() => attendanceGuard?.(null));
  const missingWorkSchedule = await safeCall(() => workScheduleGuard?.(null));
  record(
    "U",
    "missing activeCompany context is rejected (both modules)",
    missingAttendance.error instanceof ConflictException &&
      missingWorkSchedule.error instanceof ConflictException,
  );

  const activeId = await safeCall(() =>
    attendanceGuard?.(companyContextFixture(true)),
  );
  record(
    "U2",
    "an active company context resolves to its exact id",
    activeId.value === "co-ctx-1",
  );

  // --- V/W/X: no fallback / no session mutation ----------------------------------

  record(
    "V",
    "no fallback to oldest Company is implemented inside these modules (no company.findFirst)",
    !/company\.findFirst/.test(wsAll) && !/company\.findFirst/.test(attAll) &&
      !/company\.findUnique/.test(wsAll) && !/company\.findUnique/.test(attAll),
  );

  record(
    "W",
    "no Company session switching occurs inside these modules",
    !/activeCompanyId/.test(wsAll) && !/activeCompanyId/.test(attAll),
  );

  record(
    "X",
    "no update of AuthSession occurs inside these modules",
    !/authSession/i.test(wsAll) && !/authSession/i.test(attAll),
  );

  // --- Y/Z/AA: boundary -----------------------------------------------------------

  record(
    "Y",
    "no FiscalYear/Voucher changes appear in these modules",
    !/from\s+"\.\.\/(fiscal-year|voucher)\//.test(wsAll) &&
      !/from\s+"\.\.\/(fiscal-year|voucher)\//.test(attAll),
  );

  // --- Z: D8 frontend does not determine WS/Attendance company ownership -------

  // D8 note: the original D6A phase boundary asserted apps/web was untouched.
  // D8 is the authorized Company Setup frontend phase, so this check now pins
  // the enduring invariant: the Company Setup UI determines no Work Schedule
  // or Attendance company ownership (the companyId prop on the media field is
  // the D7B media endpoint target, not an ownership decision), and the
  // trusted company id still originates in the API runtime through
  // @ActiveCompany().

  const companyUiMap = await readSources([
    "apps/web/src/app/app/company/page.tsx",
    "apps/web/src/app/app/company/_components/OfficeList.tsx",
    "apps/web/src/app/app/company/_components/OfficeEditor.tsx",
    "apps/web/src/app/app/company/_components/CompanyMediaField.tsx",
  ]);
  const companyUi = combined(companyUiMap);
  const companyUiFilesPresent = [...companyUiMap.values()].every(
    (text) => text !== "",
  );

  const decoratorMap = await readSources([
    "apps/api/src/auth/decorators/active-company.decorator.ts",
  ]);
  const activeCompanyDecorator = combined(decoratorMap);

  const noWsAttendanceOwnership =
    companyUiFilesPresent &&
    !/\b(?:workSchedule|WorkSchedule|workScheduleId|workScheduleAssignment|attendance|Attendance|employeeId|employeeCode)\b/.test(
      companyUi,
    );

  const trustedOriginStillApiRuntime =
    /export const ActiveCompany/.test(activeCompanyDecorator) &&
    /\.activeCompany/.test(activeCompanyDecorator);

  record(
    "Z",
    "D8 frontend does not determine Work Schedule/Attendance company ownership (trusted company id still originates from @ActiveCompany() in API runtime)",
    noWsAttendanceOwnership && trustedOriginStillApiRuntime,
  );

  record(
    "AA",
    "no Afseen/RESDA hard-coding",
    !/afseen|resda/i.test(wsAll) && !/afseen|resda/i.test(attAll),
  );

  // attendance-lock keeps its lock helper signature (companyId + businessDate)
  record(
    "AL",
    "attendance date lock still keyed by companyId + businessDate",
    /attendanceDateLockKey\(companyId,\s*businessDate\)/.test(attLock) &&
      /pg_advisory_xact_lock/.test(attLock),
  );

  // --- Report -------------------------------------------------------------------------

  console.log("D6A active-company scoped services verification (DB-free)");
  console.log("");
  for (const outcome of outcomes) {
    const marker = outcome.passed ? "PASS" : "FAIL";
    const suffix = outcome.detail ? ` -> ${outcome.detail}` : "";
    console.log(`  ${marker}  [${outcome.id}] ${outcome.label}${suffix}`);
  }

  const failed = outcomes.filter((outcome) => !outcome.passed);

  console.log("");
  console.log(
    `Summary: ${outcomes.length - failed.length} PASS / ${failed.length} FAIL`,
  );

  return failed.length > 0 ? 1 : 0;
}

main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
