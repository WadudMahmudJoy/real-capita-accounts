"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ApiError,
  getProjectFinancialSummaryReport,
  toErrorMessage,
  type ProjectFinancialSummaryReport,
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
  EQUITY: "Project Equity",
  EXPENSE: "Project Expense",
  INCOME: "Project Income",
  LIABILITY: "Project Liability",
};

export default function ProjectFinancialSummaryPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] =
    useState<ProjectFinancialSummaryReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      const result = await getProjectFinancialSummaryReport(params);
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
        description="Management-level financial summary for a selected project. Summarizes posted project-tagged voucher lines by account class and provides a compact cost-center breakdown."
        title="Project Financial Summary"
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
              description="A fiscal year and a project are required. The period, date range, cost center, ledger account, account class, and account group are optional."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                config={{
                  requireProject: true,
                  showAccountClass: true,
                  showAccountGroup: true,
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
            <ProjectFinancialSummaryResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running project financial summary report..." />
          ) : (
            <Card>
              <EmptyState
                description="Select a project to view financial summary for posted project-tagged voucher lines."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function ProjectFinancialSummaryResult({
  report,
}: {
  report: ProjectFinancialSummaryReport;
}) {
  const periodLabel = report.accountingPeriod
    ? report.accountingPeriod.name
    : "All periods in the fiscal year";

  const projectLedgerUrl = (() => {
    const params = new URLSearchParams();
    params.set("fiscalYearId", report.fiscalYear.id);
    params.set("projectId", report.project.id);
    return `/app/reports/project-ledger?${params.toString()}`;
  })();

  const projectCostUrl = (() => {
    const params = new URLSearchParams();
    params.set("fiscalYearId", report.fiscalYear.id);
    params.set("projectId", report.project.id);
    return `/app/reports/project-cost?${params.toString()}`;
  })();

  function projectLedgerUrlForCostCenter(costCenterId: string) {
    const params = new URLSearchParams();
    params.set("fiscalYearId", report.fiscalYear.id);
    params.set("projectId", report.project.id);
    params.set("costCenterId", costCenterId);
    return `/app/reports/project-ledger?${params.toString()}`;
  }

  function projectLedgerUrlForLedger(ledgerAccountId: string) {
    const params = new URLSearchParams();
    params.set("fiscalYearId", report.fiscalYear.id);
    params.set("projectId", report.project.id);
    params.set("ledgerAccountId", ledgerAccountId);
    return `/app/reports/project-ledger?${params.toString()}`;
  }

  const metaItems: { label: string; value: React.ReactNode }[] = [
    { label: "Report", value: "Project Financial Summary" },
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
      value: report.filters.costCenter
        ? `${report.filters.costCenter.code} - ${report.filters.costCenter.name}`
        : "All cost centers",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
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
                label: "Project cost total",
                value: formatMoney(
                  report.managementTotals.projectCostTotal,
                ),
              },
              {
                label: "Project expense",
                value: formatMoney(
                  report.managementTotals.projectExpenseTotal,
                ),
              },
              {
                label: "Project asset / cap. cost",
                value: formatMoney(
                  report.managementTotals.projectAssetCostTotal,
                ),
              },
              {
                label: "Project income",
                value: formatMoney(
                  report.managementTotals.projectIncomeTotal,
                ),
              },
              {
                label: "Voucher lines",
                value: String(report.totals.lineCount),
              },
            ]}
          />
        </div>
      </Card>

      {/* Help text */}
      <Card>
        <CardHeader title="About this report" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          This report summarizes posted voucher lines tagged to the selected
          project. Asset and Expense lines are shown separately so capitalized
          project cost is not confused with operating expense. Cash/bank/MFS
          lines appear only when those voucher lines themselves carry project
          metadata.
        </p>
      </Card>

      {/* A. Account Class Breakdown */}
      <Card>
        <CardHeader
          description="Breakdown of project-tagged posted voucher lines by the five accounting classes."
          title="Account class breakdown"
        />

        {report.classBreakdown.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="No posted voucher lines match the selected project and filters."
              title="No account class data"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Account class</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Net movement</th>
                  <th className="px-3 py-2.5 text-right">Lines</th>
                </tr>
              </thead>
              <tbody>
                {report.classBreakdown.map((row) => {
                  const classLabel =
                    CLASS_LABELS[row.accountClass.code] ??
                    row.accountClass.name;
                  const isAssetOrExpense =
                    row.accountClass.code === "ASSET" ||
                    row.accountClass.code === "EXPENSE";

                  return (
                    <tr
                      className="border-b border-border/70 last:border-0"
                      key={row.accountClass.code}
                    >
                      <td
                        className={
                          "px-3 py-3" +
                          (isAssetOrExpense
                            ? " font-semibold text-foreground"
                            : " text-muted-foreground")
                        }
                        title={classLabel}
                      >
                        {classLabel}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.debitTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.creditTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.netMovement)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {row.lineCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-3 py-3">
                    Totals ({report.classBreakdown.length} account classes)
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
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {report.totals.lineCount}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* B. Cost Center Breakdown */}
      <Card>
        <CardHeader
          description="Project-tagged posted voucher lines grouped by cost center. Lines without a cost center are shown as Unassigned."
          title="Cost center breakdown"
        />

        {report.costCenterBreakdown.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="No cost center data for the selected project and filters."
              title="No cost center data"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Cost center</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Net movement</th>
                  <th className="px-3 py-2.5 text-right">Expense</th>
                  <th className="px-3 py-2.5 text-right">
                    Asset / cap. cost
                  </th>
                  <th className="px-3 py-2.5 text-right">Lines</th>
                  <th className="px-3 py-2.5">Last date</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {report.costCenterBreakdown.map((row, idx) => {
                  const isUnassigned = row.costCenterId === null;
                  const drillDownUrl = isUnassigned
                    ? projectLedgerUrl
                    : projectLedgerUrlForCostCenter(row.costCenterId!);

                  return (
                    <tr
                      className="border-b border-border/70 last:border-0"
                      key={idx}
                    >
                      <td
                        className={
                          "px-3 py-3" +
                          (isUnassigned
                            ? " italic text-muted-foreground"
                            : " text-muted-foreground")
                        }
                      >
                        {row.costCenterCode
                          ? `${row.costCenterCode} - ${row.costCenterName}`
                          : "Unassigned"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.debitTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.creditTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.netMovement)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.expenseTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.assetProjectCostTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {row.lineCount}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.lastTransactionDate
                          ? formatDate(row.lastTransactionDate)
                          : "-"}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          className="text-sm text-primary underline hover:text-primary/80"
                          href={drillDownUrl}
                        >
                          View ledger
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-3 py-3">
                    Totals ({report.costCenterBreakdown.length} cost
                    center rows)
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
                  <td className="px-3 py-3" colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* C. Top Ledger Movement */}
      {report.topLedgerBreakdown.length > 0 ? (
        <Card>
          <CardHeader
            description="Top 10 ledger accounts by absolute net movement."
            title="Top ledger movement"
          />

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Ledger</th>
                  <th className="px-3 py-2.5">Account class</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Net movement</th>
                  <th className="px-3 py-2.5 text-right">Lines</th>
                </tr>
              </thead>
              <tbody>
                {report.topLedgerBreakdown.map((row) => {
                  const classLabel = row.accountClassCode
                    ? (CLASS_LABELS[row.accountClassCode] ??
                      row.accountClassName)
                    : "-";

                  return (
                    <tr
                      className="border-b border-border/70 last:border-0"
                      key={row.ledgerAccountId}
                    >
                      <td
                        className="max-w-[180px] truncate px-3 py-3 text-muted-foreground"
                        title={`${row.ledgerCode} - ${row.ledgerName}`}
                      >
                        <Link
                          className="text-primary underline hover:text-primary/80"
                          href={projectLedgerUrlForLedger(
                            row.ledgerAccountId,
                          )}
                        >
                          {row.ledgerCode}
                        </Link>{" "}
                        - {row.ledgerName}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {classLabel}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.debitTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.creditTotal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-foreground">
                        {formatMoney(row.netMovement)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {row.lineCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Drill-down links */}
      <div className="flex flex-wrap gap-4">
        <Link
          className="text-sm text-primary underline hover:text-primary/80"
          href={projectLedgerUrl}
        >
          View detailed line entries in Project Ledger
        </Link>
        <Link
          className="text-sm text-primary underline hover:text-primary/80"
          href={projectCostUrl}
        >
          View Project Cost Report
        </Link>
      </div>

      {/* Print layout */}
      <ReportPrintFrame
          ownerCompany={report.fiscalYear.company}
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
            value: formatMoney(report.managementTotals.projectExpenseTotal),
          },
          {
            label: "Project asset / cap. cost",
            value: formatMoney(
              report.managementTotals.projectAssetCostTotal,
            ),
          },
          {
            label: "Project income",
            value: formatMoney(report.managementTotals.projectIncomeTotal),
          },
          {
            label: "Voucher lines",
            value: String(report.totals.lineCount),
          },
        ]}
        title="Project Financial Summary"
      >
        <div className="mb-4">
          <h3 className="text-sm font-semibold">
            Account Class Breakdown
          </h3>
          <table className="mt-2 w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className={printHeadCell}>Account class</th>
                <th className={printNumberHeadCell}>Debit</th>
                <th className={printNumberHeadCell}>Credit</th>
                <th className={printNumberHeadCell}>Net movement</th>
                <th className={printNumberHeadCell}>Lines</th>
              </tr>
            </thead>
            <tbody>
              {report.classBreakdown.map((row) => (
                <tr key={row.accountClass.code}>
                  <td className={printCell}>
                    {CLASS_LABELS[row.accountClass.code] ??
                      row.accountClass.name}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.debitTotal)}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.creditTotal)}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.netMovement)}
                  </td>
                  <td className={printNumberCell}>{row.lineCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold">
            Cost Center Breakdown
          </h3>
          <table className="mt-2 w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className={printHeadCell}>Cost center</th>
                <th className={printNumberHeadCell}>Debit</th>
                <th className={printNumberHeadCell}>Credit</th>
                <th className={printNumberHeadCell}>Net movement</th>
                <th className={printNumberHeadCell}>Expense</th>
                <th className={printNumberHeadCell}>Asset / cap.</th>
                <th className={printNumberHeadCell}>Lines</th>
              </tr>
            </thead>
            <tbody>
              {report.costCenterBreakdown.map((row, idx) => (
                <tr key={idx}>
                  <td className={printCell}>
                    {row.costCenterCode
                      ? `${row.costCenterCode} - ${row.costCenterName}`
                      : "Unassigned"}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.debitTotal)}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.creditTotal)}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.netMovement)}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.expenseTotal)}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.assetProjectCostTotal)}
                  </td>
                  <td className={printNumberCell}>{row.lineCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportPrintFrame>
    </div>
  );
}
