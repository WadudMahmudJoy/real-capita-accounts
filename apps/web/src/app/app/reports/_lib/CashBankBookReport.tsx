"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getBankBookReport,
  getCashBookReport,
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

// Cash Book and Bank Book are scoped to CASH and BANK only. MFS transactions
// are intentionally excluded here; they belong to a separate MFS Book.
type CashBankBookAccountType = Extract<CashBankAccountType, "CASH" | "BANK">;

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
      const result =
        accountType === "CASH"
          ? await getCashBookReport(params)
          : await getBankBookReport(params);
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
              description="A fiscal year is required. The period, date range, cash/bank account, ledger account, project, and cost center are optional."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                config={{
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

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader actions={<PrintReportButton />} title="Report summary" />
        <div className="mt-5 flex flex-col gap-6">
          <ReportMeta
            items={[
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
                label: "Cash/bank account",
                value: report.cashBankAccount
                  ? report.cashBankAccount.displayName
                  : variant.emptyAccountsLabel,
              },
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
            ]}
          />

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
              description="No posted cash/bank transactions matched the selected filters."
              title="No transactions"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Voucher no.</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Narration</th>
                  <th className="px-3 py-2.5">Cash/bank account</th>
                  <th className="px-3 py-2.5">Ledger account</th>
                  <th className="px-3 py-2.5">Opposite accounts</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Running balance</th>
                  <th className="px-3 py-2.5">Project</th>
                  <th className="px-3 py-2.5">Cost center</th>
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
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.narration ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.cashBankAccount
                        ? line.cashBankAccount.displayName
                        : "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.ledgerAccount.code} - {line.ledgerAccount.name}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.oppositeAccounts.length === 0
                        ? "-"
                        : line.oppositeAccounts
                            .map(
                              (opposite) =>
                                `${opposite.ledgerAccount.code} (${opposite.side === "DEBIT" ? "Dr" : "Cr"})`,
                            )
                            .join(", ")}
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
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.project ? line.project.code : "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.costCenter ? line.costCenter.code : "-"}
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
            label: "Cash/bank account",
            value: report.cashBankAccount
              ? report.cashBankAccount.displayName
              : variant.emptyAccountsLabel,
          },
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
