# Phase 2G: Project/Cost-Center Financial Reporting Requirement Lock

## Purpose

Phase 2G locks requirements for project and cost-center financial reports that transform the `projectId` and `costCenterId` dimensions already captured on posted `VoucherLine` records into meaningful accounting summaries for Real Capita Group. This document exists so the next agent or developer can continue from repository context alone, without relying on hidden chat memory.

## Current Status

**Requirement lock only. Not implemented.** No schema, migration, backend API, frontend page, seed data, or runtime behavior changes have been made for any Phase 2G report. This document is a specification lock only.

## A. Confirmed Business Context

- Phase 2F Accounting Report + Accountant UX Refinement is complete and accepted at commit `17fede6` (tag `phase-2f-complete`). Issues A-D are implemented (Balance Sheet current P/L, report/table readability, voucher line dynamic field visibility, report filter UX clarity).
- Phase 2E MFS account setup and MFS Book foundation are accepted.
- Phase 2D accounting reports are accepted at commit `be482c2` (tag `phase-2d-complete`). All seven report endpoints and frontend pages work.
- Phase 2C voucher engine is accepted. Posted vouchers carry `projectId` and `costCenterId` on each `VoucherLine`.
- Phase 2A accounting foundation is accepted. Projects and Cost Centers exist as first-class entities. `LedgerAccount.requiresProject` and `LedgerAccount.requiresCostCenter` flags exist. `CostCenter` belongs to a `Project` via `projectId`.
- Only the `ACCOUNTANT` role is confirmed. Other roles are deferred until Real Capita confirms exact office responsibilities.
- Reports derive from posted `VoucherLine` rows only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`). No primary report tables.
- The system already captures project and cost-center metadata on every posted voucher line, but currently provides no way for the accountant to view project-wise or cost-center-wise financial summaries.

### Confirmed Single-Role Rule

The only active role is:

- `ACCOUNTANT`, displayed as `Accountant`

Do not implement, seed, display, or model Admin, Super Admin, Data Entry, Checker, MD Viewer, HR, Sales, Payroll, Viewer, Manager, or any other role in Phase 2G.

### Accounting Book Direction

AGM sir prefers textbook-style accounting table presentation where suitable. Report tables should follow Phase 2F readability patterns (wider viewport, hidden less-critical columns by default, truncation with tooltip, compact filter labels).

## B. Phase 2G Scope

Phase 2G is a documentation/specification lock only.

Phase 2G does not include:

- Database schema changes (unless explicitly justified in the plan)
- Prisma model additions or enum changes
- New API business endpoints
- New frontend business pages or sidebar entries
- Business seed data changes
- Additional roles
- Runtime code changes
- Report table additions
- MFS voucher posting support

## What Phase 2G Is

Phase 2G defines four primary reports and one optional sub-view:

1. **Project Ledger** -- all posted voucher lines for a selected project
2. **Project Cost Report** -- summarized project-wise cost/expense by cost center and/or ledger
3. **Cost Center Summary** -- cost-center-wise totals under a selected project
4. **Project Financial Summary** -- management summary card/table for a selected project
5. **Project Cash/Bank Movement View** (optional/later sub-chunk) -- cash/bank/MFS movement carrying project/cost-center metadata

## What Phase 2G Is Not

Phase 2G is not a coding phase. It must not add report tables, MFS posting, new roles, PDF/Excel export, dashboard analytics, party modules, payroll, or any other feature outside the five locked reports.

---

## C. Report A: Project Ledger

### Purpose

Show all posted voucher lines attached to a selected project, giving the accountant a line-by-line view of every transaction tagged with that project.

### Required Filters

| Filter | Required? | Description |
| --- | --- | --- |
| Fiscal year | Yes | `fiscalYearId` must be provided. |
| Project | Yes | `projectId` must be provided. The report shows only voucher lines where `VoucherLine.projectId = projectId`. |
| Accounting period or date range | Either period or custom date range; fiscal-year default if neither provided. | Same period/date-range resolution as existing reports. |
| Cost center | No | Optional. When provided, further filters lines to `VoucherLine.costCenterId = costCenterId`. Must belong to the selected project. |
| Ledger account | No | Optional. When provided, further filters lines to `VoucherLine.ledgerAccountId = ledgerAccountId`. |
| Voucher type | No | Optional. When provided, further filters by `Voucher.voucherType`. |

### Required Output Columns

| Column | Source | Notes |
| --- | --- | --- |
| Date | `Voucher.voucherDate` | Formatted as ISO date slice. |
| Voucher No | `Voucher.systemVoucherNo` | |
| Voucher Type | `Voucher.voucherType` | DEBIT, CREDIT, JOURNAL, CONTRA, PAYMENT, RECEIPT. |
| Ledger Code | `LedgerAccount.code` | |
| Ledger Name | `LedgerAccount.name` | Truncation with tooltip per Phase 2F. |
| Cost Center | `CostCenter.name` (via `VoucherLine.costCenterId`) | Null when no cost center. |
| Narration / Description | `Voucher.narration` + `VoucherLine.description` | Combined or shown as two sub-columns. Truncation with tooltip per Phase 2F. |
| Debit | `VoucherLine.amount` where `side = DEBIT` | Zero for credit-side lines. |
| Credit | `VoucherLine.amount` where `side = CREDIT` | Zero for debit-side lines. |
| Running Balance / Net Movement | Cumulative debit minus credit | Computed from opening balance plus each line movement. Since multiple ledger accounts may appear, the running balance represents the overall project-tagged net movement (debit minus credit), not per-account. |
| Drill-down link | `Voucher.id` | Links to `/app/vouchers/[id]` for voucher detail. |

### Rules

- Source must be posted voucher lines only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`).
- Draft vouchers must not appear.
- Soft-deleted/reversed behavior follows existing report conventions (excluded by `isDeleted = false`).
- Project is required. The report returns 400 if `projectId` is missing.
- Cost center is optional. If provided, it must belong to the selected project (same consistency check as existing reports).
- No editable project ledger table.
- Lines are ordered by voucher date, then system voucher number, then line number.

### Opening Balance

- Opening balance = sum of all project-tagged posted debit minus credit movements before the selected start date within the same fiscal year.
- Since multiple ledger accounts may be involved, the opening balance represents the overall project net movement before the period.
- The Project Ledger may alternatively present a per-ledger-account breakdown of the opening balance. The implementation plan should choose one approach and document it.

### API Endpoint

`GET /reports/project-ledger` with `ReportQueryDto` extended with `projectId` (required for this report) and `voucherType` (optional).

---

## D. Report B: Project Cost Report

### Purpose

Summarize project-wise cost/expense by cost center and/or ledger account, giving Real Capita a concise view of how much money was spent, received, or allocated per project and how it is distributed.

### Required Filters

| Filter | Required? | Description |
| --- | --- | --- |
| Fiscal year | Yes | |
| Project | Yes | |
| Accounting period or date range | Either period or custom date range; fiscal-year default if neither provided. | |
| Cost center | No | Optional. |
| Account class/group/ledger | No | Optional. When `ledgerAccountId` is provided, rows are filtered to that ledger. When `accountGroupId` or `accountClassCode` is provided, rows are filtered to that group/class. The DTO may need extension for these. |
| Expense-only toggle | No | Optional. When set, only EXPENSE-class and optionally ASSET-class lines are included. See Open Question 1. |

### Required Output

| Column | Description |
| --- | --- |
| Project | Project code and name. |
| Cost Center | Cost center code and name (grouped rows). Null for lines without a cost center. |
| Ledger / Account Group | Ledger account code/name or account group code/name (grouped rows). |
| Debit total | Sum of debit-side amounts for matching lines. |
| Credit total | Sum of credit-side amounts for matching lines. |
| Net amount | Signed amount based on the account class normal balance. |
| Expense total | Subtotal of EXPENSE-class tagged lines. |
| Asset/project-cost total | Subtotal of ASSET-class tagged lines, if applicable. See Open Question 2. |
| Income total | Subtotal of INCOME-class tagged lines, if applicable. See Open Question 4. |
| Row totals and grand total | Summary rows for each group level and a grand total. |

### Grouping Options

The report should support grouping by account class, then by cost center within each class, then by ledger account within each cost center:

1. **Default view**: By account class (Asset, Liability, Equity, Income, Expense), then by ledger account or account group within each class.
2. **Cost center view**: By cost center, then by account class within each cost center.
3. **Toggle**: Allow the accountant to switch between grouping modes.

### Rules

- Primarily useful for expense/project development tracking.
- Must not falsely mix owner capital with project cost unless the line itself carries `projectId` metadata. Only voucher lines where `VoucherLine.projectId = projectId` are included.
- The report must clearly label whether rows represent all project-tagged lines or only expense-class/project-cost lines, depending on the filter toggle.
- Backend source must be posted voucher lines only.
- No editable project cost table in the Prisma schema.

### API Endpoint

`GET /reports/project-cost` with `ReportQueryDto` extended with `projectId` (required), optional `accountGroupId`, optional `accountClassCode`, and optional `expenseOnly` boolean.

---

## E. Report C: Cost Center Summary

### Purpose

Show cost-center-wise totals under a selected project, giving the accountant a quick view of how each cost center contributes to the project's financial activity.

### Required Filters

| Filter | Required? | Description |
| --- | --- | --- |
| Fiscal year | Yes | |
| Project | Yes | Limits cost centers to those belonging to this project. |
| Accounting period or date range | Either period or custom date range; fiscal-year default if neither provided. | |
| Cost center | No | Optional. When provided, shows only that cost center's totals. |
| Ledger/account group | No | Optional. Further filters lines to a specific ledger or account group. |

### Required Output

| Column | Description |
| --- | --- |
| Cost Center Code | `CostCenter.code` |
| Cost Center Name | `CostCenter.name` |
| Debit total | Sum of debit-side amounts for lines tagged with this cost center. |
| Credit total | Sum of credit-side amounts for lines tagged with this cost center. |
| Net movement | Debit total minus credit total (signed amount). |
| Number of voucher lines | Count of posted voucher lines tagged with this cost center. |
| Last transaction date | Most recent `Voucher.voucherDate` for lines tagged with this cost center. |
| Drill-down option | Link or button to Project Ledger filtered by that cost center. |

### Rules

- Only cost centers belonging to the selected project appear in the summary.
- Lines without a `costCenterId` are excluded from cost-center rows but may appear in an "Unassigned" row if the project has lines without cost centers.
- Backend source must be posted voucher lines only.
- No editable cost center summary table.

### API Endpoint

`GET /reports/cost-center-summary` with `ReportQueryDto` extended with `projectId` (required).

---

## F. Report D: Project Financial Summary

### Purpose

Management summary card/table for a selected project, showing high-level financial indicators at a glance.

### Required Filters

| Filter | Required? | Description |
| --- | --- | --- |
| Fiscal year | Yes | |
| Project | Yes | |
| Accounting period or date range | Either period or custom date range; fiscal-year default if neither provided. | |

### Required Output

| Field | Description |
| --- | --- |
| Total project-tagged debit | Sum of debit-side amounts across all project-tagged posted lines. |
| Total project-tagged credit | Sum of credit-side amounts across all project-tagged posted lines. |
| Net movement | Debit total minus credit total. |
| Expense-class total | Sum of project-tagged EXPENSE-class line movements. |
| Asset/project-cost total | Sum of project-tagged ASSET-class line movements, if applicable. |
| Income-class total | Sum of project-tagged INCOME-class line movements, if applicable. |
| Cash/bank movement | Sum of project-tagged cash/bank/MFS line movements (only lines that also carry `cashBankAccountId`). See Report E. |
| Cost center breakdown summary | Inline summary of cost center totals (may reuse Cost Center Summary data). |

### Accounting Class Breakdown

The summary must clearly distinguish the five accounting classes:

- **Asset**: lines tagged with the project where the ledger account belongs to the ASSET class.
- **Liability**: lines tagged with the project where the ledger account belongs to the LIABILITY class.
- **Equity**: lines tagged with the project where the ledger account belongs to the EQUITY class.
- **Income**: lines tagged with the project where the ledger account belongs to the INCOME class.
- **Expense**: lines tagged with the project where the ledger account belongs to the EXPENSE class.

Each class section shows debit total, credit total, and signed net movement.

### Rules

- Must clearly distinguish accounting classes. Do not mix asset totals with expense totals without explicit labels.
- Do not invent receivable/payable logic unless a party module/reporting supports it.
- Do not invent sales/revenue workflow.
- Do not add dashboard analytics in this phase. The Project Financial Summary is a report page, not a dashboard card.
- Backend source must be posted voucher lines only.
- No editable project financial summary table.

### API Endpoint

`GET /reports/project-financial-summary` with `ReportQueryDto` extended with `projectId` (required).

---

## G. Report E: Project Cash/Bank Movement View (Optional/Later Sub-Chunk)

### Purpose

Show cash/bank/MFS movement carrying project/cost-center metadata. This is only locked as optional or a later sub-chunk because it depends on whether current voucher-line metadata supports it well enough and whether the accountant needs it beyond what Project Ledger already provides.

### Important Behavior Note

Existing Cash/Bank/MFS Book project filters are **line-level filters** on the same cash/bank/MFS voucher line, not opposite-line filters. The backend `buildLineFilter` in `report.service.ts` applies `projectId` and `costCenterId` directly to the `VoucherLineWhereInput` that also includes `cashBankAccountId`, `cashBankAccountType`, and `requireCashBankLedger` conditions. This means:

- A cash/bank/MFS line that carries `projectId` is a cash/bank/MFS movement **directly tagged** with that project.
- This is not the same as "all cash/bank movements for vouchers that mention this project" (which would require checking opposite lines).

The Project Cash/Bank Movement View must use the same line-level approach and must not mislabel this behavior.

### Required Filters

Same as Cash/Bank/MFS Book: fiscal year, optional period/date range, optional project, optional cost center, plus the option to select a specific cash/bank/MFS account.

### Required Output

| Column | Description |
| --- | --- |
| Date | Voucher date. |
| Voucher No | System voucher number. |
| Account | Cash/bank/MFS account display name. |
| Receipt (Debit) | Amount on debit side. |
| Payment (Credit) | Amount on credit side. |
| Balance | Running balance. |
| Project | Project code/name on the line (if present). |
| Cost Center | Cost center code/name on the line (if present). |

### Recommendation

Lock this as optional for Phase 2G. If the accountant finds Project Ledger and Project Cost Report sufficient, this report may be deferred. If cash/bank visibility per project is important, implement it as a sub-chunk of 2G-4 or as a separate later chunk.

---

## H. Accounting Source Rule (Preserved)

All report computations must continue to derive from posted `VoucherLine` rows only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`).

- DRAFT vouchers must not affect reports.
- Soft-deleted vouchers must not affect reports.
- No editable report rows.
- No primary report tables in the Prisma schema.
- Project Ledger, Project Cost Report, Cost Center Summary, and Project Financial Summary are all computed on demand from posted VoucherLine records.

---

## I. Technical Constraints

1. **Prefer no Prisma schema change.** The existing `voucher_lines`, `projects`, `cost_centers`, `ledger_accounts`, `account_groups`, and `account_classes` tables and indexes are sufficient for the Phase 2G reports. No new models or migrations unless absolutely justified.
2. **Use existing indexes.** `voucher_lines` already has indexes on `projectId`, `costCenterId`, `ledgerAccountId`, and `cashBankAccountId`. These support the project/cost-center filtering and grouping queries.
3. **Backend report service is the authority for calculations.** Frontend may only display/filter/summarize API results.
4. **Use Decimal-safe/money-safe existing patterns.** All money values must use `Prisma.Decimal` and `toFixed(2)` string serialization, consistent with existing reports.
5. **Preserve HttpOnly cookie auth.** No localStorage token usage.
6. **Extend `ReportQueryDto`** with `projectId` required flag per report, and optional `accountGroupId`, `accountClassCode`, `voucherType`, and `expenseOnly` as needed.
7. **Reuse `resolveReportContext` pattern** for fiscal year, period, date range, project, and cost center validation.
8. **Reuse `buildLineFilter` pattern** with project/cost-center extension.
9. **Reuse `buildVoucherDateFilter` pattern** for date-range filtering.
10. **Reuse `sumDebitCreditByLedger` and `sumDebitCredit` patterns** for aggregation.
11. **Reuse `findReportLines` pattern** for line-level detail queries.

---

## J. UX Constraints

1. Reports should follow Phase 2F accounting-table readability patterns:
   - Wider viewport for data-heavy report pages.
   - Less-critical columns hidden by default with tooltip on hover.
   - Truncation with tooltip for long text (narration, ledger names).
   - Compact date labels in dropdowns with full title tooltip.
   - Required filters clearly marked (Project is required for all four primary reports).
2. Project and cost center filters must be clear and selection-aware where possible (cost center dropdown scoped to selected project, following the `CostCenter.projectId` relation).
3. Required filters must be clearly marked with visual indicators.
4. Empty states must explain what data is needed ("Select a project to view its financial activity" or "No posted voucher lines found for this project in the selected period").
5. Drill-down to voucher detail should be preserved where already possible (link to `/app/vouchers/[id]`).
6. Do not overload sidebar with too many report links. Phase 2G adds at most four new links under the existing Reports navigation section.

### Route Structure

Phase 2G reports should live under `/app/reports/` following the existing pattern:

- `/app/reports/project-ledger`
- `/app/reports/project-cost`
- `/app/reports/cost-center-summary`
- `/app/reports/project-financial-summary`

---

## K. Security Rule (Preserved)

- HttpOnly cookie-based JWT/session authentication continues.
- No auth tokens in localStorage.
- Cookies: `SameSite=Lax`, `Secure` only in production.
- Password hashing continues.
- Backend guards and role checks remain the authority.
- All Phase 2G report endpoints must use `AuthGuard + RolesGuard + ACCOUNTANT`.
- No real passwords, salaries, employee data, customer data, voucher amounts, or private business data in seed data or documentation.

---

## L. Open Questions and Recommended Answers

### 1. Should Project Cost Report include only Expense-class lines, or all project-tagged lines grouped by account class?

**Recommendation**: Include all project-tagged lines grouped by account class by default, with an optional `expenseOnly` toggle that filters to EXPENSE-class only (plus optionally ASSET-class for project-cost/land-asset tracking). This gives the accountant flexibility: the full view shows income, expense, asset, liability, and equity movements per project, while the expense-only toggle gives a focused cost-tracking view. Real Capita's primary use case is cost tracking, but income-tagged project lines may exist (e.g., project-specific revenue), and the accountant should see them when present.

### 2. Should Land/Project Asset accounts be counted separately from expenses?

**Recommendation**: Yes. Asset-class project-tagged lines (land, project development assets) should appear as a separate section in the Project Cost Report and Project Financial Summary, not mixed with Expense-class totals. This follows textbook accounting practice where assets are capitalized separately from operating expenses. The summary should label them clearly: "Project Asset (Land/Development)" vs "Project Operating Expense".

### 3. Should cash/bank lines with no project metadata be excluded from project reports?

**Recommendation**: Yes. Only voucher lines where `VoucherLine.projectId` matches the selected project should appear in project reports. Lines without a project tag are not part of any project's financial activity and should not be included. This is consistent with the existing Cash/Bank/MFS Book project filter behavior (line-level filter on the same voucher line).

### 4. Should Project Financial Summary display income/expense/net movement or only cost?

**Recommendation**: Display the full breakdown: income-class total, expense-class total, asset-class total, and net movement, along with the overall debit/credit totals. Real Capita's projects are primarily cost-driven, but if project-tagged income lines exist, the accountant should see them. The summary should not hide income just because the primary use case is cost tracking. If no project-tagged income lines exist, the income section shows zero with a calm empty state.

### 5. Should reports be under `/app/reports` or `/app/projects/[id]`-style routes?

**Recommendation**: Use `/app/reports/` routes (project-ledger, project-cost, cost-center-summary, project-financial-summary) following the existing report page pattern. Reasons: (a) consistency with existing seven report routes, (b) reports are filter-driven (the accountant selects a project from a dropdown), not entity-detail-driven, (c) the existing sidebar already has a Reports section.

### 6. Should Cost Center Summary be a separate report or a section inside Project Cost Report?

**Recommendation**: Make Cost Center Summary a separate report page (`/app/reports/cost-center-summary`) with its own API endpoint, but also include a compact cost-center breakdown as an inline section in the Project Financial Summary. Reasons: (a) the accountant may want to see cost center totals independently, (b) a dedicated page allows more detailed columns (number of lines, last transaction date), (c) the Project Financial Summary can reuse the same data for its inline breakdown.

---

## M. Explicit Out-of-Scope List

Phase 2G does NOT include:

- New roles beyond ACCOUNTANT
- Party/customer/vendor module
- Payroll/salary module
- File attachments
- PDF/Excel export
- Dashboard analytics (Project Financial Summary is a report page, not a dashboard widget)
- MFS voucher posting support
- Provider API integration (bKash API, Nagad API, etc.)
- Old ERP copy/paste
- Editable ledger/report/project-cost tables in the Prisma schema
- Direct posted voucher editing
- Closing-entry automation
- Approval workflow
- Business seed data (demo data cleanup is a separate future phase)
- Multi-currency support
- Localization/translation
- Project detail pages (`/app/projects/[id]`) with embedded reports
- Broad sidebar restructuring
- Project budgeting or forecasting
- Receivable/payable tracking without a party module
- Demo/test data cleanup implementation

---

## N. Regression Criteria

All existing report behavior must not regress:

- `GET /reports/ledger` continues to work unchanged.
- `GET /reports/cash-book` continues to work unchanged (CASH-only).
- `GET /reports/bank-book` continues to work unchanged (BANK-only).
- `GET /reports/mfs-book` continues to work unchanged (MFS-only).
- `GET /reports/trial-balance` continues to work unchanged.
- `GET /reports/income-statement` continues to work unchanged.
- `GET /reports/balance-sheet` continues to work unchanged, including current P/L line.
- Cash Book remains CASH-only. Bank Book remains BANK-only. MFS Book remains MFS-only.
- Trial Balance total debits equal total credits.
- Income Statement net profit calculation is correct.
- Balance Sheet P/L-adjusted and unadjusted views remain intact.
- Voucher posting behavior is unchanged (MFS posting still rejected).
- Voucher line dynamic field visibility is unchanged.
