# Current State

## Completed Phase

Phase 0 is complete and accepted.

Phase 1A is implemented: multi-agent project continuity plus single-accountant authentication.

Phase 1B requirement/specification lock is prepared. It documents the proposed accounting foundation scope for a future Phase 2A implementation without adding business modules.

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
- Phase 1B requirement/spec lock documents for the next accounting foundation implementation.

## Confirmed Role Model

Only one role is confirmed now:

- `ACCOUNTANT`, displayed as `Accountant`

Future roles are to be confirmed later. They are not implemented, seeded, displayed, or modeled.

## Current Non-Features

The repo intentionally does not include vouchers, chart of accounts, ledger, cash book, bank book, trial balance, reports, payroll, salary sheets, project finance, parties, customers, vendors, dashboard analytics, file uploads, ERP modules, business seed data, or unconfirmed office roles.

No accounting business modules are implemented yet.

## Database Port

Host tools must connect to PostgreSQL at `localhost:55432`.

Docker maps host `55432` to container `5432`.

## Local Port Caveats

The default web port is `3000`. If it is occupied, run the web app on `3010` and start the API with `WEB_ORIGIN=http://localhost:3010`.

The default API port is `4000`.

## Next Recommended Task

Next agent should read:

- `docs/requirements/phase-1b-accounting-foundation-lock.md`
- `docs/architecture/phase-1b-accounting-foundation-model-proposal.md`
- `docs/acceptance/phase-1b-acceptance-criteria.md`
- `docs/prompts/droid-cli-next-prompt.md`

Confirm Phase 2A with the user before implementing business modules.
