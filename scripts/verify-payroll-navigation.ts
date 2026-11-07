import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { PayrollRunListView } from "../apps/web/src/app/app/payroll-runs/_components/payroll-run-list-view";

const webRequire = createRequire(resolve("apps/web/package.json"));
const React = webRequire("react"), { renderToStaticMarkup } = webRequire("react-dom/server");
const item = (id: string, status: "APPROVED" | "DRAFT") => ({ id, year: 2026, month: 9, status, lineCount: 2 });
const render = (items = [item("approved", "APPROVED"), item("draft", "DRAFT")], page = 1, total = 2) => renderToStaticMarkup(React.createElement(PayrollRunListView, { data: { items, page, pageSize: 20, total }, onPage: () => undefined }));
const html = render();
assert(html.includes('/app/payroll-runs/approved/salary-sheet')); assert(!html.includes('/app/payroll-runs/draft/salary-sheet'));
assert(html.includes('Documents available after approval')); assert(html.includes('09/2026'));
console.log('PASS approved run links and DRAFT status messaging');
assert(render([]).includes('No payroll runs found')); assert(render([], 1, 0).includes('disabled=""'));
const paged = render([item('approved', 'APPROVED')], 2, 45); assert(paged.includes('Page 2 of 3'));
console.log('PASS empty roster and bounded pagination rendering');
assert(render([item('id/with?reserved', 'APPROVED')]).includes('id%2Fwith%3Freserved/salary-sheet'));
assert(!html.includes('PAID')); console.log('PASS encoded document identifiers and no payment-status claims');
console.log('3 payroll navigation checks passed; no database connections');
