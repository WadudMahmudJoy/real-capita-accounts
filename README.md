# Real Capita Accounting & Project Finance System

Phase 1A foundation for a new accounting-first production system for Real Capita Group.

This repository is intentionally not a continuation of the previous Real Capita ERP prototype. Phase 1A adds multi-agent continuity, secure login, one confirmed Accountant role, and a protected app shell only.

## Current Development Phase

- Phase 1A is implemented.
- Phase 1B documentation/specification lock is prepared.
- Phase 2A accounting foundation is implemented and accepted.
- Phase 2B voucher requirement documentation/specification lock is prepared.
- Phase 2C voucher implementation plan is prepared (6 chunks: schema, backend draft API, posting service, frontend UI, post/print UI, integration review).
- No voucher implementation exists yet.
- The next implementation requires explicit user confirmation before any voucher schema, API, or UI work begins.

## Stack

- Node.js LTS
- pnpm workspace monorepo
- Next.js App Router with TypeScript
- NestJS with TypeScript
- PostgreSQL 17 through Docker Compose
- Prisma ORM
- Tailwind CSS
- shadcn/ui project setup
- Zod installed through the shared package for future validation
- Git and GitHub from the beginning

## Prerequisites

- Node.js LTS, version 22 or newer
- pnpm 11
- Docker Desktop with Docker Compose
- Git

## Setup

```powershell
cd D:\real-capita-accounts
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
```

## Environment

`.env.example` contains local development defaults only:

```env
DATABASE_URL=postgresql://real_capita:real_capita_password@localhost:55432/real_capita_accounts?schema=public
API_PORT=4000
WEB_PORT=3000
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRES_IN=8h
COOKIE_NAME=rcg_auth
NODE_ENV=development
```

Do not commit `.env` or real secrets.

## Development Commands

```powershell
pnpm dev
pnpm dev:web
pnpm dev:api
```

Frontend default: `http://localhost:3000`

API default: `http://localhost:4000`

If port `3000` is occupied locally, run the web app on `3010` without changing the architecture:

```powershell
$env:WEB_ORIGIN="http://localhost:3010"
pnpm dev:api
pnpm --filter @real-capita-accounts/web exec next dev -p 3010
```

Health endpoint:

```powershell
Invoke-RestMethod http://localhost:4000/health
```

## Phase 1A Authentication

Authentication uses an HttpOnly cookie named `rcg_auth` with `SameSite=Lax`. The cookie is marked `Secure` only when `NODE_ENV=production`. Tokens are not stored in localStorage.

Protected API routes verify the JWT and the database-backed `AuthSession`; logout revokes the current session and clears the cookie.

Development seed account:

```text
Email: accountant@realcapita.local
Password: ChangeMe123!
Role: Accountant
```

This seed is development-only. Do not use real employee names, real passwords, salaries, customer data, voucher amounts, or private business data.

Only one role is confirmed in Phase 1A: `ACCOUNTANT`, displayed as `Accountant`. Future roles are to be confirmed later and must not be invented.

## Docker and PostgreSQL

```powershell
docker compose config
docker compose up -d postgres
docker compose logs -f postgres
docker compose down
```

The Compose service uses `postgres:17`, a persistent `postgres_data` volume, and project-specific localhost port `55432` to avoid conflicts with the old ERP database. PostgreSQL still runs inside the container on port `5432`; connect from host tools with `localhost:55432`.

## Verification Commands

```powershell
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
pnpm build:web
pnpm build:api
pnpm typecheck
pnpm lint
docker compose config
docker compose up -d postgres
pnpm check:all
pnpm doctor
```

## Agent Continuity

Future AI agents and developers should start with:

- `AGENTS.md`
- `docs/ai/START_HERE.md`
- `docs/ai/CURRENT_STATE.md`
- `docs/ai/WORKFLOW.md`
- `docs/handoff.md`
- `docs/decisions/`

Use `pnpm agent:start` for a quick local orientation report.

## Strict Current Boundary

The current completed work does not include voucher implementation, journal posting, parties, payroll, salary sheets, reports, ledgers, cash book, bank book, trial balance, dashboard analytics, file uploads, ERP modules, accounting transaction screens, business seed data, or unconfirmed office roles.

The next coding phase must be confirmed before implementation. The proposed next coding phase is voucher engine Chunk 2C-1 (schema only) documented in `docs/plans/phase-2c-voucher-implementation-plan.md`.
