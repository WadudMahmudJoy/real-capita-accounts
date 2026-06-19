import type { ReactNode } from "react";
import type {
  AccountingPeriod,
  CashBankAccount,
  CostCenter,
  FiscalYear,
  LedgerAccount,
  Project,
  VoucherStatus,
  VoucherType,
} from "@/lib/api";
import { StatusBadge } from "../../_components/ui";

// The six confirmed voucher types, shown in dropdowns and summaries.
export const VOUCHER_TYPE_OPTIONS: { value: VoucherType; label: string }[] = [
  { label: "Payment", value: "PAYMENT" },
  { label: "Receipt", value: "RECEIPT" },
  { label: "Journal", value: "JOURNAL" },
  { label: "Contra", value: "CONTRA" },
  { label: "Debit", value: "DEBIT" },
  { label: "Credit", value: "CREDIT" },
];

const VOUCHER_TYPE_LABELS: Record<VoucherType, string> = {
  CONTRA: "Contra",
  CREDIT: "Credit",
  DEBIT: "Debit",
  JOURNAL: "Journal",
  PAYMENT: "Payment",
  RECEIPT: "Receipt",
};

export function voucherTypeLabel(type: VoucherType): string {
  return VOUCHER_TYPE_LABELS[type];
}

export function voucherStatusBadge(status: VoucherStatus): ReactNode {
  if (status === "POSTED") {
    return <StatusBadge tone="active">Posted</StatusBadge>;
  }

  return <StatusBadge tone="closed">Draft</StatusBadge>;
}

// Parse an API decimal string into a number for arithmetic. Amounts are small
// monetary values; using Number keeps the running totals simple and the two
// decimal places are preserved by formatMoney.
export function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: string | number | null | undefined): string {
  return toAmount(value).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

// Round to two decimals to avoid binary floating point dust when comparing
// debit and credit running totals for the balance indicator.
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
}

export function ledgerAccountLabel(account: LedgerAccount): string {
  return `${account.code} - ${account.name} (${account.normalBalance === "DEBIT" ? "Dr" : "Cr"})`;
}

export function projectLabel(project: Project): string {
  return `${project.code} - ${project.name}`;
}

export function costCenterLabel(center: CostCenter): string {
  return `${center.code} - ${center.name}`;
}

function cashBankTypeWord(accountType: CashBankAccount["accountType"]): string {
  if (accountType === "CASH") {
    return "Cash";
  }

  if (accountType === "BANK") {
    return "Bank";
  }

  return "MFS";
}

function providerDisplayName(provider: string | null | undefined): string {
  if (!provider) {
    return "";
  }

  const map: Record<string, string> = {
    BKASH: "bKash",
    NAGAD: "Nagad",
    ROCKET: "Rocket",
    UPAY: "Upay",
  };

  return map[provider] ?? provider;
}

export function cashBankLabel(account: CashBankAccount): string {
  const type = cashBankTypeWord(account.accountType);

  if (account.accountType === "MFS") {
    const provider =
      account.provider === "OTHER"
        ? account.providerOtherName ?? "MFS"
        : providerDisplayName(account.provider);
    const wallet = account.walletNumber ? ` / ${account.walletNumber}` : "";
    return `${account.displayName} \u2014 ${type} / ${provider}${wallet}`;
  }

  return `${account.displayName} (${type})`;
}

export function isMfsCashBankAccount(account: CashBankAccount): boolean {
  return account.accountType === "MFS";
}

/**
 * Filter cash/bank/MFS accounts based on voucher type. JOURNAL does not allow
 * MFS accounts; all other voucher types allow CASH, BANK, and MFS.
 */
export function filterCashBankAccountsByVoucherType(
  accounts: CashBankAccount[],
  voucherType: VoucherType,
): CashBankAccount[] {
  if (voucherType === "JOURNAL") {
    return accounts.filter((account) => account.accountType !== "MFS");
  }

  return accounts;
}

// ---------------------------------------------------------------------------
// Selection-aware voucher line field requirements (Phase 2F, Chunk 2F-5)
//
// This is the reusable selection-aware UX pattern for voucher line entry: the
// fields shown for a line are derived from the selected ledger account (and the
// cash/bank/MFS accounts linked to it), instead of showing Project, Cost Center,
// and Cash/Bank/MFS generically for every line. The same idea ("UI reacts to the
// selected reference") is intended to be reused across report filters and setup
// forms in later chunks; keep this helper small and pure so it can be lifted to a
// shared module when that work happens. The backend posting validation in
// `voucher.service.ts` remains the authority; this only guides the accountant.
// ---------------------------------------------------------------------------

export type VoucherLineFieldRequirements = {
  /** Project is mandatory for posting this ledger (backend `requiresProject`). */
  requiresProject: boolean;
  /** Cost center is mandatory for posting this ledger (backend `requiresCostCenter`). */
  requiresCostCenter: boolean;
  /** Ledger is a cash/bank/MFS ledger (backend `isCashBank`). */
  isCashBank: boolean;
  /** Type-aware label for the cash/bank/MFS account field, e.g. "Bank account". */
  cashBankFieldLabel: string;
  /** Concise one-line guidance for the accountant, or null when nothing useful. */
  guidance: string | null;
};

// Derive a type-aware label from the active cash/bank/MFS accounts linked to the
// selected ledger. When the accounts are all one type the label is specific;
// otherwise (or when none are linked yet) it falls back to the generic label.
export function cashBankFieldLabel(accounts: CashBankAccount[]): string {
  const types = new Set(accounts.map((account) => account.accountType));

  if (types.size === 1) {
    if (types.has("CASH")) {
      return "Cash account";
    }

    if (types.has("BANK")) {
      return "Bank account";
    }

    if (types.has("MFS")) {
      return "MFS wallet";
    }
  }

  return "Cash/Bank/MFS account";
}

export function deriveVoucherLineFieldRequirements(
  ledger: LedgerAccount | undefined,
  matchingCashBankAccounts: CashBankAccount[],
  voucherType?: VoucherType,
): VoucherLineFieldRequirements {
  const requiresProject = ledger?.requiresProject ?? false;
  const requiresCostCenter = ledger?.requiresCostCenter ?? false;
  const isCashBank = ledger?.isCashBank ?? false;
  const fieldLabel = cashBankFieldLabel(matchingCashBankAccounts);

  let guidance: string | null = null;

  if (ledger) {
    if (isCashBank) {
      if (voucherType && ["PAYMENT", "RECEIPT", "CONTRA"].includes(voucherType)) {
        guidance = `${fieldLabel} is required. Project and cost center are optional for fund-line tagging (enables fund visibility in Project Fund Movement report).`;
      } else {
        guidance = `${fieldLabel} is required for this cash/bank ledger.`;
      }
    } else if (requiresProject && requiresCostCenter) {
      guidance = "This ledger requires project and cost center.";
    } else if (requiresProject) {
      guidance = "This ledger requires project.";
    } else if (requiresCostCenter) {
      guidance = "This ledger requires cost center.";
    } else {
      guidance = "No project or cost center is required for this ledger.";
    }
  }

  return {
    cashBankFieldLabel: fieldLabel,
    guidance,
    isCashBank,
    requiresCostCenter,
    requiresProject,
  };
}

export function fiscalYearLabel(fiscalYear: FiscalYear): string {
  const range = `${formatDate(fiscalYear.startDate)} to ${formatDate(fiscalYear.endDate)}`;
  const status = fiscalYear.isClosed
    ? "Closed"
    : fiscalYear.isActive
      ? "Active"
      : "Inactive";
  return `${fiscalYear.name} (${range}) - ${status}`;
}

export function accountingPeriodLabel(period: AccountingPeriod): string {
  const range = `${formatDate(period.startDate)} to ${formatDate(period.endDate)}`;
  const status =
    period.status === "OPEN"
      ? "Open"
      : period.status === "LOCKED"
        ? "Locked"
        : "Closed";
  return `${period.name} (${range}) - ${status}`;
}
