import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * DB-free D2 schema contract verifier.
 *
 * Reads prisma/schema.prisma directly (no database connection, no generated
 * client) and asserts the Phase D2 multi-office schema foundation contract.
 * Exits with code 1 when any check fails.
 *
 * The RESDA base accent (#652B7C) is approved as future Company DATA, never as
 * a schema hard-code; this verifier proves the production schema stays free of
 * RESDA-specific values or names.
 */

type SchemaBlock = {
  kind: "model" | "enum";
  name: string;
  lines: string[];
};

type CheckOutcome = {
  id: string;
  label: string;
  passed: boolean;
  detail: string | null;
};

const SCHEMA_PATH = path.resolve(process.cwd(), "prisma", "schema.prisma");

const ACTIVE_COMPANY_RELATION_NAME = "AuthSessionActiveCompany";

const PRESERVED_COMPANY_RELATIONS = [
  "fiscalYears",
  "vouchers",
  "voucherNumberSequences",
  "workSchedules",
  "workScheduleAssignments",
  "attendanceRecords",
  "attendanceDayFinalizations",
  "attendancePolicies",
  "companyCalendarExceptions",
];

const FORBIDDEN_COLOR_THEME_FIELDS = [
  "sidebarColor",
  "sidebarBackgroundColor",
  "pageBackgroundColor",
  "backgroundColor",
  "primaryColor",
  "secondaryColor",
  "buttonColor",
  "textColor",
  "themeJson",
  "customCss",
  "customStyles",
  "cssVariables",
];

const UNSCOPED_MODELS = [
  "LedgerAccount",
  "Project",
  "CostCenter",
  "CashBankAccount",
  "Department",
  "Employee",
  "Customer",
  "Booking",
];

function stripLineComments(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

function extractBlocks(text: string): SchemaBlock[] {
  const blocks: SchemaBlock[] = [];
  let current: SchemaBlock | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();

    if (current) {
      if (trimmed === "}") {
        blocks.push(current);
        current = null;
      } else {
        current.lines.push(rawLine);
      }
      continue;
    }

    const modelMatch = /^model\s+(\w+)\s*\{$/.exec(trimmed);
    const enumMatch = /^enum\s+(\w+)\s*\{$/.exec(trimmed);

    if (modelMatch) {
      current = { kind: "model", name: modelMatch[1], lines: [] };
    } else if (enumMatch) {
      current = { kind: "enum", name: enumMatch[1], lines: [] };
    }
  }

  return blocks;
}

function fieldLines(block: SchemaBlock, fieldName: string): string[] {
  const pattern = new RegExp(`^\\s*${fieldName}\\s`);
  return block.lines.filter((line) => pattern.test(line));
}

function hasField(block: SchemaBlock, fieldName: string): boolean {
  return fieldLines(block, fieldName).length > 0;
}

function findLine(
  block: SchemaBlock | undefined,
  fieldName: string,
): string | undefined {
  return block === undefined
    ? undefined
    : fieldLines(block, fieldName)[0];
}

function enumValues(block: SchemaBlock): string[] {
  return block.lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function main(): Promise<number> {
  const rawText = await readFile(SCHEMA_PATH, "utf8");
  const codeText = stripLineComments(rawText);
  const blocks = extractBlocks(codeText);

  const models = blocks.filter((block) => block.kind === "model");
  const modelNames = new Set(models.map((block) => block.name));
  const getModel = (name: string): SchemaBlock | undefined =>
    models.find((block) => block.name === name);

  const authSession = getModel("AuthSession");
  const company = getModel("Company");
  const user = getModel("User");

  const outcomes: CheckOutcome[] = [];

  function record(
    id: string,
    label: string,
    passed: boolean,
    detail?: string,
  ): void {
    outcomes.push({ id, label, passed, detail: detail ?? null });
  }

  const activeCompanyIdLine = findLine(authSession, "activeCompanyId");
  const activeCompanyRelationLine = authSession?.lines.find((line) =>
    /^\s*activeCompany\s+Company\s*\?\s*@relation\(/.test(line),
  );
  const activeCompanyIndexLine = authSession?.lines.find((line) =>
    /@@index\(\s*\[\s*activeCompanyId\s*\]\s*\)/.test(line),
  );
  const singletonKeyLine = findLine(company, "singletonKey");
  const brandAccentColorLine = findLine(company, "brandAccentColor");
  const backgroundModeLine = findLine(company, "backgroundMode");
  const activeSessionsLine = company?.lines.find((line) =>
    /^\s*activeSessions\s+AuthSession\[\]\s*@relation\(/.test(line),
  );
  const backgroundModeEnum = blocks.find(
    (block) => block.kind === "enum" && block.name === "CompanyBackgroundMode",
  );
  const backgroundModeValues = backgroundModeEnum
    ? enumValues(backgroundModeEnum)
    : [];

  // --- AuthSession active-company contract -------------------------------

  record(
    "A",
    "AuthSession.activeCompanyId exists",
    authSession !== undefined &&
      fieldLines(authSession, "activeCompanyId").length === 1,
  );

  record(
    "B",
    "AuthSession.activeCompanyId is nullable (String?)",
    activeCompanyIdLine !== undefined &&
      /^\s*activeCompanyId\s+String\s*\?/.test(activeCompanyIdLine),
  );

  record(
    "C",
    "AuthSession has an optional active Company relation",
    activeCompanyRelationLine !== undefined,
  );

  record(
    "D",
    `activeCompany relation is named ${ACTIVE_COMPANY_RELATION_NAME} and uses onDelete: SetNull`,
    activeCompanyRelationLine !== undefined &&
      activeCompanyRelationLine.includes(`"${ACTIVE_COMPANY_RELATION_NAME}"`) &&
      /onDelete:\s*SetNull/.test(activeCompanyRelationLine),
  );

  record(
    "E",
    "AuthSession has @@index([activeCompanyId])",
    activeCompanyIndexLine !== undefined,
  );

  // --- Company singleton compatibility ------------------------------------

  record(
    "F",
    "Company.singletonKey is nullable (String?)",
    singletonKeyLine !== undefined &&
      /^\s*singletonKey\s+String\s*\?/.test(singletonKeyLine),
  );

  record(
    "G",
    "Company.singletonKey remains @unique",
    singletonKeyLine !== undefined && /@unique/.test(singletonKeyLine),
  );

  record(
    "H",
    'Company.singletonKey has NO @default("PRIMARY")',
    singletonKeyLine !== undefined && !/@default/.test(singletonKeyLine),
  );

  // --- Company active state ------------------------------------------------

  record(
    "I",
    "Company.isActive exists with @default(true)",
    company !== undefined &&
      /^\s*isActive\s+Boolean\s+@default\(true\)/.test(
        findLine(company, "isActive") ?? "",
      ),
  );

  // --- Branding / background / print fields --------------------------------

  record(
    "J",
    "Company.officeLogoPath is nullable String?",
    company !== undefined &&
      /^\s*officeLogoPath\s+String\s*\?/.test(
        findLine(company, "officeLogoPath") ?? "",
      ),
  );

  record(
    "K",
    "Company.backgroundMode is CompanyBackgroundMode @default(DEFAULT_PREMIUM)",
    backgroundModeLine !== undefined &&
      /^\s*backgroundMode\s+CompanyBackgroundMode\s+@default\(DEFAULT_PREMIUM\)/.test(
        backgroundModeLine,
      ),
  );

  record(
    "L",
    "Company.customBackgroundPath is nullable String?",
    company !== undefined &&
      /^\s*customBackgroundPath\s+String\s*\?/.test(
        findLine(company, "customBackgroundPath") ?? "",
      ),
  );

  record(
    "M",
    "Company.printLogoPath is nullable String?",
    company !== undefined &&
      /^\s*printLogoPath\s+String\s*\?/.test(
        findLine(company, "printLogoPath") ?? "",
      ),
  );

  record(
    "N",
    "Company.printHeaderName is nullable String?",
    company !== undefined &&
      /^\s*printHeaderName\s+String\s*\?/.test(
        findLine(company, "printHeaderName") ?? "",
      ),
  );

  record(
    "O",
    "Company.printFooterText is nullable String?",
    company !== undefined &&
      /^\s*printFooterText\s+String\s*\?/.test(
        findLine(company, "printFooterText") ?? "",
      ),
  );

  // --- Background mode enum -------------------------------------------------

  const enumExact =
    backgroundModeValues.length === 2 &&
    backgroundModeValues.includes("DEFAULT_PREMIUM") &&
    backgroundModeValues.includes("CUSTOM");

  record(
    "P",
    "CompanyBackgroundMode enum contains exactly DEFAULT_PREMIUM and CUSTOM values",
    enumExact,
    backgroundModeValues.length > 0
      ? backgroundModeValues.join(", ")
      : "enum not found",
  );

  // --- Company back-relation -------------------------------------------------

  record(
    "Q",
    `Company has activeSessions AuthSession[] back-relation named ${ACTIVE_COMPANY_RELATION_NAME}`,
    activeSessionsLine !== undefined &&
      activeSessionsLine.includes(`"${ACTIVE_COMPANY_RELATION_NAME}"`),
  );

  // --- Forbidden inventions ----------------------------------------------------

  record(
    "R",
    "No UserCompanyAccess model has been invented",
    !modelNames.has("UserCompanyAccess"),
  );

  record(
    "S",
    "No User.lastCompanyId or User.defaultCompanyId has been invented",
    user === undefined ||
      (!hasField(user, "lastCompanyId") && !hasField(user, "defaultCompanyId")),
  );

  // --- Office accent color amendment --------------------------------------------

  record(
    "AM1",
    "Company.brandAccentColor exists as nullable String?",
    brandAccentColorLine !== undefined &&
      /^\s*brandAccentColor\s+String\s*\?/.test(brandAccentColorLine),
  );

  record(
    "AM2",
    "Company.brandAccentColor has no schema default",
    brandAccentColorLine !== undefined && !/@default/.test(brandAccentColorLine),
  );

  const foundForbiddenFields = FORBIDDEN_COLOR_THEME_FIELDS.filter((field) =>
    new RegExp(`\\b${field}\\b`).test(codeText),
  );

  record(
    "AM3",
    "No sidebarColor/backgroundColor/customCss/themeJson or other unauthorized color/theme fields exist",
    foundForbiddenFields.length === 0,
    foundForbiddenFields.length > 0 ? foundForbiddenFields.join(", ") : undefined,
  );

  const resdaHit = /resda/i.test(rawText) || /652b7c/i.test(rawText);

  record(
    "AM4",
    "No RESDA-specific value or company name is hard-coded into the schema",
    !resdaHit,
  );

  // --- Additional locked-boundary checks -----------------------------------------

  const forbiddenModels = ["Office", "Tenant", "Organization"];

  record(
    "X1",
    "No Office/Tenant/Organization models have been invented",
    forbiddenModels.every((name) => !modelNames.has(name)),
  );

  const activeOfficeIdOwners = models
    .filter((block) => hasField(block, "activeOfficeId"))
    .map((block) => block.name);

  record(
    "X2",
    "No activeOfficeId field exists anywhere",
    activeOfficeIdOwners.length === 0,
    activeOfficeIdOwners.length > 0 ? activeOfficeIdOwners.join(", ") : undefined,
  );

  const forbiddenCompanyFields = ["website", "isDefault", "deletedAt"];
  const foundForbiddenCompanyFields =
    company === undefined
      ? forbiddenCompanyFields
      : forbiddenCompanyFields.filter((field) => hasField(company, field));

  record(
    "X3",
    "Company has no website/isDefault/deletedAt fields",
    foundForbiddenCompanyFields.length === 0,
    foundForbiddenCompanyFields.length > 0
      ? foundForbiddenCompanyFields.join(", ")
      : undefined,
  );

  const scopedGlobalModules = UNSCOPED_MODELS.filter((name) => {
    const block = getModel(name);
    return block !== undefined && hasField(block, "companyId");
  });

  record(
    "X4",
    "Ledger/Project/CostCenter/CashBank/Department/Employee/Customer/Booking remain unscoped (no companyId)",
    scopedGlobalModules.length === 0,
    scopedGlobalModules.length > 0 ? scopedGlobalModules.join(", ") : undefined,
  );

  const missingPreservedRelations =
    company === undefined
      ? PRESERVED_COMPANY_RELATIONS
      : PRESERVED_COMPANY_RELATIONS.filter(
          (relation) => !hasField(company, relation),
        );

  const companyIdPreserved =
    company !== undefined &&
    /^\s*id\s+String\s+@id\s+@default\(cuid\(\)\)/.test(
      findLine(company, "id") ?? "",
    );

  record(
    "X5",
    "Company.id and all existing company-owned relations are preserved",
    companyIdPreserved && missingPreservedRelations.length === 0,
    missingPreservedRelations.length > 0
      ? `missing relations: ${missingPreservedRelations.join(", ")}`
      : undefined,
  );

  const authSessionCorePreserved =
    authSession !== undefined &&
    /^\s*id\s+String\s+@id\s+@default\(cuid\(\)\)/.test(
      findLine(authSession, "id") ?? "",
    ) &&
    hasField(authSession, "userId") &&
    /^\s*tokenId\s+String\s+@unique/.test(findLine(authSession, "tokenId") ?? "") &&
    hasField(authSession, "expiresAt") &&
    hasField(authSession, "revokedAt") &&
    fieldLines(authSession, "user").some((line) => /@relation\(/.test(line)) &&
    authSession.lines.some((line) => /@@index\(\s*\[\s*userId\s*\]\s*\)/.test(line)) &&
    authSession.lines.some((line) =>
      /@@index\(\s*\[\s*expiresAt\s*\]\s*\)/.test(line),
    );

  record(
    "X6",
    "AuthSession core fields, user relation, and existing indexes are preserved",
    authSessionCorePreserved,
  );

  // --- Report ---------------------------------------------------------------------

  console.log("D2 multi-office schema verification (DB-free)");
  console.log(`Schema: ${SCHEMA_PATH}`);
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
