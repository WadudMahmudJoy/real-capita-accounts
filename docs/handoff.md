# Real Capita Accounting & Project Finance System Handoff

## Current Phase

Phase 2D: backend Trial Balance report API implemented (Chunk 2D-3 complete). Stop before Income Statement and Balance Sheet.

Phase 0 is complete and accepted. Phase 1A delivered the secure login, the single confirmed Accountant role, the protected app shell, agent documentation, ADRs, and verification scripts. Phase 1B locked the accounting foundation requirements and acceptance criteria. Phase 2A implemented the accounting foundation in schema, backend, and frontend. Phase 2B locked voucher requirements before any voucher implementation. Phase 2C implemented the voucher engine and is complete and accepted. Phase 2D locked accounting report requirements before report implementation.

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
- Report frontend pages, Trial Balance, financial statements, project/cost-center summaries, or report print layouts.
- Payroll, salary sheets, HR, CRM, party, customer, or vendor modules.
- File uploads.
- Business seed data.
- Unconfirmed office roles.
- Real company documents or private operational data.
- Code copied from the previous Real Capita ERP prototype.

## Next Planned Phase

Phase 2D Chunk 2D-3 backend Trial Balance API is complete. The next task is 2D-3 backend Trial Balance API review before starting Chunk 2D-4 Income Statement and Balance Sheet API.

Still not implemented:

- Income Statement API.
- Balance Sheet API.
- Project Summary API.
- Cost Center Summary API.
- Report frontend pages.
- Report print layouts.
- Financial statements or dashboard analytics.
- Payroll or salary sheets.
- Parties, customers, vendors, HR, CRM, or ERP modules.
- Additional roles beyond `ACCOUNTANT`.
- File uploads.
- Business seed data or private operational data.
- Voucher reversal or correction features.
- PDF/Excel export.

## Last Verification Results

Verification date: 2026-06-15, Phase 2D Chunk 2D-3 backend Trial Balance API.

- `pnpm prisma:generate`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build:api`: passed.
- `pnpm build:web`: passed.
- `pnpm check:all`: passed.
- `pnpm doctor`: passed.
- No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Income Statement, or Balance Sheet implementation in Phase 2D Chunk 2D-3.

## Current GitHub Repository

`https://github.com/MaruflRana/real-capita-accounts`
