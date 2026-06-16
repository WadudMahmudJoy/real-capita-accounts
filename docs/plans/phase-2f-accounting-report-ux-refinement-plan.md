# Phase 2F: Accounting Report + Accountant UX Refinement Implementation Plan

## Purpose

Phase 2F plans the implementation of six specific UX and report-refinement issues based on the Phase 2F requirement lock. This document splits the implementation into safe, reviewable chunks so each step can be verified before the next begins.

This is a planning document only. It does not change schema, API, frontend, roles, seed data, or any runtime behavior.

## Prerequisite

Phase 2F requirement lock is complete and accepted. The following docs define what Phase 2F must implement:

- `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md`
- `docs/acceptance/phase-2f-acceptance-criteria.md`

Phase 2F must not add anything beyond what is locked in those documents.

## Confirmed Constraints

- Only `ACCOUNTANT` role exists. No additional roles.
- No dashboard analytics, no payroll, no parties/customers/vendors.
- No file uploads, no business seed data (except Issue F documentation), no approval workflow.
- No report tables as primary source; all reports derive from posted VoucherLine records.
- No PDF or Excel export. Browser print foundation continues.
- No MFS voucher posting support.
- No closing-entry automation.
- Cash Book remains CASH-only. Bank Book remains BANK-only. MFS Book remains MFS-only.
- The P/L line on the Balance Sheet is a report-side computation, not a stored ledger row.
- AGM sir prefers textbook-style accounting table presentation where suitable.

---

## Chunk Overview

| Chunk | Objective | Risk Level |
| --- | --- | --- |
| 2F-1 | Phase 2F requirement lock review | Low |
| 2F-2 | Backend Balance Sheet current P/L computation and API response extension | Medium |
| 2F-3 | Frontend Balance Sheet P/L display, adjusted balance status, and print layout | Medium |
| 2F-4 | Report/table layout widening and textbook-style column improvements | Medium |
| 2F-5 | Voucher line dynamic field visibility (required/optional/hidden) | Medium |
| 2F-6 | Report filter UX clarity and dropdown/table text clipping fixes | Low |
| 2F-7 | Final integration and acceptance review | Low |

---

## Chunk 2F-1: Phase 2F Requirement Lock Review

### Objective

Review the Phase 2F documentation for consistency with the Phase 2E accepted state, Phase 2D posted voucher workflow, Phase 2C voucher engine, and Phase 2A accounting foundation. Confirm the requirement lock is accurate and complete before implementation begins.

### Scope

Documentation review only. No code changes.

### Files to Read

- `docs/requirements/phase-2f-accounting-report-ux-refinement-requirement-lock.md`
- `docs/acceptance/phase-2f-acceptance-criteria.md`
- `docs/plans/phase-2f-accounting-report-ux-refinement-plan.md`
- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`
- `docs/acceptance/phase-2e-acceptance-criteria.md`
- `docs/requirements/phase-2d-accounting-reports-requirement-lock.md`
- `docs/acceptance/phase-2d-acceptance-criteria.md`
- `AGENTS.md`
- `apps/api/src/report/report.service.ts` (verify current Balance Sheet behavior)
- `apps/api/src/report/dto/report-query.dto.ts`
- `apps/web/src/app/app/reports/balance-sheet/page.tsx`
- `apps/web/src/app/app/layout.tsx` (verify layout width constraint)

### Verification

- `pnpm prisma:generate`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm build:api`
- `pnpm check:all`
- `pnpm doctor`
- `git status --short --branch` must be clean

### Stop Condition

All review goals pass. No stale references or contradictions found. `pnpm check:all` and `pnpm doctor` pass. Docs updated to reflect review completion.

---

## Chunk 2F-2: Backend Balance Sheet Current P/L Computation and API Response Extension

### Objective

Extend the existing `getBalanceSheet` method to compute current-period net profit/loss from posted INCOME and EXPENSE voucher lines and include it as additive fields in the API response, without breaking the existing response contract.

### Scope

Backend only. No frontend, no schema, no migration.

### Files to Read/Modify

- `apps/api/src/report/report.service.ts` — extend `getBalanceSheet` to compute P/L
- `apps/api/src/report/dto/report-query.dto.ts` — verify no changes needed
- `apps/web/src/lib/api.ts` — will need type updates in 2F-3, not this chunk

### Implementation Approach

1. In `getBalanceSheet`, after computing the existing ASSET/LIABILITY/EQUITY rows:
   - Query posted voucher lines for INCOME and EXPENSE account classes within the same date range (fiscal year start through `asOfDate`).
   - Compute net income: sum INCOME movements (credit - debit) + sum EXPENSE movements (debit - credit). This matches the Income Statement formula.
   - If net income >= 0: `currentPeriodPLLabel = "Current Period Net Profit"`, `currentPeriodPLIsProfit = true`.
   - If net income < 0: `currentPeriodPLLabel = "Current Period Net Loss"`, `currentPeriodPLIsProfit = false`.
   - `currentPeriodProfitLoss` = absolute amount as money string.
   - `adjustedTotalEquity` = `totalEquity` + `currentPeriodProfitLoss` (signed: add profit, subtract loss).
   - `adjustedTotalLiabilitiesAndEquity` = `totalLiabilities` + `adjustedTotalEquity`.
   - `adjustedDifference` = `totalAssets` - `adjustedTotalLiabilitiesAndEquity`.
   - `isBalancedAdjusted` = `adjustedDifference.equals(ZERO)`.
2. Add these seven fields to the return object alongside the existing fields.
3. The existing `equity`, `totalLiabilitiesAndEquity`, `difference`, and `isBalanced` remain unchanged (unadjusted/ledger-only view).

### No Schema/Migration Changes

This chunk does not add Prisma models, enums, or migrations. The P/L line is computed on demand from posted voucher lines.

### Verification

- `pnpm prisma:generate`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:api`
- `pnpm check:all`
- Manual API smoke test: call `GET /reports/balance-sheet` with a fiscal year that has posted INCOME/EXPENSE vouchers. Verify:
  - Existing fields are unchanged.
  - New P/L fields are present with correct values.
  - `isBalancedAdjusted` is true when Assets = Liabilities + Equity including P/L.
  - `isBalanced` (unadjusted) may be false when closing entries are not posted.
  - Cash Book, Bank Book, MFS Book, Trial Balance, Income Statement still return correct results.

### Stop Condition

Backend Balance Sheet returns P/L fields. Existing API contract is preserved. All other report endpoints return correct results. `pnpm check:all` and `pnpm doctor` pass.

---

## Chunk 2F-3: Frontend Balance Sheet P/L Display, Adjusted Balance Status, and Print Layout

### Objective

Update the Balance Sheet frontend page to display the current period profit/loss line, adjusted totals, and updated balance status notice. Update the print layout. Update the `api.ts` types.

### Scope

Frontend only. No backend, no schema, no migration.

### Files to Read/Modify

- `apps/web/src/lib/api.ts` — add P/L fields to `BalanceSheetReport` type
- `apps/web/src/app/app/reports/balance-sheet/page.tsx` — display P/L line, adjusted totals, updated notice
- `apps/web/src/app/app/reports/_lib/report-print.tsx` or the balance sheet print component — include P/L line and adjusted totals in print layout

### Implementation Approach

1. Add to `BalanceSheetReport` type in `api.ts`:
   - `currentPeriodProfitLoss: string`
   - `currentPeriodPLLabel: string`
   - `currentPeriodPLIsProfit: boolean`
   - `adjustedTotalEquity: string`
   - `adjustedTotalLiabilitiesAndEquity: string`
   - `adjustedDifference: string`
   - `isBalancedAdjusted: boolean`

2. In the Balance Sheet page:
   - After the Equity section table, add a clearly styled P/L row:
     - Different background or border style to distinguish from posted ledger rows.
     - Label: `currentPeriodPLLabel` (e.g., "Current Period Net Loss").
     - Amount: `currentPeriodProfitLoss`.
   - Update the summary grid to show both:
     - "Total equity (ledger)" = `equity.total`
     - "Total equity (incl. P/L)" = `adjustedTotalEquity`
   - Update the balance status notice:
     - If `isBalancedAdjusted`: show success notice "The management balance sheet is balanced (including current period profit/loss)."
     - If not balanced adjusted: show the reason.
     - If `isBalanced` (unadjusted) differs from `isBalancedAdjusted`: show an informational note about the unadjusted difference.
   - Update the print layout to include the P/L line and adjusted totals.

### Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm check:all`
- Manual browser smoke test:
  - Load Balance Sheet page with a fiscal year that has posted vouchers with P/L impact.
  - Verify P/L line appears under Equity with correct label and amount.
  - Verify adjusted totals are correct.
  - Verify balance notice reflects P/L-adjusted view.
  - Verify print layout includes P/L line.
  - Verify other report pages are unchanged.

### Stop Condition

Balance Sheet page renders P/L line, adjusted totals, and updated notice. Print layout includes P/L line. Other pages unchanged. `pnpm check:all` and `pnpm doctor` pass.

---

## Chunk 2F-4: Report/Table Layout Widening and Textbook-Style Column Improvements

### Objective

Widen the main content area for report and voucher list pages so important columns are visible without horizontal scroll. Apply textbook-style accounting table column conventions where suitable.

### Scope

Frontend layout and table CSS only. No backend, no schema, no migration.

### Files to Read/Modify

- `apps/web/src/app/app/layout.tsx` — adjust content width for report/voucher pages
- `apps/web/src/app/app/reports/ledger/page.tsx` — table layout improvements
- `apps/web/src/app/app/reports/_lib/CashBankBookReport.tsx` — table layout improvements
- `apps/web/src/app/app/reports/trial-balance/page.tsx` — table layout improvements
- `apps/web/src/app/app/reports/income-statement/page.tsx` — table layout improvements
- `apps/web/src/app/app/reports/balance-sheet/page.tsx` — table layout improvements (already updated in 2F-3, verify)
- `apps/web/src/app/app/vouchers/page.tsx` — wider layout for voucher list
- `apps/web/src/app/app/reports/_lib/report-ui.tsx` — shared formatting/layout helpers
- `apps/web/src/app/app/reports/_lib/report-print.tsx` — print layout improvements

### Implementation Approach

1. **Layout widening**: Remove or relax the `max-w-7xl` constraint for report and voucher pages. Options:
   - Change the app layout to use `w-full` instead of `max-w-7xl` for the main content area, keeping the sidebar width fixed at 240px.
   - Or use a context-based approach where report pages receive a wider content area.
   - Setup pages retain their current centered width.

2. **Table column optimization**:
   - Reduce `min-w-[1200px]` on Cash/Bank/MFS Book tables. Prioritize Date, Voucher No, Narration, Debit, Credit, Balance as primary columns. Move Project, Cost Center, Opposite Accounts, and Cash/Bank Account into expandable detail rows or tooltip overlays for the primary view.
   - Ledger Statement: prioritize Date, Voucher No, Particulars, Debit, Credit, Balance.
   - Trial Balance: six-column format is already reasonable; verify it fits without scroll.
   - Income Statement: grouped format with subtotals is textbook-style; verify column widths.
   - Balance Sheet: grouped format with P/L line is textbook-style; verify column widths.

3. **Secondary columns handling**: For columns that are less critical for daily accountant review:
   - Show them in expandable detail rows (click a row to see project/cost center/opposite account details).
   - Or show them in tooltip overlays (hover to see full details).
   - Or include them only in the print layout (which has more width available on A4 landscape).

### Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm check:all`
- Manual browser smoke test at 1280px width:
  - Verify Cash Book, Bank Book, MFS Book tables do not require horizontal scroll for primary columns.
  - Verify Ledger Statement table does not require horizontal scroll for primary columns.
  - Verify Trial Balance table fits without scroll.
  - Verify voucher list page uses wider layout.
  - Verify setup pages retain their current layout width.
  - Verify print layouts still work correctly.

### Stop Condition

Report tables show primary columns without horizontal scroll at 1280px. Setup pages unchanged. Print layouts work. `pnpm check:all` and `pnpm doctor` pass.

---

## Chunk 2F-5: Voucher Line Dynamic Field Visibility

### Objective

Improve the voucher line form so required fields are clearly marked, optional fields are hidden or collapsed for non-required ledgers, and Cash/Bank/MFS labels match the account type.

### Scope

Frontend only. No backend, no schema, no migration.

### Files to Read/Modify

- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx` — dynamic field visibility logic
- `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx` — label helpers if needed

### Implementation Approach

1. When a ledger account is selected on a line:
   - If `requiresProject = true`: Show Project field with required marker ("Project" + asterisk or "Required" label).
   - If `requiresProject = false`: Hide Project field entirely, or collapse it into an expandable "Optional details" section.
   - If `requiresCostCenter = true`: Show Cost Center field with required marker.
   - If `requiresCostCenter = false`: Hide Cost Center field, or collapse it.
   - If `isCashBank = true`: Show Cash/Bank/MFS account field. Label dynamically based on the accounts linked to this ledger (e.g., "Cash account" if only CASH accounts linked, "Bank account" if only BANK, "MFS account" if only MFS, or "Cash/Bank/MFS account" if multiple types).
   - If `isCashBank = false`: No Cash/Bank/MFS field appears (already implemented correctly).

2. Remove or update the current "Project recommended" / "Cost center recommended" hint text. Replace with either a required marker or an optional collapse.

3. Backend validation is unchanged. The frontend changes are purely UX improvements.

### Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm check:all`
- Manual browser smoke test:
  - Create a voucher draft with a ledger requiring project: verify Project appears as required.
  - Create a voucher draft with a ledger not requiring project: verify Project is hidden or collapsed.
  - Create a voucher draft with a cash/bank ledger: verify Cash/Bank/MFS account field appears with appropriate label.
  - Create a voucher draft with a non-cash/bank ledger: verify no Cash/Bank/MFS field.
  - Verify posting still validates correctly (backend authority).
  - Verify existing voucher view/edit flow is unchanged.

### Stop Condition

Voucher line form shows required fields clearly, hides/collapses optional fields, and uses appropriate Cash/Bank/MFS labels. Backend validation unchanged. `pnpm check:all` and `pnpm doctor` pass.

---

## Chunk 2F-6: Report Filter UX Clarity and Dropdown/Table Text Clipping Fixes

### Objective

Improve report filter panel UX clarity for Cash/Bank/MFS Book Project/Cost Center filters. Fix dropdown and table text clipping issues across report pages and voucher forms.

### Scope

Frontend only. No backend, no schema, no migration.

### Files to Read/Modify

- `apps/web/src/app/app/reports/_lib/report-ui.tsx` — filter labels, dropdown width, date formatting
- `apps/web/src/app/app/reports/_lib/CashBankBookReport.tsx` — verify filter placement
- `apps/web/src/app/app/reports/_lib/useReportReferences.ts` — verify reference loading
- `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx` — label formatting, dropdown width
- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx` — dropdown width fixes
- Various report pages — table cell truncation with tooltip

### Pre-Implementation Verification (Issue D)

Before coding the filter label changes, verify the backend behavior:

1. Read `apps/api/src/report/report.service.ts` method `getCashBankBook` (or `getCashBankBookInternal`) to understand how `projectId` and `costCenterId` filters work on Cash/Bank/MFS Book queries.
2. Document which voucher lines the backend filters against when Project/Cost Center is provided.
3. Use this documentation to label the frontend filters accurately.

### Implementation Approach for Filter UX

1. In the Cash/Bank/MFS Book filter panels:
   - Move Project and Cost Center filters into a collapsible "Advanced filters" section below the primary filters (Fiscal Year, Period, Cash/Bank Account, Date Range).
   - Or add clear labels: "Voucher line project" and "Voucher line cost center" instead of just "Project" and "Cost center".
   - The chosen approach depends on the verified backend behavior.

2. In Ledger Statement, Trial Balance, Income Statement, and Balance Sheet:
   - Project and Cost Center filters remain in the main panel (appropriate for cross-account reports).

### Implementation Approach for Text Clipping

1. Fiscal year dropdown: Use concise date format (`Jul 2025 - Jun 2026` instead of `2025-07-01 to 2026-06-30`). Ensure dropdown width accommodates at least 300px.
2. Accounting period dropdown: Same concise format. Show status clearly.
3. Report filter `<select>` elements: Set minimum width to accommodate full labels.
4. Table cells with long text: Use `truncate` CSS with `title` attribute for tooltip access.

### Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm check:all`
- Manual browser smoke test:
  - Verify Cash Book filter panel clearly labels Project/Cost Center or moves them to advanced section.
  - Verify fiscal year and period dropdown labels are not clipped.
  - Verify long table cell text shows tooltip on hover.
  - Verify other filter panels are unchanged.

### Stop Condition

Filter panels are clear. Dropdown labels are not clipped. Table text is accessible via tooltip. `pnpm check:all` and `pnpm doctor` pass.

---

## Chunk 2F-7: Final Integration and Acceptance Review

### Objective

Full integration review across all Phase 2F chunks. Verify scope, security, regression, and documentation.

### Scope

Review only. No code changes unless minor fixes are needed.

### Verification

- `pnpm prisma:generate`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build:web`
- `pnpm build:api`
- `docker compose config`
- `pnpm check:all`
- `pnpm doctor`
- Manual API smoke tests:
  - Unauthenticated `GET /reports/balance-sheet` returns 401.
  - Authenticated balance sheet returns P/L fields alongside existing fields.
  - All other report endpoints return correct results.
- Manual browser smoke tests:
  - Balance Sheet renders P/L line, adjusted totals, updated notice, and print layout.
  - Report tables use wider layout without horizontal scroll.
  - Voucher line form shows dynamic fields correctly.
  - Filter panels have clear labels.
  - Dropdowns show full labels.
  - Setup pages are unchanged.
  - Existing voucher flow works unchanged.

### Documentation Updates

- Update `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` to reflect Phase 2F acceptance.
- Create `phase-2f-complete` git tag.

### Stop Condition

All verification passes. Docs updated. Phase 2F is accepted.

---

## Issue F: Demo/Test Data Cleanliness

Issue F (demo data strategy) is documentation/planning only in Phase 2F. It does not require a separate implementation chunk. The strategy should be documented in the requirement lock and referenced in the implementation plan notes. If the user later confirms demo data implementation, a separate chunk can be added.

---

## Risk Assessment

| Chunk | Primary Risk | Mitigation |
| --- | --- | --- |
| 2F-2 | P/L computation correctness for edge cases (zero P/L, mixed income/expense) | Test with Real Capita realistic scenarios; verify with known posted vouchers |
| 2F-3 | P/L line visual distinction from ledger rows | Use clear styling (different background, label prefix, not-editable) |
| 2F-4 | Layout widening may affect setup pages | Only widen report/voucher content area; test setup pages for regressions |
| 2F-5 | Hiding optional fields may confuse accountant who wants to add them later | Use collapsible section instead of complete hiding; test with accountant |
| 2F-6 | Filter label changes may not match backend behavior | Verify backend first before changing labels |
| 2F-7 | Integration gaps between chunks | Full review across all chunks before acceptance |

---

## Recommended Model Routing

| Chunk | Recommended Model | Fallback Model |
| --- | --- | --- |
| 2F-1 | Claude Opus 4.8 (docs review) | Any high-quality docs reviewer |
| 2F-2 | Claude Opus 4.8 High / GPT-5.5 Thinking xhigh | DeepSeek V4 Pro Max |
| 2F-3 | Claude Opus 4.8 High | DeepSeek V4 Pro Max |
| 2F-4 | Claude Opus 4.8 High | DeepSeek V4 Pro Max |
| 2F-5 | Claude Opus 4.8 High | DeepSeek V4 Pro Max |
| 2F-6 | Claude Opus 4.8 High | Any high-quality frontend agent |
| 2F-7 | Claude Opus 4.8 (docs review) | Any high-quality docs reviewer |
