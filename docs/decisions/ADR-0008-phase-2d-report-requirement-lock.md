# ADR-0008: Phase 2D Accounting Report Requirement Lock

## Status

Accepted

## Context

Phase 2C voucher engine is complete and accepted. Vouchers can be created as drafts, posted with full debit/credit validation, and printed. Posted vouchers are immutable and auditable. Draft and soft-deleted vouchers do not affect accounting data.

The accountant now has a working voucher entry and posting workflow, but no way to view aggregated financial reports. Without reports, the posted voucher lines exist as raw transaction records that cannot be viewed as ledger movements, trial balances, cash/bank books, or financial statements.

The system needs accounting reports that derive from posted voucher data, but these must be specified and locked before implementation begins, following the same doc-first pattern used in Phase 1B (accounting foundation lock) and Phase 2B (voucher requirement lock).

## Decision

1. **Lock accounting report requirements before implementation.** Phase 2D is documentation/specification only. No schema changes, API endpoints, frontend pages, or runtime logic will be added until the user explicitly confirms the next implementation phase.

2. **Reports derive from posted VoucherLine records.** All accounting reports compute their data from posted `Voucher` and `VoucherLine` records, filtered by `status = POSTED` and `isDeleted = false`. Draft and soft-deleted vouchers do not affect any report.

3. **No report tables as primary source.** Reports are not stored as separate primary manual tables (no LedgerReport, TrialBalance, CashBook, BankBook, IncomeStatement, or BalanceSheet tables). The posted `VoucherLine` records are the single source of truth. Reports may be computed on demand, and caching/materialized views may be introduced later only if performance requires it.

4. **Eight reports defined for the first implementation:** General Ledger, Cash Book, Bank Book, Trial Balance, Income Statement, Balance Sheet, Project Summary, and Cost Center Summary.

5. **Opening balances through opening journal vouchers.** No separate `OpeningBalance` table is recommended for the first implementation. Opening balances should be entered through regular posted vouchers (opening journal vouchers), which follow the same validation and audit rules.

6. **Browser print foundation for reports.** The first implementation provides browser-based print for all reports (same pattern as Phase 2C voucher print). PDF and Excel export are deferred unless separately confirmed.

7. **ACCOUNTANT role only for report access.** Only the `ACCOUNTANT` role can access report endpoints and pages in the current phase. A future Viewer/Manager role for read-only report access may be added when Real Capita confirms.

## Consequences

### Positive

- Report requirements are documented and reviewed before any code is written, reducing the risk of incorrect formulas or missing validation.
- The doc-first pattern is consistent with Phase 1B and Phase 2B, keeping the project understandable from source control alone.
- Reports deriving from posted voucher lines ensure a single source of truth and eliminate dual-source divergence risks.
- Opening journal vouchers reuse the existing voucher infrastructure instead of adding a separate opening-balance system.

### Negative

- Report computation on demand may be slower than pre-computed stored reports for very high transaction volumes. This can be addressed later with caching or materialized views.
- Opening balances must be entered through vouchers, which requires the accountant to create opening journal entries manually. A future migration/import tool could automate this.
- Browser print may not meet all formatting expectations. PDF and Excel export are deferred.

### Risks

- If report formulas are incorrect in the requirement lock, the implementation will inherit those errors. The requirement lock must be reviewed carefully by the user before implementation begins.
- If Real Capita requires comparative reports (current vs prior period) in the first implementation, the requirement lock needs to be updated before coding starts.

## Out-of-Scope

- Dashboard analytics or charts.
- Payroll or salary reports.
- Party, customer, or vendor aging reports.
- Inventory reports.
- Tax/VAT reports.
- File uploads.
- Additional roles.
- PDF or Excel export infrastructure.
- Separate opening-balance tables.
- Budget or forecast reports.
- Comparative period reports (unless added to the requirement lock before implementation).
- Code copied from the old ERP prototype.
