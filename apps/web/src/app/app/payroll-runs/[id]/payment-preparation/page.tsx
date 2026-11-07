"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, toErrorMessage } from "@/lib/api";
import { getPayrollRuns, type PayrollRunList } from "@/lib/payroll-documents-api";
import { getPayrollPaymentPreparation, type PaymentChannel, type PaymentPreparation } from "@/lib/payroll-payment-preparation-api";
import { LoadingPanel, Notice, PageIntro, Button } from "../../../_components/ui";
import { PayrollPaymentPreparationView } from "../../_components/payroll-payment-preparation-view";

type State = { key: string; data: PaymentPreparation; error?: never; selected: string[] } | { key: string; error: string; data?: never; selected?: never };
export default function PaymentPreparationPage() {
  const { id } = useParams<{ id: string }>(), router = useRouter();
  const [channel, setChannel] = useState<PaymentChannel>("BANK"), [source, setSource] = useState(""), [state, setState] = useState<State | null>(null);
  const [page, setPage] = useState(1), [runs, setRuns] = useState<{ page: number; data?: PayrollRunList; error?: string } | null>(null);
  const key = `${id}/${channel}/${source}`;
  useEffect(() => { const controller = new AbortController();
    void getPayrollRuns(page, controller.signal, "APPROVED").then(data => { if (!controller.signal.aborted) setRuns({ page, data }); }).catch((e: unknown) => { if (!controller.signal.aborted) setRuns({ page, error: toErrorMessage(e) }); });
    return () => controller.abort();
  }, [page]);
  useEffect(() => { const controller = new AbortController();
    void getPayrollPaymentPreparation(id, channel, source, controller.signal).then(data => { if (!controller.signal.aborted) setState({ key, data, selected: data.rows.filter(r => r.selectable).map(r => r.employeeId) }); }).catch((e: unknown) => {
      if (controller.signal.aborted) return; setState({ key, error: toErrorMessage(e) }); if (e instanceof ApiError && e.isUnauthorized) router.replace("/login");
    }); return () => controller.abort();
  }, [id, channel, source, key, router]);
  const ready = state?.key === key && state.data ? state : null;
  return <div className="space-y-5"><PageIntro title="Salary payment preparation" description="Review approved historical allocations. No salary payments or accounting vouchers are recorded here." /><Link className="text-sm underline" href="/app/payroll-runs">Payroll runs</Link>
    <div className="flex flex-wrap gap-3"><label className="text-sm">Approved payroll month
      <select value={id} onChange={e => { setSource(""); router.push(`/app/payroll-runs/${encodeURIComponent(e.target.value)}/payment-preparation`); }} className="ml-2 rounded-md border border-input bg-input-surface p-2">
        {!(runs?.page === page && runs.data?.items.some(r => r.id === id)) && <option value={id}>{ready ? `${String(ready.data.month).padStart(2, "0")}/${ready.data.year}` : "Selected payroll"}</option>}
        {runs?.page === page && runs.data?.items.map(r => <option key={r.id} value={r.id}>{String(r.month).padStart(2, "0")}/{r.year}</option>)}
      </select></label>
      <Button variant="secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous months</Button><Button variant="secondary" disabled={!runs?.data || runs.page !== page || page * runs.data.pageSize >= runs.data.total} onClick={() => setPage(p => p + 1)}>More months</Button>
    </div>
    {(!runs || runs.page !== page) ? <p className="text-sm">Loading approved payroll months...</p> : runs.error ? <Notice tone="error">{runs.error}</Notice> : !runs.data?.items.length ? <p>No approved payroll months found.</p> : null}
    <div className="flex gap-3" role="group" aria-label="Payment channel">{(["BANK", "CASH"] as const).map(c => <Button key={c} variant={channel === c ? "primary" : "secondary"} aria-pressed={channel === c} onClick={() => { setChannel(c); setSource(""); }}>{c === "BANK" ? "Bank Payment" : "Cash Payment"}</Button>)}</div>
    {!state || state.key !== key ? <LoadingPanel message="Loading planned allocations..." /> : ready ? <PayrollPaymentPreparationView data={ready.data} selected={ready.selected} sourceAccountId={source} onSource={setSource} onSelection={(employeeId, checked) => setState(current => current?.data && current.key === key ? { ...current, selected: checked ? [...new Set([...current.selected, employeeId])] : current.selected.filter(id => id !== employeeId) } : current)} /> : <div className="space-y-3"><Notice tone="error">Preparation unavailable: {state.error}</Notice>{source && <Button variant="secondary" onClick={() => setSource("")}>Clear proposed account</Button>}</div>}
  </div>;
}
