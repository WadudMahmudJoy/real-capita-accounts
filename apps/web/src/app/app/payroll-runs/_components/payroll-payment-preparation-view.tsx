import * as React from "react";
import type { PaymentPreparation } from "../../../../lib/payroll-payment-preparation-api";
import { formatPayrollMoney } from "./payroll-document-view";

// Exact integer minor units for browser-only selection feedback, never floats.
export function preparationSelectionTotals(rows: PaymentPreparation["rows"], selected: string[]) {
  if (new Set(rows.map(r => r.employeeId)).size !== rows.length || new Set(selected).size !== selected.length || selected.some(id => !rows.some(r => r.employeeId === id && r.selectable))) throw new Error("Invalid employee selection");
  let total = BigInt(0), chosen = BigInt(0);
  for (const row of rows) { if (!/^\d+\.\d{2}$/.test(row.plannedAmount)) throw new Error("Invalid planned amount"); const value = BigInt(row.plannedAmount.replace(".", "")); total += value; if (selected.includes(row.employeeId)) chosen += value; }
  const money = (value: bigint) => { const digits = value.toString().padStart(3, "0"); return `${digits.slice(0, -2)}.${digits.slice(-2)}`; };
  return { selectedCount: selected.length, selected: money(chosen), unselected: money(total - chosen) };
}
export function PayrollPaymentPreparationView({ data, selected, sourceAccountId, onSelection, onSource }: { data: PaymentPreparation; selected: string[]; sourceAccountId: string; onSelection: (id: string, checked: boolean) => void; onSource: (id: string) => void }) {
  const totals = preparationSelectionTotals(data.rows, selected);
  return <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm" aria-label="Payment preparation">
    <div><h2 className="text-lg font-semibold">{data.channel === "BANK" ? "Bank Payment" : "Cash Payment"} preparation</h2><p className="text-sm text-muted-foreground">{data.company.name} · {String(data.month).padStart(2, "0")}/{data.year} · {data.company.currency}</p><p className="mt-2 font-medium">Preparation / Not Disbursed</p><p className="text-sm text-muted-foreground">{data.notice}</p></div>
    <label className="block text-sm font-medium">Proposed source account (explicit PRIMARY authorization required)
      <select value={sourceAccountId} onChange={e => onSource(e.target.value)} className="mt-2 block w-full rounded-md border border-input bg-input-surface p-3"><option value="">No proposed account</option>{data.sourceAccounts.map(a => <option key={a.id} value={a.id}>{a.displayName} · {a.ledgerCode} · Shared account</option>)}</select>
    </label>
    {data.sourceAuthorizationVerified && <p className="text-sm">PRIMARY source authorization verified. Disbursement remains unconfirmed.</p>}
    {!data.sourceAccounts.length && <p className="text-sm text-muted-foreground">No structurally eligible {data.channel.toLowerCase()} source accounts found.</p>}
    <div role="status" className="rounded-md border border-border p-3 text-sm">{data.blockers.map(b => <p key={b.code}><strong>{b.code}</strong>: {b.message}</p>)}</div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-2" scope="col">Select</th><th className="p-2" scope="col">Employee code</th><th className="p-2" scope="col">Employee</th><th className="p-2 text-right" scope="col">Planned amount</th></tr></thead><tbody>
      {data.rows.map(row => <tr key={row.employeeId} className="border-b border-border"><td className="p-2"><input type="checkbox" aria-label={`Select ${row.employeeCode}`} disabled={!row.selectable} checked={selected.includes(row.employeeId)} onChange={e => onSelection(row.employeeId, e.target.checked)} /></td><td className="p-2">{row.employeeCode}</td><td className="p-2">{row.fullName}{!row.selectable && <span className="block text-muted-foreground">Zero planned allocation</span>}</td><td className="p-2 text-right tabular-nums">{formatPayrollMoney(row.plannedAmount)}</td></tr>)}
    </tbody></table></div>
    {!data.rows.some(r => r.selectable) && <p>No positive planned allocations for this channel.</p>}
    <div className="grid gap-2 text-sm sm:grid-cols-2"><p>Approved employees: {data.employeeCount}</p><p>Channel planned total: {formatPayrollMoney(data.totalPlanned)}</p><p>Selected employees: {totals.selectedCount}</p><p>Selected planned total: {formatPayrollMoney(totals.selected)}</p><p>Unselected planned total: {formatPayrollMoney(totals.unselected)}</p><p>Payroll net total (bank + cash): {formatPayrollMoney(data.payrollNetTotal)}</p></div>
    <p className="text-sm text-muted-foreground">Selection is local preparation only. It does not reserve funds, authorize partial payments or record disbursement.</p>
    <p className="text-sm">Approved allocation reconciliation: bank {formatPayrollMoney(data.bankTotal)} + cash {formatPayrollMoney(data.cashTotal)} = net {formatPayrollMoney(data.payrollNetTotal)}.</p>
  </section>;
}
