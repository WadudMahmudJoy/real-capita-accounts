import "reflect-metadata";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { CompanyController } from "../apps/api/src/company/company.controller";
import { CompanyService } from "../apps/api/src/company/company.service";
import { CreateCompanyDto } from "../apps/api/src/company/dto/create-company.dto";
import { UpdateCompanyDto } from "../apps/api/src/company/dto/update-company.dto";
import type { PrismaService } from "../apps/api/src/prisma/prisma.service";

/**
 * DB-free D5 dynamic Company API verifier.
 *
 * Combines:
 *  - source-contract checks on the Company controller/service (routes, guards,
 *    forbidden patterns), and
 *  - behavioral checks by instantiating the REAL CompanyService with a mock
 *    Prisma client and the REAL CompanyController with a stub service.
 *
 * No database connection is made. Exits with code 1 on any failure.
 */

const ROOT = process.cwd();

type CheckOutcome = {
  id: string;
  label: string;
  passed: boolean;
  detail: string | null;
};

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

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

type MockCompany = {
  id: string;
  name: string;
  legalName: string | null;
  singletonKey: string | null;
  isActive: boolean;
  backgroundMode: string;
  createdAt: Date;
};

type MockCall = { method: string; args: Record<string, unknown> };

type MockState = {
  companies: MockCompany[];
};

function buildMockPrisma(state: MockState) {
  const calls: MockCall[] = [];
  let idCounter = 0;

  const company = {
    async findFirst(args: Record<string, unknown> = {}) {
      calls.push({ method: "company.findFirst", args });
      const rows = state.companies.filter((row) => row.name !== undefined);
      const where = args.where as Record<string, unknown> | undefined;
      if (!where) {
        return rows.length > 0 ? rows[0] : null;
      }
      const nameFilter = where.name as Record<string, unknown> | string | undefined;
      if (nameFilter && typeof nameFilter === "object") {
        const equals = nameFilter.equals as string | undefined;
        const mode = nameFilter.mode as string | undefined;
        const notBlock = (where.NOT as { id?: string } | undefined) ?? undefined;
        const matched = rows.find((row) => {
          const sameName =
            mode === "insensitive"
              ? row.name.toLowerCase() === (equals ?? "").toLowerCase()
              : row.name === equals;
          const excluded =
            notBlock?.id !== undefined && row.id === notBlock.id;
          return sameName && !excluded;
        });
        return matched ?? null;
      }
      if (typeof nameFilter === "string") {
        return rows.find((row) => row.name === nameFilter) ?? null;
      }
      return rows[0] ?? null;
    },
    async findUnique(args: Record<string, unknown> = {}) {
      calls.push({ method: "company.findUnique", args });
      const where = args.where as { id?: string } | undefined;
      return state.companies.find((row) => row.id === where?.id) ?? null;
    },
    async findMany(args: Record<string, unknown> = {}) {
      calls.push({ method: "company.findMany", args });
      return [...state.companies];
    },
    async create(args: Record<string, unknown> = {}) {
      calls.push({ method: "company.create", args });
      const data = args.data as Record<string, unknown>;
      idCounter += 1;
      const created: MockCompany = {
        id: `created-${idCounter}`,
        name: String(data.name),
        legalName: (data.legalName as string | undefined) ?? null,
        singletonKey: (data.singletonKey as string | null | undefined) ?? null,
        isActive: true,
        backgroundMode: "DEFAULT_PREMIUM",
        createdAt: new Date(),
      };
      state.companies.push(created);
      return created;
    },
    async update(args: Record<string, unknown> = {}) {
      calls.push({ method: "company.update", args });
      const where = args.where as { id?: string } | undefined;
      const data = args.data as Record<string, unknown>;
      const row = state.companies.find((item) => item.id === where?.id);
      if (!row) {
        throw new Error("mock: company.update target not found");
      }
      return { ...row, ...data };
    },
  };

  const authSession = {
    async findUnique(args: Record<string, unknown> = {}) {
      calls.push({ method: "authSession.findUnique", args });
      return null;
    },
    async update(args: Record<string, unknown> = {}) {
      calls.push({ method: "authSession.update", args });
      return { id: (args.where as { id?: string })?.id ?? null };
    },
    async updateMany(args: Record<string, unknown> = {}) {
      calls.push({ method: "authSession.updateMany", args });
      return { count: 0 };
    },
  };

  const prisma = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work(prisma),
    authSession,
    company,
  };

  return {
    calls,
    prisma: prisma as unknown as PrismaService,
  };
}

function callsNamed(calls: MockCall[], method: string): MockCall[] {
  return calls.filter((call) => call.method === method);
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

function makeDto<T extends object>(ctor: new () => T, data: Partial<T>): T {
  return Object.assign(new ctor(), data);
}

// ---------------------------------------------------------------------------
// Behavioral + source verification
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const controllerSource = await readSource(
    "apps/api/src/company/company.controller.ts",
  );
  const serviceSource = await readSource(
    "apps/api/src/company/company.service.ts",
  );

  const c1: MockCompany = {
    id: "c1",
    name: "Real Capita Group",
    legalName: null,
    singletonKey: "PRIMARY",
    isActive: true,
    backgroundMode: "DEFAULT_PREMIUM",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const cInactive: MockCompany = {
    id: "c2",
    name: "Dormant Office",
    legalName: null,
    singletonKey: null,
    isActive: false,
    backgroundMode: "DEFAULT_PREMIUM",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
  };

  // --- GET /company compatibility ------------------------------------------

  record(
    "A",
    "GET /company route remains present (controller @Get())",
    /@Get\(\)/.test(controllerSource),
  );

  // --- GET /company/list -----------------------------------------------------

  record(
    "B",
    'GET /company/list route exists (@Get("list"))',
    /@Get\(\s*["']list["']\s*\)/.test(controllerSource),
  );

  const listMock = buildMockPrisma({ companies: [c1, cInactive] });
  const listService = new CompanyService(listMock.prisma);
  let listResult: Awaited<ReturnType<CompanyService["listCompanies"]>> | null =
    null;
  let listError: unknown = null;
  try {
    listResult = await listService.listCompanies(null);
  } catch (error) {
    listError = error;
  }

  record(
    "C",
    "list returns { activeCompanyId, companies }",
    listError === null &&
      listResult !== null &&
      "activeCompanyId" in listResult &&
      "companies" in listResult &&
      Array.isArray(listResult.companies),
    listError === null ? undefined : String(listError),
  );

  const listArgs = callsNamed(listMock.calls, "company.findMany")[0]?.args;

  record(
    "D",
    "companies list uses deterministic ordering (createdAt asc, then id asc)",
    JSON.stringify((listArgs?.orderBy as unknown[]) ?? null) ===
      JSON.stringify([{ createdAt: "asc" }, { id: "asc" }]),
  );

  record(
    "E",
    "list does not exclude inactive offices",
    listResult !== null &&
      listResult.companies.some((company) => company.id === "c2") &&
      (listArgs?.where === undefined ||
        Object.keys(listArgs.where as object).length === 0),
  );

  // --- GET /company selected resolution ---------------------------------------

  const getMock = buildMockPrisma({ companies: [c1, cInactive] });
  const getService = new CompanyService(getMock.prisma);

  let nullSelectionError: unknown = null;
  try {
    await getService.findSelectedCompany(null);
  } catch (error) {
    nullSelectionError = error;
  }

  record(
    "F",
    "GET /company resolves the exact session activeCompanyId (findUnique by id)",
    (await safeCall(() => getService.findSelectedCompany("c1"))).value !==
      null &&
      callsNamed(getMock.calls, "company.findUnique").some(
        (call) =>
          (call.args.where as { id?: string } | undefined)?.id === "c1",
      ),
  );

  record(
    "G",
    "GET /company has no singleton/default-company fallback (null → NotFound; no findFirst)",
    nullSelectionError instanceof NotFoundException &&
      callsNamed(getMock.calls, "company.findFirst").length === 0,
  );

  const inactiveSelected = (
    await safeCall(() => getService.findSelectedCompany("c2"))
  ).value;

  record(
    "G2",
    "GET /company returns an inactive selected company instead of switching offices",
    inactiveSelected !== null && inactiveSelected.id === "c2",
  );

  // --- POST /company multi-company create ----------------------------------------

  const createMock = buildMockPrisma({ companies: [{ ...c1 }] });
  const createService = new CompanyService(createMock.prisma);

  const firstCompanyDto = makeDto(CreateCompanyDto, {
    name: "Second Office",
    legalName: "Second Office Ltd",
  });

  let created: Awaited<ReturnType<CompanyService["create"]>> | null = null;
  let createError: unknown = null;
  try {
    created = await createService.create(firstCompanyDto, {
      id: "s1",
      activeCompanyId: null,
    });
  } catch (error) {
    createError = error;
  }

  record(
    "H",
    "POST /company no longer rejects merely because a Company exists",
    createError === null && created !== null,
    createError === null ? undefined : String(createError),
  );

  const createArgs = callsNamed(createMock.calls, "company.create")[0]?.args;

  record(
    "I",
    "create does not assign PRIMARY/singletonKey",
    createArgs !== undefined &&
      !("singletonKey" in (createArgs.data as object)),
  );

  const duplicateDto = makeDto(CreateCompanyDto, {
    name: "REAL CAPITA GROUP",
  });

  let duplicateError: unknown = null;
  try {
    await createService.create(duplicateDto, {
      id: "s1",
      activeCompanyId: "c1",
    });
  } catch (error) {
    duplicateError = error;
  }

  record(
    "J",
    "duplicate names are rejected case-insensitively (ConflictException)",
    duplicateError instanceof ConflictException,
    duplicateError === null ? undefined : String(duplicateError),
  );

  const bindingCall = callsNamed(createMock.calls, "authSession.update").find(
    (call) =>
      (call.args.where as { id?: string } | undefined)?.id === "s1",
  );

  record(
    "K",
    "first Company creation binds the caller's NULL AuthSession (where id = caller session)",
    bindingCall !== undefined &&
      (bindingCall.args.data as { activeCompanyId?: string } | undefined)
        ?.activeCompanyId === created?.id,
  );

  const secondCreateMock = buildMockPrisma({ companies: [{ ...c1 }] });
  const secondCreateService = new CompanyService(secondCreateMock.prisma);
  const secondOfficeDto = makeDto(CreateCompanyDto, {
    name: "Third Office",
  });
  await safeCall(() =>
    secondCreateService.create(secondOfficeDto, {
      id: "s9",
      activeCompanyId: "c1",
    }),
  );

  record(
    "L",
    "creating another Company when the session already has an activeCompanyId does NOT switch the session",
    callsNamed(secondCreateMock.calls, "authSession.update").length === 0,
  );

  // --- PATCH /company/:id -----------------------------------------------------------

  const updateMock = buildMockPrisma({ companies: [{ ...c1 }, { ...cInactive }] });
  const updateService = new CompanyService(updateMock.prisma);
  const renameDto = makeDto(UpdateCompanyDto, { name: "New Office Name" });

  const updated = (
    await safeCall(() => updateService.update("c1", renameDto))
  ).value;
  const updateArgs = callsNamed(updateMock.calls, "company.update")[0]?.args;

  record(
    "M",
    "PATCH /company/:id remains id-based (company.update where id)",
    updated !== null &&
      (updateArgs?.where as { id?: string } | undefined)?.id === "c1",
  );

  const duplicateUpdateMock = buildMockPrisma({
    companies: [{ ...c1 }, { ...cInactive }],
  });
  const duplicateUpdateService = new CompanyService(
    duplicateUpdateMock.prisma,
  );
  const duplicateRenameDto = makeDto(UpdateCompanyDto, {
    name: "Dormant Office",
  });

  let renameDuplicateError: unknown = null;
  try {
    await duplicateUpdateService.update("c1", duplicateRenameDto);
  } catch (error) {
    renameDuplicateError = error;
  }

  record(
    "N",
    "rename duplicate-name protection exists (excluding self, ConflictException)",
    renameDuplicateError instanceof ConflictException,
    renameDuplicateError === null ? undefined : String(renameDuplicateError),
  );

  // --- POST /company/:id/switch --------------------------------------------------------

  record(
    "O",
    'POST /company/:id/switch route exists (@Post(":id/switch"))',
    /@Post\(\s*["']:id\/switch["']\s*\)/.test(controllerSource),
  );

  const switchMock = buildMockPrisma({ companies: [{ ...c1 }, { ...cInactive }] });
  const switchService = new CompanyService(switchMock.prisma);

  let missingSwitchError: unknown = null;
  try {
    await switchService.switchCompany("missing", {
      id: "sA",
      activeCompanyId: null,
    });
  } catch (error) {
    missingSwitchError = error;
  }

  record(
    "P",
    "switch rejects a missing target (NotFoundException)",
    missingSwitchError instanceof NotFoundException,
  );

  let inactiveSwitchError: unknown = null;
  try {
    await switchService.switchCompany("c2", {
      id: "sA",
      activeCompanyId: "c1",
    });
  } catch (error) {
    inactiveSwitchError = error;
  }

  record(
    "Q",
    "switch rejects an inactive target (ConflictException)",
    inactiveSwitchError instanceof ConflictException,
    inactiveSwitchError === null ? undefined : String(inactiveSwitchError),
  );

  let switchResult: Awaited<ReturnType<CompanyService["switchCompany"]>> | null =
    null;
  let switchError: unknown = null;
  try {
    switchResult = await switchService.switchCompany("c1", {
      id: "sA",
      activeCompanyId: "c2",
    });
  } catch (error) {
    switchError = error;
  }

  const switchUpdateCall = callsNamed(switchMock.calls, "authSession.update")[0];

  record(
    "R",
    "switch updates only the exact caller AuthSession id",
    switchError === null &&
      (switchUpdateCall?.args.where as { id?: string } | undefined)?.id ===
        "sA",
    switchError === null ? undefined : String(switchError),
  );

  record(
    "S",
    "switch does not use updateMany anywhere in behavioral flows",
    callsNamed(switchMock.calls, "authSession.updateMany").length === 0 &&
      !/updateMany/.test(serviceSource),
  );

  record(
    "T",
    "switch does not mutate Company/singletonKey",
    callsNamed(switchMock.calls, "company.update").length === 0 &&
      !/singletonKey/.test(serviceSource) &&
      !/["']PRIMARY["']/.test(serviceSource),
  );

  record(
    "U",
    "switching to the already-selected company is idempotently successful",
    switchResult !== null &&
      switchResult.status === "ok" &&
      switchResult.activeCompanyId === "c1",
  );

  // Same-company switch idempotence explicit check
  const sameMock = buildMockPrisma({ companies: [{ ...c1 }] });
  const sameService = new CompanyService(sameMock.prisma);
  const sameSwitch = (
    await safeCall(() =>
      sameService.switchCompany("c1", { id: "sB", activeCompanyId: "c1" }),
    )
  ).value;

  record(
    "U2",
    "same-company switch returns success without error",
    sameSwitch !== null && sameSwitch.status === "ok",
  );

  // --- Forbidden endpoints/patterns -----------------------------------------------------

  // D7B note: the original D5 form rejected ANY @Delete route. D7B's
  // authorized media-asset removal route (DELETE /company/:id/media/:kind)
  // made that form obsolete; the enduring D5 invariant — no Company record
  // deletion/lifecycle endpoint — remains fully tested.
  record(
    "V",
    "no Company record deletion endpoint (D7B media-asset removal only)",
    !/@Delete\(":id"\)/.test(controllerSource) &&
      !/company\.delete\b|company\.deleteMany\b/.test(serviceSource),
  );

  record(
    "W",
    "no deactivate/activate endpoint in D5",
    !/deactivate|activate/i.test(
      controllerSource.replace(/AuthGuard|RolesGuard/g, ""),
    ),
  );

  record(
    "X",
    "no PRIMARY/singletonKey runtime lookup in company service/controller",
    !/singletonKey/.test(serviceSource) &&
      !/singletonKey/.test(controllerSource) &&
      !/["']PRIMARY["']/.test(serviceSource) &&
      !/["']PRIMARY["']/.test(controllerSource),
  );

  record(
    "Y",
    "no Afseen/RESDA hard-coding",
    !/afseen|resda/i.test(serviceSource) &&
      !/afseen|resda/i.test(controllerSource),
  );

  // D7B note: the original D5 phase boundary asserted no branding upload API
  // existed at all. D7B is the authorized media phase, so this check now pins
  // the enduring invariant instead: the JSON Create/Update contract can never
  // write media path fields — only the D7B media service owns those.
  const updateDtoMediaSource = await readFile(
    path.join(ROOT, "apps/api/src/company/dto/update-company.dto.ts"),
    "utf8",
  );
  const pathFieldInDto = /officeLogoPath\s*[?!]?:|customBackgroundPath\s*[?!]?:|printLogoPath\s*[?!]?:/.test(
    updateDtoMediaSource,
  );
  record(
    "Z",
    "Company JSON Create/Update cannot write media path fields (paths stay server-owned); D5 list/create/update/switch semantics intact",
    !pathFieldInDto,
  );

  record(
    "AA",
    "Auth/role guards remain on the Company controller",
    /@Roles\(ACCOUNTANT_ROLE\)/.test(controllerSource) &&
      /@UseGuards\(AuthGuard,\s*RolesGuard\)/.test(controllerSource),
  );

  // --- Controller behavioral wiring -------------------------------------------------------

  const stubService = {
    create: (dto: unknown, session: unknown) => ({ dto, session }),
    findSelectedCompany: (id: unknown) => ({ id }),
    listCompanies: (id: unknown) => ({ id }),
    switchCompany: (id: unknown, session: unknown) => ({ id, session }),
    update: (id: unknown, dto: unknown) => ({ id, dto }),
  };
  const controller = new CompanyController(
    stubService as unknown as CompanyService,
  );

  const fakeReq = {
    authSession: { id: "sess-1", activeCompanyId: "c1", tokenId: "t", expiresAt: new Date() },
    user: { id: "u1", email: "e", fullName: "n", roles: [] },
  } as never;

  const listWired =
    typeof (controller as unknown as Record<string, unknown>).list ===
      "function" &&
    JSON.stringify(
      await (controller as unknown as { list: (req: unknown) => unknown }).list(
        fakeReq,
      ),
    ) === JSON.stringify({ id: "c1" });

  record(
    "AB1",
    "controller.list wires request.authSession.activeCompanyId into listCompanies",
    listWired,
  );

  const selectedWired =
    typeof (controller as unknown as Record<string, unknown>)
      .findSelected === "function" &&
    JSON.stringify(
      await (
        controller as unknown as {
          findSelected: (req: unknown) => unknown;
        }
      ).findSelected(fakeReq),
    ) === JSON.stringify({ id: "c1" });

  record(
    "AB2",
    "controller.findSelected wires the session activeCompanyId",
    selectedWired,
  );

  const createWired =
    typeof (controller as unknown as Record<string, unknown>).create ===
      "function" &&
    JSON.stringify(
      await (controller as unknown as { create: (dto: unknown, req: unknown) => unknown }).create(
        { name: "X" },
        fakeReq,
      ),
    ) ===
      JSON.stringify({
        dto: { name: "X" },
        session: { id: "sess-1", activeCompanyId: "c1" },
      });

  record(
    "AB3",
    "controller.create passes the caller session into service.create",
    createWired,
  );

  const switchWired =
    typeof (controller as unknown as Record<string, unknown>).switch ===
      "function" &&
    JSON.stringify(
      await (controller as unknown as { switch: (id: unknown, req: unknown) => unknown }).switch(
        "c2",
        fakeReq,
      ),
    ) ===
      JSON.stringify({
        id: "c2",
        session: { id: "sess-1", activeCompanyId: "c1" },
      });

  record(
    "AB4",
    "controller.switch passes id + exact caller session into switchCompany",
    switchWired,
  );

  // --- D8 consumes the D5 API contract ---------------------------------------------

  // D8 note: the original D5 phase boundary asserted no frontend
  // implementation existed. D8 is the authorized Company Setup frontend
  // phase, so this check now pins the enduring invariant: the frontend
  // consumes the approved D5 routes through the shared API client instead of
  // reimplementing Company list/switch semantics.

  const apiClientSource = await readSource("apps/web/src/lib/api.ts");

  const listHelperConsumesD5Route =
    /export function getCompanies\(/.test(apiClientSource) &&
    /\/company\/list/.test(apiClientSource);

  const switchHelperConsumesD5Route =
    /export function switchCompany\(/.test(apiClientSource) &&
    /\/company\/\$\{companyId\}\/switch/.test(apiClientSource);

  const compatibilityHelpersRemain =
    /export function getCompany\(/.test(apiClientSource) &&
    /export function createCompany\(/.test(apiClientSource) &&
    /export function updateCompany\(/.test(apiClientSource);

  record(
    "AB",
    "D8 frontend consumes the D5 API contract (getCompanies -> GET /company/list, switchCompany -> POST /company/:id/switch, getCompany/createCompany/updateCompany remain)",
    listHelperConsumesD5Route &&
      switchHelperConsumesD5Route &&
      compatibilityHelpersRemain,
  );

  // --- Report ---------------------------------------------------------------------------

  console.log("D5 dynamic Company API verification (DB-free)");
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
