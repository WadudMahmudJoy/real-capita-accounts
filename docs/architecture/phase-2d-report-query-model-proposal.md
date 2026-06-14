# Phase 2D: Report Query Model Proposal

## Purpose

This is a proposal only. It is not implemented in Prisma, API code, or frontend code during Phase 2D.

The proposal describes the likely report engine architecture for a future implementation phase after user confirmation.

## Proposed Architecture: No New Primary Report Tables

The report engine computes all reports on demand from existing Phase 2A and Phase 2C data. No new primary database tables are added for reports.

### Source Data

Reports derive from these existing models:

| Model | Role in Reports |
| --- | --- |
| `Voucher` | Header: date, type, systemVoucherNo, narration, status (POSTED only), fiscalYearId, accountingPeriodId |
| `VoucherLine` | Line: side, amount, ledgerAccountId, projectId, costCenterId, cashBankAccountId, description |
| `LedgerAccount` | Account: code, name, normalBalance, requiresProject, requiresCostCenter, isCashBank, isActive |
| `AccountGroup` | Grouping: groups under an AccountClass |
| `AccountClass` | Class: code (ASSET/LIABILITY/EQUITY/INCOME/EXPENSE), normalBalance |
| `FiscalYear` | Period scope: startDate, endDate, isActive, isClosed |
| `AccountingPeriod` | Period scope: startDate, endDate, status (OPEN/LOCKED/CLOSED) |
| `Project` | Project filter and grouping |
| `CostCenter` | Cost center filter and grouping |
| `CashBankAccount` | Cash/bank filter for cash book and bank book: accountType (CASH/BANK), displayName |
| `Company` | Company context for report headers |

### Query Principle

Every report query filters posted vouchers by:

- `Voucher.status = POSTED`
- `Voucher.isDeleted = false`
- `Voucher.voucherDate` within the requested date range
- `Voucher.fiscalYearId` matching the requested fiscal year

Then aggregates `VoucherLine.amount` grouped by the relevant dimension (ledger account, project, cost center, cash/bank account, account class).

## Proposed Service Layer

### NestJS Report Module

A new `apps/api/src/report` module containing:

- `report.module.ts`: registers the module, imports PrismaModule and AuthModule.
- `report.controller.ts`: exposes report endpoints guarded by `AuthGuard` + `RolesGuard` + `ACCOUNTANT`.
- `report.service.ts`: shared helpers for date validation, fiscal-year scoping, and posted-voucher filtering.
- `ledger-report.service.ts`: computes the General Ledger / Ledger Statement.
- `cash-bank-book.service.ts`: computes Cash Book and Bank Book.
- `trial-balance.service.ts`: computes Trial Balance.
- `financial-statement.service.ts`: computes Income Statement and Balance Sheet (future chunk).
- `project-summary.service.ts`: computes Project-wise and Cost-center-wise summaries.

### DTO Structure

#### Shared Report Query DTO

All report endpoints share a common query DTO shape:

```
class ReportQueryDto {
  fiscalYearId: string;          // required: scopes the report to a fiscal year
  accountingPeriodId?: string;   // optional: scopes to a period within the fiscal year
  startDate?: string;            // optional: custom start date (ISO 8601)
  endDate?: string;              // optional: custom end date (ISO 8601)
  projectId?: string;            // optional: filter by project
  costCenterId?: string;         // optional: filter by cost center
  ledgerAccountId?: string;      // optional: filter by ledger account (for ledger report)
  cashBankAccountId?: string;    // optional: filter by specific cash/bank account (for cash/bank book)
}
```

Validation rules:

- `fiscalYearId` is required and must reference an existing fiscal year.
- If `accountingPeriodId` is provided, it must belong to the selected `fiscalYearId`.
- If `startDate` and `endDate` are provided, they must fall within the fiscal year's date range.
- `startDate` must not be after `endDate`.
- At most one of `accountingPeriodId` or `startDate/endDate` should be provided. If both are provided, `startDate/endDate` override the period range (the period is used only for label display).

## Proposed API Endpoints for Future Implementation

| Endpoint | Purpose | Required Filter | Optional Filters |
| --- | --- | --- | --- |
| `GET /reports/ledger` | General Ledger / Ledger Statement | `ledgerAccountId`, `fiscalYearId` | `accountingPeriodId`, `startDate/endDate` |
| `GET /reports/cash-book` | Cash Book | `cashBankAccountId` (cash type), `fiscalYearId` | `accountingPeriodId`, `startDate/endDate` |
| `GET /reports/bank-book` | Bank Book | `cashBankAccountId` (bank type), `fiscalYearId` | `accountingPeriodId`, `startDate/endDate` |
| `GET /reports/trial-balance` | Trial Balance | `fiscalYearId` | `accountingPeriodId`, `startDate/endDate` |
| `GET /reports/income-statement` | Income Statement | `fiscalYearId` | `accountingPeriodId`, `startDate/endDate` |
| `GET /reports/balance-sheet` | Balance Sheet | `fiscalYearId` | `endDate` (point-in-time) |
| `GET /reports/project-summary` | Project Cost/Revenue Summary | `fiscalYearId` | `accountingPeriodId`, `startDate/endDate`, `projectId` |
| `GET /reports/cost-center-summary` | Cost Center Expense Summary | `fiscalYearId` | `accountingPeriodId`, `startDate/endDate`, `costCenterId` |

All endpoints require authentication and the `ACCOUNTANT` role.

## Accounting Formulas

### Debit Movement

For a `LedgerAccount` over a date range:

```
debitMovement = SUM(VoucherLine.amount)
  WHERE VoucherLine.ledgerAccountId = ledgerAccountId
    AND VoucherLine.side = 'DEBIT'
    AND Voucher.status = 'POSTED'
    AND Voucher.isDeleted = false
    AND Voucher.voucherDate >= startDate
    AND Voucher.voucherDate <= endDate
```

### Credit Movement

```
creditMovement = SUM(VoucherLine.amount)
  WHERE VoucherLine.ledgerAccountId = ledgerAccountId
    AND VoucherLine.side = 'CREDIT'
    AND Voucher.status = 'POSTED'
    AND Voucher.isDeleted = false
    AND Voucher.voucherDate >= startDate
    AND Voucher.voucherDate <= endDate
```

### Opening Balance

For a `LedgerAccount` at the start of a date range:

```
openingBalance = normalBalanceAwareBalance(
  SUM(all posted debit lines before startDate),
  SUM(all posted credit lines before startDate),
  LedgerAccount.normalBalance
)
```

Where `normalBalanceAwareBalance` is:

- If `normalBalance = DEBIT`: `previousDebits - previousCredits`
- If `normalBalance = CREDIT`: `previousCredits - previousDebits`

### Closing Balance

```
closingBalance = openingBalance + periodMovement

periodMovement = normalBalanceAwareBalance(debitMovement, creditMovement, LedgerAccount.normalBalance)
```

Where:

- If `normalBalance = DEBIT`: `periodMovement = debitMovement - creditMovement`
- If `normalBalance = CREDIT`: `periodMovement = creditMovement - debitMovement`

### Normal-Balance-Aware Balance Presentation

The balance is always presented as a signed number in the context of the account's normal side:

- A debit-normal account with a positive closing balance shows as a "debit balance" (the account has more debits than credits, which is its normal state).
- A debit-normal account with a negative closing balance shows as a "credit balance" (unusual: the account has more credits than debits).
- A credit-normal account with a positive closing balance shows as a "credit balance" (normal state).
- A credit-normal account with a negative closing balance shows as a "debit balance" (unusual).

## Financial Statement Grouping

### Income Statement (Statement of Comprehensive Income)

Groups `LedgerAccount` records by their `AccountClass`:

- **Income** (`AccountClassCode = INCOME`): all active ledger accounts under the Income class. Shows credit totals (income increases on the credit side for credit-normal accounts).
- **Expenses** (`AccountClassCode = EXPENSE`): all active ledger accounts under the Expense class. Shows debit totals (expenses increase on the debit side for debit-normal accounts).

Net Profit = Total Income - Total Expenses
Net Loss = Total Expenses - Total Income (if expenses exceed income)

### Balance Sheet (Statement of Financial Position)

Groups `LedgerAccount` records by their `AccountClass`:

- **Assets** (`AccountClassCode = ASSET`): closing debit balances (assets are debit-normal).
- **Liabilities** (`AccountClassCode = LIABILITY`): closing credit balances (liabilities are credit-normal).
- **Equity** (`AccountClassCode = EQUITY`): closing credit balances (equity is credit-normal).

Balance check: Total Assets = Total Liabilities + Total Equity + Net Profit (from the income statement for the same period).

If the income statement has not been computed for the same period, the balance sheet should show equity without the current-period profit, and note that the profit figure should be added separately.

## Report Query Validation

### Date Range Validation

- The requested date range must fall entirely within the selected fiscal year's `startDate` to `endDate`.
- If an `accountingPeriodId` is provided, its `startDate` and `endDate` must be within the fiscal year.
- Custom `startDate/endDate` must not cross fiscal year boundaries.

### Only Posted Vouchers

Every report query must filter by:

- `Voucher.status = 'POSTED'`
- `Voucher.isDeleted = false`

No draft or soft-deleted voucher data must appear in any report.

### No Future Unposted Effects

Reports must not include effects from vouchers dated after the report end date. The date filter is the authority; only posted vouchers within the date range contribute to the report.

## Performance Considerations

### Existing Indexes

The Phase 2C schema already includes indexes that support report queries:

- `Voucher`: `@@index([fiscalYearId])`, `@@index([accountingPeriodId])`, `@@index([voucherDate])`, `@@index([status])`, `@@index([voucherType])`.
- `VoucherLine`: `@@index([ledgerAccountId])`, `@@index([projectId])`, `@@index([costCenterId])`, `@@index([cashBankAccountId])`.
- `LedgerAccount`: `@@index` on `accountGroupId` (implicit from foreign key).

These indexes are sufficient for the first report implementation. Reports on a moderate volume of posted vouchers (hundreds to low thousands per period) should perform well with these indexes and aggregation queries.

### Aggregation Query Strategy

Report queries should use Prisma's `aggregate` and `groupBy` capabilities, or raw SQL where Prisma's groupBy is insufficient. For example:

- Trial balance: `groupBy` on `ledgerAccountId` with `SUM(amount)` for debit and credit sides.
- Ledger report: filter by `ledgerAccountId` with ordered results for running balance computation.

### Future Materialized Views

Materialized views or caching may be introduced later only if:

- Report query performance becomes a problem with high transaction volumes.
- The accountant needs near-real-time report refresh during active posting sessions.

For the first implementation, on-demand computation from posted voucher lines is sufficient.

### Opening Balance Computation

Opening balance queries must compute the cumulative balance of all posted lines before the start date. This requires a sum across all prior periods in the fiscal year (or prior fiscal years if opening balances were entered through opening journal vouchers). This can be done with a single aggregate query per ledger account.

## Print/Export Architecture

### Frontend Print First

The first implementation should follow the same browser-print pattern established in Phase 2C:

- Each report page renders a screen view and a hidden `@media print` layout.
- The print layout includes company heading, report title, date range, data table, totals, and footer.
- `window.print()` triggers the browser print dialog.

### PDF/Excel Later Only If Confirmed

PDF generation (e.g., using a library like `pdfkit` or a headless browser) and Excel/CSV export are deferred unless Real Capita confirms these requirements. If confirmed later, the export infrastructure can be added as a separate chunk without changing the report computation logic.

## What Not To Model Yet

Do not model these in the report implementation phase unless the user gives a new explicit instruction:

- `LedgerReport` table (stored report)
- `TrialBalance` table (stored report)
- `CashBookReport` table
- `BankBookReport` table
- `IncomeStatement` table
- `BalanceSheet` table
- `OpeningBalance` table
- `ReportExport` table
- `ReportTemplate` table
- Party/Customer/Vendor aging tables
- Payroll report tables
- Dashboard analytics tables
- Budget/Forecast tables
- Tax/VAT computation tables

## Proposal Status

This proposal is locked for discussion and next-agent orientation only. It becomes implementation scope only after the user confirms the next report implementation phase.
