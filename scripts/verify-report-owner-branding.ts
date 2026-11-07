import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * DB-free D11B-B verifier: report owner-company print branding.
 *
 * Behavioral checks import the real shared print frame and exercise its pure
 * owner-brand resolution helpers with synthetic companies (A configured, B
 * legacy-null). Source-contract checks cover the report service company
 * select, the D11B-A ownership filter, the frontend type, the frame, the
 * shared Cash/Bank/MFS wrapper, all report page call sites, and a git status
 * audit of the exact authorized dirty-file set. Exits with code 1 on failure.
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

// The authoritative 65 individual dirty files accepted through D11B-A.
const ACCEPTED_PRE_D11BB_FILES: string[] = [
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
  "apps/api/src/report/report.controller.ts",
  "apps/api/src/report/report.service.ts",
  "scripts/verify-report-active-company-ownership.ts",
];

// The only files D11B-B is authorized to add to the dirty set.
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

const SERVICE_PATH = "apps/api/src/report/report.service.ts";
const CONTROLLER_PATH = "apps/api/src/report/report.controller.ts";
const API_CLIENT_PATH = "apps/web/src/lib/api.ts";
const FRAME_PATH = "apps/web/src/app/app/reports/_lib/report-print.tsx";
const WRAPPER_PATH = "apps/web/src/app/app/reports/_lib/CashBankBookReport.tsx";

// The 9 report pages that call the frame directly (cash/bank/mfs flow through
// the shared wrapper).
const DIRECT_FRAME_PAGES = [
  "ledger",
  "trial-balance",
  "income-statement",
  "balance-sheet",
  "project-ledger",
  "project-cost",
  "cost-center-summary",
  "project-financial-summary",
  "project-fund-movement",
] as const;

// Synthetic owner companies (no real/Afseen/RESDA data).
const SYNTHETIC_A = {
  id: "company-a",
  name: "Synthetic Holdings A",
  legalName: "Synthetic Holdings A Ltd",
  address: "1 Synthetic Avenue, District A",
  phone: "+8801700000001",
  email: "accounts@synthetic-a.example",
  currency: "BDT",
  printLogoPath: "presence-a",
  printHeaderName: "Synthetic A",
  printFooterText: "Synthetic A Footer",
  updatedAt: "2026-01-02T03:04:05.000Z",
};

const SYNTHETIC_B = {
  id: "company-b",
  name: "Synthetic Holdings B",
  legalName: "Synthetic Holdings B Ltd",
  address: null,
  phone: null,
  email: null,
  currency: "BDT",
  printLogoPath: null,
  printHeaderName: null,
  printFooterText: null,
  updatedAt: "2026-02-03T04:05:06.000Z",
};

type OwnerCompanyLike = typeof SYNTHETIC_A;

type FrameModule = {
  resolveOwnerHeading?: (company: OwnerCompanyLike | null) => string;
  ownerPrintLogoSrc?: (company: OwnerCompanyLike) => string | null;
  ownerContactItems?: (company: OwnerCompanyLike) => string[];
  resolveOwnerFooterText?: (company: OwnerCompanyLike) => string | null;
  FALLBACK_REPORT_HEADING?: string;
};

async function loadFrameModule(): Promise<FrameModule | null> {
  try {
    return (await import(
      "../apps/web/src/app/app/reports/_lib/report-print"
    )) as FrameModule;
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  const serviceSource = (await readSource(SERVICE_PATH)) ?? "";
  const controllerSource = (await readSource(CONTROLLER_PATH)) ?? "";
  const apiClientSource = (await readSource(API_CLIENT_PATH)) ?? "";
  const frameSource = (await readSource(FRAME_PATH)) ?? "";
  const wrapperSource = (await readSource(WRAPPER_PATH)) ?? "";

  const printSources = [frameSource, wrapperSource];
  const printAll = printSources.join("\n");

  const pageSources: Record<string, string> = {};
  for (const page of DIRECT_FRAME_PAGES) {
    pageSources[page] =
      (await readSource(`apps/web/src/app/app/reports/${page}/page.tsx`)) ??
      "";
  }
  const allPages = Object.values(pageSources).join("\n");

  const frameModule = await loadFrameModule();

  // --- A–E: backend Company summary print fields ------------------------------

  const fiscalYearSummaryMatch = serviceSource.match(
    /type FiscalYearSummary = \{[\s\S]*?\n\};/,
  );
  const fiscalYearSummaryText = fiscalYearSummaryMatch
    ? fiscalYearSummaryMatch[0]
    : "";

  for (const [id, field] of [
    ["A", "printLogoPath"],
    ["B", "printHeaderName"],
    ["C", "printFooterText"],
    ["E", "updatedAt"],
  ] as const) {
    record(
      id,
      `backend FiscalYearSummary company includes ${field}`,
      new RegExp(`${field}:`).test(fiscalYearSummaryText),
    );
  }
  record(
    "D",
    "backend FiscalYearSummary company includes address/phone/email",
    /address:/.test(fiscalYearSummaryText) &&
      /phone:/.test(fiscalYearSummaryText) &&
      /email:/.test(fiscalYearSummaryText),
  );

  // --- F: both resolvers select the owner print fields -------------------------

  const resolverCount = (
    serviceSource.match(/company: \{\s*select: \{/g) ?? []
  ).length;
  const selectHasPrintFields =
    /company: \{\s*select: \{[\s\S]{0,700}?printLogoPath: true[\s\S]{0,400}?printHeaderName: true[\s\S]{0,400}?printFooterText: true[\s\S]{0,400}?updatedAt: true/.test(
      serviceSource,
    );
  record(
    "F",
    "both report context resolvers select the owner print fields (narrow company select)",
    resolverCount === 2 && selectHasPrintFields,
    `resolverSelects=${resolverCount}`,
  );

  // --- G: D11B-A ownership filter still exists ---------------------------------

  const ownershipFilters = (
    serviceSource.match(
      /where: \{\s*companyId,\s*id: query\.fiscalYearId,?\s*\}/g,
    ) ?? []
  ).length;
  record(
    "G",
    "D11B-A FiscalYear companyId ownership filter still exists in both resolvers",
    ownershipFilters === 2 &&
      (controllerSource.match(/@ActiveCompany\(\)/g) ?? []).length === 12 &&
      /requireActiveCompanyId\(/.test(controllerSource) &&
      !/fiscalYear\.findUnique\(\{\s*where: \{ id: query\.fiscalYearId \}/.test(
        serviceSource,
      ),
    `ownershipFilters=${ownershipFilters}`,
  );

  // --- H: no second/current Company lookup ---------------------------------------

  record(
    "H",
    "no second/current Company lookup added (no prisma.company usage in the report service)",
    !/prisma\.company\./.test(serviceSource),
  );

  // --- I: frontend ReportCompanySummary print fields ------------------------------

  const reportCompanySummaryMatch = apiClientSource.match(
    /export type ReportCompanySummary = \{[\s\S]*?\n\};/,
  );
  const reportCompanySummaryText = reportCompanySummaryMatch
    ? reportCompanySummaryMatch[0]
    : "";
  record(
    "I",
    "frontend ReportCompanySummary includes the print branding fields",
    /printLogoPath: string \| null;/.test(reportCompanySummaryText) &&
      /printHeaderName: string \| null;/.test(reportCompanySummaryText) &&
      /printFooterText: string \| null;/.test(reportCompanySummaryText) &&
      /address: string \| null;/.test(reportCompanySummaryText) &&
      /phone: string \| null;/.test(reportCompanySummaryText) &&
      /email: string \| null;/.test(reportCompanySummaryText) &&
      /updatedAt: string;/.test(reportCompanySummaryText),
  );

  // --- J: frame accepts owner Company explicitly -----------------------------------

  record(
    "J",
    "ReportPrintFrame accepts the owner Company explicitly (ownerCompany prop)",
    /ownerCompany: ReportCompanySummary/.test(frameSource) &&
      /ownerCompany=\{report\.fiscalYear\.company\}/.test(allPages),
  );

  // --- K–M, S, T, U: behavioral owner-brand resolution -------------------------------

  if (
    frameModule &&
    typeof frameModule.resolveOwnerHeading === "function" &&
    typeof frameModule.ownerPrintLogoSrc === "function" &&
    typeof frameModule.ownerContactItems === "function" &&
    typeof frameModule.resolveOwnerFooterText === "function"
  ) {
    const resolveOwnerHeading = frameModule.resolveOwnerHeading;
    const ownerPrintLogoSrc = frameModule.ownerPrintLogoSrc;
    const ownerContactItems = frameModule.ownerContactItems;
    const resolveOwnerFooterText = frameModule.resolveOwnerFooterText;

    record(
      "K",
      "heading uses printHeaderName first (Synthetic A)",
      resolveOwnerHeading(SYNTHETIC_A) === "Synthetic A",
      `got ${resolveOwnerHeading(SYNTHETIC_A)}`,
    );

    record(
      "L",
      "heading falls back to company.name when printHeaderName is null (Synthetic B)",
      resolveOwnerHeading(SYNTHETIC_B) === "Synthetic Holdings B",
      `got ${resolveOwnerHeading(SYNTHETIC_B)}`,
    );

    const legacyCompany = {
      ...SYNTHETIC_B,
      name: "Real Capita Group",
      printHeaderName: null,
    };
    record(
      "M",
      "final heading fallback remains \"Real Capita Group\" for the legacy row",
      resolveOwnerHeading(legacyCompany) === "Real Capita Group",
      `got ${resolveOwnerHeading(legacyCompany)}`,
    );

    // --- N/O/P/Q: print logo ---------------------------------------------------

    const logoSrcA = ownerPrintLogoSrc(SYNTHETIC_A);
    const expectedRevision = Date.parse(SYNTHETIC_A.updatedAt);
    record(
      "N",
      "configured print logo uses companyMediaUrl with the owner-company updatedAt revision",
      logoSrcA ===
        `http://localhost:4000/company-media/company-a/print-logo?v=${expectedRevision}`,
      `got ${logoSrcA}`,
    );

    record(
      "O",
      "the company id used in the logo URL is ownerCompany.id (and the stored path never appears)",
      logoSrcA !== null &&
        logoSrcA.includes("company-a") &&
        !logoSrcA.includes("presence-a"),
    );

    record(
      "P",
      "printLogoPath is never directly rendered as a URL (no src/url bound to the stored path)",
      !/src=\{?[^}\n]*printLogoPath/.test(printAll) &&
        !/url\([^)]*printLogoPath/.test(printAll),
    );

    record(
      "Q",
      "missing logo returns null (legacy case renders no logo element)",
      ownerPrintLogoSrc(SYNTHETIC_B) === null &&
        /hasPrintLogo[\s\S]{0,200}?<img/.test(frameSource),
    );

    // --- S/T: contact ------------------------------------------------------------

    const contactA = ownerContactItems(SYNTHETIC_A);
    record(
      "S",
      "owner phone/email/address are available to the frame (Synthetic A resolves all three)",
      contactA.length === 3 &&
        contactA.includes(SYNTHETIC_A.phone ?? "") &&
        contactA.includes(SYNTHETIC_A.email ?? "") &&
        contactA.includes(SYNTHETIC_A.address ?? ""),
      `got ${contactA.join(" | ")}`,
    );

    const contactB = ownerContactItems(SYNTHETIC_B);
    record(
      "T",
      "missing contact values produce no items (no null/undefined/empty strings printed)",
      contactB.length === 0 &&
        contactB.every((item) => typeof item === "string" && item.length > 0),
    );

    // --- U: owner footer ----------------------------------------------------------

    record(
      "U",
      "printFooterText resolves as owner-company plain text (Synthetic A Footer)",
      resolveOwnerFooterText(SYNTHETIC_A) === "Synthetic A Footer" &&
        resolveOwnerFooterText(SYNTHETIC_B) === null &&
        resolveOwnerFooterText({ ...SYNTHETIC_A, printFooterText: "   " }) ===
          null,
    );

    // --- AH: historical owner independence ---------------------------------------

    record(
      "AH",
      "historical Company A payload remains Company A branded regardless of any Company B context",
      resolveOwnerHeading(SYNTHETIC_A) === "Synthetic A" &&
        ownerPrintLogoSrc(SYNTHETIC_A)?.includes("company-a") === true &&
        resolveOwnerHeading(SYNTHETIC_B) === "Synthetic Holdings B",
    );
  } else {
    for (const id of ["K", "L", "M", "N", "O", "Q", "S", "T", "U", "AH"]) {
      record(
        id,
        "owner-brand resolution behavior unavailable",
        false,
        "report-print.tsx owner-brand helpers not implemented",
      );
    }
  }

  // --- R: broken logo graceful fallback (source) -----------------------------------

  record(
    "R",
    "broken logo has a graceful fallback (img onError hides the slot; no broken-image icon)",
    /onError/.test(frameSource),
  );

  // --- V/W: platform footer preservation ---------------------------------------------

  record(
    "V",
    "existing platform footer remains (Real Capita Accounting & Project Finance System)",
    /Real Capita Accounting &(?:amp;)? Project Finance System/.test(frameSource),
  );

  const footerIdx = frameSource.indexOf("resolveOwnerFooterText");
  const platformFooterIdx = frameSource.indexOf(
    "Real Capita Accounting &",
  );
  record(
    "W",
    "owner footer does NOT replace the platform footer (owner line rendered separately above it)",
    /ownerFooterText/.test(frameSource) &&
      footerIdx !== -1 &&
      platformFooterIdx !== -1 &&
      footerIdx < platformFooterIdx &&
      !/dangerouslySetInnerHTML/.test(frameSource),
  );

  // --- X: Company meta row remains owner company --------------------------------------

  const pagesWithCompanyMeta = DIRECT_FRAME_PAGES.filter((page) =>
    /\{ label: "Company", value: report\.fiscalYear\.company\.name \}/.test(
      pageSources[page],
    ),
  );
  const wrapperCompanyMeta = /label: "Company", value: report\.fiscalYear\.company\.name/.test(
    wrapperSource,
  );
  record(
    "X",
    "Company meta row remains the owner company on every report (9 pages + wrapper)",
    pagesWithCompanyMeta.length === 9 && wrapperCompanyMeta,
    `pages=${pagesWithCompanyMeta.length}/9`,
  );

  // --- Y/Z/AA: title/meta/signatures/print architecture ---------------------------------

  record(
    "Y",
    "report title/meta behavior preserved (title prop + meta grid unchanged)",
    /title: string;/.test(frameSource) &&
      /meta: PrintMetaItem\[\];/.test(frameSource) &&
      /meta\.map\(\(item\) =>/.test(frameSource),
  );

  record(
    "Z",
    "three report signatures remain (Prepared/Checked/Authorised)",
    /Prepared by/.test(frameSource) &&
      /Checked by/.test(frameSource) &&
      /Authorised by/.test(frameSource),
  );

  record(
    "AA",
    "print CSS/window.print architecture preserved (visibility print, @page 14mm 12mm 16mm 12mm)",
    /window\.print\(\)/.test(frameSource) &&
      /@page \{ margin: 14mm 12mm 16mm 12mm; size: A4; \}/.test(frameSource) &&
      /visibility: hidden/.test(frameSource),
  );

  // --- AB: all 12 reports feed FiscalYear.company into the shared frame -------------------

  const pagesWithOwner = DIRECT_FRAME_PAGES.filter((page) =>
    /ownerCompany=\{report\.fiscalYear\.company\}/.test(pageSources[page]),
  );
  record(
    "AB",
    "all 12 reports feed fiscalYear.company into the shared frame (9 direct pages + shared wrapper)",
    pagesWithOwner.length === 9 &&
      /ownerCompany=\{report\.fiscalYear\.company\}/.test(wrapperSource),
    `directPages=${pagesWithOwner.length}/9`,
  );

  // --- AC: Cash/Bank/MFS coverage through the wrapper --------------------------------------

  const wrapperFeedsFrame = /ownerCompany=\{report\.fiscalYear\.company\}/.test(
    wrapperSource,
  );
  const bookPagesRenderWrapper = await Promise.all(
    ["cash-book", "bank-book", "mfs-book"].map(async (page) => {
      const source =
        (await readSource(
          `apps/web/src/app/app/reports/${page}/page.tsx`,
        )) ?? "";
      return /<CashBankBookReport/.test(source);
    }),
  );
  record(
    "AC",
    "Cash/Bank/MFS Books are covered through the shared CashBankBookReport wrapper",
    wrapperFeedsFrame && bookPagesRenderWrapper.every(Boolean),
  );

  // --- AD–AF/AG: no session/theme dependencies ---------------------------------------------

  record(
    "AD",
    "no getCompany/getCompanies branding fetch in the report print path",
    !/getCompany\(|getCompanies\(/.test(printAll),
  );

  record(
    "AE",
    "no activeCompanyId branding dependency in the report print path",
    !/activeCompanyId/.test(printAll),
  );

  record(
    "AF",
    "no OfficeThemeShell/OfficeSwitcher dependency in the report print path",
    !/OfficeThemeShell/.test(printAll) && !/OfficeSwitcher/.test(printAll),
  );

  record(
    "AG",
    "no brandAccentColor/D10 theme coupling in the report print path",
    !/(brandAccentColor|--office-accent|backgroundMode|custom-background)/.test(
      printAll,
    ),
  );

  // --- AI: no report-access ownership regression ---------------------------------------------

  record(
    "AI",
    "no report-access ownership regression (D11B-A controller/service contract intact)",
    (controllerSource.match(/@ActiveCompany\(\)/g) ?? []).length === 12 &&
      (serviceSource.match(
        /\(companyId: string, query: ReportQueryDto/g,
      ) ?? []).length >= 12 &&
      /where: \{\s*companyId,\s*id: query\.fiscalYearId,?\s*\}/.test(
        serviceSource,
      ),
  );

  // --- AJ: no voucher changes (dirty-set audit covers this) -----------------------------------

  const dirtyPaths = gitStatusPaths();
  const voucherNewlyDirty = dirtyPaths.filter(
    (dirtyPath) =>
      dirtyPath.startsWith("apps/web/src/app/app/vouchers") &&
      !ACCEPTED_PRE_D11BB_FILES.includes(dirtyPath),
  );
  record(
    "AJ",
    "no voucher changes in D11B-B",
    voucherNewlyDirty.length === 0,
    voucherNewlyDirty.length > 0 ? voucherNewlyDirty.join("; ") : undefined,
  );

  // --- AK: no hard-coding ----------------------------------------------------------------------

  record(
    "AK",
    "no Afseen/RESDA/#652B7C hard-coding in D11B-B sources",
    !/afseen|resda|652B7C/i.test(
      `${printAll}\n${serviceSource}\n${apiClientSource}`,
    ),
  );

  // --- AL: no schema/migration change (exact dirty-set audit) ----------------------------------

  const unexpected = dirtyPaths.filter(
    (dirtyPath) =>
      !ACCEPTED_PRE_D11BB_FILES.includes(dirtyPath) &&
      !D11BB_AUTHORIZED_NEW_FILES.includes(dirtyPath),
  );
  record(
    "AL",
    "no schema/migration or out-of-scope production changes (exact dirty-file-set audit)",
    unexpected.length === 0,
    unexpected.length > 0 ? unexpected.join("; ") : undefined,
  );

  // --- AM: no Git integration --------------------------------------------------------------------

  record(
    "AM",
    "no Git integration in D11B-B production sources",
    !/(child_process|execFileSync|spawnSync)/.test(printAll),
  );

  // --- Report --------------------------------------------------------------------------------------

  console.log("D11B-B report owner-company branding verification (DB-free)");
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
