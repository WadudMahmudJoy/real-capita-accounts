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

export type CashBankAccountType = "CASH" | "BANK" | "MFS";

export type MfsProvider = "BKASH" | "NAGAD" | "ROCKET" | "UPAY" | "OTHER";

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
  provider: MfsProvider | null;
  providerOtherName: string | null;
  walletNumber: string | null;
  accountHolderName: string | null;
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
  provider?: MfsProvider | null;
  providerOtherName?: string | null;
  walletNumber?: string | null;
  accountHolderName?: string | null;
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

export function postVoucher(id: string): Promise<Voucher> {
  return apiFetch<Voucher>(`/vouchers/${id}/post`, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Report resource types (Phase 2D)
//
// These mirror the JSON returned by the guarded `/reports/*` endpoints. All
// money values are serialised by the API as fixed two-decimal strings.
// ---------------------------------------------------------------------------

export type ReportType =
  | "LEDGER"
  | "CASH_BOOK"
  | "BANK_BOOK"
  | "TRIAL_BALANCE"
  | "INCOME_STATEMENT"
  | "BALANCE_SHEET"
  | "PROJECT_LEDGER"
  | "PROJECT_COST";

/** Company summary embedded on the report fiscal year. */
export type ReportCompanySummary = {
  id: string;
  name: string;
  legalName: string | null;
  currency: string;
};

export type ReportFiscalYearSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  company: ReportCompanySummary;
};

export type ReportAccountingPeriodSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type ReportDateRange = {
  startDate: string;
  endDate: string;
};

export type ReportProjectSummary = {
  id: string;
  code: string;
  name: string;
};

export type ReportCostCenterSummary = {
  id: string;
  code: string;
  name: string;
  project: ReportProjectSummary;
};

/** Project / cost-center filters echoed back by every report. */
export type ReportFilterSummary = {
  project: ReportProjectSummary | null;
  costCenter: ReportCostCenterSummary | null;
};

/** Normal-balance-aware balance presentation. Money values are strings. */
export type ReportBalanceSummary = {
  debit: string;
  credit: string;
  signedAmount: string;
  balanceSide: NormalBalanceSide;
};

export type ReportLedgerAccountSummary = {
  id: string;
  code: string;
  name: string;
  normalBalance: NormalBalanceSide;
  isActive: boolean;
};

export type ReportAccountClassSummary = {
  id: string;
  code: AccountClassCode;
  name: string;
  normalBalance: NormalBalanceSide;
};

export type ReportAccountGroupSummary = {
  id: string;
  code: string;
  name: string;
};

export type ReportCashBankAccountSummary = {
  id: string;
  displayName: string;
  accountType: CashBankAccountType;
  ledgerAccountId: string;
  bankName: string | null;
  branch: string | null;
  accountNumber: string | null;
  isActive: boolean;
  provider: MfsProvider | null;
  providerOtherName: string | null;
  walletNumber: string | null;
  accountHolderName: string | null;
};

/** Ledger account with its account group/class, as returned in report rows. */
export type ReportLedgerAccountWithGroup = ReportLedgerAccountSummary & {
  accountGroup: ReportAccountGroupSummary & {
    accountClass: ReportAccountClassSummary;
  };
};

// --- General Ledger / Ledger Statement ---

export type LedgerReportLine = {
  id: string;
  voucherDate: string;
  systemVoucherNo: string;
  voucherType: VoucherType;
  narration: string | null;
  lineNo: number;
  lineDescription: string | null;
  debit: string;
  credit: string;
  runningBalance: ReportBalanceSummary;
  project: ReportProjectSummary | null;
  costCenter: ReportCostCenterSummary | null;
  cashBankAccount: ReportCashBankAccountSummary | null;
};

export type LedgerReport = {
  reportType: "LEDGER";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  ledgerAccount: ReportLedgerAccountWithGroup;
  filters: ReportFilterSummary;
  openingBalance: ReportBalanceSummary;
  periodDebit: string;
  periodCredit: string;
  closingBalance: ReportBalanceSummary;
  lines: LedgerReportLine[];
};

// --- Cash Book / Bank Book ---

export type CashBankReportOppositeAccount = {
  id: string;
  ledgerAccount: ReportLedgerAccountSummary;
  side: VoucherLineSide;
  amount: string;
};

export type CashBankReportLine = {
  id: string;
  voucherDate: string;
  systemVoucherNo: string;
  voucherType: VoucherType;
  narration: string | null;
  cashBankAccount: ReportCashBankAccountSummary | null;
  ledgerAccount: ReportLedgerAccountSummary;
  oppositeAccounts: CashBankReportOppositeAccount[];
  description: string | null;
  debit: string;
  credit: string;
  runningBalance: ReportBalanceSummary;
  project: ReportProjectSummary | null;
  costCenter: ReportCostCenterSummary | null;
};

export type CashBankReport = {
  reportType: "CASH_BOOK" | "BANK_BOOK" | "MFS_BOOK";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  accountType: CashBankAccountType;
  cashBankAccount: ReportCashBankAccountSummary | null;
  filters: ReportFilterSummary & {
    ledgerAccount: ReportLedgerAccountSummary | null;
  };
  openingBalance: ReportBalanceSummary;
  periodDebit: string;
  periodCredit: string;
  closingBalance: ReportBalanceSummary;
  lines: CashBankReportLine[];
};

// --- Trial Balance ---

export type TrialBalanceTotals = {
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
  difference: string;
  isBalanced: boolean;
};

export type TrialBalanceRow = {
  ledgerAccount: ReportLedgerAccountWithGroup;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
};

export type TrialBalanceReport = {
  reportType: "TRIAL_BALANCE";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  filters: ReportFilterSummary;
  totals: TrialBalanceTotals;
  rows: TrialBalanceRow[];
};

// --- Income Statement ---

/** Account-group subtotal within an income statement section. */
export type FinancialStatementGroupSummary = {
  id: string;
  code: string;
  name: string;
  total: string;
};

/** One ledger-account line in an income statement section. */
export type IncomeStatementRow = {
  accountClass: ReportAccountClassSummary;
  accountGroup: ReportAccountGroupSummary;
  amount: string;
  creditMovement: string;
  debitMovement: string;
  ledgerAccount: ReportProjectSummary;
};

/** Income or Expense section of the income statement. */
export type IncomeStatementSection = {
  groups: FinancialStatementGroupSummary[];
  rows: IncomeStatementRow[];
  total: string;
};

export type IncomeStatementReport = {
  reportType: "INCOME_STATEMENT";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  filters: ReportFilterSummary;
  income: IncomeStatementSection;
  expenses: IncomeStatementSection;
  netIncome: string;
  isProfit: boolean;
};

// --- Balance Sheet ---

/** One ledger-account line in a balance sheet section. */
export type BalanceSheetRow = {
  accountClass: ReportAccountClassSummary;
  accountGroup: ReportAccountGroupSummary;
  amount: string;
  balanceCredit: string;
  balanceDebit: string;
  creditMovement: string;
  debitMovement: string;
  ledgerAccount: ReportProjectSummary;
  normalBalance: NormalBalanceSide;
};

/** Assets, Liabilities, or Equity section of the balance sheet. */
export type BalanceSheetSection = {
  groups: FinancialStatementGroupSummary[];
  rows: BalanceSheetRow[];
  total: string;
};

export type BalanceSheetReport = {
  reportType: "BALANCE_SHEET";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  asOfDate: string;
  filters: ReportFilterSummary;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalLiabilitiesAndEquity: string;
  difference: string;
  isBalanced: boolean;
  currentPeriodProfitLoss: string;
  currentPeriodPLLabel: string;
  currentPeriodPLIsProfit: boolean;
  adjustedTotalEquity: string;
  adjustedTotalLiabilitiesAndEquity: string;
  adjustedDifference: string;
  isBalancedAdjusted: boolean;
};

// --- Project Ledger ---

export type ProjectLedgerReportLine = {
  id: string;
  voucherId: string;
  date: string;
  systemVoucherNo: string;
  voucherType: VoucherType;
  ledgerAccountId: string;
  ledgerCode: string;
  ledgerName: string;
  accountClass: {
    code: string;
    name: string;
  };
  accountGroup: {
    code: string;
    name: string;
  };
  costCenterId: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  narration: string | null;
  lineDescription: string | null;
  debit: string;
  credit: string;
  runningBalance: string;
};

export type ProjectLedgerReport = {
  reportType: "PROJECT_LEDGER";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  project: ReportProjectSummary;
  costCenter: {
    id: string;
    code: string;
    name: string;
  } | null;
  filters: {
    costCenter: {
      id: string;
      code: string;
      name: string;
    } | null;
    ledgerAccount: string | null;
    voucherType: string | null;
  };
  totals: {
    debitTotal: string;
    creditTotal: string;
    netMovement: string;
  };
  openingBalance: string;
  lineCount: number;
  lines: ProjectLedgerReportLine[];
};

// --- Project Cost Report ---

export type ProjectCostReportRow = {
  accountClass: {
    code: string;
    name: string;
  };
  accountGroup: {
    code: string;
    name: string;
  };
  costCenterId: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  creditTotal: string;
  debitTotal: string;
  lastTransactionDate: string | null;
  ledgerAccount: {
    id: string;
    code: string;
    name: string;
  };
  netAmount: string;
};

export type ProjectCostReport = {
  reportType: "PROJECT_COST";
  fiscalYear: ReportFiscalYearSummary;
  accountingPeriod: ReportAccountingPeriodSummary | null;
  dateRange: ReportDateRange;
  project: ReportProjectSummary;
  costCenter: {
    id: string;
    code: string;
    name: string;
  } | null;
  filters: {
    costCenter: {
      id: string;
      code: string;
      name: string;
    } | null;
    expenseOnly: boolean;
    ledgerAccount: string | null;
    accountClass: string | null;
    accountGroup: string | null;
  };
  totals: {
    assetProjectCostTotal: string;
    creditTotal: string;
    debitTotal: string;
    equityTotal: string;
    expenseTotal: string;
    incomeTotal: string;
    liabilityTotal: string;
    netMovement: string;
  };
  lineCount: number;
  groupedRowCount: number;
  rows: ProjectCostReportRow[];
};

/**
 * Shared report query parameters. `fiscalYearId` is always required; the rest
 * are optional and report-specific. Empty values are omitted from the request.
 */
export type ReportQueryParams = {
  fiscalYearId: string;
  accountingPeriodId?: string;
  startDate?: string;
  endDate?: string;
  asOfDate?: string;
  ledgerAccountId?: string;
  projectId?: string;
  costCenterId?: string;
  cashBankAccountId?: string;
  voucherType?: string;
  accountGroupId?: string;
  accountClassCode?: string;
  expenseOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Report resource helpers (Phase 2D)
// ---------------------------------------------------------------------------

function buildReportQuery(params: ReportQueryParams): string {
  const search = new URLSearchParams();

  search.set("fiscalYearId", params.fiscalYearId);

  if (params.accountingPeriodId) {
    search.set("accountingPeriodId", params.accountingPeriodId);
  }
  if (params.startDate) {
    search.set("startDate", params.startDate);
  }
  if (params.endDate) {
    search.set("endDate", params.endDate);
  }
  if (params.asOfDate) {
    search.set("asOfDate", params.asOfDate);
  }
  if (params.ledgerAccountId) {
    search.set("ledgerAccountId", params.ledgerAccountId);
  }
  if (params.projectId) {
    search.set("projectId", params.projectId);
  }
  if (params.costCenterId) {
    search.set("costCenterId", params.costCenterId);
  }
  if (params.cashBankAccountId) {
    search.set("cashBankAccountId", params.cashBankAccountId);
  }
  if (params.voucherType) {
    search.set("voucherType", params.voucherType);
  }
  if (params.accountGroupId) {
    search.set("accountGroupId", params.accountGroupId);
  }
  if (params.accountClassCode) {
    search.set("accountClassCode", params.accountClassCode);
  }
  if (params.expenseOnly) {
    search.set("expenseOnly", "true");
  }

  return `?${search.toString()}`;
}

export function getLedgerReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<LedgerReport> {
  return apiFetch<LedgerReport>(`/reports/ledger${buildReportQuery(params)}`, {
    signal,
  });
}

export function getCashBookReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<CashBankReport> {
  return apiFetch<CashBankReport>(
    `/reports/cash-book${buildReportQuery(params)}`,
    { signal },
  );
}

export function getBankBookReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<CashBankReport> {
  return apiFetch<CashBankReport>(
    `/reports/bank-book${buildReportQuery(params)}`,
    { signal },
  );
}

export function getMfsBookReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<CashBankReport> {
  return apiFetch<CashBankReport>(
    `/reports/mfs-book${buildReportQuery(params)}`,
    { signal },
  );
}

export function getTrialBalanceReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<TrialBalanceReport> {
  return apiFetch<TrialBalanceReport>(
    `/reports/trial-balance${buildReportQuery(params)}`,
    { signal },
  );
}

export function getIncomeStatementReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<IncomeStatementReport> {
  return apiFetch<IncomeStatementReport>(
    `/reports/income-statement${buildReportQuery(params)}`,
    { signal },
  );
}

export function getBalanceSheetReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<BalanceSheetReport> {
  return apiFetch<BalanceSheetReport>(
    `/reports/balance-sheet${buildReportQuery(params)}`,
    { signal },
  );
}

export function getProjectLedgerReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<ProjectLedgerReport> {
  return apiFetch<ProjectLedgerReport>(
    `/reports/project-ledger${buildReportQuery(params)}`,
    { signal },
  );
}

export function getProjectCostReport(
  params: ReportQueryParams,
  signal?: AbortSignal,
): Promise<ProjectCostReport> {
  return apiFetch<ProjectCostReport>(
    `/reports/project-cost${buildReportQuery(params)}`,
    { signal },
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
