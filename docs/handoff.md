# Real Capita Accounting & Project Finance System Handoff

## Current Phase

Phase 2A: accounting foundation implementation, in progress.

Phase 0 is complete and accepted. Phase 1A delivered the secure login, the single confirmed Accountant role, the protected app shell, agent documentation, ADRs, and verification scripts. Phase 1B locked the accounting foundation requirements and acceptance criteria.

Phase 2A is being implemented in chunks:

- Chunk 1: accounting-foundation Prisma schema, migration, and the fixed five-class `AccountClass` system seed — complete.
- Chunk 2: backend accounting foundation API guarded by the `ACCOUNTANT` role — complete, reviewed, pushed, and accepted.
- Chunk 3A: frontend accounting foundation pages — complete (this session).
- Chunk 3B: remaining frontend pages and final integration verification — not started.

## Phase 2A Chunk 3A (frontend foundation) — completed this session

- Extended `apps/web/src/lib/api.ts` into a typed, cookie-authenticated API helper: `apiFetch` always sends `credentials: "include"`, surfaces clear auth/connection errors through an `ApiError` type, and never stores tokens in `localStorage`. Added resource helpers and types for company, fiscal years, projects, and account classes.
- Added `apps/web/src/app/app/_components/ui.tsx` shared presentation primitives (cards, fields, buttons, status badges, notices) for a calm, professional accountant UI.
- Added `apps/web/src/app/app/layout.tsx`: a protected app shell that gates on `GET /auth/me`, shows the signed-in user and role, provides sign out, and renders real navigation (Company Setup, Fiscal Years, Projects, Account Classes) with disabled "Later" entries for the Chunk 3B pages.
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

- Dashboard
- Voucher screens
- Accounting modules
- Chart of accounts
- Ledger, cash book, bank book, trial balance, or reports
- Payroll, HR, CRM, project, party, customer, or vendor modules
- File uploads
- Business seed data
- Unconfirmed office roles
- Real company documents or private operational data
- Code copied from the previous Real Capita ERP prototype
- Company, fiscal year, project, cost center, account, cash/bank, voucher, ledger, report, payroll, party, dashboard, or file upload modules in Phase 1B

## Next Planned Phase

The next task is Phase 2A Chunk 3B (frontend only), building the remaining accounting foundation pages on top of the existing Chunk 2 backend API:

- Accounting Periods page (periods under a fiscal year).
- Cost Centers page (cost centers under projects).
- Account Groups page.
- Ledger Accounts page.
- Cash/Bank Accounts page (linked to ledger accounts marked as cash/bank).
- Final integration verification across all foundation pages.

Chunk 3B must remain frontend-only: do not change the Prisma schema, create migrations, change the backend (unless a blocking integration bug is found and reported first), add roles, add business seed data, or add vouchers, reports, payroll, parties, file uploads, or dashboard analytics.

## Current GitHub Repository

`https://github.com/MaruflRana/real-capita-accounts`

## Last Verification Results

Verification date: 2026-06-14.

- `pnpm install`: passed.
- `pnpm prisma:generate`: passed with the local development `DATABASE_URL`.
- `pnpm prisma migrate dev --name phase_1a_auth`: passed, creating `20260613193905_phase_1a_auth`.
- `pnpm seed`: passed, seeding only `ACCOUNTANT` and `accountant@realcapita.local`.
- `pnpm build:web`: passed.
- `pnpm build:api`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm check:all`: passed.
- `pnpm doctor`: passed with one local warning: port `3000` is occupied, so use web port `3010` and start the API with `WEB_ORIGIN=http://localhost:3010` for that test setup.
- `docker compose config`: passed.
- `docker compose down`: passed.
- `docker compose up -d postgres`: passed with `real-capita-accounts-postgres` recreated.
- `docker compose ps`: passed, reporting `0.0.0.0:55432->5432/tcp` and Docker health `healthy`.
- `docker compose logs postgres --tail=50`: passed, reporting PostgreSQL 17.10 ready to accept connections on container port `5432`.
- Prisma database connectivity check through `pnpm prisma db execute --stdin`: passed against the configured `DATABASE_URL`.
- Database-port isolation fix: this project now publishes PostgreSQL on host port `55432`, avoiding accidental connections to the old ERP Postgres container on `localhost:5432`.
- PostgreSQL container version check: passed inside the container, reporting PostgreSQL 17.10.
- API runtime check: passed on `http://localhost:4000/health`, returning `status: "ok"` and `service: "real-capita-accounts-api"`.
- API auth runtime check: passed with `accountant@realcapita.local` / `ChangeMe123!`; login returned no token in the JSON body, set the `rcg_auth` HttpOnly `SameSite=Lax` cookie, `/auth/me` returned `Accountant User` with role `Accountant`, logout cleared the cookie, and post-logout `/auth/me` returned `401`.
- Web auth browser check: passed on `http://localhost:3010` because local port `3000` is occupied. `/login` rendered, login succeeded, `/app` showed `Accountant User`, `accountant@realcapita.local`, role `Accountant`, the Phase 1A secure shell message, and only the allowed placeholder navigation labels.
- Phase 1B docs/spec lock: prepared without Prisma schema changes, migrations, API business modules, frontend business pages, business seed data, or new roles.
