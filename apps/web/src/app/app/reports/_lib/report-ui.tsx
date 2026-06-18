"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  AccountingPeriod,
  CashBankAccount,
  CashBankAccountType,
  CostCenter,
  FiscalYear,
  LedgerAccount,
  Project,
  ReportBalanceSummary,
  ReportQueryParams,
  VoucherType,
} from "@/lib/api";
import { Button, Field, Notice, Select, TextInput } from "../../_components/ui";
import type { ReportReferenceData } from "./useReportReferences";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Format an API decimal string for display, always with two decimal places. */
export function formatMoney(value: string | number | null | undefined): string {
  return toAmount(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

/** Trim an ISO date/datetime string down to the calendar date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
}

/**
 * Present a normal-balance-aware balance as a value with a Dr/Cr suffix. Zero
 * balances are shown plainly without a side so calm empty reports stay clean.
 */
export function formatBalance(balance: ReportBalanceSummary): string {
  const amount =
    balance.balanceSide === "DEBIT"
      ? toAmount(balance.debit)
      : toAmount(balance.credit);

  if (amount === 0) {
    return "0.00";
  }

  return `${formatMoney(amount)} ${balance.balanceSide === "DEBIT" ? "Dr" : "Cr"}`;
}

const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  CONTRA: "Contra",
  CREDIT: "Credit",
  DEBIT: "Debit",
  JOURNAL: "Journal",
  PAYMENT: "Payment",
  RECEIPT: "Receipt",
};

export function voucherTypeLabel(type: VoucherType): string {
  return VOUCHER_TYPE_LABELS[type] ?? type;
}

export function fiscalYearLabel(fiscalYear: FiscalYear): string {
  return `${fiscalYear.name} (${formatDate(fiscalYear.startDate)} to ${formatDate(fiscalYear.endDate)})`;
}

/** Compact fiscal-year label for dropdowns to avoid clipping. */
export function fiscalYearLabelCompact(fiscalYear: FiscalYear): string {
  const start = new Date(fiscalYear.startDate);
  const end = new Date(fiscalYear.endDate);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return `${fiscalYear.name} (${months[start.getMonth()]} ${start.getFullYear()} - ${months[end.getMonth()]} ${end.getFullYear()})`;
}

export function accountingPeriodLabel(period: AccountingPeriod): string {
  return `${period.name} (${formatDate(period.startDate)} to ${formatDate(period.endDate)})`;
}

/** Compact accounting-period label for dropdowns to avoid clipping. */
export function accountingPeriodLabelCompact(period: AccountingPeriod): string {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return `${period.name} (${months[start.getMonth()]} ${start.getFullYear()} - ${months[end.getMonth()]} ${end.getFullYear()})`;
}

export function ledgerAccountLabel(account: LedgerAccount): string {
  return `${account.code} - ${account.name}`;
}

export function projectLabel(project: Project): string {
  return `${project.code} - ${project.name}`;
}

export function costCenterLabel(center: CostCenter): string {
  return `${center.code} - ${center.name}`;
}

export function cashBankLabel(account: CashBankAccount): string {
  if (account.accountType === "MFS") {
    const providerLabel =
      account.provider === "OTHER"
        ? account.providerOtherName?.trim() ?? "Other MFS"
        : account.provider
          ? providerDisplayName(account.provider)
          : "MFS";

    return `${account.displayName} (${providerLabel})`;
  }

  return `${account.displayName} (${account.accountType === "CASH" ? "Cash" : "Bank"})`;
}

/** Human-readable MFS provider display name. */
export function providerDisplayName(provider: string): string {
  const labels: Record<string, string> = {
    BKASH: "bKash",
    NAGAD: "Nagad",
    OTHER: "Other",
    ROCKET: "Rocket",
    UPAY: "Upay",
  };

  return labels[provider] ?? provider;
}

// ---------------------------------------------------------------------------
// Presentational primitives shared by the report pages
// ---------------------------------------------------------------------------

export type MetaItem = { label: string; value: ReactNode };

/** A calm definition grid used for the report header context. */
export function ReportMeta({ items }: { items: MetaItem[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div className="flex flex-col gap-1" key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type SummaryStat = {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
};

/** A row of compact totals shown above a report table. */
export function SummaryGrid({ stats }: { stats: SummaryStat[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          className="flex flex-col gap-1 rounded-md border border-border bg-secondary/40 px-4 py-3"
          key={stat.label}
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {stat.label}
          </span>
          <span
            className={
              stat.emphasis
                ? "text-base font-semibold tabular-nums text-foreground"
                : "text-sm tabular-nums text-foreground"
            }
          >
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report filter panel
// ---------------------------------------------------------------------------

type FilterValues = {
  fiscalYearId: string;
  accountingPeriodId: string;
  startDate: string;
  endDate: string;
  asOfDate: string;
  projectId: string;
  costCenterId: string;
  ledgerAccountId: string;
  cashBankAccountId: string;
  voucherType: string;
  accountClassCode: string;
  accountGroupId: string;
  expenseOnly: boolean;
  accountType: string;
};

const emptyFilters: FilterValues = {
  accountingPeriodId: "",
  accountClassCode: "",
  accountGroupId: "",
  asOfDate: "",
  cashBankAccountId: "",
  costCenterId: "",
  endDate: "",
  expenseOnly: false,
  fiscalYearId: "",
  ledgerAccountId: "",
  projectId: "",
  startDate: "",
  voucherType: "",
  accountType: "ALL",
};

export type ReportFiltersConfig = {
  /** Show the ledger account dropdown (required for the ledger report). */
  showLedgerAccount?: boolean;
  /** Require a ledger account selection before the report can run. */
  requireLedgerAccount?: boolean;
  /** Show the cash/bank account dropdown (cash book / bank book). */
  showCashBankAccount?: boolean;
  /** Require a project selection before the report can run. */
  requireProject?: boolean;
  /** Show the voucher type dropdown. */
  showVoucherType?: boolean;
  /** Show the expense-only toggle (checkbox). */
  showExpenseOnly?: boolean;
  /** Show the account class dropdown. */
  showAccountClass?: boolean;
  /** Show the account group dropdown. */
  showAccountGroup?: boolean;
  /**
   * Show the custom start/end date range inputs. Defaults to true. The balance
   * sheet hides this because it is a point-in-time report driven by asOfDate.
   */
  showDateRange?: boolean;
  /**
   * Show the as-of date input (balance sheet point-in-time). Optional: when left
   * empty the backend falls back to the period or fiscal-year end date.
   */
  showAsOfDate?: boolean;
  /**
   * When set, scope the cash/bank dropdown and the ledger dropdown to cash/bank
   * accounts of this type so the user cannot pick an account the backend will
   * reject (e.g. a bank account on the Cash Book).
   */
  cashBankAccountType?: CashBankAccountType;
  /**
   * When true, move Project and Cost Center filters into a collapsible
   * "Advanced filters" section instead of the main filter grid. Use this for
   * Cash Book, Bank Book, and MFS Book where project/cost center filters
   * apply to the line-level metadata on the cash/bank/MFS line itself rather
   * than to the opposite voucher line or the whole voucher.
   */
  advancedProjectCostCenter?: boolean;
  /** Show the account type dropdown (CASH | BANK | MFS | ALL). */
  showAccountType?: boolean;
};

export type ReportFiltersProps = {
  reference: ReportReferenceData;
  config?: ReportFiltersConfig;
  pending: boolean;
  onRun: (params: ReportQueryParams) => void;
};

/**
 * Shared report filter panel. Holds its own form state, validates the
 * fiscal-year requirement, the optional ledger-account requirement, and the
 * custom date-range pairing before emitting a clean {@link ReportQueryParams}.
 * Backend validation errors are still surfaced by the calling page.
 */
export function ReportFilters({
  reference,
  config,
  pending,
  onRun,
}: ReportFiltersProps) {
  const [values, setValues] = useState<FilterValues>(emptyFilters);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const periods = useMemo(() => {
    if (!values.fiscalYearId) {
      return reference.periods;
    }

    return reference.periods.filter(
      (period) => period.fiscalYearId === values.fiscalYearId,
    );
  }, [reference.periods, values.fiscalYearId]);

  const costCenters = useMemo(() => {
    if (!values.projectId) {
      return reference.costCenters;
    }

    return reference.costCenters.filter(
      (center) => center.projectId === values.projectId,
    );
  }, [reference.costCenters, values.projectId]);

  // Ledger accounts available for selection. For cash/bank reports we only
  // offer cash/bank ledgers linked to an account of the requested type.
  const ledgerAccounts = useMemo(() => {
    const active = reference.ledgerAccounts.filter(
      (account) => account.isActive,
    );

    if (!config?.cashBankAccountType) {
      return active;
    }

    const allowedIds = new Set(
      reference.cashBankAccounts
        .filter(
          (account) =>
            account.accountType === config.cashBankAccountType &&
            account.isActive,
        )
        .map((account) => account.ledgerAccountId),
    );

    return active.filter(
      (account) => account.isCashBank && allowedIds.has(account.id),
    );
  }, [reference.ledgerAccounts, reference.cashBankAccounts, config]);

  const cashBankAccounts = useMemo(() => {
    return reference.cashBankAccounts.filter(
      (account) =>
        account.isActive &&
        (!config?.cashBankAccountType ||
          account.accountType === config.cashBankAccountType),
    );
  }, [reference.cashBankAccounts, config]);

  function update(patch: Partial<FilterValues>) {
    setValues((current) => ({ ...current, ...patch }));
  }

  function handleFiscalYearChange(value: string) {
    // Reset the period when the fiscal year changes so a stale period from
    // another year is never sent to the backend.
    update({ accountingPeriodId: "", fiscalYearId: value });
  }

  function handleProjectChange(value: string) {
    // Reset the cost center when the project changes so a cost center from a
    // different project is never submitted.
    update({ costCenterId: "", projectId: value });
  }

  function handleSubmit() {
    if (!values.fiscalYearId) {
      setError("Select a fiscal year to run this report.");
      return;
    }

    if (config?.requireProject && !values.projectId) {
      setError("Select a project to run this report.");
      return;
    }

    if (config?.requireLedgerAccount && !values.ledgerAccountId) {
      setError("Select a ledger account to run this report.");
      return;
    }

    const showDateRange = config?.showDateRange ?? true;
    const hasStart = showDateRange && values.startDate !== "";
    const hasEnd = showDateRange && values.endDate !== "";

    if (showDateRange && (values.startDate !== "") !== (values.endDate !== "")) {
      setError(
        "Enter both a start date and an end date for a custom date range.",
      );
      return;
    }

    if (hasStart && hasEnd && values.startDate > values.endDate) {
      setError("Start date must be on or before end date.");
      return;
    }

    setError(null);

    onRun({
      fiscalYearId: values.fiscalYearId,
      ...(values.accountingPeriodId
        ? { accountingPeriodId: values.accountingPeriodId }
        : {}),
      ...(hasStart && hasEnd
        ? { startDate: values.startDate, endDate: values.endDate }
        : {}),
      ...(config?.showAsOfDate && values.asOfDate
        ? { asOfDate: values.asOfDate }
        : {}),
      ...(config?.showLedgerAccount && values.ledgerAccountId
        ? { ledgerAccountId: values.ledgerAccountId }
        : {}),
      ...(values.projectId ? { projectId: values.projectId } : {}),
      ...(values.costCenterId ? { costCenterId: values.costCenterId } : {}),
      ...(config?.showCashBankAccount && values.cashBankAccountId
        ? { cashBankAccountId: values.cashBankAccountId }
        : {}),
      ...(config?.showVoucherType && values.voucherType
        ? { voucherType: values.voucherType }
        : {}),
      ...(config?.showAccountClass && values.accountClassCode
        ? { accountClassCode: values.accountClassCode }
        : {}),
      ...(config?.showAccountGroup && values.accountGroupId
        ? { accountGroupId: values.accountGroupId }
        : {}),
      ...(config?.showExpenseOnly && values.expenseOnly
        ? { expenseOnly: values.expenseOnly }
        : {}),
      ...(config?.showAccountType && values.accountType
        ? { accountType: values.accountType }
        : {}),
    });
  }

  function handleReset() {
    setValues(emptyFilters);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field htmlFor="report-fiscal-year" label="Fiscal year" required>
          <Select
            id="report-fiscal-year"
            onChange={(event) => handleFiscalYearChange(event.target.value)}
            value={values.fiscalYearId}
          >
            <option value="">Select fiscal year</option>
            {reference.fiscalYears.map((fiscalYear) => (
              <option key={fiscalYear.id} value={fiscalYear.id} title={fiscalYearLabel(fiscalYear)}>
                {fiscalYearLabelCompact(fiscalYear)}
              </option>
            ))}
          </Select>
        </Field>

        <Field htmlFor="report-period" label="Accounting period">
          <Select
            id="report-period"
            onChange={(event) =>
              update({ accountingPeriodId: event.target.value })
            }
            value={values.accountingPeriodId}
          >
            <option value="">All periods in the fiscal year</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id} title={accountingPeriodLabel(period)}>
                {accountingPeriodLabelCompact(period)}
              </option>
            ))}
          </Select>
        </Field>

        {config?.showLedgerAccount ? (
          <Field
            htmlFor="report-ledger-account"
            label="Ledger account"
            required={config.requireLedgerAccount}
          >
            <Select
              id="report-ledger-account"
              onChange={(event) =>
                update({ ledgerAccountId: event.target.value })
              }
              value={values.ledgerAccountId}
            >
              <option value="">
                {config.requireLedgerAccount
                  ? "Select ledger account"
                  : "All eligible ledger accounts"}
              </option>
              {ledgerAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {ledgerAccountLabel(account)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {config?.showCashBankAccount ? (
          <Field htmlFor="report-cash-bank" label="Cash/bank account">
            <Select
              id="report-cash-bank"
              onChange={(event) =>
                update({ cashBankAccountId: event.target.value })
              }
              value={values.cashBankAccountId}
            >
              <option value="">All cash/bank accounts</option>
              {cashBankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {cashBankLabel(account)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {(config?.showDateRange ?? true) ? (
          <>
            <Field htmlFor="report-start-date" label="Start date">
              <TextInput
                id="report-start-date"
                onChange={(event) => update({ startDate: event.target.value })}
                type="date"
                value={values.startDate}
              />
            </Field>

            <Field htmlFor="report-end-date" label="End date">
              <TextInput
                id="report-end-date"
                onChange={(event) => update({ endDate: event.target.value })}
                type="date"
                value={values.endDate}
              />
            </Field>
          </>
        ) : null}

        {config?.showAsOfDate ? (
          <Field htmlFor="report-as-of-date" label="As of date">
            <TextInput
              id="report-as-of-date"
              onChange={(event) => update({ asOfDate: event.target.value })}
              type="date"
              value={values.asOfDate}
            />
          </Field>
        ) : null}

        {!config?.advancedProjectCostCenter ? (
          <>
            <Field htmlFor="report-project" label="Project" required={config?.requireProject}>
              <Select
                id="report-project"
                onChange={(event) => handleProjectChange(event.target.value)}
                value={values.projectId}
              >
                <option value="">All projects</option>
                {reference.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {projectLabel(project)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field htmlFor="report-cost-center" label="Cost center">
              <Select
                id="report-cost-center"
                onChange={(event) =>
                  update({ costCenterId: event.target.value })
                }
                value={values.costCenterId}
              >
                <option value="">All cost centers</option>
                {costCenters.map((center) => (
                  <option key={center.id} value={center.id}>
                    {costCenterLabel(center)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}

        {config?.showVoucherType ? (
          <Field htmlFor="report-voucher-type" label="Voucher type">
            <Select
              id="report-voucher-type"
              onChange={(event) =>
                update({ voucherType: event.target.value })
              }
              value={values.voucherType}
            >
              <option value="">All voucher types</option>
              <option value="DEBIT">Debit</option>
              <option value="CREDIT">Credit</option>
              <option value="JOURNAL">Journal</option>
              <option value="CONTRA">Contra</option>
              <option value="PAYMENT">Payment</option>
              <option value="RECEIPT">Receipt</option>
            </Select>
          </Field>
        ) : null}

        {config?.showAccountType ? (
          <Field htmlFor="report-account-type" label="Account type">
            <Select
              id="report-account-type"
              onChange={(event) =>
                update({ accountType: event.target.value })
              }
              value={values.accountType}
            >
              <option value="ALL">All fund accounts</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="MFS">MFS</option>
            </Select>
          </Field>
        ) : null}

        {config?.showAccountClass ? (
          <Field htmlFor="report-account-class" label="Account class">
            <Select
              id="report-account-class"
              onChange={(event) =>
                update({ accountClassCode: event.target.value })
              }
              value={values.accountClassCode}
            >
              <option value="">All account classes</option>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="EQUITY">Equity</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </Select>
          </Field>
        ) : null}

        {config?.showAccountGroup ? (
          <Field htmlFor="report-account-group" label="Account group">
            <Select
              id="report-account-group"
              onChange={(event) =>
                update({ accountGroupId: event.target.value })
              }
              value={values.accountGroupId}
            >
              <option value="">All account groups</option>
              {reference.accountGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} - {group.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {config?.showExpenseOnly ? (
          <Field htmlFor="report-expense-only" label="Expense only">
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={values.expenseOnly}
                className="size-4 rounded border-border"
                id="report-expense-only"
                onChange={(event) =>
                  update({ expenseOnly: event.target.checked })
                }
                type="checkbox"
              />
              Show only expense and asset class lines
            </label>
          </Field>
        ) : null}
      </div>

      {config?.advancedProjectCostCenter ? (
        <div className="flex flex-col gap-3">
          <button
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
            onClick={() => setShowAdvanced((v) => !v)}
            type="button"
          >
            <svg
              className={`size-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Advanced filters
            {(values.projectId || values.costCenterId) && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                active
              </span>
            )}
          </button>

          {showAdvanced ? (
            <div className="grid gap-5 rounded-md border border-border bg-secondary/30 p-4 sm:grid-cols-2">
              <Field htmlFor="report-project" label="Project">
                <Select
                  id="report-project"
                  onChange={(event) =>
                    handleProjectChange(event.target.value)
                  }
                  value={values.projectId}
                >
                  <option value="">All projects</option>
                  {reference.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {projectLabel(project)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field htmlFor="report-cost-center" label="Cost center">
                <Select
                  id="report-cost-center"
                  onChange={(event) =>
                    update({ costCenterId: event.target.value })
                  }
                  value={values.costCenterId}
                >
                  <option value="">All cost centers</option>
                  {costCenters.map((center) => (
                    <option key={center.id} value={center.id}>
                      {costCenterLabel(center)}
                    </option>
                  ))}
                </Select>
              </Field>

              <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                Advanced line-level filters. These filter report lines by
                stored project/cost center metadata on the selected
                cash/bank/MFS ledger line. Use only when voucher lines carry
                project or cost center metadata.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      {config?.showAsOfDate ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Leave the as-of date empty to use the selected accounting period end
          date, or the fiscal year end date when no period is chosen. The as-of
          date must fall inside the fiscal year.
        </p>
      ) : (config?.showDateRange ?? true) ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Leave the date range empty to use the selected accounting period, or the
          whole fiscal year when no period is chosen. A custom range needs both
          dates and must fall inside the fiscal year.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button disabled={pending} onClick={handleSubmit}>
          {pending ? "Running..." : "Run report"}
        </Button>
        <Button disabled={pending} onClick={handleReset} variant="ghost">
          Reset filters
        </Button>
      </div>
    </div>
  );
}
