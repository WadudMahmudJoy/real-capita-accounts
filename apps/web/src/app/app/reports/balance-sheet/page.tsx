"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getBalanceSheetReport,
  toErrorMessage,
  type BalanceSheetReport,
  type BalanceSheetSection,
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
  formatDate,
  formatMoney,
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

export default function BalanceSheetReportPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      const result = await getBalanceSheetReport(params);
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
        description="Show posted asset, liability, and equity balances at a point in time within a fiscal year, with the accounting balance check."
        title="Balance Sheet"
      />

      {references.status === "loading" ? (
        <LoadingPanel message="Loading report filters..." />
      ) : null}

      {references.status === "error" ? (
        <Notice tone="error">{references.message}</Notice>
      ) : null}

      {references.status === "ready" ? (
        <>
          <Card className="print:hidden">
            <CardHeader
              description="A fiscal year is required. The accounting period, as-of date, project, and cost center are optional."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                config={{ showAsOfDate: true, showDateRange: false }}
                onRun={runReport}
                pending={runState === "loading"}
                reference={references.reference}
              />
            </div>
          </Card>

          {runError ? <Notice tone="error">{runError}</Notice> : null}

          {report ? (
            <BalanceSheetResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running balance sheet..." />
          ) : (
            <Card>
              <EmptyState
                description="Choose a fiscal year, then run the report to see posted asset, liability, and equity balances."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function BalanceSheetResult({ report }: { report: BalanceSheetReport }) {
  const periodLabel = report.accountingPeriod
    ? report.accountingPeriod.name
    : "All periods in the fiscal year";
  const projectLabel = report.filters.project
    ? `${report.filters.project.code} - ${report.filters.project.name}`
    : "All projects";
  const costCenterLabel = report.filters.costCenter
    ? `${report.filters.costCenter.code} - ${report.filters.costCenter.name}`
    : "All cost centers";
  const asOfLabel = formatDate(report.asOfDate);

  return (
    <div className="flex flex-col gap-6">
      <Card className="print:hidden">
        <CardHeader actions={<PrintReportButton />} title="Report summary" />
        <div className="mt-5 flex flex-col gap-6">
          <ReportMeta
            items={[
              { label: "Report", value: "Balance Sheet" },
              { label: "Company", value: report.fiscalYear.company.name },
              {
                label: "Fiscal year",
                value: `${report.fiscalYear.name} (${formatDate(report.fiscalYear.startDate)} to ${formatDate(report.fiscalYear.endDate)})`,
              },
              { label: "Accounting period", value: periodLabel },
              { label: "As of date", value: asOfLabel },
              { label: "Project filter", value: projectLabel },
              { label: "Cost center filter", value: costCenterLabel },
            ]}
          />

          {report.isBalancedAdjusted ? (
            <Notice tone="success">
              The management balance sheet is balanced{' '}
              {report.isBalanced
                ? null
                : '(including current period profit/loss)'}
              . Total assets equal total liabilities and equity
              (difference {formatMoney(report.adjustedDifference)}).
            </Notice>
          ) : (
            <Notice tone="error">
              The balance sheet does not balance. Total assets and total
              liabilities plus equity differ by{' '}
              {formatMoney(report.adjustedDifference)}.
              {report.isBalanced ? null : (
                <> The unadjusted difference (ledger only) is{' '}
                {formatMoney(report.difference)}.</>
              )}
            </Notice>
          )}

          <SummaryGrid
            stats={[
              {
                emphasis: true,
                label: "Total assets",
                value: formatMoney(report.assets.total),
              },
              {
                label: "Total liabilities",
                value: formatMoney(report.liabilities.total),
              },
              {
                label: "Total equity (ledger)",
                value: formatMoney(report.equity.total),
              },
              {
                label: report.currentPeriodPLLabel,
                value: formatMoney(report.currentPeriodProfitLoss),
              },
              {
                label: "Adjusted total equity",
                value: formatMoney(report.adjustedTotalEquity),
              },
              {
                emphasis: true,
                label: "Liabilities + adjusted equity",
                value: formatMoney(
                  report.adjustedTotalLiabilitiesAndEquity,
                ),
              },
              {
                label: "Adjusted difference",
                value: formatMoney(report.adjustedDifference),
              },
              {
                label: "Balanced",
                value: report.isBalancedAdjusted ? "Yes" : "No",
              },
            ]}
          />
        </div>
      </Card>

      <Card className="print:hidden">
        <CardHeader
          description="Posted asset balances as of the selected date."
          title="Assets"
        />
        <BalanceSheetTable
          emptyDescription="No posted asset balances were found as of the selected date."
          emptyTitle="No assets"
          section={report.assets}
          totalLabel="Total assets"
        />
      </Card>

      <Card className="print:hidden">
        <CardHeader
          description="Posted liability balances as of the selected date."
          title="Liabilities"
        />
        <BalanceSheetTable
          emptyDescription="No posted liability balances were found as of the selected date."
          emptyTitle="No liabilities"
          section={report.liabilities}
          totalLabel="Total liabilities"
        />
      </Card>

      <Card className="print:hidden">
        <CardHeader
          description="Posted equity ledger balances as of the selected date. Current period profit/loss adjustment is shown in the report summary."
          title="Equity (ledger)"
        />
        <BalanceSheetTable
          emptyDescription="No posted equity balances were found as of the selected date."
          emptyTitle="No equity"
          section={report.equity}
          totalLabel="Total equity"
        />
      </Card>

      <BalanceSheetPrint
        report={report}
        meta={[
          { label: "Company", value: report.fiscalYear.company.name },
          { label: "Fiscal year", value: report.fiscalYear.name },
          { label: "Accounting period", value: periodLabel },
          { label: "As of date", value: asOfLabel },
          { label: "Project filter", value: projectLabel },
          { label: "Cost center filter", value: costCenterLabel },
        ]}
      />
    </div>
  );
}

function BalanceSheetTable({
  section,
  totalLabel,
  emptyTitle,
  emptyDescription,
}: {
  section: BalanceSheetSection;
  totalLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (section.rows.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState description={emptyDescription} title={emptyTitle} />
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5">Code</th>
            <th className="px-3 py-2.5">Account name</th>
            <th className="px-3 py-2.5">Account group</th>
            <th className="px-3 py-2.5 text-right">Debit movement</th>
            <th className="px-3 py-2.5 text-right">Credit movement</th>
            <th className="px-3 py-2.5 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row) => (
            <tr
              className="border-b border-border/70 last:border-0"
              key={row.ledgerAccount.id}
            >
              <td className="px-3 py-3 font-medium text-foreground">
                {row.ledgerAccount.code}
              </td>
              <td className="px-3 py-3 text-foreground">
                {row.ledgerAccount.name}
              </td>
              <td className="px-3 py-3 text-muted-foreground">
                {row.accountGroup.name}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-foreground">
                {formatMoney(row.debitMovement)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-foreground">
                {formatMoney(row.creditMovement)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-foreground">
                {formatMoney(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-semibold">
            <td className="px-3 py-3 text-foreground" colSpan={5}>
              {totalLabel}
            </td>
            <td className="px-3 py-3 text-right tabular-nums text-foreground">
              {formatMoney(section.total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BalanceSheetPrint({
  report,
  meta,
}: {
  report: BalanceSheetReport;
  meta: { label: string; value: string }[];
}) {
  return (
    <ReportPrintFrame meta={meta} title="Balance Sheet">
      <PrintSection
        section={report.assets}
        title="Assets"
        totalLabel="Total assets"
      />
      <div className="h-3" />
      <PrintSection
        section={report.liabilities}
        title="Liabilities"
        totalLabel="Total liabilities"
      />
      <div className="h-3" />
      <PrintSection
        section={report.equity}
        title="Equity (ledger)"
        totalLabel="Total equity (ledger)"
      />

      {/* Current period profit/loss adjustment line */}
      <table className="mt-4 w-full border-collapse border border-black text-xs">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1.5 font-semibold">
              {report.currentPeriodPLLabel}
            </td>
            <td className="border border-black px-2 py-1.5 text-right tabular-nums">
              {formatMoney(report.currentPeriodProfitLoss)}
            </td>
          </tr>
          <tr className="font-semibold">
            <td className="border border-black px-2 py-1.5">
              Adjusted total equity
            </td>
            <td className="border border-black px-2 py-1.5 text-right tabular-nums">
              {formatMoney(report.adjustedTotalEquity)}
            </td>
          </tr>
          <tr className="font-bold">
            <td className="border border-black px-2 py-1.5">
              Total liabilities and adjusted equity
            </td>
            <td className="border border-black px-2 py-1.5 text-right tabular-nums">
              {formatMoney(report.adjustedTotalLiabilitiesAndEquity)}
            </td>
          </tr>
          <tr className="font-bold">
            <td className="border border-black px-2 py-1.5">
              Adjusted difference (assets - liabilities - adjusted equity)
              {report.isBalancedAdjusted
                ? ' — balanced'
                : ' — not balanced'}
            </td>
            <td className="border border-black px-2 py-1.5 text-right tabular-nums">
              {formatMoney(report.adjustedDifference)}
            </td>
          </tr>
        </tbody>
      </table>
    </ReportPrintFrame>
  );
}

function PrintSection({
  section,
  title,
  totalLabel,
}: {
  section: BalanceSheetSection;
  title: string;
  totalLabel: string;
}) {
  return (
    <table className="w-full border-collapse border border-black text-xs">
      <thead>
        <tr className="bg-gray-100">
          <th className={printHeadCell} colSpan={3}>
            {title}
          </th>
          <th className={printNumberHeadCell}>Balance</th>
        </tr>
        <tr className="bg-gray-50">
          <th className={printHeadCell}>Code</th>
          <th className={printHeadCell}>Account name</th>
          <th className={printHeadCell}>Account group</th>
          <th className={printNumberHeadCell}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {section.rows.length === 0 ? (
          <tr>
            <td className={printCell} colSpan={4}>
              No posted balances.
            </td>
          </tr>
        ) : (
          section.rows.map((row) => (
            <tr key={row.ledgerAccount.id}>
              <td className={printCell}>{row.ledgerAccount.code}</td>
              <td className={printCell}>{row.ledgerAccount.name}</td>
              <td className={printCell}>{row.accountGroup.name}</td>
              <td className={printNumberCell}>{formatMoney(row.amount)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr className="font-semibold">
          <td className="border border-black px-2 py-1.5" colSpan={3}>
            {totalLabel}
          </td>
          <td className={printNumberCell}>{formatMoney(section.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
