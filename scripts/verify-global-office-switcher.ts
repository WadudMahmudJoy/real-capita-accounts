import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * DB-free D9 verifier: global office switcher in the application header.
 *
 * Source-contract checks read the real app layout and the OfficeSwitcher
 * component; a git-status audit pins the exact authorized dirty-file set.
 * No database connection. Exits with code 1 on any failure.
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

/** Extracts a top-level component-internal function body (2-space indent). */
function functionBody(source: string, name: string): string | null {
  const match = source.match(
    new RegExp(`function ${name}\\([^)]*\\)[^{]*\\{[\\s\\S]*?\\n  \\}`),
  );
  return match ? match[0] : null;
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

// The authoritative 50 individual dirty files accepted through D8.1.
const ACCEPTED_D8_DIRTY_FILES: string[] = [
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
];

// The only production/verifier files D9 is authorized to add or modify.
const D9_AUTHORIZED_FILES: string[] = [
  "apps/web/src/app/app/layout.tsx",
  "apps/web/src/app/app/_components/OfficeSwitcher.tsx",
  "scripts/verify-global-office-switcher.ts",
];

// D10 note: D10 is the authorized office theme phase; its four new dirty
// entries extend this phase-scope enumeration so the audit keeps pinning the
// exact accepted working set. No behavioral D9 assertion is affected.
const D10_AUTHORIZED_FILES: string[] = [
  "apps/web/src/app/app/_lib/office-theme.ts",
  "apps/web/src/app/app/_components/OfficeThemeShell.tsx",
  "apps/web/src/app/globals.css",
  "scripts/verify-dynamic-office-theme.ts",
];

// D11A note: D11A is the authorized voucher owner-company document branding
// phase; its five new dirty entries extend this phase-scope enumeration the
// same way. No behavioral D9 assertion is affected.
const D11A_AUTHORIZED_FILES: string[] = [
  "apps/web/src/app/app/vouchers/_lib/voucher-print/print-brand.ts",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintDocument.tsx",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintHeader.tsx",
  "scripts/verify-voucher-print.ts",
  "scripts/verify-voucher-owner-company-branding.ts",
];

// D11B-A note: D11B-A is the authorized report active-company access
// ownership phase; its three new dirty entries extend this phase-scope
// enumeration the same way. No behavioral D9 assertion is affected.
const D11BA_AUTHORIZED_FILES: string[] = [
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

const THEME_FIELD_TOKENS =
  "brandAccentColor|backgroundMode|customBackgroundPath|officeLogoPath";

async function main(): Promise<number> {
  const LAYOUT_PATH = "apps/web/src/app/app/layout.tsx";
  const SWITCHER_PATH = "apps/web/src/app/app/_components/OfficeSwitcher.tsx";

  const layout = (await readSource(LAYOUT_PATH)) ?? "";
  const switcher = (await readSource(SWITCHER_PATH)) ?? "";
  const switcherExists = exists(SWITCHER_PATH) && switcher !== "";
  const missingDetail = switcherExists ? undefined : "OfficeSwitcher.tsx missing";

  const switchHandler =
    functionBody(switcher, "handleSwitchCompany") ?? "";

  // --- A: component exists ------------------------------------------------------

  record(
    "A",
    "OfficeSwitcher component exists",
    switcherExists && /export function OfficeSwitcher\(/.test(switcher),
  );

  // --- B: rendered before user/sign-out controls ---------------------------------

  const officeIdx = layout.indexOf("<OfficeSwitcher");
  const userIdx = layout.indexOf("{user.fullName}");
  const signOutIdx = layout.indexOf("Sign out");
  const switcherImported =
    /import\s*\{[^}]*OfficeSwitcher[^}]*\}\s*from\s*"\.\/_components\/OfficeSwitcher"/.test(
      layout,
    );
  record(
    "B",
    "layout renders OfficeSwitcher before the Accountant user / Sign out controls",
    switcherImported &&
      officeIdx !== -1 &&
      userIdx !== -1 &&
      signOutIdx !== -1 &&
      officeIdx < userIdx &&
      userIdx < signOutIdx,
  );

  // --- C: platform identity remains -----------------------------------------------

  record(
    "C",
    "existing Real Capita platform identity remains (logo, name, subtitle)",
    /REAL CAPITA GROUP/.test(layout) &&
      /Accounting &amp; Project Finance System/.test(layout) &&
      /\/brand\/real-capita-group-mark\.png/.test(layout),
  );

  // --- D: loads getCompanies() ------------------------------------------------------

  record(
    "D",
    "switcher loads getCompanies() from the shared API client",
    switcherExists &&
      /await getCompanies\(/.test(switcher) &&
      /import\s*\{[^}]*getCompanies[^}]*\}\s*from\s*"@\/lib\/api"/.test(switcher),
    missingDetail,
  );

  // --- E: current office via activeCompanyId equality -------------------------------

  record(
    "E",
    "current office identified strictly by company.id === activeCompanyId",
    switcherExists &&
      /company\.id === activeCompanyId/.test(switcher) &&
      /companies\.find\(\(company\) => company\.id === activeCompanyId\)/.test(
        switcher,
      ),
    missingDetail,
  );

  // --- F: no singletonKey / PRIMARY logic ---------------------------------------------

  record(
    "F",
    "no singletonKey / PRIMARY current-office logic",
    !/singletonKey/.test(switcher) && !/["']PRIMARY["']/.test(switcher),
  );

  // --- G: current office cannot trigger unnecessary switch ------------------------------

  record(
    "G",
    "current office cannot trigger an unnecessary switch (handler guard + disabled row)",
    switcherExists &&
      /company\.id === activeCompanyId/.test(switchHandler) &&
      /const canSwitch =[\s\S]{0,120}company\.isActive[\s\S]{0,60}!isCurrentOffice/.test(
        switcher,
      ) &&
      /disabled=\{!canSwitch\}/.test(switcher),
    missingDetail,
  );

  // --- H: inactive office visible ----------------------------------------------------------

  record(
    "H",
    "inactive offices remain visible (no isActive filtering, Inactive indicator)",
    switcherExists &&
      !/companies\.filter\([^)]*isActive/.test(switcher) &&
      /!company\.isActive/.test(switcher) &&
      />Inactive</.test(switcher),
    missingDetail,
  );

  // --- I: inactive office cannot invoke switchCompany ----------------------------------------

  record(
    "I",
    "inactive office cannot invoke switchCompany (handler guard + disabled row)",
    switcherExists &&
      /!company\.isActive/.test(switchHandler) &&
      /const canSwitch =[\s\S]{0,120}company\.isActive/.test(switcher),
    missingDetail,
  );

  // --- J: current inactive office displayed truthfully -----------------------------------------

  record(
    "J",
    "current inactive office is displayed truthfully (Current + conditional Inactive)",
    switcherExists &&
      /!currentOffice\.isActive/.test(switcher) &&
      />Current</.test(switcher) &&
      />Inactive</.test(switcher),
    missingDetail,
  );

  // --- K: active other office uses switchCompany(company.id) -------------------------------------

  record(
    "K",
    "switching an active other office calls switchCompany(company.id)",
    switcherExists &&
      /switchCompany\(company\.id\)/.test(switchHandler) &&
      /import\s*\{[^}]*switchCompany[^}]*\}\s*from\s*"@\/lib\/api"/.test(switcher),
    missingDetail,
  );

  // --- L: only explicit user action switches company ------------------------------------------------

  const switchCallCount = (switcher.match(/switchCompany\(/g) ?? []).length;
  record(
    "L",
    "only explicit user action switches company (single call site inside the click handler, none in effects)",
    switcherExists &&
      switchCallCount === 1 &&
      /onClick=\{\(\) => void handleSwitchCompany\(company\)\}/.test(switcher) &&
      switchHandler !== "" &&
      !/useEffect/.test(switchHandler),
    missingDetail ?? `callCount=${switchCallCount}`,
  );

  // --- M: no optimistic activeCompanyId mutation -----------------------------------------------------

  record(
    "M",
    "no optimistic activeCompanyId mutation before server success",
    !/setActiveCompanyId/.test(switcher),
  );

  // --- N: successful switch performs full reload ------------------------------------------------------

  const switchIdx = switcher.indexOf("await switchCompany(");
  const reloadIdx = switcher.indexOf("window.location.reload()");
  const catchAfterSwitchIdx =
    switchIdx === -1 ? -1 : switcher.indexOf("} catch", switchIdx);
  record(
    "N",
    "successful switch performs a full current-page reload after server success",
    switcherExists &&
      switchIdx !== -1 &&
      reloadIdx !== -1 &&
      switchIdx < reloadIdx &&
      (catchAfterSwitchIdx === -1 || reloadIdx < catchAfterSwitchIdx),
    missingDetail,
  );

  // --- O: failed switch does not reload ----------------------------------------------------------------

  const reloadCount = (switcher.match(/window\.location\.reload\(\)/g) ?? [])
    .length;
  record(
    "O",
    "failed switch does not reload (single reload site, inside the success path only)",
    switcherExists && reloadCount === 1,
    missingDetail ?? `reloadCount=${reloadCount}`,
  );

  // --- P: no router.refresh()-only refresh ---------------------------------------------------------------

  record(
    "P",
    "no router.refresh()-only implementation (full reload is the refresh mechanism)",
    !/router\.refresh\(\)/.test(switcher) && /window\.location\.reload\(\)/.test(switcher),
  );

  // --- Q: loading state prevents duplicate switches ---------------------------------------------------------

  record(
    "Q",
    "switching state prevents duplicate switch actions (guard + disabled rows)",
    switcherExists &&
      /switchingCompanyId !== null/.test(switchHandler) &&
      /switchingCompanyId === null/.test(switcher) &&
      /disabled=\{!canSwitch\}/.test(switcher),
    missingDetail,
  );

  // --- R: zero-company state handled ---------------------------------------------------------------------------

  record(
    "R",
    "zero-company state handled (No office configured)",
    switcherExists && /No office configured/.test(switcher),
    missingDetail,
  );

  // --- S: Manage Company Setup links to /app/company ------------------------------------------------------------

  record(
    "S",
    "Manage Company Setup action links to /app/company",
    switcherExists &&
      /Manage Company Setup/.test(switcher) &&
      /href="\/app\/company"/.test(switcher),
    missingDetail,
  );

  // --- T: no /app/offices route invented ---------------------------------------------------------------------------

  record(
    "T",
    "no /app/offices or /app/multi-office route invented",
    !exists("apps/web/src/app/app/offices") &&
      !exists("apps/web/src/app/app/multi-office"),
  );

  // --- U: accessible button trigger ------------------------------------------------------------------------------------

  record(
    "U",
    "trigger is an accessible button with a clear aria-label",
    switcherExists &&
      /aria-label=\{[\s\S]{0,160}`Switch office/.test(switcher) &&
      /type="button"/.test(switcher),
    missingDetail,
  );

  // --- V: aria-expanded / menu semantics ----------------------------------------------------------------------------------

  record(
    "V",
    "aria-expanded, aria-haspopup, and menu/menuitem semantics exist",
    switcherExists &&
      /aria-expanded=\{isOpen\}/.test(switcher) &&
      /aria-haspopup="menu"/.test(switcher) &&
      /role="menu"/.test(switcher) &&
      /role="menuitem"/.test(switcher),
    missingDetail,
  );

  // --- W: Escape closes the menu -------------------------------------------------------------------------------------------

  record(
    "W",
    "Escape closes the menu",
    switcherExists && /"Escape"/.test(switcher),
    missingDetail,
  );

  // --- X: outside-click close ------------------------------------------------------------------------------------------------

  record(
    "X",
    "outside-click close exists (document listener + container containment)",
    switcherExists &&
      /document\.addEventListener\("pointerdown"/.test(switcher) &&
      /\.contains\(event\.target/.test(switcher),
    missingDetail,
  );

  // --- Y: responsive / truncation safeguards -----------------------------------------------------------------------------------

  record(
    "Y",
    "responsive and truncation safeguards exist (viewport-safe panel width, truncated names)",
    switcherExists &&
      /truncate/.test(switcher) &&
      /w-\[min\(/.test(switcher) &&
      /hidden[^"]*md:inline/.test(switcher),
    missingDetail,
  );

  // --- Z: D10 theme boundary (enduring D9 invariants) ------------------------------

  // D10 note: the original D9 phase boundary asserted no dynamic sidebar/
  // background styling. D10 is the authorized office theme phase, so this
  // check now pins the enduring invariants: the OfficeSwitcher owns no theme
  // authority (no branding data fields, no theme derivation), dynamic theming
  // lives in OfficeThemeShell resolved from the ACTIVE company, and the
  // sidebar platform structure stays intact.

  const officeThemeShell =
    (await readSource(
      "apps/web/src/app/app/_components/OfficeThemeShell.tsx",
    )) ?? "";

  const switcherOwnsNoThemeAuthority =
    !new RegExp(THEME_FIELD_TOKENS).test(switcher) &&
    !/resolveOfficeTheme/.test(switcher) &&
    !/companyMediaUrl/.test(switcher);

  const themeLivesInShellResolvedFromActiveCompany =
    officeThemeShell !== "" &&
    /resolveOfficeTheme\(/.test(officeThemeShell) &&
    /company\.id === companyList\.activeCompanyId/.test(officeThemeShell);

  const sidebarStructureIntact =
    /app-sidebar/.test(layout) && /--sidebar-blue/.test(layout);

  record(
    "Z",
    "D10 theme boundary: OfficeSwitcher owns no theme authority; dynamic theme lives in OfficeThemeShell resolved from the active company; sidebar platform structure intact",
    switcherOwnsNoThemeAuthority &&
      themeLivesInShellResolvedFromActiveCompany &&
      sidebarStructureIntact,
  );

  // --- AA: contextual accent only via CSS variables (enduring D9 invariant) ----------

  // D10 note: the original D9 boundary forbade any brandAccentColor /
  // custom-background application in D9 files. D10 is the authorized theme
  // phase, so this check now pins the enduring invariant: the switcher may
  // consume the CSS accent variable for subtle contextual styling only —
  // custom backgrounds are applied exclusively by OfficeThemeShell through
  // the public companyMediaUrl endpoint.

  record(
    "AA",
    "switcher applies at most CSS-variable contextual accent styling; custom backgrounds are applied only by OfficeThemeShell via companyMediaUrl",
    !new RegExp(THEME_FIELD_TOKENS).test(switcher) &&
      !/companyMediaUrl/.test(switcher) &&
      !/backgroundImage/.test(switcher) &&
      /companyMediaUrl\(/.test(officeThemeShell),
  );

  // --- AB: no Afseen/RESDA/#652B7C ---------------------------------------------------------------------------------------------------

  record(
    "AB",
    "no Afseen/RESDA/#652B7C hard-coding",
    !/afseen|resda|652B7C/i.test(switcher) && !/afseen|resda|652B7C/i.test(layout),
  );

  // --- AC: existing Sign out remains ----------------------------------------------------------------------------------------------------

  record(
    "AC",
    "existing Sign out control remains",
    /Sign out/.test(layout) && /handleLogout/.test(layout),
  );

  // --- AD: existing user information remains ---------------------------------------------------------------------------------------------

  record(
    "AD",
    "existing Accountant user information remains (name + roles)",
    /\{user\.fullName\}/.test(layout) && /\{roleNames\}/.test(layout),
  );

  // --- AE: no backend/schema changes (exact dirty-set audit) -------------------------------------------------------------------------------

  const dirtyPaths = gitStatusPaths();
  const unexpected = dirtyPaths.filter(
    (dirtyPath) =>
      !ACCEPTED_D8_DIRTY_FILES.includes(dirtyPath) &&
      !D9_AUTHORIZED_FILES.includes(dirtyPath) &&
      !D10_AUTHORIZED_FILES.includes(dirtyPath) &&
      !D11A_AUTHORIZED_FILES.includes(dirtyPath) &&
      !D11BA_AUTHORIZED_FILES.includes(dirtyPath) &&
      !D11BB_AUTHORIZED_NEW_FILES.includes(dirtyPath),
  );
  record(
    "AE",
    "no backend/schema or out-of-scope production changes (exact dirty-file-set audit)",
    unexpected.length === 0,
    unexpected.length > 0 ? unexpected.join("; ") : undefined,
  );

  // --- AF: getCompanies/switchCompany helpers reused -----------------------------------------------------------------------------------------

  record(
    "AF",
    "getCompanies/switchCompany API helpers reused from @/lib/api (no duplicated fetch routes)",
    switcherExists &&
      /import\s*\{[^}]*getCompanies[^}]*switchCompany[^}]*\}\s*from\s*"@\/lib\/api"/.test(
        switcher,
      ) &&
      !/fetch\(/.test(switcher),
    missingDetail,
  );

  // --- AG: no office creation/media upload in the switcher ------------------------------------------------------

  record(
    "AG",
    "no office creation or media upload happens in the switcher",
    switcherExists &&
      !/(createCompany|updateCompany|uploadCompanyMedia|removeCompanyMedia)/.test(
        switcher,
      ),
    missingDetail,
  );

  // --- Report -----------------------------------------------------------------------------------------------------

  console.log("D9 global office switcher verification (DB-free)");
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
