# Real Capita Accounting & Project Finance System

Phase 1A foundation for a new accounting-first production system for Real Capita Group.

This repository is intentionally not a continuation of the previous Real Capita ERP prototype. Phase 1A adds multi-agent continuity, secure login, one confirmed Accountant role, and a protected app shell only.

## Current Development Phase

- Phase 2A accounting foundation is complete and accepted.
- Phase 2B voucher requirement documentation/specification lock is complete.
- Phase 2C voucher implementation is complete and accepted after full integration review:
  - Chunk 2C-1: voucher schema foundation (enums, Voucher, VoucherLine, VoucherNumberSequence).
  - Chunk 2C-2: backend draft voucher API (list/detail/create/update/soft-delete, ACCOUNTANT guard, system voucher number).
  - Chunk 2C-3: backend posting validation service (POST /vouchers/:id/post, full posting rules, immutability, VOUCHER_POSTED audit event).
  - Chunk 2C-4: frontend voucher draft/create UI (voucher list with filters, draft create/edit form, debit/credit line editor, totals and balance indicator, posted read-only view).
  - Chunk 2C-5: posting UI and print foundation (post action with confirmation panel, posted read-only view with postedBy/postingDate, browser print layout with Real Capita Group header, amount-in-words, and signature areas).
  - Chunk 2C-6: final integration and acceptance review (API+browser smoke tests, docs update, scope verification).
- Implemented voucher features now include: full voucher lifecycle from draft create through posting, with print layout for posted vouchers.
- Phase 2D accounting reports are complete and accepted after full integration review:
  - Chunk 2D-1: requirement lock review.
  - Chunk 2D-2: backend General Ledger, Cash Book, and Bank Book report APIs.
  - Chunk 2D-3: backend Trial Balance report API.
  - Chunk 2D-4: backend Income Statement and Balance Sheet report APIs.
  - Chunk 2D-5: frontend operational report pages (Ledger, Cash Book, Bank Book, Trial Balance).
  - Chunk 2D-6: frontend financial statement pages (Income Statement, Balance Sheet) and browser print foundation for all six report pages.
  - Chunk 2D-7: final integration and acceptance review (all backend+frontend+print smoke tests, docs update, scope verification).
- Implemented report features: all six backend report endpoints, all six frontend report pages, and browser print foundation for all six report pages. Reports derive from posted VoucherLine records only; no primary report tables.
- Phase 2E MFS / bKash transaction support requirement lock is complete and accepted at commit `fdffcfb`.
- Phase 2E Chunk 2E-2 backend schema/model foundation is implemented:
  - `CashBankAccountType` now includes `MFS` beside `CASH` and `BANK`.
  - `MfsProvider` supports `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, and `OTHER`.
  - `CashBankAccount` has nullable MFS metadata fields for provider, custom provider name, wallet number, and account holder name.
  - Existing CASH and BANK runtime behavior is preserved.
- Phase 2E Chunk 2E-3 backend validation/API changes are implemented:
  - The backend Cash & Bank account API can create, list, update, and deactivate MFS accounts.
  - MFS accounts require provider and wallet metadata; CASH/BANK accounts continue without MFS metadata.
  - MFS voucher posting support was not added; posting rejects MFS cash-bank accounts until a later Phase 2E chunk.
- Phase 2E Chunk 2E-4 frontend MFS account setup UI is implemented:
  - The existing Cash & Bank setup page is now the Cash, Bank & MFS setup page; the account type dropdown offers CASH, BANK, and MFS.
  - ACCOUNTANT can create, view, edit, and deactivate MFS accounts with provider, wallet number / account ID, and an optional account holder name; a provider name field appears only when provider is Other.
  - CASH and BANK forms are unchanged and do not show MFS metadata fields.
  - The account list shows MFS provider and wallet identifier; existing CASH/BANK rows display as before.
- No MFS Book frontend page, dashboard/report/export expansion, MFS provider integration, or MFS seed data exists yet.
- Phase 2E Chunk 2E-5 MFS Book report API is implemented:
  - `GET /reports/mfs-book` endpoint exists and derives from posted voucher lines filtered to MFS accounts only.
  - Cash Book remains CASH-only; Bank Book remains BANK-only.
- Phase 2E Chunk 2E-6 MFS Book frontend and print foundation is implemented:
  - `/app/reports/mfs-book` renders the MFS Book report page with filters, transaction lines (provider info for MFS), and browser print.
  - MFS Book navigation link added under Reports.
  - No MFS voucher posting support exists yet.
- Still not implemented: MFS voucher posting support, Project Summary API and frontend, Cost Center Summary API and frontend, PDF/Excel export, dashboard analytics, payroll, salary sheets, parties/customers/vendors, file uploads, reversal/correction features, approval workflow, and extra roles beyond Accountant.
- The next recommended task is Phase 2E Chunk 2E-7 final integration and acceptance review, unless review finds issues. It must be explicitly confirmed before starting.

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

The current completed work includes the Phase 2A accounting foundation, Phase 2C voucher implementation (accepted), the Phase 2D accounting reports requirement lock and implementation (accepted), the Phase 2E MFS / bKash requirement lock accepted at `fdffcfb`, the Phase 2E Chunk 2E-2 backend schema/model foundation accepted at `c820d7b`, the Phase 2E Chunk 2E-3 backend validation/API changes accepted at `97e69ab`, the Phase 2E Chunk 2E-4 frontend MFS account setup UI accepted at `be2392a`, the Phase 2E Chunk 2E-5 MFS Book report API, and the Phase 2E Chunk 2E-6 MFS Book frontend and print foundation. `GET /reports/mfs-book` exists and `/app/reports/mfs-book` renders the MFS Book report page with filters and browser print. MFS runtime is still incomplete: no MFS voucher posting support exists yet. The backend Cash & Bank API can manage MFS accounts and the frontend Cash, Bank & MFS page can set them up, but voucher posting rejects MFS cash-bank accounts until a later Phase 2E chunk. Do not start Project Summary, Cost Center Summary, PDF/Excel export, dashboard analytics, payroll, parties, uploads, roles, MFS voucher posting support, or any new module without explicit user confirmation.
