import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as companyApi from "../apps/web/src/lib/api";

/**
 * DB-free D11A verifier: voucher owner-company document branding.
 *
 * Behavioral checks import the real print modules (toPrintBrand,
 * voucherTypeTitle, amountToWords) and exercise them with synthetic
 * companies; source-contract checks cover the voucher detail service, the
 * print document/header, the shared API client types, and a git status audit
 * of the exact authorized dirty-file set. Exits with code 1 on any failure.
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

function exists(relativePath: string): boolean {
  return existsSync(path.join(ROOT, relativePath));
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

// The authoritative 57 individual dirty files accepted through D10.
const ACCEPTED_PRE_D11A_FILES: string[] = [
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
];

// The only files D11A is authorized to add to the dirty set.
const D11A_AUTHORIZED_NEW_FILES: string[] = [
  "apps/web/src/app/app/vouchers/_lib/voucher-print/print-brand.ts",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintDocument.tsx",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintHeader.tsx",
  "scripts/verify-voucher-print.ts",
  "scripts/verify-voucher-owner-company-branding.ts",
];

// D11B-A note: D11B-A is the authorized report active-company access
// ownership phase; its three new dirty entries extend this phase-scope
// enumeration the same way. No behavioral D11A assertion is affected.
const D11BA_AUTHORIZED_NEW_FILES: string[] = [
  "apps/api/src/report/report.controller.ts",
  "apps/api/src/report/report.service.ts",
  "scripts/verify-report-active-company-ownership.ts",
];

// D11B-B note: D11B-B is the authorized report owner-company print branding
// phase; its new dirty entries extend this phase-scope enumeration the same
// way. No behavioral assertion is affected.
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

const SERVICE_PATH = "apps/api/src/voucher/voucher.service.ts";
const CONTROLLER_PATH = "apps/api/src/voucher/voucher.controller.ts";
const API_CLIENT_PATH = "apps/web/src/lib/api.ts";
const PRINT_BRAND_PATH =
  "apps/web/src/app/app/vouchers/_lib/voucher-print/print-brand.ts";
const PRINT_DOCUMENT_PATH =
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintDocument.tsx";
const PRINT_HEADER_PATH =
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintHeader.tsx";

const VOUCHER_TYPES = [
  "DEBIT",
  "CREDIT",
  "JOURNAL",
  "CONTRA",
  "PAYMENT",
  "RECEIPT",
] as const;

// Synthetic owner companies (no real/Afseen/RESDA data).
const syntheticCompanyA = {
  id: "company-a",
  name: "Synthetic Holdings A",
  legalName: "Synthetic Holdings A Ltd",
  address: "1 Synthetic Avenue, District A",
  phone: "+8801700000001",
  email: "accounts@synthetic-a.example",
  currency: "BDT",
  printLogoPath: "presence-a",
  printHeaderName: "Synthetic A",
  printFooterText: "Synthetic A accounts office",
  updatedAt: "2026-01-02T03:04:05.000Z",
};

const syntheticCompanyB = {
  id: "company-b",
  name: "Synthetic Holdings B",
  legalName: "Synthetic Holdings B Ltd",
  address: "2 Synthetic Road, District B",
  phone: "+8801700000002",
  email: "accounts@synthetic-b.example",
  currency: "BDT",
  printLogoPath: null,
  printHeaderName: null,
  printFooterText: null,
  updatedAt: "2026-02-03T04:05:06.000Z",
};

type PrintBrandLike = Record<string, unknown>;

type PrintBrandModule = {
  toPrintBrand: (company: unknown) => PrintBrandLike;
  FALLBACK_LOGO_SRC: string;
};

type VoucherUiModule = {
  voucherTypeTitle: (type: string) => string;
  voucherTypeLabel: (type: string) => string;
};

type AmountToWordsModule = {
  amountToWords: (amount: number) => string;
};

async function loadModule<T>(relativePath: string): Promise<T | null> {
  try {
    return (await import(
      `../${relativePath.replace(/\\/g, "/").replace(/\.ts$/, "")}`
    )) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<number> {
  const serviceSource = (await readSource(SERVICE_PATH)) ?? "";
  const controllerSource = (await readSource(CONTROLLER_PATH)) ?? "";
  const apiClientSource = (await readSource(API_CLIENT_PATH)) ?? "";
  const printBrandSource = (await readSource(PRINT_BRAND_PATH)) ?? "";
  const printDocumentSource = (await readSource(PRINT_DOCUMENT_PATH)) ?? "";
  const printHeaderSource = (await readSource(PRINT_HEADER_PATH)) ?? "";

  const printFiles = [printBrandSource, printDocumentSource, printHeaderSource];
  const printAll = printFiles.join("\n");

  const printBrandModule =
    await loadModule<PrintBrandModule>(
      "apps/web/src/app/app/vouchers/_lib/voucher-print/print-brand.ts",
    );
  const voucherUiModule = await loadModule<VoucherUiModule>(
    "apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx",
  );
  const amountToWordsModule = await loadModule<AmountToWordsModule>(
    "apps/web/src/app/app/vouchers/_lib/voucher-print/amount-to-words.ts",
  );

  // --- A/B: voucher detail returns owning Company from the voucher relation ---

  const findOneIdx = serviceSource.indexOf("async findOne(");
  const findOneBlock =
    findOneIdx === -1
      ? ""
      : serviceSource.slice(findOneIdx, findOneIdx + 2400);

  record(
    "A",
    "Voucher detail response includes its owning Company (select on the voucher relation)",
    /company:\s*\{\s*select:\s*\{/.test(findOneBlock) &&
      /printLogoPath:\s*true/.test(findOneBlock) &&
      /printHeaderName:\s*true/.test(findOneBlock) &&
      /printFooterText:\s*true/.test(findOneBlock),
  );

  record(
    "B",
    "nested Company originates from the voucher relation include (no separate current-company lookup in the voucher service)",
    /where:\s*\{\s*id,\s*companyId,\s*isDeleted:\s*false\s*\}/.test(
      findOneBlock,
    ) && !/prisma\.company\./.test(serviceSource),
  );

  record(
    "C",
    "no session/current-company authority in voucher branding (service keeps D6B active-company scoping only)",
    !/authSession/.test(serviceSource) &&
      !/activeCompanyId/.test(serviceSource) &&
      /@ActiveCompany\(\)/.test(controllerSource) &&
      /requireActiveCompanyId\(/.test(controllerSource),
  );

  // --- D/E: print flow uses the owner company from the voucher payload ------

  record(
    "D",
    "no GET /company branding fetch in the voucher print flow (getCompany removed from the print document)",
    !/getCompany\(/.test(printDocumentSource) &&
      !/getCompanies\(/.test(printAll),
  );

  record(
    "E",
    "VoucherPrintDocument derives branding from voucher.company through toPrintBrand",
    /voucher\.company/.test(printDocumentSource) &&
      /toPrintBrand\(/.test(printDocumentSource) &&
      /company=\{company\}/.test(printDocumentSource),
  );

  // --- F/G/H: print logo presence signal + public URL + no stored path ------

  record(
    "F",
    "printLogoPath acts only as a presence signal (never a rendered URL)",
    printFiles.every(
      (source) =>
        !/src=\{?[^}\n]*printLogoPath/.test(source) &&
        !/url\([^)]*printLogoPath/.test(source),
    ) &&
      /printLogoPath\s*!=\s*null/.test(printHeaderSource),
  );

  record(
    "G",
    "print logo URL uses companyMediaUrl(company.id, \"print-logo\", ...) with the owner-company revision",
    /companyMediaUrl\(\s*company\.id,\s*"print-logo",/.test(
      printBrandSource,
    ) &&
      /updatedAt/.test(printBrandSource),
  );

  record(
    "H",
    "stored printLogoPath never becomes a browser URL",
    !/(src|href|url)\s*[=(]\s*[^"\n]*printLogoPath/.test(printAll),
  );

  record(
    "I",
    "configured print logo renders in the existing header branding area (left logo slot)",
    /brand\.logoSrc/.test(printHeaderSource) &&
      /object-contain/.test(printHeaderSource),
  );

  record(
    "J",
    "missing printLogo preserves the legacy premium fallback wordmark",
    printBrandModule !== null &&
      printBrandModule.toPrintBrand({
        ...syntheticCompanyA,
        printLogoPath: null,
      })["logoSrc"] === printBrandModule.FALLBACK_LOGO_SRC &&
      printBrandModule.toPrintBrand(null)["logoSrc"] ===
        printBrandModule.FALLBACK_LOGO_SRC,
  );

  record(
    "K",
    "broken print logo falls back gracefully (img onError swaps to the fallback wordmark)",
    /onError/.test(printHeaderSource) &&
      /FALLBACK_LOGO_SRC/.test(printHeaderSource),
  );

  // --- L/M: print header name resolution (behavioral, synthetic companies) ---

  if (printBrandModule) {
    const brandA = printBrandModule.toPrintBrand(syntheticCompanyA);
    const brandB = printBrandModule.toPrintBrand(syntheticCompanyB);

    record(
      "L",
      "printHeaderName is preferred when configured (Synthetic A)",
      brandA["companyName"] === "Synthetic A",
      `got ${String(brandA["companyName"])}`,
    );

    record(
      "M",
      "company.name is the fallback for missing printHeaderName (Synthetic B)",
      brandB["companyName"] === "Synthetic Holdings B",
      `got ${String(brandB["companyName"])}`,
    );

    // --- Section 25: dynamic owner-company response distinction -----------

    const logoSrcA = String(brandA["logoSrc"]);
    record(
      "N",
      "owner A vs B resolve distinct document branding (A: configured header name + public print-logo URL; B: name fallback + legacy wordmark)",
      brandA["companyName"] === "Synthetic A" &&
        brandB["companyName"] === "Synthetic Holdings B" &&
        logoSrcA.startsWith(
          `${companyApi.API_BASE_URL}/company-media/company-a/print-logo`,
        ) &&
        !logoSrcA.includes("presence-a") &&
        brandB["logoSrc"] === printBrandModule.FALLBACK_LOGO_SRC &&
        brandA["phone"] === syntheticCompanyA.phone &&
        brandB["phone"] === syntheticCompanyB.phone,
    );

    // --- O: missing optional contact data omits lines (no null printing) --

    const brandNoContact = printBrandModule.toPrintBrand({
      ...syntheticCompanyB,
      phone: null,
      email: null,
      address: null,
    });
    record(
      "O",
      "missing optional contact fields map to null and the header renders lines conditionally",
      brandNoContact["phone"] === null &&
        brandNoContact["email"] === null &&
        brandNoContact["address"] === null &&
        /\{brand\.email \?/.test(printHeaderSource) &&
        /\{brand\.phone \?/.test(printHeaderSource) &&
        /\{brand\.address \?/.test(printHeaderSource),
    );

    // --- P/Q: print footer text integration -------------------------------

    record(
      "P",
      "printFooterText is consumed as plain owner-company text in the footer region",
      /printFooterText/.test(printDocumentSource) &&
        !/dangerouslySetInnerHTML/.test(printDocumentSource),
    );

    record(
      "Q",
      "missing printFooterText preserves the legacy footer line",
      /Generated by Real Capita Accounting & Project Finance System/.test(
        printDocumentSource,
      ) &&
        printBrandModule.toPrintBrand({
          ...syntheticCompanyB,
          printFooterText: null,
        })["companyName"] === "Synthetic Holdings B",
    );
  } else {
    for (const id of ["L", "M", "N", "O", "P", "Q"]) {
      record(id, "print brand behavior unavailable", false, "print-brand.ts not importable");
    }
  }

  // --- R/S: slogan + watermark preserved --------------------------------------

  record(
    "R",
    "exact slogan \"Build Your Dream Here\" remains",
    /Build Your Dream Here/.test(printHeaderSource),
  );

  record(
    "S",
    "generic building watermark remains the approved SVG treatment",
    /voucher-watermark\.svg/.test(printDocumentSource) &&
      /opacity-\[0\.04\]/.test(printDocumentSource),
  );

  // --- T: six voucher types (behavioral) ----------------------------------------

  if (voucherUiModule) {
    record(
      "T",
      "six VoucherTypes keep their exact approved titles",
      VOUCHER_TYPES.every(
        (type) =>
          voucherUiModule.voucherTypeTitle(type) ===
          `${voucherUiModule.voucherTypeLabel(type)} Voucher`,
      ) && voucherUiModule.voucherTypeTitle("PAYMENT") === "Payment Voucher",
    );
  } else {
    record("T", "voucher-ui behavior unavailable", false);
  }

  // --- U: four-column accounting table -------------------------------------------

  record(
    "U",
    "table remains SL | Particulars | Debit | Credit",
    ["SL", "Particulars", "Debit", "Credit"].every((label) =>
      printDocumentSource.includes(label),
    ) &&
      (printDocumentSource.match(/<th[\s>]/g) ?? []).length === 4,
  );

  // --- V: amount-to-words (behavioral) ----------------------------------------------

  if (amountToWordsModule) {
    record(
      "V",
      "amount-to-words keeps the Bangladeshi output behavior",
      amountToWordsModule.amountToWords(5000) === "Five Thousand Taka" &&
        amountToWordsModule.amountToWords(150000) ===
          "One Lac Fifty Thousand Taka",
    );
  } else {
    record("V", "amount-to-words behavior unavailable", false);
  }

  // --- W: four signature areas ---------------------------------------------------------

  record(
    "W",
    "four signature areas remain (Received/Prepared/Checked/Approved By)",
    ["Received By", "Prepared By", "Checked By", "Approved By"].every((label) =>
      printDocumentSource.includes(label),
    ),
  );

  // --- X/Y/Z: session independence -------------------------------------------------------

  record(
    "X",
    "activeCompanyId is not branding authority in the print flow",
    !/activeCompanyId/.test(printAll) && !/getCompanies\(/.test(printAll),
  );

  record(
    "Y",
    "OfficeSwitcher/OfficeThemeShell are not imported into voucher print files",
    !/OfficeSwitcher/.test(printAll) && !/OfficeThemeShell/.test(printAll),
  );

  record(
    "Z",
    "switching the current office cannot change the owner company passed to print (brand derives solely from voucher.company; no session state in print files)",
    /voucher\.company/.test(printDocumentSource) &&
      !/useState<Company>/.test(printDocumentSource) &&
      !/useEffect/.test(printDocumentSource.split("toPrintBrand")[0] ?? ""),
  );

  // --- AA/AB/AC: read-only rendering, no theme coupling, no reports -----------------------

  record(
    "AA",
    "no Company mutation from print code",
    !/(switchCompany|createCompany|updateCompany|uploadCompanyMedia|removeCompanyMedia)/.test(
      printAll,
    ),
  );

  record(
    "AB",
    "no D10 theme variables control voucher print",
    !/(--office-accent|brandAccentColor|OfficeThemeShell|office-theme)/.test(
      printAll,
    ),
  );

  record(
    "AC",
    "no reports implementation in the voucher print flow",
    !/from\s+["'][^"']*\/reports\//.test(printAll),
  );

  // --- AD: no Afseen/RESDA/#652B7C --------------------------------------------------------

  record(
    "AD",
    "no Afseen/RESDA/#652B7C hard-coding in D11A production sources",
    !/afseen|resda|652B7C/i.test(
      `${printAll}\n${serviceSource}\n${apiClientSource}`,
    ),
  );

  // --- AE: no schema/migration change (exact dirty-set audit) ------------------------------

  const dirtyPaths = gitStatusPaths();
  const unexpected = dirtyPaths.filter(
    (dirtyPath) =>
      !ACCEPTED_PRE_D11A_FILES.includes(dirtyPath) &&
      !D11A_AUTHORIZED_NEW_FILES.includes(dirtyPath) &&
      !D11BA_AUTHORIZED_NEW_FILES.includes(dirtyPath) &&
      !D11BB_AUTHORIZED_NEW_FILES.includes(dirtyPath),
  );
  record(
    "AE",
    "no backend schema/migration or out-of-scope production changes (exact dirty-file-set audit)",
    unexpected.length === 0,
    unexpected.length > 0 ? unexpected.join("; ") : undefined,
  );

  // --- AF: no Git integration ----------------------------------------------------------------

  record(
    "AF",
    "no Git integration in D11A production sources",
    !/(child_process|execFileSync|spawnSync)/.test(
      printAll,
    ),
  );

  // --- Frontend type check (part of A/E data flow) -------------------------------------------

  record(
    "AG",
    "frontend Voucher type carries the narrow owner-company summary",
    /export type VoucherCompanySummary = \{/.test(apiClientSource) &&
      /company\?: VoucherCompanySummary;/.test(apiClientSource),
  );

  // --- Report ----------------------------------------------------------------------------------

  console.log("D11A voucher owner-company branding verification (DB-free)");
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
