# Current State

## Completed Phase

Phase 0 is complete and accepted.

Phase 1A is implemented: multi-agent project continuity plus single-accountant authentication.

Phase 1B requirement/specification lock is complete.

Phase 2A accounting foundation is complete and accepted.

Phase 2B voucher requirement/specification lock is complete.

Phase 2C voucher engine is complete and accepted.

Phase 2D accounting reports are complete and accepted.

Phase 2E MFS / bKash transaction support is complete and accepted (MFS account setup + MFS Book foundation).

Phase 2F Accounting Report + Accountant UX Refinement is complete and accepted at `17fede6` (tag `phase-2f-complete`). Issues A-D implemented, Issue E mostly addressed, Issue F deferred.

## Phase 2G Chunk 2G-1 Project Ledger - completed this session

Phase 2G Chunk 2G-1 Project Ledger API + Frontend Project Ledger Report Page is implemented.

### Backend

- Added `GET /reports/project-ledger` endpoint guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required; returns 400 when missing.
- Report derives from posted voucher lines only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`) where `VoucherLine.projectId` matches the selected project.
- Draft and soft-deleted vouchers are excluded by the shared `buildVoucherDateFilter`.
- Optional filters: `costCenterId` (scoped to selected project via `resolveReportContext`), `ledgerAccountId`, and `voucherType`.
- Lines sorted by voucher date, system voucher number, line number.
- Opening balance = sum of project-tagged debit minus credit before the selected start date.
- Running balance = cumulative debit minus credit across project-tagged lines.
- Money values use `Prisma.Decimal.toFixed(2)` string serialization.
- Added `voucherType` optional field to `ReportQueryDto` with `@IsIn` validation.
- Added `buildProjectLedgerLineFilter`, `findProjectLedgerLines`, and `summarizeProjectLedgerFilters` private helpers.

### Frontend

- Added `ProjectLedgerReport` and `ProjectLedgerReportLine` types in `apps/web/src/lib/api.ts`.
- Added `getProjectLedgerReport` cookie-authenticated helper.
- Added `voucherType` to `ReportQueryParams` and `buildReportQuery`.
- Added `requireProject` and `showVoucherType` config options to `ReportFiltersConfig`.
- Added voucher type dropdown to the shared `ReportFilters` panel.
- Created `/app/reports/project-ledger/page.tsx` with project filter (required), fiscal year filter (required), period/date range, optional cost center, optional ledger account, and optional voucher type.
- Page renders summary cards (Total Debit, Total Credit, Net Movement, Line Count, Opening Balance).
- Line table shows Date, Voucher No (with drill-down link to `/app/vouchers/[id]`), Voucher Type, Ledger, Account Class, Cost Center, Narration/Description, Debit, Credit, Running Net.
- Empty states: "Select a project to view project-tagged posted voucher lines." when no project; "No posted voucher lines are tagged to the selected project" when no data.
- Browser print foundation included via `ReportPrintFrame`.
- Added Project Ledger navigation link under Reports in the app sidebar with `FolderKanban` icon.

### Files changed

- `apps/api/src/report/dto/report-query.dto.ts` -- added `voucherType` optional field with `@IsIn` validation.
- `apps/api/src/report/report.service.ts` -- added `getProjectLedger` method, `buildProjectLedgerLineFilter`, `findProjectLedgerLines`, `summarizeProjectLedgerFilters` helpers.
- `apps/api/src/report/report.controller.ts` -- added `GET /reports/project-ledger` endpoint.
- `apps/web/src/lib/api.ts` -- added `ProjectLedgerReport`, `ProjectLedgerReportLine` types, `getProjectLedgerReport` helper, `voucherType` to `ReportQueryParams` and `buildReportQuery`.
- `apps/web/src/app/app/reports/_lib/report-ui.tsx` -- added `requireProject`, `showVoucherType` to `ReportFiltersConfig`, voucher type dropdown, project required validation.
- `apps/web/src/app/app/reports/project-ledger/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- added Project Ledger navigation link.

### Not added

- No Prisma schema change, no migration, no report table, no new role.
- No MFS voucher posting support.
- No PDF/Excel export, no dashboard analytics.
- No Project Cost Report, Cost Center Summary, Project Financial Summary (Chunks 2G-2 through 2G-4).
- No schema changes to voucher posting logic.

### Verification

All verification passes: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor` (port-occupied warnings only).

## Phase 2G Documentation Lock - this session

Phase 2G Project/Cost-Center Financial Reporting requirement lock is complete and accepted. Phase 2G defines four primary reports (Project Ledger, Project Cost Report, Cost Center Summary, Project Financial Summary) and one optional sub-view (Project Cash/Bank Movement View). All reports derive from posted VoucherLine records only; `projectId` is required for all four primary reports; cost center dropdowns scope to the selected project; asset-class totals labeled separately from expense-class totals. No schema change expected; no new roles; no editable report tables; no dashboard analytics; no PDF/Excel export; no MFS voucher posting support.

Created:
- `docs/requirements/phase-2g-project-cost-center-reporting-requirement-lock.md`: defines four primary reports (A: Project Ledger, B: Project Cost Report, C: Cost Center Summary, D: Project Financial Summary) and one optional sub-view (E: Project Cash/Bank Movement View), with required filters, output columns, rules, API endpoints, accounting source rule, technical constraints, UX constraints, security rule, open questions with recommended answers, and explicit out-of-scope list.
- `docs/acceptance/phase-2g-acceptance-criteria.md`: acceptance for documentation lock, future Project Ledger implementation, future Project Cost Report implementation, future Cost Center Summary implementation, future Project Financial Summary implementation, optional Project Cash/Bank Movement View, regression criteria, and explicit non-acceptance conditions.
- `docs/plans/phase-2g-project-cost-center-reporting-plan.md`: five implementation chunks (2G-1 through 2G-5), each with objective, scope, files to read, files likely to change, in-scope, out-of-scope, acceptance checks, verification commands, recommended model, and stop condition.

Updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

No Prisma schema changes, no migrations, no backend API endpoints, no frontend pages, no MFS runtime logic, no roles, no seed data, and no tooling were added.
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

Phase 2E Chunk 2E-4 frontend MFS account setup UI is accepted at `be2392a`. The accountant can create, view, edit, and deactivate MFS accounts from the existing Cash, Bank & MFS setup page. Phase 2E Chunk 2E-5 MFS Book report API is accepted at `d90ffd4`: `GET /reports/mfs-book` exists. Phase 2E Chunk 2E-6 MFS Book frontend and print foundation is accepted: `/app/reports/mfs-book` exists. Phase 2E MFS account setup and MFS Book foundation are now accepted. MFS voucher posting support is deferred to a later explicitly approved chunk/phase.

Phase 2F Accounting Report + Accountant UX Refinement requirement lock is complete and accepted. Phase 2F locks six issues for future implementation: (A) Balance Sheet current-period profit/loss inclusion in equity, (B) report/table layout readability and textbook-style accounting tables, (C) voucher line dynamic field visibility, (D) Cash/Bank/MFS report filter UX clarity, (E) dropdown/table text clipping fixes, (F) demo/test data cleanliness planning. Issue A is implemented. Issue B (report/table layout widening and textbook-style readability) is implemented: the app layout uses full viewport width, report tables hide less-critical columns to eliminate horizontal scroll, and dropdowns use compact labels with tooltips. Issue C (voucher line dynamic field visibility) is implemented: voucher line Project/Cost Center/Cash-Bank-MFS fields respond to the selected ledger account, required fields are marked, non-required fields are hidden unless a stored value exists, and the Cash/Bank/MFS field is type-labelled and scoped to the ledger's linked accounts. Issue D (report filter UX clarity) is implemented: Cash Book, Bank Book, and MFS Book move Project/Cost Center into a collapsible "Advanced filters" section with clear helper text explaining they are line-level filters on the cash/bank/MFS ledger line itself. Backend verification confirmed `buildLineFilter` applies `projectId`/`costCenterId` directly to the same voucher line row. Issues E-F remain locked for future implementation.

## Phase 2F Chunk 2F-6 Report Filter UX Clarity - completed this session

- Verified Cash/Bank/MFS Book backend filter behavior: `buildLineFilter` in `report.service.ts` applies `projectId` and `costCenterId` directly to the `VoucherLineWhereInput` that also includes `cashBankAccountId`, `cashBankAccountType`, and `requireCashBankLedger` conditions. The project/cost center filter is applied to the **same voucher line** that is being reported (the cash/bank/MFS line itself), not to opposite/related lines or the whole voucher. This is Option A.
- Updated `ReportFiltersConfig` in `report-ui.tsx` with a new `advancedProjectCostCenter` boolean option. When set, the Project and Cost Center fields are removed from the main 4-column filter grid and placed in a collapsible "Advanced filters" section below the grid.
- The advanced section uses a toggle button with a chevron icon and an "active" badge when a project or cost center is selected. When expanded, it shows Project and Cost Center dropdowns side by side with helper text: "Advanced line-level filters. These filter report lines by stored project/cost center metadata on the selected cash/bank/MFS ledger line. Use only when voucher lines carry project or cost center metadata."
- Updated `CashBankBookReport.tsx` to pass `advancedProjectCostCenter: true` and updated the `CardHeader` description to mention "Project and cost center filters are advanced line-level options."
- Applied consistently to all three cash/bank/MFS book pages: `/app/reports/cash-book`, `/app/reports/bank-book`, and `/app/reports/mfs-book`.
- Ledger Statement, Trial Balance, Income Statement, and Balance Sheet filter panels remain unchanged (Project/Cost Center remain in the main grid, appropriate for cross-account reports).
- Dropdown/text clipping: compact labels (`fiscalYearLabelCompact`, `accountingPeriodLabelCompact`) and full title tooltips were already implemented in Phase 2F Chunk 2F-4 and remain in place.
- No backend code, Prisma schema, migration, report table, role, MFS posting, or accounting logic changes were made.
- Files changed: `apps/web/src/app/app/reports/_lib/report-ui.tsx`, `apps/web/src/app/app/reports/_lib/CashBankBookReport.tsx`, plus docs.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor`.

## Phase 2F Chunk 2F-5 Voucher Line Dynamic Field Visibility - completed this session

- Made the voucher line form (`apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx`) field-visibility selection-aware: Project, Cost Center, and Cash/Bank/MFS account fields now derive from the selected ledger account instead of appearing generically on every line.
- Added a small reusable helper `deriveVoucherLineFieldRequirements` plus `cashBankFieldLabel` in `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx`. The helper takes the selected ledger and the cash/bank/MFS accounts linked to it and returns `{ requiresProject, requiresCostCenter, isCashBank, cashBankFieldLabel, guidance }`. This documents the selection-aware UX pattern (UI reacts to the selected reference) intended for reuse in later report-filter and setup-form chunks; it is kept small and pure so it can be lifted to a shared module when that work happens.
- Project field: shown with a required marker when `requiresProject = true`; hidden when not required (unless the line already holds a stored project value, in which case it is shown without a required marker and labelled optional).
- Cost Center field: shown with a required marker when `requiresCostCenter = true`; cost center options are scoped to the selected project (`CostCenter.projectId`); the field is disabled with guidance until a project is selected when a project is also required; hidden when not required (unless a stored value exists).
- Cash/Bank/MFS account field: shown only when `isCashBank = true` (or a stored value exists); labelled by type ("Cash account" / "Bank account" / "MFS wallet" / "Cash/Bank/MFS account") based on the linked accounts; scoped to active accounts linked to the selected ledger; a sole matching account is auto-selected on ledger change; an inline warning is shown when no active linked account exists.
- State cleanup: changing a line's ledger clears stale Project/Cost Center/Cash-Bank values so hidden fields never carry forward unseen data; changing the project clears a cost center that no longer belongs to that project.
- Per-line guidance text replaces the old "Project recommended" / "Cost center recommended" hints with concise notes ("This ledger requires project and cost center.", "Cash account is required for this cash/bank ledger.", "No project or cost center is required for this ledger.").
- Posted vouchers remain read-only (`isReadOnly` when `status === "POSTED"`); the read-only detail view and print layout are unchanged and display stored historical values.
- Backend posting validation in `apps/api/src/voucher/voucher.service.ts` is unchanged and remains the authority (it enforces `requiresProject`, `requiresCostCenter`, cash/bank requirement, cost-center-belongs-to-project, and MFS-posting-deferred). The frontend changes are UX guidance only.
- No Prisma schema change, no migration, no report table, no new role, no new module, no backend accounting logic change, no localStorage token usage. Only two frontend files plus documentation were changed.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, and `pnpm doctor` (port-occupied note only).

## Phase 2E Chunk 2E-7 Final Integration and Acceptance Review - completed this session (accepted)

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

The repo intentionally does not include journals beyond the voucher draft/post workflow, MFS Book frontend page, MFS voucher posting support, Project Summary, Cost Center Summary, PDF/Excel export, dashboard analytics, payroll, salary sheets, project finance reports, parties, customers, vendors, file uploads, ERP modules, business seed data, bKash/MFS runtime implementation beyond the backend MFS account API, the frontend MFS account setup UI, and the backend MFS Book report API, or unconfirmed office roles, voucher line dynamic field visibility, report filter UX clarity, dropdown/table text clipping fixes, demo data cleanliness.

The Phase 2E MFS / bKash requirement lock is complete and accepted at `fdffcfb`. Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at `c820d7b`. Phase 2E Chunk 2E-3 backend validation/API changes are accepted at `97e69ab`. Phase 2E Chunk 2E-4 frontend MFS account setup UI is implemented, but MFS runtime is still incomplete beyond account setup. The Phase 2D accounting reports implementation is complete and accepted. Phase 2D added backend report APIs for all six reports, frontend report pages for all six reports, and a browser print foundation for all six report pages. Project Summary and Cost Center Summary (backend and frontend) and PDF/Excel export remain deferred.

## Database Port

Host tools must connect to PostgreSQL at `localhost:55432`.

Docker maps host `55432` to container `5432`.

## Local Port Caveats

The default web port is `3000`. If it is occupied, run the web app on `3010` and start the API with `WEB_ORIGIN=http://localhost:3010`.

The default API port is `4000`.

## Next Recommended Task

Phase 2G Chunk 2G-1 Project Ledger is implemented. The next recommended step is Phase 2G Chunk 2G-2: Backend Project Cost Report API + Frontend Project Cost Report Page. Do not start Project Cost Report, Cost Center Summary, Project Financial Summary, PDF/Excel export, dashboard, payroll, parties, uploads, roles, MFS voucher posting support, or any new module without explicit user confirmation.

Reference docs before continuing:

- `docs/plans/phase-2f-accounting-report-ux-refinement-plan.md`
- `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md`
- `docs/acceptance/phase-2f-acceptance-criteria.md`
- `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
