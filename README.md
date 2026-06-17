# Real Capita Accounting & Project Finance System

Phase 1A foundation for a new accounting-first production system for Real Capita Group.

This repository is intentionally not a continuation of the previous Real Capita ERP prototype. Phase 1A adds multi-agent continuity, secure login, one confirmed Accountant role, and a protected app shell only.

## Current Development Phase

- Phase 2A accounting foundation is complete and accepted.
- Phase 2B voucher requirement documentation/specification lock is complete.
- Phase 2C voucher implementation is complete and accepted.
- Phase 2D accounting reports are complete and accepted.
- Phase 2E MFS / bKash transaction support is accepted (MFS account setup + MFS Book foundation).
- Phase 2F Accounting Report + Accountant UX Refinement is complete and accepted at `17fede6` (tag `phase-2f-complete`). Issues A-D implemented (Balance Sheet current P/L, report/table readability, voucher line dynamic field visibility, report filter UX clarity). Issue E mostly addressed. Issue F deferred.
- Phase 2G Project/Cost-Center Financial Reporting is complete and accepted at `7e60a1f` (tag `phase-2g-complete`). All four primary reports are implemented and verified. The optional Report E (Project Cash/Bank Movement View) remains deferred.
- Phase 2H Demo/Test Data Cleanup and Safe Demo Dataset Standardization is complete and ready for the completion tag. Phase 2H-1 Demo Data Audit (`pnpm demo:audit`) is implemented. Phase 2H-2 Safe Demo Reset (`pnpm demo:reset`) is implemented: a destructive CLI command with `CONFIRM_DEMO_RESET=YES` guard, local DB guard, production refusal, dry-run mode, and mandatory backup instruction. It resets the local/dev database to a clean deterministic Real Capita demo dataset (2 posted vouchers, 5 ledger accounts, 3 cash/bank/MFS accounts, 1 project, 1 cost center). Phase 2H-3 Demo Verification (`pnpm demo:verify`) is implemented: a read-only CLI command that asserts the deterministic demo dataset exists and matches expected accounting/report totals. Phase 2H-4 Docs Cleanup and final review is complete. Phase 2F Issue F (demo data) is resolved.
- Still not implemented: Project Cash/Bank Movement View, PDF/Excel export, dashboard analytics, payroll, salary sheets, parties/customers/vendors, file uploads, reversal/correction features, approval workflow, and extra roles beyond Accountant.

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

The current completed work includes the Phase 2A accounting foundation, Phase 2C voucher implementation (accepted), the Phase 2D accounting reports requirement lock and implementation (accepted), the Phase 2E MFS / bKash requirement lock accepted at `fdffcfb`, the Phase 2E Chunk 2E-2 backend schema/model foundation accepted at `c820d7b`, the Phase 2E Chunk 2E-3 backend validation/API changes accepted at `97e69ab`, the Phase 2E Chunk 2E-4 frontend MFS account setup UI accepted at `be2392a`, the Phase 2E Chunk 2E-5 MFS Book report API accepted, and the Phase 2E Chunk 2E-6 MFS Book frontend and print foundation accepted. Phase 2E MFS account setup and MFS Book foundation are now accepted. Phase 2F Accounting Report + Accountant UX Refinement requirement lock is accepted and Issues A-D are implemented. Phase 2F is complete and accepted at `17fede6` (tag `phase-2f-complete`). Phase 2G Project/Cost-Center Financial Reporting requirement lock is accepted. Phase 2G defines four primary reports (Project Ledger, Project Cost Report, Cost Center Summary, Project Financial Summary) and one optional sub-view (Project Cash/Bank Movement View). All four Phase 2G primary report chunks are implemented and verified. Phase 2G is complete and accepted at `7e60a1f` (tag `phase-2g-complete`). Phase 2H Demo/Test Data Cleanup and Safe Demo Dataset Standardization is complete and ready for the completion tag. Phase 2H implements `pnpm demo:audit` (read-only), `pnpm demo:reset` (destructive with confirmation guard, local DB guard, production refusal), and `pnpm demo:verify` (read-only). The deterministic demo dataset is standardized: Real Capita Group, FY 2025-2026, June 2026, SK-001 Shanti Kutir, SK-LD cost center, 5 ledger accounts, 3 cash/bank/MFS accounts, 2 posted vouchers. Phase 2F Issue F is resolved. Accepted minor notes: demo-reset creates posted vouchers directly through Prisma (not VoucherService); demo-verify uses direct Prisma reads (not report HTTP APIs). Do not start Project Cash/Bank Movement View implementation, PDF/Excel export, dashboard analytics, payroll, parties, uploads, roles, MFS voucher posting support, or any new module without explicit user confirmation.
