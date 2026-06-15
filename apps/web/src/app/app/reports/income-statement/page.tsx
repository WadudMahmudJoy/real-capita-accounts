"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getIncomeStatementReport,
  toErrorMessage,
  type IncomeStatementReport,
  type IncomeStatementSection,
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

export default function IncomeStatementReportPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<IncomeStatementReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      const result = await getIncomeStatementReport(params);
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
        description="Summarise posted income and expense movement for a fiscal year, period, or custom date range and see the resulting net profit or loss."
        title="Income Statement"
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
              description="A fiscal year is required. The period, date range, project, and cost center are optional."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                onRun={runReport}
                pending={runState === "loading"}
                reference={references.reference}
              />
            </div>
          </Card>

          {runError ? <Notice tone="error">{runError}</Notice> : null}

          {report ? (
            <IncomeStatementResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running income statement..." />
          ) : (
            <Card>
              <EmptyState
                description="Choose a fiscal year, then run the report to see posted income, expenses, and net profit or loss."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function IncomeStatementResult({ report }: { report: IncomeStatementReport }) {
  const periodLabel = report.accountingPeriod
    ? report.accountingPeriod.name
    : "All periods in the fiscal year";
  const projectLabel = report.filters.project
    ? `${report.filters.project.code} - ${report.filters.project.name}`
    : "All projects";
  const costCenterLabel = report.filters.costCenter
    ? `${report.filters.costCenter.code} - ${report.filters.costCenter.name}`
    : "All cost centers";
  const dateRangeLabel = `${formatDate(report.dateRange.startDate)} to ${formatDate(report.dateRange.endDate)}`;
  const netLabel = report.isProfit ? "Net profit" : "Net loss";

  return (
    <div className="flex flex-col gap-6">
      <Card className="print:hidden">
        <CardHeader
          actions={<PrintReportButton />}
          title="Report summary"
        />
        <div className="mt-5 flex flex-col gap-6">
          <ReportMeta
            items={[
              { label: "Report", value: "Income Statement" },
              { label: "Company", value: report.fiscalYear.company.name },
              {
                label: "Fiscal year",
                value: `${report.fiscalYear.name} (${formatDate(report.fiscalYear.startDate)} to ${formatDate(report.fiscalYear.endDate)})`,
              },
              { label: "Accounting period", value: periodLabel },
              { label: "Date range", value: dateRangeLabel },
              { label: "Project filter", value: projectLabel },
              { label: "Cost center filter", value: costCenterLabel },
            ]}
          />

          {report.isProfit ? (
            <Notice tone="success">
              Net profit of {formatMoney(report.netIncome)} for the selected
              range. Total income {formatMoney(report.income.total)} exceeds
              total expense {formatMoney(report.expenses.total)}.
            </Notice>
          ) : (
            <Notice tone="info">
              Net loss of {formatMoney(report.netIncome)} for the selected range.
              Total expense {formatMoney(report.expenses.total)} exceeds total
              income {formatMoney(report.income.total)}.
            </Notice>
          )}

          <SummaryGrid
            stats={[
              {
                label: "Total income",
                value: formatMoney(report.income.total),
              },
              {
                label: "Total expense",
                value: formatMoney(report.expenses.total),
              },
              {
                emphasis: true,
                label: netLabel,
                value: formatMoney(report.netIncome),
              },
              {
                label: "Result",
                value: report.isProfit ? "Profit" : "Loss",
              },
            ]}
          />
        </div>
      </Card>

      <Card className="print:hidden">
        <CardHeader
          description="Posted credit movement, net of any debit reversals, grouped by account group."
          title="Income"
        />
        <IncomeExpenseTable
          emptyTitle="No income"
          emptyDescription="No posted income movement was found for the selected range."
          section={report.income}
          totalLabel="Total income"
        />
      </Card>

      <Card className="print:hidden">
        <CardHeader
          description="Posted debit movement, net of any credit reversals, grouped by account group."
          title="Expenses"
        />
        <IncomeExpenseTable
          emptyTitle="No expenses"
          emptyDescription="No posted expense movement was found for the selected range."
          section={report.expenses}
          totalLabel="Total expense"
        />
      </Card>

      <IncomeStatementPrint
        report={report}
        meta={[
          { label: "Company", value: report.fiscalYear.company.name },
          { label: "Fiscal year", value: report.fiscalYear.name },
          { label: "Accounting period", value: periodLabel },
          { label: "Date range", value: dateRangeLabel },
          { label: "Project filter", value: projectLabel },
          { label: "Cost center filter", value: costCenterLabel },
        ]}
      />
    </div>
  );
}

function IncomeExpenseTable({
  section,
  totalLabel,
  emptyTitle,
  emptyDescription,
}: {
  section: IncomeStatementSection;
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
            <th className="px-3 py-2.5 text-right">Amount</th>
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

function IncomeStatementPrint({
  report,
  meta,
}: {
  report: IncomeStatementReport;
  meta: { label: string; value: string }[];
}) {
  return (
    <ReportPrintFrame meta={meta} title="Income Statement">
      <PrintSection section={report.income} title="Income" totalLabel="Total income" />
      <div className="h-3" />
      <PrintSection
        section={report.expenses}
        title="Expenses"
        totalLabel="Total expense"
      />

      <table className="mt-4 w-full border-collapse border border-black text-xs">
        <tbody>
          <tr className="font-bold">
            <td className="border border-black px-2 py-1.5">
              {report.isProfit ? "Net profit" : "Net loss"}
            </td>
            <td className="border border-black px-2 py-1.5 text-right tabular-nums">
              {formatMoney(report.netIncome)}
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
  section: IncomeStatementSection;
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
          <th className={printNumberHeadCell}>Amount</th>
        </tr>
        <tr className="bg-gray-50">
          <th className={printHeadCell}>Code</th>
          <th className={printHeadCell}>Account name</th>
          <th className={printHeadCell}>Account group</th>
          <th className={printNumberHeadCell}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {section.rows.length === 0 ? (
          <tr>
            <td className={printCell} colSpan={4}>
              No posted movement.
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
