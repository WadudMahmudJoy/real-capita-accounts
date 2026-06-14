# Phase 2D: Accounting Reports Implementation Plan

## Purpose

Phase 2D plans the accounting report implementation chunks based on the Phase 2D requirement lock. This document splits the report implementation into safe, reviewable chunks so each step can be verified before the next begins.

This is a planning document only. It does not change schema, API, frontend, roles, seed data, or any runtime behavior.

## Prerequisite

Phase 2D report requirement lock is complete and accepted. The following docs define what Phase 2D must implement:

- `docs/requirements/phase-2d-accounting-reports-requirement-lock.md`
- `docs/architecture/phase-2d-report-query-model-proposal.md`
- `docs/acceptance/phase-2d-acceptance-criteria.md`

Phase 2D must not add anything beyond what is locked in those documents.

## Confirmed Constraints

- Only `ACCOUNTANT` role exists. No additional roles.
- No dashboard analytics, no payroll, no parties/customers/vendors.
- No file uploads, no business seed data, no approval workflow.
- No report tables as primary source; all reports derive from posted VoucherLine records.
- No PDF or Excel export in the first implementation (browser print only).

---

## Chunk Overview

| Chunk | Objective | Risk Level | Recommended Model | Fallback Model |
| --- | --- | --- | --- | --- |
| 2D-1 | Report requirement lock review | Low | GLM 5.1 High | DeepSeek V4 Pro Max |
| 2D-2 | Backend ledger/cash-book/bank-book API | Medium | GPT-5.5 Thinking xhigh / Codex | DeepSeek V4 Pro Max |
| 2D-3 | Backend trial balance API | Medium | GPT-5.5 Thinking xhigh / Codex | DeepSeek V4 Pro Max |
| 2D-4 | Backend income statement and balance sheet API | Medium-High | GPT-5.5 Thinking xhigh / Codex | DeepSeek V4 Pro Max |
| 2D-5 | Frontend report pages for ledger, cash book, bank book, trial balance | Medium | Claude Code Opus 4.8 High | DeepSeek V4 Pro Max |
| 2D-6 | Frontend financial statement pages and print foundation | Low-Medium | Claude Code Opus 4.8 High | DeepSeek V4 Pro Max |
| 2D-7 | Final integration and acceptance review | Low | GLM 5.1 High | DeepSeek V4 Pro Max |

---

## Chunk 2D-1: Report Requirement Lock Review

### Objective

Review the Phase 2D documentation for consistency with the Phase 2C posted voucher workflow. Confirm the requirement lock is accurate and complete before implementation begins.

### Files Likely to Change

- None (review only). Possible typo fixes in the Phase 2D docs themselves.

### Strict Out-of-Scope

- No schema changes.
- No API endpoints.
- No frontend pages.
- No code changes beyond doc fixes.

### Verification Commands

```powershell
pnpm check:all
pnpm doctor
git status --short --branch
```

### Manual Smoke Tests

- No runtime smoke tests needed for a documentation review chunk.
- Verify existing Phase 2C voucher workflow still works (draft create, post, read-only view).

### Recommended Model

GLM 5.1 High for documentation review.

### Fallback Model

DeepSeek V4 Pro Max.

### Risk Level

Low. Review only; no code changes.

### Stop Condition

Stop if:
- Any Phase 2D doc contradicts the Phase 2C posted voucher workflow.
- `pnpm check:all` fails.
- Working tree is not clean before starting.
- User has not confirmed Phase 2D implementation.

---

## Chunk 2D-2: Backend Ledger/Cash-Book/Bank-Book Report API

### Objective

Implement NestJS report module with endpoints for the General Ledger, Cash Book, and Bank Book reports. All endpoints guarded by the ACCOUNTANT role.

Endpoints:
- `GET /reports/ledger` -- General Ledger for a specific LedgerAccount with running balance, opening/closing balances.
- `GET /reports/cash-book` -- Cash Book for a cash-type CashBankAccount.
- `GET /reports/bank-book` -- Bank Book for a bank-type CashBankAccount.

### Files Likely to Change

- `apps/api/src/report/` -- new module: report.module.ts, report.controller.ts, report.service.ts, ledger-report.service.ts, cash-bank-book.service.ts, dto/report-query.dto.ts, dto/ledger-report-query.dto.ts, dto/cash-bank-book-query.dto.ts.
- `apps/api/src/app.module.ts` -- register ReportModule.

### Business Logic

- **Ledger report**: Filter posted VoucherLines by `ledgerAccountId`, fiscal year/period/date range. Compute debit movement, credit movement, opening balance, closing balance. Return line-by-line detail with running balance. Normal-balance-aware presentation.
- **Cash Book**: Filter posted VoucherLines where `LedgerAccount.isCashBank = true` and `CashBankAccount.accountType = CASH`. Show receipts (debit) and payments (credit) with running balance.
- **Bank Book**: Filter posted VoucherLines where `LedgerAccount.isCashBank = true` and `CashBankAccount.accountType = BANK`. Show receipts (debit) and payments (credit) with running balance.
- All queries must filter by `Voucher.status = POSTED` and `Voucher.isDeleted = false`.

### Strict Out-of-Scope

- No trial balance endpoint (Chunk 2D-3).
- No financial statement endpoints (Chunk 2D-4).
- No frontend report pages (Chunk 2D-5).
- No report tables in the Prisma schema.
- No PDF/Excel export.

### Verification Commands

```powershell
pnpm typecheck
pnpm lint
pnpm build:api
pnpm build:web
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- Start API. Log in as accountant.
- `GET /reports/ledger?ledgerAccountId=X&fiscalYearId=Y` -- verify ledger lines appear with correct debit/credit amounts and running balance.
- `GET /reports/cash-book?cashBankAccountId=X&fiscalYearId=Y` -- verify cash transactions appear.
- `GET /reports/bank-book?cashBankAccountId=X&fiscalYearId=Y` -- verify bank transactions appear.
- Verify draft vouchers do not appear in any report.
- Verify soft-deleted vouchers do not appear in any report.
- Verify date range validation rejects invalid ranges.

### Recommended Model

GPT-5.5 Thinking xhigh / Codex for report query precision and balance computation correctness.

### Fallback Model

DeepSeek V4 Pro Max with strict prompt referencing Phase 2D lock docs.

### Risk Level

Medium. Report queries must compute correct balances from posted voucher lines. Opening balance computation requires summing all prior posted lines, which must be tested carefully.

### Stop Condition

Stop if:
- Ledger running balance is incorrect for any account.
- Cash Book or Bank Book shows draft or soft-deleted voucher data.
- Opening balance computation does not include prior posted lines.
- `pnpm typecheck` or `pnpm lint` fails.
- ACCOUNTANT guard is not applied to all report endpoints.

---

## Chunk 2D-3: Backend Trial Balance API

### Objective

Implement the trial balance endpoint that shows all active ledger accounts with debit and credit totals for a period, verifying total debits equal total credits.

Endpoint:
- `GET /reports/trial-balance` -- Trial Balance for a fiscal year, optionally filtered by accounting period or custom date range.

### Files Likely to Change

- `apps/api/src/report/trial-balance.service.ts` -- new service.
- `apps/api/src/report/report.controller.ts` -- add trial balance endpoint.
- `apps/api/src/report/dto/trial-balance-query.dto.ts` -- DTO for trial balance query.

### Business Logic

- Group posted VoucherLines by `ledgerAccountId`. Compute debit total and credit total for each account.
- Include all active ledger accounts (even those with zero movement in the period, if the user requests a full trial balance).
- Show net balance per account (debit balance or credit balance based on normalBalance).
- Verify total debits = total credits. Return the difference (should be zero).
- Filter by fiscal year, optionally by accounting period or custom date range.
- Only POSTED vouchers, no drafts or soft-deleted.

### Strict Out-of-Scope

- No financial statement endpoints (Chunk 2D-4).
- No frontend report pages (Chunk 2D-5).
- No adjusted trial balance.
- No comparative periods.

### Verification Commands

```powershell
pnpm typecheck
pnpm lint
pnpm build:api
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- `GET /reports/trial-balance?fiscalYearId=Y` -- verify all active ledger accounts appear.
- Verify total debits equal total credits (difference = 0).
- Verify zero-movement accounts appear or are correctly excluded based on the query parameter.
- Verify draft vouchers are excluded.

### Recommended Model

GPT-5.5 Thinking xhigh / Codex for trial balance aggregation correctness.

### Fallback Model

DeepSeek V4 Pro Max.

### Risk Level

Medium. Trial balance must correctly aggregate all accounts and verify the debit/credit balance. Incorrect grouping or filtering would produce a wrong trial balance.

### Stop Condition

Stop if:
- Total debits do not equal total credits on a balanced set of posted vouchers.
- Any posted voucher line is missing from the aggregation.
- Draft voucher data appears in the trial balance.
- `pnpm typecheck` or `pnpm lint` fails.

---

## Chunk 2D-4: Backend Income Statement and Balance Sheet API

### Objective

Implement the financial statement endpoints for the Income Statement and Balance Sheet.

Endpoints:
- `GET /reports/income-statement` -- Income Statement for a period.
- `GET /reports/balance-sheet` -- Balance Sheet at a point in time.

### Files Likely to Change

- `apps/api/src/report/financial-statement.service.ts` -- new service.
- `apps/api/src/report/report.controller.ts` -- add income-statement and balance-sheet endpoints.
- `apps/api/src/report/dto/financial-statement-query.dto.ts` -- DTO for financial statement queries.

### Business Logic

- **Income Statement**: Filter posted VoucherLines for Income and Expense account classes. Group by AccountGroup or individual LedgerAccount. Compute total income (credit totals for income-class accounts), total expenses (debit totals for expense-class accounts), and net profit/loss.
- **Balance Sheet**: Compute closing balances for Asset, Liability, and Equity accounts at a point-in-time date. Group by AccountGroup or individual LedgerAccount. Verify: Total Assets = Total Liabilities + Total Equity + Net Profit. If Net Profit is not included, show a note that the profit figure should be added separately.
- All queries must filter by `Voucher.status = POSTED` and `Voucher.isDeleted = false`.

### Strict Out-of-Scope

- No comparative periods.
- No multi-step income statement format (single-step only in first implementation).
- No automatic retained earnings computation across fiscal years.
- No frontend pages (Chunk 2D-6).
- No PDF/Excel export.

### Verification Commands

```powershell
pnpm typecheck
pnpm lint
pnpm build:api
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- `GET /reports/income-statement?fiscalYearId=Y&accountingPeriodId=P` -- verify income and expense accounts appear with correct totals, and net profit/loss is computed.
- `GET /reports/balance-sheet?fiscalYearId=Y&endDate=YYYY-MM-DD` -- verify asset, liability, equity closing balances, and the balance check.
- Verify draft vouchers are excluded from both statements.

### Recommended Model

GPT-5.5 Thinking xhigh / Codex for financial statement grouping and balance check logic.

### Fallback Model

DeepSeek V4 Pro Max.

### Risk Level

Medium-High. Financial statements are the most important accounting reports. Incorrect grouping, missing accounts, or wrong balance computation would undermine trust in the system. Must be reviewed carefully.

### Stop Condition

Stop if:
- Income statement net profit does not match the difference between total income and total expenses.
- Balance sheet total assets do not equal total liabilities + total equity + net profit.
- Asset accounts show credit-normal balances instead of debit-normal.
- Liability accounts show debit-normal balances instead of credit-normal.
- Draft voucher data appears in any financial statement.
- `pnpm typecheck` or `pnpm lint` fails.

---

## Chunk 2D-5: Frontend Report Pages for Ledger, Cash Book, Bank Book, Trial Balance

### Objective

Implement frontend pages for the General Ledger, Cash Book, Bank Book, and Trial Balance reports with date filtering and print foundation.

### Files Likely to Change

- `apps/web/src/app/app/reports/page.tsx` -- report landing/navigation page.
- `apps/web/src/app/app/reports/ledger/page.tsx` -- Ledger report page.
- `apps/web/src/app/app/reports/cash-book/page.tsx` -- Cash Book page.
- `apps/web/src/app/app/reports/bank-book/page.tsx` -- Bank Book page.
- `apps/web/src/app/app/reports/trial-balance/page.tsx` -- Trial Balance page.
- `apps/web/src/app/app/_components/ui.tsx` -- possibly extend shared primitives for report tables.
- `apps/web/src/app/app/layout.tsx` -- add Reports navigation link.
- `apps/web/src/lib/api.ts` -- add report resource helpers and types.

### Frontend Requirements

- **Reports navigation**: Add "Reports" link to the `/app` layout sidebar.
- **Ledger report**: Dropdown for ledger account and fiscal year/period/date range selectors. Table with voucher number, date, narration, debit, credit, running balance. Opening/closing balance summary. Print button.
- **Cash Book**: Dropdown for cash account and fiscal year/period/date range selectors. Table with voucher number, date, narration, receipt, payment, running balance. Print button.
- **Bank Book**: Dropdown for bank account and fiscal year/period/date range selectors. Same table structure as Cash Book. Print button.
- **Trial Balance**: Fiscal year/period/date range selectors. Table with ledger account, debit total, credit total, net balance. Summary row with totals. Print button.
- **Print foundation**: Each report page renders a `@media print` layout with Real Capita Group heading, report title, date range, data table, totals, and footer. Same pattern as voucher print layout.

### Strict Out-of-Scope

- No Income Statement or Balance Sheet pages (Chunk 2D-6).
- No Project Summary or Cost Center Summary pages (can be added later if needed).
- No PDF/Excel export.
- No dashboard analytics or charts.

### Verification Commands

```powershell
pnpm typecheck
pnpm lint
pnpm build:web
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- Navigate to `/app/reports`.
- Select a ledger account, select a fiscal year, verify the Ledger report renders with correct data.
- Select a cash account, verify the Cash Book renders.
- Select a bank account, verify the Bank Book renders.
- Select a fiscal year for Trial Balance, verify the trial balance table renders with correct totals.
- Click "Print report" on each page; verify the print layout renders.
- Verify draft voucher data does not appear in any report.

### Recommended Model

Claude Code Opus 4.8 High for frontend UI quality.

### Fallback Model

DeepSeek V4 Pro Max.

### Risk Level

Medium. Frontend follows established Phase 2A/2C patterns. Report tables with running balance are the most complex UI element.

### Stop Condition

Stop if:
- `pnpm typecheck` or `pnpm lint` fails.
- `pnpm build:web` fails.
- Ledger report page does not render.
- Cash Book or Bank Book shows incorrect running balance.
- Trial balance difference is not shown or is nonzero when books are balanced.
- Draft voucher data appears in any report page.
- Print layout is missing or unusable.

---

## Chunk 2D-6: Frontend Financial Statement Pages and Print Foundation

### Objective

Implement frontend pages for the Income Statement and Balance Sheet with print foundation. Also add Project Summary and Cost Center Summary pages.

### Files Likely to Change

- `apps/web/src/app/app/reports/income-statement/page.tsx` -- Income Statement page.
- `apps/web/src/app/app/reports/balance-sheet/page.tsx` -- Balance Sheet page.
- `apps/web/src/app/app/reports/project-summary/page.tsx` -- Project Summary page.
- `apps/web/src/app/app/reports/cost-center-summary/page.tsx` -- Cost Center Summary page.
- `apps/web/src/lib/api.ts` -- add financial statement and summary helpers.

### Frontend Requirements

- **Income Statement**: Fiscal year/period/date range selectors. Sections for Income and Expenses, grouped by AccountGroup or individual accounts. Net profit/loss at the bottom. Print button.
- **Balance Sheet**: Fiscal year selector, optional end date (point-in-time). Sections for Assets, Liabilities, Equity. Total check. Print button.
- **Project Summary**: Fiscal year/period selector, optional project filter. Table with project, debit total, credit total, net balance. Print button.
- **Cost Center Summary**: Fiscal year/period selector, optional cost center filter. Table with cost center, expense debit, expense credit, net expense. Print button.
- **Print foundation**: Same pattern as Chunk 2D-5.

### Strict Out-of-Scope

- No PDF/Excel export.
- No comparative period reports.
- No multi-step income statement format.
- No dashboard analytics.

### Verification Commands

```powershell
pnpm typecheck
pnpm lint
pnpm build:web
pnpm check:all
pnpm doctor
```

### Manual Smoke Tests

- Navigate to Income Statement page; verify income and expense sections render correctly.
- Navigate to Balance Sheet page; verify asset/liability/equity sections render with balance check.
- Navigate to Project Summary page; verify project totals render.
- Navigate to Cost Center Summary page; verify cost center totals render.
- Print each report; verify print layout.

### Recommended Model

Claude Code Opus 4.8 High for financial statement UI quality.

### Fallback Model

DeepSeek V4 Pro Max.

### Risk Level

Low-Medium. Primarily UI work extending Chunk 2D-5 patterns.

### Stop Condition

Stop if:
- Income statement shows expenses under income section (incorrect grouping).
- Balance sheet balance check shows nonzero difference when books are balanced.
- Print layouts are missing or unusable.
- `pnpm typecheck` or `pnpm lint` fails.

---

## Chunk 2D-7: Final Integration and Acceptance Review

### Objective

Run full integration smoke tests across all report endpoints and frontend pages, verify report correctness, update documentation, and confirm Phase 2D acceptance.

### Files Likely to Change

- `docs/handoff.md` -- update for Phase 2D completion.
- `docs/ai/CURRENT_STATE.md` -- update for Phase 2D completion.
- `README.md` -- update current development phase.
- `AGENTS.md` -- update current phase.
- No schema, API, or frontend code changes in this chunk.

### Acceptance Review Checklist

Match all Phase 2D acceptance criteria from `docs/acceptance/phase-2d-acceptance-criteria.md`.

### Strict Out-of-Scope

- No new code features in this chunk (only documentation updates).
- No report, no dashboard, no payroll, no parties.

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
git status --short --branch
git log --oneline --max-count=10
```

### Manual Smoke Tests

All smoke tests from Phase 2D acceptance criteria.

### Recommended Model

GLM 5.1 High for documentation and integration review.

### Fallback Model

DeepSeek V4 Pro Max.

### Risk Level

Low. Review/documentation chunk only. No code changes beyond doc updates.

### Stop Condition

Stop if:
- Any acceptance criterion is not met.
- `pnpm check:all` or `pnpm doctor` fails.
- Working tree is not clean at the end.
- Any report shows draft or soft-deleted voucher data.
- Trial balance difference is nonzero when books are balanced.

---

## Phase 2D Overall Stop Conditions

Stop the entire Phase 2D before starting any chunk if:

- User has not explicitly confirmed Phase 2D implementation.
- Working tree is not clean.
- Git remote is not `https://github.com/MaruflRana/real-capita-accounts`.
- `DATABASE_URL` does not use port `55432`.
- Any unconfirmed role exists in schema, seed data, source, or database.
- Phase 2C voucher engine is not complete and accepted.
- Phase 2D requirement lock is not reviewed and accepted.
- The agent is not inside `D:\real-capita-accounts`.

---

## Plan Status

This plan is locked for discussion and next-agent orientation only. It becomes implementation scope only after the user explicitly confirms Phase 2D.
