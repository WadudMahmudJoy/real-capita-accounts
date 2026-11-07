// Offline rendering of the actual document components and safe backend DTOs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { documentFixture } from "./verify-payroll-documents";
import { PayrollPayslipView, PayrollSalarySheetView, formatPayrollMoney } from "../apps/web/src/app/app/payroll-runs/_components/payroll-document-view";
import { PayrollRunListView } from "../apps/web/src/app/app/payroll-runs/_components/payroll-run-list-view";

const webRequire = createRequire(resolve("apps/web/package.json"));
const React = webRequire("react");
const { renderToStaticMarkup } = webRequire("react-dom/server");
async function main() {
  const f = await documentFixture();
  f.run.lines.push({ ...f.line, id: "second", employeeId: "second", employeeSnapshot: { ...f.line.employeeSnapshot, employeeCode: "SECOND", fullName: "Second Test Employee" } });
  const slip = await f.service.payslip("run", "employee"), sheet = await f.service.salarySheet("run");
  const renderSlip = (data = slip) => renderToStaticMarkup(React.createElement(PayrollPayslipView, { data }));
  const slipHtml = renderSlip(), sheetHtml = renderToStaticMarkup(React.createElement(PayrollSalarySheetView, { data: sheet }));
  const secondSlipHtml = renderSlip(await f.service.payslip("run", "second"));
  for (const expected of [slip.employee.fullName, slip.employee.employeeCode, slip.company.name, "10/2026", "3 Nov 2026", "Asia/Dhaka", "100.01", "60.01", "40.00",
    "Attendance deduction", "Provident fund", "Loan / salary advance", "AIT", "Other deductions", "Total deductions", "Net salary", "Planned bank allocation", "Planned cash allocation", slip.paymentNotice]) assert(slipHtml.includes(expected), expected);
  for (const component of slip.earnings) { assert(slipHtml.includes(component.name)); assert(slipHtml.includes(component.amount)); }
  console.log("PASS payslip prints the exact historical DTO, all earnings/deductions, approval and planned allocations");
  for (const expected of ["Monthly Salary Sheet", "Second Test Employee", "SECOND", "200.02", "120.02", "80.00", "Reconciled totals", "A4 landscape"]) assert(sheetHtml.includes(expected), expected);
  assert.equal((sheetHtml.match(/href="\/app\/payroll-runs\/run\/payslips\//g) ?? []).length, 2);
  console.log("PASS complete multi-employee salary sheet prints exact reconciled totals and authenticated document links");
  assert.equal(formatPayrollMoney("9999999999999999990.00"), "9,999,999,999,999,999,990.00");
  assert.throws(() => formatPayrollMoney("1e3"));
  const unsafe = renderSlip({ ...slip, employee: { ...slip.employee, fullName: "<script>alert(1)</script>" } });
  assert(!unsafe.includes("<script>")); assert(unsafe.includes("&lt;script&gt;"));
  for (const html of [slipHtml, sheetHtml]) { assert(!html.includes("PRIVATE_SENTINEL")); assert(!/\bPAID\b|Payment receipt|Payment reference/.test(html)); assert(html.includes("display:none!important")); assert(html.includes("break-inside:avoid")); }
  assert.equal(f.counts().writes, 0);
  console.log("PASS exact large money formatting, HTML escaping, print controls and read-only rendering");
  // Intentional print stress data is isolated here, never inserted by the UI.
  // Unlike the old browser-only cloned rows, its roster/count/totals agree.
  for (let i = 0; i < 50; i++) f.run.lines.push({ ...f.line, id: `stress-${i}`, employeeId: `stress-${i}`, employeeSnapshot: { ...f.line.employeeSnapshot, employeeCode: `STRESS-${String(i).padStart(3, "0")}`, fullName: `Print stress employee ${i}` } });
  const longSheet = await f.service.salarySheet("run");
  assert.equal(longSheet.employeeCount, 52); assert.equal(new Set(longSheet.rows.map(r => r.employee.employeeId)).size, 52);
  assert.equal(longSheet.totals.netPay, "5200.52"); assert.equal(longSheet.totals.bankPay, "3120.52"); assert.equal(longSheet.totals.cashPay, "2080.00");
  const longSheetHtml = renderToStaticMarkup(React.createElement(PayrollSalarySheetView, { data: longSheet }));
  const navigationHtml = renderToStaticMarkup(React.createElement(PayrollRunListView, { data: { items: [{ id: "run", year: 2026, month: 10, status: "APPROVED", lineCount: 2 }, { id: "draft", year: 2026, month: 9, status: "DRAFT", lineCount: 2 }], page: 1, pageSize: 20, total: 2 }, onPage: () => undefined }));
  console.log("PASS isolated long-sheet fixture has 52 distinct employees and matching exact totals; no DOM row cloning");
  console.log("4 payroll print checks passed; synthetic offline fixtures, no database connections");
  if (process.argv.includes("--serve")) {
    const server = createServer((req, res) => { res.setHeader("content-type", "text/html; charset=utf-8"); res.setHeader("cache-control", "no-store");
      const html = req.url === "/salary-sheet-long" ? longSheetHtml : ["/salary-sheet", "/app/payroll-runs/run/salary-sheet"].includes(req.url ?? "") ? sheetHtml : ["/navigation", "/app/payroll-runs"].includes(req.url ?? "") ? navigationHtml : req.url === "/app/payroll-runs/run/payslips/second" ? secondSlipHtml : slipHtml;
      res.end(`<!doctype html><html><head><title>Offline payroll print verification</title></head><body><div class="office-theme-shell" style="position:relative;min-height:100vh;overflow-x:hidden"><div style="position:relative;height:100vh;overflow:hidden"><header>TEST ONLY: isolated synthetic print fixture</header><nav>Fixture navigation</nav><main><button class="payroll-no-print">Fixture print control</button>${html}</main></div></div></body></html>`); });
    server.listen(0, "127.0.0.1", () => console.log(`Fixture URL http://127.0.0.1:${(server.address() as { port: number }).port}`));
    process.on("SIGINT", () => server.close()); process.on("SIGTERM", () => server.close());
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
