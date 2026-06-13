# Real Capita Accounts Agent Guide

## Mission

Build a clean accounting-first web application for Real Capita Group. The repository must be understandable from source control alone, without hidden chat history or private AI session memory.

## Current Phase

Phase 1A: multi-agent continuity foundation plus secure single-accountant authentication.

Phase 0 is complete and accepted. Phase 1A adds only authentication, one confirmed role, a protected app shell, project operating documentation, ADRs, and verification scripts.

## Stack

- pnpm workspace monorepo
- Next.js App Router frontend in `apps/web`
- NestJS API in `apps/api`
- Prisma ORM
- PostgreSQL 17 through Docker Compose
- Docker Compose host port `55432` mapped to container port `5432`
- TypeScript throughout

## Strict Current Boundary

Do not build accounting business modules in Phase 1A.

Do not implement vouchers, chart of accounts, ledger, cash book, bank book, trial balance, reports, payroll, salary sheets, project finance, parties, customers, vendors, dashboard analytics, file uploads, ERP modules, business seed data, or unconfirmed office roles.

## Confirmed Role Model

Only one role is confirmed in Phase 1A:

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

## Agent Switching

When switching from Codex to Droid CLI, GLM, DeepSeek, Opus, Gemini, another AI, or a human developer:

1. Start with `docs/ai/START_HERE.md`.
2. Run `pnpm agent:start`.
3. Read `docs/ai/CURRENT_STATE.md`, `docs/ai/WORKFLOW.md`, and `docs/handoff.md`.
4. Confirm `git status` is clean before new work.
5. Continue only inside the current phase boundary.
6. Update handoff docs before ending the session.

## Next Phase Guidance

The exact next phase must be confirmed before implementation. A likely next step is Phase 1B: define the first non-auth accounting foundation requirements with Real Capita before adding any business schema or screens.

