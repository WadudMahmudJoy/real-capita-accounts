"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, toErrorMessage } from "@/lib/api";
import { getPayrollPayslip, getPayrollSalarySheet, type PayrollPayslip, type PayrollSalarySheet } from "@/lib/payroll-documents-api";
import { LoadingPanel, Notice } from "../../_components/ui";
import { PrintReportButton } from "../../reports/_lib/report-print";
import { PayrollPayslipView, PayrollSalarySheetView } from "./payroll-document-view";

type State = { key: string; status: "ready"; data: PayrollPayslip | PayrollSalarySheet } | { key: string; status: "error"; message: string };
export function PayrollDocumentWorkspace({ runId, employeeId }: { runId: string; employeeId?: string }) {
  const router = useRouter(), key = `${runId}/${employeeId ?? "sheet"}`;
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = employeeId ? getPayrollPayslip(runId, employeeId, controller.signal) : getPayrollSalarySheet(runId, controller.signal);
    void load.then(data => { if (!controller.signal.aborted) setState({ key, status: "ready", data }); }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState({ key, status: "error", message: toErrorMessage(error) });
      if (error instanceof ApiError && error.isUnauthorized) router.replace("/login");
    });
    return () => controller.abort();
  }, [runId, employeeId, key, router]);
  if (!state || state.key !== key) return <LoadingPanel message="Loading approved payroll document..." />;
  if (state.status === "error") return <div className="space-y-4"><Link href="/app/payroll-runs" className="text-sm underline">Payroll runs</Link><Notice tone="error">Document unavailable: {state.message}</Notice></div>;
  return <div className="space-y-5"><div className="payroll-no-print flex items-center justify-between gap-4">
    <div className="flex flex-wrap gap-4"><Link href="/app/payroll-runs" className="text-sm underline">Payroll runs</Link>{employeeId ? <Link href={`/app/payroll-runs/${encodeURIComponent(runId)}/salary-sheet`} className="text-sm underline">Monthly salary sheet</Link> : <p className="text-sm text-muted-foreground">Approved payroll statement</p>}</div>
    <PrintReportButton label={employeeId ? "Print payslip" : "Print salary sheet"} />
  </div>{employeeId ? <PayrollPayslipView data={state.data as PayrollPayslip} /> : <PayrollSalarySheetView data={state.data as PayrollSalarySheet} />}</div>;
}
