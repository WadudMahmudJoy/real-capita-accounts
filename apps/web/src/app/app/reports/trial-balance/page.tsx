"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  getTrialBalanceReport,
  toErrorMessage,
  type ReportQueryParams,
  type TrialBalanceReport,
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

export default function TrialBalanceReportPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      const result = await getTrialBalanceReport(params);
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
        description="Verify that posted debits and credits balance across all active ledger accounts for a fiscal year, period, or custom date range."
        title="Trial Balance"
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
            <TrialBalanceResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running trial balance..." />
          ) : (
            <Card>
              <EmptyState
                description="Choose a fiscal year, then run the report to verify the posted trial balance."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function TrialBalanceResult({ report }: { report: TrialBalanceReport }) {
  const { totals } = report;
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
              { label: "Report", value: "Trial Balance" },
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

          {totals.isBalanced ? (
            <Notice tone="success">
              The trial balance is balanced. Total closing debit equals total
              closing credit (difference {formatMoney(totals.difference)}).
            </Notice>
          ) : (
            <Notice tone="error">
              The trial balance is not balanced. Closing debit and closing
              credit differ by {formatMoney(totals.difference)}. Review the
              posted vouchers for the selected range.
            </Notice>
          )}

          <SummaryGrid
            stats={[
              {
                label: "Opening debit",
                value: formatMoney(totals.openingDebit),
              },
              {
                label: "Opening credit",
                value: formatMoney(totals.openingCredit),
              },
              { label: "Period debit", value: formatMoney(totals.periodDebit) },
              {
                label: "Period credit",
                value: formatMoney(totals.periodCredit),
              },
              {
                emphasis: true,
                label: "Closing debit",
                value: formatMoney(totals.closingDebit),
              },
              {
                emphasis: true,
                label: "Closing credit",
                value: formatMoney(totals.closingCredit),
              },
              { label: "Difference", value: formatMoney(totals.difference) },
              {
                label: "Balanced",
                value: totals.isBalanced ? "Yes" : "No",
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          description="Active ledger accounts with posted movement or a carried balance in the selected range."
          title="Account balances"
        />

        {report.rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="No posted ledger movement was found for the selected range. Opening, period, and closing totals are zero."
              title="No account balances"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Code</th>
                  <th className="px-3 py-2.5">Account name</th>
                  <th className="px-3 py-2.5">Group / class</th>
                  <th className="px-3 py-2.5 text-right">Opening debit</th>
                  <th className="px-3 py-2.5 text-right">Opening credit</th>
                  <th className="px-3 py-2.5 text-right">Period debit</th>
                  <th className="px-3 py-2.5 text-right">Period credit</th>
                  <th className="px-3 py-2.5 text-right">Closing debit</th>
                  <th className="px-3 py-2.5 text-right">Closing credit</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
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
                      {row.ledgerAccount.accountGroup.name} /{" "}
                      {row.ledgerAccount.accountGroup.accountClass.name}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(row.openingDebit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(row.openingCredit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(row.periodDebit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(row.periodCredit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(row.closingDebit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(row.closingCredit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-3 py-3 text-foreground" colSpan={3}>
                    Totals
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(totals.openingDebit)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(totals.openingCredit)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(totals.periodDebit)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(totals.periodCredit)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(totals.closingDebit)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground">
                    {formatMoney(totals.closingCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
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
            label: "Balanced",
            value: `${totals.isBalanced ? "Yes" : "No"} (difference ${formatMoney(totals.difference)})`,
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
        title="Trial Balance"
      >
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className={printHeadCell}>Code</th>
              <th className={printHeadCell}>Account name</th>
              <th className={printNumberHeadCell}>Closing debit</th>
              <th className={printNumberHeadCell}>Closing credit</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td className={printCell} colSpan={4}>
                  No posted ledger movement for the selected range.
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <tr key={row.ledgerAccount.id}>
                  <td className={printCell}>{row.ledgerAccount.code}</td>
                  <td className={printCell}>{row.ledgerAccount.name}</td>
                  <td className={printNumberCell}>
                    {formatMoney(row.closingDebit)}
                  </td>
                  <td className={printNumberCell}>
                    {formatMoney(row.closingCredit)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-black px-2 py-1.5" colSpan={2}>
                Totals
              </td>
              <td className={printNumberCell}>
                {formatMoney(totals.closingDebit)}
              </td>
              <td className={printNumberCell}>
                {formatMoney(totals.closingCredit)}
              </td>
            </tr>
          </tfoot>
        </table>
      </ReportPrintFrame>
    </div>
  );
}
