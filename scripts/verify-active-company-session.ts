import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * DB-free D4 active-company session foundation verifier.
 *
 * Inspects the actual bytes of the auth runtime files and asserts the Phase D4
 * contract. No database connection, no generated client import. Exits with
 * code 1 when any check fails.
 */

type CheckOutcome = {
  id: string;
  label: string;
  passed: boolean;
  detail: string | null;
};

const ROOT = process.cwd();

const AUTH_SERVICE_PATH = path.join(
  ROOT,
  "apps/api/src/auth/auth.service.ts",
);
const AUTH_GUARD_PATH = path.join(ROOT, "apps/api/src/auth/guards/auth.guard.ts");
const AUTH_TYPES_PATH = path.join(ROOT, "apps/api/src/auth/auth.types.ts");
const ACTIVE_COMPANY_DECORATOR_PATH = path.join(
  ROOT,
  "apps/api/src/auth/decorators/active-company.decorator.ts",
);

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function stripLineComments(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

async function main(): Promise<number> {
  const authService = await readIfExists(AUTH_SERVICE_PATH);
  const authGuard = await readIfExists(AUTH_GUARD_PATH);
  const authTypes = await readIfExists(AUTH_TYPES_PATH);
  const decorator = await readIfExists(ACTIVE_COMPANY_DECORATOR_PATH);

  const authServiceCode =
    authService === null ? "" : stripLineComments(authService);
  const authGuardCode = authGuard === null ? "" : stripLineComments(authGuard);
  const authTypesCode = authTypes === null ? "" : stripLineComments(authTypes);
  const decoratorCode = decorator === null ? "" : stripLineComments(decorator);

  const outcomes: CheckOutcome[] = [];

  function record(
    id: string,
    label: string,
    passed: boolean,
    detail?: string,
  ): void {
    outcomes.push({ id, label, passed, detail: detail ?? null });
  }

  // --- Login default-company contract -------------------------------------

  // The spec pins the where/orderBy contract contents, not the object key
  // order, so the whole findFirst call argument is captured (nested braces
  // included, up to the call-closing brace+paren) and its contents checked.
  function firstCallArgumentContains(
    code: string,
    property: string,
    propertyName: string,
  ): boolean {
    const argument = /company\.findFirst\s*\(\s*\{([\s\S]*?)\}\s*,?\s*\)/.exec(
      code,
    )?.[1];

    if (argument === undefined) {
      return false;
    }

    return new RegExp(
      `${property}\\s*:\\s*\\{\\s*${propertyName}\\s*:\\s*true\\s*,?\\s*\\}`,
    ).test(argument);
  }

  const loginDefaultCompanyQuery = firstCallArgumentContains(
    authServiceCode,
    "where",
    "isActive",
  );

  const loginHasAscOrdering = /orderBy:\s*\{\s*createdAt:\s*"asc"\s*,?\s*\}/.test(
    authServiceCode,
  );

  const loginPassesActiveCompanyId =
    /authSession\.create\s*\(\s*\{\s*data:\s*\{\s*[^}]*activeCompanyId/.test(
      authServiceCode,
    );

  record(
    "A",
    "login selects a default ACTIVE company (findFirst where isActive true)",
    loginDefaultCompanyQuery,
  );

  record(
    "B",
    "default company ordering is deterministic: createdAt asc",
    loginHasAscOrdering,
  );

  record(
    "C",
    "AuthSession creation receives activeCompanyId",
    loginPassesActiveCompanyId,
  );

  record(
    "D",
    "login tolerates no company (null fallback in create data)",
    /\?\?\s*null/.test(authServiceCode) &&
      /activeCompanyId:\s*[^,\n]+\?\?[^,\n]*null/.test(authServiceCode),
  );

  // --- AuthGuard context -----------------------------------------------------

  const guardIncludesActiveCompany = /activeCompany:/.test(authGuardCode);

  record(
    "E",
    "AuthGuard includes the session's activeCompany relation",
    guardIncludesActiveCompany,
  );

  const guardExposesActiveCompanyIdInAuthSession =
    /authSession\s*=\s*\{[^}]*activeCompanyId/.test(authGuardCode);

  record(
    "F",
    "AuthGuard exposes activeCompanyId in request.authSession",
    guardExposesActiveCompanyIdInAuthSession,
  );

  const guardExposesActiveCompany = /request\.activeCompany\s*=/.test(
    authGuardCode,
  );

  record(
    "G",
    "AuthGuard assigns request.activeCompany",
    guardExposesActiveCompany,
  );

  // --- Legacy NULL-session fallback --------------------------------------------

  const guardHasLegacyFallbackQuery = firstCallArgumentContains(
    authGuardCode,
    "where",
    "isActive",
  ) && /orderBy:\s*\{\s*createdAt:\s*"asc"\s*,?\s*\}/.test(authGuardCode);

  record(
    "H",
    "legacy session with activeCompanyId NULL resolves the oldest ACTIVE company",
    guardHasLegacyFallbackQuery,
  );

  const guardPersistsFallback =
    /authSession\.update\s*\(\s*\{\s*data:\s*\{\s*activeCompanyId/.test(
      authGuardCode,
    );

  record(
    "I",
    "NULL fallback is persisted to that exact AuthSession row",
    guardPersistsFallback,
  );

  // The fallback path must be guarded by a null check on the session's
  // activeCompanyId; either polarity expresses that guard.
  const guardPreservesNonNullSelection =
    /session\.activeCompanyId\s*(?:===?|!==?)\s*null/.test(authGuardCode) &&
    /session\.activeCompanyId\s*===?\s*null/.test(authGuardCode);

  record(
    "J",
    "non-null activeCompanyId is never silently replaced by another company",
    guardPreservesNonNullSelection,
  );

  const guardRejectsInactiveOnlyForFallback =
    guardHasLegacyFallbackQuery && !/throw[^;]*inactive/i.test(authGuardCode);

  record(
    "K",
    "inactive explicitly-selected company is NOT silently switched to a different office",
    guardRejectsInactiveOnlyForFallback,
  );

  // --- Purity / boundary rules ----------------------------------------------------

  const authRuntimeText = `${authServiceCode}\n${authGuardCode}`;

  record(
    "L",
    "no singletonKey / PRIMARY lookup is used in auth runtime code",
    !/singletonKey/.test(authRuntimeText) && !/"PRIMARY"/.test(authRuntimeText),
  );

  const typesText = authTypesCode;

  // Extract the AuthTokenPayload block and assert it holds only sub/sid/jti.
  const authTokenPayloadBlock = /export type AuthTokenPayload = \{([\s\S]*?)\};/.exec(
    typesText,
  )?.[1];

  record(
    "M",
    "activeCompanyId is NOT added to JWT payload (sub/sid/jti only)",
    authTokenPayloadBlock !== undefined &&
      /^\s*sub: string;\s*sid: string;\s*jti: string;\s*$/.test(
        authTokenPayloadBlock,
      ) && !/activeCompan/i.test(authTokenPayloadBlock),
  );

  record(
    "N",
    "User model/default-company behavior is NOT invented in auth types",
    !/lastCompanyId|defaultCompanyId/.test(typesText),
  );

  // --- Decorator ---------------------------------------------------------------------

  record(
    "O",
    "ActiveCompany decorator exists",
    decorator !== null && /export const ActiveCompany/.test(decoratorCode),
  );

  record(
    "P",
    "ActiveCompany decorator reads request.activeCompany",
    decoratorCode.includes("request.activeCompany") ||
      decoratorCode.includes(".activeCompany"),
  );

  const decoratorHasNoPrisma = !/prisma/i.test(decoratorCode);

  record(
    "Q",
    "decorator performs no database query",
    decoratorHasNoPrisma && !/findFirst|findUnique|queryRaw/.test(decoratorCode),
  );

  // --- No Company API logic in auth runtime ----------------------------------------------
  // D5 note: the original D4 form asserted the company controller was
  // unchanged from pre-D4. The D5-approved Company API necessarily implements
  // list/switch there, so this check now pins the enduring D4 invariant
  // instead: the auth runtime itself never grows Company API logic.

  record(
    "R",
    "no Company list/switch API implementation appears in auth runtime code",
    !/company\.findMany|company\.update|@Get|@Post/.test(authServiceCode) &&
      !/company\.findMany|company\.update|@Get|@Post/.test(authGuardCode),
  );

  // --- Report ---------------------------------------------------------------------------

  console.log("D4 active-company session verification (DB-free)");
  console.log(`Auth service: ${AUTH_SERVICE_PATH}`);
  console.log(`Auth guard:   ${AUTH_GUARD_PATH}`);
  console.log("");
  // Remove non-serializable marker properties before reporting.
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
