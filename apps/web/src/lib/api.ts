export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type AuthRole = {
  code: "ACCOUNTANT";
  name: "Accountant";
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  roles: AuthRole[];
};

export type AuthResponse = {
  status: "ok";
  message?: string;
  user: AuthUser;
};

// ---------------------------------------------------------------------------
// Accounting foundation resource types (Phase 2A)
// ---------------------------------------------------------------------------

export type NormalBalanceSide = "DEBIT" | "CREDIT";

export type AccountClassCode =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE";

export type Company = {
  id: string;
  singletonKey: string;
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export type FiscalYear = {
  id: string;
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
  company?: Company;
};

export type Project = {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountClass = {
  id: string;
  code: AccountClassCode;
  name: string;
  normalBalance: NormalBalanceSide;
  createdAt: string;
  updatedAt: string;
};

export type AccountingPeriodStatus = "OPEN" | "LOCKED" | "CLOSED";

export type CashBankAccountType = "CASH" | "BANK";

export type AccountingPeriod = {
  id: string;
  fiscalYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
  createdAt: string;
  updatedAt: string;
  fiscalYear?: FiscalYear;
};

export type CostCenter = {
  id: string;
  projectId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  project?: Project;
};

export type AccountGroup = {
  id: string;
  accountClassId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  accountClass?: AccountClass;
};

export type LedgerAccount = {
  id: string;
  accountGroupId: string;
  code: string;
  name: string;
  normalBalance: NormalBalanceSide;
  requiresProject: boolean;
  requiresCostCenter: boolean;
  isCashBank: boolean;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  accountGroup?: AccountGroup;
  cashBankAccounts?: CashBankAccount[];
};

export type CashBankAccount = {
  id: string;
  ledgerAccountId: string;
  displayName: string;
  accountType: CashBankAccountType;
  bankName: string | null;
  branch: string | null;
  accountNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ledgerAccount?: LedgerAccount;
};

// ---------------------------------------------------------------------------
// Voucher resource types (Phase 2C)
// ---------------------------------------------------------------------------

export type VoucherType =
  | "DEBIT"
  | "CREDIT"
  | "JOURNAL"
  | "CONTRA"
  | "PAYMENT"
  | "RECEIPT";

export type VoucherStatus = "DRAFT" | "POSTED";

export type VoucherLineSide = "DEBIT" | "CREDIT";

/** Basic user info embedded on voucher records (createdBy / postedBy). */
export type VoucherUserRef = {
  id: string;
  fullName: string;
  email: string;
};

export type VoucherLine = {
  id: string;
  voucherId: string;
  lineNo: number;
  side: VoucherLineSide;
  ledgerAccountId: string;
  projectId: string | null;
  costCenterId: string | null;
  cashBankAccountId: string | null;
  description: string | null;
  // Decimal values are serialised as strings by the API.
  amount: string;
  createdAt: string;
  updatedAt: string;
  ledgerAccount?: LedgerAccount;
  project?: Project | null;
  costCenter?: CostCenter | null;
  cashBankAccount?: CashBankAccount | null;
};

export type Voucher = {
  id: string;
  companyId: string;
  fiscalYearId: string;
  accountingPeriodId: string;
  voucherType: VoucherType;
  status: VoucherStatus;
  systemVoucherNo: string;
  physicalSiNo: string | null;
  voucherDate: string;
  postingDate: string | null;
  narration: string | null;
  // Decimal values are serialised as strings by the API.
  totalDebit: string;
  totalCredit: string;
  createdById: string;
  postedById: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fiscalYear?: FiscalYear;
  accountingPeriod?: AccountingPeriod;
  createdBy?: VoucherUserRef;
  postedBy?: VoucherUserRef | null;
  lines?: VoucherLine[];
  _count?: { lines: number };
};

export type VoucherListFilters = {
  voucherType?: VoucherType;
  status?: VoucherStatus;
  fiscalYearId?: string;
  accountingPeriodId?: string;
};

// ---------------------------------------------------------------------------
// Typed request payloads (must match backend DTO whitelists exactly)
// ---------------------------------------------------------------------------

export type CompanyInput = {
  name: string;
  legalName?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
};

export type CreateFiscalYearInput = {
  companyId: string;
  name: string;
  startDate: string;
  endDate: string;
};

export type UpdateFiscalYearInput = {
  name?: string;
  startDate?: string;
  endDate?: string;
  isClosed?: boolean;
};

export type ProjectInput = {
  code: string;
  name: string;
  location?: string;
  notes?: string;
  isActive?: boolean;
};

export type CreateAccountingPeriodInput = {
  fiscalYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  status?: AccountingPeriodStatus;
};

export type UpdateAccountingPeriodInput = {
  fiscalYearId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: AccountingPeriodStatus;
};

export type CostCenterInput = {
  projectId: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
};

export type AccountGroupInput = {
  accountClassId: string;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
};

export type LedgerAccountInput = {
  accountGroupId: string;
  code: string;
  name: string;
  normalBalance: NormalBalanceSide;
  requiresProject?: boolean;
  requiresCostCenter?: boolean;
  isCashBank?: boolean;
  isActive?: boolean;
  description?: string;
};

export type CashBankAccountInput = {
  ledgerAccountId: string;
  displayName: string;
  accountType: CashBankAccountType;
  bankName?: string;
  branch?: string;
  accountNumber?: string;
  isActive?: boolean;
};

// The client never supplies status, systemVoucherNo, companyId, totals, or
// posting fields; the backend derives them. Totals are recomputed server-side
// from the line amounts.
export type CreateVoucherLineInput = {
  side: VoucherLineSide;
  ledgerAccountId: string;
  amount: number;
  projectId?: string;
  costCenterId?: string;
  cashBankAccountId?: string;
  description?: string;
};

export type CreateVoucherInput = {
  fiscalYearId: string;
  accountingPeriodId: string;
  voucherType: VoucherType;
  voucherDate: string;
  narration: string;
  physicalSiNo?: string;
  lines: CreateVoucherLineInput[];
};

export type UpdateVoucherInput = {
  fiscalYearId?: string;
  accountingPeriodId?: string;
  voucherType?: VoucherType;
  voucherDate?: string;
  narration?: string;
  physicalSiNo?: string;
  lines?: CreateVoucherLineInput[];
};

// ---------------------------------------------------------------------------
// Fetch layer
// ---------------------------------------------------------------------------

/**
 * Error raised for any non-successful API interaction. `status` is `0` when the
 * API could not be reached at all (network/connection failure).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConnectionError() {
    return this.status === 0;
  }
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };

    if (Array.isArray(body.message)) {
      return body.message.join(" ");
    }

    if (body.message) {
      return body.message;
    }
  } catch {
    return "Request failed. Please try again.";
  }

  return "Request failed. Please try again.";
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Shared, cookie-authenticated fetch helper.
 *
 * - Always sends `credentials: "include"` so the HttpOnly session cookie flows.
 * - Never reads or writes auth tokens in localStorage.
 * - Throws a typed {@link ApiError} on connection failure or non-2xx response so
 *   callers can present clear auth/connection messages.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;
  const hasBody = body !== undefined;

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body: hasBody ? JSON.stringify(body) : undefined,
      credentials: "include",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      method,
      signal,
    });
  } catch (error) {
    // Re-throw aborts untouched so callers can ignore unmounted requests.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      `Unable to reach the API at ${API_BASE_URL}. Please confirm the API server is running.`,
      0,
    );
  }

  if (!response.ok) {
    throw new ApiError(await readApiError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Resource helpers
// ---------------------------------------------------------------------------

export async function getCurrentUser(signal?: AbortSignal): Promise<AuthUser> {
  const body = await apiFetch<AuthResponse>("/auth/me", { signal });
  return body.user;
}

export async function logout(): Promise<void> {
  await apiFetch<unknown>("/auth/logout", { method: "POST" });
}

export function getCompany(signal?: AbortSignal): Promise<Company> {
  return apiFetch<Company>("/company", { signal });
}

export function createCompany(input: CompanyInput): Promise<Company> {
  return apiFetch<Company>("/company", { body: input, method: "POST" });
}

export function updateCompany(
  id: string,
  input: Partial<CompanyInput>,
): Promise<Company> {
  return apiFetch<Company>(`/company/${id}`, { body: input, method: "PATCH" });
}

export function getFiscalYears(signal?: AbortSignal): Promise<FiscalYear[]> {
  return apiFetch<FiscalYear[]>("/fiscal-years", { signal });
}

export function createFiscalYear(
  input: CreateFiscalYearInput,
): Promise<FiscalYear> {
  return apiFetch<FiscalYear>("/fiscal-years", { body: input, method: "POST" });
}

export function updateFiscalYear(
  id: string,
  input: UpdateFiscalYearInput,
): Promise<FiscalYear> {
  return apiFetch<FiscalYear>(`/fiscal-years/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function activateFiscalYear(id: string): Promise<FiscalYear> {
  return apiFetch<FiscalYear>(`/fiscal-years/${id}/activate`, {
    method: "POST",
  });
}

export function getProjects(signal?: AbortSignal): Promise<Project[]> {
  return apiFetch<Project[]>("/projects", { signal });
}

export function createProject(input: ProjectInput): Promise<Project> {
  return apiFetch<Project>("/projects", { body: input, method: "POST" });
}

export function updateProject(
  id: string,
  input: Partial<ProjectInput>,
): Promise<Project> {
  return apiFetch<Project>(`/projects/${id}`, { body: input, method: "PATCH" });
}

export function getAccountClasses(signal?: AbortSignal): Promise<AccountClass[]> {
  return apiFetch<AccountClass[]>("/account-classes", { signal });
}

export function getAccountingPeriods(
  signal?: AbortSignal,
): Promise<AccountingPeriod[]> {
  return apiFetch<AccountingPeriod[]>("/accounting-periods", { signal });
}

export function createAccountingPeriod(
  input: CreateAccountingPeriodInput,
): Promise<AccountingPeriod> {
  return apiFetch<AccountingPeriod>("/accounting-periods", {
    body: input,
    method: "POST",
  });
}

export function updateAccountingPeriod(
  id: string,
  input: UpdateAccountingPeriodInput,
): Promise<AccountingPeriod> {
  return apiFetch<AccountingPeriod>(`/accounting-periods/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getCostCenters(signal?: AbortSignal): Promise<CostCenter[]> {
  return apiFetch<CostCenter[]>("/cost-centers", { signal });
}

export function createCostCenter(input: CostCenterInput): Promise<CostCenter> {
  return apiFetch<CostCenter>("/cost-centers", { body: input, method: "POST" });
}

export function updateCostCenter(
  id: string,
  input: Partial<CostCenterInput>,
): Promise<CostCenter> {
  return apiFetch<CostCenter>(`/cost-centers/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getAccountGroups(signal?: AbortSignal): Promise<AccountGroup[]> {
  return apiFetch<AccountGroup[]>("/account-groups", { signal });
}

export function createAccountGroup(
  input: AccountGroupInput,
): Promise<AccountGroup> {
  return apiFetch<AccountGroup>("/account-groups", {
    body: input,
    method: "POST",
  });
}

export function updateAccountGroup(
  id: string,
  input: Partial<AccountGroupInput>,
): Promise<AccountGroup> {
  return apiFetch<AccountGroup>(`/account-groups/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getLedgerAccounts(
  signal?: AbortSignal,
): Promise<LedgerAccount[]> {
  return apiFetch<LedgerAccount[]>("/ledger-accounts", { signal });
}

export function createLedgerAccount(
  input: LedgerAccountInput,
): Promise<LedgerAccount> {
  return apiFetch<LedgerAccount>("/ledger-accounts", {
    body: input,
    method: "POST",
  });
}

export function updateLedgerAccount(
  id: string,
  input: Partial<LedgerAccountInput>,
): Promise<LedgerAccount> {
  return apiFetch<LedgerAccount>(`/ledger-accounts/${id}`, {
    body: input,
    method: "PATCH",
  });
}

export function getCashBankAccounts(
  signal?: AbortSignal,
): Promise<CashBankAccount[]> {
  return apiFetch<CashBankAccount[]>("/cash-bank-accounts", { signal });
}

export function createCashBankAccount(
  input: CashBankAccountInput,
): Promise<CashBankAccount> {
  return apiFetch<CashBankAccount>("/cash-bank-accounts", {
    body: input,
    method: "POST",
  });
}

export function updateCashBankAccount(
  id: string,
  input: Partial<CashBankAccountInput>,
): Promise<CashBankAccount> {
  return apiFetch<CashBankAccount>(`/cash-bank-accounts/${id}`, {
    body: input,
    method: "PATCH",
  });
}

// ---------------------------------------------------------------------------
// Voucher resource helpers (Phase 2C)
// ---------------------------------------------------------------------------

function buildVoucherQuery(filters?: VoucherListFilters): string {
  if (!filters) {
    return "";
  }

  const params = new URLSearchParams();

  if (filters.voucherType) {
    params.set("voucherType", filters.voucherType);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.fiscalYearId) {
    params.set("fiscalYearId", filters.fiscalYearId);
  }
  if (filters.accountingPeriodId) {
    params.set("accountingPeriodId", filters.accountingPeriodId);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getVouchers(
  filters?: VoucherListFilters,
  signal?: AbortSignal,
): Promise<Voucher[]> {
  return apiFetch<Voucher[]>(`/vouchers${buildVoucherQuery(filters)}`, {
    signal,
  });
}

export function getVoucher(
  id: string,
  signal?: AbortSignal,
): Promise<Voucher> {
  return apiFetch<Voucher>(`/vouchers/${id}`, { signal });
}

export function createVoucher(input: CreateVoucherInput): Promise<Voucher> {
  return apiFetch<Voucher>("/vouchers", { body: input, method: "POST" });
}

export function updateVoucher(
  id: string,
  input: UpdateVoucherInput,
): Promise<Voucher> {
  return apiFetch<Voucher>(`/vouchers/${id}`, { body: input, method: "PATCH" });
}

export function deleteVoucher(
  id: string,
): Promise<{ id: string; status: VoucherStatus; isDeleted: boolean }> {
  return apiFetch<{ id: string; status: VoucherStatus; isDeleted: boolean }>(
    `/vouchers/${id}`,
    { method: "DELETE" },
  );
}

/**
 * Narrow an unknown caught value to a user-facing message. Aborts are re-thrown
 * by {@link apiFetch}; everything else lands here.
 */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}
