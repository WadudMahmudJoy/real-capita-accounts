"use client";
import {Permit} from "../_components/permission-controls";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, toErrorMessage } from "@/lib/api";
import { getPayrollRuns, type PayrollRunList } from "@/lib/payroll-documents-api";
import { LoadingPanel, Notice, PageIntro, Field, TextInput, Select } from "../_components/ui";
import { PayrollRunListView } from "./_components/payroll-run-list-view";

type State = { page: number; data: PayrollRunList; error?: never } | { page: number; error: string; data?: never };
export default function PayrollRunsPage() {
  const router = useRouter(), [page, setPage] = useState(1), [state, setState] = useState<State | null>(null);
  const [year,setYear]=useState(""),[month,setMonth]=useState(""),[filter,setFilter]=useState("ALL");
  useEffect(() => {
    const controller = new AbortController();
    void getPayrollRuns(page, controller.signal, filter === "ALL" ? undefined : filter as "DRAFT" | "APPROVED", {year: year ? Number(year) : undefined, month: month ? Number(month) : undefined}).then(data => { if (!controller.signal.aborted) setState({ page, data }); }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setState({ page, error: toErrorMessage(error) });
      if (error instanceof ApiError && error.isUnauthorized) router.replace("/login");
    });
    return () => controller.abort();
  }, [page, router, year, month, filter]);
  return <div className="space-y-6"><PageIntro title="Payroll runs" description="Centralized payroll records. Salary sheets and employee payslips are available after approval; approval does not confirm payment." />
    <Permit code="payroll.preview"><Link className="inline-block rounded-lg bg-primary px-4 py-2 text-primary-foreground" href="/app/payroll-runs/new">New monthly payroll</Link></Permit>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field htmlFor="history-year" label="Payroll year filter"><TextInput id="history-year" type="number" min={1} max={9999} value={year} onChange={e=>{setYear(e.target.value);setPage(1);setState(null);}} placeholder="All years"/></Field>
      <Field htmlFor="history-month" label="Payroll month filter"><Select id="history-month" value={month} onChange={e=>{setMonth(e.target.value);setPage(1);setState(null);}}><option value="">All months</option>{Array.from({length:12},(_,i)=><option key={i} value={String(i+1)}>{String(i+1).padStart(2,"0")}</option>)}</Select></Field>
      <Field htmlFor="history-status" label="Payroll status"><Select id="history-status" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);setState(null);}}><option value="ALL">All statuses</option><option value="DRAFT">DRAFT</option><option value="APPROVED">APPROVED</option></Select></Field>
    </div>
    {!state || state.page !== page ? <LoadingPanel message="Loading payroll runs..." /> : state.data ? <PayrollRunListView data={state.data} onPage={setPage} /> : <Notice tone="error">{state.error}</Notice>}
  </div>;
}
