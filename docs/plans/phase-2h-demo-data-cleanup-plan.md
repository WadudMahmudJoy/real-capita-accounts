# Phase 2H: Demo/Test Data Cleanup and Safe Demo Dataset Standardization Implementation Plan

## Purpose

Phase 2H plans the implementation of demo data audit, safe demo reset, deterministic demo dataset, and demo verification tooling based on the Phase 2H requirement lock. This document splits the implementation into safe, reviewable chunks so each step can be verified before the next begins.

This is a planning document only. It does not change schema, API, frontend, roles, seed data, or any runtime behavior.

## Prerequisite

Phase 2H requirement lock is complete and accepted. The following docs define what Phase 2H must implement:

- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md`
- `docs/acceptance/phase-2h-acceptance-criteria.md`

Phase 2H must not add anything beyond what is locked in those documents.

## Confirmed Constraints

- Only `ACCOUNTANT` role exists. No additional roles.
- No dashboard analytics, no payroll, no parties/customers/vendors.
- No file uploads, no business seed data changes during requirement lock.
- No report tables as primary source; all reports derive from posted VoucherLine records.
- No PDF or Excel export. Browser print foundation continues.
- No MFS voucher posting support.
- Cash Book remains CASH-only. Bank Book remains BANK-only. MFS Book remains MFS-only.
- No schema changes or migrations.
- Demo reset must refuse to run without `CONFIRM_DEMO_RESET=YES`.
- Demo reset must refuse to run on non-local databases.
- Demo audit must be strictly read-only.
- Demo verification must be strictly read-only.
- MFS wallet seeded with placeholder number, no real wallet data.
- Seed user password must be bcrypt-hashed, never plaintext.

---

## Chunk Overview

| Chunk | Objective | Risk Level |
| --- | --- | --- |
| 2H-1 | Read-only Demo Audit command (`pnpm demo:audit`) | Low |
| 2H-2 | Safe Demo Reset command (`pnpm demo:reset`) with confirmation guard and deterministic dataset | High |
| 2H-3 | Demo Verify command (`pnpm demo:verify`) with accounting/report assertions | Medium |
| 2H-4 | Browser/API smoke verification and docs cleanup; tag Phase 2H complete | Low |

---

## Chunk 2H-1: Read-only Demo Audit Command

### Objective

Add `pnpm demo:audit` as a read-only CLI command that reports current demo/test data state without modifying anything.

### Scope

CLI tooling only. No backend API, no frontend, no schema change.

### Files to Read Before Implementation

- `prisma/schema.prisma` -- understand all entity models and relations.
- `package.json` -- understand existing scripts and seed command.
- `scripts/doctor.ps1` -- understand existing check/verification pattern.
- `scripts/check-all.ps1` -- understand existing pipeline pattern.
- `apps/api/src/report/report.service.ts` -- understand report readiness checks.
- `apps/api/src/voucher/voucher.service.ts` -- understand voucher status/type enums.
- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md` -- understand full audit requirements.

### Files Likely to Change

- `prisma/demo-audit.ts` -- new file: audit script.
- `package.json` -- add `demo:audit` script entry.
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs.

### In-Scope

- `pnpm demo:audit` command that prints structured audit report to stdout.
- Entity counts for all major entities.
- Voucher counts by status and type.
- Duplicate detection for fiscal years, periods, ledger codes, cash/bank/MFS display names.
- Orphan checks for project/cost-center/ledger/cash-bank consistency.
- Voucher line consistency checks.
- Report readiness checks (call running API if available, or skip with clear note if API not running).
- Summary line with issue count and recommended cleanup command.
- Warning if `DATABASE_URL` does not appear local.

### Out-of-Scope

- Demo reset (Chunk 2H-2).
- Demo verification (Chunk 2H-3).
- Any data modification.
- Any frontend page.
- Any schema/migration change.
- MFS voucher posting.
- New roles.

### Safety Checks

- Script must never issue DELETE, UPDATE, or INSERT queries.
- Script must never call destructive API endpoints.
- Script must print a warning if DATABASE_URL does not appear local.

### Acceptance Checks

- `pnpm demo:audit` runs and produces structured output.
- Output includes entity counts, voucher counts, duplicate detection, orphan checks, consistency checks, and report readiness.
- No data modification occurs during audit.
- Warning printed for non-local DATABASE_URL.
- `pnpm check:all` and `pnpm doctor` pass.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
pnpm check:all
pnpm doctor
```

Manual smoke test:

- Run `pnpm demo:audit` on local dev DB.
- Confirm output includes all required categories.
- Confirm no data modification.

### Recommended Model

GLM 5.1 High for audit script implementation and review.

### Stop Condition

All acceptance checks pass. `pnpm check:all` and `pnpm doctor` pass. Docs updated.

---

## Chunk 2H-2: Safe Demo Reset Command with Deterministic Dataset

### Objective

Add `pnpm demo:reset` as a destructive CLI command with confirmation guard that resets the local dev database to a clean deterministic Real Capita demo dataset.

### Scope

CLI tooling + seed script. High risk because it deletes data. Multiple safety guards required.

### Files to Read Before Implementation

- All files from Chunk 2H-1.
- `apps/api/src/voucher/voucher.service.ts` -- understand voucher creation and posting API.
- `apps/api/src/voucher/dto/create-voucher.dto.ts` -- understand voucher creation DTO.
- `apps/api/src/prisma/prisma.service.ts` -- understand Prisma client access.
- `apps/api/src/auth/auth.service.ts` -- understand user/role creation and password hashing.
- `apps/api/src/cash-bank/cash-bank.service.ts` -- understand cash/bank account creation.
- `prisma/schema.prisma` -- understand all models and relations for data clearing.
- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md` -- understand full reset requirements and deterministic dataset specification.

### Files Likely to Change

- `prisma/demo-reset.ts` -- new file: reset + seed script.
- `package.json` -- add `demo:reset` script entry.
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs.

### In-Scope

- `pnpm demo:reset` command with `CONFIRM_DEMO_RESET=YES` guard.
- Local database guard (`DATABASE_URL` must appear local).
- `NODE_ENV=production` refusal.
- Target URL display before destructive operations.
- Dry-run mode (`DEMO_RESET_DRY_RUN=YES`).
- Mandatory `pg_dump` backup command print.
- Data clearing: delete all vouchers, voucher lines, voucher number sequences, audit events, auth sessions, cash/bank/MFS accounts, ledger accounts, account groups, account classes, cost centers, projects, accounting periods, fiscal years, companies, user roles, roles, users.
- Deterministic dataset recreation: Company, FiscalYear, AccountingPeriod, Project, CostCenter, AccountClass (5 standard), AccountGroup (3), LedgerAccount (5), CashBankAccount (3), Role (ACCOUNTANT), User (accountant@realcapita.local).
- Voucher creation through existing VoucherService API or equivalent service-layer logic.
- Voucher posting through existing VoucherService posting method.
- Post-reset verification (runs `pnpm demo:verify` automatically).

### Out-of-Scope

- Demo audit (completed in 2H-1).
- Demo verification script (Chunk 2H-3, but reset calls it).
- PDF/Excel export.
- Dashboard analytics.
- Schema changes or migrations.
- MFS voucher posting (no MFS posted vouchers created).
- MinIO/object storage cleanup.

### Safety Checks

- Must refuse without `CONFIRM_DEMO_RESET=YES`.
- Must refuse on non-local DATABASE_URL.
- Must refuse if NODE_ENV=production.
- Must print target DATABASE_URL before proceeding.
- Must print pg_dump backup command.
- Must support dry-run mode.
- Must preserve/recreate ACCOUNTANT seed user.
- Must never run automatically in CI/CD.

### Acceptance Checks

- `pnpm demo:audit` command exists.
- Command refuses to run without `CONFIRM_DEMO_RESET=YES`.
- Command refuses to run on non-local DATABASE_URL.
- Command refuses to run if `NODE_ENV=production`.
- Command prints target DATABASE_URL before proceeding.
- Command prints pg_dump backup command.
- Dry-run mode prints what would be deleted without performing deletions.
- After reset with confirmation, the database contains exactly the deterministic dataset.
- Exactly 2 posted vouchers exist.
- Cash Book closing = 50,000 Dr.
- Trial Balance is balanced.
- Post-reset verification runs automatically.
- `pnpm check:all` and `pnpm doctor` pass.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
pnpm check:all
pnpm doctor
```

Manual smoke test:

- Run `pnpm demo:reset` without `CONFIRM_DEMO_RESET=YES` -- confirm refusal.
- Run `pnpm demo:reset` with `CONFIRM_DEMO_RESET=YES` on local DB -- confirm reset succeeds.
- Run `pnpm demo:verify` after reset -- confirm all checks pass.
- Run all report endpoints after reset -- confirm expected results.

### Recommended Model

DeepSeek V4 Pro Max for reset/seed implementation (complex service-layer interaction, safety guards). GLM 5.1 High for review/acceptance.

### Stop Condition

All acceptance checks pass. `pnpm check:all` and `pnpm doctor` pass. Docs updated.

---

## Chunk 2H-3: Demo Verify Command with Accounting/Report Assertions

### Objective

Add `pnpm demo:verify` as a read-only CLI command that asserts the deterministic demo dataset produces expected accounting/report totals.

### Scope

CLI tooling only. No backend API, no frontend, no schema change.

### Files to Read Before Implementation

- All files from Chunks 2H-1 and 2H-2 (established patterns).
- `apps/api/src/report/report.controller.ts` -- understand all report endpoints.
- `apps/api/src/auth/auth.controller.ts` -- understand login endpoint for API-based verification.
- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md` -- understand full verification requirements.

### Files Likely to Change

- `prisma/demo-verify.ts` -- new file: verification script.
- `package.json` -- add `demo:verify` script entry.
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs.

### In-Scope

- `pnpm demo:verify` command.
- Seed user existence and role check.
- Infrastructure entity existence checks (company, FY, period, project, cost center, ledgers, cash/bank/MFS accounts).
- Voucher count checks (exactly 2 posted, 0 draft, 0 soft-deleted).
- Report total checks via API endpoints (Trial Balance, Income Statement, Balance Sheet, Cash Book, Project Ledger, Project Cost, Cost Center Summary, Project Financial Summary).
- MFS posting block verification.
- PASS/FAIL output per check.
- Summary line with passed/failed counts.
- Non-zero exit code on failure.

### Out-of-Scope

- Demo audit (completed in 2H-1).
- Demo reset (completed in 2H-2).
- PDF/Excel export.
- Dashboard analytics.
- Schema changes or migrations.

### Safety Checks

- Must be read-only. Never create, update, or delete data.
- Must call API endpoints for report verification (not raw SQL) if API is running. If API is not running, must print a note and skip report checks, or optionally start the API.

### Acceptance Checks

- `pnpm demo:verify` runs and produces PASS/FAIL output.
- All required checks are present and assert expected values.
- Command exits with non-zero code if any check fails.
- Command exits with zero code if all checks pass.
- No data modification occurs.
- `pnpm check:all` and `pnpm doctor` pass.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
pnpm check:all
pnpm doctor
```

Manual smoke test:

- Run `pnpm demo:verify` after demo reset -- confirm all checks pass.
- Introduce a data inconsistency -- confirm relevant check fails.

### Recommended Model

DeepSeek V4 Pro Max for verification script implementation. GLM 5.1 High for review/acceptance.

### Stop Condition

All acceptance checks pass. `pnpm check:all` and `pnpm doctor` pass. Docs updated.

---

## Chunk 2H-4: Browser/API Smoke Verification and Docs Cleanup

### Objective

Full integration review across all Phase 2H chunks. Verify scope boundaries, safety, regression, and documentation completeness. Update docs to reflect Phase 2H completion. Mark Phase 2F Issue F as resolved.

### Scope

Review and documentation only. No code changes unless a review bug is found.

### Files to Read

- All Phase 2H implementation files (audit, reset, verify scripts, package.json).
- All Phase 2H documentation (requirement lock, acceptance criteria, plan).
- `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

### Files Likely to Change

- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md` -- no change (already locked).
- `docs/acceptance/phase-2h-acceptance-criteria.md` -- no change (already locked).
- `docs/plans/phase-2h-demo-data-cleanup-plan.md` -- no change (already locked).
- `AGENTS.md` -- update to reflect Phase 2H acceptance.
- `README.md` -- update to reflect Phase 2H completion.
- `docs/ai/START_HERE.md` -- update to reflect Phase 2H acceptance.
- `docs/ai/CURRENT_STATE.md` -- update to reflect Phase 2H completion.
- `docs/handoff.md` -- update to reflect Phase 2H acceptance and handoff.

### In-Scope

- Verify `pnpm demo:audit`, `pnpm demo:reset`, and `pnpm demo:verify` all work correctly.
- Verify demo reset produces the deterministic dataset with expected report results.
- Verify demo reset safety guards (confirmation, local DB, production refusal).
- Verify demo audit is read-only.
- Verify demo verification is read-only and exits correctly on pass/fail.
- Verify all 11 report endpoints return correct results after demo reset.
- Verify MFS posting is still rejected.
- Verify only `ACCOUNTANT` role exists.
- Verify auth uses HttpOnly cookies, no localStorage token usage.
- Verify no schema/migration/report table was added.
- Mark Phase 2F Issue F as resolved.
- Documentation updates.

### Out-of-Scope

- Any new features beyond Phase 2H scope.
- PDF/Excel export.
- Dashboard analytics.
- New roles.
- MFS voucher posting support.
- MinIO/object storage cleanup.

### Acceptance Checks

- All 2H-1 through 2H-3 acceptance checks still pass.
- No scope creep beyond the Phase 2H requirement lock.
- All existing report endpoints and pages work unchanged after demo reset.
- All verification commands pass.

### Verification Commands

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

Manual smoke tests:

- Run `pnpm demo:audit` -- confirm read-only report.
- Run `pnpm demo:reset` with `CONFIRM_DEMO_RESET=YES` -- confirm reset succeeds.
- Run `pnpm demo:verify` -- confirm all checks pass.
- Run all report endpoints after reset -- confirm expected results.
- Run `pnpm demo:reset` without `CONFIRM_DEMO_RESET=YES` -- confirm refusal.

### Recommended Model

GLM 5.1 High for review/acceptance. DeepSeek V4 Flash/Low for docs/fixups.

### Stop Condition

All review goals pass. All verification commands pass. Docs updated. Phase 2H is accepted.

---

## Summary

Phase 2H adds three CLI tooling commands (Demo Audit, Demo Reset, Demo Verification) plus a docs cleanup chunk. The reset produces a clean, deterministic Real Capita demo dataset with exactly 2 posted vouchers that generate predictable report totals. All tools are safety-first: audit is read-only, reset requires explicit confirmation and local DB guard, verification is read-only and exits with appropriate codes. No schema change is expected. No new roles. No editable report tables. The plan reuses existing Prisma client, NestJS services (voucher creation/posting, auth), and report API endpoints. Phase 2F Issue F (demo data) is resolved by Phase 2H.
