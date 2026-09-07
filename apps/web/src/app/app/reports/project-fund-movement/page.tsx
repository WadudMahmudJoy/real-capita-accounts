"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ApiError,
  getProjectFundMovementReport,
  toErrorMessage,
  type ProjectFundMovementReport,
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

export default function ProjectFundMovementPage() {
  const router = useRouter();
  const references = useReportReferences();
  const [report, setReport] = useState<ProjectFundMovementReport | null>(null);
  const [runState, setRunState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [runError, setRunError] = useState<string | null>(null);

  async function runReport(params: ReportQueryParams) {
    setRunState("loading");
    setRunError(null);

    // Omit voucherType=ALL to prevent DTO errors on backend
    const cleanParams = { ...params };
    if (cleanParams.voucherType === "ALL") {
      delete cleanParams.voucherType;
    }

    try {
      const result = await getProjectFundMovementReport(cleanParams);
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
        description="Show project-wise fund movement through Cash, Bank, and MFS, based only on cash/bank/MFS voucher lines explicitly tagged with the selected project."
        title="Project Fund Movement View"
      />

      <Notice tone="info">
        <strong>Important:</strong> This view does not infer project movement from sibling voucher lines.
      </Notice>

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
              description="A fiscal year and a project are required. Filters for date range, account type, cost center, and voucher type are optional."
              title="Report filters"
            />
            <div className="mt-6">
              <ReportFilters
                config={{
                  requireProject: true,
                  showAccountType: true,
                  showVoucherType: true,
                  showCashBankAccount: true,
                  advancedProjectCostCenter: true,
                }}
                onRun={runReport}
                pending={runState === "loading"}
                reference={references.reference}
              />
            </div>
          </Card>

          {runError ? <Notice tone="error">{runError}</Notice> : null}

          {report ? (
            <ProjectFundMovementResult report={report} />
          ) : runState === "loading" ? (
            <LoadingPanel message="Running project fund movement report..." />
          ) : (
            <Card>
              <EmptyState
                description="Select a project to view project-tagged fund movement."
                title="No report yet"
              />
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}

function ProjectFundMovementResult({ report }: { report: ProjectFundMovementReport }) {
  const periodLabel = report.accountingPeriod
    ? report.accountingPeriod.name
    : "All periods in the fiscal year";

  const accountTypeLabel = (type: string) => {
    switch (type) {
      case "CASH":
        return "Cash Only";
      case "BANK":
        return "Bank Only";
      case "MFS":
        return "MFS Only";
      default:
        return "All Fund Accounts";
    }
  };

  const metaItems: { label: string; value: React.ReactNode }[] = [
    { label: "Report", value: "Project Fund Movement View" },
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
      label: "Account Type filter",
      value: accountTypeLabel(report.filters.accountType),
    },
    {
      label: "Voucher Type filter",
      value: report.filters.voucherType !== "ALL"
        ? voucherTypeLabel(report.filters.voucherType as Parameters<typeof voucherTypeLabel>[0])
        : "All voucher types",
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
                label: "Period inflow (debit)",
                value: formatMoney(report.periodDebit),
              },
              {
                label: "Period outflow (credit)",
                value: formatMoney(report.periodCredit),
              },
              {
                emphasis: true,
                label: "Closing balance",
                value: formatBalance(report.closingBalance),
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
          description="Only cash/bank/MFS lines explicitly tagged with the selected project are included. Values represent inflow (debits) and outflow (credits) of money."
          title="Project fund movement lines"
        />

        {report.lines.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              description="No project fund movement lines found. This report follows strict same-line tracking: only Cash, Bank, or MFS voucher lines that are explicitly tagged with the selected project are shown. If a voucher tags only the expense line but not the cash/bank/MFS line, it will not appear here."
              title="No project fund movement lines"
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Voucher no.</th>
                  <th className="px-3 py-2.5">Voucher type</th>
                  <th className="px-3 py-2.5">Fund ledger</th>
                  <th className="px-3 py-2.5">Cash/bank/mfs account</th>
                  <th className="px-3 py-2.5">Project</th>
                  <th className="px-3 py-2.5">Cost center</th>
                  <th className="px-3 py-2.5">Particular / Narration</th>
                  <th className="px-3 py-2.5 text-right">Inflow</th>
                  <th className="px-3 py-2.5 text-right">Outflow</th>
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
                      {formatDate(line.date)}
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">
                      <Link
                        className="text-primary underline hover:text-primary/80"
                        href={`/app/vouchers/${line.voucherId}`}
                      >
                        {line.voucherNo}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {voucherTypeLabel(line.voucherType)}
                    </td>
                    <td
                      className="max-w-[140px] truncate px-3 py-3 text-muted-foreground"
                      title={`${line.ledgerCode} - ${line.ledgerName}`}
                    >
                      {line.ledgerCode} - {line.ledgerName}
                    </td>
                    <td
                      className="max-w-[140px] truncate px-3 py-3 text-muted-foreground"
                      title={line.cashBankAccountName ?? "-"}
                    >
                      {line.cashBankAccountName ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.projectCode
                        ? `${line.projectCode} - ${line.projectName}`
                        : "-"}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {line.costCenterCode
                        ? `${line.costCenterCode} - ${line.costCenterName}`
                        : "-"}
                    </td>
                    <td
                      className="max-w-[180px] truncate px-3 py-3 text-muted-foreground"
                      title={line.particular}
                    >
                      {line.particular}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(line.inflow)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(line.outflow)}
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
            label: "Account Type filter",
            value: accountTypeLabel(report.filters.accountType),
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
            label: "Line count",
            value: String(report.lineCount),
          },
        ]}
        title="Project Fund Movement View"
      >
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className={printHeadCell}>Date</th>
              <th className={printHeadCell}>Voucher no.</th>
              <th className={printHeadCell}>Type</th>
              <th className={printHeadCell}>Ledger</th>
              <th className={printHeadCell}>Account</th>
              <th className={printHeadCell}>Cost center</th>
              <th className={printHeadCell}>Description</th>
              <th className={printNumberHeadCell}>Inflow</th>
              <th className={printNumberHeadCell}>Outflow</th>
              <th className={printNumberHeadCell}>Running balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={printCell} colSpan={9}>
                Opening balance
              </td>
              <td className={printNumberCell}>
                {formatBalance(report.openingBalance)}
              </td>
            </tr>
            {report.lines.map((line) => (
              <tr key={line.id}>
                <td className={printCell}>{formatDate(line.date)}</td>
                <td className={printCell}>{line.voucherNo}</td>
                <td className={printCell}>
                  {voucherTypeLabel(line.voucherType)}
                </td>
                <td className={printCell}>
                  {line.ledgerCode} - {line.ledgerName}
                </td>
                <td className={printCell}>{line.cashBankAccountName ?? "-"}</td>
                <td className={printCell}>
                  {line.costCenterCode
                    ? `${line.costCenterCode} - ${line.costCenterName}`
                    : "-"}
                </td>
                <td className={printCell}>{line.particular}</td>
                <td className={printNumberCell}>{formatMoney(line.inflow)}</td>
                <td className={printNumberCell}>{formatMoney(line.outflow)}</td>
                <td className={printNumberCell}>
                  {formatBalance(line.runningBalance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-black px-2 py-1.5" colSpan={7}>
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
