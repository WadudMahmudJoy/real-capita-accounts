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

Phase 2F Accounting Report + Accountant UX Refinement requirement lock is complete and accepted. Issue A (Balance Sheet current-period profit/loss inclusion in equity) is implemented: the Balance Sheet now includes a report-only Current Period Net Profit/Loss line under Equity, computed from posted INCOME/EXPENSE movements. Issue B (report/table layout widening and textbook-style readability) is implemented: the app layout uses full viewport width, report tables hide less-critical columns to eliminate horizontal scroll, and dropdowns use compact labels with tooltips. Issue C (voucher line dynamic field visibility) is implemented: voucher line Project/Cost Center/Cash-Bank-MFS fields respond to the selected ledger account, required fields are marked, non-required fields are hidden unless a stored value exists, and the Cash/Bank/MFS field is type-labelled and scoped to the ledger's linked accounts; backend posting validation remains the authority and posted vouchers remain read-only. Issue D (report filter UX clarity) is implemented: Cash Book, Bank Book, and MFS Book Project/Cost Center filters are moved to a collapsible "Advanced filters" section with clear helper text explaining they are line-level filters on the cash/bank/MFS ledger line itself (backend verification confirmed `buildLineFilter` applies `projectId`/`costCenterId` directly to the same voucher line row). Primary filters remain prominent. Ledger Statement, Trial Balance, Income Statement, and Balance Sheet filter panels are unchanged. Issues E-F (dropdown/table text clipping remaining fixes, demo/test data cleanliness planning) are locked for future implementation.

Phase 2G Project/Cost-Center Financial Reporting is complete and accepted at `7e60a1f` (tag `phase-2g-complete`). All four primary reports are implemented and verified. The optional Report E (Project Cash/Bank Movement View) remains deferred.

Phase 2H-1 Demo Data Audit (`pnpm demo:audit`) is implemented. Phase 2H-2 Safe Demo Reset (`pnpm demo:reset`) is implemented: a destructive CLI command with CONFIRM_DEMO_RESET=YES guard, local DB guard, production refusal, dry-run mode, and mandatory backup instruction. It resets the local/dev database to a clean deterministic Real Capita demo dataset. Phase 2H-3 Demo Verification (`pnpm demo:verify`) is implemented: a read-only CLI command that asserts the deterministic demo dataset exists and matches expected accounting/report totals. Phase 2H-4 Docs Cleanup and final review is complete. Phase 2H is accepted at `96fb653` (tag `phase-2h-complete`). Phase 2H directly addresses and resolves Phase 2F Issue F (demo data).

Phase 2I MFS Voucher Posting Continuation is complete and accepted at `10d6869` (tag `phase-2i-complete`). PAYMENT/RECEIPT/CONTRA accept MFS cashBankAccountId; JOURNAL rejects MFS cashBankAccountId. Frontend prevents MFS on JOURNAL with clear guidance. MFS Book shows MFS movement from posted vouchers; Cash Book remains CASH-only; Bank Book remains BANK-only; Project reports include MFS lines only when projectId present. Base deterministic demo dataset unchanged; optional MFS demo scenario deferred unless user approves. No schema/migration changes. Out of scope: provider API/payment gateway/customer wallet integration. Implemented chunks: 2I-1 requirement lock, 2I-2 backend MFS posting, 2I-3 frontend MFS voucher UI, 2I-4 report regression/demo decision, 2I-5 final review. See `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md`, `docs/acceptance/phase-2i-acceptance-criteria.md`, and `docs/plans/phase-2i-mfs-voucher-posting-plan.md`.

Phase 2J Project Fund Movement View is complete and accepted pending only the user-created completion tag. Project Fund Movement View uses Option A strict same-line only. Implemented chunks: 2J-1 requirement lock, 2J-2 backend API, 2J-3 frontend page, 2J-4 regression, 2J-5 final acceptance. Base demo SK-001 returns empty Project Fund Movement rows intentionally because cash/bank/MFS lines have no projectId. Existing reports remain unchanged. No schema/migration/demo dataset changes. See `docs/requirements/phase-2j-project-fund-movement-requirement-lock.md`, `docs/acceptance/phase-2j-acceptance-criteria.md`, and `docs/plans/phase-2j-project-fund-movement-plan.md`.

Phase 2F is complete and accepted at `17fede6` (tag `phase-2f-complete`). Issues A-D implemented, Issue E mostly addressed, Issue F deferred to Phase 2H.

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
10. `docs/requirements/phase-2g-project-cost-center-reporting-requirement-lock.md` and `docs/plans/phase-2g-project-cost-center-reporting-plan.md` before any Phase 2G implementation.
11. `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md` and `docs/plans/phase-2h-demo-data-cleanup-plan.md` before any Phase 2H implementation.
12. `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md` and `docs/plans/phase-2i-mfs-voucher-posting-plan.md` before any Phase 2I implementation.

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

If continuing after Codex limit in Droid CLI, GLM, DeepSeek, Opus, Gemini, or another tool, read `docs/handoff.md` and `docs/ai/CURRENT_STATE.md` for the latest project state. Phase 2H is complete and accepted at `96fb653` (tag `phase-2h-complete`). Phase 2I MFS Voucher Posting Continuation is complete and accepted at `10d6869` (tag `phase-2i-complete`). Phase 2J Project Fund Movement View is complete and accepted pending only the user-created completion tag. Do not start next phase/module without explicit user confirmation.
