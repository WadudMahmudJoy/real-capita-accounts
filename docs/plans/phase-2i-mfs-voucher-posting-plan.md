# Phase 2I: MFS Voucher Posting Implementation Plan

## Purpose

Phase 2I plans the MFS voucher posting continuation implementation chunks based on the Phase 2I requirement lock. This document splits the implementation into safe, reviewable chunks so each step can be verified before the next begins.

This is a planning document only. It does not change schema, API, frontend, roles, seed data, or or any runtime behavior.

## Prerequisite

Phase 2I requirement lock is complete and accepted. The following docs define what Phase 2I must implement:

- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md`
- `docs/acceptance/phase-2i-acceptance-criteria.md`

Phase 2I must not add anything beyond what is locked in those documents.

## Confirmed Constraints

- Only `ACCOUNTANT` role exists. No additional roles.
- No dashboard analytics, no payroll, no parties/customers/vendors.
- No file uploads, no business seed data changes during requirement lock.
- No report tables as primary source; all reports derive from posted VoucherLine records.
- No PDF or Excel export. Browser print foundation continues.
- No MFS provider API integration.
- No auto-calculated service charges.
- MFS is a separate account type (CASH, BANK, MFS), not a sub-type of BANK or CASH.
- Cash Book remains CASH-only. Bank Book remains BANK-only. MFS Book remains MFS-only.
- JOURNAL vouchers must reject MFS `cashBankAccountId` in Phase 2I.
- PAYMENT, RECEIPT, and CONTRA must accept MFS `cashBankAccountId`.
- No Prisma schema changes or migrations. The schema already supports MFS from Phase 2E.
- Posted voucher immutability preserved.
- Demo verify must be updated for MFS posting capability.

---

## Chunk Overview

| Chunk | Objective | Risk Level | Recommended Model | Fallback Model |
| --- | --- | --- | --- | --- |
| 2I-1 | Requirement lock and acceptance docs | Low | GLM 5.1 High | Kimi K2.6 (docs-only) |
| 2I-2 | Backend: remove MFS posting block, extend validation, add JOURNAL MFS rejection | Medium-High | DeepSeek V4 Pro Max | GPT-5.5 Thinking x |
| 2I-3 | Frontend: voucher UI MFS account selection, clear labels, JOURNAL MFS prevention | Medium | DeepSeek V4 Pro High/Low | Opus 4.8 (if UI flow confusing) |
| 2I-4 | Report regression, demo dataset extension decision | Medium | DeepSeek V4 Pro Max | GLM 5.1 High |
| 2I-5 | Browser/API smoke, docs cleanup, Phase 2I completion tag | Low | GLM 5.1 High | Kimi K2.6 (docs-only) |

---

## Chunk 2I-1: Requirement Lock and Acceptance Docs

### Objective

Create Phase 2I requirement lock, acceptance criteria, and implementation plan. Update AGENTS.md, README.md, START_HERE.md, CURRENT_STATE.md, handoff.md. No runtime source changes.

### Scope

Documentation only. No runtime code, schema changes, migrations, API endpoints, frontend pages, demo data changes.

### Files to Read Before Implementation

- `AGENTS.md`
- `README.md`
- `docs/ai/START_HERE.md`
- `docs/ai/CURRENT_STATE.md`
- `docs/handoff.md`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md`
- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md`
- `docs/acceptance/phase-2e-acceptance-criteria.md`
- `docs/acceptance/phase-2h-acceptance-criteria.md`
- `docs/plans/phase-2h-demo-data-cleanup-plan.md`
- `prisma/schema.prisma`
- `apps/api/src/voucher/voucher.service.ts`
- `apps/api/src/report/report.service.ts`
- `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx`
- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx`

### Files Created

- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md` -- new file
- `docs/acceptance/phase-2i-acceptance-criteria.md` -- new file
- `docs/plans/phase-2i-mfs-voucher-posting-plan.md` -- new file

### Files Updated

- `AGENTS.md`
- `README.md`
- `docs/ai/START_HERE.md`
- `docs/ai/CURRENT_STATE.md`
- `docs/handoff.md`

### In-Scope

- Requirement lock covering MFS posting scope, voucher type decisions, validation rules, reporting requirements, UI requirements, demo dataset decision, security/out-of-scope, implementation chunks, open questions.
- Acceptance criteria for requirement lock, future backend, frontend, regression, final review.
- Implementation plan with 5 chunks (2I-1 through 2I-5).
- Doc updates to reflect Phase 2I requirement lock.

### Out-of-Scope

- Runtime source code changes.
- Schema/migration changes.
- Demo data changes.
- Removing MFS posting block.
- New API endpoints.
- New frontend pages.

### Safety Checks

- `git status --short --branch` must be clean before starting.
- HEAD must be `96fb653` or later explicitly accepted commit.
- `phase-2h-complete` tag must exist.
- `phase-2e-complete` tag must exist.
- Remote must be `https://github.com/MaruflRana/real-capita-accounts.git`.
- `prisma/schema.prisma` must be unchanged by this chunk.
- MFS posting block in `voucher.service.ts` must remain intact.

### Acceptance Checks

- Three new docs exist with full coverage per requirement lock, acceptance criteria, and plan specifications.
- AGENTS.md, README.md, START_HERE.md, CURRENT_STATE.md, handoff.md updated.
- Schema unchanged.
- MFS posting block unchanged.
- `pnpm check:all` and `pnpm doctor` pass.

### Verification Commands

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
pnpm demo:audit
pnpm demo:verify
git status --short --branch
git log --oneline --max-count=10
```

### Recommended Model

GLM 5.1 High for documentation lock, consistency checking, scope verification.

### Stop Condition

All three docs created and five docs updated. Verification passes. Schema unchanged. MFS posting block unchanged. Commit with `docs: lock phase 2i mfs voucher posting requirements`. Push to origin/main. Do not tag.

---

## Chunk 2I-2: Backend MFS Posting Validation and JOURNAL MFS Rejection

### Objective

Remove the MFS posting block in `voucher.service.ts` and replace it with proper acceptance for PAYMENT/RECEIPT/CONTRA MFS lines, plus explicit rejection for JOURNAL MFS lines.

### Scope

Backend voucher service validation only. No frontend, no report, no schema changes.

### Files to Read Before Implementation

- `apps/api/src/voucher/voucher.service.ts` -- understand current posting validation and MFS block.
- `apps/api/src/voucher/voucher.controller.ts` -- understand posting endpoint.
- `apps/api/src/voucher/dto/voucher-line.dto.ts` -- understand line DTO.
- `prisma/schema.prisma` -- confirm MFS schema is already in place.
- `apps/api/src/report/report.service.ts` -- understand MFS Book report.
- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md` -- understand validation rules.
- `docs/acceptance/phase-2i-acceptance-criteria.md` -- understand acceptance for backend.

### Files Likely to Change

- `apps/api/src/voucher/voucher.service.ts` -- remove MFS block, add JOURNAL MFS rejection, extend voucher type cash/bank rules for MFS.
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs.

### In-Scope

- Remove MFS posting block at line 672.
- Add JOURNAL-specific MFS rejection: `POST /vouchers/:id/post` rejects JOURNAL vouchers that have any line with MFS `cashBankAccountId`.
- Extend `validateVoucherTypeCashBankRules` to treat MFS cash/bank lines the same as CASH/BANK for PAYMENT/RECEIPT/CONTRA.
- Preserve all existing CASH/BANK validation behavior.
- Preserve posted voucher immutability.
- Decimal-safe money handling.

### Out-of-Scope

- Frontend voucher UI changes.
- Report behavior changes.
- Schema/migration changes.
- Demo data changes.
- MFS Book changes.
- New API endpoints.

### Safety Checks

- `git status --short --branch` clean before starting.
- No schema changes.
- Cash Book remains CASH-only (no MFS data leaks in).
- Bank Book remains BANK-only.
- JOURNAL vouchers cannot post with MFS lines.
- PAYMENT, RECEIPT, CONTRA vouchers can post with MFS lines.
- `validatePostingLine` still checks: amount > 0, active ledger, project/cost center rules, `cashBankAccountId` existence, active status, ledger match, `isCashBank` requirement.
- `validateVoucherTypeCashBankRules` still checks: PAYMENT requires cash/bank/MFS credit, RECEIPT requires cash/bank/MFS debit, CONTRA requires exactly 2 cash/bank/MFS lines (1 debit, 1 credit).

### Acceptance Checks

- PAYMENT voucher with MFS credit line posts successfully.
- RECEIPT voucher with MFS debit line posts successfully.
- CONTRA voucher with MFS + CASH or MFS + BANK lines posts successfully.
- JOURNAL voucher with MFS `cashBankAccountId` is rejected with clear error.
- JOURNAL voucher without `cashBankAccountId` posts successfully (unchanged).
- Existing CASH/BANK voucher posting works unchanged.
- Cash Book shows only CASH transactions.
- Bank Book shows only BANK transactions.
- MFS Book shows MFS movement from posted MFS vouchers.
- Trial Balance includes MFS ledger movements.
- `pnpm check:all` and `pnpm doctor` pass.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:api
pnpm build:web
docker compose config
pnpm check:all
pnpm doctor
```

### Recommended Model

DeepSeek V4 Pro Max for backend implementation.

### Stop Condition

MFS posting block removed. JOURNAL MFS rejection added. PAYMENT/RECEIPT/CONTRA MFS acceptance verified. Cash Book CASH-only. Bank Book BANK-only. MFS Book shows MFS movement. JOURNAL rejects MFS. Verification passes.

---

## Chunk 2I-3: Frontend Voucher UI MFS Account Selection and JOURNAL MFS Prevention

### Objective

Update the voucher line UI to support MFS account selection for PAYMENT/RECEIPT/CONTRA voucher lines, show MFS metadata, and prevent MFS selection on JOURNAL lines.

### Scope

Frontend voucher UI only. No backend, no report, no schema changes.

### Files to Read Before Implementation

- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx` -- understand current voucher form.
- `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx` -- understand current field requirements helpers.
- `apps/web/src/app/app/vouchers/_lib/VoucherDetail.tsx` or equivalent -- understand posted voucher detail view.
- `apps/web/src/lib/api.ts` -- understand API types.
- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md` -- understand UI requirements.
- `docs/acceptance/phase-2i-acceptance-criteria.md` -- understand acceptance for frontend.

### Files Likely to Change

- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx` -- MFS account selection, JOURNAL MFS prevention.
- `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx` -- MFS metadata display, JOURNAL MFS rule.
- `apps/web/src/app/app/vouchers/_lib/VoucherDetail.tsx` or equivalent -- MFS metadata in posted view.
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs.

### In-Scope

- Voucher line Cash/Bank/MFS dropdown includes MFS accounts when the selected ledger `isCashBank = true` for PAYMENT/RECEIPT/CONTRA.
- JOURNAL voucher type hides or disables the Cash/Bank/MFS dropdown on all lines.
- MFS accounts show provider and wallet metadata in the dropdown label (e.g., "bKash Merchant - 017XXXXXXXXX (MFS)").
- Posted voucher detail view shows MFS metadata (provider, wallet number).
- Existing dynamic field visibility from Phase 2F preserved.
- MFS-specific field labels ("MFS wallet") when the linked accounts are all MFS type.

### Out-of-Scope

- Backend changes.
- Report UI changes.
- Schema/migration changes.
- New voucher templates.
- MFS provider API integration.
- Auto-calculated service charges.
- Demo data changes.

### Safety Checks

- `git status --short --branch` clean before starting.
- No backend changes in this chunk.
- JOURNAL lines cannot not select MFS accounts client-side (backend also rejects).
- Posted vouchers remain read-only.
- No localStorage token usage.
- `deriveVoucherLineFieldRequirements` helper preserved or extended.

### Acceptance Checks

- PAYMENT voucher line with MFS ledger shows MFS accounts in dropdown.
- RECEIPT voucher line with MFS ledger shows MFS accounts in dropdown.
- CONTRA voucher line with MFS ledger shows MFS accounts in dropdown.
- JOURNAL voucher line does not show Cash/Bank/MFS dropdown.
- MFS account dropdown labels show provider/wallet metadata.
- Posted voucher detail shows MFS metadata.
- Existing CASH/BANK dropdown behavior unchanged.
- `pnpm check:all` and `pnpm doctor` pass.

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

### Recommended Model

DeepSeek V4 Pro High/Low for frontend follow-up, bounded scope.

### Stop Condition

MFS account selection works in PAYMENT/RECEIPT/CONTRA. JOURNAL hides Cash/Bank/MFS dropdown. MFS metadata displays in detail view. Verification passes.

---

## Chunk 2I-4: MFS Report Regression and and Deterministic Demo Extension Decision

### Objective

Verify all reports remain correct after MFS posting is enabled. Decide whether to extend the deterministic demo dataset with MFS voucher scenarios. Update `demo-verify` if needed.

### Scope

Report regression testing and demo dataset decision only. No schema, no new pages, no new endpoints.

### Files to Read Before Implementation

- `apps/api/src/report/report.service.ts` -- understand all report methods.
- `prisma/demo-verify.ts` -- understand current MFS assertion.
- `prisma/demo-audit.ts` -- understand current audit checks.
- `prisma/demo-reset.ts` -- understand current reset behavior.
- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md` -- understand demo dataset decision.
- `docs/acceptance/phase-2i-acceptance-criteria.md` -- understand regression criteria.

### Files Likely to Change

- `prisma/demo-verify.ts` -- update MFS assertion (from "No MFS posted voucher lines" to conditional check based on whether MFS demo scenario exists).
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs.
- Optionally: `prisma/demo-reset.ts` and `prisma/demo-audit.ts` -- if MFS demo scenario is added.

### In-Scope

- Verify Cash Book remains CASH-only after MFS posting.
- Verify Bank Book remains BANK-only after MFS posting.
- Verify MFS Book shows MFS movement from posted MFS vouchers.
- Verify Trial Balance includes MFS ledger movements.
- Verify Balance Sheet includes MFS wallet balance.
- Verify Project reports exclude MFS lines without `projectId`.
- Verify Cost Center Summary does not create false Unassigned rows from MFS lines.
- Decide whether to extend deterministic demo dataset with MFS vouchers.
- Update `demo-verify` to reflect the MFS posting capability.

### Out-of-Scope

- PDF/Excel export.
- Dashboard analytics.
- Schema/migration changes.
- New report endpoints.
- New frontend pages.
- Party/customer module.

### Safety Checks

- `git status --short --branch` clean before starting.
- No schema changes.
- Cash Book CASH-only verified.
- Bank Book BANK-only verified.
- Trial Balance balanced.
- Balance Sheet correct.
- Project reports do not double-count MFS.

### Acceptance Checks

- All 11 report endpoints return correct results after MFS posting.
- MFS Book shows movement from posted MFS vouchers.
- Cash/Bank Books unchanged.
- Trial Balance balanced with MFS movements.
- Project reports exclude MFS lines without `projectId`.
- `demo-verify` updated for MFS capability.
- `pnpm check:all` and `pnpm doctor` pass.

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
pnpm demo:audit
pnpm demo:verify
```

### Recommended Model

DeepSeek V4 Pro Max for regression testing and and demo dataset adjustment.

### Stop Condition

All reports produce correct results. MFS Book shows MFS movement. Cash/Bank Books unchanged. Project reports correct. Demo verify updated. Verification passes.

---

## Chunk 2I-5: Browser/API Smoke, Docs Cleanup, and Phase 2I Completion Tag

### Objective

Final integration review, browser smoke tests, documentation cleanup, and Phase 2I completion tag.

### Scope

Review only. No runtime source, schema, migration, or report logic changes. Documentation updates only.

### Files to Read Before Implementation

- `AGENTS.md`
- `README.md`
- `docs/ai/START_HERE.md`
- `docs/ai/CURRENT_STATE.md`
- `docs/handoff.md`
- `apps/api/src/voucher/voucher.service.ts`
- `apps/api/src/report/report.service.ts`
- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx`
- `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx`

### Files Likely to Change

- `AGENTS.md`
- `README.md`
- `docs/ai/START_HERE.md`
- `docs/ai/CURRENT_STATE.md`
- `docs/handoff.md`

### In-Scope

- Full integration review across all Phase 2I chunks.
- Verify scope boundaries.
- Verify MFS Book shows MFS movement from posted vouchers.
- Verify Cash Book CASH-only.
- Verify Bank Book BANK-only.
- Verify JOURNAL rejects MFS.
- Verify PAYMENT/RECEIPT/CONTRA accept MFS.
- Browser smoke tests for voucher MFS selection and and MFS Book.
- Documentation cleanup.
- Phase 2I completion tag.

### Out-of-Scope

- Runtime source changes.
- Schema/migration changes.
- New features.
- Demo data changes ( unless 2I-4 decided to add MFS scenario).

### Safety Checks

- `git status --short --branch` clean before starting.
- All Phase 2I tags present.
- Schema unchanged vs Phase 2E.
- No report tables added.
- Only ACCOUNTANT role.
- No MFS provider API integration.
- No secrets committed.

### Acceptance Checks

- All 2I-1 through 2I-4 acceptance criteria pass.
- `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor` all pass.
- `pnpm demo:audit` and `pnpm demo:verify` pass.
- Docs reflect Phase 2I completion.

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
pnpm demo:audit
pnpm demo:verify
```

### Recommended Model

GLM 5.1 High for review/acceptance.

### Stop Condition

Phase 2I accepted. Completion tag `phase-2i-complete` created. Docs updated. All verification passes.

---

## Strict Stop Conditions for Phase 2I

Stop before any implementation chunk if:

- User has not confirmed the Phase 2I implementation phase.
- Working tree is not clean.
- Git remote is not `https://github.com/MaruflRana/real-capita-accounts`.
- `DATABASE_URL` does not use port `55432`.
- Any unconfirmed role exists in schema, seed data, source, or database.
- Phase 2H is not complete and and accepted.
- Phase 2E schema is not in place (`CashBankAccountType.MFS` missing from Prisma schema).
- MFS posting block has been removed before requirement lock is accepted.
- Cash Book or Bank Book shows MFS data after any chunk.
- JOURNAL vouchers accept MFS `cashBankAccountId` in Phase 2I.
- MFS provider API integration is added.
- Posted voucher immutability is broken.
