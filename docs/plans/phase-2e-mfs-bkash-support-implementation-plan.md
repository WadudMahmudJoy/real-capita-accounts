# Phase 2E: MFS / bKash Support Implementation Plan

## Purpose

Phase 2E plans the MFS / bKash transaction support implementation chunks based on the Phase 2E requirement lock. This document splits the implementation into safe, reviewable chunks so each step can be verified before the next begins.

This is a planning document only. It does not change schema, API, frontend, roles, seed data, or any runtime behavior.

## Prerequisite

Phase 2E MFS requirement lock is complete and accepted. The following docs define what Phase 2E must implement:

- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`
- `docs/acceptance/phase-2e-acceptance-criteria.md`

Phase 2E must not add anything beyond what is locked in those documents.

## Confirmed Constraints

- Only `ACCOUNTANT` role exists. No additional roles.
- No dashboard analytics, no payroll, no parties/customers/vendors.
- No file uploads, no business seed data, no approval workflow.
- No MFS report tables as primary source; MFS Book derives from posted VoucherLine records.
- No PDF or Excel export in the first implementation. Browser print foundation is included.
- No MFS provider API integration (bKash API, Nagad API, etc.).
- No auto-calculated service charges.
- MFS is a separate account type (CASH, BANK, MFS), not a sub-type of BANK or CASH.
- Cash Book remains CASH-only. Bank Book remains BANK-only.
- Open questions in the requirement lock must be resolved or deferred before implementation.

---

## Chunk Overview

| Chunk | Objective | Risk Level | Recommended Model | Fallback Model |
| --- | --- | --- | --- | --- |
| 2E-1 | MFS requirement lock review | Low | GLM 5.1 High | Kimi K2.6 (docs-only) |
| 2E-2 | Backend schema/model proposal implementation | Medium | GPT-5.5 Thinking xhigh / Codex | DeepSeek V4 Pro Max |
| 2E-3 | Backend validation/API changes (MFS accounts, voucher posting, MFS Book report) | Medium-High | GPT-5.5 Thinking xhigh / Codex | DeepSeek V4 Pro Max |
| 2E-4 | Frontend MFS account setup UI | Medium | Claude Code Opus 4.8 High | DeepSeek V4 Pro Max |
| 2E-5 | MFS Book report API | Medium | GPT-5.5 Thinking xhigh / Codex | DeepSeek V4 Pro Max |
| 2E-6 | MFS Book frontend and print foundation | Medium | Claude Code Opus 4.8 High | DeepSeek V4 Pro Max |
| 2E-7 | Final integration and acceptance review | Low | GLM 5.1 High | Kimi K2.6 (docs-only) |

---

## Chunk 2E-1: MFS Requirement Lock Review

### Objective

Review the Phase 2E documentation for consistency with the Phase 2D posted voucher workflow, Phase 2C voucher engine, and Phase 2A accounting foundation. Confirm the requirement lock is accurate and complete before implementation begins.

### Model Recommendation

GLM 5.1 High for documentation review, consistency checking, and scope verification.

### Fallback Model

Kimi K2.6 for docs-only, strict scope review. Do not use Codex/Claude for this docs-only review chunk unless explicitly instructed.

### Scope

- Review `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md` for completeness and consistency.
- Review `docs/architecture/phase-2e-mfs-accounting-model-proposal.md` for model accuracy and consistency with existing schema.
- Review `docs/acceptance/phase-2e-acceptance-criteria.md` for coverage and correctness.
- Review this implementation plan for chunk ordering, scope boundaries, and stop conditions.
- Confirm MFS is not mixed into existing Cash Book or Bank Book.
- Confirm Phase 2D acceptance state is preserved.
- Fix any inconsistencies or stale references in the Phase 2E docs or existing project docs.

### Files to Read

- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`
- `docs/acceptance/phase-2e-acceptance-criteria.md`
- `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md`
- `docs/requirements/phase-2d-accounting-reports-requirement-lock.md`
- `docs/architecture/phase-2d-report-query-model-proposal.md`
- `docs/acceptance/phase-2d-acceptance-criteria.md`
- `prisma/schema.prisma`
- `apps/api/src/report/report.service.ts`
- `apps/api/src/voucher/voucher.service.ts`
- `apps/web/src/app/app/layout.tsx`

### Verification

```powershell
pnpm check:all
pnpm doctor
git status --short --branch
```

### Manual Smoke Tests

- No runtime smoke tests needed for a documentation review chunk.
- Verify existing Phase 2C/2D voucher and report workflows still work (draft create, post, read-only view, report pages).

### Exact Stop Condition

Stop after review and any doc fixes. Do not start 2E-2 unless the user explicitly confirms implementation. Stop immediately if:
- Any Phase 2E doc contradicts the Phase 2C posted voucher workflow or Phase 2D report model.
- `pnpm check:all` fails.
- Working tree is not clean before starting.
- User has not confirmed Phase 2E implementation.
- MFS is mixed into Cash Book or Bank Book in the requirement docs.
- Phase 2D acceptance state is not preserved.

---

## Chunk 2E-2: Backend Schema / Model Proposal Implementation

### Objective

Implement the Prisma schema changes for MFS support: add `MFS` to `CashBankAccountType` enum, add `MfsProvider` enum, and add MFS-specific fields to `CashBankAccount` model. Create and apply the migration.

### Model Recommendation

GPT-5.5 Thinking xhigh / Codex for precise Prisma schema and migration handling.

### Fallback Model

DeepSeek V4 Pro Max with strict prompt referencing Phase 2E lock docs.

### Scope

- Extend `CashBankAccountType` enum: add `MFS` value.
- Add `MfsProvider` enum: `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, `OTHER`.
- Extend `CashBankAccount` model: add `provider` (optional MfsProvider), `providerOtherName` (optional String), `walletNumber` (optional String), `accountHolderName` (optional String).
- Create and apply Prisma migration.
- Verify existing CASH and BANK account data is not affected.
- No API endpoint changes in this chunk.
- No frontend changes in this chunk.

### Files to Read

- `prisma/schema.prisma`
- `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `apps/api/src/cash-bank/dto/create-cash-bank-account.dto.ts`
- `apps/api/src/cash-bank/dto/update-cash-bank-account.dto.ts`
- `apps/api/src/cash-bank/cash-bank.service.ts`

### Verification

```powershell
pnpm prisma:generate
pnpm prisma:migrate
pnpm typecheck
pnpm lint
pnpm build:api
pnpm build:web
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- Verify existing CASH and BANK accounts still work (list, create, edit, deactivate).
- Verify the migration applied cleanly with no data loss.
- Verify `CashBankAccountType` has `CASH`, `BANK`, and `MFS` values.
- Verify `MfsProvider` has `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, `OTHER` values.
- Verify new `CashBankAccount` columns are nullable and existing rows have null values for MFS fields.
- Verify existing reports (all six) still return correct results.

### Exact Stop Condition

Stop after schema and migration are verified. Do not add API endpoints or frontend changes. Stop immediately if:
- Existing CASH or BANK account data is corrupted.
- Any existing report returns different results after the migration.
- `pnpm prisma:migrate` fails.
- `pnpm typecheck` or `pnpm lint` fails.
- Existing CashBankAccountType values CASH or BANK are removed or altered.

---

## Chunk 2E-3: Backend Validation / API Changes

### Objective

Extend the backend cash/bank account service to support MFS account creation and management. Extend voucher posting validation to include MFS account type rules. Add the MFS Book report endpoint.

### Model Recommendation

GPT-5.5 Thinking xhigh / Codex for voucher validation precision and report service extension.

### Fallback Model

DeepSeek V4 Pro Max.

### Scope

- Update `CreateCashBankAccountDto` and `UpdateCashBankAccountDto` to accept `accountType = MFS` and MFS-specific fields (`provider`, `providerOtherName`, `walletNumber`, `accountHolderName`).
- Update `CashBankService` to validate MFS account creation: provider required when accountType = MFS, walletNumber required when accountType = MFS, providerOtherName required when provider = OTHER.
- Update voucher posting validation in `VoucherService` to include MFS in cash/bank account type checks.
- Add `GET /reports/mfs-book` endpoint in the report module, following the same pattern as `GET /reports/cash-book` and `GET /reports/bank-book`.
- Extend the shared `CashBankBookReport` service to support `accountType = MFS`.
- Update report query DTO to support MFS Book filters.
- No frontend changes in this chunk.

### Files to Read

- `apps/api/src/cash-bank/dto/create-cash-bank-account.dto.ts`
- `apps/api/src/cash-bank/dto/update-cash-bank-account.dto.ts`
- `apps/api/src/cash-bank/cash-bank.service.ts`
- `apps/api/src/voucher/voucher.service.ts`
- `apps/api/src/report/report.service.ts`
- `apps/api/src/report/report.controller.ts`
- `apps/api/src/report/dto/report-query.dto.ts`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`

### Verification

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:api
pnpm build:web
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- Create an MFS account with `accountType = MFS`, `provider = BKASH`, and a wallet number.
- Verify the MFS account appears in the cash/bank account list.
- Create a voucher with an MFS account reference; post it; verify posting succeeds.
- Verify `GET /reports/mfs-book` returns the posted MFS transaction with correct amounts and running balance.
- Verify `GET /reports/cash-book` does NOT include MFS transactions.
- Verify `GET /reports/bank-book` does NOT include MFS transactions.
- Verify existing voucher posting with CASH and BANK accounts still works.
- Verify `GET /reports/mfs-book` returns 401 for unauthenticated requests.
- Verify `GET /reports/mfs-book` returns 403 for non-ACCOUNTANT users.

### Exact Stop Condition

Stop after backend API is verified. Do not add frontend pages. Stop immediately if:
- Cash Book or Bank Book shows MFS transactions.
- MFS Book shows CASH or BANK transactions.
- Voucher posting validation rejects valid MFS account references.
- Existing voucher posting with CASH/BANK accounts fails.
- Any existing report endpoint returns different results for the same posted voucher data.
- `pnpm typecheck` or `pnpm lint` fails.
- ACCOUNTANT guard is not applied to MFS Book endpoint.

---

## Chunk 2E-4: Frontend MFS Account Setup UI

### Objective

Extend the frontend Cash & Bank page to support MFS account creation, editing, and deactivation. Extend the voucher line editor to offer MFS accounts in the cash/bank dropdown.

### Model Recommendation

Claude Code Opus 4.8 High for frontend UI quality.

### Fallback Model

DeepSeek V4 Pro Max.

### Scope

- Extend the Cash & Bank page to include MFS accounts in the account type dropdown (CASH, BANK, MFS).
- Add MFS-specific fields to the account form: provider dropdown, custom provider name input (when provider = OTHER), wallet number input, optional account holder name input.
- Show MFS-specific fields only when `accountType = MFS` is selected. Hide `bankName`, `branch`, `accountNumber` for MFS accounts.
- Extend `apps/web/src/lib/api.ts` with MFS-related types (MfsProvider enum, extended CashBankAccount type with MFS fields).
- Extend the voucher line editor in `VoucherForm` to offer MFS accounts alongside CASH and BANK in the cash/bank account dropdown.
- No MFS Book report page in this chunk (Chunk 2E-6).
- No MFS provider dropdown in the sidebar (MFS accounts are managed through the existing Cash & Bank page).

### Files to Read

- `apps/web/src/app/app/cash-bank/page.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx`
- `apps/web/src/app/app/vouchers/_lib/useVoucherReference.ts`
- `apps/web/src/app/app/reports/_lib/useReportReferences.ts`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`

### Verification

```powershell
pnpm typecheck
pnpm lint
pnpm build:web
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- Create an MFS account (bKash, wallet number, display name) from the Cash & Bank page.
- Edit and deactivate an MFS account.
- Create a voucher with an MFS account line; verify the MFS account appears in the dropdown.
- Verify CASH and BANK account creation still works unchanged.
- Verify existing voucher lines with CASH and BANK accounts still work unchanged.
- Verify the Cash & Bank list shows MFS accounts alongside CASH and BANK accounts.

### Exact Stop Condition

Stop after frontend MFS account setup is verified. Do not add MFS Book report page. Stop immediately if:
- CASH or BANK account creation/editing is broken.
- MFS account creation fails or does not persist.
- Voucher line editor does not offer MFS accounts.
- `pnpm typecheck` or `pnpm lint` fails.
- `pnpm build:web` fails.

---

## Chunk 2E-5: MFS Book Report API

### Objective

This chunk may be merged with Chunk 2E-3 if the MFS Book endpoint is already implemented there. If kept separate, implement the MFS Book report endpoint with full query validation and report computation.

### Model Recommendation

GPT-5.5 Thinking xhigh / Codex for report query precision.

### Fallback Model

DeepSeek V4 Pro Max.

### Scope

- Add `GET /reports/mfs-book` endpoint (if not already in 2E-3).
- Extend the shared report service to compute MFS Book from posted MFS-type voucher lines.
- MFS Book behavior: same as Cash Book/Bank Book but filtered by `accountType = MFS`.
- Opening/period/closing balance computation.
- Running balance computation (debit minus credit).
- Optional filter by specific MFS account, provider, fiscal year, accounting period, date range, project, cost center.
- Report API response includes MFS account summaries, provider info, wallet number (subject to privacy settings).

### Files to Read

- `apps/api/src/report/report.service.ts`
- `apps/api/src/report/report.controller.ts`
- `apps/api/src/report/dto/report-query.dto.ts`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`

### Verification

```powershell
pnpm typecheck
pnpm lint
pnpm build:api
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- `GET /reports/mfs-book?fiscalYearId=Y` returns valid MFS Book structure.
- `GET /reports/mfs-book?cashBankAccountId=X` (MFS type) returns filtered MFS transactions.
- Verify MFS Book does not include CASH or BANK transactions.
- Verify MFS Book opening balance, period movement, closing balance, and running balance are correct.
- Verify existing report endpoints (`cash-book`, `bank-book`, `ledger`, `trial-balance`, `income-statement`, `balance-sheet`) return identical results for the same posted voucher data.

### Exact Stop Condition

Stop after MFS Book API is verified. Do not add frontend page. Stop immediately if:
- MFS Book includes CASH or BANK transactions.
- Cash Book or Bank Book includes MFS transactions.
- MFS Book running balance is incorrect.
- Any existing report endpoint returns different results.
- `pnpm typecheck` or `pnpm lint` fails.

---

## Chunk 2E-6: MFS Book Frontend and Print Foundation

### Objective

Add the MFS Book frontend report page with browser print foundation. Add MFS Book navigation link.

### Model Recommendation

Claude Code Opus 4.8 High for frontend UI quality and print layout consistency.

### Fallback Model

DeepSeek V4 Pro Max.

### Scope

- Add `/app/reports/mfs-book` route and page.
- MFS Book page: fiscal year selector, optional accounting period/date range, optional MFS account filter (MFS-type only), optional provider filter, optional project/cost center filter.
- MFS Book page renders: opening/period/closing balance, transaction table (voucher number, date, narration, receipt, payment, running balance, provider, wallet number if visible), totals.
- Add MFS Book navigation link in the app layout sidebar under "Reports".
- Add browser print foundation for MFS Book following Phase 2D pattern: Real Capita Group heading, "MFS Book / Mobile Wallet Book" title, date range, MFS account info, transaction table, totals, generation timestamp, signature placeholders.
- Extend `apps/web/src/lib/api.ts` with MFS Book types and helper.
- Extend `apps/web/src/app/app/reports/_lib/useReportReferences.ts` to load MFS accounts for the filter dropdown.
- No PDF/Excel export.
- No MFS provider API integration.

### Files to Read

- `apps/web/src/app/app/reports/cash-book/page.tsx` (pattern reference)
- `apps/web/src/app/app/reports/_lib/CashBankBookReport.tsx` (pattern reference)
- `apps/web/src/app/app/reports/_lib/report-ui.tsx`
- `apps/web/src/app/app/reports/_lib/report-print.tsx`
- `apps/web/src/app/app/reports/_lib/useReportReferences.ts`
- `apps/web/src/app/app/layout.tsx`
- `apps/web/src/lib/api.ts`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`

### Verification

```powershell
pnpm typecheck
pnpm lint
pnpm build:web
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- Navigate to MFS Book from the sidebar Reports section.
- Select a fiscal year; verify MFS Book renders with posted MFS transactions.
- Filter by a specific MFS account; verify filtered results.
- Verify MFS Book does not show CASH or BANK transactions.
- Verify Cash Book and Bank Book still work unchanged.
- Click "Print report" on MFS Book; verify print layout renders correctly.
- Verify all other report pages still work unchanged.

### Exact Stop Condition

Stop after MFS Book frontend and print foundation are verified. Do not add PDF/Excel export or MFS provider API integration. Stop immediately if:
- MFS Book page shows CASH or BANK transactions.
- Cash Book or Bank Book pages are broken or show MFS transactions.
- Print layout for MFS Book is missing or unusable.
- Any existing report page is broken.
- `pnpm typecheck` or `pnpm lint` fails.
- `pnpm build:web` fails.

---

## Chunk 2E-7: Final Integration and Acceptance Review

### Objective

Run full integration smoke tests across all MFS endpoints, frontend pages, and report behavior. Verify regression against Phase 2D and Phase 2C acceptance criteria. Update documentation. Confirm Phase 2E acceptance.

### Model Recommendation

GLM 5.1 High for documentation and integration review.

### Fallback Model

Kimi K2.6 for docs-only review. Do not use Codex/Claude for this review chunk unless explicitly instructed.

### Scope

- Full integration review across all prior Phase 2E chunks: schema, backend API, frontend UI, MFS Book report, and print foundation.
- Verify scope boundaries: only MFS account setup, MFS voucher line support, MFS Book report, and MFS Book print foundation were implemented. No Project Summary, Cost Center Summary, PDF/Excel export, MFS API integration, party module, dashboard, payroll, additional roles, or business seed data were added.
- Verify all MFS endpoints are guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- Verify all MFS reports derive only from `Voucher.status = POSTED` and `Voucher.isDeleted = false`.
- Verify Cash Book remains CASH-only; Bank Book remains BANK-only; MFS Book is MFS-only.
- Verify all existing Phase 2D reports return correct results unchanged.
- Verify all existing Phase 2C voucher workflows work unchanged.
- Manual API and browser smoke tests.
- Update documentation: `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md`, `AGENTS.md`.

### Files to Read

- All Phase 2E docs (requirement lock, model proposal, acceptance criteria, implementation plan).
- All Phase 2D docs (requirement lock, model proposal, acceptance criteria).
- All Phase 2C docs (requirement lock, model proposal, acceptance criteria).
- `prisma/schema.prisma`
- `apps/api/src/report/report.service.ts`
- `apps/api/src/voucher/voucher.service.ts`
- `apps/api/src/cash-bank/cash-bank.service.ts`
- `apps/web/src/app/app/layout.tsx`
- `apps/web/src/app/app/reports/mfs-book/page.tsx`
- `apps/web/src/app/app/cash-bank/page.tsx`

### Verification

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
docker compose config
pnpm check:all
pnpm doctor
git status --short --branch
git log --oneline --max-count=10
```

### Manual Smoke Tests

All smoke tests from Phase 2E acceptance criteria:
1. Log in as accountant.
2. Create an MFS account (bKash, wallet number, display name).
3. Create a balanced Payment Voucher with one debit (expense) line and one credit (MFS wallet) line.
4. Post the voucher.
5. Navigate to MFS Book; verify the posted transaction appears with correct amounts and running balance.
6. Navigate to Cash Book; verify no MFS transactions appear.
7. Navigate to Bank Book; verify no MFS transactions appear.
8. Navigate to Trial Balance; verify MFS wallet and expense account appear with correct totals.
9. Navigate to Income Statement; verify the expense appears under Expenses.
10. Navigate to Balance Sheet; verify the MFS wallet appears under Assets.
11. Create an unbalanced draft voucher with MFS reference; verify it does not appear in any report.
12. Soft-delete a draft voucher; verify it does not appear in any report.
13. Attempt to view MFS Book without logging in; verify redirect to `/login`.
14. Verify MFS Book print layout renders correctly.
15. Verify existing Cash Book, Bank Book, Ledger, Trial Balance, Income Statement, and Balance Sheet report pages work unchanged.
16. Verify existing voucher create, post, and print workflow works unchanged.

### Exact Stop Condition

Stop after integration review and documentation update. Do not start any new phase. Stop immediately if:
- Any acceptance criterion is not met.
- `pnpm check:all` or `pnpm doctor` fails.
- Working tree is not clean at the end.
- Cash Book or Bank Book shows MFS transactions.
- MFS Book shows CASH or BANK transactions.
- Any existing report returns different results for the same posted voucher data.
- Any existing voucher workflow is broken.
- MFS is forced under CASH or BANK without explicit Real Capita approval.

---

## Phase 2E Overall Stop Conditions

Stop the entire Phase 2E before starting any chunk if:

- User has not explicitly confirmed Phase 2E implementation.
- Working tree is not clean.
- Git remote is not `https://github.com/MaruflRana/real-capita-accounts`.
- `DATABASE_URL` does not use port `55432`.
- Any unconfirmed role exists in schema, seed data, source, or database.
- Phase 2D is not complete and accepted.
- Phase 2E requirement lock is not reviewed and accepted.
- The agent is not inside `D:\real-capita-accounts`.
- Open questions in the requirement lock have not been resolved or deferred.

---

## Plan Status

This plan is locked for discussion and next-agent orientation only. It becomes implementation scope only after the user explicitly confirms Phase 2E implementation and the open questions are resolved or deferred.
