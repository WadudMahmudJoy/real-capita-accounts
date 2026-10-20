import * as React from "react";
import type { PayrollDocumentContext, PayrollDocumentAmounts, PayrollPayslip, PayrollSalarySheet } from "../../../../lib/payroll-documents-api";

export function formatPayrollMoney(value: string) {
  if (!/^\d+\.\d{2}$/.test(value)) throw new Error("Invalid payroll document amount");
  const [whole, fraction] = value.split("."); return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
export const payrollDocumentPrintCss = `
 .payroll-print-root { background:white; color:#111; padding:24px; font:14px/1.5 Arial,sans-serif; max-width:190mm; margin:auto; }
 .payroll-print-root h1 { font-size:23px; font-weight:700; margin:0; } .payroll-print-root h2 { font-size:18px; font-weight:600; }
 .payroll-doc-heading { text-align:center; border-bottom:2px solid #222; padding-bottom:14px; margin-bottom:18px; }
 .payroll-doc-meta { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:20px; }
 .payroll-print-root table { border-collapse:collapse; width:100%; margin:16px 0; } .payroll-print-root td,.payroll-print-root th { border:1px solid #ccc; padding:7px; text-align:left; }
 .payroll-print-root td:not(.payroll-money) { overflow-wrap:anywhere; }
 .payroll-print-root .payroll-money { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
 .payroll-print-root .payroll-net { font-size:20px; font-weight:700; border-top:2px solid #222; padding:12px 0; display:flex; justify-content:space-between; }
 .payroll-doc-note { margin-top:24px; font-size:12px; border-top:1px solid #ccc; padding-top:14px; } .payroll-doc-scroll { overflow-x:auto; }
 @media print {
  html,body,main,.office-theme-shell,.office-theme-shell > div { height:auto!important; min-height:0!important; max-height:none!important; overflow:visible!important; background:white!important; position:static!important; }
  body * { visibility:hidden; } .payroll-print-root,.payroll-print-root * { visibility:visible; }
  header,nav,aside,.payroll-no-print { display:none!important; }
  .payroll-print-root { position:absolute; top:0; left:0; width:100%; max-width:none; padding:0; margin:0; border:0; border-radius:0; box-shadow:none; color:black; box-sizing:border-box; font-size:11px; }
  .payroll-doc-scroll { overflow:visible; } .payroll-print-root thead { display:table-header-group; } .payroll-print-root tr { break-inside:avoid; }
  .payroll-print-root th,.payroll-print-root td { padding:5px; } .payroll-doc-note { break-inside:avoid; }
 }
`;
function Frame({ data, title, landscape = false, children }: { data: PayrollDocumentContext; title: string; landscape?: boolean; children: React.ReactNode }) {
  const date = new Date(data.approvedAt);
  if (!Number.isFinite(date.getTime()) || data.approvalStatus !== "APPROVED") throw new Error("Invalid approved payroll document");
  const period = `${String(data.month).padStart(2, "0")}/${data.year}`;
  return <section className="payroll-print-root rounded-xl border border-border shadow-sm" aria-label={title}>
    <style>{`${payrollDocumentPrintCss} @media print { @page { size:A4${landscape ? " landscape" : ""}; margin:14mm 12mm; } }`}</style>
    <div className="payroll-doc-heading"><h1>{data.company.name}</h1>{data.company.legalName && data.company.legalName !== data.company.name ? <p>{data.company.legalName}</p> : null}<h2>{title}</h2></div>
    <div className="payroll-doc-meta"><span>Payroll period: <strong>{period}</strong></span><span>Currency: {data.company.currency}</span><span>Approved: {date.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })} (Asia/Dhaka)</span></div>
    {children}<p className="payroll-doc-note">{data.paymentNotice}</p>
  </section>;
}
function Row({ name, amount }: { name: string; amount: string }) { return <tr><td>{name}</td><td className="payroll-money">{formatPayrollMoney(amount)}</td></tr>; }
const deductions: [keyof PayrollDocumentAmounts, string][] = [["attendanceDeduction", "Attendance deduction"], ["providentFundDeduction", "Provident fund"],
  ["loanOrSalaryAdvanceDeduction", "Loan / salary advance"], ["aitDeduction", "AIT"], ["otherDeductionsTotal", "Other deductions"]];
export function PayrollPayslipView({ data }: { data: PayrollPayslip }) {
  return <Frame data={data} title="Payroll Payslip">
    <div className="payroll-doc-meta"><div><strong>{data.employee.fullName}</strong><p>Employee code: {data.employee.employeeCode}</p></div><div>{data.employee.designation}{data.employee.departmentName ? <p>{data.employee.departmentName}</p> : null}</div></div>
    <h2>Earnings</h2><table><thead><tr><th scope="col">Salary component</th><th className="payroll-money" scope="col">Amount ({data.company.currency})</th></tr></thead><tbody>
      {data.earnings.map(c => <Row key={c.code} name={c.name} amount={c.amount} />)}<Row name="Gross salary / total earnings" amount={data.amounts.totalEarnings} />
    </tbody></table><h2>Deductions</h2><table><thead><tr><th scope="col">Deduction category</th><th className="payroll-money" scope="col">Amount ({data.company.currency})</th></tr></thead><tbody>
      {deductions.map(([field, label]) => <Row key={field} name={label} amount={data.amounts[field]} />)}<Row name="Total deductions" amount={data.amounts.totalDeductions} />
    </tbody></table><div className="payroll-net"><span>Net salary</span><span>{data.company.currency} {formatPayrollMoney(data.amounts.netPay)}</span></div>
    <h2>Planned allocation</h2><table><tbody><Row name="Planned bank allocation" amount={data.plannedAllocation.bank} /><Row name="Planned cash allocation" amount={data.plannedAllocation.cash} /></tbody></table>
  </Frame>;
}
export function PayrollSalarySheetView({ data }: { data: PayrollSalarySheet }) {
  const columns = ["grossSalary", "totalDeductions", "netPay", "bankPay", "cashPay"] as const;
  return <Frame data={data} title="Monthly Salary Sheet" landscape><p>Approved employees: {data.employeeCount}</p><div className="payroll-doc-scroll"><table><thead><tr>
    {["Employee code", "Employee", "Gross salary", "Deductions", "Net salary", "Planned bank", "Planned cash"].map(label => <th scope="col" key={label}>{label}</th>)}
  </tr></thead><tbody>{data.rows.map(row => <tr key={row.employee.employeeId}><td>{row.employee.employeeCode}</td><td>{row.employee.fullName}<span className="payroll-no-print"> <a href={`/app/payroll-runs/${encodeURIComponent(data.runId)}/payslips/${encodeURIComponent(row.employee.employeeId)}`} className="underline">Payslip</a></span></td>
    {columns.map(field => <td key={field} className="payroll-money">{formatPayrollMoney(row.amounts[field])}</td>)}</tr>)}</tbody>
    <tfoot><tr><th scope="row" colSpan={2}>Reconciled totals</th>{columns.map(field => <td key={field} className="payroll-money"><strong>{formatPayrollMoney(data.totals[field])}</strong></td>)}</tr></tfoot>
  </table></div></Frame>;
}
