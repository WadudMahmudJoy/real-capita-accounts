# Phase 2F: Accounting Report + Accountant UX Refinement Requirement Lock

## Purpose

Phase 2F locks the requirements for Balance Sheet current-period profit/loss inclusion, report/table layout readability improvements, voucher line dynamic field visibility, report filter UX clarity, dropdown/table text clipping fixes, and demo/test data cleanliness planning, before any implementation begins.

This document exists so the next agent or developer can continue from repository context alone, without relying on hidden chat memory.

## Current Status

**Requirement lock only. Not implemented.** No schema, migration, backend API, frontend page, seed data, or runtime behavior changes have been made for any Phase 2F issue. This document is a specification lock only.

## A. Confirmed Business Context

- Phase 2E MFS account setup and MFS Book foundation are accepted at commit `cb6e302`.
- Phase 2D accounting reports are accepted at commit `be482c2`.
- Phase 2C voucher engine is accepted.
- Phase 2A accounting foundation is accepted.
- Only the `ACCOUNTANT` role is confirmed. Other roles are deferred until Real Capita confirms exact office responsibilities.
- Reports derive from posted `VoucherLine` rows only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`). No primary report tables.
- During accountant self-testing, the voucher → ledger → cash book → trial balance flow was verified with realistic Real Capita examples:
  1. Capital introduced as Office Cash: 100,000 BDT
  2. Cash paid for Shanti Kutir land development: 50,000 BDT
  3. Cash Book showed receipt/payment correctly
  4. Ledger Statement showed Land Development Expense correctly
  5. Trial Balance balanced correctly
  6. Income Statement showed 50,000 net loss correctly
  7. Balance Sheet did not balance because current period loss was not included in equity

### Confirmed Single-Role Rule

The only active role is:

- `ACCOUNTANT`, displayed as `Accountant`

Do not implement, seed, display, or model Admin, Super Admin, Data Entry, Checker, MD Viewer, HR, Sales, Payroll, Viewer, Manager, or any other role in Phase 2F.

### Accounting Book Direction

AGM sir was formerly a professor and is familiar with textbook-style accounting tables. Where suitable, report and table presentation should be closer to familiar textbook-style accounting tables (T-accounts, debit/credit columnar layout, clear grouping and indentation) rather than generic web dashboard layouts.

## B. Phase 2F Scope

Phase 2F is a documentation/specification lock only.

Phase 2F does not include:

- Database schema changes (unless explicitly justified in the plan)
- Prisma model additions or enum changes
- New API business endpoints
- New frontend business pages or sidebar entries
- Business seed data changes
- Additional roles
- Runtime code changes
- Report table additions
- MFS voucher posting support

## What Phase 2F Is

Phase 2F defines six specific issues to be fixed in the next implementation phase:

1. Balance Sheet current-period profit/loss inclusion in equity
2. Report/table layout readability
3. Voucher line dynamic field visibility
4. Cash/Bank/MFS report filter UX clarity
5. Dropdown/table text clipping
6. Demo/test data cleanliness

## What Phase 2F Is Not

Phase 2F is not a coding phase. It must not add report tables, MFS posting, new roles, PDF/Excel export, dashboard analytics, party modules, payroll, or any other feature outside the six locked issues.

---

## C. Issue A: Balance Sheet Current-Period Profit/Loss Handling

### Problem

The current Balance Sheet backend (`getBalanceSheet`) uses posted Asset, Liability, and Equity ledger balances only. It does not include current-period profit or loss in the Equity section.

After testing with:
- Capital introduced as Office Cash: 100,000 BDT (equity credit)
- Cash paid for Shanti Kutir land development: 50,000 BDT (expense debit, cash credit)

The Balance Sheet reports:
- Total Assets: 50,000 (Office Cash debit balance)
- Total Equity: 100,000 (Capital credit balance)
- Total Liabilities: 0
- Difference: -50,000 (not balanced)

The Trial Balance is balanced (debit 100,000, credit 100,000), so this is a report-design/accounting-statement issue, not a voucher-posting failure.

### Root Cause

In real accounting, the Balance Sheet for management reporting should include current-period net profit/loss as a line under Equity. Without closing entries (which Real Capita has not posted), the Income and Expense movements are missing from the Equity side. The current implementation reports this honestly as an unbalanced balance sheet with a visible difference, which is technically correct for a "no closing entries" situation, but confusing for the accountant who expects the balance sheet to balance for management reporting purposes.

### Requirement

The Balance Sheet must include a clearly labeled **Current Period Profit/Loss** line under the Equity section for management reporting:

- If net loss: subtract from equity. The line label should say "Current Period Net Loss" and the amount should reduce total equity.
- If net profit: add to equity. The line label should say "Current Period Net Profit" and the amount should increase total equity.
- If net income is zero: the line may be omitted or shown as zero.
- This line must be a **report-only computation**, not a fake editable ledger row.
- Source must remain posted voucher lines only. The backend must compute net income from posted INCOME and EXPENSE movements for the same date range as the balance sheet query, then include it in the Equity total.
- The backend must still report `isBalanced` honestly. When current P/L is included, the balance sheet should balance for normal management reporting scenarios (Assets = Liabilities + Equity including P/L).
- The existing difference computation should remain visible as an "Unadjusted difference" or similar label for audit transparency, but the primary view should show the adjusted (P/L included) balance.
- No closing-entry automation. Closing entries remain a future decision for Real Capita. The current P/L line is a report-side calculation only.

### Accounting Principle

This follows the standard management-reporting practice where the balance sheet includes current P/L in equity until formal closing entries are posted at year-end. In textbook accounting, the balance sheet equation is:

> Assets = Liabilities + (Capital + Current Period Profit - Current Period Loss)

The current implementation omits the "Current Period Profit - Current Period Loss" portion, causing an apparent imbalance.

### Frontend Impact

- The Balance Sheet page must show the "Current Period Profit/Loss" line under Equity, clearly separated from posted equity ledger rows.
- The summary grid must show both "Total equity (ledger only)" and "Total equity (including P/L)" or a similar distinction.
- The balance status notice must reflect the P/L-adjusted check.
- The print layout must include the P/L line.
- The existing "not balanced" warning text should be updated to explain that without closing entries, the P/L-adjusted view is the management reporting view.

### Backend Impact

- The `getBalanceSheet` method in `report.service.ts` must compute net income from posted INCOME and EXPENSE voucher lines for the same fiscal year/date range.
- The response type must include P/L information: `currentPeriodProfitLoss`, `currentPeriodPLLabel`, `adjustedTotalEquity`, `adjustedTotalLiabilitiesAndEquity`, `adjustedDifference`, `isBalancedAdjusted`.
- The existing unadjusted totals and difference should remain for audit transparency.
- No new ledger rows, no new Prisma model, no migration, no report tables.

### API Response Shape Change

The `BalanceSheetReport` type should gain:

| Field | Type | Description |
| --- | --- | --- |
| `currentPeriodProfitLoss` | `string` (money) | Net income amount from posted INCOME/EXPENSE movements for the balance sheet date range. Positive for profit, negative for loss. |
| `currentPeriodPLLabel` | `string` | "Current Period Net Profit" or "Current Period Net Loss" depending on sign. |
| `currentPeriodPLIsProfit` | `boolean` | `true` when net income >= 0, `false` when net income < 0. |
| `adjustedTotalEquity` | `string` (money) | Total equity (ledger only) + current P/L. |
| `adjustedTotalLiabilitiesAndEquity` | `string` (money) | Total liabilities + adjusted total equity. |
| `adjustedDifference` | `string` (money) | Total assets - adjusted total liabilities and equity. |
| `isBalancedAdjusted` | `boolean` | Whether the P/L-adjusted balance sheet balances. |

The existing `equity`, `totalLiabilitiesAndEquity`, `difference`, and `isBalanced` fields remain unchanged (they show the unadjusted/ledger-only view).

---

## D. Issue B: Report/Table Layout Readability

### Problem

Voucher list, Cash Book, Ledger Statement, Trial Balance, and other report pages use horizontal scroll even at 100% browser scaling, while left/right page whitespace remains. The current app layout uses `max-w-7xl` with side padding, which constrains the table area to roughly 780px when the 240px sidebar is present. Report tables with important columns (Date, Voucher No, Particulars/Narration, Debit, Credit, Balance) exceed this width and require scrolling.

### Requirement

Accounting/report pages should prioritize table visibility over centered narrow layout:

- Use wider available viewport for report and voucher list pages.
- Important columns should be visible where practical: Date, Voucher No, Particulars/Narration, Debit, Credit, Balance.
- Consider textbook-style accounting table layout: clear column headers, appropriate column widths, debit/credit columns side by side, running balance column, group subtotals with visual hierarchy.
- Tables should not require horizontal scroll at 100% zoom on a standard 1280px+ screen for the most important columns.
- Less critical columns (Project code, Cost Center code, Opposite Accounts, Cash/Bank Account) can be hidden by default or moved to expandable rows, tooltips, or a secondary section.
- The sidebar and header area remain as-is. Only the main content area width should increase for report/voucher pages.
- Voucher list page (`/app/vouchers`) should also benefit from wider layout.
- No PDF/Excel export in this phase.

### Layout Approach

The current app layout in `apps/web/src/app/app/layout.tsx` uses:

```
<div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-8">
  <div className="grid flex-1 gap-8 py-6 lg:grid-cols-[240px_1fr]">
```

For report and voucher list pages, the main content area should use more of the viewport width. Options:

1. Remove `max-w-7xl` constraint and use `w-full` for the entire layout so reports use the full viewport.
2. Keep `max-w-7xl` for setup pages but allow report/voucher pages to extend wider.
3. Use a conditional layout class based on the route context.

The chosen approach should preserve the sidebar, header, and overall app shell while giving report tables more horizontal space.

### Table Layout Approach

Report tables should follow textbook-style conventions where suitable:

- **Ledger Statement**: Date | Voucher No | Particulars | Debit | Credit | Balance (Dr/Cr). This mirrors the classic ledger T-account columnar format.
- **Cash Book / Bank Book / MFS Book**: Date | Voucher No | Narration | Receipt (Debit) | Payment (Credit) | Balance. This mirrors the classic cash book single-column or two-column format.
- **Trial Balance**: Ledger Account | Opening Dr | Opening Cr | Period Dr | Period Cr | Closing Dr | Closing Cr. This mirrors the classic trial balance six-column format.
- **Income Statement**: Grouped by Income and Expense sections with subtotals, matching textbook income statement format.
- **Balance Sheet**: Grouped by Assets, Liabilities, Equity with subtotals, matching textbook balance sheet format with current P/L line under Equity.

Column widths should prioritize: Date (narrow), Voucher No (medium), Particulars/Narration (wide), Debit/Credit/Balance (right-aligned, narrow-medium).

---

## E. Issue C: Voucher Line Dynamic Field Visibility

### Problem

The voucher line form (`VoucherForm.tsx`) currently shows Project, Cost Center, and Cash/Bank fields generically for every line, regardless of whether the selected ledger account requires them. The current behavior:

- Project and Cost Center dropdowns appear on every line with labels "Project" and "Cost center" and default value "None".
- Cash/Bank account dropdown appears only when `ledger.isCashBank` is true.
- Small hints like "Project recommended" and "Cost center recommended" appear based on `requiresProject` and `requiresCostCenter` flags, but the fields are still optional-looking.

### Requirement

Improve accountant clarity with dynamic field visibility:

- **Ledgers requiring project** (`requiresProject = true`): Show the Project field as required (red asterisk or "Required" label). Hide or collapse it for ledger accounts where `requiresProject = false`.
- **Ledgers requiring cost center** (`requiresCostCenter = true`): Show the Cost Center field as required. Hide or collapse it for ledger accounts where `requiresCostCenter = false`.
- **Cash/Bank/MFS eligible ledger** (`isCashBank = true`): Show the Cash/Bank/MFS account field with a label matching the account type (e.g., "Cash account" for CASH ledgers, "Bank account" for BANK ledgers, "MFS account" for MFS ledgers). The dropdown should only show accounts linked to the selected ledger.
- **Non-cash/bank/MFS ledgers** (`isCashBank = false`): Do not show any cash/bank/MFS account field. The current behavior of hiding it when `isCashBank` is false should be preserved and is already correct.
- **Optional advanced fields** that appear for non-required ledgers (like Project/Cost Center when not required): If retained, must be clearly labeled as optional or collapsed into an "Advanced" or "More details" expandable area so they do not clutter the primary form view.
- Backend validation remains the authority. Frontend visibility changes are UX improvements only; they do not change what the backend accepts or rejects.

### Implementation Approach

When a ledger account is selected on a voucher line:

1. If `requiresProject = true`: Show Project field with required marker.
2. If `requiresProject = false`: Hide Project field, or collapse it into an optional section.
3. If `requiresCostCenter = true`: Show Cost Center field with required marker.
4. If `requiresCostCenter = false`: Hide Cost Center field, or collapse it.
5. If `isCashBank = true`: Show Cash/Bank/MFS account field (scoped to accounts linked to this ledger). The label should reflect the account type.
6. If `isCashBank = false`: No cash/bank/MFS field appears.

The Project dropdown should scope cost center options to the selected project, preserving the existing behavior.

---

## F. Issue D: Cash/Bank/MFS Report Filters UX

### Problem

Cash Book, Bank Book, and MFS Book show Project and Cost Center filters in the main filter panel even when a cash/bank/MFS account is already selected. These filters check voucher-line-level project/cost center data, but their placement suggests they might filter at a higher level, which can confuse the accountant.

### Requirement

- Either move Project/Cost Center into an "Advanced filters" collapsible area, or clearly label them as "Voucher line project" / "Voucher line cost center" to distinguish them from account-level filters.
- Verify implementation behavior before coding: confirm whether the backend filter checks the cash/bank line's project/cost center, or the opposite (non-cash/bank) line's project/cost center, or both. The current backend implementation should be inspected and documented so the frontend filter labels match the actual behavior.
- Ledger Statement already requires a ledger account and shows Project/Cost Center filters; this is appropriate and should remain unchanged.
- Trial Balance shows Project/Cost Center filters; these are appropriate for a cross-account report and should remain unchanged.
- Income Statement and Balance Sheet show Project/Cost Center filters; these are appropriate and should remain unchanged.

### Backend Verification Needed

Before implementing the frontend label changes, the implementation plan should verify:

- In Cash Book/Bank Book/MFS Book, when `projectId` or `costCenterId` is provided in the query, which voucher line(s) does the backend filter against? Is it the cash/bank/MFS line, the opposite account line, or any line in the voucher?
- Document the answer so the frontend filter labels can be made accurate.

---

## G. Issue E: Dropdown/Table Text Clipping

### Problem

Fiscal year and accounting period dropdown labels can be clipped because the dropdown width is constrained. Labels like "FY 2025-26 (2025-07-01 to 2026-06-30)" are long and get cut off.

### Requirement

- Avoid hiding important date ranges in dropdown labels.
- Use wider dropdowns where practical, or use tooltip/title attributes on `<option>` elements and `<select>` elements so the full label is visible on hover.
- Use compact label design where the date range is formatted more concisely (e.g., "FY 2025-26 (Jul 2025 - Jun 2026)" instead of full ISO dates).
- Table cells that contain long text (narration, opposite accounts) should use truncation with title/tooltip rather than hiding text entirely.
- Dropdown widths should accommodate at least 300px for filter panels.

---

## H. Issue F: Demo/Test Data Cleanliness

### Problem

Smoke-test rows, duplicate-looking voucher numbers, and test data from development sessions confuse accountant testing and AGM demo presentations. The seed data and database can accumulate ad-hoc test rows that make the production-like flow harder to demonstrate cleanly.

### Requirement

- Plan a clean demo data strategy or cleanup script for future implementation.
- Do not implement seed reset in this lock phase unless only documentation.
- Consider: a `pnpm seed:clean` or `pnpm seed:demo` command that resets to a known clean state with representative Real Capita sample data.
- The demo data set should include: one company, one fiscal year, a few accounting periods, realistic projects and cost centers, representative ledger accounts for Real Capita's business (capital, cash, bank, MFS, land development expense, project expenses), and a few sample posted vouchers that demonstrate the full accounting cycle (capital introduction, expense payment, transfer).
- Demo data must never include real employee names, real passwords, real wallet numbers, real transaction amounts, or private business data.
- This issue is primarily documentation/planning in Phase 2F. Implementation of demo data scripts is a future chunk.

---

## I. Explicit Out-of-Scope List

Phase 2F does NOT include:

- New roles beyond ACCOUNTANT
- Party/customer/vendor module
- Payroll/salary module
- File attachments
- Project Summary or Cost Center Summary implementation
- MFS voucher posting support
- PDF/Excel export
- Dashboard analytics
- Provider API integration (bKash API, Nagad API, etc.)
- Old ERP copy/paste
- Editable ledger/report tables in the Prisma schema
- Direct posted voucher editing
- Closing-entry automation
- Approval workflow
- Business seed data (beyond demo data strategy documentation)
- Multi-currency support
- Localization/translation

---

## J. Accounting Source Rule (Preserved)

All report computations must continue to derive from posted `VoucherLine` rows only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`).

- DRAFT vouchers must not affect reports.
- Soft-deleted vouchers must not affect reports.
- No editable report rows.
- No primary report tables in the Prisma schema.
- The current P/L line on the Balance Sheet is a report-side computation from posted INCOME/EXPENSE voucher lines, not a stored ledger row.

---

## K. Security Rule (Preserved)

- HttpOnly cookie-based JWT/session authentication continues.
- No auth tokens in localStorage.
- Cookies: `SameSite=Lax`, `Secure` only in production.
- Password hashing continues.
- Backend guards and role checks remain the authority.
- No real passwords, salaries, employee data, customer data, voucher amounts, or private business data in seed data or documentation.

---

## L. Open Questions for Real Capita Confirmation

1. Should the Balance Sheet show both the unadjusted (ledger-only) and P/L-adjusted views, or only the P/L-adjusted view?
2. Should closing entries be automated at year-end, or remain manual? (Phase 2F does not implement either; this question is for future planning.)
3. Which columns are most important for the accountant in each report table? The requirement lock proposes a priority ordering but Real Capita should confirm.
4. Should optional voucher line fields (Project, Cost Center for non-required ledgers) be completely hidden or collapsed into an expandable section?
5. Should demo data include sample posted vouchers, or should the accountant create them during demo/testing?

These questions should be resolved before implementation begins. If not resolved, the implementation plan should choose a sensible default and note it as provisional.
