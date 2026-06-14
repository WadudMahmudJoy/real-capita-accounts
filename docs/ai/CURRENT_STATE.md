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

The repo intentionally does not include journals beyond the voucher draft/post workflow, ledger reports, cash book, bank book, trial balance, financial statements, reports, payroll, salary sheets, project finance reports, parties, customers, vendors, dashboard analytics, file uploads, ERP modules, business seed data, or unconfirmed office roles.

The Phase 2A accounting foundation frontend is implemented. Phase 2B voucher requirement lock is documented. Phase 2C voucher implementation is complete and accepted. Phase 2D accounting reports requirement lock is documented: eight reports defined (General Ledger, Cash Book, Bank Book, Trial Balance, Income Statement, Balance Sheet, Project Summary, Cost Center Summary), derived from posted voucher lines only, no primary report tables, opening balances through opening journal vouchers, browser print foundation. The next phase (report implementation) must be separately confirmed.

## Database Port

Host tools must connect to PostgreSQL at `localhost:55432`.

Docker maps host `55432` to container `5432`.

## Local Port Caveats

The default web port is `3000`. If it is occupied, run the web app on `3010` and start the API with `WEB_ORIGIN=http://localhost:3010`.

The default API port is `4000`.

## Next Recommended Task

Phase 2D accounting reports requirement lock is prepared. The next task is a review of the Phase 2D docs, then explicit user confirmation before starting Chunk 2D-1 (requirement lock review) and subsequent report implementation chunks. No report API, report UI, dashboard analytics, payroll, parties, uploads, roles, or new modules should be started without explicit user confirmation.

Reference docs before continuing:

- `docs/plans/phase-2d-accounting-reports-implementation-plan.md`
- `docs/requirements/phase-2d-accounting-reports-requirement-lock.md`
- `docs/architecture/phase-2d-report-query-model-proposal.md`
- `docs/acceptance/phase-2d-acceptance-criteria.md`
