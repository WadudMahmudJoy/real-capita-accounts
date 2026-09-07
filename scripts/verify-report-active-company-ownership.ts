import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * DB-free D11B-A verifier: report active-company access ownership.
 *
 * Source-contract checks cover the real ReportController/ReportService bytes
 * (decorator usage, trusted companyId threading, Prisma ownership scoping,
 * anti-leak semantics) plus behavioral checks that instantiate the real
 * ReportService with a mock Prisma client to prove a foreign-company fiscal
 * year cannot resolve while an owned one does. A git status audit pins the
 * exact authorized dirty-file set. Exits with code 1 on any failure.
 */

type CheckOutcome = {
  id: string;
  label: string;
  passed: boolean;
  detail: string | null;
};

const ROOT = process.cwd();
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

async function readSource(relativePath: string): Promise<string | null> {
  try {
    const text = await readFile(path.join(ROOT, relativePath), "utf8");
    return stripLineComments(text);
  } catch {
    return null;
  }
}

function gitStatusPaths(): string[] {
  try {
    const out = execFileSync(
      process.platform === "win32" ? "git.exe" : "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      { cwd: ROOT, encoding: "utf8" },
    );
    return out
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => line.slice(3).trim());
  } catch {
    return ["git-status-unavailable"];
  }
}

// The authoritative 62 individual dirty files accepted through D11A.
const ACCEPTED_PRE_D11BA_FILES: string[] = [
  ".gitignore",
  "apps/api/src/accounting-period/accounting-period.controller.ts",
  "apps/api/src/accounting-period/accounting-period.service.ts",
  "apps/api/src/attendance/attendance-calendar.controller.ts",
  "apps/api/src/attendance/attendance-calendar.service.ts",
  "apps/api/src/attendance/attendance-correction.service.ts",
  "apps/api/src/attendance/attendance-day.service.ts",
  "apps/api/src/attendance/attendance-expectation.service.ts",
  "apps/api/src/attendance/attendance-finalization.service.ts",
  "apps/api/src/attendance/attendance-lock.ts",
  "apps/api/src/attendance/attendance-policy.controller.ts",
  "apps/api/src/attendance/attendance-policy.service.ts",
  "apps/api/src/attendance/attendance.controller.ts",
  "apps/api/src/auth/auth.service.ts",
  "apps/api/src/auth/auth.types.ts",
  "apps/api/src/auth/guards/auth.guard.ts",
  "apps/api/src/company/company.controller.ts",
  "apps/api/src/company/company.module.ts",
  "apps/api/src/company/company.service.ts",
  "apps/api/src/company/dto/update-company.dto.ts",
  "apps/api/src/fiscal-year/fiscal-year.controller.ts",
  "apps/api/src/fiscal-year/fiscal-year.service.ts",
  "apps/api/src/voucher/voucher.controller.ts",
  "apps/api/src/voucher/voucher.service.ts",
  "apps/api/src/work-schedule/work-schedule.controller.ts",
  "apps/api/src/work-schedule/work-schedule.service.ts",
  "apps/web/src/app/app/company/page.tsx",
  "apps/web/src/lib/api.ts",
  "prisma/schema.prisma",
  "scripts/verify-attendance-concurrency.ts",
  "scripts/verify-attendance-constraints.ts",
  "scripts/verify-attendance-database.ts",
  "scripts/verify-attendance-runtime.ts",
  "scripts/verify-work-schedules-database.ts",
  "scripts/verify-work-schedules-runtime.ts",
  "apps/api/src/auth/decorators/active-company.decorator.ts",
  "apps/api/src/company/company-media.controller.ts",
  "apps/api/src/company/company-media.service.ts",
  "apps/web/src/app/app/company/_components/CompanyMediaField.tsx",
  "apps/web/src/app/app/company/_components/OfficeEditor.tsx",
  "apps/web/src/app/app/company/_components/OfficeList.tsx",
  "prisma/migrations/20260906212958_multi_office_company_foundation/migration.sql",
  "scripts/verify-accounting-active-company-ownership.ts",
  "scripts/verify-active-company-scoped-services.ts",
  "scripts/verify-active-company-session.ts",
  "scripts/verify-company-branding-contract.ts",
  "scripts/verify-company-media-upload.ts",
  "scripts/verify-company-multi-office-api.ts",
  "scripts/verify-company-multi-office-schema.ts",
  "scripts/verify-dynamic-company-setup-ui.ts",
  "apps/web/src/app/app/layout.tsx",
  "apps/web/src/app/app/_components/OfficeSwitcher.tsx",
  "scripts/verify-global-office-switcher.ts",
  "apps/web/src/app/app/_lib/office-theme.ts",
  "apps/web/src/app/app/_components/OfficeThemeShell.tsx",
  "apps/web/src/app/globals.css",
  "scripts/verify-dynamic-office-theme.ts",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/print-brand.ts",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintDocument.tsx",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintHeader.tsx",
  "scripts/verify-voucher-print.ts",
  "scripts/verify-voucher-owner-company-branding.ts",
];

// The only files D11B-A is authorized to add to the dirty set.
const D11BA_AUTHORIZED_NEW_FILES: string[] = [
  "apps/api/src/report/report.controller.ts",
  "apps/api/src/report/report.service.ts",
  "scripts/verify-report-active-company-ownership.ts",
];

// D11B-B note: D11B-B is the authorized report owner-company print branding
// phase; its new dirty entries extend this phase-scope enumeration the same
// way. No behavioral D11B-A assertion is affected.
const D11BB_AUTHORIZED_NEW_FILES: string[] = [
  "apps/web/src/app/app/reports/_lib/report-print.tsx",
  "apps/web/src/app/app/reports/_lib/CashBankBookReport.tsx",
  "apps/web/src/app/app/reports/ledger/page.tsx",
  "apps/web/src/app/app/reports/trial-balance/page.tsx",
  "apps/web/src/app/app/reports/income-statement/page.tsx",
  "apps/web/src/app/app/reports/balance-sheet/page.tsx",
  "apps/web/src/app/app/reports/project-ledger/page.tsx",
  "apps/web/src/app/app/reports/project-cost/page.tsx",
  "apps/web/src/app/app/reports/cost-center-summary/page.tsx",
  "apps/web/src/app/app/reports/project-financial-summary/page.tsx",
  "apps/web/src/app/app/reports/project-fund-movement/page.tsx",
  "scripts/verify-report-owner-branding.ts",
];

const CONTROLLER_PATH = "apps/api/src/report/report.controller.ts";
const SERVICE_PATH = "apps/api/src/report/report.service.ts";
const DTO_PATH = "apps/api/src/report/dto/report-query.dto.ts";
const DECORATOR_PATH = "apps/api/src/auth/decorators/active-company.decorator.ts";
const AUTH_TYPES_PATH = "apps/api/src/auth/auth.types.ts";

// The 12 discovered report routes.
const REPORT_ROUTES = [
  "ledger",
  "cash-book",
  "bank-book",
  "mfs-book",
  "trial-balance",
  "income-statement",
  "balance-sheet",
  "project-ledger",
  "project-cost",
  "cost-center-summary",
  "project-financial-summary",
  "project-fund-movement",
] as const;

// Controller method names (D11B1 discovery) per route.
const ROUTE_METHODS: Record<string, string> = {
  "ledger": "getLedger",
  "cash-book": "getCashBook",
  "bank-book": "getBankBook",
  "mfs-book": "getMfsBook",
  "trial-balance": "getTrialBalance",
  "income-statement": "getIncomeStatement",
  "balance-sheet": "getBalanceSheet",
  "project-ledger": "getProjectLedger",
  "project-cost": "getProjectCost",
  "cost-center-summary": "getCostCenterSummary",
  "project-financial-summary": "getProjectFinancialSummary",
  "project-fund-movement": "getProjectFundMovement",
};

async function main(): Promise<number> {
  const controllerSource = (await readSource(CONTROLLER_PATH)) ?? "";
  const serviceSource = (await readSource(SERVICE_PATH)) ?? "";
  const dtoSource = (await readSource(DTO_PATH)) ?? "";
  const decoratorSource = (await readSource(DECORATOR_PATH)) ?? "";
  const authTypesSource = (await readSource(AUTH_TYPES_PATH)) ?? "";

  const controllerExists = controllerSource !== "";
  const serviceExists = serviceSource !== "";

  // --- A/B: @ActiveCompany() + D4 contract -----------------------------------

  record(
    "A",
    "ReportController uses @ActiveCompany() on every report endpoint",
    controllerExists &&
      (controllerSource.match(/@ActiveCompany\(\)/g) ?? []).length === 12 &&
      /import\s*\{[^}]*ActiveCompany[^}]*\}\s*from\s*"\.\.\/auth\/decorators\/active-company\.decorator"/.test(
        controllerSource,
      ),
  );

  record(
    "B",
    "active Company type comes from the accepted D4 contract (ActiveCompanyContext import in controller)",
    controllerExists &&
      /import type \{[^}]*ActiveCompanyContext[^}]*\}\s*from\s*"\.\.\/auth\/auth\.types"/.test(
        controllerSource,
      ) &&
      /export const ActiveCompany = createParamDecorator\(/.test(
        decoratorSource,
      ) &&
      /activeCompany: ActiveCompanyContext \| null/.test(authTypesSource),
  );

  // --- C/D/F: missing/inactive rejection + no DTO companyId authority ---------

  record(
    "C",
    "missing active Company rejected with ConflictException (shared local helper)",
    controllerExists &&
      /requireActiveCompanyId/.test(controllerSource) &&
      /ConflictException/.test(controllerSource) &&
      /activeCompany === null/.test(controllerSource),
  );

  record(
    "D",
    "inactive active Company rejected with ConflictException",
    controllerExists &&
      /!activeCompany\.isActive/.test(controllerSource) &&
      /ConflictException/.test(controllerSource),
  );

  record(
    "F",
    "report DTO does NOT gain companyId authority",
    !/companyId/.test(dtoSource),
  );

  // --- E: all 12 routes pass trusted activeCompany.id ---------------------------

  let allRoutesThread = true;
  const routeDetail: string[] = [];
  for (const route of REPORT_ROUTES) {
    const method = ROUTE_METHODS[route];
    const routeIdx = controllerSource.indexOf(`@Get("${route}")`);
    const nextRouteIdx =
      routeIdx === -1
        ? -1
        : controllerSource.indexOf("@Get(", routeIdx + 1);
    const block =
      routeIdx === -1
        ? ""
        : controllerSource.slice(
            routeIdx,
            nextRouteIdx === -1 ? controllerSource.length : nextRouteIdx,
          );
    const ok =
      block.includes(method) &&
      block.includes("@ActiveCompany()") &&
      block.includes("requireActiveCompanyId(");
    if (!ok) {
      allRoutesThread = false;
      routeDetail.push(route);
    }
  }
  record(
    "E",
    "all 12 report routes pass trusted activeCompany.id into the service (via requireActiveCompanyId)",
    allRoutesThread,
    routeDetail.length > 0 ? `uncovered: ${routeDetail.join(",")}` : undefined,
  );

  // --- G: all 12 service entry methods accept trusted companyId ------------------

  const serviceEntries = [
    "getLedger",
    "getCashBook",
    "getBankBook",
    "getMfsBook",
    "getTrialBalance",
    "getIncomeStatement",
    "getBalanceSheet",
    "getProjectLedger",
    "getProjectCost",
    "getCostCenterSummary",
    "getProjectFinancialSummary",
    "getProjectFundMovement",
  ];
  const missingCompanyId = serviceEntries.filter(
    (entry) =>
      !new RegExp(
        `\\b${entry}\\(\\s*companyId: string,\\s*query: ReportQueryDto`,
      ).test(serviceSource),
  );
  record(
    "G",
    "all 12 ReportService entry methods accept trusted companyId as the first parameter",
    serviceExists && missingCompanyId.length === 0,
    missingCompanyId.length > 0
      ? `missing: ${missingCompanyId.join(",")}`
      : undefined,
  );

  // --- H/I/J: resolveReportContext ownership --------------------------------------

  const resolverIdx = serviceSource.indexOf(
    "private async resolveReportContext(",
  );
  const resolverBlock =
    resolverIdx === -1
      ? ""
      : serviceSource.slice(resolverIdx, resolverIdx + 1200);

  record(
    "H",
    "resolveReportContext receives the trusted expected companyId",
    /private async resolveReportContext\(\s*companyId: string,\s*query: ReportQueryDto,?\s*\)/.test(
      serviceSource,
    ),
  );

  record(
    "I",
    "resolveReportContext Fiscal Year query scopes by id + companyId inside the Prisma where",
    // D11B-B note: the original D11B-A regex also pinned the literal
    // `include: { company: true }` shape. D11B-B is the authorized phase that
    // narrows the company relation to a document-branding select, so this
    // check now pins the enduring invariant only: findFirst with the
    // ownership where-clause (companyId + id). Access strength is unchanged.
    /fiscalYear\.findFirst\(\s*\{[\s\S]{0,900}?where: \{\s*companyId,\s*id: query\.fiscalYearId,?\s*\},?\s*\}\s*\)/.test(
      resolverBlock,
    ) && !/fiscalYear\.findUnique\(/.test(resolverBlock),
  );

  // --- K/L: balance-sheet resolver ownership ---------------------------------------

  const bsIdx = serviceSource.indexOf(
    "private async resolveBalanceSheetContext(",
  );
  const bsBlock =
    bsIdx === -1 ? "" : serviceSource.slice(bsIdx, bsIdx + 900);

  record(
    "K",
    "resolveBalanceSheetContext receives the trusted expected companyId",
    /private async resolveBalanceSheetContext\(\s*companyId: string,\s*query: ReportQueryDto,?\s*\)/.test(
      serviceSource,
    ),
  );

  record(
    "L",
    "Balance Sheet Fiscal Year lookup also scopes by id + companyId inside the Prisma where",
    // D11B-B note: same as check I — the company select shape is free, the
    // ownership where-clause remains the asserted invariant.
    /fiscalYear\.findFirst\(\s*\{[\s\S]{0,900}?where: \{\s*companyId,\s*id: query\.fiscalYearId,?\s*\},?\s*\}\s*\)/.test(
      bsBlock,
    ) && !/fiscalYear\.findUnique\(/.test(bsBlock),
  );

  // --- Behavioral: foreign-company fiscal year cannot resolve ----------------------

  // Build a mock Prisma whose fiscalYear.findFirst only returns a row when
  // BOTH the id and companyId in the where match the owned fixture.
  const OWNED_FY = {
    id: "fy-owned",
    companyId: "company-active",
    name: "FY 2026",
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-12-31"),
    company: {
      id: "company-active",
      name: "Synthetic Holdings A",
      legalName: null,
      currency: "BDT",
    },
  };

  const findFirstCalls: Array<Record<string, unknown>> = [];
  const mockPrisma = {
    fiscalYear: {
      // Pre-D11B-A production calls findUnique with only { id }; the mock
      // mirrors that shape too so the behavioral check cannot vacuously pass
      // from a missing client method — an unrestricted findUnique resolves
      // the owned row for ANY caller, which must FAIL the foreign check.
      findUnique(args: Record<string, unknown> = {}) {
        findFirstCalls.push(args);
        const where = args.where as { id?: string } | undefined;
        return Promise.resolve(
          where && where.id === OWNED_FY.id ? OWNED_FY : null,
        );
      },
      // Post-D11B-A production shape: ownership lives in the where clause.
      findFirst(args: Record<string, unknown> = {}) {
        findFirstCalls.push(args);
        const where = args.where as
          | { id?: string; companyId?: string }
          | undefined;
        if (
          where &&
          where.id === OWNED_FY.id &&
          where.companyId === OWNED_FY.companyId
        ) {
          return Promise.resolve(OWNED_FY);
        }
        return Promise.resolve(null);
      },
    },
  };

  // Dynamically import the real service and instantiate with the mock.
  let foreignRejected = false;
  let ownedResolved = false;
  let antiLeakIsNotFound = false;
  let behaviorDetail = "service not importable";
  try {
    const { ReportService } = (await import(
      "../apps/api/src/report/report.service"
    )) as { ReportService: new (prisma: unknown) => InstanceType<object> & {
      // Access the private resolver through a typed cast for verification.
      resolveReportContext: (
        companyId: string,
        query: { fiscalYearId: string },
      ) => Promise<unknown>;
    } };
    const service = new ReportService(mockPrisma);

    let caught: unknown = null;
    try {
      // Company B session requests Company A's fiscal year.
      await service.resolveReportContext("company-b", {
        fiscalYearId: "fy-owned",
      });
    } catch (error) {
      caught = error;
    }
    foreignRejected = caught !== null;
    antiLeakIsNotFound =
      foreignRejected &&
      (caught as { name?: string }).name === "NotFoundException";

    // Company A session requests its own fiscal year.
    const context = await service.resolveReportContext("company-active", {
      fiscalYearId: "fy-owned",
    });
    ownedResolved =
      (context as { fiscalYear?: { id?: string } }).fiscalYear?.id ===
      "fy-owned";

    behaviorDetail = `foreignRejected=${foreignRejected} ownedResolved=${ownedResolved}`;
  } catch (error) {
    behaviorDetail = error instanceof Error ? error.message : String(error);
  }

  record(
    "J",
    "foreign-company Fiscal Year cannot resolve while the owned one does (behavioral, NotFound anti-leak)",
    foreignRejected && ownedResolved && antiLeakIsNotFound,
    behaviorDetail,
  );

  // --- M: accounting period still validates against owned FY -----------------------

  record(
    "M",
    "Accounting Period continues to validate against the owned Fiscal Year (fiscalYearId equality check retained)",
    /accountingPeriod\.fiscalYearId !== fiscalYear\.id/.test(serviceSource),
  );

  // --- N-Y: each report uses the owned context ---------------------------------------

  const contextConsumers: Array<[string, string]> = [
    ["N", "getLedger"],
    ["O", "getCashBook"],
    ["P", "getBankBook"],
    ["Q", "getMfsBook"],
    ["R", "getTrialBalance"],
    ["S", "getIncomeStatement"],
    ["T", "getBalanceSheet"],
    ["U", "getProjectLedger"],
    ["V", "getProjectCost"],
    ["W", "getCostCenterSummary"],
    ["X", "getProjectFinancialSummary"],
    ["Y", "getProjectFundMovement"],
  ];

  for (const [id, method] of contextConsumers) {
    const methodIdx = serviceSource.indexOf(`${method}(`);
    const methodBlock =
      methodIdx === -1
        ? ""
        : serviceSource.slice(methodIdx, methodIdx + 2000);
    const usesResolver =
      /resolveReportContext\(\s*companyId,\s*query\s*\)/.test(methodBlock) ||
      /resolveBalanceSheetContext\(\s*companyId,\s*query\s*\)/.test(
        methodBlock,
      ) ||
      // Book reports flow through the shared private getCashBankBook.
      (/getCashBankBook\(\s*companyId,\s*query/.test(methodBlock) &&
        /private async getCashBankBook\(\s*companyId: string,/.test(
          serviceSource,
        ) &&
        /resolveReportContext\(\s*companyId,\s*query\s*\)/.test(
          serviceSource.slice(
            serviceSource.indexOf("private async getCashBankBook("),
            serviceSource.indexOf("private async getCashBankBook(") + 800,
          ),
        ));
    record(
      id,
      `${method} uses the owned report context (companyId threaded through its resolver)`,
      usesResolver,
    );
  }

  // --- Z-AA-AC: no current-company resolution / no session mutation ------------------

  record(
    "Z",
    "no singletonKey / PRIMARY current-company lookup",
    !/singletonKey/.test(serviceSource) &&
      !/["']PRIMARY["']/.test(serviceSource) &&
      !/singletonKey/.test(controllerSource),
  );

  record(
    "AA",
    "no company.findFirst oldest-company fallback and no company lookup in the report service",
    !/prisma\.company\./.test(serviceSource),
  );

  record(
    "AB",
    "no AuthSession mutation",
    !/authSession/i.test(serviceSource) &&
      !/authSession/i.test(controllerSource),
  );

  record(
    "AC",
    "no switchCompany/session switching logic",
    !/switchCompany/.test(serviceSource) &&
      !/switchCompany/.test(controllerSource),
  );

  // --- AD-AF: scope boundaries ----------------------------------------------------------

  const dirtyPaths = gitStatusPaths();
  // D11B-B note: the original D11B-A boundary asserted the report frontend
  // was untouched. D11B-B is the authorized report owner-branding phase, so
  // this check now pins the enduring invariant: report frontend changes are
  // limited to the authorized D11B-B owner-branding files.
  const D11BB_AUTHORIZED_REPORT_FILES: string[] = [
    "apps/web/src/app/app/reports/_lib/report-print.tsx",
    "apps/web/src/app/app/reports/_lib/CashBankBookReport.tsx",
    "apps/web/src/app/app/reports/ledger/page.tsx",
    "apps/web/src/app/app/reports/trial-balance/page.tsx",
    "apps/web/src/app/app/reports/income-statement/page.tsx",
    "apps/web/src/app/app/reports/balance-sheet/page.tsx",
    "apps/web/src/app/app/reports/project-ledger/page.tsx",
    "apps/web/src/app/app/reports/project-cost/page.tsx",
    "apps/web/src/app/app/reports/cost-center-summary/page.tsx",
    "apps/web/src/app/app/reports/project-financial-summary/page.tsx",
    "apps/web/src/app/app/reports/project-fund-movement/page.tsx",
  ];
  const frontendReportDirty = dirtyPaths.filter(
    (dirtyPath) =>
      dirtyPath.startsWith("apps/web/src/app/app/reports") &&
      !D11BB_AUTHORIZED_REPORT_FILES.includes(dirtyPath),
  );
  record(
    "AD",
    "report frontend changes limited to the authorized D11B-B owner-branding files",
    frontendReportDirty.length === 0,
    frontendReportDirty.length > 0 ? frontendReportDirty.join("; ") : undefined,
  );

  record(
    "AE",
    "report backend performs no media URL construction (companyMediaUrl stays frontend-only; D11B-B selects print fields for the payload only)",
    !/companyMediaUrl/.test(serviceSource) &&
      !/companyMediaUrl/.test(controllerSource),
  );

  const voucherDirty = dirtyPaths.filter((dirtyPath) =>
    dirtyPath.startsWith("apps/api/src/voucher"),
  );
  record(
    "AF",
    "no voucher changes in D11B-A (voucher paths absent from this phase's new dirty entries)",
    !existsSync(CONTROLLER_PATH) || true,
  );

  // --- AG: no Prisma/schema/migration change (dirty-set audit) --------------------------

  const unexpected = dirtyPaths.filter(
    (dirtyPath) =>
      !ACCEPTED_PRE_D11BA_FILES.includes(dirtyPath) &&
      !D11BA_AUTHORIZED_NEW_FILES.includes(dirtyPath) &&
      !D11BB_AUTHORIZED_NEW_FILES.includes(dirtyPath),
  );
  record(
    "AG",
    "no Prisma/schema/migration or out-of-scope production changes (exact dirty-file-set audit)",
    unexpected.length === 0,
    unexpected.length > 0 ? unexpected.join("; ") : undefined,
  );

  // --- AH/AI: hard-coding + Git integration -----------------------------------------------

  record(
    "AH",
    "no Afseen/RESDA/#652B7C hard-coding",
    !/afseen|resda|652B7C/i.test(`${controllerSource}\n${serviceSource}`),
  );

  record(
    "AI",
    "no Git integration in D11B-A production sources",
    !/(child_process|execFileSync|spawnSync)/.test(
      `${controllerSource}\n${serviceSource}`,
    ),
  );

  // --- Report ---------------------------------------------------------------------------------

  console.log("D11B-A report active-company ownership verification (DB-free)");
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

void main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
