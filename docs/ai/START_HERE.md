# Start Here

This file is the first stop for any AI agent or developer continuing the Real Capita Accounting & Project Finance System.

## Current Status

Phase 0 is complete and accepted. Phase 1A adds multi-agent continuity plus single-accountant authentication.

Phase 1A is implemented in this repository.

Phase 1B documentation/specification lock is complete. Phase 2A accounting foundation is implemented and accepted.

Phase 2B voucher requirement documentation/specification lock is complete. Phase 2C voucher implementation is complete and accepted.

Phase 2D accounting reports implementation is complete and accepted. All six backend report APIs, all six frontend report pages, and the browser print foundation are implemented.

Phase 2E MFS / bKash transaction support requirement lock is complete and accepted at commit `fdffcfb`.

Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at `c820d7b`. The Prisma schema now models `CashBankAccountType.MFS`, the `MfsProvider` enum (`BKASH`, `NAGAD`, `ROCKET`, `UPAY`, `OTHER`), and nullable MFS metadata on `CashBankAccount` (`provider`, `providerOtherName`, `walletNumber`, `accountHolderName`).

Phase 2E Chunk 2E-3 backend validation/API changes are accepted at `97e69ab`. The backend Cash & Bank account API can create, list, update, and deactivate MFS accounts with provider and wallet metadata. Phase 2E Chunk 2E-4 frontend MFS account setup UI is accepted at `be2392a`: the existing Cash, Bank & MFS setup page lets the accountant create, view, edit, and deactivate MFS accounts alongside CASH and BANK. Phase 2E Chunk 2E-5 MFS Book report API is accepted at `d90ffd4`: `GET /reports/mfs-book` exists and derives from posted voucher lines filtered to MFS accounts only. Phase 2E Chunk 2E-6 MFS Book frontend and print foundation is accepted: `/app/reports/mfs-book` renders the MFS Book report page with filters, transaction lines, and browser print. Phase 2E MFS account setup and MFS Book foundation are now accepted. MFS voucher posting support is deferred to a later explicitly approved chunk/phase.

Phase 2F Accounting Report + Accountant UX Refinement requirement lock is complete and accepted. Issue A (Balance Sheet current-period profit/loss inclusion in equity) is implemented: the Balance Sheet now includes a report-only Current Period Net Profit/Loss line under Equity, computed from posted INCOME/EXPENSE movements. Issue B (report/table layout widening and textbook-style readability) is implemented: the app layout uses full viewport width, report tables hide less-critical columns to eliminate horizontal scroll, and dropdowns use compact labels with tooltips. Issues C-F (voucher line dynamic field visibility, report filter UX clarity, dropdown/table text clipping fixes, demo/test data cleanliness planning) are locked for future implementation.

Phase 2F Accounting Report + Accountant UX Refinement requirement lock is complete and accepted. Issue A (Balance Sheet current P/L) is implemented; issues B-F are locked. See `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md`, `docs/acceptance/phase-2f-acceptance-criteria.md`, and `docs/plans/phase-2f-accounting-report-ux-refinement-plan.md`.

The only confirmed role is `ACCOUNTANT`, displayed as `Accountant`. It represents AGM sir as the main accounting operator for now. Do not add other roles until Real Capita confirms exact responsibilities.

## Where To Look First

1. `AGENTS.md` for project rules and strict boundaries.
2. `docs/ai/CURRENT_STATE.md` for implemented and non-implemented scope.
3. `docs/ai/WORKFLOW.md` for safe agent workflow.
4. `docs/handoff.md` for the latest project handoff.
5. `prisma/schema.prisma` for the current database model.
6. `apps/api/src` and `apps/web/src` for implementation.
7. `docs/requirements/phase-2d-accounting-reports-requirement-lock.md` before any report-module coding.
8. `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md` and `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md` before any further MFS implementation.
9. `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md` and `docs/plans/phase-2f-accounting-report-ux-refinement-plan.md` before any Phase 2F implementation.
10. `docs/prompts/phase-2d-next-prompt.md` if continuing in Droid CLI or another agent.

## Local Setup

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

## Verification

```powershell
pnpm check:all
pnpm doctor
```

Manual auth verification:

- Start the API with `pnpm dev:api`.
- Start the web app with `pnpm dev:web`.
- Visit `/login`.
- Sign in with `accountant@realcapita.local` and `ChangeMe123!`.
- Confirm `/app` shows the user and the Accountant role.

## If Previous AI Context Was Lost

Do not rely on hidden chat memory. Reconstruct state from this repo:

1. Run `pnpm agent:start`.
2. Read `docs/ai/CURRENT_STATE.md`.
3. Check `git log --oneline --max-count=8`.
4. Check `git status --short --branch`.
5. Continue only from documented requirements.

If continuing after Codex limit in Droid CLI, GLM, DeepSeek, Opus, Gemini, or another tool, read `docs/plans/phase-2f-accounting-report-ux-refinement-plan.md` and `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md` before coding. The next recommended task is Phase 2F Chunk 2F-5 voucher line dynamic field visibility, or Phase 2F Chunk 2F-6 Cash/Bank/MFS advanced filter UX, only if the user explicitly confirms.
