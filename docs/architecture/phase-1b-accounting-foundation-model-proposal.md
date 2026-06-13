# Phase 1B Accounting Foundation Model Proposal

## Purpose

This is a proposal only. It is not implemented in Prisma, API code, or frontend code during Phase 1B.

The proposal describes the likely Phase 2A accounting foundation model after user confirmation.

## Proposed Entities

Only these entities are proposed for the first accounting foundation implementation:

- Company
- FiscalYear
- AccountingPeriod
- Project
- CostCenter
- AccountClass
- AccountGroup
- LedgerAccount
- CashBankAccount

## Proposed Relationships

### Company

- Company is the top-level profile for the accounting system.
- Fiscal years should belong to a company if multi-company support is later required.
- Phase 2A should likely start with one primary company profile.

### FiscalYear

- FiscalYear belongs to the company context.
- FiscalYear has many AccountingPeriod records.
- Only one FiscalYear should be active initially.

### AccountingPeriod

- AccountingPeriod belongs to FiscalYear.
- Future voucher posting should require an open AccountingPeriod.
- Locked or closed periods should reject future voucher posting.

### Project

- Project represents a Real Capita project for accounting classification.
- Project has many CostCenter records.
- Future voucher lines may optionally or conditionally reference Project depending on the selected LedgerAccount.

### CostCenter

- CostCenter belongs to Project.
- CostCenter supports project-level cost tracking.
- Future voucher lines may reference CostCenter when the selected LedgerAccount requires cost center tracking.

### AccountClass

- AccountClass represents the accounting classes:
  - Asset
  - Liability
  - Equity
  - Income
  - Expense
- AccountClass has many AccountGroup records.

### AccountGroup

- AccountGroup belongs to AccountClass.
- AccountGroup has many LedgerAccount records.
- AccountGroup provides controlled organization for account heads.

### LedgerAccount

- LedgerAccount belongs to AccountGroup.
- LedgerAccount represents the account head future vouchers will post against.
- LedgerAccount should include code, name, normal balance, active status, requires project, requires cost center, and is cash/bank flags.

### CashBankAccount

- CashBankAccount links to one LedgerAccount marked as cash/bank.
- CashBankAccount stores display details for cash or bank accounts.
- CashBankAccount does not create accounting balances by itself.

## Proposed Constraints

- Only one active FiscalYear initially.
- AccountingPeriod date ranges must fit within FiscalYear date ranges.
- AccountingPeriod status values should be open, locked, or closed.
- Project codes should be unique.
- CostCenter codes should be unique within a Project.
- LedgerAccount codes should be unique.
- CashBankAccount must link to a LedgerAccount where `isCashBank` is true.
- Inactive records should not be selectable in future transaction workflows.
- The only active role remains `ACCOUNTANT`.

## What Not To Model Yet

Do not model these in Phase 2A unless the user gives a new explicit instruction:

- Voucher
- VoucherLine
- Party
- Customer
- Vendor
- Payroll
- SalaryRun
- FinancialStatement
- TrialBalance table
- Dashboard analytics
- File attachments
- Additional roles

## Why Voucher Models Are Deferred

Voucher schema will shape the long-term accounting engine. It needs confirmed decisions about:

- Voucher types
- Numbering format
- Approval workflow, if any
- Required project/cost center behavior
- Party/customer/vendor timing
- Attachment requirements
- Posting and reversal rules
- Period lock behavior

Adding vouchers too early would force assumptions into the database and make later corrections expensive.

## Future Voucher Line References

When vouchers are approved in a later phase, future voucher lines will likely reference:

- LedgerAccount as the posting account head
- Project when the selected LedgerAccount requires project tracking
- CostCenter when the selected LedgerAccount requires cost center tracking
- AccountingPeriod through the voucher header or posting date
- CashBankAccount for cash/bank movement workflows when applicable

Ledger and trial balance reports should later derive from posted voucher lines. Do not create a persisted TrialBalance table as the source of truth.

## Proposal Status

This proposal is locked for discussion and next-agent orientation only. It becomes implementation scope only after the user confirms Phase 2A.

