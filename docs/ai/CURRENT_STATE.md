# Current State

## Completed Phase

Phase 0 is complete and accepted.

Phase 1A is implemented: multi-agent project continuity plus single-accountant authentication.

Phase 1B requirement/specification lock is complete.

Phase 2A is in progress (accounting foundation):

- Chunk 1 (Prisma schema, migration, system `AccountClass` seed) is complete.
- Chunk 2 (backend accounting foundation API) is complete, reviewed, and accepted.
- Chunk 3A (frontend accounting foundation pages) is complete (this session).
- Chunk 3B (remaining frontend pages and final integration verification) is not started.

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
- Phase 2A Chunk 2: backend accounting foundation API guarded by the `ACCOUNTANT` role — `/company`, `/fiscal-years` (+ `/:id/activate`), `/projects`, `/account-classes`, `/account-groups`, `/ledger-accounts`.
- Phase 2A Chunk 3A frontend foundation:
  - Typed, cookie-authenticated API helper (`apps/web/src/lib/api.ts`) using `credentials: "include"`, an `ApiError` type with clear auth/connection messages, and no token storage in `localStorage`.
  - Protected `/app` shell layout with real navigation (Company Setup, Fiscal Years, Projects, Account Classes) and disabled "Later" entries for the Chunk 3B pages.
  - `/app/company` Company Setup page (create or edit the singleton company profile).
  - `/app/fiscal-years` Fiscal Years page (list, create, edit, activate, with active/closed status).
  - `/app/projects` Projects page (list, create, edit).
  - `/app/accounts/classes` read-only Account Classes page.

## Confirmed Role Model

Only one role is confirmed now:

- `ACCOUNTANT`, displayed as `Accountant`

Future roles are to be confirmed later. They are not implemented, seeded, displayed, or modeled.

## Current Non-Features

The repo intentionally does not include vouchers, journals, ledger reports, cash book, bank book, trial balance, financial statements, reports, payroll, salary sheets, project finance reports, parties, customers, vendors, dashboard analytics, file uploads, ERP modules, business seed data, or unconfirmed office roles.

The accounting foundation is being built incrementally in Phase 2A. The remaining Chunk 3B frontend work is not implemented yet.

## Database Port

Host tools must connect to PostgreSQL at `localhost:55432`.

Docker maps host `55432` to container `5432`.

## Local Port Caveats

The default web port is `3000`. If it is occupied, run the web app on `3010` and start the API with `WEB_ORIGIN=http://localhost:3010`.

The default API port is `4000`.

## Next Recommended Task

The next task is Phase 2A Chunk 3B (frontend only), implementing the remaining accounting foundation pages on top of the Chunk 2 backend API:

- Accounting Periods page (under a fiscal year).
- Cost Centers page (under projects).
- Account Groups page.
- Ledger Accounts page.
- Cash/Bank Accounts page.
- Final integration verification across all foundation pages.

Reference docs before continuing:

- `docs/requirements/phase-1b-accounting-foundation-lock.md`
- `docs/architecture/phase-1b-accounting-foundation-model-proposal.md`
- `docs/acceptance/phase-1b-acceptance-criteria.md`

Stay frontend-only for Chunk 3B. Do not change the Prisma schema, create migrations, add roles, add business seed data, or add vouchers/reports/dashboard analytics.
