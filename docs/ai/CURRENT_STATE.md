# Current State

## Completed Phase

Phase 0 is complete and accepted.

Phase 1A is implemented: multi-agent project continuity plus single-accountant authentication.

Phase 1B requirement/specification lock is complete.

Phase 2A accounting foundation is complete and accepted.

Phase 2B voucher requirement/specification lock is complete.

## Phase 2B Documentation Lock

Phase 2B adds only documentation. It locks voucher module requirements before any voucher implementation:

- `docs/requirements/phase-2b-voucher-requirement-lock.md`: voucher module purpose, six voucher types, overlap clarification, system number, physical SI No, date, period linkage, draft/posted workflow, lines, validation rules, audit trail, deferred items.
- `docs/architecture/phase-2b-voucher-model-proposal.md`: Voucher, VoucherLine, VoucherType, VoucherStatus, VoucherNumberSequence model proposals, validation/posting/reversal/deletion policies, derived reports principle.
- `docs/acceptance/phase-2b-acceptance-criteria.md`: acceptance for documentation lock, future backend/frontend, posting validation, security, audit trail, smoke tests, out-of-scope list.
- `docs/decisions/ADR-0007-phase-2b-voucher-requirement-lock.md`: decision to lock voucher requirements before implementation.
- `docs/prompts/droid-cli-phase-2b-next-prompt.md`: review-only prompt for next agent, no implementation, check consistency with Phase 2A.

No Prisma schema changes, no migrations, no backend changes, no frontend changes in Phase 2B.

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

The repo intentionally does not include vouchers, journals, ledger reports, cash book, bank book, trial balance, financial statements, reports, payroll, salary sheets, project finance reports, parties, customers, vendors, dashboard analytics, file uploads, ERP modules, business seed data, or unconfirmed office roles.

The Phase 2A accounting foundation frontend is implemented. The Phase 2B voucher requirement lock is documented. Voucher implementation, transaction workflows, and reporting are still intentionally outside scope.

## Database Port

Host tools must connect to PostgreSQL at `localhost:55432`.

Docker maps host `55432` to container `5432`.

## Local Port Caveats

The default web port is `3000`. If it is occupied, run the web app on `3010` and start the API with `WEB_ORIGIN=http://localhost:3010`.

The default API port is `4000`.

## Next Recommended Task

The next task should be a review of the Phase 2B documentation for consistency with Phase 2A, then explicit user confirmation before any voucher implementation phase begins.

Reference docs before continuing:

- `docs/requirements/phase-2b-voucher-requirement-lock.md`
- `docs/architecture/phase-2b-voucher-model-proposal.md`
- `docs/acceptance/phase-2b-acceptance-criteria.md`

Do not start voucher implementation, reports, dashboard analytics, payroll, parties/customers/vendors, additional roles, file uploads, or business seed data without explicit user approval for a new phase.
