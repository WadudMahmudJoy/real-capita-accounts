"use client";
import {Permit} from "../../_components/permission-controls";
import * as React from "react";
import type { PayrollRunList } from "../../../../lib/payroll-documents-api";

export function PayrollRunListView({ data, onPage }: { data: PayrollRunList; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <section className="rounded-xl border border-border bg-card p-6 shadow-sm" aria-label="Payroll runs">
    {data.items.length === 0 ? <p className="text-muted-foreground">No payroll runs found.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr className="border-b border-border"><th className="p-3" scope="col">Payroll month</th><th className="p-3" scope="col">Status</th><th className="p-3" scope="col">Employees</th><th className="p-3" scope="col">Documents</th></tr></thead>
      <tbody>{data.items.map(run => <tr key={run.id} className="border-b border-border"><td className="p-3">{String(run.month).padStart(2, "0")}/{run.year}</td><td className="p-3">{run.status}</td><td className="p-3">{run.lineCount}</td><td className="p-3">
        <a className="mr-3 font-medium text-primary underline" href={`/app/payroll-runs/${encodeURIComponent(run.id)}`}>View payroll</a>
        {run.status === "APPROVED" ? <div className="flex flex-wrap gap-3"><Permit code="payroll.documents.view"><a className="font-medium text-primary underline" href={`/app/payroll-runs/${encodeURIComponent(run.id)}/salary-sheet`}>Monthly salary sheet</a></Permit><Permit code="payroll.preparation.view"><a className="font-medium text-primary underline" href={`/app/payroll-runs/${encodeURIComponent(run.id)}/payment-preparation`}>Bank / cash preparation</a></Permit></div> : <span className="text-muted-foreground">Documents available after approval</span>}
      </td></tr>)}</tbody>
    </table></div>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Page {data.page} of {pages} · {data.total} runs</p><div className="flex gap-3">
      <button className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</button>
      <button className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-50" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>Next</button>
    </div></div>
  </section>;
}
