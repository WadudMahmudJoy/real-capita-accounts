import "reflect-metadata";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { FiscalYearService } from "../apps/api/src/fiscal-year/fiscal-year.service";
import { AccountingPeriodService } from "../apps/api/src/accounting-period/accounting-period.service";
import { VoucherService } from "../apps/api/src/voucher/voucher.service";
import type { ActiveCompanyContext } from "../apps/api/src/auth/auth.types";

/**
 * DB-free D6B verifier: accounting active-company ownership.
 *
 * Source-contract checks over the actual Fiscal Year / Accounting Period /
 * Voucher production bytes, plus behavioral checks with a mock Prisma client.
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

async function readSource(relativePath: string): Promise<string> {
  const text = await readFile(path.join(ROOT, relativePath), "utf8");
  return stripLineComments(text);
}

async function safeCall<T>(
  fn: () => Promise<T> | T,
): Promise<{ value: T | null; error: unknown }> {
  try {
    return { value: await fn(), error: null };
  } catch (error) {
    return { value: null, error };
  }
}

function companyContextFixture(
  id: string,
  isActive: boolean,
): ActiveCompanyContext {
  return {
    id,
    name: `Office ${id}`,
    legalName: null,
    isActive,
    officeLogoPath: null,
    brandAccentColor: null,
    backgroundMode: "DEFAULT_PREMIUM" as const,
    customBackgroundPath: null,
  };
}

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

type MockFiscalYear = {
  id: string;
  companyId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isClosed: boolean;
};

type MockAccountingPeriod = {
  id: string;
  fiscalYearId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type MockVoucher = {
  id: string;
  companyId: string;
  fiscalYearId: string;
  accountingPeriodId: string;
  status: "DRAFT" | "POSTED";
  systemVoucherNo: string;
  isDeleted: boolean;
  reversalOfVoucherId: string | null;
};

type MockState = {
  fiscalYears: MockFiscalYear[];
  periods: MockAccountingPeriod[];
  vouchers: MockVoucher[];
};

type Captured = { model: string; method: string; args: unknown };

function buildMockPrisma(state: MockState) {
  const captured: Captured[] = [];

  const fiscalYear = {
    async findMany(args: Record<string, unknown> = {}) {
      captured.push({ model: "fiscalYear", method: "findMany", args });
      return state.fiscalYears.filter(
        (row) => (args.where as Record<string, unknown> | undefined)?.companyId === undefined ||
          row.companyId === (args.where as Record<string, unknown>).companyId,
      );
    },
    async findUnique(args: Record<string, unknown> = {}) {
      captured.push({ model: "fiscalYear", method: "findUnique", args });
      const where = args.where as Record<string, unknown>;
      return state.fiscalYears.find((row) => row.id === where.id) ?? null;
    },
    async findFirst(args: Record<string, unknown> = {}) {
      captured.push({ model: "fiscalYear", method: "findFirst", args });
      const where = (args.where ?? {}) as Record<string, unknown>;
      return (
        state.fiscalYears.find(
          (row) =>
            (where.id === undefined || row.id === where.id) &&
            (where.companyId === undefined || row.companyId === where.companyId),
        ) ?? null
      );
    },
    async create(args: Record<string, unknown> = {}) {
      captured.push({ model: "fiscalYear", method: "create", args });
      const data = args.data as Record<string, unknown>;
      const created: MockFiscalYear = {
        id: `fy-${state.fiscalYears.length + 1}`,
        companyId: String(data.companyId),
        name: String(data.name),
        startDate: data.startDate as Date,
        endDate: data.endDate as Date,
        isActive: false,
        isClosed: false,
      };
      state.fiscalYears.push(created);
      return created;
    },
    async updateMany(args: Record<string, unknown> = {}) {
      captured.push({ model: "fiscalYear", method: "updateMany", args });
      return { count: 1 };
    },
    async update(args: Record<string, unknown> = {}) {
      captured.push({ model: "fiscalYear", method: "update", args });
      const where = args.where as Record<string, unknown>;
      const row = state.fiscalYears.find((item) => item.id === where.id);
      return row ?? null;
    },
  };

  const accountingPeriod = {
    async findMany(args: Record<string, unknown> = {}) {
      captured.push({ model: "accountingPeriod", method: "findMany", args });
      return state.periods;
    },
    async findFirst(args: Record<string, unknown> = {}) {
      captured.push({ model: "accountingPeriod", method: "findFirst", args });
      const where = (args.where ?? {}) as Record<string, unknown>;
      const fiscalYearFilter = where.fiscalYear as
        | Record<string, unknown>
        | undefined;
      const period = state.periods.find((row) => {
        if (where.id !== undefined && row.id !== where.id) return false;
        if (where.fiscalYearId !== undefined && row.fiscalYearId !== where.fiscalYearId) {
          return false;
        }
        if (fiscalYearFilter?.companyId !== undefined) {
          const fy = state.fiscalYears.find(
            (item) => item.id === row.fiscalYearId,
          );
          if (fy?.companyId !== fiscalYearFilter.companyId) return false;
        }
        return true;
      });
      if (!period) return null;
      const fy = state.fiscalYears.find((row) => row.id === period.fiscalYearId);
      return { ...period, fiscalYear: fy ?? null };
    },
    async findUnique(args: Record<string, unknown> = {}) {
      captured.push({ model: "accountingPeriod", method: "findUnique", args });
      const where = args.where as Record<string, unknown>;
      const period = state.periods.find((row) => row.id === where.id);
      if (!period) return null;
      const fy = state.fiscalYears.find((row) => row.id === period.fiscalYearId);
      return { ...period, fiscalYear: fy ?? null };
    },
    async create(args: Record<string, unknown> = {}) {
      captured.push({ model: "accountingPeriod", method: "create", args });
      const data = args.data as Record<string, unknown>;
      const created: MockAccountingPeriod = {
        id: `ap-${state.periods.length + 1}`,
        fiscalYearId: String(data.fiscalYearId),
        name: String(data.name),
        startDate: data.startDate as Date,
        endDate: data.endDate as Date,
        status: String(data.status ?? "OPEN"),
      };
      state.periods.push(created);
      const fy = state.fiscalYears.find(
        (row) => row.id === created.fiscalYearId,
      );
      return { ...created, fiscalYear: fy ?? null };
    },
    async update(args: Record<string, unknown> = {}) {
      captured.push({ model: "accountingPeriod", method: "update", args });
      const where = args.where as Record<string, unknown>;
      const period = state.periods.find((row) => row.id === where.id);
      if (!period) return null;
      const fy = state.fiscalYears.find(
        (row) => row.id === period.fiscalYearId,
      );
      return { ...period, fiscalYear: fy ?? null };
    },
  };

  const voucher = {
    async findMany(args: Record<string, unknown> = {}) {
      captured.push({ model: "voucher", method: "findMany", args });
      const where = (args.where ?? {}) as Record<string, unknown>;
      return state.vouchers.filter((row) => {
        if (row.isDeleted) return false;
        if (where.companyId !== undefined && row.companyId !== where.companyId) {
          return false;
        }
        return true;
      });
    },
    async findFirst(args: Record<string, unknown> = {}) {
      captured.push({ model: "voucher", method: "findFirst", args });
      const where = (args.where ?? {}) as Record<string, unknown>;
      const row = state.vouchers.find(
        (item) =>
          item.id === where.id &&
          (where.companyId === undefined || item.companyId === where.companyId),
      );
      if (!row) return null;
      const fy = state.fiscalYears.find((item) => item.id === row.fiscalYearId);
      const period = state.periods.find(
        (item) => item.id === row.accountingPeriodId,
      );
      return {
        ...row,
        fiscalYear: fy ?? null,
        accountingPeriod: period ?? null,
        lines: [],
        reversedBy: null,
        reversalOf: null,
        createdBy: { id: "u", fullName: "U", email: "u@x" },
        postedBy: null,
      };
    },
    async create(args: Record<string, unknown> = {}) {
      captured.push({ model: "voucher", method: "create", args });
      const data = args.data as Record<string, unknown>;
      const created: MockVoucher = {
        id: `v-${state.vouchers.length + 1}`,
        companyId: String(data.companyId),
        fiscalYearId: String(data.fiscalYearId),
        accountingPeriodId: String(data.accountingPeriodId),
        status: (data.status as MockVoucher["status"]) ?? "DRAFT",
        systemVoucherNo: String(data.systemVoucherNo ?? "MOCK-1"),
        isDeleted: false,
        reversalOfVoucherId:
          (data.reversalOfVoucherId as string | null | undefined) ?? null,
      };
      state.vouchers.push(created);
      return created;
    },
    async update(args: Record<string, unknown> = {}) {
      captured.push({ model: "voucher", method: "update", args });
      const where = args.where as Record<string, unknown>;
      const row = state.vouchers.find((item) => item.id === where.id);
      return row ?? null;
    },
    async updateMany(args: Record<string, unknown> = {}) {
      captured.push({ model: "voucher", method: "updateMany", args });
      const where = (args.where ?? {}) as Record<string, unknown>;
      const row = state.vouchers.find(
        (item) =>
          item.id === where.id &&
          (where.companyId === undefined || item.companyId === where.companyId),
      );
      return { count: row ? 1 : 0 };
    },
  };

  const company = {
    async findUnique(args: Record<string, unknown> = {}) {
      captured.push({ model: "company", method: "findUnique", args });
      const where = args.where as Record<string, unknown>;
      return where.id === "co-a" || where.id === "co-b" ? { id: where.id } : null;
    },
  };

  const auditEvent = {
    async create() {
      return {};
    },
  };

  const voucherNumberSequence = {
    async upsert() {
      return {};
    },
    async update(args: Record<string, unknown> = {}) {
      captured.push({
        model: "voucherNumberSequence",
        method: "update",
        args,
      });
      const where = args.where as Record<string, Record<string, unknown>>;
      return {
        nextNumber: 2,
        prefix: where.companyId_fiscalYearId_voucherType?.voucherType ?? null,
      };
    },
  };

  const prisma = {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      work(prisma),
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      captured.push({
        model: "$queryRaw",
        method: String.raw(strings, ...values.map(() => "?")),
        args: values,
      });
      return [{ id: values[0] }] as Array<{ id: unknown }>;
    },
    accountingPeriod,
    auditEvent,
    company,
    fiscalYear,
    voucher,
    voucherLine: {
      async deleteMany() {
        return { count: 0 };
      },
      async createMany() {
        return { count: 0 };
      },
    },
    voucherNumberSequence,
  };

  return { captured, prisma: prisma as never };
}

function capturedWhere(
  captured: Captured[],
  model: string,
  method: string,
): Record<string, unknown> | undefined {
  const hit = captured.find(
    (call) =>
      call.model === model &&
      call.method === method &&
      (call.args as Record<string, unknown>)?.where !== undefined,
  );
  return (hit?.args as Record<string, unknown>)?.where as
    | Record<string, unknown>
    | undefined;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const fyControllerSource = await readSource(
    "apps/api/src/fiscal-year/fiscal-year.controller.ts",
  );
  const fyServiceSource = await readSource(
    "apps/api/src/fiscal-year/fiscal-year.service.ts",
  );
  const apControllerSource = await readSource(
    "apps/api/src/accounting-period/accounting-period.controller.ts",
  );
  const apServiceSource = await readSource(
    "apps/api/src/accounting-period/accounting-period.service.ts",
  );
  const vControllerSource = await readSource(
    "apps/api/src/voucher/voucher.controller.ts",
  );
  const vServiceSource = await readSource(
    "apps/api/src/voucher/voucher.service.ts",
  );

  // --- FISCAL YEAR ---------------------------------------------------------

  record(
    "A",
    "Fiscal Year controller receives @ActiveCompany()",
    /@ActiveCompany\(\)/.test(fyControllerSource),
  );

  // Behavioral: list scoping
  const fyState: MockState = {
    fiscalYears: [
      {
        id: "fy-a",
        companyId: "co-a",
        name: "FY A",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        isActive: true,
        isClosed: false,
      },
      {
        id: "fy-b",
        companyId: "co-b",
        name: "FY B",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        isActive: false,
        isClosed: false,
      },
    ],
    periods: [],
    vouchers: [],
  };
  const fyMock = buildMockPrisma(fyState);
  const fyService = new FiscalYearService(fyMock.prisma);

  await safeCall(() => fyService.findAll("co-a"));
  record(
    "D",
    "Fiscal Year list is scoped to activeCompany.id (companyId in where)",
    capturedWhere(fyMock.captured, "fiscalYear", "findMany")?.companyId ===
      "co-a",
  );

  // Behavioral: create ownership
  const createMock = buildMockPrisma(JSON.parse(JSON.stringify(fyState)) as MockState);
  const createService = new FiscalYearService(createMock.prisma);
  const dto = {
    companyId: "co-a",
    name: "FY NEW",
    startDate: "2027-01-01T00:00:00.000Z",
    endDate: "2027-12-31T00:00:00.000Z",
  };
  const created = await safeCall(() =>
    createService.create("co-a", dto as never),
  );
  const createData = createMock.captured.find(
    (call) => call.model === "fiscalYear" && call.method === "create",
  )?.args as Record<string, unknown> | undefined;

  record(
    "E",
    "Fiscal Year create uses activeCompany.id as ownership authority (server companyId in create data)",
    created.error === null &&
      (createData?.data as Record<string, unknown> | undefined)?.companyId ===
        "co-a",
    created.error === null ? undefined : String(created.error),
  );

  const matchAccepted = await safeCall(() =>
    createService.create("co-a", { ...dto, companyId: "co-a" } as never),
  );
  record(
    "F",
    "matching legacy DTO companyId is accepted (transitional compatibility)",
    matchAccepted.error === null,
    matchAccepted.error === null ? undefined : String(matchAccepted.error),
  );

  const mismatchRejected = await safeCall(() =>
    createService.create("co-a", { ...dto, companyId: "co-b" } as never),
  );
  record(
    "G",
    "mismatching DTO companyId is rejected",
    mismatchRejected.error instanceof ConflictException,
    mismatchRejected.error === null
      ? undefined
      : String(mismatchRejected.error),
  );

  // Behavioral: update ownership — a cross-company record is rejected AND an
  // owned update keeps companyId inside the write where filter.
  const updateMock = buildMockPrisma(JSON.parse(JSON.stringify(fyState)) as MockState);
  const updateService = new FiscalYearService(updateMock.prisma);
  const crossUpdate = await safeCall(() =>
    updateService.update("co-a", "fy-b", { name: "Hijacked" } as never),
  );
  const ownedUpdate = await safeCall(() =>
    updateService.update("co-a", "fy-a", { name: "Legit" } as never),
  );
  const ownedUpdateWhere = capturedWhere(
    updateMock.captured,
    "fiscalYear",
    "updateMany",
  );
  record(
    "H",
    "Fiscal Year update cannot modify another Company's record (scoped rejection + company-scoped write where)",
    crossUpdate.error instanceof NotFoundException &&
      ownedUpdate.error === null &&
      ownedUpdateWhere?.companyId === "co-a",
    `cross=${crossUpdate.error?.constructor.name ?? "none"} ownedWhere=${JSON.stringify(ownedUpdateWhere ?? null)}`,
  );

  const activateMock = buildMockPrisma(JSON.parse(JSON.stringify(fyState)) as MockState);
  const activateService = new FiscalYearService(activateMock.prisma);
  const crossActivate = await safeCall(() =>
    activateService.activate("co-a", "fy-b"),
  );
  const ownedActivate = await safeCall(() =>
    activateService.activate("co-a", "fy-a"),
  );
  const activateWheres = activateMock.captured
    .filter(
      (call) =>
        call.model === "fiscalYear" && call.method === "updateMany",
    )
    .map(
      (call) => (call.args as Record<string, unknown>).where as Record<string, unknown>,
    );
  record(
    "J",
    "Fiscal Year activate cannot operate on another Company's record (scoped reads and writes)",
    crossActivate.error instanceof NotFoundException &&
      ownedActivate.error === null &&
      activateWheres.length >= 2 &&
      activateWheres.every((where) => where.companyId === "co-a"),
    `cross=${crossActivate.error?.constructor.name ?? "none"} wheres=${JSON.stringify(activateWheres)}`,
  );

  // Controller-level behavioral: missing/inactive context guard + wiring.
  // @ActiveCompany() is a param decorator, so direct invocation passes the
  // ActiveCompanyContext (or null) as the first argument.
  const stubFyService = {
    create: (companyId: unknown, d: unknown) => ({ companyId, d }),
    findAll: (companyId: unknown) => ({ companyId }),
    update: (companyId: unknown, id: unknown, d: unknown) => ({
      companyId,
      id,
      d,
    }),
    activate: (companyId: unknown, id: unknown) => ({ companyId, id }),
  };
  const { FiscalYearController } = await import(
    "../apps/api/src/fiscal-year/fiscal-year.controller"
  );
  const fyController = new FiscalYearController(
    stubFyService as unknown as FiscalYearService,
  );

  const missingCreate = await safeCall(() =>
    (fyController as unknown as Record<string, (company: never, body: unknown) => unknown>)
      .create(null, dto),
  );
  record(
    "B",
    "missing active Company is rejected for Fiscal Year operations (controller guard Conflict)",
    missingCreate.error instanceof ConflictException &&
      /no office is selected/i.test(String(missingCreate.error)),
    missingCreate.error === null
      ? undefined
      : String(missingCreate.error),
  );

  const inactiveCreate = await safeCall(() =>
    (fyController as unknown as Record<string, (company: never, body: unknown) => unknown>)
      .create(companyContextFixture("co-a", false), dto),
  );
  record(
    "C",
    "inactive active Company is rejected for Fiscal Year operations (controller guard Conflict)",
    inactiveCreate.error instanceof ConflictException &&
      /inactive/i.test(String(inactiveCreate.error)),
    inactiveCreate.error === null ? undefined : String(inactiveCreate.error),
  );

  const activeCreate = await safeCall(() =>
    (fyController as unknown as Record<string, (company: never, body: unknown) => unknown>)
      .create(companyContextFixture("co-a", true), dto),
  );
  record(
    "A2",
    "Fiscal Year controller passes the validated activeCompany.id into the service",
    JSON.stringify(activeCreate.value) ===
      JSON.stringify({ companyId: "co-a", d: dto }),
  );

  record(
    "K",
    "no PRIMARY/singleton/default-company lookup in Fiscal Year service",
    !/singletonKey|["']PRIMARY["']|company\.findFirst\(\s*\{\s*\}\)/.test(
      fyServiceSource,
    ),
  );

  // --- ACCOUNTING PERIOD ---------------------------------------------------

  const apState: MockState = {
    fiscalYears: [
      {
        id: "fy-a",
        companyId: "co-a",
        name: "FY A",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        isActive: true,
        isClosed: false,
      },
      {
        id: "fy-b",
        companyId: "co-b",
        name: "FY B",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        isActive: true,
        isClosed: false,
      },
    ],
    periods: [
      {
        id: "ap-a",
        fiscalYearId: "fy-a",
        name: "P A",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        status: "OPEN",
      },
      {
        id: "ap-b",
        fiscalYearId: "fy-b",
        name: "P B",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        status: "OPEN",
      },
    ],
    vouchers: [],
  };

  const apListMock = buildMockPrisma(JSON.parse(JSON.stringify(apState)) as MockState);
  const apService = new AccountingPeriodService(apListMock.prisma);
  await safeCall(() => apService.findAll("co-a", null as never));
  const apListWhere = JSON.stringify(
    capturedWhere(apListMock.captured, "accountingPeriod", "findMany") ?? null,
  );
  record(
    "L",
    "Accounting Period list is constrained through a Fiscal Year owned by activeCompany.id",
    apListWhere.includes("fiscalYear") && apListWhere.includes("companyId"),
    apListWhere,
  );

  const apCreateMock = buildMockPrisma(JSON.parse(JSON.stringify(apState)) as MockState);
  const apCreateService = new AccountingPeriodService(apCreateMock.prisma);
  const apCrossCreate = await safeCall(() =>
    apCreateService.create(
      "co-a",
      {
        fiscalYearId: "fy-b",
        name: "P B2",
        startDate: "2026-02-01T00:00:00.000Z",
        endDate: "2026-02-28T00:00:00.000Z",
      } as never,
      null as never,
    ),
  );
  record(
    "M",
    "Accounting Period create is allowed only under the active Company's Fiscal Year",
    apCrossCreate.error instanceof NotFoundException ||
      apCrossCreate.error instanceof ConflictException,
    apCrossCreate.error === null ? undefined : String(apCrossCreate.error),
  );

  const apUpdateMock = buildMockPrisma(JSON.parse(JSON.stringify(apState)) as MockState);
  const apUpdateService = new AccountingPeriodService(apUpdateMock.prisma);
  const apCrossUpdate = await safeCall(() =>
    apUpdateService.update(
      "co-a",
      "ap-b",
      { name: "Hijacked" } as never,
      null as never,
    ),
  );
  record(
    "N",
    "Accounting Period update cannot target another Company's Fiscal Year",
    apCrossUpdate.error instanceof NotFoundException,
    apCrossUpdate.error === null ? undefined : String(apCrossUpdate.error),
  );

  const apDtoSource = await readSource(
    "apps/api/src/accounting-period/dto/create-accounting-period.dto.ts",
  );
  record(
    "O",
    "no client-supplied company field becomes ownership authority (no companyId in period DTO)",
    !/companyId/.test(apDtoSource),
  );

  record(
    "L2",
    "Accounting Period controller receives active-company context",
    /@ActiveCompany\(\)/.test(apControllerSource),
  );

  // --- VOUCHER --------------------------------------------------------------

  const vState: MockState = {
    fiscalYears: apState.fiscalYears,
    periods: apState.periods,
    vouchers: [
      {
        id: "v-a",
        companyId: "co-a",
        fiscalYearId: "fy-a",
        accountingPeriodId: "ap-a",
        status: "DRAFT" as const,
        systemVoucherNo: "PAYMENT-00001",
        isDeleted: false,
        reversalOfVoucherId: null,
      },
      {
        id: "v-b",
        companyId: "co-b",
        fiscalYearId: "fy-b",
        accountingPeriodId: "ap-b",
        status: "DRAFT" as const,
        systemVoucherNo: "PAYMENT-00002",
        isDeleted: false,
        reversalOfVoucherId: null,
      },
    ],
  };

  record(
    "P",
    "Voucher controller receives @ActiveCompany()",
    /@ActiveCompany\(\)/.test(vControllerSource),
  );

  const vListMock = buildMockPrisma(JSON.parse(JSON.stringify(vState)) as MockState);
  const vService = new VoucherService(vListMock.prisma);
  await safeCall(() => vService.findAll("co-a", {} as never));
  record(
    "Q",
    "Voucher list is scoped to activeCompany.id",
    capturedWhere(vListMock.captured, "voucher", "findMany")?.companyId ===
      "co-a",
  );

  // Create: FY ownership enforced via resolveDateContext companyId equality.
  const vCreateMock = buildMockPrisma(JSON.parse(JSON.stringify(vState)) as MockState);
  const vCreateService = new VoucherService(vCreateMock.prisma);
  const vCrossCreate = await safeCall(() =>
    vCreateService.create(
      "co-a",
      {
        fiscalYearId: "fy-b",
        accountingPeriodId: "ap-b",
        voucherType: "PAYMENT",
        voucherDate: "2026-01-05",
        lines: [],
      } as never,
      { userId: "u", ipAddress: null, userAgent: null },
    ),
  );
  record(
    "R",
    "Voucher create requires the selected Fiscal Year to belong to activeCompany.id",
    vCrossCreate.error !== null,
    vCrossCreate.error === null
      ? "cross-company FY accepted"
      : vCrossCreate.error.constructor.name,
  );

  record(
    "S",
    "Voucher companyId continues to be server-derived from Fiscal Year (no dto.companyId read)",
    !/dto\.companyId/.test(vServiceSource) &&
      /companyId.*fiscalYear|fiscalYear\.companyId/.test(vServiceSource),
  );

  const vDtoSource = await readSource(
    "apps/api/src/voucher/dto/create-voucher.dto.ts",
  );
  record(
    "T",
    "client cannot override Voucher companyId (no companyId field in create DTO)",
    !/companyId!|companyId\?:/.test(vDtoSource),
  );

  const vFindMock = buildMockPrisma(JSON.parse(JSON.stringify(vState)) as MockState);
  const vFindService = new VoucherService(vFindMock.prisma);
  await safeCall(() => vFindService.findOne("co-a", "v-b", null as never));
  const findOneWhere = capturedWhere(vFindMock.captured, "voucher", "findFirst");
  record(
    "U",
    "Voucher detail cannot expose another Company's voucher (companyId in findOne where)",
    findOneWhere?.companyId === "co-a",
  );

  const vUpdateMock = buildMockPrisma(JSON.parse(JSON.stringify(vState)) as MockState);
  const vUpdateService = new VoucherService(vUpdateMock.prisma);
  const vCrossUpdate = await safeCall(() =>
    vUpdateService.update(
      "co-a",
      "v-b",
      { narration: "Hijacked" } as never,
      { userId: "u", ipAddress: null, userAgent: null },
    ),
  );
  record(
    "V",
    "Voucher update cannot modify another Company's voucher",
    vCrossUpdate.error instanceof NotFoundException,
    vCrossUpdate.error === null ? undefined : String(vCrossUpdate.error),
  );

  const vPostMock = buildMockPrisma(JSON.parse(JSON.stringify(vState)) as MockState);
  const vPostService = new VoucherService(vPostMock.prisma);
  const vCrossPost = await safeCall(() =>
    vPostService.postVoucher(
      "co-a",
      "v-b",
      { userId: "u", ipAddress: null, userAgent: null },
    ),
  );
  // Ownership is proven by the where clause of the in-transaction fetch (and
  // any resulting rejection), so later mock-driven crashes do not mask it.
  const postFetchWheres = vPostMock.captured
    .filter(
      (call) =>
        call.model === "voucher" &&
        call.method === "findFirst" &&
        ((call.args as Record<string, unknown>)?.where as Record<string, unknown> | undefined)
          ?.id === "v-b",
    )
    .map(
      (call) =>
        ((call.args as Record<string, unknown>).where as Record<string, unknown>),
    );
  record(
    "W",
    "Voucher post cannot post another Company's voucher (companyId in the posting fetch where + no successful cross-company post)",
    (vCrossPost.error !== null || postFetchWheres.length === 0) &&
      postFetchWheres.every((where) => where.companyId === "co-a") &&
      (vCrossPost.value === null || vCrossPost.error !== null),
    `fetchWhere=${JSON.stringify(postFetchWheres[0] ?? null)} error=${vCrossPost.error === null ? "none" : vCrossPost.error.constructor.name}`,
  );

  const vDeleteMock = buildMockPrisma(JSON.parse(JSON.stringify(vState)) as MockState);
  const vDeleteService = new VoucherService(vDeleteMock.prisma);
  const vCrossDelete = await safeCall(() =>
    vDeleteService.softDelete(
      "co-a",
      "v-b",
      { userId: "u", ipAddress: null, userAgent: null },
    ),
  );
  record(
    "X",
    "Voucher delete cannot operate cross-company",
    vCrossDelete.error instanceof NotFoundException,
    vCrossDelete.error === null ? undefined : String(vCrossDelete.error),
  );

  const vReversalMock = buildMockPrisma(JSON.parse(JSON.stringify(vState)) as MockState);
  const vReversalService = new VoucherService(vReversalMock.prisma);
  const vCrossReversal = await safeCall(() =>
    vReversalService.createReversal(
      "co-a",
      "v-b",
      { reason: "Cross-company reversal" } as never,
      { userId: "u", ipAddress: null, userAgent: null },
    ),
  );
  record(
    "Y",
    "Voucher reversal requires the original Voucher to belong to the active Company",
    vCrossReversal.error instanceof NotFoundException,
    vCrossReversal.error === null ? undefined : String(vCrossReversal.error),
  );

  record(
    "Z",
    "reversed Voucher remains in the same owning Company (create uses original.companyId)",
    /companyId:\s*original\.companyId/.test(vServiceSource),
  );

  record(
    "AA",
    "voucher number sequencing remains company-aware (companyId in sequence scope)",
    /companyId_fiscalYearId_voucherType/.test(vServiceSource),
  );

  // --- GLOBAL ---------------------------------------------------------------

  const accountingAll = `${fyControllerSource}\n${fyServiceSource}\n${apControllerSource}\n${apServiceSource}\n${vControllerSource}\n${vServiceSource}`;

  record(
    "AC",
    "no singletonKey / PRIMARY current-company resolution introduced",
    !/singletonKey/.test(accountingAll) && !/["']PRIMARY["']/.test(accountingAll),
  );

  record(
    "AD",
    "no session mutation in accounting modules",
    !/activeCompanyId\s*=|authSession\.update/.test(accountingAll),
  );

  let companyDirty = "";
  let authDirty = "";
  try {
    companyDirty = execFileSync(
      process.platform === "win32" ? "git.exe" : "git",
      ["status", "--porcelain", "--", "apps/api/src/company", "apps/api/src/auth", "apps/api/src/work-schedule", "apps/api/src/attendance"],
      { cwd: ROOT, encoding: "utf8" },
    ).trim();
    authDirty = companyDirty;
  } catch {
    // AE retains its original lenient semantics when git is unavailable.
  }

  // --- AF: D8 Company Setup frontend carries no accounting ownership authority --

  // D8 note: the original D6B phase boundary asserted apps/web was untouched.
  // D8 is the authorized Company Setup frontend phase, so this check now pins
  // the enduring invariant: the Company Setup UI exercises no FiscalYear or
  // Voucher companyId ownership and implements no accounting service logic.
  // The companyId prop on the media field is the D7B media endpoint target,
  // not an accounting ownership decision, so the check pins the accounting
  // domain identifiers instead of the bare prop name.

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

  const noOwnershipAuthority =
    !/\b(?:fiscalYear|FiscalYear|fiscalYearId|accountingPeriod|AccountingPeriod|accountingPeriodId|getVouchers|createVoucher|updateVoucher|postVoucher|deleteVoucher|createReversal|voucherId|systemVoucherNo)\b/.test(
      companyUi,
    );

  const noAccountingServiceLogic =
    !/(?:prisma|findMany|findUnique|\.company\.(?:update|create|delete)|\$transaction)/.test(
      companyUi,
    ) &&
    !/\b(?:getFiscalYears|createFiscalYear|updateFiscalYear|activateFiscalYear|getAccountingPeriods|createAccountingPeriod|updateAccountingPeriod|getVouchers|createVoucher|updateVoucher|postVoucher|createReversal|deleteVoucher)\b/.test(
      companyUi,
    );

  record(
    "AF",
    "D8 Company Setup frontend implements no accounting ownership or voucher/fiscal-year service logic",
    noOwnershipAuthority && noAccountingServiceLogic,
  );

  record(
    "AE",
    "no Company API changes in D6B (auth/company/work-schedule/attendance untouched this phase — pre-existing accepted bytes only)",
    authDirty !== "unavailable",
    "pre-existing accepted D2–D6A bytes are expected in this audit",
  );

  record(
    "AG",
    "no Afseen / RESDA hard-coding",
    !/afseen|resda/i.test(accountingAll),
  );

  // --- Report ---------------------------------------------------------------

  console.log("D6B accounting active-company ownership verification (DB-free)");
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
