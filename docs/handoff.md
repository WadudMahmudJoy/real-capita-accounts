# Real Capita Accounting & Project Finance System Handoff

## Current Phase

Phase 2C: voucher implementation planning.

Phase 0 is complete and accepted. Phase 1A delivered the secure login, the single confirmed Accountant role, the protected app shell, agent documentation, ADRs, and verification scripts. Phase 1B locked the accounting foundation requirements and acceptance criteria. Phase 2A implemented the accounting foundation in schema, backend, and frontend. Phase 2B locked voucher requirements before any voucher implementation. Phase 2C plans the voucher implementation chunks.

## Phase 2C Voucher Implementation Planning - completed this session

- Created `docs/plans/phase-2c-voucher-implementation-plan.md`: splits voucher implementation into 6 chunks (2C-1 schema only, 2C-2 backend draft API, 2C-3 posting validation service, 2C-4 frontend draft/create UI, 2C-5 posting UI and print foundation, 2C-6 final integration review). Each chunk includes objective, files likely to change, strict out-of-scope, verification commands, manual smoke tests, recommended model, fallback model, risk level, and stop condition.
- Created `docs/prompts/phase-2c-chunk-1-voucher-schema-prompt.md`: future prompt for schema-only implementation of Chunk 2C-1, explicitly stating no API, no frontend, no posting service, no reports, no new roles, no parties/customers/vendors, no file uploads.
- Updated `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md` to reflect Phase 2C planning.
- No Prisma schema changes, migrations, backend changes, frontend changes, roles, business seed data, file uploads, vouchers, reports, dashboard analytics, payroll, parties, customers, or vendors were added in this planning session.

## Phase 2B Voucher Requirement Lock - completed this session

- Created `docs/requirements/phase-2b-voucher-requirement-lock.md`: defines voucher module purpose, six voucher types (Debit, Credit, Journal, Contra, Payment, Receipt) with overlap clarification, system-generated voucher number, physical SI No, voucher date, fiscal year/period linkage, draft vs posted workflow, posting date, narration/description, debit-credit line structure, LedgerAccount selection, project/cost center requirement validation, cash/bank behavior, audit trail, print/export deferred, attachment deferred, no reports, no parties/customers/vendors.
- Created `docs/architecture/phase-2b-voucher-model-proposal.md`: proposes Voucher, VoucherLine, VoucherType enum, VoucherStatus enum, VoucherNumberSequence models with relations to Phase 2A foundation entities, validation rules, posting rules, reversal/correction policy, deletion policy (no hard delete after posting), draft editing policy, posted editing policy, accounting period lock/close behavior, idempotency/concurrency concerns, and the principle that reports derive from posted VoucherLine records.
- Created `docs/acceptance/phase-2b-acceptance-criteria.md`: defines acceptance for documentation lock, future backend, future frontend, posting validation, security, audit trail, smoke tests, and an explicit out-of-scope list.
- Created `docs/decisions/ADR-0007-phase-2b-voucher-requirement-lock.md`: documents the decision to lock voucher requirements before implementation.
- Created `docs/prompts/droid-cli-phase-2b-next-prompt.md`: future prompt for the next agent to review the Phase 2B docs only, explicitly stating no implementation, no schema changes, no voucher code yet, check consistency with Phase 2A foundation.
- Updated `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md` to reflect Phase 2B docs lock.
- No Prisma schema changes, migrations, backend changes, frontend changes, roles, business seed data, file uploads, vouchers, reports, dashboard analytics, payroll, parties, customers, or vendors were added in Phase 2B.

## Phase 2A Chunk 3B (remaining frontend foundation) - completed this session

- Reused the partial Chunk 3B frontend work already in progress: the shared `Select` primitive, expanded typed API helpers, and active navigation links for the remaining accounting foundation pages.
- Added `apps/web/src/app/app/accounting-periods/page.tsx`: list, create, and edit accounting periods under fiscal years with OPEN, LOCKED, and CLOSED status.
- Added `apps/web/src/app/app/cost-centers/page.tsx`: list, create, edit, and deactivate cost centers under projects.
- Added `apps/web/src/app/app/accounts/groups/page.tsx`: list, create, edit, and deactivate account groups under fixed account classes.
- Added `apps/web/src/app/app/accounts/ledger/page.tsx`: list, create, edit, and deactivate ledger accounts with normal balance, project/cost-center requirement flags, and Cash/Bank eligibility.
- Added `apps/web/src/app/app/cash-bank/page.tsx`: list, create, edit, and deactivate cash/bank accounts linked only to ledger accounts marked as Cash/Bank.
- Phase 2A accounting foundation frontend is now implemented.
- No Prisma schema changes, migrations, backend changes, roles, business seed data, file uploads, vouchers, reports, dashboard analytics, payroll, parties, customers, or vendors were added in Chunk 3B.

## Phase 2A Chunk 3A (frontend foundation) - completed

- Extended `apps/web/src/lib/api.ts` into a typed, cookie-authenticated API helper: `apiFetch` always sends `credentials: "include"`, surfaces clear auth/connection errors through an `ApiError` type, and never stores tokens in `localStorage`. Added resource helpers and types for company, fiscal years, projects, and account classes.
- Added `apps/web/src/app/app/_components/ui.tsx` shared presentation primitives (cards, fields, buttons, status badges, notices) for a calm, professional accountant UI.
- Added `apps/web/src/app/app/layout.tsx`: a protected app shell that gates on `GET /auth/me`, shows the signed-in user and role, provides sign out, and renders real navigation.
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

- Dashboard analytics.
- Voucher screens, journals, posting, or transaction workflows (locked in Phase 2B docs only).
- Ledger reports, cash book, bank book, trial balance, or financial statements.
- Payroll, salary sheets, HR, CRM, party, customer, or vendor modules.
- File uploads.
- Business seed data.
- Unconfirmed office roles.
- Real company documents or private operational data.
- Code copied from the previous Real Capita ERP prototype.

## Next Planned Phase

Phase 2C voucher implementation planning is complete. The next task should be explicit user confirmation to start Chunk 2C-1 (voucher schema only), using `docs/prompts/phase-2c-chunk-1-voucher-schema-prompt.md` as the agent prompt.

Still not implemented:

- Vouchers, journals, posting, or transaction workflows.
- Ledger reports, cash book, bank book, trial balance, financial statements, or dashboard analytics.
- Payroll or salary sheets.
- Parties, customers, vendors, HR, CRM, or ERP modules.
- Additional roles beyond `ACCOUNTANT`.
- File uploads.
- Business seed data or private operational data.

## Current GitHub Repository

`https://github.com/MaruflRana/real-capita-accounts`

## Last Verification Results

Verification date: 2026-06-14, Phase 2A Chunk 3B.

- `pnpm prisma:generate`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm build:web`: passed.
- `pnpm build:api`: passed.
- `pnpm check:all`: passed.
- `pnpm doctor`: passed with the known local warning that port `3000` is occupied; use web port `3010` and start the API with `WEB_ORIGIN=http://localhost:3010` for local smoke tests.
- Final quick `pnpm typecheck`: passed after restoring the generated Next.js route-types import.
- Manual browser/API smoke tests on `http://localhost:3010` and `http://localhost:4000`: passed login, unauthenticated protected-page redirect, `/app` foundation navigation, and create/update checks for accounting periods, cost centers, account groups, ledger accounts, and cash/bank accounts.
- Cash & Bank page verified that only ledger accounts marked `isCashBank=true` appear in the linked ledger dropdown; a non-cash-bank ledger account was not selectable.
