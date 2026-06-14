# Phase 2D Acceptance Criteria

## Purpose

Phase 2D is a documentation/specification lock. It prepares accounting report requirements and acceptance criteria for a future implementation phase without changing schema, API, UI business modules, roles, or seed data.

## Acceptance Checklist For Phase 2D Documentation

Phase 2D is accepted when:

- `docs/requirements/phase-2d-accounting-reports-requirement-lock.md` exists.
- `docs/architecture/phase-2d-report-query-model-proposal.md` exists.
- `docs/acceptance/phase-2d-acceptance-criteria.md` exists.
- `docs/prompts/phase-2d-next-prompt.md` exists.
- `docs/decisions/ADR-0008-phase-2d-report-requirement-lock.md` exists.
- `docs/plans/phase-2d-accounting-reports-implementation-plan.md` exists.
- `AGENTS.md` points future agents to the Phase 2D lock.
- `docs/ai/CURRENT_STATE.md` states that Phase 2D report requirement lock is prepared.
- `docs/ai/START_HERE.md` points agents to the Phase 2D docs.
- `docs/handoff.md` records the created Phase 2D files and states that no report modules were implemented.
- `README.md` states the current development phase includes the Phase 2D requirement lock.
- `prisma/schema.prisma` is unchanged by Phase 2D.
- No report tables, report API endpoints, or report UI pages were added.
- Verification passes with `pnpm check:all` and `pnpm doctor`.

## Acceptance Checklist For Future Report Backend Implementation

After explicit user confirmation, the future report backend implementation is accepted only if:

- Accountant can log in.
- `GET /reports/ledger` returns the General Ledger for a specific ledger account with correct debit/credit lines, running balance, opening balance, period movement, and closing balance.
- `GET /reports/cash-book` returns Cash Book entries for a cash-type CashBankAccount with receipts, payments, and running balance.
- `GET /reports/bank-book` returns Bank Book entries for a bank-type CashBankAccount with receipts, payments, and running balance.
- `GET /reports/trial-balance` returns all active ledger accounts with debit totals, credit totals, and net balances, with total debits equal to total credits.
- `GET /reports/income-statement` returns income and expense accounts grouped by account class, with net profit or loss.
- `GET /reports/balance-sheet` returns asset, liability, and equity closing balances at a date, with the balance check (assets = liabilities + equity + net profit).
- `GET /reports/project-summary` returns project-wise debit and credit totals from posted lines.
- `GET /reports/cost-center-summary` returns cost-center-wise expense totals from posted lines.
- Reports use only POSTED vouchers; DRAFT and soft-deleted vouchers do not affect any report.
- Date filtering by fiscal year, accounting period, or custom date range works correctly.
- Date range validation rejects ranges outside the fiscal year.
- Opening balance computation includes all posted lines before the start date within the fiscal year.
- Normal-balance-aware balance presentation respects the AccountClass normalBalance (DEBIT or CREDIT).
- Cash Book only shows cash-type CashBankAccount transactions.
- Bank Book only shows bank-type CashBankAccount transactions.
- Contra vouchers appear correctly in both Cash Book and Bank Book.
- No separate report tables exist in the Prisma schema.
- Only `ACCOUNTANT` role can access report endpoints.
- Unauthenticated access returns 401; non-ACCOUNTANT users receive 403.

## Acceptance Checklist For Future Report Frontend Implementation

After the backend is accepted, the future report frontend is accepted only if:

- Accountant can navigate to report pages from the `/app` shell.
- Ledger report page shows a ledger account dropdown, date range selector, and the report data with running balance.
- Cash Book page shows a cash account dropdown, date range selector, and cash transactions.
- Bank Book page shows a bank account dropdown, date range selector, and bank transactions.
- Trial Balance page shows a fiscal year selector, optional period selector, and the trial balance table.
- Income Statement page shows the income and expense accounts with totals and net profit/loss.
- Balance Sheet page shows asset, liability, and equity sections with totals and balance check.
- Project Summary page shows project-wise debit/credit totals.
- Cost Center Summary page shows cost-center-wise expense totals.
- Each report page has a "Print report" button that renders a clean print layout.
- No report UI references parties, customers, vendors, payroll, or tax.
- No dashboard analytics or charts are added.
- The UI follows the existing Phase 2A/2C design patterns (calm, professional, cookie-authenticated).

## Report Correctness Acceptance Criteria

- Every report figure can be traced back to a specific posted `VoucherLine` record.
- Trial balance total debits equal total credits.
- Ledger closing balance equals opening balance + debit movement - credit movement (for debit-normal accounts).
- Ledger closing balance equals opening balance + credit movement - debit movement (for credit-normal accounts).
- Cash Book running balance matches the sum of receipts minus payments.
- Bank Book running balance matches the sum of receipts minus payments.
- Income statement net profit = total income - total expenses.
- Balance sheet total assets = total liabilities + total equity + net profit (from the income statement for the same period).
- Opening balance for the first period of a fiscal year includes any opening journal vouchers posted before the period start date.

## Security Acceptance Criteria

- All report endpoints require authentication (HttpOnly cookie JWT/session).
- All report endpoints require the `ACCOUNTANT` role.
- Unauthenticated users are redirected to `/login`.
- Non-ACCOUNTANT users receive a 403 Forbidden response.
- No report data is accessible through unprotected routes.

## Print/Export Acceptance Criteria

- Each report page renders a professional print layout using `@media print` CSS.
- Print layout includes: Real Capita Group heading, report title, date range, fiscal year, data table, totals, and footer.
- Print is triggered through `window.print()`; no PDF generation is required in the first implementation.
- PDF and Excel export are not included in the first implementation unless separately confirmed.

## Smoke Tests

After report implementation is complete:

1. Log in as accountant.
2. Create and post a balanced Payment Voucher with one debit (expense) line and one credit (cash) line.
3. Navigate to the Ledger report; select the expense account and the fiscal year; verify the debit line appears with the correct amount and running balance.
4. Navigate to the Cash Book; select the cash account; verify the credit line appears as a payment with the correct amount and running balance.
5. Navigate to the Trial Balance; select the fiscal year; verify the posted amounts appear for the expense and cash accounts and total debits equal total credits.
6. Navigate to the Income Statement; verify the expense appears under Expenses and the income section is empty (or includes any posted income).
7. Navigate to the Balance Sheet; verify the cash account appears under Assets and the expense does not appear (expenses are on the income statement, not the balance sheet).
8. Create an unbalanced draft voucher; verify it does not appear in any report.
9. Soft-delete a draft voucher; verify it does not appear in any report.
10. Attempt to view a report without logging in; verify redirect to `/login`.
11. Verify the print layout renders correctly for the Ledger report.
12. Verify the Trial Balance shows zero difference (balanced books).

## Explicit Out-of-Scope List

Phase 2D documentation and the first report implementation must not include:

- Ledger report stored tables.
- Cash book stored tables.
- Bank book stored tables.
- Trial balance stored tables.
- Financial statement stored tables.
- Dashboard analytics or charts.
- Party, customer, or vendor aging reports.
- Payroll or salary reports.
- Inventory reports.
- Project CRM reports.
- Tax/VAT reports or computation.
- File uploads or attachments on reports.
- Approval workflow for reports.
- Additional roles beyond `ACCOUNTANT`.
- PDF or Excel export infrastructure (browser print only).
- Batch report generation.
- Scheduled/automated report generation.
- Real business seed data.
- Code copied from the old ERP prototype.
- Separate opening-balance tables.

## Verification Commands

Run these commands for Phase 2D documentation:

```powershell
git pull --ff-only
git status --short --branch
pnpm check:all
pnpm doctor
git status --short --branch
git log --oneline --max-count=10
```

Do not run migrations for Phase 2D because no schema change should be made.
