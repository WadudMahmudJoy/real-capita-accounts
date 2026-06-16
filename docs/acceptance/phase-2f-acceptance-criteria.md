# Phase 2F Acceptance Criteria

## Purpose

Phase 2F is a documentation/specification lock for accounting report and accountant UX refinement. It prepares requirements and acceptance criteria for a future implementation phase without changing schema, API, UI business modules, roles, or seed data (except where explicitly justified for Issue A).

## Acceptance Checklist for Phase 2F Documentation

Phase 2F is accepted when:

- `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md` exists and covers all six issues (A through F), confirmed business context, single-role rule, accounting book direction, explicit out-of-scope list, accounting source rule, security rule, and open questions.
- `docs/acceptance/phase-2f-acceptance-criteria.md` exists.
- `docs/plans/phase-2f-accounting-report-ux-refinement-plan.md` exists with implementation chunks, each with objective, scope, files to read, verification, and exact stop condition.
- `AGENTS.md` points future agents to the Phase 2F lock.
- `docs/ai/CURRENT_STATE.md` states that Phase 2F requirement lock is prepared.
- `docs/ai/START_HERE.md` points agents to the Phase 2F docs.
- `docs/handoff.md` records the created Phase 2F files and states that no runtime modules were implemented.
- `README.md` states the current development phase includes the Phase 2F requirement lock.
- `prisma/schema.prisma` is unchanged by Phase 2F documentation lock.
- No report tables, new API endpoints, new frontend pages, new sidebar entries, MFS posting support, PDF/Excel export, or MFS runtime logic were added in the documentation lock phase.
- Phase 2E acceptance state is preserved and documented.
- Verification passes with `pnpm check:all` and `pnpm doctor`.

---

## Acceptance Checklist for Future Balance Sheet P/L Implementation (Issue A)

After explicit user confirmation, the future Balance Sheet P/L implementation is accepted only if:

- Existing voucher posting behavior is preserved. No changes to `VoucherService`, posting validation, or voucher immutability.
- Reports still use POSTED voucher lines only. The Balance Sheet P/L line is computed from posted INCOME and EXPENSE voucher line movements for the same date range.
- Trial Balance remains from posted voucher lines. No changes to Trial Balance computation.
- Cash Book remains CASH-only. No MFS or BANK data leaks into Cash Book.
- Bank Book remains BANK-only. No MFS or CASH data leaks into Bank Book.
- MFS Book remains MFS-only. No CASH or BANK data leaks into MFS Book.
- Balance Sheet management view balances by including current period profit/loss as a report-only equity line:
  - The P/L line is clearly labeled ("Current Period Net Profit" or "Current Period Net Loss").
  - The P/L amount is computed from posted INCOME/EXPENSE movements matching the balance sheet date range.
  - Net loss subtracts from equity; net profit adds to equity.
  - The P/L line is visually distinct from posted equity ledger rows (different styling, not editable).
  - `adjustedTotalEquity` = `equity.total` + `currentPeriodProfitLoss`.
  - `adjustedTotalLiabilitiesAndEquity` = `liabilities.total` + `adjustedTotalEquity`.
  - `adjustedDifference` = `assets.total` - `adjustedTotalLiabilitiesAndEquity`.
  - `isBalancedAdjusted` reflects whether the P/L-adjusted balance sheet balances.
  - The unadjusted totals, difference, and `isBalanced` remain available for audit transparency.
- No Prisma schema change for the P/L line (no fake ledger rows, no stored P/L table).
- No migration for the P/L line.
- No report tables added.
- The backend `getBalanceSheet` response includes P/L fields without breaking existing API contract (existing fields remain unchanged; new fields are additive).
- The frontend Balance Sheet page renders the P/L line under Equity, shows the adjusted balance status, and preserves the unadjusted view for transparency.
- The print layout includes the P/L line and the adjusted totals.
- ACCOUNTANT-only scope remains. No new roles.

---

## Acceptance Checklist for Future Report/Table Layout Implementation (Issue B)

After explicit user confirmation, the future layout implementation is accepted only if:

- Report and voucher list pages use wider viewport width. Tables do not require horizontal scroll at 100% zoom on a 1280px+ screen for the primary columns (Date, Voucher No, Particulars/Narration, Debit, Credit, Balance).
- Setup pages (Company, Fiscal Years, Accounting Periods, Projects, Cost Centers, Account Classes, Account Groups, Ledger Accounts, Cash/Bank/MFS) retain their current layout width.
- The sidebar, header, and app shell remain unchanged.
- Table layout follows textbook-style accounting conventions where suitable:
  - Ledger Statement: Date | Voucher No | Particulars | Debit | Credit | Balance (Dr/Cr).
  - Cash/Bank/MFS Book: Date | Voucher No | Narration | Receipt | Payment | Balance.
  - Trial Balance: six-column format (Opening Dr/Cr, Period Dr/Cr, Closing Dr/Cr).
- Less critical columns (Project, Cost Center, Opposite Accounts, Cash/Bank Account in some views) are handled via expandable rows, tooltips, or collapsible sections rather than forced into the primary table width.
- No PDF/Excel export is added.
- No report tables or schema changes.

---

## Acceptance Checklist for Future Voucher Line Dynamic Field Visibility (Issue C)

After explicit user confirmation, the future voucher line visibility implementation is accepted only if:

- Ledger accounts with `requiresProject = true` show the Project field as required (visual marker, not just hint text).
- Ledger accounts with `requiresProject = false` either hide the Project field or collapse it into an optional/advanced section.
- Ledger accounts with `requiresCostCenter = true` show the Cost Center field as required.
- Ledger accounts with `requiresCostCenter = false` either hide the Cost Center field or collapse it.
- Cash/Bank/MFS-eligible ledger accounts (`isCashBank = true`) show the Cash/Bank/MFS account field with an appropriate label (e.g., "Cash account" for CASH ledgers, "Bank account" for BANK, "MFS account" for MFS).
- Non-cash/bank/MFS ledgers (`isCashBank = false`) do not show any Cash/Bank/MFS account field.
- Backend validation remains the authority. Frontend changes are UX improvements only; they do not relax or tighten backend validation rules.
- The Cost Center dropdown continues to scope to the selected Project.
- Draft vouchers can still be saved with missing optional fields. Posting validation continues to enforce `requiresProject`, `requiresCostCenter`, and `isCashBank` rules at the backend level.
- Existing voucher posting behavior is unchanged.

---

## Acceptance Checklist for Future Report Filter UX Clarity (Issue D)

After explicit user confirmation, the future filter UX implementation is accepted only if:

- Cash Book, Bank Book, and MFS Book filter panels clearly distinguish voucher-line-level Project/Cost Center filters from account-level filters, either by:
  - Moving Project/Cost Center into an "Advanced filters" collapsible area, OR
  - Labeling them clearly (e.g., "Voucher line project", "Voucher line cost center") and documenting the backend behavior.
- The backend behavior for Project/Cost Center filtering in Cash/Bank/MFS Book is verified and documented before frontend labels are finalized.
- Ledger Statement, Trial Balance, Income Statement, and Balance Sheet filter panels remain unchanged (Project/Cost Center filters are appropriate for cross-account reports).
- No backend API changes for filter behavior (unless the verified behavior reveals an inconsistency that needs fixing, which would be a separate decision).

---

## Acceptance Checklist for Future Dropdown/Table Text Clipping Fix (Issue E)

After explicit user confirmation, the future clipping fix implementation is accepted only if:

- Fiscal year dropdown labels show the full name and date range without clipping at reasonable widths (300px+).
- Accounting period dropdown labels show the full name, date range, and status without clipping.
- Long labels use concise date formatting (e.g., "Jul 2025 - Jun 2026" instead of "2025-07-01 to 2026-06-30") where appropriate.
- Table cells with long text (narration, opposite accounts) use truncation with title/tooltip so the full text is accessible on hover.
- Dropdown and table widths are appropriate for the data they display.
- No functionality is lost; only presentation is improved.

---

## Acceptance Checklist for Demo/Test Data Cleanliness Planning (Issue F)

After explicit user confirmation, the demo data planning is accepted only if:

- A clean demo data strategy or plan is documented.
- The plan includes recommendations for: demo data scope, cleanup command approach, representative sample data for Real Capita's business, and data reset approach.
- No seed data scripts are implemented in Phase 2F documentation lock (only planning/documentation).
- Demo data must never include real employee names, real passwords, real wallet numbers, real transaction amounts, or private business data.

---

## Regression Criteria

All existing acceptance criteria from Phase 2D, 2C, 2A, and 1A continue to pass after Phase 2F implementation:

- All six backend report endpoints return correct results.
- All seven frontend report pages render correctly (Ledger, Cash Book, Bank Book, MFS Book, Trial Balance, Income Statement, Balance Sheet).
- Voucher create, post, and print functionality works unchanged.
- Cash Book shows only CASH transactions.
- Bank Book shows only BANK transactions.
- MFS Book shows only MFS transactions.
- Trial Balance total debits equal total credits.
- Income Statement net profit calculation is correct.
- Balance Sheet balance check (both unadjusted and P/L-adjusted) is correct.
- MFS account setup and MFS Book page work unchanged.
- Voucher posting rejects MFS cash-bank accounts (MFS posting remains deferred).

---

## Explicit Non-Acceptance Conditions

Phase 2F requirement lock and future implementation are NOT accepted if:

- MFS is forced under BANK or CASH account type.
- Cash Book or Bank Book shows MFS transactions.
- MFS voucher posting support is added without explicit approval.
- New roles are introduced.
- PDF/Excel export is added.
- Dashboard analytics are added.
- Party/customer/vendor module is added.
- Closing-entry automation is added.
- The P/L line is stored as a fake editable ledger row rather than a report-side computation.
- The Balance Sheet P/L computation uses DRAFT or soft-deleted vouchers.
- Existing report API contracts are broken (existing response fields must remain; new P/L fields are additive only).
- Prisma schema is changed without explicit justification.
- A migration is created without explicit justification.
- Report tables are added to the Prisma schema.
- Direct posted voucher editing is enabled.
- Business seed data containing real passwords, real wallet numbers, or private business data is added.

---

## Verification Commands

Run these commands for Phase 2F documentation lock:

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
git log --oneline --max-count=10
```

No migration should be run for Phase 2F documentation lock because no schema change is made.
