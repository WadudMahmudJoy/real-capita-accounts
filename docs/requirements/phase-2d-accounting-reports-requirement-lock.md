# Phase 2D: Accounting Reports Requirement Lock

## Purpose

Phase 2D locks accounting report requirements and acceptance criteria before any report schema, API, UI, or business logic is implemented.

This document exists so the next agent or developer can continue from repository context alone, without relying on hidden chat memory.

## A. Confirmed Business Context

- Phase 2C voucher engine is complete and accepted: vouchers can be created as drafts, posted with full validation, and printed.
- Posted vouchers are immutable; draft and soft-deleted vouchers do not affect reports.
- Only the `ACCOUNTANT` role is confirmed. Other roles are deferred until Real Capita confirms exact office responsibilities.
- Reports must derive from posted voucher data, not from separate manual report tables.
- This system is accounting-first, not ERP-first. Reports serve the accountant's daily workflow.

## Confirmed Single-Role Rule

The only active role is:

- `ACCOUNTANT`, displayed as `Accountant`

Do not implement, seed, display, or model Admin, Super Admin, Data Entry, Checker, MD Viewer, HR, Sales, Payroll, Viewer, Manager, or any other role in the current phase.

## B. Phase 2D Scope

Phase 2D is documentation/specification lock only.

Phase 2D does not include:

- Database schema changes
- Prisma model additions
- API business modules
- Frontend business pages
- Business seed data
- Additional roles
- Report runtime logic

## What Phase 2D Is

Phase 2D defines accounting report requirements, constraints, open questions, and acceptance criteria for a future implementation phase.

## What Phase 2D Is Not

Phase 2D is not a coding phase. It must not add report tables, report API endpoints, report UI pages, or any report runtime behavior.

## C. Report Module Purpose

The accounting reports module provides the accountant with standard financial reports derived from posted voucher data. Without reports, the posted vouchers exist as raw transaction records but the accountant cannot see aggregated ledger movements, trial balances, or financial statements.

Reports transform posted `VoucherLine` records into meaningful summaries that answer:

- What happened in each ledger account over a period?
- What is the trial balance for a fiscal year or period?
- What are the cash and bank transactions?
- What did the company earn and spend?
- What is the financial position of the company?
- How much did each project or cost center cost?

## D. Core Report Principle: Derived From Posted Vouchers Only

### Only Posted Vouchers

All accounting reports must use only vouchers with `status = POSTED`.

- `DRAFT` vouchers must not affect reports.
- `isDeleted = true` (soft-deleted) vouchers must not affect reports.
- The backend must filter by `status = POSTED` and `isDeleted = false` in every report query.

### No Primary Report Tables

Reports must not be stored as primary manual tables. The posted `VoucherLine` records are the single source of truth for all accounting data.

- No `LedgerReport` table.
- No `TrialBalance` table.
- No `CashBook` table.
- No `BankBook` table.
- No `IncomeStatement` table.
- No `BalanceSheet` table.
- No `ProjectReport` table.
- No `CostCenterReport` table.

Reports may be computed on demand from posted `VoucherLine` records. Caching or materialized views may be introduced later only if performance requires it, but the `VoucherLine` records remain the authoritative source.

## E. Accounting Reports To Define

### 1. General Ledger / Ledger Statement

Shows all posted transactions for a specific ledger account over a date range.

Each row represents one posted `VoucherLine` linked to the selected `LedgerAccount`. The report shows:

- Voucher number (`systemVoucherNo`)
- Voucher date
- Voucher type
- Narration (from the voucher header)
- Line description (from the voucher line)
- Debit amount (if `side = DEBIT`)
- Credit amount (if `side = CREDIT`)
- Running balance (cumulative, normal-balance-aware)

The running balance must respect the `LedgerAccount.normalBalance`:

- If `normalBalance = DEBIT`: balance = previous balance + debit - credit
- If `normalBalance = CREDIT`: balance = previous balance + credit - debit

The report includes:

- Opening balance (balance at the start of the selected date range)
- Period movement (total debit and total credit for the range)
- Closing balance (opening balance + period movement, normal-balance-aware)

### 2. Cash Book

Shows all posted cash transactions for cash-type `CashBankAccount` records.

The Cash Book filters posted `VoucherLine` records where the linked `LedgerAccount.isCashBank = true` and the linked `CashBankAccount.accountType = CASH`.

Each row shows:

- Voucher number
- Voucher date
- Narration
- Receipt (debit side for cash account)
- Payment (credit side for cash account)
- Running balance

### 3. Bank Book

Shows all posted bank transactions for bank-type `CashBankAccount` records.

The Bank Book filters posted `VoucherLine` records where the linked `LedgerAccount.isCashBank = true` and the linked `CashBankAccount.accountType = BANK`.

Each row shows:

- Voucher number
- Voucher date
- Narration
- Receipt (debit side for bank account)
- Payment (credit side for bank account)
- Running balance

### 4. Trial Balance

Shows all active ledger accounts with their debit and credit totals for a period, verifying that total debits equal total credits.

Each row shows:

- Ledger account code and name
- Debit total (sum of posted debit lines for the account in the period)
- Credit total (sum of posted credit lines for the account in the period)
- Net balance (normal-balance-aware: debit balance or credit balance)

The trial balance must show:

- Total debit across all accounts
- Total credit across all accounts
- Difference (must be zero if the books are balanced)

### 5. Statement of Comprehensive Income / Income Statement

Shows income and expense accounts for a period, calculating net profit or loss.

Groups accounts by `AccountClass`:

- Income accounts (`AccountClassCode = INCOME`)
- Expense accounts (`AccountClassCode = EXPENSE`)

Shows:

- Each income ledger account with its credit total (income increases on the credit side for income-class accounts)
- Each expense ledger account with its debit total (expenses increase on the debit side for expense-class accounts)
- Total Income
- Total Expenses
- Net Profit (Total Income - Total Expenses) or Net Loss

The income statement is for a specific period or date range within a fiscal year.

### 6. Statement of Financial Position / Balance Sheet

Shows asset, liability, and equity accounts at a point in time (closing balances).

Groups accounts by `AccountClass`:

- Asset accounts (`AccountClassCode = ASSET`)
- Liability accounts (`AccountClassCode = LIABILITY`)
- Equity accounts (`AccountClassCode = EQUITY`)

Shows:

- Each asset ledger account with its closing debit balance
- Each liability ledger account with its closing credit balance
- Each equity ledger account with its closing credit balance
- Total Assets
- Total Liabilities
- Total Equity
- Net Profit carried from the income statement (if the same period is selected)
- Check: Total Assets = Total Liabilities + Total Equity + Net Profit

### 7. Project-Wise Cost/Revenue Summary

Shows posted voucher lines grouped by project, summarizing debit and credit totals.

Each row shows:

- Project code and name
- Total debit (costs/expenses assigned to the project)
- Total credit (revenues/incomes assigned to the project)
- Net balance

Only posted voucher lines where `projectId` is set are included.

### 8. Cost-Center-Wise Expense Summary

Shows posted voucher lines grouped by cost center, summarizing debit totals for expense-type accounts.

Each row shows:

- Cost center code and name (and its parent project)
- Total expense debit amount
- Total expense credit amount (if any adjustments)
- Net expense

Only posted voucher lines where `costCenterId` is set and the linked `LedgerAccount` belongs to the `EXPENSE` class are included.

## F. Debit/Credit Behavior and Balance Presentation

### Account Class Normal Balance

Each `AccountClass` has a `normalBalance`:

- ASSET: `DEBIT` (assets increase on the debit side)
- LIABILITY: `CREDIT` (liabilities increase on the credit side)
- EQUITY: `CREDIT` (equity increases on the credit side)
- INCOME: `CREDIT` (income increases on the credit side)
- EXPENSE: `DEBIT` (expenses increase on the debit side)

### Movement Definitions

For any ledger account over a date range:

- **Debit movement**: sum of `amount` for posted `VoucherLine` records where `side = DEBIT` and `voucherDate` is within the range.
- **Credit movement**: sum of `amount` for posted `VoucherLine` records where `side = CREDIT` and `voucherDate` is within the range.

### Balance Definitions

For any ledger account at a point in time or over a period:

- **Opening balance**: the cumulative normal-balance-aware balance at the start of the selected date range. Computed by summing all posted lines before the start date, applying the normal-balance rule.
- **Period movement**: debit movement minus credit movement (or credit movement minus debit movement, depending on normal balance).
- **Closing balance**: opening balance + period movement, normal-balance-aware.

The balance must always be presented in the context of the account's normal balance:

- A debit-normal account shows its balance as a debit figure (positive = debit-heavy, negative = credit-heavy).
- A credit-normal account shows its balance as a credit figure (positive = credit-heavy, negative = debit-heavy).

## G. Opening Balance Policy

### Recommended Approach

Opening balances for a new fiscal year should be entered through **opening journal vouchers** -- regular posted vouchers that carry forward the closing balances from the previous year.

This approach has advantages:

- Opening balances follow the same validation rules as regular vouchers.
- Opening balances are auditable through the existing `AuditEvent` trail.
- No separate opening-balance table is needed.
- Opening balances are visible in the ledger report alongside regular transactions.

### No Separate Opening-Balance Table

A separate `OpeningBalance` table should not be added unless explicitly approved later. The opening journal voucher approach is sufficient for the first implementation.

### Future Consideration

If Real Capita later requires a migration/import tool for opening balances from the old ERP or another system, that tool can create opening journal vouchers programmatically. A dedicated import/migration UI is deferred to a future phase.

## H. Report Date Filtering

Every report must support date filtering through one or more of these parameters:

1. **Fiscal year**: filter by `fiscalYearId`. The report covers the fiscal year's date range.
2. **Accounting period**: filter by `accountingPeriodId`. The report covers the period's date range. The period must belong to the selected fiscal year.
3. **Custom date range**: filter by `startDate` and `endDate`. The date range must fall inside a single fiscal year.
4. **Project**: filter by `projectId`. Shows only posted lines linked to the project.
5. **Cost center**: filter by `costCenterId`. Shows only posted lines linked to the cost center.
6. **Ledger account**: filter by `ledgerAccountId`. Shows only posted lines for that account.

Filters can be combined where applicable:

- Ledger report: always filtered by one `ledgerAccountId`; optionally filtered by fiscal year, period, or custom date range.
- Cash book: always filtered by one cash `CashBankAccount`; optionally filtered by fiscal year, period, or custom date range.
- Bank book: always filtered by one bank `CashBankAccount`; optionally filtered by fiscal year, period, or custom date range.
- Trial balance: filtered by fiscal year, optionally by period or custom date range.
- Income statement: filtered by fiscal year, optionally by period or custom date range.
- Balance sheet: filtered by fiscal year, optionally by a point-in-time date (closing balances at that date).
- Project summary: filtered by fiscal year, optionally by period or custom date range, optionally by project.
- Cost center summary: filtered by fiscal year, optionally by period or custom date range, optionally by cost center.

## I. Cash/Bank Behavior in Reports

### Cash Book

- Comes from posted `VoucherLine` records where the linked `LedgerAccount.isCashBank = true` and the linked `CashBankAccount.accountType = CASH`.
- Receipts are debit-side entries (incoming cash).
- Payments are credit-side entries (outgoing cash).
- Running balance increases with receipts and decreases with payments.

### Bank Book

- Comes from posted `VoucherLine` records where the linked `LedgerAccount.isCashBank = true` and the linked `CashBankAccount.accountType = BANK`.
- Receipts are debit-side entries (incoming bank deposits).
- Payments are credit-side entries (outgoing bank withdrawals).
- Running balance increases with receipts and decreases with payments.

### Contra Vouchers in Cash/Bank Reports

Contra vouchers (transfers between cash and bank accounts) must appear correctly in both the Cash Book and the Bank Book:

- The cash debit line appears as a receipt in the Cash Book.
- The bank credit line appears as a payment in the Bank Book.
- The bank debit line appears as a receipt in the Bank Book.
- The cash credit line appears as a payment in the Cash Book.

## J. Report Export/Print Expectations

### Browser Print Foundation

The first implementation should provide browser-based print for all reports, following the same pattern established in Phase 2C (voucher print layout with `@media print` CSS and `window.print()`).

Each report page should render a clean, professional print layout with:

- Real Capita Group heading
- Report title and type
- Date range or period label
- Fiscal year label
- Report data (table, balances, totals)
- Footer with generation timestamp

### PDF Export

PDF export for individual reports is deferred to a future phase unless Real Capita confirms this requirement now.

### Excel Export

Excel/CSV export for report data is deferred to a future phase unless Real Capita confirms this requirement now.

## K. Security

### Role Access

Only the `ACCOUNTANT` role can access report endpoints in the current phase.

- All report endpoints must be guarded by `AuthGuard` + `RolesGuard` + `ACCOUNTANT`.
- Unauthenticated access must return 401.
- Non-ACCOUNTANT users must receive 403.

### No New Viewer/Manager/Admin Role

A future "Viewer" or "Manager" role that can see reports but cannot create/edit vouchers may be added when Real Capita confirms. Until then, only the Accountant role accesses reports.

## L. Audit Trail Expectations

Reports are read-only derived views. No `AuditEvent` entries are required for viewing reports. However:

- The underlying posted voucher data that feeds reports is fully audited (VOUCHER_CREATED, VOUCHER_EDITED, VOUCHER_POSTED events already exist from Phase 2C).
- If a report export/print action is later added as a distinct feature, it may warrant its own audit event. This is deferred.

## M. Explicit Out-of-Scope List

Phase 2D documentation and the first report implementation must not include:

- Dashboard analytics or charts.
- Payroll reports or salary reports.
- Party, customer, or vendor aging reports.
- Inventory reports.
- Project CRM reports.
- Tax/VAT reports or computation.
- File uploads or attachments on reports.
- Approval workflow for reports.
- Additional roles beyond `ACCOUNTANT`.
- Real business seed data containing real transactions or balances.
- Code copied from the old ERP prototype.
- Separate primary report tables (LedgerReport, TrialBalance, etc.).
- PDF or Excel export infrastructure (browser print only).
- Batch report generation.
- Scheduled/automated report generation.
- Inter-company comparison reports.
- Budget or forecast reports.

## N. Open Questions for Real Capita

- Should the balance sheet include retained earnings (accumulated profit/loss from prior fiscal years) automatically, or should the accountant enter it through an equity journal voucher?
- Should the income statement be a single-step format (total income minus total expenses) or a multi-step format (gross profit, operating profit, net profit)?
- Should the trial balance show only accounts with nonzero balances, or all active accounts?
- Should project-wise summaries include only expense accounts, or all accounts linked to the project?
- Should cost-center summaries be scoped to expense accounts only, or all accounts linked to the cost center?
- Is PDF export needed for the first implementation, or is browser print sufficient?
- Is Excel/CSV export needed for the first implementation?
- Should opening balances use opening journal vouchers (recommended), or does Real Capita want a separate opening-balance entry UI?
- Are comparative reports (current period vs prior period) needed in the first implementation?
- Should the balance sheet show a point-in-time snapshot (balances at a specific date), or period-end balances only?

## O. Implementation Readiness Checklist

Before report implementation coding starts:

- User explicitly confirms the next implementation phase.
- User confirms this requirement lock is still accurate.
- User answers or defers the open questions above.
- Agent checks `git status --short --branch`.
- Agent confirms `DATABASE_URL` uses `localhost:55432`.
- Agent confirms only `ACCOUNTANT` exists as a role.
- Agent confirms Phase 2C voucher engine is complete and accepted.
- Agent reads `docs/architecture/phase-2d-report-query-model-proposal.md`.
- Agent reads `docs/acceptance/phase-2d-acceptance-criteria.md`.
- Agent confirms no report tables already exist unexpectedly in the Prisma schema.

## P. Strict Stop Conditions

Stop before coding if:

- User has not confirmed the report implementation phase.
- Working tree is not clean.
- Git remote is not `https://github.com/MaruflRana/real-capita-accounts`.
- `DATABASE_URL` does not use port `55432`.
- Any unconfirmed role exists in schema, seed data, source, or database.
- Report tables already exist unexpectedly in the Prisma schema.
- Phase 2C voucher engine is not complete and accepted.
- The agent is not inside `D:\real-capita-accounts`.

## Q. Module-By-Module Requirement Lock

| Area | Locked Phase 2D Intent | Explicitly Deferred |
| --- | --- | --- |
| General Ledger | Ledger statement for one account, date-filtered, with running balance and opening/closing | Comparative periods, budget comparison |
| Cash Book | Cash-type cash/bank account transactions, date-filtered, with running balance | Bank reconciliation, multi-currency |
| Bank Book | Bank-type cash/bank account transactions, date-filtered, with running balance | Bank reconciliation, cheque tracking |
| Trial Balance | All active accounts debit/credit totals for a period | Adjusted trial balance, comparative |
| Income Statement | Income and expense accounts, net profit/loss | Multi-step format, comparative, budget |
| Balance Sheet | Asset/Liability/Equity closing balances at a date | Comparative, prior-year retained earnings auto-computation |
| Project Summary | Project-wise cost/revenue from posted lines | Project budget comparison, project timeline |
| Cost Center Summary | Cost-center-wise expense from posted lines | Cost center budget, allocation splits |
| Opening Balances | Opening journal vouchers (recommended) | Separate opening-balance table, migration/import tool |
| Print/Export | Browser print foundation (same pattern as voucher print) | PDF, Excel/CSV, batch export |
| Security | ACCOUNTANT role only for report access | Viewer/Manager role for read-only report access |
| Audit | No report-view audit events needed | Report-export/print audit events |

## R. Next Prompt Summary

Next agent: read `AGENTS.md`, run `pnpm agent:start`, then read the Phase 2D requirement lock, the Phase 2D model proposal, and the Phase 2D acceptance criteria. Do not implement anything until the user explicitly confirms the next report implementation phase. If confirmed, implement only the accounting reports for the single `ACCOUNTANT` role. Do not add dashboard analytics, payroll reports, party reports, tax reports, business seed data, additional roles, or file uploads without separate confirmation.
