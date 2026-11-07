# Approved payroll documents (HR-3B Task 002D-1)

Authenticated ACCOUNTANT users can read:

- `GET /payroll-runs/:id/payslips/:employeeId`
- `GET /payroll-runs/:id/salary-sheet`
- `/app/payroll-runs/:id/payslips/:employeeId`
- `/app/payroll-runs/:id/salary-sheet`

The backend resolves the active `PRIMARY` company independently of selected office and requires an APPROVED run owned by that company. It reads run and line snapshots in one RepeatableRead view. DRAFT documents are rejected. No current employee identity, salary assignment or payment-profile data is used to recalculate or fill historical fields.

Explicit DTOs allow historical employee code/name/designation/department, company name/legal name/currency, component amounts, individual deduction amounts, net salary, planned allocations and approval timestamp/version. Raw snapshots, bank credentials, private employee fields and audit payloads are excluded. Responses use `Cache-Control: no-store`.

Historical branding currently supports text only: name, legal name and currency were captured at creation. Logo, contact details and custom print headings were not captured and are not substituted from live Company settings. Missing or inconsistent required snapshots cause an explicit 422 response. The salary sheet validates every included line, global employee uniqueness and exact Decimal totals. It rejects more than 1,000 lines rather than returning partial totals; larger sheets require a separately reviewed response strategy.

Payslips use A4 portrait; salary sheets use A4 landscape with repeating table headers and controls hidden when printing. Print links remain inside the authenticated application. Approval does not confirm payment; bank/cash amounts are labelled planned allocations. There is no PDF generation, payment receipt, paid status or database mutation.

Verification commands: `pnpm verify:payroll:documents`, `pnpm verify:payroll:print`, and the existing payroll read/auth and approval regressions. The print verifier renders actual components from safe DTOs and optionally serves synthetic fixtures with `--serve` for browser print-media checks. These offline checks do not establish database-backed acceptance with business payroll data.

DRAFT correction remains blocked pending durable revision history and material-reviser controls. This milestone does not alter approval, correction, salary calculation or attendance rules.

## Task 002D-2 integration and acceptance

The authenticated HR & Salary navigation includes Payroll Runs. Its paginated, read-only workspace links APPROVED runs to salary sheets; DRAFTs explain that documents become available after approval. Salary-sheet employee links open payslips, and documents link back to payroll runs. Loading, empty and denied/unavailable states use existing UI conventions. Parent ownership and ACCOUNTANT permissions remain backend-enforced.

`verify:payroll:acceptance` extends the existing disposable PostgreSQL harness with two distinct employees, genuine source approval/attendance finalization, DRAFT creation, maker-checker approval, HTTP/service document retrieval, exact totals, access rejection and historical stability after source/company changes. Only the UUID-named harness database receives fixtures; the development database connection is read-only for identity/baseline checks. Cleanup verifies database OID, owner, marker and absence of other sessions before dropping that exact database.

The previously observed repeated rows were introduced by a browser-only DOM-cloning stress check, not by the salary-sheet renderer or backend. That old screenshot's count of two was inconsistent with the artificial clones. The persistent test harness now serves `/salary-sheet-long` with 52 unique fixture employees and matching totals through the actual document validator. Normal `/salary-sheet` still has two rows. Test banners are harness-only and hidden in print; no fixture labels are added to production components. Production sheets reject duplicate employees and retain the 1,000-line cap. No payment authority is implied by document or approval acceptance.
