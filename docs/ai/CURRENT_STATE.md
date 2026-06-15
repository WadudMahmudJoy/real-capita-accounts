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

The repo intentionally does not include journals beyond the voucher draft/post workflow, report frontend pages, financial statements, dashboard analytics, payroll, salary sheets, project finance reports, parties, customers, vendors, file uploads, ERP modules, business seed data, or unconfirmed office roles.

The Phase 2A accounting foundation frontend is implemented. Phase 2B voucher requirement lock is documented. Phase 2C voucher implementation is complete and accepted. Phase 2D accounting reports requirement lock is documented: eight reports defined (General Ledger, Cash Book, Bank Book, Trial Balance, Income Statement, Balance Sheet, Project Summary, Cost Center Summary), derived from posted voucher lines only, no primary report tables, opening balances through opening journal vouchers, browser print foundation. Chunk 2D-2 implemented the backend APIs for General Ledger, Cash Book, and Bank Book. Chunk 2D-3 implemented the backend API for Trial Balance.

## Database Port

Host tools must connect to PostgreSQL at `localhost:55432`.

Docker maps host `55432` to container `5432`.

## Local Port Caveats

The default web port is `3000`. If it is occupied, run the web app on `3010` and start the API with `WEB_ORIGIN=http://localhost:3010`.

The default API port is `4000`.

## Next Recommended Task

Phase 2D Chunk 2D-5 frontend operational report pages (Ledger, Cash Book, Bank Book, Trial Balance) are complete. The next recommended task is 2D-5 frontend report pages review before starting Chunk 2D-6 financial statement frontend pages and print foundation. No Income Statement/Balance Sheet frontend, Project Summary, Cost Center Summary, report print layout, PDF/Excel export, dashboard analytics, payroll, parties, uploads, roles, or new modules should be started without explicit user confirmation.

Reference docs before continuing:

- `docs/plans/phase-2d-accounting-reports-implementation-plan.md`
- `docs/requirements/phase-2d-accounting-reports-requirement-lock.md`
- `docs/architecture/phase-2d-report-query-model-proposal.md`
- `docs/acceptance/phase-2d-acceptance-criteria.md`
