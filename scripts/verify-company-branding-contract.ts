import "reflect-metadata";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateCompanyDto } from "../apps/api/src/company/dto/create-company.dto";
import { UpdateCompanyDto } from "../apps/api/src/company/dto/update-company.dto";
import { CompanyBackgroundMode } from "../apps/api/src/generated/prisma/client";

/**
 * DB-free D7A verifier: controlled Company branding API contract.
 *
 * Validates the real DTO classes with class-validator using the same
 * whitelist/forbidNonWhitelisted semantics as the global ValidationPipe, so
 * the checks exercise the actual request-contract behavior. No database
 * connection. Exits with code 1 on any failure.
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

async function readSource(relativePath: string): Promise<string> {
  const text = await readFile(path.join(ROOT, relativePath), "utf8");
  return stripLineComments(text);
}

/** Mirrors the global ValidationPipe (whitelist + forbidNonWhitelisted). */
function validateBody(
  dtoClass: new () => object,
  plain: Record<string, unknown>,
): { instance: Record<string, unknown>; errors: string[] } {
  const instance = plainToInstance(dtoClass, plain, {
    exposeUnsetFields: true,
  }) as Record<string, unknown>;
  const errors = validateSync(instance as object, {
    forbidNonWhitelisted: true,
    whitelist: true,
  });
  const messages = errors.flatMap((error) => {
    const constraints = (error as { constraints?: Record<string, string> })
      .constraints;
    const ownMessages = constraints ? Object.values(constraints) : [];
    const childMessages = (error.children ?? []).flatMap((child) =>
      Object.values(
        (child as { constraints?: Record<string, string> }).constraints ?? {},
      ),
    );
    return [...ownMessages, ...childMessages];
  });
  return { instance, errors: messages };
}

async function main(): Promise<number> {
  const createDtoSource = await readSource(
    "apps/api/src/company/dto/create-company.dto.ts",
  );
  const updateDtoSource = await readSource(
    "apps/api/src/company/dto/update-company.dto.ts",
  );
  const controllerSource = await readSource(
    "apps/api/src/company/company.controller.ts",
  );
  const serviceSource = await readSource(
    "apps/api/src/company/company.service.ts",
  );

  // --- A: CreateCompanyDto remains Basic Info only --------------------------

  const basicFields = ["name", "legalName", "address", "phone", "email", "currency"];
  const brandingFields = [
    "brandAccentColor",
    "backgroundMode",
    "printHeaderName",
    "printFooterText",
    "officeLogoPath",
    "customBackgroundPath",
    "printLogoPath",
  ];
  const createHasBranding = brandingFields.some(
    (field) =>
      new RegExp(`^\\s*${field}\\s*[?!]?:`, "m").test(createDtoSource),
  );
  record(
    "A",
    "CreateCompanyDto remains Basic Info only (no branding/file fields)",
    !createHasBranding && basicFields.every((field) =>
      new RegExp(`^\\s*${field}\\s*[?!]?:`, "m").test(createDtoSource),
    ),
  );

  // --- brandAccentColor ------------------------------------------------------

  const accentValid = validateBody(UpdateCompanyDto, {
    brandAccentColor: "#123AbC",
  });
  record(
    "B",
    "UpdateCompanyDto accepts brandAccentColor (field exists and valid input passes)",
    accentValid.errors.length === 0 &&
      accentValid.instance.brandAccentColor !== undefined,
    accentValid.errors.join("; ") || undefined,
  );

  record(
    "C",
    "brandAccentColor accepts valid six-digit hex",
    accentValid.errors.length === 0,
    accentValid.errors.join("; ") || undefined,
  );

  const accentNoHash = validateBody(UpdateCompanyDto, {
    brandAccentColor: "123ABC",
  });
  record(
    "D",
    "brandAccentColor rejects missing # form",
    accentNoHash.errors.length > 0,
    accentNoHash.errors.join("; ") || "accepted without error",
  );

  const accentShort = validateBody(UpdateCompanyDto, {
    brandAccentColor: "#FFF",
  });
  record(
    "E",
    "brandAccentColor rejects shorthand #FFF",
    accentShort.errors.length > 0,
    accentShort.errors.join("; ") || "accepted without error",
  );

  for (const invalid of [
    "purple",
    "rgb(101,43,124)",
    "var(--color)",
    "url(https://attacker.example/x)",
    "#12345",
    "#1234567",
    "123456",
  ]) {
    const result = validateBody(UpdateCompanyDto, {
      brandAccentColor: invalid,
    });
    record(
      `F-${invalid}`,
      `brandAccentColor rejects CSS/functions/names/arbitrary forms (${invalid})`,
      result.errors.length > 0,
      result.errors.join("; ") || "accepted without error",
    );
  }

  const accentNull = validateBody(UpdateCompanyDto, {
    brandAccentColor: null,
  });
  record(
    "G",
    "brandAccentColor may be null (explicit clear is valid)",
    accentNull.errors.length === 0 &&
      accentNull.instance.brandAccentColor === null,
    accentNull.errors.join("; ") || undefined,
  );

  const accentNormalized = validateBody(UpdateCompanyDto, {
    brandAccentColor: "#652b7c",
  });
  record(
    "H",
    "valid brandAccentColor is normalized to uppercase",
    accentNormalized.instance.brandAccentColor === "#652B7C",
    `value=${String(accentNormalized.instance.brandAccentColor)}`,
  );

  // --- backgroundMode ----------------------------------------------------------

  const modeDefault = validateBody(UpdateCompanyDto, {
    backgroundMode: "DEFAULT_PREMIUM",
  });
  const modeCustom = validateBody(UpdateCompanyDto, {
    backgroundMode: "CUSTOM",
  });
  record(
    "I",
    "UpdateCompanyDto accepts exactly DEFAULT_PREMIUM or CUSTOM for backgroundMode",
    modeDefault.errors.length === 0 &&
      modeCustom.errors.length === 0 &&
      modeDefault.instance.backgroundMode === "DEFAULT_PREMIUM" &&
      modeCustom.instance.backgroundMode === "CUSTOM",
    [...modeDefault.errors, ...modeCustom.errors].join("; ") || undefined,
  );

  const modeInvalid = validateBody(UpdateCompanyDto, {
    backgroundMode: "BLUE",
  });
  record(
    "J",
    "invalid backgroundMode is rejected (no arbitrary strings)",
    modeInvalid.errors.length > 0,
    modeInvalid.errors.join("; ") || "accepted without error",
  );

  const modeNull = validateBody(UpdateCompanyDto, {
    backgroundMode: null,
  });
  record(
    "J2",
    "backgroundMode cannot be nulled (schema-required enum)",
    modeNull.errors.length > 0,
    modeNull.errors.join("; ") || "accepted without error",
  );

  // --- printHeaderName ----------------------------------------------------------

  const headerValid = validateBody(UpdateCompanyDto, {
    printHeaderName: "Custom Office Header",
  });
  record(
    "K",
    "printHeaderName accepted",
    headerValid.errors.length === 0 &&
      headerValid.instance.printHeaderName === "Custom Office Header",
    headerValid.errors.join("; ") || undefined,
  );

  const headerNull = validateBody(UpdateCompanyDto, {
    printHeaderName: null,
  });
  record(
    "L",
    "printHeaderName may be null (explicit clear)",
    headerNull.errors.length === 0 &&
      headerNull.instance.printHeaderName === null,
    headerNull.errors.join("; ") || undefined,
  );

  const headerTooLong = validateBody(UpdateCompanyDto, {
    printHeaderName: "H".repeat(121),
  });
  record(
    "M",
    "printHeaderName length bounded (121 chars rejected)",
    headerTooLong.errors.length > 0,
    headerTooLong.errors.join("; ") || "accepted without error",
  );

  const headerMax = validateBody(UpdateCompanyDto, {
    printHeaderName: "H".repeat(120),
  });
  record(
    "M2",
    "printHeaderName length bound is sensible (120 chars accepted)",
    headerMax.errors.length === 0,
    headerMax.errors.join("; ") || undefined,
  );

  // --- printFooterText ------------------------------------------------------------

  const footerValid = validateBody(UpdateCompanyDto, {
    printFooterText: "Prepared by the accounts office",
  });
  record(
    "N",
    "printFooterText accepted",
    footerValid.errors.length === 0 &&
      footerValid.instance.printFooterText ===
        "Prepared by the accounts office",
    footerValid.errors.join("; ") || undefined,
  );

  const footerNull = validateBody(UpdateCompanyDto, {
    printFooterText: null,
  });
  record(
    "O",
    "printFooterText may be null (explicit clear)",
    footerNull.errors.length === 0 &&
      footerNull.instance.printFooterText === null,
    footerNull.errors.join("; ") || undefined,
  );

  const footerTooLong = validateBody(UpdateCompanyDto, {
    printFooterText: "F".repeat(251),
  });
  record(
    "P",
    "printFooterText length bounded (251 chars rejected)",
    footerTooLong.errors.length > 0,
    footerTooLong.errors.join("; ") || "accepted without error",
  );

  const footerMax = validateBody(UpdateCompanyDto, {
    printFooterText: "F".repeat(250),
  });
  record(
    "P2",
    "printFooterText length bound is sensible (250 chars accepted)",
    footerMax.errors.length === 0,
    footerMax.errors.join("; ") || undefined,
  );

  // --- File-path write protection ---------------------------------------------

  for (const forbidden of [
    "officeLogoPath",
    "customBackgroundPath",
    "printLogoPath",
  ]) {
    const attack = validateBody(UpdateCompanyDto, {
      [forbidden]: forbidden === "officeLogoPath" ? "../../evil.png" : "https://attacker.example/x.png",
    });
    record(
      forbidden === "officeLogoPath" ? "Q" : forbidden === "customBackgroundPath" ? "R" : "S",
      `${forbidden} is NOT writable through UpdateCompanyDto (forbidNonWhitelisted rejection)`,
      attack.errors.length > 0 &&
        !new RegExp(`^\\s*${forbidden}\\s*[?!]?:`, "m").test(updateDtoSource),
      attack.errors.join("; ") || "ACCEPTED — security hole",
    );
  }

  // --- isActive / singletonKey protection --------------------------------------

  const activeAttack = validateBody(UpdateCompanyDto, { isActive: false });
  record(
    "T",
    "isActive is NOT writable through the generic PATCH DTO",
    activeAttack.errors.length > 0 &&
      !/^\s*isActive\s*[?!]?:/m.test(updateDtoSource),
    activeAttack.errors.join("; ") || "ACCEPTED — security hole",
  );

  const singletonAttack = validateBody(UpdateCompanyDto, {
    singletonKey: "PRIMARY",
  });
  record(
    "U",
    "singletonKey is NOT writable (create or update)",
    singletonAttack.errors.length > 0 &&
      !/^\s*singletonKey\s*[?!]?:/m.test(updateDtoSource) &&
      !/^\s*singletonKey\s*[?!]?:/m.test(createDtoSource),
    singletonAttack.errors.join("; ") || "ACCEPTED — security hole",
  );

  // --- Arbitrary theme/CSS prevention -------------------------------------------

  for (const field of [
    "sidebarColor",
    "backgroundColor",
    "themeJson",
    "customCss",
    "cssVariables",
  ]) {
    const attack = validateBody(UpdateCompanyDto, { [field]: "anything" });
    record(
      `V-${field}`,
      `arbitrary theme/CSS field ${field} is not present on the DTO`,
      attack.errors.length > 0 &&
        !new RegExp(`^\\s*${field}\\s*[?!]?:`, "m").test(updateDtoSource),
      attack.errors.join("; ") || "ACCEPTED — security hole",
    );
  }

  // --- W: no RESDA/Afseen production hard-coding ----------------------------------

  const companyAll = `${createDtoSource}\n${updateDtoSource}\n${controllerSource}\n${serviceSource}`;
  record(
    "W",
    "no RESDA/Afseen production hard-coding (no #652B7C default either)",
    !/afseen|resda/i.test(companyAll) && !/652B7C/i.test(companyAll),
  );

  // --- X/Y: existing D5 endpoints + switch behavior intact -------------------------

  record(
    "X",
    "existing Company D5 endpoints remain intact (findSelected/list/create/update/switch routes)",
    /@Get\(\)/.test(controllerSource) &&
      /@Get\(\s*["']list["']\s*\)/.test(controllerSource) &&
      /@Post\(\)/.test(controllerSource) &&
      /@Patch\(":id"\)/.test(controllerSource) &&
      /@Post\(":id\/switch"\)/.test(controllerSource),
  );

  record(
    "Y",
    "Company switch behavior remains intact (inactive conflict + exact-session update + duplicate-name guard retained)",
    /This office is inactive and cannot be selected\./.test(serviceSource) &&
      /activeCompanyId: company\.id/.test(serviceSource) &&
      /where: \{ id: session\.id \}/.test(serviceSource) &&
      /mode: "insensitive"/.test(serviceSource),
  );

  // --- Z: D8 frontend exposes only the approved non-file branding inputs -------

  // D8 note: the original D7A phase boundary asserted no frontend
  // implementation existed (and, after D7B, that apps/web stayed untouched).
  // D8 is the authorized Company Setup frontend phase, so this check now pins
  // the enduring invariants: the file-path fields stay out of the JSON DTOs,
  // the four non-file branding fields retain their validation contract, and
  // the D8 frontend branding input surface exposes exactly those four
  // approved fields — no arbitrary theme/CSS inputs and no media-path writes.
  const pathFieldPresent = /officeLogoPath\s*[?!]?:|customBackgroundPath\s*[?!]?:|printLogoPath\s*[?!]?:/.test(
    updateDtoSource,
  );
  const brandingFieldsPresent =
    /brandAccentColor\s*[?!]?:/.test(updateDtoSource) &&
    /backgroundMode\s*[?!]?:/.test(updateDtoSource) &&
    /printHeaderName\s*[?!]?:/.test(updateDtoSource) &&
    /printFooterText\s*[?!]?:/.test(updateDtoSource);

  const companyUiSources = [
    await readSource("apps/web/src/app/app/company/page.tsx"),
    await readSource("apps/web/src/app/app/company/_components/OfficeList.tsx"),
    await readSource(
      "apps/web/src/app/app/company/_components/OfficeEditor.tsx",
    ),
    await readSource(
      "apps/web/src/app/app/company/_components/CompanyMediaField.tsx",
    ),
  ];
  const companyUi = companyUiSources.join("\n");
  const apiClientSource = await readSource("apps/web/src/lib/api.ts");

  const updateInputMatch = apiClientSource.match(
    /export type UpdateCompanyInput = ([\s\S]*?)\n\};/,
  );
  const updateInputBody = updateInputMatch ? updateInputMatch[1] : "";

  const approvedInputsExposed =
    updateInputBody !== "" &&
    /brandAccentColor\??:/.test(updateInputBody) &&
    /backgroundMode\??:/.test(updateInputBody) &&
    /printHeaderName\??:/.test(updateInputBody) &&
    /printFooterText\??:/.test(updateInputBody);

  const noArbitraryThemeInputs =
    updateInputBody !== "" &&
    !/(customCss|themeJson|sidebarColor|backgroundColor|theme[A-Z]\w*|isActive|singletonKey)\??:/.test(
      updateInputBody,
    ) &&
    !/\b(?:customCss|themeJson|sidebarColor)\b/.test(companyUi);

  const noFrontendPathWrites =
    !/(officeLogoPath|customBackgroundPath|printLogoPath)\s*:\s*/.test(
      companyUi,
    );

  record(
    "Z",
    "enduring D7A invariants: DTO path fields absent, four branding fields intact, D8 frontend exposes only the approved non-file branding inputs",
    !pathFieldPresent &&
      brandingFieldsPresent &&
      approvedInputsExposed &&
      noArbitraryThemeInputs &&
      noFrontendPathWrites,
  );

  // --- Report ---------------------------------------------------------------------------

  console.log("D7A company branding contract verification (DB-free)");
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
