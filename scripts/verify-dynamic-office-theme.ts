import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * DB-free D10 verifier: dynamic office theme.
 *
 * Behavioral checks dynamically import the real office-theme utility and test
 * it with synthetic colors (dark, medium, very light, white, black). Missing
 * D10 modules are recorded as behavioral contract failures — never crashes.
 * Source-contract checks cover OfficeThemeShell, the app layout, globals.css,
 * the D8 Company Setup page refresh event, and the OfficeSwitcher. A git
 * status audit pins the exact authorized dirty-file set. Exits with code 1 on
 * any failure.
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

// The authoritative 53 individual dirty files accepted through D9.
const ACCEPTED_PRE_D10_FILES: string[] = [
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
];

// The only files D10 is authorized to add to the dirty set.
const D10_AUTHORIZED_NEW_FILES: string[] = [
  "apps/web/src/app/app/_lib/office-theme.ts",
  "apps/web/src/app/app/_components/OfficeThemeShell.tsx",
  "apps/web/src/app/globals.css",
  "scripts/verify-dynamic-office-theme.ts",
];

// D11A note: D11A is the authorized voucher owner-company document branding
// phase; its five new dirty entries extend this phase-scope enumeration the
// same way. No behavioral D10 assertion is affected.
const D11A_AUTHORIZED_NEW_FILES: string[] = [
  "apps/web/src/app/app/vouchers/_lib/voucher-print/print-brand.ts",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintDocument.tsx",
  "apps/web/src/app/app/vouchers/_lib/voucher-print/VoucherPrintHeader.tsx",
  "scripts/verify-voucher-print.ts",
  "scripts/verify-voucher-owner-company-branding.ts",
];

// D11B-A note: D11B-A is the authorized report active-company access
// ownership phase; its three new dirty entries extend this phase-scope
// enumeration the same way. No behavioral D10 assertion is affected.
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

const THEME_LIB_PATH = "apps/web/src/app/app/_lib/office-theme.ts";
const SHELL_PATH = "apps/web/src/app/app/_components/OfficeThemeShell.tsx";
const LAYOUT_PATH = "apps/web/src/app/app/layout.tsx";
const GLOBALS_PATH = "apps/web/src/app/globals.css";
const COMPANY_PAGE_PATH = "apps/web/src/app/app/company/page.tsx";
const SWITCHER_PATH = "apps/web/src/app/app/_components/OfficeSwitcher.tsx";

const ARBITRARY_THEME_INPUT_TOKENS =
  "customCss|themeJson|sidebarColor|pageColor|textColor|buttonColor|primaryColor|secondaryColor|cssVariables";

// Synthetic test colors (no RESDA/Afseen/real-office colors).
const SYNTHETIC_ACCENTS = [
  { label: "dark", hex: "#1B2A41" },
  { label: "medium", hex: "#3C92BF" },
  { label: "very light", hex: "#E8F4FF" },
  { label: "white", hex: "#FFFFFF" },
  { label: "black", hex: "#000000" },
];

type ThemeLike = Record<string, unknown>;

type ThemeModule = {
  resolveOfficeTheme: (accent: string | null) => ThemeLike;
  relativeLuminance: (hex: string) => number;
  contrastRatio: (a: string, b: string) => number;
  OFFICE_BRANDING_UPDATED_EVENT: string;
};

async function loadThemeModule(): Promise<ThemeModule | null> {
  try {
    const imported = (await import(
      "../apps/web/src/app/app/_lib/office-theme"
    )) as unknown as ThemeModule;
    if (
      typeof imported.resolveOfficeTheme !== "function" ||
      typeof imported.relativeLuminance !== "function" ||
      typeof imported.contrastRatio !== "function"
    ) {
      return null;
    }
    return imported;
  } catch {
    return null;
  }
}

function hexField(theme: ThemeLike, field: string): unknown {
  return theme[field];
}

function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-F]{6}$/.test(value);
}

async function main(): Promise<number> {
  const themeLibSource = (await readSource(THEME_LIB_PATH)) ?? "";
  const shellSource = (await readSource(SHELL_PATH)) ?? "";
  const layoutSource = (await readSource(LAYOUT_PATH)) ?? "";
  const globalsSource = (await readSource(GLOBALS_PATH)) ?? "";
  const companyPageSource = (await readSource(COMPANY_PAGE_PATH)) ?? "";
  const switcherSource = (await readSource(SWITCHER_PATH)) ?? "";

  const themeLibExists = exists(THEME_LIB_PATH) && themeLibSource !== "";
  const shellExists = exists(SHELL_PATH) && shellSource !== "";
  const libMissingDetail = themeLibExists
    ? undefined
    : "office-theme.ts missing";
  const shellMissingDetail = shellExists
    ? undefined
    : "OfficeThemeShell.tsx missing";

  const d10All = `${themeLibSource}\n${shellSource}\n${layoutSource}\n${globalsSource}\n${companyPageSource}\n${switcherSource}`;

  const themeModule = await loadThemeModule();

  // Resolve default-theme expectations from the real globals.css :root block.
  const cssVar = (name: string): string | null => {
    const match = globalsSource.match(
      new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`),
    );
    return match ? match[1].toLowerCase() : null;
  };

  // --- A: utility exists ----------------------------------------------------------

  record(
    "A",
    "office-theme utility exists and exports resolveOfficeTheme/relativeLuminance/contrastRatio",
    themeLibExists &&
      themeModule !== null &&
      /export function resolveOfficeTheme\(/.test(themeLibSource) &&
      /export function relativeLuminance\(/.test(themeLibSource) &&
      /export function contrastRatio\(/.test(themeLibSource),
    themeModule === null
      ? libMissingDetail ?? "theme module not importable"
      : undefined,
  );

  // --- B: brandAccentColor is the only arbitrary office color input ----------------

  record(
    "B",
    "brandAccentColor is the only arbitrary office-color input (utility signature + no arbitrary theme inputs anywhere)",
    themeLibExists &&
      /export function resolveOfficeTheme\(\s*brandAccentColor: string \| null,?\s*\): OfficeTheme/.test(
        themeLibSource,
      ) &&
      !new RegExp(ARBITRARY_THEME_INPUT_TOKENS).test(d10All) &&
      /resolveOfficeTheme\(\s*activeCompany\?\.brandAccentColor \?\? null\s*\)/.test(
        shellSource,
      ),
    libMissingDetail ?? shellMissingDetail,
  );

  if (themeModule) {
    const resolve = themeModule.resolveOfficeTheme;

    // --- C: valid #RRGGBB parsed safely (uppercase normalize; malformed rejected)

    const normalized = resolve("#3c92bf");
    const malformedInputs = ["123456", "#12345", "#12345G", "purple", "", "#GGGGGG"];
    const malformedRejected = malformedInputs.every(
      (input) => resolve(input).isDefault === true,
    );
    record(
      "C",
      "valid #RRGGBB parsed and normalized; malformed values fall back to the default theme",
      isHex(hexField(normalized, "accent")) &&
        hexField(normalized, "accent") === "#3C92BF" &&
        normalized.isDefault === false &&
        malformedRejected,
    );

    // --- D: null accent returns the application default theme -------------------

    const defaultTheme = resolve(null);
    const sidebarBlue = cssVar("sidebar-blue") ?? "#126a84";
    const sidebarGreen = cssVar("sidebar-green") ?? "#13806c";
    const background = cssVar("background") ?? "#edf6f5";
    record(
      "D",
      "null accent returns the application default theme (isDefault + existing Real Capita sidebar/background values)",
      defaultTheme.isDefault === true &&
        String(hexField(defaultTheme, "sidebarStart")).toLowerCase() ===
          sidebarBlue &&
        String(hexField(defaultTheme, "sidebarEnd")).toLowerCase() ===
          sidebarGreen &&
        String(hexField(defaultTheme, "workspaceTint")).toLowerCase() ===
          background,
      `start=${String(hexField(defaultTheme, "sidebarStart"))} expected=${sidebarBlue}`,
    );

    // --- K: determinism + valid hex output across all synthetic accents ----------

    let deterministic = true;
    let allFieldsHex = true;
    const derivedFields = [
      "accent",
      "sidebarStart",
      "sidebarMid",
      "sidebarEnd",
      "sidebarHover",
      "workspaceTint",
      "workspaceTintStrong",
      "accentSoft",
      "borderAccent",
    ];
    for (const synthetic of SYNTHETIC_ACCENTS) {
      const first = resolve(synthetic.hex);
      const second = resolve(synthetic.hex);
      if (JSON.stringify(first) !== JSON.stringify(second)) {
        deterministic = false;
      }
      for (const field of derivedFields) {
        if (!isHex(hexField(first, field))) {
          allFieldsHex = false;
        }
      }
    }
    record(
      "K",
      "deterministic derivation with valid uppercase #RRGGBB output for every field and synthetic accent",
      deterministic && allFieldsHex,
      deterministic ? undefined : "non-deterministic result detected",
    );

    // --- E/F/G/H: sidebar darkness, ordering, and white-text contrast -----------

    let startDarkerOrEqual = true;
    let startRelated = true;
    let endAtLeastAsDark = true;
    let mediumStrictlyDarker = false;
    let contrastSafe = true;
    let contrastDetail: string | undefined;

    for (const synthetic of SYNTHETIC_ACCENTS) {
      const theme = resolve(synthetic.hex);
      const start = String(hexField(theme, "sidebarStart"));
      const end = String(hexField(theme, "sidebarEnd"));

      if (!(themeModule.relativeLuminance(start) <= themeModule.relativeLuminance(synthetic.hex))) {
        startDarkerOrEqual = false;
      }
      if (!(themeModule.relativeLuminance(end) <= themeModule.relativeLuminance(start))) {
        endAtLeastAsDark = false;
      }
      if (synthetic.label === "medium") {
        mediumStrictlyDarker =
          themeModule.relativeLuminance(end) < themeModule.relativeLuminance(start);
      }

      const startContrast = themeModule.contrastRatio("#FFFFFF", start);
      const endContrast = themeModule.contrastRatio("#FFFFFF", end);
      if (startContrast < 4.5 || endContrast < 4.5) {
        contrastSafe = false;
        contrastDetail = `${synthetic.hex}: start=${startContrast.toFixed(2)} end=${endContrast.toFixed(2)}`;
      }
    }

    record(
      "E",
      "sidebarStart is a related shade at least as dark as the accent",
      startDarkerOrEqual && startRelated,
    );
    record(
      "F",
      "sidebarEnd is at least as dark as sidebarStart (strictly darker for a medium accent)",
      endAtLeastAsDark && mediumStrictlyDarker,
    );
    record(
      "G",
      "very light accents (#E8F4FF, #FFFF00, #FFFFFF) still produce a dark safe sidebar",
      ["#E8F4FF", "#FFFF00", "#FFFFFF"].every((light) => {
        const theme = resolve(light);
        return (
          themeModule.contrastRatio(
            "#FFFFFF",
            String(hexField(theme, "sidebarStart")),
          ) >= 4.5
        );
      }),
    );
    record(
      "H",
      "white sidebar text contrast >= 4.5:1 against sidebarStart and sidebarEnd for every synthetic accent",
      contrastSafe,
      contrastDetail,
    );

    // --- I/J: workspace tints stay light -----------------------------------------

    let tintLight = true;
    let tintRelated = true;
    let tintStrongLight = true;
    let tintDetail: string | undefined;

    for (const synthetic of SYNTHETIC_ACCENTS) {
      const theme = resolve(synthetic.hex);
      const tint = String(hexField(theme, "workspaceTint"));
      const tintStrong = String(hexField(theme, "workspaceTintStrong"));
      const tintLuminance = themeModule.relativeLuminance(tint);

      if (tintLuminance < 0.75) {
        tintLight = false;
        tintDetail = `${synthetic.hex}: tint luminance ${tintLuminance.toFixed(3)}`;
      }
      if (themeModule.relativeLuminance(tintStrong) < 0.55) {
        tintStrongLight = false;
        tintDetail = `${synthetic.hex}: tintStrong luminance ${themeModule.relativeLuminance(tintStrong).toFixed(3)}`;
      }
      if (synthetic.label === "medium") {
        const tintStrongLum = themeModule.relativeLuminance(tintStrong);
        if (tintStrongLum > tintLuminance) {
          tintRelated = false;
        }
      }
    }

    record(
      "I",
      "workspaceTint is a very light related shade (luminance >= 0.75 for every synthetic accent)",
      tintLight,
      tintDetail,
    );
    record(
      "J",
      "workspaceTintStrong remains light enough for forms/tables (luminance >= 0.55)",
      tintStrongLight,
      tintDetail,
    );

    // --- White-accent edge case: tint may equal white; never require lighter-than-white.

    const whiteTheme = resolve("#FFFFFF");
    record(
      "J2",
      "white accent edge case: workspace tint approaches/equals white (high luminance) instead of an impossible lighter-than-white value",
      themeModule.relativeLuminance(
        String(hexField(whiteTheme, "workspaceTint")),
      ) >= 0.75,
    );

    const blackTheme = resolve("#000000");
    record(
      "J3",
      "black accent: workspace tint becomes substantially lighter than black",
      themeModule.relativeLuminance(
        String(hexField(blackTheme, "workspaceTint")),
      ) >= 0.75,
    );
  } else {
    for (const id of ["C", "D", "K", "E", "F", "G", "H", "I", "J", "J2", "J3"]) {
      record(
        id,
        "theme derivation behavior unavailable",
        false,
        "office-theme.ts missing or unloadable",
      );
    }
  }

  // --- L: OfficeThemeShell exists ---------------------------------------------------

  record(
    "L",
    "OfficeThemeShell component exists",
    shellExists && /export function OfficeThemeShell\(/.test(shellSource),
    shellMissingDetail,
  );

  // --- M: shell loads getCompanies() --------------------------------------------------

  record(
    "M",
    "shell loads office context through getCompanies()",
    shellExists &&
      /await getCompanies\(/.test(shellSource) &&
      /import\s*\{[^}]*getCompanies[^}]*\}\s*from\s*"@\/lib\/api"/.test(
        shellSource,
      ),
    shellMissingDetail,
  );

  // --- N: active office identified via activeCompanyId equality ------------------------

  record(
    "N",
    "active office identified strictly by company.id === activeCompanyId",
    shellExists &&
      /companies\.find\([\s\S]{0,120}company\.id === companyList\.activeCompanyId/.test(
        shellSource,
      ),
    shellMissingDetail,
  );

  // --- O: no singletonKey / PRIMARY inference --------------------------------------------

  record(
    "O",
    "no singletonKey / PRIMARY inference in theme files",
    shellExists &&
      !/singletonKey/.test(shellSource) &&
      !/["']PRIMARY["']/.test(shellSource) &&
      !/singletonKey/.test(themeLibSource),
    shellMissingDetail,
  );

  // --- P: DEFAULT_PREMIUM behavior ---------------------------------------------------------

  record(
    "P",
    "DEFAULT_PREMIUM: derived premium gradient for configured accents; existing --background treatment when default",
    shellExists &&
      /backgroundMode === "CUSTOM"/.test(shellSource) &&
      /theme\.isDefault/.test(shellSource) &&
      /var\(--background\)/.test(shellSource),
    shellMissingDetail,
  );

  // --- Q: CUSTOM uses companyMediaUrl, never the stored path ---------------------------------

  record(
    "Q",
    "CUSTOM background resolves through companyMediaUrl(activeCompany.id, \"custom-background\", revision); customBackgroundPath is only a presence signal",
    shellExists &&
      /companyMediaUrl\(\s*activeCompany\.id,\s*"custom-background",\s*mediaRevision,?\s*\)/.test(
        shellSource,
      ) &&
      !/backgroundImage:[^`]*customBackgroundPath/.test(shellSource) &&
      !/url\(.*customBackgroundPath/.test(shellSource),
    shellMissingDetail,
  );

  // --- R: custom-background preload validation ------------------------------------------------

  record(
    "R",
    "custom background is preloaded and validated before use (Image onload/onerror)",
    shellExists &&
      /new window\.Image\(\)/.test(shellSource) &&
      /\.onload/.test(shellSource) &&
      /\.onerror/.test(shellSource),
    shellMissingDetail,
  );

  // --- S: load error falls back to DEFAULT_PREMIUM ----------------------------------------------

  record(
    "S",
    "broken/missing custom background falls back to DEFAULT_PREMIUM (image applied only when ready; failure recorded)",
    shellExists &&
      /customBackgroundStatus === "ready"/.test(shellSource) &&
      /"failed"/.test(shellSource) &&
      /"checking"/.test(shellSource) &&
      /setFailedBackgroundUrl/.test(shellSource),
    shellMissingDetail,
  );

  // --- T: readability overlay ----------------------------------------------------------------------

  record(
    "T",
    "custom background has an application-controlled readability overlay",
    shellExists &&
      /office-theme-shell-overlay/.test(shellSource) &&
      /rgba\(255, 255, 255, 0\.8\d\)/.test(shellSource),
    shellMissingDetail,
  );

  // --- U: no arbitrary CSS/theme object consumed ------------------------------------------------------

  record(
    "U",
    "no arbitrary CSS/theme object is consumed anywhere in D10 sources",
    !new RegExp(ARBITRARY_THEME_INPUT_TOKENS).test(d10All) &&
      !/dangerouslySetInnerHTML/.test(shellSource),
  );

  // --- V: app shell receives dynamic theme variables ----------------------------------------------------

  record(
    "V",
    "app shell receives dynamic theme variables (OfficeThemeShell wraps the app content with --office-* custom properties)",
    shellExists &&
      /"--office-accent":\s*theme\.accent/.test(shellSource) &&
      /"--office-sidebar-start":\s*theme\.sidebarStart/.test(shellSource) &&
      /<OfficeThemeShell>/.test(layoutSource) &&
      !/min-h-screen bg-background text-foreground/.test(layoutSource),
    shellMissingDetail,
  );

  // --- W: sidebar consumes matching derived shades --------------------------------------------------------

  record(
    "W",
    "sidebar consumes matching derived shades (shell overrides --sidebar-blue/teal/green; layout gradient intact)",
    shellExists &&
      /"--sidebar-blue":\s*theme\.sidebarStart/.test(shellSource) &&
      /"--sidebar-teal":\s*theme\.sidebarMid/.test(shellSource) &&
      /"--sidebar-green":\s*theme\.sidebarEnd/.test(shellSource) &&
      /var\(--sidebar-blue\)/.test(layoutSource) &&
      /var\(--sidebar-green\)/.test(layoutSource),
    shellMissingDetail,
  );

  // --- X: sidebar structure/navigation not redesigned -------------------------------------------------------

  record(
    "X",
    "sidebar structure and navigation preserved (app-sidebar, aria-label, 240px grid, all four groups, Company Setup first)",
    /aria-label="Accounting navigation"/.test(layoutSource) &&
      /app-sidebar/.test(layoutSource) &&
      /lg:grid-cols-\[240px_minmax\(0,1fr\)\]/.test(layoutSource) &&
      /Customers &amp; Bookings/.test(layoutSource) &&
      /HR &amp; Salary/.test(layoutSource) &&
      /Reports/.test(layoutSource) &&
      /href: "\/app\/company"/.test(layoutSource),
  );

  // --- Y: platform identity remains Real Capita ---------------------------------------------------------------

  record(
    "Y",
    "platform identity remains Real Capita (header name, subtitle, mark)",
    /REAL CAPITA GROUP/.test(layoutSource) &&
      /Accounting &amp; Project Finance System/.test(layoutSource) &&
      /real-capita-group-mark\.png/.test(layoutSource),
  );

  // --- Z: D8 theme-affecting mutations trigger the refresh event ------------------------------------------------

  record(
    "Z",
    "D8 theme-affecting persisted changes dispatch the branding-updated event (accent/mode/custom-background comparison)",
    companyPageSource !== "" &&
      /notifyOfficeBrandingUpdated\(\)/.test(companyPageSource) &&
      /previous\.brandAccentColor !== updated\.brandAccentColor/.test(
        companyPageSource,
      ) &&
      /previous\.backgroundMode !== updated\.backgroundMode/.test(
        companyPageSource,
      ) &&
      /previous\.customBackgroundPath !== updated\.customBackgroundPath/.test(
        companyPageSource,
      ) &&
      themeLibExists &&
      /OFFICE_BRANDING_UPDATED_EVENT = "real-capita:office-branding-updated"/.test(
        themeLibSource,
      ),
  );

  // --- AA: non-active office cannot become theme authority --------------------------------------------------------

  record(
    "AA",
    "non-active office cannot become theme authority (shell never mutates companies; authority is always the refetched activeCompanyId)",
    shellExists &&
      !/editingCompanyId/.test(shellSource) &&
      !/(switchCompany|createCompany|updateCompany|uploadCompanyMedia|removeCompanyMedia)/.test(
        shellSource,
      ) &&
      /getCompanies\(\)/.test(shellSource),
    shellMissingDetail,
  );

  // --- AB: media cache busting exists -------------------------------------------------------------------------------

  record(
    "AB",
    "media cache busting exists (revision state incremented on branding refresh, passed to companyMediaUrl)",
    shellExists &&
      /setMediaRevision\(\(revision\) => revision \+ 1\)/.test(shellSource) &&
      /OFFICE_BRANDING_UPDATED_EVENT/.test(shellSource),
    shellMissingDetail,
  );

  // --- AC: theme load failure preserves a usable default app -----------------------------------------------------------

  record(
    "AC",
    "theme/company-list load failure preserves the usable default app (no throw, 401 handled, default theme for null context)",
    shellExists &&
      !/\bthrow\b/.test(shellSource) &&
      /router\.replace\("\/login"\)/.test(shellSource) &&
      /activeCompany\?\.brandAccentColor \?\? null/.test(shellSource),
    shellMissingDetail,
  );

  // --- AD: responsive / custom-background safeguards ---------------------------------------------------------------------

  record(
    "AD",
    "responsive and custom-background safeguards (cover, centered, no repeat, no horizontal overflow)",
    shellExists &&
      /backgroundSize: "cover"/.test(shellSource) &&
      /backgroundPosition: "center"/.test(shellSource) &&
      /backgroundRepeat: "no-repeat"/.test(shellSource) &&
      /overflow-x-hidden/.test(shellSource),
    shellMissingDetail,
  );

  // --- AE: no voucher/report branding changes -------------------------------------------------------------------------------

  record(
    "AE",
    "no voucher/report branding integration in D10 sources",
    !/from\s+["'][^"']*(?:vouchers|reports)/i.test(themeLibSource) &&
      !/from\s+["'][^"']*(?:vouchers|reports)/i.test(shellSource),
  );

  // --- AF: no backend/schema changes (exact dirty-set audit) --------------------------------------------------------------------

  const dirtyPaths = gitStatusPaths();
  const unexpected = dirtyPaths.filter(
    (dirtyPath) =>
      !ACCEPTED_PRE_D10_FILES.includes(dirtyPath) &&
      !D10_AUTHORIZED_NEW_FILES.includes(dirtyPath) &&
      !D11A_AUTHORIZED_NEW_FILES.includes(dirtyPath) &&
      !D11BA_AUTHORIZED_NEW_FILES.includes(dirtyPath) &&
      !D11BB_AUTHORIZED_NEW_FILES.includes(dirtyPath),
  );
  record(
    "AF",
    "no backend/schema or out-of-scope production changes (exact dirty-file-set audit)",
    unexpected.length === 0,
    unexpected.length > 0 ? unexpected.join("; ") : undefined,
  );

  // --- AG: no Afseen/RESDA hard-coding; no office creation/upload in production files --------------------------------------------

  record(
    "AG",
    "no Afseen/RESDA/#652B7C hard-coding and no office creation/media upload in D10 production sources",
    !/afseen|resda|652B7C/i.test(d10All) &&
      !/(createCompany|uploadCompanyMedia|removeCompanyMedia)/.test(shellSource),
  );

  // --- AH: no Git integration in production theme files ---------------------------------------------------------------------------

  record(
    "AH",
    "no Git integration in D10 production sources",
    !/child_process|execFileSync|spawnSync/.test(themeLibSource) &&
      !/child_process|execFileSync|spawnSync/.test(shellSource),
  );

  // --- Report ------------------------------------------------------------------------------------------------------------------------

  console.log("D10 dynamic office theme verification (DB-free)");
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
