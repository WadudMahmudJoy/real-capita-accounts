"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getLedgerReport,
  toErrorMessage,
  type LedgerReport,
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
} from "../_lib/report-ui";
import {
  PrintReportButton,
  ReportPrintFrame,
  printCell,
  printHeadCell,
  printNumberCell,
  printNumberHeadCell,
} from "../_lib/report-print";
import { useReportReferences } from "../_lib/useReportReferences";

export default function LedgerReportPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<LedgerReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      const result = await getLedgerReport(params);
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
      <PageIntro
        description="Review every posted transaction for one ledger account over a fiscal year, period, or custom date range, with opening, period, and closing balances."
        title="General Ledger / Ledger Statement"
      />

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
              description="A fiscal year and a ledger account are required. The period, date range, project, and cost center are optional."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                config={{
                  requireLedgerAccount: true,
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
            <LedgerResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running ledger report..." />
          ) : (
            <Card>
              <EmptyState
                description="Choose a fiscal year and a ledger account, then run the report to see posted ledger movements."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function LedgerResult({ report }: { report: LedgerReport }) {
  const { ledgerAccount } = report;
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
              { label: "Report", value: "General Ledger / Ledger Statement" },
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
                label: "Ledger account",
                value: `${ledgerAccount.code} - ${ledgerAccount.name}`,
              },
              {
                label: "Account group / class",
                value: `${ledgerAccount.accountGroup.name} / ${ledgerAccount.accountGroup.accountClass.name}`,
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
              { label: "Period debit", value: formatMoney(report.periodDebit) },
              {
                label: "Period credit",
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
          title="Ledger lines"
        />

        {report.lines.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="No posted transactions affected this ledger account in the selected range."
              title="No ledger lines"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Voucher no.</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Narration</th>
                  <th className="px-3 py-2.5">Line description</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Running balance</th>
                  <th className="px-3 py-2.5">Project</th>
                  <th className="px-3 py-2.5">Cost center</th>
                  <th className="px-3 py-2.5">Cash/bank</th>
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
                      {line.lineDescription ?? "-"}
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
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.cashBankAccount
                        ? line.cashBankAccount.displayName
                        : "-"}
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
            label: "Ledger account",
            value: `${ledgerAccount.code} - ${ledgerAccount.name}`,
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
          {
            label: "Cost center filter",
            value: report.filters.costCenter
              ? `${report.filters.costCenter.code} - ${report.filters.costCenter.name}`
              : "All cost centers",
          },
        ]}
        title="General Ledger / Ledger Statement"
      >
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className={printHeadCell}>Date</th>
              <th className={printHeadCell}>Voucher no.</th>
              <th className={printHeadCell}>Type</th>
              <th className={printHeadCell}>Description</th>
              <th className={printNumberHeadCell}>Debit</th>
              <th className={printNumberHeadCell}>Credit</th>
              <th className={printNumberHeadCell}>Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={printCell} colSpan={6}>
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
                  {voucherTypeLabel(line.voucherType)}
                </td>
                <td className={printCell}>
                  {line.lineDescription ?? line.narration ?? "-"}
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
              <td className="border border-black px-2 py-1.5" colSpan={4}>
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
