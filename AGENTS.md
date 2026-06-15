# Real Capita Accounts Agent Guide

## Mission

Build a clean accounting-first web application for Real Capita Group. The repository must be understandable from source control alone, without hidden chat history or private AI session memory.

## Current Phase

Phase 2E: MFS / bKash transaction support requirement lock is complete and accepted at commit `fdffcfb`. Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at `c820d7b`. Phase 2E Chunk 2E-3 backend validation/API changes are accepted at `97e69ab`: the backend Cash & Bank account API can manage MFS accounts with provider and wallet metadata. Phase 2E Chunk 2E-4 frontend MFS account setup UI is implemented: the accountant can create, view, edit, and deactivate MFS accounts from the existing Cash, Bank & MFS setup page. MFS runtime is still incomplete: no MFS Book report and no MFS voucher posting support exist yet.

Phase 2D is accepted at commit `be482c2`. The `phase-2d-complete` tag should exist. Phase 2D added backend report APIs for Ledger, Cash Book, Bank Book, Trial Balance, Income Statement, and Balance Sheet; frontend report pages for all six reports; and a browser print foundation for all six report pages.

Phase 0 is complete and accepted. Phase 1A adds only authentication, one confirmed role, a protected app shell, project operating documentation, ADRs, and verification scripts.

Phase 1B locked the accounting foundation requirements. Phase 2A implemented the accounting foundation in schema, backend, and frontend. Phase 2B locked voucher requirements before any voucher implementation. Phase 2C implemented the full voucher engine and is accepted. Phase 2D implemented the accounting report APIs, frontend report pages, and browser print foundation and is now accepted. Phase 2E Chunk 2E-1 requirement lock is accepted; Chunk 2E-2 schema/model foundation is accepted; Chunk 2E-3 backend validation/API changes are accepted; Chunk 2E-4 frontend MFS account setup UI is implemented.

If continuing in Droid CLI or another agent, start with `docs/ai/START_HERE.md` and `docs/handoff.md`.

## Stack

- pnpm workspace monorepo
- Next.js App Router frontend in `apps/web`
- NestJS API in `apps/api`
- Prisma ORM
- PostgreSQL 17 through Docker Compose
- Docker Compose host port `55432` mapped to container port `5432`
- TypeScript throughout

## Strict Current Boundary

Phase 2D accounting reports implementation is complete and accepted. Phase 2E MFS / bKash transaction support requirement lock is complete and accepted at `fdffcfb`. Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at `c820d7b`. Phase 2E Chunk 2E-3 backend validation/API changes are accepted at `97e69ab`. Phase 2E Chunk 2E-4 frontend MFS account setup UI is implemented: ACCOUNTANT can create, view, edit, and deactivate MFS accounts from the existing Cash, Bank & MFS setup page. MFS runtime remains incomplete: the backend Cash & Bank API can manage MFS accounts and the frontend can set them up, but there is no MFS Book API, no MFS Book frontend page, no dashboard/report/export expansion, and no MFS voucher posting support.

Do not implement Project Summary, Cost Center Summary, report tables in the Prisma schema, PDF/Excel export, dashboard analytics, payroll, salary sheets, project finance reports, parties, customers, vendors, additional roles, file uploads, business seed data, MFS voucher posting behavior, MFS Book, or an MFS Book frontend page until the user confirms the next implementation chunk.

## Confirmed Role Model

Only one role is confirmed:

- `ACCOUNTANT`, displayed in the UI as `Accountant`

The Accountant role represents AGM sir as the main accounting operator for now. Do not use AGM sir's real name in seed data. Future roles are to be confirmed later. Do not invent, seed, display, or create placeholder enums for Admin, Super Admin, Checker, Data Entry, MD Viewer, HR, Sales, Payroll, or other office roles until Real Capita confirms exact responsibilities.

## Security Rules

- Use HttpOnly cookie-based JWT/session authentication.
- Do not store auth tokens in localStorage.
- Cookies must use `SameSite=Lax`.
- Cookies must use `Secure` only when `NODE_ENV=production`.
- Passwords must be hashed.
- Backend guards and role checks are the authority for protected endpoints.
- Never commit real passwords, salaries, employee data, customer data, voucher amounts, or private business data.

## Database Port Rule

This project uses host port `55432` for PostgreSQL to avoid accidental conflict with the old ERP database on `localhost:5432`.

Use this URL shape for local development:

```env
DATABASE_URL=postgresql://real_capita:real_capita_password@localhost:55432/real_capita_accounts?schema=public
```

PostgreSQL still runs inside the container on port `5432`; host tools connect through `localhost:55432`.

## Setup Commands

```powershell
cd D:\real-capita-accounts
git pull --ff-only
git status --short --branch
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
```

## Standard Verification

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
docker compose config
pnpm check:all
pnpm doctor
```

For auth verification, start the API and web app, then test:

- `GET /health`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `/login`
- `/app`

Development seed login:

- Email: `accountant@realcapita.local`
- Password: `ChangeMe123!`

This is a local development account only.

## Git Rules

- Always pull first.
- Check `git status --short --branch` before editing.
- Keep commits small and phase-scoped.
- Do not commit `.env`, generated Prisma client output, build output, logs, or real secrets.
- Preserve existing Git identity and commit hooks.
- If no local hook adds it, manual commits should include:

```text
Co-authored-by: Md. Wadud Mahmud Joy <wadudjoy24@gmail.com>
```

## No Old ERP Copy Rule

This is a new accounting-first system, not a continuation of the previous ERP prototype. The old ERP may be treated only as historical reference. Do not copy code, schema, seed data, fake modules, UI screens, or private data from it.

## Phase 2D Reports

Phase 2D report APIs and frontend pages are complete and accepted. All six backend report endpoints, all six frontend report pages, and the browser print foundation are implemented. Reports derive from posted VoucherLine records only; no primary report tables.

Before any new feature work, read:

- `docs/requirements/phase-2d-accounting-reports-requirement-lock.md`
- `docs/acceptance/phase-2d-acceptance-criteria.md`

## Phase 2E MFS / bKash Requirement Lock, Schema Foundation, And Account API

Phase 2E MFS / bKash transaction support requirement lock is complete and accepted at `fdffcfb`. It defines MFS accounting model, provider tracking, wallet/account identity, voucher behavior, MFS Book concept, report impact, validation rules, and acceptance criteria.

Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at `c820d7b`. The Prisma model now has `CashBankAccountType.MFS`, `MfsProvider` values `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, and `OTHER`, and nullable `CashBankAccount` fields for `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName`. Phase 2E Chunk 2E-3 backend validation/API changes are accepted at `97e69ab`: the existing Cash & Bank account API can create, list, update, and deactivate MFS accounts with provider and wallet metadata. Phase 2E Chunk 2E-4 frontend MFS account setup UI is implemented: the existing Cash, Bank & MFS setup page lets ACCOUNTANT manage MFS accounts (provider, wallet number / account ID, optional account holder name; provider name appears only when provider is OTHER) alongside CASH and BANK. Existing CASH and BANK behavior is preserved. No MFS Book report exists yet. No MFS voucher posting support exists yet; voucher posting rejects MFS cash-bank accounts until a later Phase 2E chunk.

Before any MFS implementation, read:

- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`
- `docs/acceptance/phase-2e-acceptance-criteria.md`
- `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md`

## Agent Switching

When switching from Codex to Droid CLI, GLM, DeepSeek, Opus, Gemini, another AI, or a human developer:

1. Start with `docs/ai/START_HERE.md`.
2. Run `pnpm agent:start`.
3. Read `docs/ai/CURRENT_STATE.md`, `docs/ai/WORKFLOW.md`, `docs/handoff.md`, and the Phase 2E lock/schema-foundation/account-API docs.
4. Confirm `git status` is clean before new work.
5. Continue only inside the current phase boundary.
6. Update handoff docs before ending the session.

## Next Phase Guidance

Phase 2E Chunk 2E-4 frontend MFS account setup UI is implemented. The next recommended task is Phase 2E Chunk 2E-5 MFS Book report API, unless review finds issues. Do not start Project Summary, Cost Center Summary, PDF/Excel export, dashboard analytics, payroll, parties, uploads, roles, MFS Book, MFS voucher posting support, or any new module without explicit user confirmation.
