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

export function cashBankLabel(account: CashBankAccount): string {
  return `${account.displayName} (${account.accountType === "CASH" ? "Cash" : "Bank"})`;
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
