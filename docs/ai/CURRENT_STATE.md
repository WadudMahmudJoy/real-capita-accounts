# Current State

## Completed Phase

Phase 0 is complete and accepted.

Phase 1A is implemented: multi-agent project continuity plus single-accountant authentication.

Phase 1B requirement/specification lock is complete.

Phase 2A accounting foundation is complete and accepted.

Phase 2B voucher requirement/specification lock is complete.

Phase 2C voucher implementation planning is complete.

Phase 2C Chunk 2C-1 voucher schema foundation is complete.

Phase 2C Chunk 2C-2 backend draft voucher API is complete.

Phase 2C Chunk 2C-3 backend posting validation service is complete.

Phase 2C Chunk 2C-4 frontend voucher draft/create UI is complete.

Phase 2C Chunk 2C-5 posting UI and print foundation is complete.

Phase 2C Chunk 2C-6 final integration and acceptance review is complete. Phase 2C is now accepted.

Phase 2D accounting reports requirement/specification lock is complete.
Phase 2D Chunk 2D-1 requirement lock review is complete.
Phase 2D Chunk 2D-2 backend ledger/cash-book/bank-book report API is complete.
Phase 2D Chunk 2D-2 backend report API review is complete.
Phase 2D Chunk 2D-3 backend Trial Balance API is complete.
Phase 2D Chunk 2D-4 backend Income Statement and Balance Sheet API is complete.
Phase 2D Chunk 2D-5 frontend operational report pages (Ledger, Cash Book, Bank Book, Trial Balance) are complete.
Phase 2D Chunk 2D-6 frontend financial statement pages (Income Statement, Balance Sheet) and the report browser-print foundation are complete.
Phase 2D Chunk 2D-7 final integration and acceptance review is complete. Phase 2D is now accepted.

Phase 2E MFS / bKash transaction support requirement/specification lock is complete and accepted at commit `fdffcfb`.

Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at commit `c820d7b`.

Phase 2E Chunk 2E-3 backend validation/API changes are accepted at commit `97e69ab`. The backend Cash & Bank account API can manage MFS accounts.

Phase 2E Chunk 2E-4 frontend MFS account setup UI is accepted at `be2392a`. The accountant can create, view, edit, and deactivate MFS accounts from the existing Cash, Bank & MFS setup page. Phase 2E Chunk 2E-5 MFS Book report API is implemented: `GET /reports/mfs-book` exists. Phase 2E Chunk 2E-6 MFS Book frontend and print foundation is implemented: `/app/reports/mfs-book` exists. MFS runtime is still incomplete: no MFS voucher posting support exists yet.

## Phase 2E Chunk 2E-6 MFS Book Frontend and Print Foundation - completed this session

- Added frontend route/page `/app/reports/mfs-book` using the shared `CashBankBookReport` component scoped to `accountType="MFS"`.
- Extended `CashBankBookReport.tsx` to support MFS alongside CASH and BANK with a safe wider type union; CASH and BANK behavior unchanged.
- MFS Book page uses the same filter panel, report summary, transaction line table, and print layout pattern as Cash Book and Bank Book.
- MFS-specific display: MFS Book title and description, provider/wallet/account holder metadata in report summary when an MFS account is selected, Provider column in the transaction line table for MFS accounts, and MFS metadata in the print layout.
- Added MFS Book navigation link under Reports in `apps/web/src/app/app/layout.tsx` with the `Smartphone` icon.
- Extended `apps/web/src/lib/api.ts`: added `"MFS_BOOK"` to `CashBankReport.reportType` union, added MFS metadata fields (`provider`, `providerOtherName`, `walletNumber`, `accountHolderName`) to `ReportCashBankAccountSummary`, added cookie-authenticated `getMfsBookReport` helper using `apiFetch` with `credentials: "include"`.
- Extended `report-ui.tsx`: updated `cashBankLabel` to show MFS provider name, added `providerDisplayName` helper for "BKASH" → "bKash" etc.
- Print foundation reuses existing `ReportPrintFrame` with MFS-specific meta (provider, wallet/account ID) and the MFS Book title.
- No backend code, Prisma schema, or migration changes. No dashboard analytics, no PDF/Excel export, no MFS voucher posting support. Cash Book remains CASH-only and Bank Book remains BANK-only.

## Phase 2E Chunk 2E-5 MFS Book Report API - completed this session (accepted)

- Added guarded backend endpoint `GET /reports/mfs-book` in the existing report module.
- The endpoint uses the existing class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` report-route protection.
- MFS Book derives only from `VoucherLine` rows attached to `Voucher.status = POSTED`, `Voucher.isDeleted = false`, and `CashBankAccount.accountType = MFS`.
- MFS Book structurally mirrors Cash Book / Bank Book: fiscal year, optional accounting period, date range, cash/bank account (MFS only), filters, opening/period/closing balances, lines with running balances, and opposite accounts.
- Cash Book remains CASH-only and Bank Book remains BANK-only. MFS does not leak into either report.
- CASH or BANK `cashBankAccountId` on MFS Book returns 400.
- MFS `cashBankAccountId` accepts and returns MFS metadata (provider, providerOtherName, walletNumber, accountHolderName) in account summaries.
- Query validation reuses the existing `resolveReportContext` pattern: required fiscal year, optional accounting period belonging to the fiscal year, paired custom dates, date range inside fiscal year/period, project/cost center existence and consistency, ledger account existence, cash/bank account existence and type check.
- No Prisma schema changes, migrations, report tables, frontend MFS Book page, MFS Book navigation link, dashboard/export/PDF/Excel, provider API integration, statement import, seed data, or MFS voucher posting support were added. MFS voucher posting remains blocked from Phase 2E Chunk 2E-3.

## Phase 2E Chunk 2E-4 Frontend MFS Account Setup UI - completed this session (accepted)

- Extended `apps/web/src/lib/api.ts`: `CashBankAccountType` now includes `MFS`; added the `MfsProvider` type (`BKASH`, `NAGAD`, `ROCKET`, `UPAY`, `OTHER`); added nullable `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName` to the `CashBankAccount` type; and added the same optional fields to the `CashBankAccountInput` create/update payload type. The existing cookie-authenticated `apiFetch` with `credentials: "include"` is preserved; no tokens are stored in `localStorage`.
- Updated `apps/web/src/app/app/cash-bank/page.tsx` into the Cash, Bank & MFS setup page:
  - The account type dropdown now offers CASH, BANK, and MFS (labelled "MFS / Mobile Wallet").
  - When MFS is selected, the form shows Provider (required), Provider name (required and shown only when provider is Other), Wallet number / account ID (required), and an optional Account holder name. Bank name, branch, and account number are hidden for MFS.
  - CASH and BANK keep their existing Bank name / Branch / Account number fields and do not show MFS metadata.
  - Client-side validation catches missing MFS provider, missing wallet number, and missing custom provider name (when provider is Other) before submit; backend validation errors continue to surface through the shared `Notice`.
  - A calm informational note explains that MFS account setup is available now but MFS voucher posting is not enabled yet.
  - The account list/table shows the friendly account type label, and for MFS rows it shows the provider (custom name for Other) plus the wallet identifier. Existing CASH/BANK rows display the bank name as before.
  - `startEdit` populates MFS metadata so MFS accounts can be edited and deactivated.
- Updated the sidebar label in `apps/web/src/app/app/layout.tsx` from "Cash & Bank" to "Cash, Bank & MFS" so MFS setup is discoverable. No new sidebar route or section was added.
- No backend code, Prisma schema, or migration changes were made. No voucher UI changes, no MFS Book report API, no MFS Book frontend page, no Reports navigation change, no dashboard cards, no PDF/Excel export, no provider integration, and no seed data were added. MFS voucher posting remains blocked by the backend.

## Phase 2E Chunk 2E-3 Backend Validation / API Changes - completed previous session

- Opened the existing guarded `cash-bank-accounts` API to `accountType = MFS` while preserving the existing `ACCOUNTANT` route protection.
- Added DTO support for MFS metadata: `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName`.
- Enforced MFS account rules in the backend service: provider is required, wallet number is required, `providerOtherName` is required only when provider is `OTHER`, and non-`OTHER` providers clear `providerOtherName`.
- MFS wallet numbers are treated as strings. No Bangladesh phone-number regex was added.
- CASH and BANK accounts do not require MFS metadata; MFS-only metadata is cleared server-side for CASH/BANK writes to avoid stale provider or wallet data.
- MFS accounts must link to a ledger account marked `isCashBank`; MFS setup additionally requires the linked ledger account to be active.
- List/update responses now include the nullable MFS metadata fields because they are returned from the existing `CashBankAccount` model.
- Added a narrow voucher posting safety block so posted voucher behavior is not accidentally expanded before the planned MFS voucher/report chunks: posting rejects voucher lines that use an MFS cash-bank account.
- Cash Book remains CASH-only and Bank Book remains BANK-only. No report API changes, no MFS Book endpoint, no MFS Book page, no frontend MFS account page, no sidebar/navigation change, no provider integration, no seed data, and no new role was added.

## Phase 2E Chunk 2E-2 Backend Schema / Model Foundation - completed this session

- Added `MFS` as a separate `CashBankAccountType` value beside existing `CASH` and `BANK`. Existing CASH and BANK values were not renamed or removed.
- Added `MfsProvider` enum with `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, and `OTHER`.
- Extended `CashBankAccount` with nullable MFS metadata fields: `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName`.
- Created and applied migration `20260615123515_phase_2e_mfs_schema_foundation`.
- Existing CASH and BANK rows migrate without manual data edits because every new MFS-specific column is nullable.
- Added a narrow backend guard in the existing Cash & Bank service so the generic cash-bank account API does not accept `accountType = MFS` before Phase 2E Chunk 2E-3 validation/API work.
- Cash Book remains CASH-only and Bank Book remains BANK-only. No MFS Book endpoint or page was added.
- No frontend MFS account page, sidebar navigation change, report API expansion, voucher posting behavior change, dashboard/report/export expansion, MFS provider API integration, seed data, or new role was added.

## Phase 2E MFS / bKash Requirement Lock - completed this session

- Created `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`: defines MFS / bKash transaction support purpose, confirmed business need, current status (future requirement, not implemented), terminology (MFS, wallet/account, provider, cash-in, cash-out, merchant payment, transfer, service charge), supported future providers (bKash, Nagad, Rocket, Upay, Other), current role boundary (ACCOUNTANT only), accounting source rule (reports from POSTED voucher lines only), cash/bank/MFS separation rule (MFS is a separate account type, not BANK or CASH), voucher behavior requirements, report behavior requirements (MFS Book concept, Cash Book remains CASH-only, Bank Book remains BANK-only, Trial Balance/Income Statement/Balance Sheet unchanged), validation requirements, print/report requirements, security/privacy requirements, exclusions, and open questions for Real Capita confirmation.
- Created `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`: proposes future model (CashBankAccountType: CASH, BANK, MFS; MfsProvider enum; walletNumber/accountHolderName fields), explains why bKash should not be forced under BANK or CASH, voucher-line level impact, report impact per report type, decimal handling, backend authority rule, migration risk notes, and explicit statement of no current code changes.
- Created `docs/acceptance/phase-2e-acceptance-criteria.md`: acceptance for documentation lock, future backend implementation, future frontend implementation, report correctness, security, regression, and explicit non-acceptance conditions.
- Created `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md`: splits MFS implementation into 7 chunks (2E-1 requirement lock review, 2E-2 backend schema/model, 2E-3 backend validation/API, 2E-4 frontend MFS account setup, 2E-5 MFS Book report API, 2E-6 MFS Book frontend and print foundation, 2E-7 final integration and acceptance review). Each chunk includes model recommendation, scope, files to read, verification, manual smoke tests, and exact stop condition.
- Updated `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md`, `AGENTS.md`, `docs/ai/START_HERE.md` to reflect Phase 2E requirement lock.
- No Prisma schema changes, migrations, backend API endpoints, frontend pages, MFS runtime logic, roles, seed data, or tooling were added in Phase 2E Chunk 2E-1 requirement lock.

## Phase 2D Chunk 2D-7 Final Integration and Acceptance Review

Chunk 2D-6 added the accountant-facing Income Statement and Balance Sheet frontend pages and a browser-print foundation for every approved report page, on top of the existing backend financial statement APIs, with no backend, schema, or migration changes.

- Extended `apps/web/src/lib/api.ts` with string-money financial statement types (`FinancialStatementGroupSummary`, `IncomeStatementRow`, `IncomeStatementSection`, `IncomeStatementReport`, `BalanceSheetRow`, `BalanceSheetSection`, `BalanceSheetReport`), added an optional `asOfDate` to `ReportQueryParams` (carried through `buildReportQuery`), and added cookie-authenticated helpers `getIncomeStatementReport` and `getBalanceSheetReport`. Both use the existing `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`. All money values are typed as strings to match the API serialization. No Project Summary or Cost Center Summary helpers were added.
- Added a print foundation module `apps/web/src/app/app/reports/_lib/report-print.tsx`: a `PrintReportButton` (calls `window.print()` only) and a `ReportPrintFrame` print-only layout (Real Capita Group heading, report title, report context meta, report body, generated date/time, and prepared/checked/authorised signature placeholders) using `@media print` CSS modelled on the voucher print foundation. No PDF generation, no Excel export, no file uploads.
- Extended the shared `ReportFilters` panel (`_lib/report-ui.tsx`) with `showDateRange` (default true) and `showAsOfDate` config options plus an `asOfDate` field so the Balance Sheet uses an optional point-in-time as-of date instead of a start/end range, while the Income Statement keeps the optional custom date range.
- Added a `Reports` navigation entry for `Income Statement` and `Balance Sheet` in `apps/web/src/app/app/layout.tsx`. No dashboard cards or analytics.
- Added routes `/app/reports/income-statement` and `/app/reports/balance-sheet`.
- Income Statement page requires a fiscal year; optional period, custom date range, project, and cost center (no ledger account, no cash/bank account, no as-of date). Renders the report header, total income, total expense, net income with profit/loss state, and grouped Income and Expense sections (account code/name, debit movement, credit movement, amount) with section totals. A valid empty report shows zero totals and a calm empty state.
- Balance Sheet page requires a fiscal year; optional period, as-of date, project, and cost center (no start/end date, no ledger account, no cash/bank account). Renders the report header, Assets/Liabilities/Equity sections (account code/name, debit movement, credit movement, balance), total assets, total liabilities, total equity, total liabilities and equity, difference, and `isBalanced`. When unbalanced it shows a clear warning and never hides or forces the difference. It does not invent virtual retained earnings; it shows only what the backend returns.
- Added a "Print report" button (shown after a report loads) and a print-only `ReportPrintFrame` layout to all six report pages: Ledger, Cash Book, Bank Book, Trial Balance, Income Statement, and Balance Sheet. Each print layout includes the Real Capita Group heading, report title, fiscal year, accounting period or date range / as-of date, selected filters, the report table/sections, totals, a generated timestamp, and signature placeholders.
- Every page handles reference loading, report loading, empty reference data, client-side validation before submit, backend validation errors, unauthenticated redirect through the existing app shell, and calm empty states for empty results.

No Project Summary, Cost Center Summary, Project Summary API, Cost Center Summary API, report tables, PDF/Excel export, approval workflow, voucher reversal/correction, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, tooling, Prisma schema changes, migrations, backend API changes, or bKash/MFS implementation were added.

### Future Request Note: bKash / MFS Transaction Support

bKash/MFS transaction support was requested and is deferred to a separate future requirement lock/chunk. No schema, enum, cash/bank logic, voucher validation, or report changes were made for bKash/MFS in this chunk.

## Phase 2D Chunk 2D-5 Frontend Operational Report Pages

Chunk 2D-5 added the accountant-facing frontend report pages on top of the existing backend report APIs, with no backend, schema, or migration changes.

- Extended `apps/web/src/lib/api.ts` with stable report types (`ReportFiscalYearSummary`, `ReportAccountingPeriodSummary`, `ReportDateRange`, `ReportFilterSummary`, `ReportBalanceSummary`, `LedgerReport`, `CashBankReport`, `TrialBalanceReport`, `ReportQueryParams`, and supporting summaries) and cookie-authenticated helpers `getLedgerReport`, `getCashBookReport`, `getBankBookReport`, and `getTrialBalanceReport`. All use the existing `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`. All money values are typed as strings to match the API serialization. No Income Statement or Balance Sheet helpers were added.
- Added a `Reports` navigation section in `apps/web/src/app/app/layout.tsx` with links to Ledger Statement, Cash Book, Bank Book, and Trial Balance. No dashboard cards or analytics.
- Added shared report utilities in `apps/web/src/app/app/reports/_lib/`:
  - `useReportReferences.ts`: loads fiscal years, accounting periods, ledger accounts, projects, cost centers, and cash/bank accounts for the filter dropdowns; redirects unauthenticated users to `/login`.
  - `report-ui.tsx`: formatting helpers (money, date, normal-balance-aware `formatBalance`), label helpers, presentational primitives (`ReportMeta`, `SummaryGrid`), and a reusable `ReportFilters` panel that validates the fiscal-year requirement, the optional ledger-account requirement, and the custom date-range pairing before emitting a clean `ReportQueryParams`.
  - `CashBankBookReport.tsx`: shared Cash Book / Bank Book page used by both routes, scoped by cash/bank account type.
- Added routes: `/app/reports/ledger`, `/app/reports/cash-book`, `/app/reports/bank-book`, `/app/reports/trial-balance`.
- Ledger page requires a fiscal year and a ledger account; optional period, custom date range, project, and cost center. Renders report header, opening balance, period debit, period credit, closing balance, and a line table (date, voucher no., type, narration, line description, debit, credit, running balance, project, cost center, cash/bank account).
- Cash Book and Bank Book pages require a fiscal year; optional period, date range, cash/bank account (scoped to CASH or BANK), ledger account (scoped to eligible cash/bank ledgers), project, and cost center. Render report header, opening/period/closing balances, and a line table including the cash/bank account, ledger account, opposite accounts, debit, credit, running balance, project, and cost center.
- Trial Balance page requires a fiscal year; optional period, date range, project, and cost center. Renders totals (opening debit/credit, period debit/credit, closing debit/credit, difference, balanced flag), a clear balanced/unbalanced notice that never hides or forces the difference, and a row table (code, name, group/class, opening/period/closing debit and credit) with a totals footer.
- Every page handles reference loading, report loading, empty reference data, client-side validation errors before submit, backend validation errors, unauthenticated redirect through the existing app shell, and calm empty states for empty results.

No Income Statement frontend, Balance Sheet frontend, Project Summary, Cost Center Summary, report print layout, PDF/Excel export, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, tooling, Prisma schema changes, migrations, or backend API changes were added.

## Phase 2D Chunk 2D-4 Backend Income Statement and Balance Sheet API

Chunk 2D-4 added two guarded backend endpoints inside the existing report module:

- `GET /reports/income-statement`: Income Statement for a period within a fiscal year.
- `GET /reports/balance-sheet`: Balance Sheet at a point-in-time date within a fiscal year.

Both endpoints use the existing class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` report-route protection.

The shared `ReportQueryDto` gained an optional `asOfDate` field for the balance sheet point-in-time query.

### Income Statement

- Period-based report using only INCOME and EXPENSE account classes.
- Uses existing shared report query validation for fiscal year, accounting period, and date range.
- Income accounts: signed amount = credit - debit (credit increases income).
- Expense accounts: signed amount = debit - credit (debit increases expense).
- Net income = total income - total expense; `isProfit` flag when net income >= 0.
- Rows grouped by account group, sorted by account class (Income then Expense), group code/name, ledger account code/name.
- Rejects `ledgerAccountId`, `cashBankAccountId`, and `asOfDate` with clear 400 errors.
- Empty valid reports return zero totals, `isProfit: true`.

### Balance Sheet

- As-of-date based report using only ASSET, LIABILITY, and EQUITY account classes.
- `asOfDate` determines the point-in-time; falls back to `accountingPeriod.endDate`, then `fiscalYear.endDate`.
- Cumulative movements from `fiscalYear.startDate` through `asOfDate` inclusive.
- Asset accounts: signed amount = debit - credit (debit increases asset).
- Liability accounts: signed amount = credit - debit (credit increases liability).
- Equity accounts: signed amount = credit - debit (credit increases equity).
- Balance check: `difference = totalAssets - totalLiabilitiesAndEquity`; `isBalanced` when zero.
- Rows grouped by account group, sorted by account class (Asset, Liability, Equity), group code/name, ledger account code/name.
- Rejects `ledgerAccountId`, `cashBankAccountId`, `startDate`, and `endDate` with clear 400 errors.
- `asOfDate` must fall inside the fiscal year; when `accountingPeriodId` is also provided, `asOfDate` must fall inside the period.
- Does not invent virtual retained earnings; reports only posted voucher line movements honestly.
- Empty valid reports return zero totals, `isBalanced: true`, `difference: "0.00"`.

### Files changed

- `apps/api/src/report/dto/report-query.dto.ts`: added `asOfDate` field.
- `apps/api/src/report/report.controller.ts`: added `income-statement` and `balance-sheet` endpoints.
- `apps/api/src/report/report.service.ts`: added `getIncomeStatement`, `getBalanceSheet`, `resolveBalanceSheetContext`, `buildBalanceSheetVoucherFilter`, and supporting types/helpers.

No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Project Summary, Cost Center Summary, PDF/Excel export, or report UI were added.

## Phase 2D Chunk 2D-2 Backend Ledger/Cash-Book/Bank-Book API

Chunk 2D-2 added a guarded NestJS report module at `apps/api/src/report` and registered it in `apps/api/src/app.module.ts`.

Endpoints added:

- `GET /reports/ledger`: General Ledger / Ledger Statement for one `ledgerAccountId`.
- `GET /reports/cash-book`: Cash Book for posted cash-type cash/bank voucher lines, optionally filtered by `cashBankAccountId` or `ledgerAccountId`.
- `GET /reports/bank-book`: Bank Book for posted bank-type cash/bank voucher lines, optionally filtered by `cashBankAccountId` or `ledgerAccountId`.

All report routes use the existing `AuthGuard` + `RolesGuard` + `ACCOUNTANT` pattern.

Report behavior:

- Reports derive from `VoucherLine` rows attached to `Voucher.status = POSTED` and `Voucher.isDeleted = false` only.
- `DRAFT` vouchers and soft-deleted vouchers do not affect report totals or lines.
- Shared filters include required `fiscalYearId`, optional `accountingPeriodId`, custom `startDate`/`endDate`, optional `projectId`, `costCenterId`, `ledgerAccountId`, and `cashBankAccountId`.
- If an accounting period is supplied without custom dates, the period date range is used. If custom dates are supplied with a period, the range must fit inside that period and the selected fiscal year.
- Ledger balances are normal-balance-aware. Opening balance uses posted movement before the selected start date within the same fiscal year. Period debit/credit and closing balance are derived on demand.
- Cash Book and Bank Book use receipt/payment behavior from cash/bank linked posted voucher lines, with running balances computed from debit minus credit.

No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Trial Balance, Income Statement, or Balance Sheet implementation were added.

## Phase 2D Chunk 2D-2 Backend Report API Review

Chunk 2D-2 backend report API review passed. The reviewed implementation remains limited to backend General Ledger, Cash Book, and Bank Book report APIs plus docs updates.

Review results:

- Route/security check passed: `GET /reports/ledger`, `GET /reports/cash-book`, and `GET /reports/bank-book` use `AuthGuard`, `RolesGuard`, and `ACCOUNTANT`.
- Posted-only check passed: reports use `Voucher.status = POSTED`, `Voucher.isDeleted = false`, and attached `VoucherLine` rows only.
- Validation check passed for required fiscal year, required ledger account on ledger report, period/date-range rules, project/cost-center mismatch, and cash/bank account type mismatch.
- Accounting calculation review passed for opening, period debit/credit, closing, and running balance behavior in the reviewed scope.
- No backend source changes were needed during review.
- Stale project docs were corrected where older sections still said report APIs were not implemented.

## Phase 2D Chunk 2D-3 Backend Trial Balance API

Chunk 2D-3 added the guarded backend endpoint `GET /reports/trial-balance` inside the existing report module.

Trial Balance behavior:

- The endpoint uses the existing `AuthGuard`, `RolesGuard`, and `ACCOUNTANT` report-controller protection.
- The query requires `fiscalYearId` and supports optional `accountingPeriodId`, custom `startDate`/`endDate`, `projectId`, and `costCenterId`.
- The same report context validation applies: period ownership, paired custom dates, `startDate <= endDate`, fiscal-year range, selected-period range, project and cost-center existence, and cost-center-to-project consistency.
- Trial Balance derives only from `VoucherLine` rows attached to `Voucher.status = POSTED` and `Voucher.isDeleted = false`.
- `DRAFT` vouchers, soft-deleted vouchers, and unposted effects do not affect rows or totals.
- Opening balances use posted movement before the selected start date inside the same fiscal year.
- Period debit and period credit show raw period movement totals.
- Closing balances use normal-balance-aware presentation, including opposite-side presentation when a signed account balance reverses its normal side.
- Empty valid reports return zero totals, `isBalanced: true`, `difference: "0.00"`, and `rows: []`.

No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Income Statement, or Balance Sheet implementation were added.

## Phase 2C Implementation Planning

Phase 2C adds only planning documentation. It splits voucher implementation into 6 chunks:

- Chunk 2C-1: Voucher schema only (enums, Voucher, VoucherLine, VoucherNumberSequence; no API, no frontend, no posting).
- Chunk 2C-2: Backend draft voucher API (CRUD for drafts, ACCOUNTANT guard, no posting).
- Chunk 2C-3: Posting validation service (all validation rules, immutability, audit events).
- Chunk 2C-4: Frontend draft/create UI (voucher list, line editor, validation display).
- Chunk 2C-5: Posting UI and print foundation (post action, read-only view, browser print layout).
- Chunk 2C-6: Final integration and acceptance review (smoke tests, audit checks, docs update).

- `docs/plans/phase-2c-voucher-implementation-plan.md`: full chunk plan with objectives, files, out-of-scope, verification, smoke tests, model routing, risk levels, and stop conditions.
- `docs/prompts/phase-2c-chunk-1-voucher-schema-prompt.md`: prompt for schema-only Chunk 2C-1 implementation.

No Prisma schema changes, no migrations, no backend changes, no frontend changes in Phase 2C planning.

## Phase 2C Chunk 2C-1 Voucher Schema Foundation

Chunk 2C-1 added only the Prisma voucher schema foundation and migration:

- `VoucherType`: `DEBIT`, `CREDIT`, `JOURNAL`, `CONTRA`, `PAYMENT`, `RECEIPT`.
- `VoucherStatus`: `DRAFT`, `POSTED`.
- `VoucherLineSide`: `DEBIT`, `CREDIT`.
- `Voucher`, `VoucherLine`, and `VoucherNumberSequence` models.
- Back-relations on existing Company, FiscalYear, AccountingPeriod, LedgerAccount, Project, CostCenter, CashBankAccount, and User models.
- Migration: `20260614163238_phase_2c_voucher_schema_foundation`.

No API, frontend UI, posting service, reports, parties, customers, vendors, file uploads, roles, or seed data were added.

## Phase 2C Chunk 2C-2 Backend Draft Voucher API

Chunk 2C-2 added a NestJS voucher module at `apps/api/src/voucher` for draft voucher list/detail/create/update plus draft soft-delete. Every route requires an authenticated user and the `ACCOUNTANT` role through the existing `AuthGuard` + `RolesGuard` pattern. No global `/api` prefix.

Endpoints:

- `GET /vouchers`: list non-deleted vouchers with optional `voucherType`, `status`, `fiscalYearId`, and `accountingPeriodId` filters; includes fiscal year, accounting period, `createdBy`/`postedBy` basic info, and a line count.
- `GET /vouchers/:id`: voucher detail with ordered lines and their ledger account, project, cost center, and cash/bank account relations; 404 for missing or soft-deleted vouchers.
- `POST /vouchers`: create a `DRAFT` voucher. `companyId` is derived from the fiscal year; `systemVoucherNo` is generated transactionally from `VoucherNumberSequence` scoped by company + fiscal year + voucher type (format `TYPE-NNNNN`). `createdById` comes from the authenticated user; `postedById`/`postingDate` stay null. `totalDebit`/`totalCredit` are computed on the server from line amounts; `lineNo` is assigned from array order. Client `status`, `systemVoucherNo`, `companyId`, totals, and posting fields are rejected by the whitelist validation pipe.
- `PATCH /vouchers/:id`: update a `DRAFT` voucher only; posted vouchers are immutable (400). Narration cannot become blank. When lines are supplied they replace the draft lines transactionally and totals are recalculated. `systemVoucherNo` never changes. Status and posting fields cannot be set.
- `DELETE /vouchers/:id`: soft-delete a `DRAFT` voucher (`isDeleted=true`, `deletedAt=now`). Posted vouchers cannot be deleted; no hard delete. The consumed `systemVoucherNo` is never reused.

Validation in this chunk: fiscal year exists, accounting period exists and belongs to the fiscal year, voucher date inside both the fiscal year and accounting period ranges, ledger accounts exist and are active, optional project/cost center/cash-bank references exist when provided, positive line amounts, valid line side, narration required at the API level, and no client-controlled totals/status/posting fields. Audit events `VOUCHER_CREATED`, `VOUCHER_EDITED`, and `VOUCHER_DELETED` are recorded in the existing `AuditEvent` model.

Deferred to Chunk 2C-3: debit total must equal credit total before posting, accounting period must be OPEN before posting, `requiresProject`/`requiresCostCenter` enforcement, `isCashBank`/cash-bank consistency enforcement, the posting endpoint, the `VOUCHER_POSTED` audit event, and reversal/correction policy.

No frontend, posting service, posting endpoint, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, or tooling were added. No Prisma schema change or migration was made.

## Phase 2C Chunk 2C-3 Backend Posting Validation Service

Chunk 2C-3 extended the existing backend voucher module with `POST /vouchers/:id/post`. The endpoint uses the same class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` protection as the other `/vouchers` routes.

Posting behavior:

- Only active, non-deleted `DRAFT` vouchers can be posted.
- On success, posting runs inside a Prisma transaction, sets `status=POSTED`, sets `postingDate`, sets `postedById` from the authenticated user, recalculates `totalDebit` and `totalCredit` from existing voucher lines, preserves `systemVoucherNo`, leaves voucher lines unchanged, and records `VOUCHER_POSTED` in `AuditEvent`.
- Posted vouchers remain immutable through the existing PATCH/DELETE draft-only checks.

Posting validations implemented:

- Voucher exists and is not soft-deleted.
- Voucher status is `DRAFT`.
- Voucher has at least two lines.
- Header narration is present and not blank.
- Debit total equals credit total and total amount is greater than zero.
- Fiscal year exists, is active, and is not closed.
- Accounting period exists, belongs to the voucher fiscal year, and has status `OPEN`.
- Voucher date is inside both fiscal year and accounting period ranges.
- Every ledger account is active.
- `requiresProject`, `requiresCostCenter`, active Project, active CostCenter, and CostCenter-to-Project consistency are enforced.
- Cash/bank account references must be active, belong to the same line ledger account, and only appear with cash/bank ledger accounts.
- Cash/bank ledger accounts require `cashBankAccountId` at posting time.
- Payment, Receipt, and Contra cash/bank side rules are enforced at posting time.

No frontend, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, tooling, Prisma schema changes, migrations, or financial statement/report tables were added.

## Phase 2C Chunk 2C-4 Frontend Voucher Draft/Create UI

Chunk 2C-4 added the accountant-facing voucher draft UI on top of the existing backend, with no backend, schema, or migration changes.

- Extended `apps/web/src/lib/api.ts` with voucher types (`Voucher`, `VoucherLine`, `VoucherType`, `VoucherStatus`, `VoucherLineSide`, `VoucherUserRef`, `VoucherListFilters`), request payload types (`CreateVoucherInput`, `UpdateVoucherInput`, `CreateVoucherLineInput`), and cookie-authenticated helpers `getVouchers`, `getVoucher`, `createVoucher`, `updateVoucher`, and `deleteVoucher`. All use the existing `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`. Decimal fields (`amount`, `totalDebit`, `totalCredit`) are typed as strings to match the API serialization.
- Added a `Vouchers` navigation link to `apps/web/src/app/app/layout.tsx` pointing at `/app/vouchers`.
- Added `apps/web/src/app/app/vouchers/page.tsx`: a voucher list with `systemVoucherNo`, type, voucher date, accounting period, status badge, debit/credit totals, and `createdBy`. Filters for voucher type, status, fiscal year, and accounting period (period choices are scoped to the selected fiscal year). A New voucher action and per-row Open (draft) / View (posted) action. No posting button and no reports.
- Added `apps/web/src/app/app/vouchers/new/page.tsx` and `apps/web/src/app/app/vouchers/[id]/page.tsx` backed by a shared `VoucherForm` component and a `useVoucherReference` loader hook in `apps/web/src/app/app/vouchers/_lib/`. The form has the header (voucher type, fiscal year, accounting period filtered by fiscal year, voucher date, physical SI no., narration) and a debit/credit line editor (side, ledger account, project, cost center, cash/bank account shown only for cash/bank ledgers, description, amount). It enforces at least two lines, supports add/remove line, shows server line numbers, and displays debit total, credit total, and difference with a balance indicator.
- Draft behavior: unbalanced drafts can be saved with a clear, non-blocking warning that posting will require matching debit and credit totals. The UI still blocks obviously invalid submissions (missing fiscal year/period/date, missing ledger account, amount <= 0, more than two decimals, blank narration) and surfaces backend validation errors through the shared `Notice`.
- Posted vouchers opened from the list render read-only (all inputs disabled, no save/delete) with an informational notice. No posting action is included; posting UI and print layout remain Chunk 2C-5.
- Only active ledger accounts, projects, cost centers, and cash/bank accounts are offered for new line selections; an already-selected inactive ledger account is preserved on an existing line.

No posting UI, print layout, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, tooling, Prisma schema changes, migrations, or backend API changes were added.

## Implemented Features

- pnpm workspace monorepo.
- Next.js App Router frontend.
- NestJS API.
- Prisma ORM.
- PostgreSQL 17 through Docker Compose.
- API health endpoint at `GET /health`.
- PostgreSQL host-port isolation on `localhost:55432`.
- Phase 0 documentation and handoff.
- Phase 1A documentation, ADRs, scripts, and auth foundation.
- Phase 1B requirement/spec lock documents for the accounting foundation implementation.
- Phase 2A Chunk 1: accounting-foundation Prisma models (`Company`, `FiscalYear`, `AccountingPeriod`, `Project`, `CostCenter`, `AccountClass`, `AccountGroup`, `LedgerAccount`, `CashBankAccount`) and a fixed five-class `AccountClass` system seed.
- Phase 2A Chunk 2: backend accounting foundation API guarded by the `ACCOUNTANT` role - `/company`, `/fiscal-years` (+ `/:id/activate`), `/accounting-periods`, `/projects`, `/cost-centers`, `/account-classes`, `/account-groups`, `/ledger-accounts`, `/cash-bank-accounts`.
- Phase 2A Chunk 3A frontend foundation:
  - Typed, cookie-authenticated API helper (`apps/web/src/lib/api.ts`) using `credentials: "include"`, an `ApiError` type with clear auth/connection messages, and no token storage in `localStorage`.
  - Protected `/app` shell layout with real navigation.
  - `/app/company` Company Setup page (create or edit the singleton company profile).
  - `/app/fiscal-years` Fiscal Years page (list, create, edit, activate, with active/closed status).
  - `/app/projects` Projects page (list, create, edit).
  - `/app/accounts/classes` read-only Account Classes page.
- Phase 2A Chunk 3B frontend foundation:
  - `/app/accounting-periods` Accounting Periods page (list, create, edit; fiscal-year dropdown; OPEN/LOCKED/CLOSED status).
  - `/app/cost-centers` Cost Centers page (list, create, edit/deactivate; project dropdown).
  - `/app/accounts/groups` Account Groups page (list, create, edit/deactivate; account-class dropdown).
  - `/app/accounts/ledger` Ledger Accounts page (list, create, edit/deactivate; normal balance and requirement flags).
  - `/app/cash-bank` Cash & Bank page (list, create, edit/deactivate; only ledger accounts marked Cash/Bank are selectable).
  - The Phase 2A accounting foundation frontend is now implemented.

## Confirmed Role Model

Only one role is confirmed now:

- `ACCOUNTANT`, displayed as `Accountant`

Future roles are to be confirmed later. They are not implemented, seeded, displayed, or modeled.

## Current Non-Features

The repo intentionally does not include journals beyond the voucher draft/post workflow, MFS Book frontend page, MFS voucher posting support, Project Summary, Cost Center Summary, PDF/Excel export, dashboard analytics, payroll, salary sheets, project finance reports, parties, customers, vendors, file uploads, ERP modules, business seed data, bKash/MFS runtime implementation beyond the backend MFS account API, the frontend MFS account setup UI, and the backend MFS Book report API, or unconfirmed office roles.

The Phase 2E MFS / bKash requirement lock is complete and accepted at `fdffcfb`. Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at `c820d7b`. Phase 2E Chunk 2E-3 backend validation/API changes are accepted at `97e69ab`. Phase 2E Chunk 2E-4 frontend MFS account setup UI is implemented, but MFS runtime is still incomplete beyond account setup. The Phase 2D accounting reports implementation is complete and accepted. Phase 2D added backend report APIs for all six reports, frontend report pages for all six reports, and a browser print foundation for all six report pages. Project Summary and Cost Center Summary (backend and frontend) and PDF/Excel export remain deferred.

## Database Port

Host tools must connect to PostgreSQL at `localhost:55432`.

Docker maps host `55432` to container `5432`.

## Local Port Caveats

The default web port is `3000`. If it is occupied, run the web app on `3010` and start the API with `WEB_ORIGIN=http://localhost:3010`.

The default API port is `4000`.

## Next Recommended Task

Phase 2E Chunk 2E-6 MFS Book frontend and print foundation is implemented. `/app/reports/mfs-book` exists. The next recommended task is Phase 2E Chunk 2E-7 final integration and acceptance review, unless review finds issues. No MFS voucher posting support, dashboard/report/export expansion, Project Summary, Cost Center Summary, PDF/Excel export, dashboard analytics, payroll, parties, uploads, roles, or new modules should be started without explicit user confirmation.

Reference docs before continuing:

- `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`
- `docs/acceptance/phase-2e-acceptance-criteria.md`
