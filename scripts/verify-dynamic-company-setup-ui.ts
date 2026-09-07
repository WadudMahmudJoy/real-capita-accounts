import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as companyApi from "../apps/web/src/lib/api";

/**
 * DB-free D8 verifier: dynamic Company Setup / multi-office management UI.
 *
 * Source-contract checks read the real /app/company page, its components,
 * and the shared API client; behavioral checks import the real web API
 * module with a stubbed global fetch to capture URL, method, headers, and
 * body transport. No database connection. Exits with code 1 on any failure.
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

function gitStatus(paths: string[]): string {
  try {
    return execFileSync(
      process.platform === "win32" ? "git.exe" : "git",
      ["status", "--porcelain", "--", ...paths],
      { cwd: ROOT, encoding: "utf8" },
    ).trim();
  } catch {
    return "git-status-unavailable";
  }
}

/** Extracts a top-level component-internal function body (2-space indent). */
function functionBody(source: string, name: string): string | null {
  const match = source.match(
    new RegExp(`function ${name}\\([^)]*\\)[^{]*\\{[\\s\\S]*?\\n  \\}`),
  );
  return match ? match[0] : null;
}

// --- Behavioral fetch capture -------------------------------------------------

type CapturedFetch = { url: string; init: RequestInit | undefined };

const captured: CapturedFetch[] = [];

function stubFetch(responseBody: unknown): void {
  (globalThis as { fetch: typeof fetch }).fetch = ((
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    captured.push({ url: String(input), init });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(responseBody),
    } as Response);
  }) as typeof fetch;
}

async function captureApiCall(
  invoke: (() => Promise<unknown>) | undefined,
): Promise<CapturedFetch | null> {
  if (typeof invoke !== "function") {
    return null;
  }
  captured.length = 0;
  try {
    await invoke();
  } catch {
    // Capture is still recorded; transport is what matters here.
  }
  return captured[0] ?? null;
}

function headerRecord(init: RequestInit | undefined): Record<string, string> {
  const headers = init?.headers;
  if (!headers || typeof headers !== "object") {
    return {};
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(
      headers.map(([key, value]) => [key.toLowerCase(), String(value)]),
    );
  }
  return Object.fromEntries(
    Object.entries(headers as Record<string, string>).map(([key, value]) => [
      key.toLowerCase(),
      String(value),
    ]),
  );
}

async function main(): Promise<number> {
  const PAGE_PATH = "apps/web/src/app/app/company/page.tsx";
  const LIST_PATH = "apps/web/src/app/app/company/_components/OfficeList.tsx";
  const EDITOR_PATH =
    "apps/web/src/app/app/company/_components/OfficeEditor.tsx";
  const MEDIA_PATH =
    "apps/web/src/app/app/company/_components/CompanyMediaField.tsx";
  const API_PATH = "apps/web/src/lib/api.ts";

  const page = (await readSource(PAGE_PATH)) ?? "";
  const officeList = (await readSource(LIST_PATH)) ?? "";
  const officeEditor = (await readSource(EDITOR_PATH)) ?? "";
  const mediaField = (await readSource(MEDIA_PATH)) ?? "";
  const apiSource = (await readSource(API_PATH)) ?? "";

  const companySources = [
    { name: "page", text: page },
    { name: "OfficeList", text: officeList },
    { name: "OfficeEditor", text: officeEditor },
    { name: "CompanyMediaField", text: mediaField },
  ];
  const companyAll = companySources.map((s) => s.text).join("\n");
  const filesMissing = companySources
    .filter((s) => s.text === "")
    .map((s) => `${s.name} source missing`);
  const missingDetail =
    filesMissing.length > 0 ? filesMissing.join("; ") : undefined;

  const apiBase = companyApi.API_BASE_URL;

  // --- A: management route ----------------------------------------------------

  record(
    "A",
    "/app/company remains the management route (no /app/offices or /app/multi-office module)",
    exists(PAGE_PATH) &&
      !exists("apps/web/src/app/app/offices") &&
      !exists("apps/web/src/app/app/multi-office"),
  );

  // --- B: office list ---------------------------------------------------------

  record(
    "B",
    "Office List exists (OfficeList component rendered by the Company page)",
    officeList !== "" &&
      /OfficeList/.test(page) &&
      /companies/.test(officeList),
    officeList === "" ? "OfficeList.tsx not found" : undefined,
  );

  // --- C: add office ----------------------------------------------------------

  record(
    "C",
    "Add Office control exists",
    /Add Office/.test(companyAll),
  );

  // --- D: active-office distinction -------------------------------------------

  record(
    "D",
    "office cards distinguish activeCompanyId (current-office indicator)",
    /company\.id === activeCompanyId/.test(officeList) &&
      /Current office/i.test(officeList),
    missingDetail,
  );

  // --- E: edit does not imply switch ------------------------------------------

  const selectForEditingBody = functionBody(page, "handleSelectForEditing");
  record(
    "E",
    "Edit does not imply Switch (editingCompanyId state separate; edit handler never switches)",
    /editingCompanyId/.test(page) &&
      /activeCompanyId/.test(page) &&
      selectForEditingBody !== null &&
      /setEditingCompanyId/.test(selectForEditingBody) &&
      !/switchCompany/.test(selectForEditingBody) &&
      /onEdit/.test(officeList) &&
      /onSwitch/.test(officeList),
    missingDetail,
  );

  // --- F: explicit switch uses switchCompany -----------------------------------

  const switchBody = functionBody(page, "handleSwitchCompany");
  const switchCallCount = (page.match(/switchCompany\(/g) ?? []).length;
  record(
    "F",
    "explicit Switch uses switchCompany",
    /import\s*\{[^}]*switchCompany[^}]*\}\s*from\s*"@\/lib\/api"/.test(page) &&
      switchBody !== null &&
      /switchCompany\(/.test(switchBody) &&
      switchCallCount === 1,
    missingDetail,
  );

  // --- G: inactive office cannot be switched to --------------------------------

  record(
    "G",
    "inactive office cannot be switched to (switch disabled for isActive=false)",
    /canSwitch\s*=\s*company\.isActive\s*&&\s*!isCurrentOffice/.test(
      officeList,
    ),
    missingDetail,
  );

  // --- H: create form fields ---------------------------------------------------

  const formStateMatch = officeEditor.match(
    /type BasicInfoFormState = \{([\s\S]*?)\}/,
  );
  const formStateKeys = formStateMatch
    ? (formStateMatch[1].match(/\b\w+\??:/g) ?? []).map((key) =>
        key.replace(/\??:$/, ""),
      )
    : [];
  const expectedBasicFields = [
    "name",
    "legalName",
    "phone",
    "email",
    "currency",
    "address",
  ];
  const fieldsExact =
    formStateKeys.length === expectedBasicFields.length &&
    expectedBasicFields.every((field) => formStateKeys.includes(field));
  record(
    "H",
    "create form contains exactly Basic Info fields (name, legalName, phone, email, currency, address)",
    fieldsExact &&
      expectedBasicFields.every((field) =>
        new RegExp(`updateField\\("${field}"`).test(officeEditor),
      ),
    missingDetail ?? `formStateKeys=${formStateKeys.join(",")}`,
  );

  // --- I: no isActive/singletonKey/media-path form exposure ---------------------

  record(
    "I",
    "create does not expose isActive/singletonKey/media paths",
    !/singletonKey/.test(companyAll) &&
      !/id="[^"]*(?:isActive|singletonKey|LogoPath|BackgroundPath)"/.test(
        companyAll,
      ) &&
      !/updateField\("(?:isActive|singletonKey|officeLogoPath|customBackgroundPath|printLogoPath)"/.test(
        officeEditor,
      ),
    missingDetail,
  );

  // --- J: newly-created office selected for editing ------------------------------

  const createdBody = functionBody(page, "handleCompanyCreated");
  record(
    "J",
    "newly-created office is selected for editing",
    createdBody !== null && /setEditingCompanyId\(created\.id\)/.test(createdBody),
    missingDetail,
  );

  // --- K: no automatic switch on create ------------------------------------------

  record(
    "K",
    "new office does not automatically switch (create flow never calls switchCompany)",
    createdBody !== null &&
      !/switchCompany/.test(createdBody) &&
      !/switchCompany/.test(officeEditor),
    missingDetail,
  );

  // --- L: exact tabs ----------------------------------------------------------------

  const tabsMatch = officeEditor.match(/const EDITOR_TABS[^;]*;/);
  const tabsText = tabsMatch ? tabsMatch[0] : "";
  const tabIds = (tabsText.match(/\{\s*id:/g) ?? []).length;
  record(
    "L",
    "tabs exist exactly: Basic Info, Branding, Print & Voucher",
    tabIds === 3 &&
      /id:\s*"basic",\s*label:\s*"Basic Info"/.test(tabsText) &&
      /id:\s*"branding",\s*label:\s*"Branding"/.test(tabsText) &&
      /id:\s*"print",\s*label:\s*"Print & Voucher"/.test(tabsText) &&
      /EDITOR_TABS\.map/.test(officeEditor),
    missingDetail,
  );

  // --- M: basic info uses updateCompany ----------------------------------------------

  record(
    "M",
    "Basic Info save uses updateCompany",
    /await updateCompany\(/.test(officeEditor),
    missingDetail,
  );

  // --- N: branding exposes brandAccentColor ---------------------------------------------

  record(
    "N",
    "Branding exposes brandAccentColor (form field + PATCH payload)",
    /brandAccentColor/.test(officeEditor) &&
      /brandAccentColor:/.test(officeEditor),
    missingDetail,
  );

  // --- O: accent #RRGGBB editing ------------------------------------------------------

  record(
    "O",
    "accent supports #RRGGBB editing (hex validation + 7-char input)",
    /#\[[^\]]*\]\{6\}/.test(officeEditor) &&
      /maxLength=\{7\}/.test(officeEditor),
    missingDetail,
  );

  // --- P: no hard-coded RESDA purple ---------------------------------------------------

  record(
    "P",
    "no hard-coded RESDA purple (#652B7C) in D8 web sources",
    !/652B7C/i.test(companyAll) && !/652B7C/i.test(apiSource),
  );

  // --- Q: backgroundMode exactly DEFAULT_PREMIUM/CUSTOM ---------------------------------

  const modeIdIndex = officeEditor.indexOf('id="company-background-mode"');
  const modeSelectText =
    modeIdIndex === -1
      ? ""
      : officeEditor.slice(
          modeIdIndex,
          officeEditor.indexOf("</Select>", modeIdIndex) + "</Select>".length,
        );
  const optionCount = (modeSelectText.match(/<option/g) ?? []).length;
  record(
    "Q",
    "backgroundMode offers only DEFAULT_PREMIUM/CUSTOM with friendly labels",
    optionCount === 2 &&
      /value="DEFAULT_PREMIUM">Default Premium</.test(modeSelectText) &&
      /value="CUSTOM">Custom Background</.test(modeSelectText),
    missingDetail,
  );

  // --- R: custom-background fallback notice ------------------------------------------------

  record(
    "R",
    "custom-background fallback notice exists",
    /No custom background uploaded\.\s*Default Premium will be used as\s*the fallback\./.test(
      officeEditor,
    ),
    missingDetail,
  );

  // --- S/T/U: media kinds use the D7B helper endpoints --------------------------------------

  record(
    "S",
    "office logo uses D7B upload/remove endpoint helpers",
    /kind="office-logo"/.test(officeEditor) &&
      /uploadCompanyMedia\(/.test(mediaField) &&
      /removeCompanyMedia\(/.test(mediaField),
    missingDetail,
  );

  record(
    "T",
    "custom background uses D7B upload/remove helpers",
    /kind="custom-background"/.test(officeEditor) &&
      /uploadCompanyMedia\(/.test(mediaField),
    missingDetail,
  );

  record(
    "U",
    "print logo uses D7B upload/remove helpers",
    /kind="print-logo"/.test(officeEditor) &&
      /uploadCompanyMedia\(/.test(mediaField),
    missingDetail,
  );

  // --- V/W: file acceptance -----------------------------------------------------------------

  record(
    "V",
    "file input accepts PNG/JPEG/WebP only",
    /accept="image\/png,image\/jpeg,image\/webp"/.test(mediaField),
    missingDetail,
  );

  record(
    "W",
    "no SVG/AI acceptance",
    !/image\/svg/i.test(companyAll) && !/\.ai\b/.test(companyAll),
  );

  // --- X: media previews use /company-media/:id/:kind ----------------------------------------

  const mediaUrlBasic =
    typeof companyApi.companyMediaUrl === "function"
      ? companyApi.companyMediaUrl("c1", "office-logo")
      : null;
  record(
    "X",
    "media previews use /company-media/:id/:kind, not stored paths",
    mediaUrlBasic === `${apiBase}/company-media/c1/office-logo` &&
      /src=\{companyMediaUrl\(/.test(mediaField) &&
      !/src=\{[^}]*Path/.test(companyAll),
    mediaUrlBasic === null
      ? "companyMediaUrl helper missing"
      : `got ${mediaUrlBasic}`,
  );

  // --- Y: cache busting after mutation ---------------------------------------------------------

  const mediaUrlRevision =
    typeof companyApi.companyMediaUrl === "function"
      ? companyApi.companyMediaUrl("c1", "office-logo", 7)
      : null;
  const mediaChangedBody = functionBody(page, "handleCompanyMediaChanged");
  record(
    "Y",
    "media URL uses cache busting after mutation (?v= revision)",
    mediaUrlRevision === `${apiBase}/company-media/c1/office-logo?v=7` &&
      /companyMediaUrl\(companyId, kind, revision\)/.test(mediaField) &&
      mediaChangedBody !== null &&
      /setMediaRevision/.test(mediaChangedBody),
    mediaUrlRevision === null ? "companyMediaUrl helper missing" : undefined,
  );

  // --- Z/AA: print header/footer editing --------------------------------------------------------

  record(
    "Z",
    "printHeaderName editable (maxLength 120)",
    /printHeaderName/.test(officeEditor) && /maxLength=\{120\}/.test(officeEditor),
    missingDetail,
  );

  record(
    "AA",
    "printFooterText editable (maxLength 250)",
    /printFooterText/.test(officeEditor) && /maxLength=\{250\}/.test(officeEditor),
    missingDetail,
  );

  // --- AB: no voucher/report integration ----------------------------------------------------------

  record(
    "AB",
    "no voucher/report integration",
    !/from\s+["'][^"']*(?:vouchers|reports)/i.test(companyAll) &&
      !/VoucherPrint/.test(companyAll),
  );

  // --- AC: D10 theme boundaries (enduring D8 invariants) ---------------------------

  // D10 note: the previous boundary asserted the sidebar stayed unchanged
  // with no dynamic theme. D10 is the authorized office theme phase, so this
  // check now pins the enduring invariants: Company Setup remains at
  // /app/company with the three approved tabs and owns branding
  // configuration; OfficeThemeShell consumes that branding without
  // reimplementing Company management; the sidebar navigation structure and
  // the platform identity stay unchanged.

  const appLayout =
    (await readSource("apps/web/src/app/app/layout.tsx")) ?? "";
  const officeSwitcher =
    (await readSource(
      "apps/web/src/app/app/_components/OfficeSwitcher.tsx",
    )) ?? "";
  const officeThemeShell =
    (await readSource(
      "apps/web/src/app/app/_components/OfficeThemeShell.tsx",
    )) ?? "";

  const companySetupRouteIntact =
    (/href:\s*"\/app\/company"/.test(appLayout) ||
      /href="\/app\/company"/.test(appLayout)) &&
    /Company Setup/.test(appLayout) &&
    exists("apps/web/src/app/app/company/page.tsx");

  const switcherDoesNotReimplementSetup =
    officeSwitcher !== "" &&
    !/(createCompany|updateCompany|uploadCompanyMedia|removeCompanyMedia)/.test(
      officeSwitcher,
    ) &&
    /href="\/app\/company"/.test(officeSwitcher);

  const rootLayoutAndSharedUiUnchanged =
    gitStatus(["apps/web/src/app/layout.tsx"]) === "" &&
    gitStatus(["apps/web/src/app/app/_components/ui.tsx"]) === "";

  const setupOwnsBrandingConfiguration =
    /updateCompany\(/.test(officeEditor) &&
    /brandAccentColor/.test(officeEditor) &&
    /id:\s*"basic",\s*label:\s*"Basic Info"/.test(officeEditor) &&
    /id:\s*"branding",\s*label:\s*"Branding"/.test(officeEditor) &&
    /id:\s*"print",\s*label:\s*"Print & Voucher"/.test(officeEditor);

  const shellConsumesWithoutReimplementing =
    officeThemeShell !== "" &&
    /resolveOfficeTheme\(/.test(officeThemeShell) &&
    /company\.id === companyList\.activeCompanyId/.test(officeThemeShell) &&
    !/(createCompany|updateCompany|uploadCompanyMedia|removeCompanyMedia|switchCompany)/.test(
      officeThemeShell,
    );

  const sidebarNavigationStructureUnchanged =
    /app-sidebar/.test(appLayout) &&
    /--sidebar-blue/.test(appLayout) &&
    /aria-label="Accounting navigation"/.test(appLayout) &&
    /lg:grid-cols-\[240px_minmax\(0,1fr\)\]/.test(appLayout);

  const platformIdentityIntact =
    /REAL CAPITA GROUP/.test(appLayout) &&
    /Accounting &amp; Project Finance System/.test(appLayout) &&
    /real-capita-group-mark\.png/.test(appLayout);

  record(
    "AC",
    "D10 theme boundaries: Company Setup remains /app/company with the three approved tabs and owns branding configuration; OfficeThemeShell consumes branding without reimplementing Company management; sidebar navigation structure and platform identity unchanged",
    companySetupRouteIntact &&
      switcherDoesNotReimplementSetup &&
      rootLayoutAndSharedUiUnchanged &&
      setupOwnsBrandingConfiguration &&
      shellConsumesWithoutReimplementing &&
      sidebarNavigationStructureUnchanged &&
      platformIdentityIntact,
  );

  // --- AD: no office deactivation/delete UI ---------------------------------------------------------

  record(
    "AD",
    "no office deactivation/activation/delete UI",
    !/Deactivate/.test(companyAll) && !/Delete/.test(companyAll),
  );

  // --- AE: no Afseen/RESDA hard-coding ----------------------------------------------------------------

  record(
    "AE",
    "no Afseen/RESDA hard-coding",
    !/afseen|resda/i.test(companyAll) && !/afseen|resda/i.test(apiSource),
  );

  // --- AF: responsive structure ------------------------------------------------------------------------

  record(
    "AF",
    "responsive structure exists (multi-column cards on wide screens, wrapped tabs, single-column forms)",
    /sm:grid-cols-2/.test(officeList) &&
      /sm:grid-cols-2/.test(officeEditor) &&
      /flex-wrap/.test(officeEditor),
    missingDetail,
  );

  // --- AG: platform identity untouched --------------------------------------------------------------------

  // D10 note: the original boundary asserted globals.css stayed untouched.
  // D10 is the authorized office theme phase and may add narrow theme-
  // consumption rules to globals.css, so this check now pins the enduring
  // invariant: the login page, root page, and brand assets remain untouched,
  // and globals.css keeps the unchanged Real Capita default palette with
  // only the office-theme-shell rules added on top.
  const identityStatus = gitStatus([
    "apps/web/src/app/login",
    "apps/web/src/app/page.tsx",
    "apps/web/public",
  ]);
  const globalsSource =
    (await readSource("apps/web/src/app/globals.css")) ?? "";
  const globalsPlatformIntact =
    /--sidebar-blue:\s*#126a84/i.test(globalsSource) &&
    /--sidebar-teal:\s*#0f7a78/i.test(globalsSource) &&
    /--sidebar-green:\s*#13806c/i.test(globalsSource) &&
    /--background:\s*#edf6f5/i.test(globalsSource) &&
    /--primary:\s*#1f78b5/i.test(globalsSource);
  const globalsChangesAreThemeScoped =
    /\.office-theme-shell\b/.test(globalsSource) &&
    /\.office-theme-shell-overlay\b/.test(globalsSource);
  record(
    "AG",
    "existing Real Capita platform identity untouched (login, root page, brand assets; globals.css keeps the default palette with only office-theme-shell rules added)",
    identityStatus === "" && globalsPlatformIntact && globalsChangesAreThemeScoped,
    identityStatus === "" ? undefined : identityStatus,
  );

  // --- AH: list/switch helpers (behavioral) -----------------------------------------------------------------

  stubFetch({ activeCompanyId: "c9", companies: [] });
  const listCall = await captureApiCall(() => companyApi.getCompanies?.());
  record(
    "AH",
    "API helpers support company list/switch (GET /company/list, POST /company/:id/switch)",
    listCall !== null &&
      listCall.url === `${apiBase}/company/list` &&
      (listCall.init?.method ?? "GET") === "GET" &&
      typeof companyApi.switchCompany === "function",
    listCall === null
      ? "getCompanies helper missing"
      : `${listCall.url} ${listCall.init?.method ?? "GET"}`,
  );

  stubFetch({
    status: "ok",
    activeCompanyId: "c9",
    company: { id: "c9" },
  });
  const switchCall = await captureApiCall(() =>
    companyApi.switchCompany?.("c9"),
  );
  record(
    "AH2",
    "switchCompany posts to /company/:id/switch",
    switchCall !== null &&
      switchCall.url === `${apiBase}/company/c9/switch` &&
      switchCall.init?.method === "POST",
    switchCall === null ? "switchCompany helper missing" : switchCall.url,
  );

  // --- AI: multipart transport (behavioral) -------------------------------------------------------------------

  const uploadFile =
    typeof File === "function"
      ? new File([new Uint8Array([137, 80, 78, 71])], "logo.png", {
          type: "image/png",
        })
      : null;
  stubFetch({ status: "ok", kind: "office-logo", company: { id: "c1" } });
  const uploadCall =
    uploadFile === null
      ? null
      : await captureApiCall(() =>
          companyApi.uploadCompanyMedia?.("c1", "office-logo", uploadFile),
        );
  const uploadBody =
    uploadCall && (uploadCall.init as { body?: unknown })?.body;
  const uploadHeaders = uploadCall
    ? headerRecord(uploadCall.init)
    : ({} as Record<string, string>);
  record(
    "AI",
    "FormData transport does not force JSON Content-Type (multipart field 'file')",
    uploadCall !== null &&
      uploadBody instanceof FormData &&
      (uploadBody as FormData).get("file") === uploadFile &&
      uploadCall.url === `${apiBase}/company/c1/media/office-logo` &&
      uploadCall.init?.method === "POST" &&
      (uploadHeaders["content-type"] === undefined ||
        !/application\/json/.test(uploadHeaders["content-type"] ?? "")),
    uploadCall === null ? "uploadCompanyMedia helper missing" : undefined,
  );

  const removeCall = await captureApiCall(() =>
    companyApi.removeCompanyMedia?.("c1", "print-logo"),
  );
  record(
    "AI2",
    "removeCompanyMedia deletes /company/:id/media/:kind",
    removeCall !== null &&
      removeCall.url === `${apiBase}/company/c1/media/print-logo` &&
      removeCall.init?.method === "DELETE",
    removeCall === null ? "removeCompanyMedia helper missing" : undefined,
  );

  // --- AJ: legacy helper compatibility (behavioral) ------------------------------------------------------------

  stubFetch({ id: "c1", name: "Real Capita Group" });
  const getCall = await captureApiCall(() => companyApi.getCompany?.());
  record(
    "AJ",
    "getCompany/createCompany/updateCompany compatibility remains (GET/POST/PATCH /company)",
    getCall !== null &&
      getCall.url === `${apiBase}/company` &&
      (getCall.init?.method ?? "GET") === "GET" &&
      typeof companyApi.createCompany === "function" &&
      typeof companyApi.updateCompany === "function",
    getCall === null ? "getCompany helper missing" : getCall.url,
  );

  stubFetch({ id: "c2", name: "New Office" });
  const createCall = await captureApiCall(() =>
    companyApi.createCompany?.({ name: "New Office" }),
  );
  const createHeaders = createCall ? headerRecord(createCall.init) : {};
  record(
    "AJ2",
    "createCompany still posts JSON with Content-Type application/json",
    createCall !== null &&
      createCall.url === `${apiBase}/company` &&
      createCall.init?.method === "POST" &&
      typeof createCall.init?.body === "string" &&
      createHeaders["content-type"] === "application/json",
    createCall === null ? "createCompany helper missing" : undefined,
  );

  stubFetch({ id: "c1", name: "Renamed" });
  const updateCall = await captureApiCall(() =>
    companyApi.updateCompany?.("c1", { name: "Renamed" }),
  );
  const updateHeaders = updateCall ? headerRecord(updateCall.init) : {};
  record(
    "AJ3",
    "updateCompany still patches JSON to /company/:id",
    updateCall !== null &&
      updateCall.url === `${apiBase}/company/c1` &&
      updateCall.init?.method === "PATCH" &&
      typeof updateCall.init?.body === "string" &&
      updateHeaders["content-type"] === "application/json",
    updateCall === null ? "updateCompany helper missing" : undefined,
  );

  // --- Report ----------------------------------------------------------------------------------------------------

  console.log("D8 dynamic Company Setup UI verification (DB-free)");
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
