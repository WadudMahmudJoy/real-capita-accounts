import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { preparationFixture } from "./verify-payroll-payment-preparation";
import { PayrollPaymentPreparationView, preparationSelectionTotals } from "../apps/web/src/app/app/payroll-runs/_components/payroll-payment-preparation-view";
const req = createRequire(resolve("apps/web/package.json")), React = req("react"), { renderToStaticMarkup } = req("react-dom/server");
async function main() {
  const f = await preparationFixture(), data = await f.preparation.prepare("run", { channel: "BANK" });
  assert.deepEqual(preparationSelectionTotals(data.rows, ["employee"]), { selectedCount: 1, selected: "60.01", unselected: "0.00" });
  assert.deepEqual(preparationSelectionTotals(data.rows, []), { selectedCount: 0, selected: "0.00", unselected: "60.01" });
  assert.throws(() => preparationSelectionTotals(data.rows, ["employee", "employee"]));
  assert.throws(() => preparationSelectionTotals(data.rows, ["unknown"]));
  const large = [0, 1].map(i => ({ ...data.rows[0], employeeId: String(i), plannedAmount: "9999999999999999.99" }));
  assert.equal(preparationSelectionTotals(large, ["0", "1"]).selected, "19999999999999999.98");
  assert.throws(() => preparationSelectionTotals([{ ...data.rows[0], selectable: false }], ["employee"]));
  const html = renderToStaticMarkup(React.createElement(PayrollPaymentPreparationView, { data, selected: ["employee"], sourceAccountId: "", onSelection: () => undefined, onSource: () => undefined }));
  for (const text of ["Preparation / Not Disbursed", "60.01", data.rows[0].fullName, "Test Bank", "Shared account", "PAYROLL_SOURCE_AUTHORIZATION_REQUIRED"]) assert(html.includes(text));
  assert(!/PRIVATE_SENTINEL|Confirm Payment|accountNumber/.test(html));
  console.log("PASS exact selection/subset reconciliation, invalid selections, safe preparation rendering and authority messaging");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
