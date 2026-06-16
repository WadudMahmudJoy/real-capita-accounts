"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ApiError,
  getProjectCostReport,
  toErrorMessage,
  type ProjectCostReport,
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

const CLASS_LABELS: Record<string, string> = {
  ASSET: "Project Asset / Capitalized Project Cost",
  EQUITY: "Equity",
  EXPENSE: "Project Expense",
  INCOME: "Project Income",
  LIABILITY: "Liability",
};

export default function ProjectCostPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<ProjectCostReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      const result = await getProjectCostReport(params);
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
        description="Summarize posted voucher lines tagged to a selected project, grouped by cost center, account class, group, and ledger. Asset and expense lines are shown separately so capitalized project cost is not confused with operating expense."
        title="Project Cost Report"
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
              description="A fiscal year and a project are required. The period, date range, cost center, ledger, account class, account group, and expense-only toggle are optional."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                config={{
                  requireProject: true,
                  showAccountClass: true,
                  showAccountGroup: true,
                  showExpenseOnly: true,
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
            <ProjectCostResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running project cost report..." />
          ) : (
            <Card>
              <EmptyState
                description="Select a project to view summarized project-tagged posted voucher lines."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function ProjectCostResult({ report }: { report: ProjectCostReport }) {
  const periodLabel = report.accountingPeriod
    ? report.accountingPeriod.name
    : "All periods in the fiscal year";

  const projectLedgerUrl = (() => {
    const params = new URLSearchParams();
    params.set("fiscalYearId", report.fiscalYear.id);
    params.set("projectId", report.project.id);
    if (report.costCenter) {
      params.set("costCenterId", report.costCenter.id);
    }
    return `/app/reports/project-ledger?${params.toString()}`;
  })();

  const metaItems: { label: string; value: React.ReactNode }[] = [
    { label: "Report", value: "Project Cost Report" },
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
      label: "Project",
      value: `${report.project.code} - ${report.project.name}`,
    },
    {
      label: "Cost center filter",
      value: report.costCenter
        ? `${report.costCenter.code} - ${report.costCenter.name}`
        : "All cost centers",
    },
    {
      label: "Expense only",
      value: report.filters.expenseOnly ? "Yes" : "No",
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
                label: "Total debit",
                value: formatMoney(report.totals.debitTotal),
              },
              {
                label: "Total credit",
                value: formatMoney(report.totals.creditTotal),
              },
              {
                emphasis: true,
                label: "Net movement",
                value: formatMoney(report.totals.netMovement),
              },
              {
                label: "Project expense",
                value: formatMoney(report.totals.expenseTotal),
              },
              {
                label: "Project asset / cap. cost",
                value: formatMoney(report.totals.assetProjectCostTotal),
              },
              {
                label: "Project income",
                value: formatMoney(report.totals.incomeTotal),
              },
              {
                label: "Liability total",
                value: formatMoney(report.totals.liabilityTotal),
              },
              {
                label: "Equity total",
                value: formatMoney(report.totals.equityTotal),
              },
              {
                label: "Voucher lines",
                value: String(report.lineCount),
              },
              {
                label: "Grouped rows",
                value: String(report.groupedRowCount),
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          description="This report summarizes posted voucher lines tagged to the selected project. Asset and Expense lines are shown separately so capitalized project cost is not confused with operating expense."
          title="Project cost summary"
        />

        {report.rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="No posted voucher lines match the selected project and filters."
              title="No project cost lines"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Cost center</th>
                  <th className="px-3 py-2.5">Account class</th>
                  <th className="px-3 py-2.5">Account group</th>
                  <th className="px-3 py-2.5">Ledger</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Net amount</th>
                  <th className="px-3 py-2.5">Last date</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, idx) => {
                  const isNewCostCenter =
                    idx === 0 ||
                    row.costCenterId !== report.rows[idx - 1].costCenterId;
                  const isNewClass =
                    idx === 0 ||
                    row.accountClass.code !==
                      report.rows[idx - 1].accountClass.code ||
                    isNewCostCenter;

                  const classLabel =
                    CLASS_LABELS[row.accountClass.code] ??
                    row.accountClass.name;

                  return (
                    <tr
                      className="border-b border-border/70 last:border-0"
                      key={idx}
                    >
                      <td
                        className={
                          "px-3 py-3 text-muted-foreground" +
                          (isNewCostCenter ? " font-semibold text-foreground" : "")
                        }
                      >
                        {row.costCenterCode
                          ? `${row.costCenterCode} - ${row.costCenterName}`
                          : row.costCenterId !== null
                            ? row.costCenterId
                            : "Unassigned"}
                      </td>
                      <td
                        className={
                          "px-3 py-3 text-muted-foreground" +
                          (isNewClass ? " font-semibold text-foreground" : "")
                        }
                        title={classLabel}
                      >
                        {classLabel}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.accountGroup.code} - {row.accountGroup.name}
                      </td>
                      <td
                        className="max-w-[180px] truncate px-3 py-3 text-muted-foreground"
                        title={`${row.ledgerAccount.code} - ${row.ledgerAccount.name}`}
                      >
                        <Link
                          className="text-primary underline hover:text-primary/80"
                          href={projectLedgerUrl}
                        >
                          {row.ledgerAccount.code}
                        </Link>{" "}
                        - {row.ledgerAccount.name}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.debitTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.creditTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.netAmount)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.lastTransactionDate
                          ? formatDate(row.lastTransactionDate)
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-3 py-3" colSpan={4}>
                    Totals ({report.groupedRowCount} grouped rows from{" "}
                    {report.lineCount} voucher lines)
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(report.totals.debitTotal)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(report.totals.creditTotal)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(report.totals.netMovement)}
                  </td>
                  <td className="px-3 py-3" />
                </tr>
              </tfoot>
            </table>

            <div className="mt-4">
              <Link
                className="text-sm text-primary underline hover:text-primary/80"
                href={projectLedgerUrl}
              >
                View detailed line entries in Project Ledger
              </Link>
            </div>
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
            label: "Project",
            value: `${report.project.code} - ${report.project.name}`,
          },
          {
            label: "Expense only",
            value: report.filters.expenseOnly ? "Yes" : "No",
          },
          {
            label: "Total debit",
            value: formatMoney(report.totals.debitTotal),
          },
          {
            label: "Total credit",
            value: formatMoney(report.totals.creditTotal),
          },
          {
            label: "Net movement",
            value: formatMoney(report.totals.netMovement),
          },
          {
            label: "Project expense",
            value: formatMoney(report.totals.expenseTotal),
          },
          {
            label: "Project asset / cap. cost",
            value: formatMoney(report.totals.assetProjectCostTotal),
          },
        ]}
        title="Project Cost Report"
      >
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className={printHeadCell}>Cost center</th>
              <th className={printHeadCell}>Account class</th>
              <th className={printHeadCell}>Account group</th>
              <th className={printHeadCell}>Ledger</th>
              <th className={printNumberHeadCell}>Debit</th>
              <th className={printNumberHeadCell}>Credit</th>
              <th className={printNumberHeadCell}>Net amount</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, idx) => (
              <tr key={idx}>
                <td className={printCell}>
                  {row.costCenterCode
                    ? `${row.costCenterCode} - ${row.costCenterName}`
                    : "Unassigned"}
                </td>
                <td className={printCell}>
                  {CLASS_LABELS[row.accountClass.code] ?? row.accountClass.name}
                </td>
                <td className={printCell}>
                  {row.accountGroup.code} - {row.accountGroup.name}
                </td>
                <td className={printCell}>
                  {row.ledgerAccount.code} - {row.ledgerAccount.name}
                </td>
                <td className={printNumberCell}>
                  {formatMoney(row.debitTotal)}
                </td>
                <td className={printNumberCell}>
                  {formatMoney(row.creditTotal)}
                </td>
                <td className={printNumberCell}>
                  {formatMoney(row.netAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-black px-2 py-1.5" colSpan={4}>
                Totals
              </td>
              <td className={printNumberCell}>
                {formatMoney(report.totals.debitTotal)}
              </td>
              <td className={printNumberCell}>
                {formatMoney(report.totals.creditTotal)}
              </td>
              <td className={printNumberCell}>
                {formatMoney(report.totals.netMovement)}
              </td>
            </tr>
          </tfoot>
        </table>
      </ReportPrintFrame>
    </div>
  );
}
