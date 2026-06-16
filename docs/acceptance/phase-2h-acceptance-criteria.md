# Phase 2H Acceptance Criteria

## Purpose

Phase 2H locks requirements for demo/test data audit, cleanup, reset, and verification tooling. This document defines acceptance criteria for the documentation lock and for future implementation chunks.

## Acceptance Checklist for Phase 2H Documentation Lock

Phase 2H requirement lock is accepted when:

- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md` exists and covers all four tooling capabilities (A: Demo Data Audit, B: Safe Demo Reset, C: Deterministic Demo Dataset, D: Demo Verification), confirmed business context, single-role rule, safety-first design, technical constraints, UX constraints, security rule, open questions with recommended answers, and explicit out-of-scope list.
- `docs/acceptance/phase-2h-acceptance-criteria.md` exists.
- `docs/plans/phase-2h-demo-data-cleanup-plan.md` exists with implementation chunks, each with objective, scope, files to read, files likely to change, in-scope, out-of-scope, safety checks, acceptance checks, verification commands, recommended model, and exact stop condition.
- `AGENTS.md` points future agents to the Phase 2H lock.
- `docs/ai/CURRENT_STATE.md` states that Phase 2H requirement lock is prepared.
- `docs/ai/START_HERE.md` points agents to the Phase 2H docs.
- `docs/handoff.md` records the created Phase 2H files and states that no runtime modules were implemented.
- `README.md` states the current development phase includes the Phase 2H requirement lock.
- `prisma/schema.prisma` is unchanged by Phase 2H documentation lock.
- No seed scripts, audit scripts, reset scripts, verification scripts, report tables, new API endpoints, new frontend pages, new sidebar entries, MFS posting support, PDF/Excel export, or MFS runtime logic were added in the documentation lock phase.
- Phase 2G acceptance state is preserved and documented.
- Verification passes with `pnpm check:all` and `pnpm doctor`.

---

## Acceptance Checklist for Future Demo Data Audit Implementation (Tool A)

After explicit user confirmation, the future Demo Data Audit implementation is accepted only if:

- `pnpm demo:audit` command exists in `package.json` and runs successfully.
- The audit is strictly read-only. It never deletes, updates, or inserts data.
- The audit prints entity counts for all major entities (company, fiscal year, period, project, cost center, account class, account group, ledger account, cash/bank/MFS account).
- The audit prints voucher counts by status and type.
- The audit detects duplicate-looking fiscal years, periods, ledger codes, and cash/bank/MFS display names.
- The audit checks orphans: projects without cost centers, cost centers with inactive/missing projects, ledger accounts with inactive groups, cash/bank accounts with inactive/non-cash-bank ledgers.
- The audit checks voucher line consistency: project/cost-center mismatches, cash/bank linked to non-cash-bank ledger.
- The audit checks report readiness for all 11 reports (Trial Balance, Balance Sheet, Cash Book, Bank Book, MFS Book, Income Statement, Project Ledger, Project Cost, Cost Center Summary, Project Financial Summary, Ledger Statement).
- The audit prints a summary with number of issues found and recommended cleanup command.
- The audit works on local/dev DB. It prints a warning if `DATABASE_URL` does not appear local.
- No Prisma schema change, no migration, no report table, no new role, no MFS posting support, no frontend page change.

---

## Acceptance Checklist for Future Safe Demo Reset Implementation (Tool B)

After explicit user confirmation, the future Safe Demo Reset implementation is accepted only if:

- `pnpm demo:reset` command exists in `package.json`.
- The command refuses to run without `CONFIRM_DEMO_RESET=YES` environment variable.
- The command refuses to run on non-local databases (checks `DATABASE_URL` host, port, and database name).
- The command refuses to run if `NODE_ENV=production`.
- The command prints the target `DATABASE_URL` host, port, and database before any destructive operation.
- The command prints a mandatory `pg_dump` backup command before proceeding.
- The command supports `--dry-run` or `DEMO_RESET_DRY_RUN=YES` mode that prints what would be deleted/recreated without performing any operation.
- The command preserves/recreates the ACCOUNTANT seed user (`accountant@realcapita.local` with hashed password).
- The command deletes all vouchers, voucher lines, voucher number sequences, audit events, and auth sessions before recreating deterministic data.
- The command recreates all deterministic infrastructure entities: Company, FiscalYear, AccountingPeriod, Project, CostCenter, AccountClass, AccountGroup, LedgerAccount, CashBankAccount (CASH, BANK, MFS), Role, User.
- The command creates and posts exactly 2 vouchers through the existing VoucherService (capital introduction JOURNAL and land development expense PAYMENT).
- The command uses the existing voucher creation and posting services for voucher operations, preserving posting validation, voucher number generation, and audit events.
- The command runs `pnpm demo:verify` after reset and prints the verification result.
- If verification fails, the command prints a clear error and recommended fix.
- No Prisma schema change, no migration, no report table, no new role.
- MFS voucher posting remains rejected. No MFS posted vouchers are created.
- No real passwords, real wallet numbers, or private business data in seed data.

---

## Acceptance Checklist for Future Demo Verification Implementation (Tool D)

After explicit user confirmation, the future Demo Verification implementation is accepted only if:

- `pnpm demo:verify` command exists in `package.json` and runs successfully.
- The verification is read-only. It never creates, updates, or deletes data.
- The verification checks all items listed in the requirement lock section F:
  - Seed user exists with ACCOUNTANT role
  - Company exists with BDT currency
  - Fiscal year FY 2025-2026 is active
  - June 2026 period is OPEN
  - SK-001 project is active
  - SK-LD cost center is active and linked to SK-001
  - All 5 ledger accounts exist and are active with correct flags
  - All 3 cash/bank/MFS accounts exist and are correctly linked
  - Exactly 2 posted vouchers exist, 0 drafts, 0 soft-deleted
  - Trial Balance is balanced (difference = 0)
  - Cash Book closing = 50,000 Dr
  - Income Statement net loss = 50,000
  - Balance Sheet adjusted is balanced
  - Project Ledger shows 1 expense line for SK-001/SK-LD
  - Project Cost shows expense 50,000, no Unassigned duplicate for SK-LD
  - Cost Center Summary shows SK-LD once, 0 unassigned
  - Project Financial Summary shows expense 50,000, asset 0, income 0
  - MFS posting is still blocked/rejected
- The verification uses the running API's report endpoints (not raw SQL) to verify report totals.
- The verification prints PASS/FAIL for each check.
- The verification prints a summary with number of checks passed and failed.
- The verification exits with non-zero code if any check fails.
- No Prisma schema change, no migration, no report table, no new role.

---

## Acceptance Checklist for Future Docs Cleanup and Integration Review (Chunk 2H-4)

After explicit user confirmation, the future docs cleanup is accepted only if:

- `pnpm demo:audit`, `pnpm demo:reset`, and `pnpm demo:verify` all work correctly.
- The deterministic demo dataset produces all expected report results as specified in the requirement lock section E.
- All existing report endpoints return correct results after demo reset (regression test).
- No scope creep beyond the Phase 2H requirement lock.
- Phase 2F Issue F is marked as resolved.
- Docs updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.
- `pnpm check:all` and `pnpm doctor` pass.

---

## Regression Criteria

All existing acceptance criteria from Phase 2G, 2F, 2E, 2D, 2C, 2A, and 1A continue to pass after Phase 2H implementation:

- All 11 backend report endpoints return correct results after demo reset.
- All 11 frontend report pages render correctly.
- Cash Book shows only CASH transactions.
- Bank Book shows only BANK transactions.
- MFS Book shows only MFS transactions.
- Trial Balance total debits equal total credits.
- Income Statement net profit calculation is correct.
- Balance Sheet balance check (both unadjusted and P/L-adjusted) is correct.
- MFS account setup works unchanged.
- Voucher posting rejects MFS cash-bank accounts (MFS posting remains deferred).
- Voucher line dynamic field visibility works unchanged.
- Report filter UX clarity (advanced filters on Cash/Bank/MFS Book) works unchanged.
- Project Ledger, Project Cost, Cost Center Summary, and Project Financial Summary produce correct results with the deterministic dataset.

---

## Explicit Non-Acceptance Conditions

Phase 2H requirement lock and future implementation are NOT accepted if:

- MFS is forced under BANK or CASH account type.
- Cash Book or Bank Book shows MFS transactions.
- MFS voucher posting support is added without explicit approval.
- New roles are introduced.
- PDF/Excel export is added.
- Dashboard analytics is added.
- Party/customer/vendor module is added.
- Closing-entry automation is added.
- Editable report tables are added to the Prisma schema.
- Direct posted voucher editing is enabled.
- Prisma schema is changed without explicit justification.
- A migration is created without explicit justification.
- Existing report API contracts are broken.
- Demo reset runs on production database.
- Demo reset runs without `CONFIRM_DEMO_RESET=YES`.
- Demo reset runs without local database guard.
- Demo audit modifies data (must be read-only).
- Demo verification modifies data (must be read-only).
- Seed data contains real passwords, real wallet numbers, or private business data.
- MinIO/object storage is cleared without separate explicit approval.

---

## Verification Commands

Run these commands for Phase 2H documentation lock:

```powershell
git pull --ff-only
git status --short --branch
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
docker compose config
pnpm check:all
pnpm doctor
git status --short --branch
git log --oneline -10
```

Since this is documentation-only, source behavior must remain unchanged. All verification commands should pass without any new errors or warnings introduced by the Phase 2H documentation.
