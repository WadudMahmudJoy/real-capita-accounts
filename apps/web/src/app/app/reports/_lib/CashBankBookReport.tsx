"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getBankBookReport,
  getCashBookReport,
  getMfsBookReport,
  toErrorMessage,
  type CashBankAccountType,
  type CashBankReport,
  type ReportQueryParams,
} from "@/lib/api";
import {
  Card,
  CardHeader,
  EmptyState,
  LoadingPanel,
  Notice,
  PageIntro,
} from "../../_components/ui";
import {
  ReportFilters,
  ReportMeta,
  SummaryGrid,
  formatBalance,
  formatDate,
  formatMoney,
  providerDisplayName,
  voucherTypeLabel,
} from "./report-ui";
import {
  PrintReportButton,
  ReportPrintFrame,
  printCell,
  printHeadCell,
  printNumberCell,
  printNumberHeadCell,
} from "./report-print";
import { useReportReferences } from "./useReportReferences";

// Cash Book, Bank Book, and MFS Book are each scoped to their own account type.
// CASH and BANK share the CashBankBookReport component; MFS joins here so the
// same report structure serves all three cash/bank/MFS operational books.
type CashBankBookAccountType = Extract<CashBankAccountType, "CASH" | "BANK" | "MFS">;

type Variant = {
  accountType: CashBankBookAccountType;
  title: string;
  description: string;
  emptyAccountsLabel: string;
};

const VARIANTS: Record<CashBankBookAccountType, Variant> = {
  BANK: {
    accountType: "BANK",
    description:
      "Review posted bank transactions for bank-type cash/bank accounts over a fiscal year, period, or custom date range, with a running balance.",
    emptyAccountsLabel: "All bank accounts",
    title: "Bank Book",
  },
  CASH: {
    accountType: "CASH",
    description:
      "Review posted cash transactions for cash-type cash/bank accounts over a fiscal year, period, or custom date range, with a running balance.",
    emptyAccountsLabel: "All cash accounts",
    title: "Cash Book",
  },
  MFS: {
    accountType: "MFS",
    description:
      "Review posted MFS / mobile wallet transactions for MFS-type cash/bank accounts over a fiscal year, period, or custom date range, with a running balance.",
    emptyAccountsLabel: "All MFS accounts",
    title: "MFS Book",
  },
};

/**
 * Shared operational report page for the Cash Book and Bank Book. The two only
 * differ by the cash/bank account type they scope to and the endpoint they call.
 */
export function CashBankBookReport({
  accountType,
}: {
  accountType: CashBankBookAccountType;
}) {
  const variant = VARIANTS[accountType];
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<CashBankReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      let result: CashBankReport;

      if (accountType === "MFS") {
        result = await getMfsBookReport(params);
      } else if (accountType === "BANK") {
        result = await getBankBookReport(params);
      } else {
        result = await getCashBookReport(params);
      }

      setReport(result);
      setRunState("idle");
    } catch (caught) {
      if (caught instanceof ApiError && caught.isUnauthorized) {
        router.replace("/login");
        return;
      }

      setReport(null);
      setRunError(toErrorMessage(caught));
      setRunState("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageIntro description={variant.description} title={variant.title} />

      {references.status === "loading" ? (
        <LoadingPanel message="Loading report filters..." />
      ) : null}

      {references.status === "error" ? (
        <Notice tone="error">{references.message}</Notice>
      ) : null}

      {references.status === "ready" ? (
        <>
          <Card>
            <CardHeader
              description="A fiscal year is required. The period, date range, cash/bank account, and ledger account are optional. Project and cost center filters are advanced line-level options."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                config={{
                  advancedProjectCostCenter: true,
                  cashBankAccountType: accountType,
                  showCashBankAccount: true,
                  showLedgerAccount: true,
                }}
                onRun={runReport}
                pending={runState === "loading"}
                reference={references.reference}
              />
            </div>
          </Card>

          {runError ? <Notice tone="error">{runError}</Notice> : null}

          {report ? (
            <CashBankResult report={report} variant={variant} />
          ) : runState === "loading" ? (
            <LoadingPanel message={`Running ${variant.title.toLowerCase()}...`} />
          ) : (
            <Card>
              <EmptyState
                description="Choose a fiscal year, then run the report to see posted cash/bank movements."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function CashBankResult({
  report,
  variant,
}: {
  report: CashBankReport;
  variant: Variant;
}) {
  const periodLabel = report.accountingPeriod
    ? report.accountingPeriod.name
    : "All periods in the fiscal year";

  const accountLabel =
    variant.accountType === "MFS" ? "Cash/bank/MFS account" : "Cash/bank account";

  const metaItems: { label: string; value: React.ReactNode }[] = [
    { label: "Report", value: variant.title },
    { label: "Company", value: report.fiscalYear.company.name },
    {
      label: "Fiscal year",
      value: `${report.fiscalYear.name} (${formatDate(report.fiscalYear.startDate)} to ${formatDate(report.fiscalYear.endDate)})`,
    },
    { label: "Accounting period", value: periodLabel },
    {
      label: "Date range",
      value: `${formatDate(report.dateRange.startDate)} to ${formatDate(report.dateRange.endDate)}`,
    },
    {
      label: accountLabel,
      value: report.cashBankAccount
        ? report.cashBankAccount.displayName
        : variant.emptyAccountsLabel,
    },
    ...(variant.accountType === "MFS" && report.cashBankAccount
      ? ([
          {
            label: "Provider",
            value: report.cashBankAccount.provider === "OTHER"
              ? report.cashBankAccount.providerOtherName?.trim() ?? "Other"
              : providerDisplayName(report.cashBankAccount.provider ?? ""),
          },
          {
            label: "Wallet / account ID",
            value: report.cashBankAccount.walletNumber ?? "-",
          },
          {
            label: "Account holder",
            value: report.cashBankAccount.accountHolderName?.trim() ?? "-",
          },
        ] as const)
      : []),
    {
      label: "Ledger account filter",
      value: report.filters.ledgerAccount
        ? `${report.filters.ledgerAccount.code} - ${report.filters.ledgerAccount.name}`
        : "All eligible ledger accounts",
    },
    {
      label: "Project filter",
      value: report.filters.project
        ? `${report.filters.project.code} - ${report.filters.project.name}`
        : "All projects",
    },
    {
      label: "Cost center filter",
      value: report.filters.costCenter
        ? `${report.filters.costCenter.code} - ${report.filters.costCenter.name}`
        : "All cost centers",
    },
  ];

          return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader actions={<PrintReportButton />} title="Report summary" />
        <div className="mt-5 flex flex-col gap-6">
          <ReportMeta items={metaItems} />

          <SummaryGrid
            stats={[
              {
                label: "Opening balance",
                value: formatBalance(report.openingBalance),
              },
              {
                label: "Period debit (receipts)",
                value: formatMoney(report.periodDebit),
              },
              {
                label: "Period credit (payments)",
                value: formatMoney(report.periodCredit),
              },
              {
                emphasis: true,
                label: "Closing balance",
                value: formatBalance(report.closingBalance),
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          description="Posted lines are ordered by voucher date, then voucher number and line number."
          title={`${variant.title} lines`}
        />

        {report.lines.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description={`No posted ${variant.accountType === "MFS" ? "MFS" : "cash/bank"} transactions matched the selected filters.`}
              title="No transactions"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Voucher no.</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Narration</th>
                  {variant.accountType === "MFS" ? (
                    <th className="px-3 py-2.5">Provider</th>
                  ) : null}
                  <th className="px-3 py-2.5">Ledger account</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Running balance</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr
                    className="border-b border-border/70 last:border-0"
                    key={line.id}
                  >
                    <td className="px-3 py-3 text-muted-foreground">
                      {formatDate(line.voucherDate)}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">
                      {line.systemVoucherNo}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {voucherTypeLabel(line.voucherType)}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-3 text-muted-foreground" title={line.narration ?? undefined}>
                      {line.narration ?? "-"}
                    </td>
                    {variant.accountType === "MFS" ? (
                      <td className="px-3 py-3 text-muted-foreground">
                        {line.cashBankAccount?.provider
                          ? line.cashBankAccount.provider === "OTHER"
                            ? line.cashBankAccount.providerOtherName?.trim() ??
                              "Other"
                            : providerDisplayName(
                                line.cashBankAccount.provider,
                              )
                          : "-"}
                      </td>
                    ) : null}
                    <td className="max-w-[200px] truncate px-3 py-3 text-muted-foreground" title={`${line.ledgerAccount.code} - ${line.ledgerAccount.name}`}>
                      {line.ledgerAccount.code} - {line.ledgerAccount.name}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(line.debit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(line.credit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatBalance(line.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ReportPrintFrame
        meta={[
          { label: "Company", value: report.fiscalYear.company.name },
          { label: "Fiscal year", value: report.fiscalYear.name },
          { label: "Accounting period", value: periodLabel },
          {
            label: "Date range",
            value: `${formatDate(report.dateRange.startDate)} to ${formatDate(report.dateRange.endDate)}`,
          },
          {
            label:
              variant.accountType === "MFS"
                ? "MFS account"
                : "Cash/bank account",
            value: report.cashBankAccount
              ? report.cashBankAccount.displayName
              : variant.emptyAccountsLabel,
          },
          ...(variant.accountType === "MFS" && report.cashBankAccount
            ? ([
                {
                  label: "Provider",
                  value:
                    report.cashBankAccount.provider === "OTHER"
                      ? report.cashBankAccount.providerOtherName?.trim() ??
                        "Other"
                      : providerDisplayName(
                          report.cashBankAccount.provider ?? "",
                        ),
                },
                {
                  label: "Wallet / account ID",
                  value: report.cashBankAccount.walletNumber ?? "-",
                },
              ] as const)
            : []),
          {
            label: "Opening balance",
            value: formatBalance(report.openingBalance),
          },
          {
            label: "Closing balance",
            value: formatBalance(report.closingBalance),
          },
          {
            label: "Project filter",
            value: report.filters.project
              ? `${report.filters.project.code} - ${report.filters.project.name}`
              : "All projects",
          },
        ]}
        title={variant.title}
      >
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className={printHeadCell}>Date</th>
              <th className={printHeadCell}>Voucher no.</th>
              <th className={printHeadCell}>Ledger account</th>
              <th className={printNumberHeadCell}>Debit</th>
              <th className={printNumberHeadCell}>Credit</th>
              <th className={printNumberHeadCell}>Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={printCell} colSpan={5}>
                Opening balance
              </td>
              <td className={printNumberCell}>
                {formatBalance(report.openingBalance)}
              </td>
            </tr>
            {report.lines.map((line) => (
              <tr key={line.id}>
                <td className={printCell}>{formatDate(line.voucherDate)}</td>
                <td className={printCell}>{line.systemVoucherNo}</td>
                <td className={printCell}>
                  {line.ledgerAccount.code} - {line.ledgerAccount.name}
                </td>
                <td className={printNumberCell}>{formatMoney(line.debit)}</td>
                <td className={printNumberCell}>{formatMoney(line.credit)}</td>
                <td className={printNumberCell}>
                  {formatBalance(line.runningBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-black px-2 py-1.5" colSpan={3}>
                Period movement / closing balance
              </td>
              <td className={printNumberCell}>
                {formatMoney(report.periodDebit)}
              </td>
              <td className={printNumberCell}>
                {formatMoney(report.periodCredit)}
              </td>
              <td className={printNumberCell}>
                {formatBalance(report.closingBalance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </ReportPrintFrame>
    </div>
  );
}
