# Real Capita Accounts Agent Guide

## Mission

Build a clean accounting-first web application for Real Capita Group. The repository must be understandable from source control alone, without hidden chat history or private AI session memory.

## Current Phase

Phase 2K: Voucher Fund-Line Project Tagging is complete and accepted, pending only the user-created tag `phase-2k-complete`. Phase 2K allows accountants to optionally tag Cash/Bank/MFS voucher lines with project and cost center during voucher creation, so these fund lines can appear in the Project Fund Movement View. Implemented chunks: 2K-1 requirement lock, 2K-2 backend validation audit / support, 2K-3 frontend voucher form update, 2K-4 browser/API/report regression verification, 2K-5 final acceptance/docs cleanup. Cash Book remains CASH-only, Bank Book remains BANK-only. No schema/migration/demo dataset changes.

Phase 2J: Project Fund Movement View is complete and accepted at commit `98212ba` (tag `phase-2j-complete`). The report derives project fund movement using strict same-line only logic (Option A) across Cash, Bank, and MFS. Implemented chunks: 2J-1 requirement lock, 2J-2 backend API, 2J-3 frontend UI, 2J-4 regression, 2J-5 final review. Cash Book remains CASH-only, Bank Book remains BANK-only. No schema/migration/demo dataset changes.

Phase 2I: MFS Voucher Posting Continuation is complete and accepted at `10d6869` (tag `phase-2i-complete`). Phase 2I enables MFS accounts inside voucher posting flows so accountants can record bKash/Nagad/Rocket-style money movement correctly. Implemented chunks: 2I-1 requirement lock, 2I-2 backend MFS posting (PAYMENT/RECEIPT/CONTRA accept MFS cashBankAccountId; JOURNAL rejects MFS), 2I-3 frontend MFS voucher UI (MFS account selection, JOURNAL MFS prevention, MFS metadata display), 2I-4 report regression/demo decision (MFS Book shows MFS movement, Cash Book CASH-only, Bank Book BANK-only, Project reports no double-count; base deterministic demo dataset unchanged, optional MFS scenario deferred), 2I-5 final review. Cash Book remains CASH-only and Bank Book remains BANK-only. No schema/migration changes (MFS schema exists from Phase 2E).

Phase 2H: Demo/Test Data Cleanup and Safe Demo Dataset Standardization is complete and accepted at `96fb653` (tag `phase-2h-complete`). Phase 2G Project/Cost-Center Financial Reporting is complete and accepted at `7e60a1f` (tag `phase-2g-complete`). Phase 2F is complete and accepted at `17fede6` (tag `phase-2f-complete`). Phase 2E MFS account setup and MFS Book foundation are accepted. Phase 2D accounting reports are accepted. Phase 2C voucher engine is accepted. Phase 2A accounting foundation is accepted.

If continuing in Droid CLI or another agent, start with `docs/ai/START_HERE.md` and `docs/handoff.md`, then read the Phase 2K requirement lock docs before any implementation.

## Stack

- pnpm workspace monorepo
- Next.js App Router frontend in `apps/web`
- NestJS API in `apps/api`
- Prisma ORM
- PostgreSQL 17 through Docker Compose
- Docker Compose host port `55432` mapped to container port `5432`
- TypeScript throughout

## Strict Current Boundary

Phase 2D accounting reports implementation is complete and accepted. Phase 2E MFS / bKash transaction support requirement lock is complete and accepted at `fdffcfb`. Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at `c820d7b`. Phase 2E Chunk 2E-3 backend validation/API changes are accepted at `97e69ab`. Phase 2E Chunk 2E-4 frontend MFS account setup UI is accepted at `be2392a`: ACCOUNTANT can create, view, edit, and deactivate MFS accounts from the existing Cash, Bank & MFS setup page. Phase 2E Chunk 2E-5 MFS Book report API is accepted: `GET /reports/mfs-book` exists and derives from posted voucher lines filtered to MFS accounts only. Phase 2E Chunk 2E-6 MFS Book frontend and print foundation is accepted: `/app/reports/mfs-book` renders the MFS Book report page with filters, transaction lines, and browser print. Phase 2E MFS account setup and MFS Book foundation are now accepted. Phase 2F Accounting Report + Accountant UX Refinement requirement lock is accepted. Issue A (Balance Sheet current P/L) is implemented. Issue B (report/table layout widening and textbook-style readability) is implemented: the app layout uses full viewport width, report tables hide less-critical columns to eliminate horizontal scroll, and dropdowns use compact labels with tooltips. Issue C (voucher line dynamic field visibility) is implemented: voucher line Project/Cost Center/Cash-Bank-MFS fields respond to the selected ledger; required fields are marked, non-required fields are hidden unless they already hold a stored value, and the Cash/Bank/MFS field is type-labelled and scoped to the ledger's linked accounts. Issue D (report filter UX clarity) is implemented: Cash/Bank/MFS Book Project/Cost Center filters moved to collapsible Advanced filters with accurate helper text. Issue E is mostly addressed (compact labels/tooltips). Issue F (demo data) is resolved by Phase 2H. Cash Book remains CASH-only and Bank Book remains BANK-only. MFS voucher posting support is locked for Phase 2I implementation. The MFS posting block in `voucher.service.ts` line 672 still rejects MFS cashBankAccountId; Phase 2I Chunk 2I-2 will remove this block and extend posting validation.

Phase 2I is complete and accepted at `10d6869` (tag `phase-2i-complete`). PAYMENT, RECEIPT, and CONTRA accept MFS cashBankAccountId; JOURNAL rejects MFS cashBankAccountId. Cash Book remains CASH-only and Bank Book remains BANK-only. MFS Book shows MFS movement from posted vouchers. Project reports include MFS lines only when projectId present; no double-counting. No schema/migration changes needed (MFS schema exists from Phase 2E). Base deterministic demo dataset remains unchanged; optional MFS demo scenario deferred unless user approves. See `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md`, `docs/acceptance/phase-2i-acceptance-criteria.md`, and `docs/plans/phase-2i-mfs-voucher-posting-plan.md`.

Phase 2J Project Fund Movement View is complete and accepted at commit `98212ba` (tag `phase-2j-complete`). See `docs/requirements/phase-2j-project-fund-movement-requirement-lock.md`, `docs/acceptance/phase-2j-acceptance-criteria.md`, and `docs/plans/phase-2j-project-fund-movement-plan.md`.

Phase 2K Voucher Fund-Line Project Tagging requirement lock is complete. See `docs/requirements/phase-2k-voucher-fund-line-project-tagging-requirement-lock.md`, `docs/acceptance/phase-2k-acceptance-criteria.md`, and `docs/plans/phase-2k-voucher-fund-line-project-tagging-plan.md`.

Do not implement actual Phase 2K frontend edits, backend validator changes, PDF/Excel export, dashboard analytics, payroll, salary sheets, parties, customers, vendors, additional roles, file uploads, business seed data, MFS provider API/payment gateway/customer wallet integration, or JOURNAL MFS acceptance until the user confirms the next phase or module.

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

Before any Phase 2F implementation, read:

- `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md`
- `docs/acceptance/phase-2f-acceptance-criteria.md`
- `docs/plans/phase-2f-accounting-report-ux-refinement-plan.md`

Before any Phase 2G implementation, read:

- `docs/requirements/phase-2g-project-cost-center-reporting-requirement-lock.md`
- `docs/acceptance/phase-2g-acceptance-criteria.md`
- `docs/plans/phase-2g-project-cost-center-reporting-plan.md`

Before any Phase 2H implementation, read:

- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md`
- `docs/acceptance/phase-2h-acceptance-criteria.md`
- `docs/plans/phase-2h-demo-data-cleanup-plan.md`

Before any Phase 2I implementation, read:

- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md`
- `docs/acceptance/phase-2i-acceptance-criteria.md`
- `docs/plans/phase-2i-mfs-voucher-posting-plan.md`

Before any Phase 2J implementation, read:

- `docs/requirements/phase-2j-project-fund-movement-requirement-lock.md`
- `docs/acceptance/phase-2j-acceptance-criteria.md`
- `docs/plans/phase-2j-project-fund-movement-plan.md`

## Agent Switching

When switching from Codex to Droid CLI, GLM, DeepSeek, Opus, Gemini, another AI, or a human developer:

1. Start with `docs/ai/START_HERE.md`.
2. Run `pnpm agent:start`.
3. Read `docs/ai/CURRENT_STATE.md`, `docs/ai/WORKFLOW.md`, `docs/handoff.md`, and the Phase 2K requirement lock docs.
4. Confirm `git status` is clean before new work.
5. Continue only inside the current phase boundary.
6. Update handoff docs before ending the session.

## Next Phase Guidance

Phase 2K Voucher Fund-Line Project Tagging is complete and accepted, pending only the user-created tag `phase-2k-complete`. Implemented chunks: 2K-1 requirement lock, 2K-2 backend validation audit / support, 2K-3 frontend voucher form update, 2K-4 browser/API/report regression verification, 2K-5 final acceptance/docs cleanup. Do not start next module/phase implementation or next requirement lock without explicit user confirmation.
