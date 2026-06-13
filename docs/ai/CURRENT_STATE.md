# Current State

## Completed Phase

Phase 0 is complete and accepted.

Phase 1A is implemented: multi-agent project continuity plus single-accountant authentication.

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

## Confirmed Role Model

Only one role is confirmed now:

- `ACCOUNTANT`, displayed as `Accountant`

Future roles are to be confirmed later. They are not implemented, seeded, displayed, or modeled.

## Current Non-Features

The repo intentionally does not include vouchers, chart of accounts, ledger, cash book, bank book, trial balance, reports, payroll, salary sheets, project finance, parties, customers, vendors, dashboard analytics, file uploads, ERP modules, business seed data, or unconfirmed office roles.

## Database Port

Host tools must connect to PostgreSQL at `localhost:55432`.

Docker maps host `55432` to container `5432`.

## Local Port Caveats

The default web port is `3000`. If it is occupied, run the web app on `3010` and start the API with `WEB_ORIGIN=http://localhost:3010`.

The default API port is `4000`.

## Next Recommended Task

Confirm the next phase with Real Capita before implementing business modules. A likely next phase is Phase 1B: define the first accounting foundation requirements and acceptance criteria.
