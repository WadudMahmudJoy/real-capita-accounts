# Real Capita Accounting & Project Finance System Handoff

## Current Phase

Phase 2F Accounting Report + Accountant UX Refinement requirement lock is accepted. Phase 2F Chunk 2F-2 Balance Sheet current P/L inclusion is implemented: the Balance Sheet now includes a report-only Current Period Net Profit/Loss line under Equity, computed from posted INCOME/EXPENSE movements within the same date range and filter scope (additive API fields, no schema/migration/report-table changes). Unadjusted ledger-only totals are preserved alongside the adjusted management view. Phase 2F Chunk 2F-4 report/table layout widening and accounting textbook-style table readability is implemented: the app layout removes the max-w-7xl constraint to use full viewport width; report tables (Ledger, Cash Book, Bank Book, MFS Book) hide less-critical columns (Project, Cost Center, Cash/Bank, Opposite Accounts) from the screen view while preserving them in print; narration and ledger account columns use truncation with tooltip; fiscal year and period dropdowns use compact date labels with full title tooltip; filter panel uses wider 4-column grid. No accounting logic, schema, migration, or report table changes were made. Remaining Phase 2F issues C-F are locked for future chunks. Stop before starting the next implementation chunk without explicit user confirmation.

Phase 2E MFS / bKash transaction support requirement lock is complete and accepted at commit `fdffcfb`. Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at commit `c820d7b`. Phase 2E Chunk 2E-3 backend validation/API changes are accepted at commit `97e69ab`. Phase 2E Chunk 2E-4 frontend MFS account setup UI is accepted at commit `be2392a`. Phase 2E Chunk 2E-5 MFS Book report API is accepted at commit `d90ffd4`. Phase 2E Chunk 2E-6 MFS Book frontend and print foundation is accepted. Phase 2E MFS account setup and MFS Book foundation are now accepted. MFS voucher posting support is deferred to a later explicitly approved chunk/phase.

Phase 0 is complete and accepted. Phase 1A delivered the secure login, the single confirmed Accountant role, the protected app shell, agent documentation, ADRs, and verification scripts. Phase 1B locked the accounting foundation requirements and acceptance criteria. Phase 2A implemented the accounting foundation in schema, backend, and frontend. Phase 2B locked voucher requirements before any voucher implementation. Phase 2C implemented the voucher engine and is complete and accepted. Phase 2D implemented the accounting report APIs, frontend report pages, and browser print foundation and is now accepted. Phase 2E Chunk 2E-1 locked the MFS / bKash transaction support requirements and is accepted. Phase 2E Chunk 2E-2 implemented the backend schema/model foundation. Phase 2E Chunk 2E-3 implemented backend account API validation for MFS setup. Phase 2E Chunk 2E-4 implemented the frontend MFS account setup UI and is accepted. Phase 2E Chunk 2E-5 implemented the backend MFS Book report API and is accepted. Phase 2E Chunk 2E-6 implemented the MFS Book frontend and print foundation. Phase 2F Accounting Report + Accountant UX Refinement requirement lock is accepted.

## Phase 2F Documentation Lock - completed this session (accepted)

- Created `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md`: locks six issues (A: Balance Sheet P/L inclusion, B: report/table layout readability, C: voucher line dynamic field visibility, D: Cash/Bank/MFS report filter UX clarity, E: dropdown/table text clipping, F: demo/test data cleanliness). Confirmed business context, single-role rule, accounting book direction (textbook-style tables preferred), explicit out-of-scope list, accounting source rule, security rule, and open questions. No runtime code changes.
- Created `docs/acceptance/phase-2f-acceptance-criteria.md`: acceptance for documentation lock, future Balance Sheet P/L implementation (additive API fields, no schema/migration/report-table changes, adjusted and unadjusted views), future layout implementation (wider viewport for reports, textbook-style columns), future voucher line visibility (required/optional/hidden based on ledger flags, backend authority preserved), future filter UX clarity (advanced filters or clear labels, verify backend behavior first), future clipping fixes (concise labels, tooltips, appropriate widths), future demo data planning (strategy documentation only). Regression criteria preserve all existing report behavior.
- Created `docs/plans/phase-2f-accounting-report-ux-refinement-plan.md`: seven chunks (2F-1 requirement lock review, 2F-2 backend Balance Sheet P/L computation and API response extension, 2F-3 frontend Balance Sheet P/L display, 2F-4 report/table layout widening and textbook-style columns, 2F-5 voucher line dynamic field visibility, 2F-6 report filter UX and dropdown/table text clipping, 2F-7 final integration and acceptance review). Each chunk has objective, scope, files, implementation approach, verification, and stop condition.
- Updated `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, and `docs/handoff.md` to reflect Phase 2F requirement lock.
- No Prisma schema changes, migrations, backend API endpoints, frontend pages, MFS voucher posting support, PDF/Excel export, dashboard analytics, report tables, roles, seed data, or runtime code changes were made.

- Full integration review across all Phase 2E chunks: schema, backend account API, frontend MFS account setup, backend MFS Book report API, frontend MFS Book report page, and print foundation.
- Verified scope boundaries: only MFS account schema/model, backend account API validation, frontend MFS account setup, backend MFS Book report, frontend MFS Book page, and browser print foundation were implemented. No Project Summary, Cost Center Summary, report tables, PDF/Excel export, dashboard analytics, payroll, parties/customers/vendors, extra roles, file uploads, business seed data, MFS voucher posting support, or MFS provider API integration were added.
- Confirmed all MFS endpoints are guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- Confirmed MFS Book derives only from `Voucher.status = POSTED` and `Voucher.isDeleted = false`.
- Confirmed Cash Book remains CASH-only, Bank Book remains BANK-only, MFS Book remains MFS-only.
- Confirmed voucher posting still rejects MFS cash-bank accounts.
- Confirmed only `ACCOUNTANT` role exists in the implemented scope.
- Confirmed auth uses HttpOnly cookie behavior; no localStorage token usage.
- Confirmed no schema/migration/report table was added beyond the approved Phase 2E schema foundation.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, and `pnpm doctor` (port warning only).
- Docs updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, and `docs/handoff.md` reflect Phase 2E acceptance.
- No backend or frontend source changes were made in 2E-7.

## Phase 2E Chunk 2E-6 MFS Book Frontend and Print Foundation - completed this session (accepted)

- Added frontend route/page `/app/reports/mfs-book` using the shared `CashBankBookReport` component scoped to `accountType="MFS"`, following the same filter/table/print pattern as Cash Book and Bank Book.
- Extended `apps/web/src/lib/api.ts`: added `"MFS_BOOK"` to `CashBankReport.reportType` union, added MFS metadata fields to `ReportCashBankAccountSummary`, added cookie-authenticated `getMfsBookReport` helper.
- Extended `CashBankBookReport.tsx`: widened the allowed account type to CASH | BANK | MFS, added MFS variant (title, description, empty label), wired the `getMfsBookReport` endpoint, and added MFS-specific display in the report summary (provider, wallet/account ID, account holder), transaction line table (Provider column for MFS), and print layout (provider, wallet).
- Extended `report-ui.tsx`: updated `cashBankLabel` to show MFS provider name, added `providerDisplayName` helper.
- Added MFS Book navigation link under Reports in the app sidebar with the `Smartphone` icon.
- Print foundation reuses existing `ReportPrintFrame` with MFS-specific metadata.
- No backend code, Prisma schema, or migration changes. No MFS voucher posting support. Cash Book remains CASH-only and Bank Book remains BANK-only.

## Phase 2E Chunk 2E-5 MFS Book Report API - completed this session (accepted)

- Added guarded backend endpoint `GET /reports/mfs-book` in the existing report module.
- The endpoint uses the existing class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` report-route protection.
- MFS Book derives only from `VoucherLine` rows attached to `Voucher.status = POSTED`, `Voucher.isDeleted = false`, and `CashBankAccount.accountType = MFS`.
- MFS Book structurally mirrors Cash Book / Bank Book: fiscal year, optional accounting period, date range, MFS account (scoped to MFS type only), filters, opening/period/closing balances, lines with running balances, and opposite accounts.
- CASH or BANK `cashBankAccountId` on MFS Book returns 400; MFS `cashBankAccountId` returns MFS metadata (provider, providerOtherName, walletNumber, accountHolderName) in account summaries.
- Query validation reuses the existing `resolveReportContext` pattern.
- No Prisma schema changes, migrations, report tables, frontend MFS Book page, MFS Book navigation link, dashboard/export/PDF/Excel, provider API integration, statement import, seed data, or MFS voucher posting support were added. MFS voucher posting remains blocked from Phase 2E Chunk 2E-3.

## Phase 2E Chunk 2E-4 Frontend MFS Account Setup UI - completed this session (accepted)

- Extended `apps/web/src/lib/api.ts`: added `MFS` to `CashBankAccountType`, added the `MfsProvider` type (`BKASH`, `NAGAD`, `ROCKET`, `UPAY`, `OTHER`), added nullable `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName` to the `CashBankAccount` type, and added the same optional fields to the `CashBankAccountInput` create/update payload type. Preserved the cookie-authenticated `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`.
- Updated `apps/web/src/app/app/cash-bank/page.tsx` (route `/app/cash-bank`) into the Cash, Bank & MFS setup page. The account type dropdown offers CASH, BANK, and MFS. When MFS is selected the form shows Provider (required), Provider name (required, shown only for provider = Other), Wallet number / account ID (required), and an optional Account holder name; bank name/branch/account number are hidden for MFS. CASH and BANK forms are unchanged and never show MFS fields. Client-side validation catches missing MFS provider/wallet/custom-provider before submit; backend validation errors surface through the shared `Notice`. The list/table shows the friendly account type label and, for MFS rows, the provider and wallet identifier; CASH/BANK rows show the bank name as before. A calm note explains MFS voucher posting is not enabled yet.
- Updated the sidebar label in `apps/web/src/app/app/layout.tsx` from "Cash & Bank" to "Cash, Bank & MFS". No new sidebar route or section was added.
- No backend code, Prisma schema, or migration changes. No voucher UI change, no MFS Book API, no MFS Book frontend page, no Reports navigation change, no dashboard cards, no PDF/Excel export, no provider integration, and no seed data were added. MFS voucher posting remains blocked by the backend.

## Phase 2E Chunk 2E-3 Backend Validation / API Changes - completed previous session

- Opened the existing guarded `cash-bank-accounts` API to `accountType = MFS` while preserving existing `AuthGuard`, `RolesGuard`, and `ACCOUNTANT` access.
- Added DTO support for `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName`.
- Enforced MFS validation: provider is required, wallet number is required, `providerOtherName` is required only for `provider = OTHER`, and non-`OTHER` providers clear `providerOtherName`.
- CASH and BANK accounts still do not require MFS metadata; MFS-only metadata is cleared server-side on CASH/BANK writes.
- MFS setup requires a linked ledger account marked `isCashBank` and active. CASH/BANK ledger linkage behavior is otherwise preserved.
- Existing list/update responses include nullable MFS metadata fields through the existing `CashBankAccount` model response.
- Added a narrow posting safety block: voucher posting rejects MFS cash-bank accounts so MFS posting support cannot leak in before the planned voucher/report chunks.
- Cash Book remains CASH-only and Bank Book remains BANK-only. No MFS Book endpoint/page, frontend MFS account page, sidebar/navigation change, report API expansion, provider integration, seed data, or new role was added.

## Phase 2E Chunk 2E-2 Backend Schema / Model Foundation - completed this session

- Updated `prisma/schema.prisma` with `CashBankAccountType.MFS` as a separate account type beside `CASH` and `BANK`.
- Added `MfsProvider` enum values: `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, and `OTHER`.
- Extended `CashBankAccount` with nullable MFS metadata fields: `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName`.
- Created and applied migration `20260615123515_phase_2e_mfs_schema_foundation`.
- Existing CASH and BANK rows are migration-safe because the new MFS-specific columns are nullable and existing enum values are unchanged.
- Added a backend guard in `apps/api/src/cash-bank/cash-bank.service.ts` so the existing generic Cash & Bank API still rejects `accountType = MFS` until Phase 2E Chunk 2E-3 backend validation/API work deliberately opens that path.
- Preserved existing Cash Book and Bank Book semantics. Cash Book remains filtered to `CASH`; Bank Book remains filtered to `BANK`.
- No MFS Book endpoint, report page, frontend MFS account page, sidebar/navigation change, voucher posting behavior change, MFS transaction template, provider integration, statement import, PDF/Excel export, dashboard analytics, seed data, or role was added.

## Next Stop Point

Phase 2F Chunk 2F-2 Balance Sheet current P/L inclusion is implemented. Phase 2F Chunk 2F-4 report/table layout widening is implemented. The next recommended task is Phase 2F Chunk 2F-5 voucher line dynamic field visibility, or Phase 2F Chunk 2F-6 Cash/Bank/MFS advanced filter UX clarity, only if the user explicitly confirms. Do not start MFS voucher posting support, Project Summary, Cost Center Summary, PDF/Excel export, dashboard, payroll, parties, uploads, roles, or any new module without explicit user confirmation.

## Phase 2E MFS / bKash Requirement Lock - completed this session

- Created `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`: defines MFS / bKash transaction support requirements, terminology, providers, role boundary, accounting source rule, cash/bank/MFS separation, voucher behavior, report behavior (MFS Book), validation, print/report, security/privacy, exclusions, and open questions. Current status: future requirement, not implemented.
- Created `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`: proposes CashBankAccountType extension (CASH, BANK, MFS), MfsProvider enum, wallet/account number and account holder name concepts, explains why bKash should not be forced under BANK or CASH, voucher-line impact, report impact, decimal handling, backend authority, migration risk notes. No current code changes.
- Created `docs/acceptance/phase-2e-acceptance-criteria.md`: acceptance for documentation lock, future backend, future frontend, report correctness, security, regression, and explicit non-acceptance conditions.
- Created `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md`: 7 chunks (2E-1 through 2E-7) with model recommendations, scope, files, verification, smoke tests, and stop conditions.
- Updated `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, and `docs/handoff.md` to reflect Phase 2E requirement lock.
- No Prisma schema changes, no migrations, no backend API endpoints, no frontend pages, no MFS runtime logic, no roles, no seed data, and no tooling were added.
- Phase 2D acceptance state is preserved. Phase 2D is accepted at `be482c2`. The `phase-2d-complete` tag exists.

## Next Stop Point (superseded by 2E-2)

Phase 2E requirement lock was accepted at `fdffcfb`. Chunk 2E-2 backend schema/model foundation is now implemented; see the section above.

## Phase 2D Chunk 2D-7 Final Integration and Acceptance Review - completed previous session
- Confirmed accounting correctness: Ledger opening/period/closing/running balance, Cash Book/Bank Book cash/bank linked lines, Trial Balance totals and difference, Income Statement uses INCOME/EXPENSE only with correct net income formula, Balance Sheet uses ASSET/LIABILITY/EQUITY only, does not force balance, does not invent retained earnings, all money output uses stable two-decimal Prisma.Decimal strings.
- Confirmed all six frontend report routes render under protected app shell with appropriate filters per report type.
- Confirmed browser print foundation: Print button appears after report load on all six pages, uses `window.print()` only, no PDF/Excel/file upload. Print layout includes Real Capita Group heading, report title, period/date context, filters, report body, totals, generated timestamp, and signature placeholders.
- Confirmed existing areas still work: login/logout/auth session, `/app` shell, `/app/vouchers`, posted voucher print, all accounting foundation pages.
- Confirmed bKash/MFS support is documented only as a future request with no runtime implementation, schema changes, or UI logic.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, and `pnpm doctor`.
- Manual API smoke tests passed: all six report endpoints return 401 unauthenticated; login succeeds; all six endpoints return valid structures with authenticated valid filters; IS rejects `ledgerAccountId`; BS rejects `startDate`; Ledger requires `ledgerAccountId`; trial balance returns `isBalanced` with zero difference.
- Manual browser smoke tests passed: login to `/app` shell; all six report navigation links present; Income Statement page renders with date range (not asOfDate); vouchers page renders with posted/draft distinction; posted voucher detail shows read-only view with Print button; unauthenticated report page access redirects to `/login`.
- Docs updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, and `docs/handoff.md` reflect Phase 2D completion and acceptance.

## Phase 2D Chunk 2D-7 Final Integration and Acceptance Review

Phase 2D final integration and acceptance review (Chunk 2D-7) confirmed scope, security, accounting correctness, frontend pages, print foundation, regression, and documentation. All six backend report endpoints are `AuthGuard + RolesGuard + ACCOUNTANT` protection. All six frontend report pages render under the protected app shell. All six report pages have a browser print button wired to `window.print()`. No Project Summary, Cost Center Summary, report tables, Prisma schema changes, migrations, PDF/Excel export, dashboard analytics, payroll, parties/customers/vendors, roles, uploads, seed data, bKash/MFS implementation, approval workflow, or voucher reversal/correction were added in Phase 2D. Phase 2D is now accepted.

- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`, `pnpm doctor` (port warnings only).
- All six backend report endpoints return 401 for unauthenticated requests and valid structures with authenticated requests.
- All six frontend report pages render, show correct filters, handle errors and empty states.
- All six print buttons appear after report load, trigger `window.print()`.
- Existing voucher pages and foundation pages still build and render.
- Posted voucher detail and print button still work.
- Unauthenticated access to report pages redirects to `/login`.
- bKash/MFS: documented only as a future request. No runtime implementation.

## Next Stop Point

Phase 2D is accepted and complete. Do not start Phase 2E, bKash/MFS implementation, Project Summary, Cost Center Summary, dashboard, payroll, parties, uploads, roles, PDF/Excel export, or any new module without explicit user confirmation. The next recommended task is to create a separate requirement lock for bKash/MFS support, or pause before Phase 2E.

## Phase 2D Chunk 2D-6 Frontend Financial Statement Pages and Report Print Foundation - completed previous session

- Added the accountant-facing Income Statement and Balance Sheet frontend pages plus a browser-print foundation for every approved report page, on top of the existing backend financial statement APIs. No backend code, Prisma schema, or migration changes were made.
- Extended `apps/web/src/lib/api.ts` with string-money financial statement types (`FinancialStatementGroupSummary`, `IncomeStatementRow`, `IncomeStatementSection`, `IncomeStatementReport`, `BalanceSheetRow`, `BalanceSheetSection`, `BalanceSheetReport`), added an optional `asOfDate` to `ReportQueryParams` (carried through `buildReportQuery`), and added cookie-authenticated helpers `getIncomeStatementReport` and `getBalanceSheetReport`. Both use the existing `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`. No Project Summary or Cost Center Summary helpers were added.
- Added a print foundation module `apps/web/src/app/app/reports/_lib/report-print.tsx`: a `PrintReportButton` (calls `window.print()` only) and a `ReportPrintFrame` print-only layout (Real Capita Group heading, report title, report context meta, report body, generated date/time, and prepared/checked/authorised signature placeholders) using `@media print` CSS modelled on the voucher print foundation. No PDF generation, no Excel export, no file uploads.
- Extended the shared `ReportFilters` panel (`_lib/report-ui.tsx`) with `showDateRange` (default true) and `showAsOfDate` config options and an `asOfDate` field so the Balance Sheet uses an optional point-in-time as-of date instead of a start/end range, while the Income Statement keeps the optional custom date range.
- Added routes and pages:
  - `/app/reports/income-statement`: requires fiscal year; optional period, custom date range, project, cost center (no ledger account, no cash/bank account, no as-of date). Renders report header, total income, total expense, net income with profit/loss state, and grouped Income and Expense sections (account code/name, debit movement, credit movement, amount) with section totals. A balanced empty report shows zero totals and a calm empty state.
  - `/app/reports/balance-sheet`: requires fiscal year; optional period, as-of date, project, cost center (no start/end date, no ledger account, no cash/bank account). Renders report header, Assets/Liabilities/Equity sections (account code/name, debit movement, credit movement, balance), total assets, total liabilities, total equity, total liabilities and equity, difference, and `isBalanced`. When unbalanced it shows a clear warning and never hides or forces the difference. It does not invent virtual retained earnings; it shows only what the backend returns.
- Added a "Print report" button (shown after a report loads) and a print-only `ReportPrintFrame` layout to all six report pages: Ledger, Cash Book, Bank Book, Trial Balance (existing pages updated), and Income Statement and Balance Sheet (new). Each print layout includes the Real Capita Group heading, report title, fiscal year, accounting period or date range / as-of date, selected filters, the report table/sections, totals, a generated timestamp, and signature placeholders.
- Added `Income Statement` and `Balance Sheet` links to the existing `Reports` navigation section in `apps/web/src/app/app/layout.tsx`. No dashboard cards or analytics.
- Every page handles reference loading, report loading, empty reference data, client-side validation before submit (fiscal year required; paired custom dates and `startDate <= endDate` on the income statement), backend validation errors, unauthenticated redirect through the existing app shell, and calm empty states for empty results.
- No Project Summary, Cost Center Summary, Project Summary API, Cost Center Summary API, report tables, PDF/Excel export, approval workflow, voucher reversal/correction, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, tooling, Prisma schema changes, migrations, or backend API changes were added.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web` (routes `/app/reports/income-statement` and `/app/reports/balance-sheet` built), `pnpm build:api`, `docker compose config`, `pnpm check:all`, and `pnpm doctor` (doctor warns only that ports 3000/4000 are occupied by the running dev apps used for smoke tests).
- Manual checks passed against the running API at `http://localhost:4000` and web at `http://localhost:3000`: unauthenticated `GET /reports/income-statement` returns 401; login as `accountant@realcapita.local` succeeds; `GET /reports/income-statement` without `fiscalYearId` returns 400; with a fiscal year it returns income/expense sections, `income.total`, `expenses.total`, `netIncome`, and `isProfit`; `GET /reports/balance-sheet` returns `asOfDate`, asset/liability/equity sections with totals, `totalLiabilitiesAndEquity`, `difference`, and `isBalanced`; the balance sheet rejects `startDate`/`endDate` with 400 and accepts an optional `asOfDate`. The web routes `/app/reports/income-statement`, `/app/reports/balance-sheet`, `/app/reports/ledger`, `/app/reports/cash-book`, `/app/reports/bank-book`, and `/app/reports/trial-balance` all serve 200. The "Print report" button is wired to `window.print()` and appears only after a report has loaded on each report page; existing voucher and foundation pages still build and serve.

## Next Stop Point (2D-7 accepted)

Phase 2D is complete and accepted. Phase 2E requirement lock is complete. The next recommended task is to review/accept the Phase 2E requirement lock, then confirm implementation if approved.

## Future Request Note: bKash / MFS Transaction Support (now locked in Phase 2E)

bKash/MFS transaction support was requested by AGM sir and is now locked in Phase 2E. See `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md` and related Phase 2E docs. No runtime implementation exists yet.

## Phase 2D Chunk 2D-5 Frontend Operational Report Pages - completed this session

- Added the accountant-facing frontend report pages on top of the existing backend report APIs. No backend code, Prisma schema, or migration changes were made.
- Extended `apps/web/src/lib/api.ts` with stable, string-money report types (`ReportFiscalYearSummary`, `ReportAccountingPeriodSummary`, `ReportDateRange`, `ReportFilterSummary`, `ReportBalanceSummary`, `ReportLedgerAccountWithGroup`, `ReportCashBankAccountSummary`, `LedgerReport`, `CashBankReport`, `TrialBalanceReport`, `ReportQueryParams`, and supporting summaries) and cookie-authenticated helpers `getLedgerReport`, `getCashBookReport`, `getBankBookReport`, and `getTrialBalanceReport`. All use the existing `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`. No Income Statement or Balance Sheet helpers were added.
- Added a `Reports` navigation section in `apps/web/src/app/app/layout.tsx` with links to Ledger Statement, Cash Book, Bank Book, and Trial Balance. No dashboard cards or analytics.
- Added shared report utilities in `apps/web/src/app/app/reports/_lib/`:
  - `useReportReferences.ts`: loads fiscal years, accounting periods, ledger accounts, projects, cost centers, and cash/bank accounts for the filter dropdowns; redirects unauthenticated users to `/login`.
  - `report-ui.tsx`: money/date/normal-balance-aware formatting helpers, label helpers, presentational primitives (`ReportMeta`, `SummaryGrid`), and a reusable `ReportFilters` panel that validates the fiscal-year requirement, the optional ledger-account requirement, and custom date-range pairing before emitting a clean `ReportQueryParams`. Cash/bank reports scope the cash/bank dropdown and the ledger dropdown to the requested account type so the user cannot pick an account the backend would reject.
  - `CashBankBookReport.tsx`: shared Cash Book / Bank Book page used by both routes, scoped by cash/bank account type.
- Added routes and pages:
  - `/app/reports/ledger`: requires fiscal year and ledger account; optional period, date range, project, cost center. Renders report header, opening balance, period debit, period credit, closing balance, and the line table (date, voucher no., type, narration, line description, debit, credit, running balance, project, cost center, cash/bank account).
  - `/app/reports/cash-book` and `/app/reports/bank-book`: require fiscal year; optional period, date range, cash/bank account, ledger account, project, cost center. Render report header, opening/period/closing balances, and the line table (cash/bank account, ledger account, opposite accounts, debit, credit, running balance, project, cost center).
  - `/app/reports/trial-balance`: requires fiscal year; optional period, date range, project, cost center. Renders totals (opening/period/closing debit and credit, difference, balanced flag), a clear balanced/unbalanced notice that never hides or forces the difference, and a row table (code, name, group/class, opening/period/closing debit and credit) with a totals footer.
- Every page handles reference loading, report loading, empty reference data, client-side validation before submit, backend validation errors, unauthenticated redirect through the existing app shell, and calm empty states for empty results.
- No Income Statement frontend, Balance Sheet frontend, Project Summary, Cost Center Summary, report print layout, PDF/Excel export, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, tooling, Prisma schema changes, migrations, or backend API changes were added.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`, and `pnpm doctor` (doctor warns only that ports 3000/4000 are occupied by the running dev apps used for smoke tests).
- Manual checks passed against the running API at `http://localhost:4000`: unauthenticated `GET /reports/ledger` returns 401; login as `accountant@realcapita.local` succeeds; `GET /reports/ledger` without `ledgerAccountId` returns 400; `GET /reports/ledger` with fiscal year + ledger account returns opening/period/closing balances and lines; `GET /reports/cash-book` and `GET /reports/bank-book` return valid structures with the correct `accountType`; `GET /reports/trial-balance` returns closing debit/credit, `isBalanced`, and `difference` (balanced sample: closing debit 1500.00 = closing credit 1500.00, difference 0.00, 4 rows); a single custom date returns a clear 400. The web routes `/app/reports/ledger`, `/app/reports/cash-book`, `/app/reports/bank-book`, and `/app/reports/trial-balance` all serve, and existing voucher/foundation pages still build.

## Next Stop Point (2D-5)

Review the Phase 2D-5 frontend operational report pages. The next recommended task is 2D-5 frontend report pages review before starting Chunk 2D-6 financial statement frontend pages and print foundation. Do not start 2D-6, financial statement frontend, print/export, Project Summary, Cost Center Summary, dashboard, payroll, parties, uploads, roles, or any new phase without explicit user confirmation.

## Phase 2D Chunk 2D-4 Backend Income Statement and Balance Sheet API - completed this session

- Added guarded backend endpoints `GET /reports/income-statement` and `GET /reports/balance-sheet` in the existing report module.
- Both endpoints use the existing class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` report-route protection.
- Added optional `asOfDate` field to `ReportQueryDto` for the balance sheet point-in-time query.
- Reports derive only from `VoucherLine` rows attached to `Voucher.status = POSTED` and `Voucher.isDeleted = false`.

### Income Statement (`GET /reports/income-statement`)

- Period-based report using only INCOME and EXPENSE account classes.
- Uses existing shared report query validation for fiscal year, accounting period, and date range.
- Income accounts: credit increases income, debit decreases income (signed amount = credit - debit).
- Expense accounts: debit increases expense, credit decreases expense (signed amount = debit - credit).
- Net income = total income - total expense (isProfit flag when net income >= 0).
- Rows and groups sorted by account class (Income before Expense), account group code/name, ledger account code/name.
- Rejects `ledgerAccountId`, `cashBankAccountId`, and `asOfDate` with clear 400 errors.
- Empty valid reports return zero totals, empty rows/groups, `isProfit: true`.

### Balance Sheet (`GET /reports/balance-sheet`)

- As-of-date based report using only ASSET, LIABILITY, and EQUITY account classes.
- `asOfDate` determines the point-in-time; falls back to `accountingPeriod.endDate`, then `fiscalYear.endDate`.
- Asset accounts: debit increases, credit decreases (signed amount = debit - credit).
- Liability accounts: credit increases, debit decreases (signed amount = credit - debit).
- Equity accounts: credit increases, debit decreases (signed amount = credit - debit).
- Cumulative movements from `fiscalYear.startDate` through `asOfDate` inclusive.
- Balance check: `difference = totalAssets - totalLiabilitiesAndEquity`, `isBalanced` when difference is zero.
- Rows and groups sorted by account class (Asset, Liability, Equity), account group code/name, ledger account code/name.
- Rejects `ledgerAccountId`, `cashBankAccountId`, `startDate`, and `endDate` with clear 400 errors.
- `asOfDate` must fall inside the fiscal year date range; when `accountingPeriodId` is also provided, `asOfDate` must also fall inside the period.
- Empty valid reports return zero totals, empty rows/groups, `isBalanced: true`, `difference: "0.00"`.
- Does not invent virtual retained earnings; reports only posted voucher line movements. If Income/Expense closing entries are not posted, the balance sheet may not balance and reports `isBalanced` and `difference` honestly.

### Money values

- All money values are returned as two-decimal strings using `Prisma.Decimal.toFixed(2)`, consistent with existing report API.

### Regression

- Existing `GET /reports/ledger`, `GET /reports/cash-book`, `GET /reports/bank-book`, and `GET /reports/trial-balance` still work after the change.

### Files changed

- `apps/api/src/report/dto/report-query.dto.ts`: added `asOfDate` optional ISO8601 field.
- `apps/api/src/report/report.controller.ts`: added `income-statement` and `balance-sheet` endpoints.
- `apps/api/src/report/report.service.ts`: added `getIncomeStatement`, `getBalanceSheet`, `resolveBalanceSheetContext`, `buildBalanceSheetVoucherFilter`, and supporting helper methods and types.

### Not added

- No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Project Summary, Cost Center Summary, PDF/Excel export, or report UI.

## Next Stop Point (2D-4)

Review Phase 2D-4 backend Income Statement and Balance Sheet API. The next recommended task is 2D-4 backend financial statement API review before starting Chunk 2D-5 frontend report pages.

## Phase 2D Chunk 2D-3 Backend Trial Balance API - completed this session

- Added guarded backend endpoint `GET /reports/trial-balance` in the existing report module.
- The endpoint uses the existing class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` report-route protection.
- Query behavior uses required `fiscalYearId` and optional `accountingPeriodId`, custom `startDate`/`endDate`, `projectId`, and `costCenterId`. `ledgerAccountId` is not required for Trial Balance.
- Shared report validation applies: fiscal year existence, accounting-period existence and fiscal-year ownership, paired custom dates, `startDate <= endDate`, date range inside the fiscal year, date range inside the selected accounting period when provided, project and cost-center existence, and cost-center-to-project consistency.
- Trial Balance derives only from `VoucherLine` rows attached to `Voucher.status = POSTED` and `Voucher.isDeleted = false`.
- `DRAFT` vouchers, soft-deleted vouchers, and unposted effects do not affect rows or totals.
- Opening balances use posted movement before the selected start date inside the same fiscal year. Period debit/credit totals show raw selected-range movement. Closing debit/credit uses normal-balance-aware presentation, including opposite-side presentation when an account balance reverses its normal side.
- The report returns `reportType: "TRIAL_BALANCE"`, fiscal year, optional accounting period, date range, project/cost-center filters, totals (`openingDebit`, `openingCredit`, `periodDebit`, `periodCredit`, `closingDebit`, `closingCredit`, `isBalanced`, `difference`), and ledger-account rows.
- Empty valid reports return zero totals, `isBalanced: true`, `difference: "0.00"`, and `rows: []`.
- Existing `GET /reports/ledger`, `GET /reports/cash-book`, and `GET /reports/bank-book` still work after the change.
- No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Income Statement, Balance Sheet, Project Summary, Cost Center Summary, PDF/Excel export, or report UI were added.

## Next Stop Point (2D-3)

Review Phase 2D-3 backend Trial Balance API. The next recommended task is 2D-3 backend Trial Balance API review before starting Chunk 2D-4 Income Statement and Balance Sheet API.

## Phase 2D Chunk 2D-2 Backend Report API Review - completed this session

- Reviewed the 2D-2 backend report API implementation at `apps/api/src/report` against the Phase 2D requirement lock, query model proposal, acceptance criteria, and implementation plan.
- Confirmed scope stayed limited to backend report module/controller/service/DTO, `AppModule` registration, and docs updates. No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Trial Balance, Income Statement, Balance Sheet, Project Summary, or Cost Center Summary were added.
- Confirmed routes exist and are guarded by `AuthGuard`, `RolesGuard`, and `ACCOUNTANT`: `GET /reports/ledger`, `GET /reports/cash-book`, and `GET /reports/bank-book`.
- Confirmed reports derive only from posted, non-deleted vouchers and attached voucher lines: `Voucher.status = POSTED`, `Voucher.isDeleted = false`, and `VoucherLine` rows.
- Confirmed ledger calculation behavior: opening balance from posted movement before the selected start date inside the fiscal year; period debit/credit from the selected range; closing balance from opening plus normal-balance-aware period movement; deterministic line ordering.
- Confirmed Cash Book and Bank Book behavior: cash report is cash-type only, bank report is bank-type only, optional cash/bank account and ledger account filters work safely, and running balances use debit minus credit.
- Manual API smoke checks passed: unauthenticated ledger returns 401; accountant login works; ledger/cash-book/bank-book return valid structures; posted lines affect totals; temporary draft and soft-deleted draft lines do not affect totals; invalid date range, invalid fiscal year, invalid accounting period, period/fiscal-year mismatch, period date mismatch, project/cost-center mismatch, and wrong cash/bank account type return clear 400/404 responses; valid empty ledger returns zero totals and empty lines.
- No backend source fixes were needed. Stale project docs were corrected where older sections still said report APIs were not implemented.

## Previous Stop Point (2D-2 Review)

Phase 2D-2 backend report API review is superseded by the completed Chunk 2D-3 backend Trial Balance API. See the current 2D-3 stop point above.

## Phase 2D Chunk 2D-2 Backend Ledger/Cash-Book/Bank-Book API - completed this session

- Added `apps/api/src/report/report.module.ts`, `apps/api/src/report/report.controller.ts`, `apps/api/src/report/report.service.ts`, and `apps/api/src/report/dto/report-query.dto.ts`.
- Registered `ReportModule` in `apps/api/src/app.module.ts`.
- Added guarded backend endpoints:
  - `GET /reports/ledger`: General Ledger / Ledger Statement for one required `ledgerAccountId`.
  - `GET /reports/cash-book`: Cash Book for cash-type cash/bank posted voucher lines.
  - `GET /reports/bank-book`: Bank Book for bank-type cash/bank posted voucher lines.
- All report routes use the existing class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` pattern.
- Reports are derived only from `VoucherLine` rows attached to `Voucher.status = POSTED` and `Voucher.isDeleted = false`.
- Shared query behavior supports required `fiscalYearId`, optional `accountingPeriodId`, optional `startDate`/`endDate`, optional `projectId`, optional `costCenterId`, optional `ledgerAccountId`, and optional `cashBankAccountId`.
- Date range behavior: accounting period date range is used when selected without custom dates; custom ranges require both dates, must have `startDate <= endDate`, must fit inside the selected fiscal year, and must also fit inside the selected accounting period when one is supplied.
- Ledger report returns fiscal year, optional accounting period, date range, ledger account summary with account group/class, filters, opening balance, period debit/credit, closing balance, ordered lines, and normal-balance-aware running balances.
- Cash Book and Bank Book return fiscal year, optional accounting period, date range, account/filter summaries, opening balance, period debit/credit, closing balance, ordered lines, opposite accounts, and debit-minus-credit running balances.
- No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Trial Balance, Income Statement, or Balance Sheet implementation were added.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:api`, `pnpm build:web`, `docker compose config`, `pnpm check:all`, and `pnpm doctor` (doctor warnings only for ports 4000 and 3000 already occupied by local processes).
- Manual API smoke tests passed against `http://localhost:4000`: unauthenticated `GET /reports/ledger` returned 401; login as `accountant@realcapita.local` succeeded; `GET /reports/ledger` returned opening/period/closing totals and lines; `GET /reports/cash-book` returned valid cash-book structure; `GET /reports/bank-book` returned valid bank-book structure; a temporary DRAFT voucher did not affect ledger totals or line count and was cleaned from the local smoke database; invalid date range returned 400; wrong cash/bank account type for cash-book and bank-book returned 400.

## Previous Stop Point (2D-2 Implementation)

Phase 2D-2 backend ledger/cash-book/bank-book report API implementation is superseded by the completed 2D-2 review. See the current 2D-2 review stop point above.

## Phase 2D Accounting Reports Requirement Lock - completed this session

- Created `docs/requirements/phase-2d-accounting-reports-requirement-lock.md`: defines eight accounting reports (General Ledger, Cash Book, Bank Book, Trial Balance, Income Statement, Balance Sheet, Project Summary, Cost Center Summary), core report principle (derived from posted vouchers only, no primary report tables), debit/credit behavior and balance presentation, opening balance policy (opening journal vouchers, no separate table), report date filtering (fiscal year, period, custom range, project, cost center, ledger account), cash/bank behavior, print/export expectations (browser print foundation, PDF/Excel deferred), security (ACCOUNTANT only), and explicit out-of-scope list.
- Created `docs/architecture/phase-2d-report-query-model-proposal.md`: proposes report architecture with no new primary report tables, service layer (report module, report service, ledger/cash-bank/trial-balance/financial-statement services), shared report query DTO, proposed API endpoints (8 GET endpoints under `/reports/`), accounting formulas (debit/credit movement, opening/closing balance, normal-balance-aware presentation), financial statement grouping by AccountClass, report query validation, performance considerations (existing indexes sufficient, aggregation queries, future materialized views deferred), and print/export architecture (browser print first, PDF/Excel later only if confirmed).
- Created `docs/acceptance/phase-2d-acceptance-criteria.md`: acceptance for documentation lock, future backend report API, future frontend report UI, report correctness (traceability to posted VoucherLine, trial balance balance check, ledger/cash/bank running balance, income statement net profit, balance sheet balance check), security, print/export, smoke tests, and explicit out-of-scope list.
- Created `docs/decisions/ADR-0008-phase-2d-report-requirement-lock.md`: documents the decision to lock report requirements before implementation, reports derive from posted VoucherLine records, no report tables as primary source, eight reports defined, opening balances through opening journal vouchers, browser print foundation, ACCOUNTANT role only.
- Created `docs/plans/phase-2d-accounting-reports-implementation-plan.md`: splits report implementation into 7 chunks (2D-1 requirement lock review, 2D-2 backend ledger/cash-book/bank-book API, 2D-3 backend trial balance API, 2D-4 backend income statement and balance sheet API, 2D-5 frontend ledger/cash-book/bank-book/trial-balance pages, 2D-6 frontend financial statement pages and print foundation, 2D-7 final integration and acceptance review). Each chunk includes objective, files, out-of-scope, verification, smoke tests, recommended/fallback models, risk level, and stop conditions.
- Created `docs/prompts/phase-2d-next-prompt.md`: future prompt for the next agent to review Phase 2D docs only, explicitly stating no implementation, no schema changes, no report API, no frontend pages, check consistency with Phase 2C posted voucher workflow.
- Updated `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md`, `AGENTS.md`, `docs/ai/START_HERE.md` to reflect Phase 2D requirement lock.
- No Prisma schema changes, no migrations, no backend API endpoints, no frontend pages, no reports, no dashboard analytics, no payroll, no parties/customers/vendors, no roles, no file uploads, no seed data, and no tooling were added in Phase 2D.

## Phase 2D Chunk 2D-1 Requirement Lock Review - completed this session

- Reviewed all Phase 2D documentation (requirement lock, architecture proposal, acceptance criteria, ADR, implementation plan, next prompt) for consistency with the Phase 2C posted voucher workflow and Phase 2A accounting foundation.
- Confirmed 13 review goals all pass: docs are specification-only, reports derive from posted VoucherLine only, DRAFT and soft-deleted vouchers excluded, no primary report tables, eight reports clearly defined, normal-balance-aware logic explained, opening balance policy clear (opening journal vouchers, no separate table), Cash Book/Bank Book derive from posted cash/bank-linked voucher lines, report filters defined, ACCOUNTANT role only, out-of-scope list clear, implementation chunks safe and ordered (2D-1 through 2D-7).
- Fixed stale Phase 2B/1A guidance in `AGENTS.md`: updated "Strict Current Boundary" from Phase 1A boundary to Phase 2D boundary, updated "Confirmed Role Model" to remove Phase 1A qualifier, updated "Phase 2B Requirement Lock" section to reference Phase 2D docs, updated "Agent Switching" step 3 to reference Phase 2D docs.
- Updated `docs/ai/CURRENT_STATE.md`: added Chunk 2D-1 completion note, updated "Next Recommended Task" to point to Chunk 2D-2.
- Updated `docs/handoff.md`: updated current phase header.
- No Prisma schema changes, no migrations, no backend API endpoints, no frontend pages, no reports, no dashboard analytics, no payroll, no parties/customers/vendors, no roles, no file uploads, no seed data, and no tooling were added.

## Previous Stop Point (2D-1)

Phase 2D-1 requirement lock review is superseded by the completed Chunk 2D-2 backend report API. See the current 2D-2 stop point above.

## Phase 2C Chunk 2C-6 Final Integration and Acceptance Review - completed this session

- Full integration review across all five prior chunks: schema, backend draft API, posting validation, frontend draft/create UI, and posting UI/print foundation.
- Verified scope boundaries: only voucher schema, backend draft API, posting service, frontend draft/create UI, and posting UI/print were implemented. No reports, dashboard analytics, payroll, parties/customers/vendors, extra roles, file uploads, business seed data, financial statement/report tables, or copied old ERP code were added in Phase 2C.
- Confirmed all `/vouchers` routes are guarded by `AuthGuard` + `RolesGuard` + `ACCOUNTANT` role. Unauthenticated access returns 401.
- Confirmed draft create, update, and soft-delete still work. System voucher number is generated atomically per company+fiscalYear+voucherType and never reused.
- Confirmed `POST /vouchers/:id/post` transitions draft to POSTED, sets `postingDate` and `postedById`, records `VOUCHER_POSTED` audit event. Posted vouchers are immutable (PATCH and DELETE blocked with 400).
- Confirmed posting validation: debit=credit balance required, OPEN period required, active fiscal year required, ledger account active check, project/cost center requirement enforcement, cost center-to-project consistency, cash/bank account consistency, Payment/Receipt/Contra type-specific rules.
- Confirmed audit events exist for `VOUCHER_CREATED`, `VOUCHER_EDITED`, `VOUCHER_DELETED`, and `VOUCHER_POSTED`.
- Confirmed frontend `/app` navigation includes Vouchers link. Voucher list renders with draft/posted distinction, "View" action for posted, "Open" action for drafts (Pencil icon).
- Confirmed voucher draft create/edit form with line editor, debit/credit totals, balance indicator, unbalanced draft warning. Only active references are selectable.
- Confirmed posting confirmation panel with rules summary. Posting transitions to read-only posted view with `postedBy` and `postingDate` info.
- Confirmed posted voucher read-only view: all inputs disabled, no edit/delete/post controls, "Print voucher" button present.
- Confirmed `VoucherPrintLayout` component renders Real Capita Group header, voucher type, system voucher number, physical SI no, date, fiscal year, accounting period, narration, debit/credit line table, totals, amount in words (Bangladeshi-style English, Taka/Paisa, Lac/Crore), prepared-by/posted-by/authorised-by signature areas, and footer. Uses `@media print` CSS with `window.print()`; no PDF generation, no file uploads.
- Manual API smoke tests passed: unauthenticated access blocked (401), login works, draft creation with server-computed totals and system voucher number, unbalanced draft posting blocked (400), balanced draft posting successful with immutable posted voucher, PATCH/DELETE on posted blocked (400), soft-delete of drafts works.
- Manual browser smoke tests passed: login → `/app` shell, voucher list with correct status badges and actions, posted voucher detail shows `postedBy`/`postingDate`, read-only inputs, Print button, no edit/delete controls, unauthenticated navigation to voucher pages redirects to login.
- No Prisma schema changes, no migrations, no backend API changes, no frontend feature additions, no reports, no dashboard analytics, no payroll, no parties/customers/vendors, no roles, no file uploads, no seed data, and no tooling were added in 2C-6.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`, and `pnpm doctor` (doctor warns only that ports 3000/4000 are occupied by running apps used for smoke tests).
- Docs updated: `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md`, and `AGENTS.md` reflect Phase 2C completion.

## Phase 2C Chunk 2C-5 Posting UI and Print Foundation - completed this session

- Added `postVoucher` helper in `apps/web/src/lib/api.ts`: calls `POST /vouchers/:id/post` with `credentials: "include"`, returns the posted `Voucher`. No token storage, no report helpers.
- Enhanced `VoucherForm` in `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx`:
  - **Posting action for DRAFT vouchers**: a "Post voucher" button appears on draft edit pages. Clicking it opens an inline confirmation panel explaining posting is permanent, immutable, and validates all rules (debit/credit balance, fiscal year/period status, ledger/project/cost-center/cash-bank rules). The "Confirm and post" button calls the backend and on success navigates to the same URL to refresh the view with posted data. On failure, backend validation errors are shown clearly without losing form data.
  - **Posted voucher read-only view**: shows `systemVoucherNo` prominently in the title, voucher type, date, fiscal year, accounting period, narration, status badge, debit/credit lines in a clean table, totals, and difference. Shows `postedBy` full name and `postingDate` in the notice when available. All inputs are disabled; no edit, delete, or post controls are shown.
  - **Print foundation**: a "Print voucher" button appears on posted voucher detail. A `VoucherPrintLayout` component renders a professional, print-only voucher layout with Real Capita Group header, voucher type, system voucher number, physical SI no, date, fiscal year, accounting period, narration, debit/credit line table, totals, amount in words (Bangladeshi-style English), prepared-by/posted-by/authorised-by signature areas, and footer. Uses `@media print` CSS and `window.print()` for browser print; no PDF generation.
  - **Amount-to-words helper**: converts numbers to Bangladeshi-style English words (Taka/Paisa, Lac/Crore) for the print layout.
- Voucher list improvements in `/app/vouchers`: POSTED vouchers show "View" action (with Eye icon), DRAFT vouchers show "Open" action (with Pencil icon). Status badges visually distinguish Draft (amber) from Posted (green). No posting action from the list; posting is only from the detail page.
- No Prisma schema changes, no migrations, no backend API changes, no reports, no dashboard analytics, no payroll, no parties/customers/vendors, no roles, no file uploads, no seed data, and no tooling were added.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`, and `pnpm doctor`.
- Manual browser smoke tests passed: login as accountant; `/app/vouchers` renders with draft and posted voucher distinction; draft detail shows "Post voucher" button; confirmation panel appears with correct rules summary; posting succeeds and navigates to read-only posted view; posted view shows `postedBy` and `postingDate`; editing controls are disabled; "Print voucher" button appears for posted vouchers; print layout contains header, lines, totals, amount in words, and signature areas. Unauthenticated access to voucher pages redirects to login.

## Next Stop Point (2C-5)

Review the Phase 2C-5 posting UI and print foundation. The next proposed task is Chunk 2C-6 final integration and acceptance review, but it must not begin until explicitly confirmed by the user.

## Phase 2C Chunk 2C-4 Frontend Voucher Draft/Create UI - completed this session

- Extended `apps/web/src/lib/api.ts` with voucher resource types and request payloads (`Voucher`, `VoucherLine`, `VoucherType`, `VoucherStatus`, `VoucherLineSide`, `VoucherListFilters`, `CreateVoucherInput`, `UpdateVoucherInput`, `CreateVoucherLineInput`) and cookie-authenticated helpers `getVouchers`, `getVoucher`, `createVoucher`, `updateVoucher`, `deleteVoucher`, all using the existing `apiFetch` with `credentials: "include"` and no `localStorage` tokens. Decimal fields are typed as strings to match API serialization.
- Added a `Vouchers` navigation link in `apps/web/src/app/app/layout.tsx` for `/app/vouchers`.
- Added `apps/web/src/app/app/vouchers/page.tsx`: voucher list with `systemVoucherNo`, type, voucher date, accounting period, status, debit/credit totals, and `createdBy`; filters for voucher type, status, fiscal year, and accounting period (period choices scoped to the chosen fiscal year); New voucher action and per-row Open (draft) / View (posted). No posting button, no reports.
- Added `apps/web/src/app/app/vouchers/new/page.tsx` and `apps/web/src/app/app/vouchers/[id]/page.tsx`, backed by a shared `VoucherForm` and a `useVoucherReference` loader in `apps/web/src/app/app/vouchers/_lib/`. The form covers the header (voucher type, fiscal year, fiscal-year-filtered accounting period, voucher date, physical SI no., narration) and a debit/credit line editor (side, ledger account, project, cost center, cash/bank account shown only for cash/bank ledgers, description, amount) with add/remove line, at-least-two-lines enforcement, server line numbers, and debit/credit/difference totals with a balance indicator.
- Unbalanced drafts can be saved with a clear non-blocking warning; the UI still blocks missing required header fields, missing ledger account, amount <= 0, more than two decimals, and blank narration, and surfaces backend validation errors. Posted vouchers open read-only with no posting action.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`, and `pnpm doctor` (doctor warns only that port 4000 is occupied by the running API used for smoke tests).
- Manual API smoke tests passed against `http://localhost:4000`: unauthenticated `GET /vouchers` returns 401; login as `accountant@realcapita.local` succeeds; the UI create payload produced a draft with generated `systemVoucherNo` `PAYMENT-00001` and server-computed totals (debit 500 / credit 300 for an unbalanced draft); PATCH rebalanced the lines to 400/400 and kept the voucher number; the type/status filters returned the draft with `createdBy.fullName`; a negative-amount create was rejected with a clear message; DELETE soft-deleted the draft and the list returned to empty. Smoke-test voucher rows were cleaned up afterward.
- No posting UI, print layout, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, tooling, Prisma schema changes, migrations, or backend API changes were added.

## Next Stop Point (2C-4)

Review the Phase 2C-4 frontend voucher draft/create UI. The next proposed task is Chunk 2C-5 posting UI and print foundation, but it must not begin until explicitly confirmed by the user.

## Phase 2C Chunk 2C-3 Backend Posting Validation Service - completed this session

- Extended the existing NestJS voucher module with `POST /vouchers/:id/post`, guarded by the existing class-level `AuthGuard` + `RolesGuard` for the `ACCOUNTANT` role.
- Posting runs inside a Prisma transaction. On success it sets `status=POSTED`, sets `postingDate`, sets `postedById` from the authenticated user, recalculates `totalDebit` and `totalCredit` from existing voucher lines, preserves `systemVoucherNo`, leaves voucher lines unchanged, and records `VOUCHER_POSTED` in `AuditEvent`.
- Posting validations implemented: active non-deleted draft voucher only; at least two lines; nonblank narration; debit total equals credit total; total amount greater than zero; active and not-closed fiscal year; `OPEN` accounting period; fiscal year/period ownership and date-range checks; active ledger accounts; `requiresProject`; `requiresCostCenter`; active project/cost center references; cost center belongs to selected project when both are provided; cash/bank account active, belongs to the line ledger account, and only used with cash/bank ledger accounts; cash/bank ledger lines require `cashBankAccountId`; Payment/Receipt/Contra cash-bank side rules.
- Manual API smoke tests passed against `http://localhost:4011`: login; unauthenticated post returns 401; balanced draft posts successfully; returned voucher is `POSTED`; `postingDate` and `postedById` are set; `VOUCHER_POSTED` audit event exists; PATCH and DELETE on posted voucher fail; unbalanced voucher fails; LOCKED and CLOSED period posting fails; missing required project fails; missing required cost center fails; cash/bank ledger line without `cashBankAccountId` fails; cost center from a different project fails. Smoke-test rows were cleaned up afterward.
- No frontend, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, tooling, Prisma schema changes, migrations, or financial statement/report tables were added.

## Next Stop Point

Review the Phase 2C-3 backend posting validation service. The next proposed task is Chunk 2C-4 frontend voucher draft/create UI, but it must not begin until explicitly confirmed by the user.

## Phase 2C Chunk 2C-2 Backend Draft Voucher API - completed this session

- Added a NestJS voucher module at `apps/api/src/voucher`: `voucher.module.ts`, `voucher.controller.ts`, `voucher.service.ts`, and DTOs `dto/voucher-line.dto.ts`, `dto/create-voucher.dto.ts`, `dto/update-voucher.dto.ts`, `dto/list-vouchers-query.dto.ts`.
- Registered `VoucherModule` in `apps/api/src/app.module.ts`.
- Implemented draft-only endpoints, all guarded by `AuthGuard` + `RolesGuard` for the `ACCOUNTANT` role, with no global `/api` prefix:
  - `GET /vouchers` (non-deleted only; optional `voucherType`, `status`, `fiscalYearId`, `accountingPeriodId` filters; includes fiscal year, accounting period, `createdBy`/`postedBy` basic info, and line count).
  - `GET /vouchers/:id` (voucher with ordered lines and ledger account, project, cost center, cash/bank relations; 404 if missing or soft-deleted).
  - `POST /vouchers` (creates `DRAFT` only; `companyId` derived from fiscal year; `systemVoucherNo` generated transactionally from `VoucherNumberSequence` scoped by company + fiscal year + voucher type, format `TYPE-NNNNN`; `createdById` from authenticated user; `postedById`/`postingDate` stay null; `totalDebit`/`totalCredit` computed server-side; `lineNo` assigned from array order).
  - `PATCH /vouchers/:id` (DRAFT only; posted vouchers immutable; narration cannot become blank; lines, when provided, replace draft lines transactionally and recalculate totals; `systemVoucherNo` unchanged).
  - `DELETE /vouchers/:id` (soft-delete a DRAFT via `isDeleted`/`deletedAt`; posted vouchers cannot be deleted; no hard delete; consumed voucher numbers are not reused).
- Voucher numbering: `VoucherNumberSequence` is upserted then atomically incremented inside the create transaction (per company + fiscal year + voucher type). The deleted-draft number stays consumed.
- Validation implemented: fiscal year exists; accounting period exists and belongs to the fiscal year; voucher date inside both fiscal year and accounting period ranges; ledger accounts exist and are active; optional project/cost center/cash-bank references exist when provided; positive line amounts; valid line side; narration required at the API level; no client-controlled totals/status/`systemVoucherNo`/posting fields (rejected by the whitelist `ValidationPipe`).
- Audit events `VOUCHER_CREATED`, `VOUCHER_EDITED`, and `VOUCHER_DELETED` recorded in the existing `AuditEvent` model.
- Deferred to Chunk 2C-3: debit equals credit before posting, accounting period must be OPEN before posting, `requiresProject`/`requiresCostCenter` enforcement, `isCashBank`/cash-bank consistency, the posting endpoint, the `VOUCHER_POSTED` audit event, and reversal/correction policy.
- No frontend, posting service, posting endpoint, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, or tooling were added. No Prisma schema change or migration was made.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:api`, `pnpm build:web`, `pnpm check:all`, `pnpm doctor`.
- Manual API smoke tests passed against `http://localhost:4000`: unauthenticated `GET /vouchers` returns 401; login as `accountant@realcapita.local` succeeds; draft create returns a generated `systemVoucherNo` (`PAYMENT-00001`) with server-computed totals; list and detail return the draft with lines; PATCH updates narration/lines and recalculates totals while keeping the voucher number; client `status`/`systemVoucherNo`/totals/posting fields are rejected (400); blank narration, bad date range, inactive/nonexistent references, negative amount, and single-line drafts are rejected; unbalanced drafts are allowed with computed totals; per-type numbering increments correctly; soft-delete hides the voucher and PATCH/GET on it return 404; the consumed number is not reused. Smoke-test voucher rows were cleaned up afterward.

## Phase 2C Chunk 2C-2 Next Stop Point (superseded)

Reviewing the Phase 2C-2 backend draft voucher API was the stop point before posting work. Chunk 2C-3 backend posting validation service is now complete; see the section above.

## Phase 2C Chunk 2C-1 Voucher Schema Foundation - completed this session

- Updated `prisma/schema.prisma` with voucher-only schema additions: `VoucherType`, `VoucherStatus`, `VoucherLineSide`, `Voucher`, `VoucherLine`, and `VoucherNumberSequence`.
- Added voucher back-relations on existing `Company`, `FiscalYear`, `AccountingPeriod`, `LedgerAccount`, `Project`, `CostCenter`, `CashBankAccount`, and `User` models.
- Created and applied migration `20260614163238_phase_2c_voucher_schema_foundation`.
- Migration SQL adds only voucher-related enums, tables, indexes, unique constraints, and foreign keys.
- No API, frontend UI, posting service, reports, parties, customers, vendors, file uploads, roles, or seed data were added.
- Verification passed: `pnpm prisma`, `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build` twice, `pnpm check:all`, `pnpm doctor`, and migration sync check.

## Phase 2C Chunk 2C-1 Next Stop Point (superseded)

Reviewing the Phase 2C-1 schema foundation was the stop point before backend work. Chunk 2C-2 backend draft voucher API is now complete; see the section above.

## Phase 2C Voucher Implementation Planning - completed this session

- Created `docs/plans/phase-2c-voucher-implementation-plan.md`: splits voucher implementation into 6 chunks (2C-1 schema only, 2C-2 backend draft API, 2C-3 posting validation service, 2C-4 frontend draft/create UI, 2C-5 posting UI and print foundation, 2C-6 final integration review). Each chunk includes objective, files likely to change, strict out-of-scope, verification commands, manual smoke tests, recommended model, fallback model, risk level, and stop condition.
- Created `docs/prompts/phase-2c-chunk-1-voucher-schema-prompt.md`: future prompt for schema-only implementation of Chunk 2C-1, explicitly stating no API, no frontend, no posting service, no reports, no new roles, no parties/customers/vendors, no file uploads.
- Updated `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md` to reflect Phase 2C planning.
- No Prisma schema changes, migrations, backend changes, frontend changes, roles, business seed data, file uploads, vouchers, reports, dashboard analytics, payroll, parties, customers, or vendors were added in this planning session.

## Phase 2B Voucher Requirement Lock - completed this session

- Created `docs/requirements/phase-2b-voucher-requirement-lock.md`: defines voucher module purpose, six voucher types (Debit, Credit, Journal, Contra, Payment, Receipt) with overlap clarification, system-generated voucher number, physical SI No, voucher date, fiscal year/period linkage, draft vs posted workflow, posting date, narration/description, debit-credit line structure, LedgerAccount selection, project/cost center requirement validation, cash/bank behavior, audit trail, print/export deferred, attachment deferred, no reports, no parties/customers/vendors.
- Created `docs/architecture/phase-2b-voucher-model-proposal.md`: proposes Voucher, VoucherLine, VoucherType enum, VoucherStatus enum, VoucherNumberSequence models with relations to Phase 2A foundation entities, validation rules, posting rules, reversal/correction policy, deletion policy (no hard delete after posting), draft editing policy, posted editing policy, accounting period lock/close behavior, idempotency/concurrency concerns, and the principle that reports derive from posted VoucherLine records.
- Created `docs/acceptance/phase-2b-acceptance-criteria.md`: defines acceptance for documentation lock, future backend, future frontend, posting validation, security, audit trail, smoke tests, and an explicit out-of-scope list.
- Created `docs/decisions/ADR-0007-phase-2b-voucher-requirement-lock.md`: documents the decision to lock voucher requirements before implementation.
- Created `docs/prompts/droid-cli-phase-2b-next-prompt.md`: future prompt for the next agent to review the Phase 2B docs only, explicitly stating no implementation, no schema changes, no voucher code yet, check consistency with Phase 2A foundation.
- Updated `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md` to reflect Phase 2B docs lock.
- No Prisma schema changes, migrations, backend changes, frontend changes, roles, business seed data, file uploads, vouchers, reports, dashboard analytics, payroll, parties, customers, or vendors were added in Phase 2B.

## Phase 2A Chunk 3B (remaining frontend foundation) - completed this session

- Reused the partial Chunk 3B frontend work already in progress: the shared `Select` primitive, expanded typed API helpers, and active navigation links for the remaining accounting foundation pages.
- Added `apps/web/src/app/app/accounting-periods/page.tsx`: list, create, and edit accounting periods under fiscal years with OPEN, LOCKED, and CLOSED status.
- Added `apps/web/src/app/app/cost-centers/page.tsx`: list, create, edit, and deactivate cost centers under projects.
- Added `apps/web/src/app/app/accounts/groups/page.tsx`: list, create, edit, and deactivate account groups under fixed account classes.
- Added `apps/web/src/app/app/accounts/ledger/page.tsx`: list, create, edit, and deactivate ledger accounts with normal balance, project/cost-center requirement flags, and Cash/Bank eligibility.
- Added `apps/web/src/app/app/cash-bank/page.tsx`: list, create, edit, and deactivate cash/bank accounts linked only to ledger accounts marked as Cash/Bank.
- Phase 2A accounting foundation frontend is now implemented.
- No Prisma schema changes, migrations, backend changes, roles, business seed data, file uploads, vouchers, reports, dashboard analytics, payroll, parties, customers, or vendors were added in Chunk 3B.

## Phase 2A Chunk 3A (frontend foundation) - completed

- Extended `apps/web/src/lib/api.ts` into a typed, cookie-authenticated API helper: `apiFetch` always sends `credentials: "include"`, surfaces clear auth/connection errors through an `ApiError` type, and never stores tokens in `localStorage`. Added resource helpers and types for company, fiscal years, projects, and account classes.
- Added `apps/web/src/app/app/_components/ui.tsx` shared presentation primitives (cards, fields, buttons, status badges, notices) for a calm, professional accountant UI.
- Added `apps/web/src/app/app/layout.tsx`: a protected app shell that gates on `GET /auth/me`, shows the signed-in user and role, provides sign out, and renders real navigation.
- Reworked `apps/web/src/app/app/page.tsx` into a calm overview/landing page with quick links (no analytics, no charts).
- Added `apps/web/src/app/app/company/page.tsx`: create or edit the singleton company profile (name, legalName, address, phone, email, currency default BDT).
- Added `apps/web/src/app/app/fiscal-years/page.tsx`: list, create, edit, and activate fiscal years with active/closed status; uses the singleton company id for creation.
- Added `apps/web/src/app/app/projects/page.tsx`: list, create, and edit projects (code, name, location, notes, isActive).
- Added `apps/web/src/app/app/accounts/classes/page.tsx`: read-only Account Classes table (code, name, normalBalance).
- No Prisma schema changes, no migrations, and no backend changes were made in Chunk 3A.

## Completed

- Created a new standalone repository at `D:\real-capita-accounts`.
- Initialized Git on `main`.
- Created private GitHub repository: `https://github.com/MaruflRana/real-capita-accounts`.
- Added pnpm workspace monorepo structure.
- Added Next.js App Router frontend skeleton with TypeScript, Tailwind CSS, and shadcn/ui configuration.
- Added one professional Phase 0 placeholder page.
- Added NestJS API skeleton with `GET /health`.
- Added minimal `packages/shared`, `packages/ui`, and `packages/config` TypeScript packages.
- Installed Zod through `packages/shared` for future shared validation without adding business schemas.
- Added PostgreSQL 17 Docker Compose setup.
- Isolated the project database on host port `55432`; PostgreSQL still runs inside the container on port `5432`.
- Added Prisma 7 datasource/generator setup with no business-domain models.
- Added Phase 0 documentation.
- Added Phase 1A AI/developer continuity docs in `AGENTS.md`, `.github/copilot-instructions.md`, `docs/ai/*`, and `docs/decisions/*`.
- Added auth-only Prisma models: `User`, `Role`, `UserRole`, `AuthSession`, and `AuditEvent`.
- Added one confirmed role only: `ACCOUNTANT`, displayed as `Accountant`.
- Added one development-only seed user: `accountant@realcapita.local` with full name `Accountant User`.
- Added HttpOnly cookie JWT/session authentication with database-backed session validation.
- Added protected API endpoints: `GET /auth/me`, `GET /auth/session`, and `POST /auth/logout`.
- Added public API endpoint: `POST /auth/login`.
- Added reusable backend role decorator/guard for `@Roles("ACCOUNTANT")`.
- Added frontend routes `/login` and `/app`.
- Added agent helper scripts: `pnpm agent:start`, `pnpm check:all`, and `pnpm doctor`.
- Added Phase 1B requirement lock: `docs/requirements/phase-1b-accounting-foundation-lock.md`.
- Added Phase 1B model proposal: `docs/architecture/phase-1b-accounting-foundation-model-proposal.md`.
- Added Phase 1B acceptance criteria: `docs/acceptance/phase-1b-acceptance-criteria.md`.
- Added Droid CLI next-agent prompt: `docs/prompts/droid-cli-next-prompt.md`.
- Added ADR-0006: `docs/decisions/ADR-0006-phase-1b-doc-lock-before-business-schema.md`.

## Intentionally Not Added

- Dashboard analytics.
- Voucher screens, journals, posting, or transaction workflows (locked in Phase 2B docs only).
- Report frontend pages, financial statements, project/cost-center summaries, or report print layouts.
- Payroll, salary sheets, HR, CRM, party, customer, or vendor modules.
- File uploads.
- Business seed data.
- Unconfirmed office roles.
- Real company documents or private operational data.
- Code copied from the previous Real Capita ERP prototype.

## Next Planned Phase

Phase 2E Chunk 2E-3 backend validation/API changes are complete. The next recommended task is Phase 2E Chunk 2E-4 frontend MFS account setup UI, unless review finds issues. Do not start MFS Book, MFS voucher posting support, Project Summary, Cost Center Summary, dashboard, payroll, parties, uploads, roles, PDF/Excel export, or any new module without explicit user confirmation.

Still not implemented:

- MFS frontend account setup page.
- MFS Book API.
- MFS Book frontend and print foundation.
- MFS voucher posting behavior support.
- Project Summary API.
- Cost Center Summary API.
- Project Summary and Cost Center Summary frontend pages.
- Dashboard analytics.
- Payroll or salary sheets.
- Parties, customers, vendors, HR, CRM, or ERP modules.
- Additional roles beyond `ACCOUNTANT`.
- File uploads.
- Business seed data or private operational data.
- Voucher reversal or correction features.
- PDF/Excel export.

## Last Verification Results

Verification date: 2026-06-15, Phase 2E Chunk 2E-3 backend validation/API changes.

- `pnpm prisma:generate`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build:web`: passed. The build route list still has no MFS account setup page and no MFS Book page.
- `pnpm build:api`: passed.
- `docker compose config`: passed.
- `pnpm check:all`: passed.
- `pnpm doctor`: passed with warnings only that ports 3000 and 4000 were occupied by existing local web/API processes.
- Disposable database smoke used `real_capita_accounts_smoke_2e3` and a temporary API on port `4015`; migrations applied cleanly with `pnpm exec prisma migrate deploy`, seed passed, the API was stopped, and the smoke database was dropped afterwards.
- Backend-safe smoke tests passed: unauthenticated `GET /cash-bank-accounts` returned 401; login as `accountant@realcapita.local` succeeded; CASH and BANK account create/list/update/deactivate still worked; CASH/BANK writes cleared MFS-only metadata; MFS create with `BKASH` and dummy wallet id succeeded; MFS create missing provider returned 400; MFS create missing wallet returned 400; `OTHER` provider without `providerOtherName` returned 400; MFS update/deactivate worked; `GET /cash-bank-accounts` returned MFS metadata.
- Voucher/report smoke passed: existing CASH voucher create/post succeeded; existing BANK voucher create/post succeeded; a draft MFS voucher could be created but posting returned 400 because MFS posting support is intentionally deferred; Cash Book returned `CASH_BOOK` / `CASH`; Bank Book returned `BANK_BOOK` / `BANK`; Trial Balance, Income Statement, and Balance Sheet returned normally; `GET /reports/mfs-book` returned 404.
- Confirmed `apps/web/src/app/app/reports/mfs-book/page.tsx` and `apps/web/src/app/app/mfs` do not exist.
- No MFS Book endpoint/page, frontend MFS account page, sidebar/navigation change, report API expansion, dashboard/report/export expansion, MFS provider integration, seed data, new role, Project Summary, Cost Center Summary, payroll, parties/customers/vendors, uploads, or old ERP code was added.

## Current GitHub Repository

`https://github.com/MaruflRana/real-capita-accounts`
