"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ApiError,
  getCostCenterSummaryReport,
  toErrorMessage,
  type CostCenterSummaryReport,
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

export default function CostCenterSummaryPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<CostCenterSummaryReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      const result = await getCostCenterSummaryReport(params);
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
        description="Summarize posted voucher lines by cost center for a selected project. Lines without a cost center are shown as Unassigned."
        title="Cost Center Summary"
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
            <CostCenterSummaryResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running cost center summary report..." />
          ) : (
            <Card>
              <EmptyState
                description="Select a project to view cost-center-wise posted voucher-line totals."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function CostCenterSummaryResult({
  report,
}: {
  report: CostCenterSummaryReport;
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

  function projectLedgerUrlForCostCenter(costCenterId: string) {
    const params = new URLSearchParams();
    params.set("fiscalYearId", report.fiscalYear.id);
    params.set("projectId", report.project.id);
    params.set("costCenterId", costCenterId);
    return `/app/reports/project-ledger?${params.toString()}`;
  }

  const metaItems: { label: string; value: React.ReactNode }[] = [
    { label: "Report", value: "Cost Center Summary" },
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
                emphasis: false,
                label: "Voucher lines",
                value: String(report.totals.lineCount),
              },
              {
                emphasis: false,
                label: "Cost centers",
                value: String(report.totals.costCenterCount),
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          description="This report summarizes posted voucher lines by cost center for the selected project. Lines without a cost center are shown as Unassigned."
          title="Cost center totals"
        />

        {report.rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="No posted voucher lines match the selected project and filters."
              title="No cost center summary lines"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Cost center code</th>
                  <th className="px-3 py-2.5">Cost center name</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Net movement</th>
                  <th className="px-3 py-2.5 text-right">Project expense</th>
                  <th className="px-3 py-2.5 text-right">Project asset / cap. cost</th>
                  <th className="px-3 py-2.5 text-right">Voucher lines</th>
                  <th className="px-3 py-2.5">Last transaction date</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, idx) => {
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
                          "px-3 py-3 text-muted-foreground" +
                          (isUnassigned ? " italic" : "")
                        }
                      >
                        {row.costCenterCode ?? "Unassigned"}
                      </td>
                      <td
                        className={
                          "px-3 py-3 text-muted-foreground" +
                          (isUnassigned ? " italic" : "")
                        }
                      >
                        {row.costCenterName ?? "Lines without a cost center"}
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
                  <td className="px-3 py-3" colSpan={2}>
                    Totals ({report.totals.costCenterCount} cost centers,{" "}
                    {report.totals.lineCount} voucher lines
                    {report.totals.unassignedLineCount > 0
                      ? `, ${report.totals.unassignedLineCount} unassigned`
                      : ""}
                    )
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
                    {formatMoney(report.totals.expenseTotal)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(report.totals.assetProjectCostTotal)}
                  </td>
                  <td className="px-3 py-3" colSpan={3} />
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
            label: "Cost centers",
            value: String(report.totals.costCenterCount),
          },
          {
            label: "Voucher lines",
            value: String(report.totals.lineCount),
          },
        ]}
        title="Cost Center Summary"
      >
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className={printHeadCell}>Cost center code</th>
              <th className={printHeadCell}>Cost center name</th>
              <th className={printNumberHeadCell}>Debit</th>
              <th className={printNumberHeadCell}>Credit</th>
              <th className={printNumberHeadCell}>Net movement</th>
              <th className={printNumberHeadCell}>Project expense</th>
              <th className={printNumberHeadCell}>Project asset / cap. cost</th>
              <th className={printNumberHeadCell}>Lines</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row, idx) => (
              <tr key={idx}>
                <td className={printCell}>
                  {row.costCenterCode ?? "Unassigned"}
                </td>
                <td className={printCell}>
                  {row.costCenterName ?? "Lines without a cost center"}
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
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-black px-2 py-1.5" colSpan={2}>
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
              <td className={printNumberCell}>
                {formatMoney(report.totals.expenseTotal)}
              </td>
              <td className={printNumberCell}>
                {formatMoney(report.totals.assetProjectCostTotal)}
              </td>
              <td className={printNumberCell}>
                {report.totals.lineCount}
              </td>
            </tr>
          </tfoot>
        </table>
      </ReportPrintFrame>
    </div>
  );
}
