"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ApiError,
  getProjectLedgerReport,
  toErrorMessage,
  type ProjectLedgerReport,
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

export default function ProjectLedgerPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<ProjectLedgerReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    try {
      const result = await getProjectLedgerReport(params);
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
        description="Review every posted voucher line tagged to a selected project, with optional cost center, ledger account, and voucher type filters."
        title="Project Ledger"
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
              description="A fiscal year and a project are required. The period, date range, cost center, ledger account, and voucher type are optional."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                config={{
                  requireProject: true,
                  showLedgerAccount: true,
                  showVoucherType: true,
                }}
                onRun={runReport}
                pending={runState === "loading"}
                reference={references.reference}
              />
            </div>
          </Card>

          {runError ? <Notice tone="error">{runError}</Notice> : null}

          {report ? (
            <ProjectLedgerResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running project ledger report..." />
          ) : (
            <Card>
              <EmptyState
                description="Select a project to view project-tagged posted voucher lines."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function ProjectLedgerResult({ report }: { report: ProjectLedgerReport }) {
  const periodLabel = report.accountingPeriod
    ? report.accountingPeriod.name
    : "All periods in the fiscal year";

  const metaItems: { label: string; value: React.ReactNode }[] = [
    { label: "Report", value: "Project Ledger" },
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
      label: "Ledger account filter",
      value: report.filters.ledgerAccount
        ? report.filters.ledgerAccount
        : "All ledger accounts",
    },
    {
      label: "Voucher type filter",
      value: report.filters.voucherType
        ? voucherTypeLabel(report.filters.voucherType as Parameters<typeof voucherTypeLabel>[0])
        : "All voucher types",
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
                value: formatMoney(report.openingBalance),
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
                emphasis: true,
                label: "Net movement",
                value: formatMoney(report.totals.netMovement),
              },
              {
                emphasis: false,
                label: "Line count",
                value: String(report.lineCount),
              },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          description="Posted lines are ordered by voucher date, then voucher number and line number. Only posted voucher lines tagged with the selected project are shown."
          title="Project ledger lines"
        />

        {report.lines.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="No posted voucher lines are tagged to the selected project with the current filters."
              title="No project ledger lines"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Voucher no.</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Ledger</th>
                  <th className="px-3 py-2.5">Account class</th>
                  <th className="px-3 py-2.5">Cost center</th>
                  <th className="px-3 py-2.5">Narration / description</th>
                  <th className="px-3 py-2.5 text-right">Debit</th>
                  <th className="px-3 py-2.5 text-right">Credit</th>
                  <th className="px-3 py-2.5 text-right">Running net</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line) => (
                  <tr
                    className="border-b border-border/70 last:border-0"
                    key={line.id}
                  >
                    <td className="px-3 py-3 text-muted-foreground">
                      {formatDate(line.date)}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">
                      <Link
                        className="text-primary underline hover:text-primary/80"
                        href={`/app/vouchers/${line.voucherId}`}
                      >
                        {line.systemVoucherNo}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {voucherTypeLabel(line.voucherType)}
                    </td>
                    <td
                      className="max-w-[160px] truncate px-3 py-3 text-muted-foreground"
                      title={`${line.ledgerCode} - ${line.ledgerName}`}
                    >
                      {line.ledgerCode} - {line.ledgerName}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.accountClass.name}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.costCenterCode
                        ? `${line.costCenterCode} - ${line.costCenterName}`
                        : "-"}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-3 py-3 text-muted-foreground"
                      title={
                        (line.narration ?? "") +
                        (line.lineDescription ? " / " + line.lineDescription : "")
                      }
                    >
                      {line.narration ?? "-"}
                      {line.lineDescription
                        ? ` / ${line.lineDescription}`
                        : ""}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(line.debit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(line.credit)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(line.runningBalance)}
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
            label: "Project",
            value: `${report.project.code} - ${report.project.name}`,
          },
          {
            label: "Opening balance",
            value: formatMoney(report.openingBalance),
          },
          {
            label: "Net movement",
            value: formatMoney(report.totals.netMovement),
          },
          {
            label: "Line count",
            value: String(report.lineCount),
          },
        ]}
        title="Project Ledger"
      >
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className={printHeadCell}>Date</th>
              <th className={printHeadCell}>Voucher no.</th>
              <th className={printHeadCell}>Type</th>
              <th className={printHeadCell}>Ledger</th>
              <th className={printHeadCell}>Cost center</th>
              <th className={printHeadCell}>Description</th>
              <th className={printNumberHeadCell}>Debit</th>
              <th className={printNumberHeadCell}>Credit</th>
              <th className={printNumberHeadCell}>Running net</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={printCell} colSpan={8}>
                Opening balance
              </td>
              <td className={printNumberCell}>
                {formatMoney(report.openingBalance)}
              </td>
            </tr>
            {report.lines.map((line) => (
              <tr key={line.id}>
                <td className={printCell}>{formatDate(line.date)}</td>
                <td className={printCell}>{line.systemVoucherNo}</td>
                <td className={printCell}>
                  {voucherTypeLabel(line.voucherType)}
                </td>
                <td className={printCell}>
                  {line.ledgerCode} - {line.ledgerName}
                </td>
                <td className={printCell}>
                  {line.costCenterCode
                    ? `${line.costCenterCode} - ${line.costCenterName}`
                    : "-"}
                </td>
                <td className={printCell}>
                  {line.narration ?? "-"}
                  {line.lineDescription ? ` / ${line.lineDescription}` : ""}
                </td>
                <td className={printNumberCell}>{formatMoney(line.debit)}</td>
                <td className={printNumberCell}>{formatMoney(line.credit)}</td>
                <td className={printNumberCell}>
                  {formatMoney(line.runningBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-black px-2 py-1.5" colSpan={6}>
                Period movement / net movement
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
