# Phase 2G Acceptance Criteria

## Purpose

Phase 2G is a documentation/specification lock for project and cost-center financial reporting. It prepares requirements and acceptance criteria for a future implementation phase without changing schema, API, UI business modules, roles, or seed data.

## Acceptance Checklist for Phase 2G Documentation

Phase 2G requirement lock is accepted when:

- `docs/requirements/phase-2g-project-cost-center-reporting-requirement-lock.md` exists and covers all four primary reports (A through D) and the optional Report E, confirmed business context, single-role rule, accounting source rule, technical constraints, UX constraints, security rule, open questions with recommended answers, and explicit out-of-scope list.
- `docs/acceptance/phase-2g-acceptance-criteria.md` exists.
- `docs/plans/phase-2g-project-cost-center-reporting-plan.md` exists with implementation chunks, each with objective, scope, files to read, files likely to change, in-scope, out-of-scope, acceptance checks, verification commands, recommended model, and exact stop condition.
- `AGENTS.md` points future agents to the Phase 2G lock.
- `docs/ai/CURRENT_STATE.md` states that Phase 2G requirement lock is prepared.
- `docs/ai/START_HERE.md` points agents to the Phase 2G docs.
- `docs/handoff.md` records the created Phase 2G files and states that no runtime modules were implemented.
- `README.md` states the current development phase includes the Phase 2G requirement lock.
- `prisma/schema.prisma` is unchanged by Phase 2G documentation lock.
- No report tables, new API endpoints, new frontend pages, new sidebar entries, MFS posting support, PDF/Excel export, or MFS runtime logic were added in the documentation lock phase.
- Phase 2F acceptance state is preserved and documented.
- Verification passes with `pnpm check:all` and `pnpm doctor`.

---

## Acceptance Checklist for Future Project Ledger Implementation (Report A)

After explicit user confirmation, the future Project Ledger implementation is accepted only if:

- The backend endpoint `GET /reports/project-ledger` exists and is guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required. The endpoint returns 400 if `projectId` is missing.
- The report derives only from posted voucher lines (`Voucher.status = POSTED`, `Voucher.isDeleted = false`) where `VoucherLine.projectId = projectId`.
- Draft and soft-deleted vouchers do not appear in the report.
- Fiscal year, accounting period, and date range validation reuse the existing `resolveReportContext` pattern.
- Optional cost center filter is scoped to the selected project (cost center must belong to the project).
- Optional ledger account filter exists.
- Optional voucher type filter exists.
- Lines are ordered by voucher date, then system voucher number, then line number.
- Opening balance is computed from project-tagged posted movements before the selected start date within the same fiscal year.
- Running balance is cumulative (debit minus credit) across project-tagged lines.
- Money values use `Prisma.Decimal.toFixed(2)` string serialization.
- The frontend page `/app/reports/project-ledger` renders under the protected app shell with project filter (required), fiscal year filter (required), period/date range, optional cost center, optional ledger, and optional voucher type.
- Empty states explain what data is needed ("Select a project to view its ledger" or "No posted voucher lines found for this project in the selected period").
- Drill-down links to `/app/vouchers/[id]` are present.
- Browser print foundation is included (Real Capita Group heading, report title, project context, date range, report body, totals, generated timestamp, signature placeholders).
- No Prisma schema change, no migration, no report table, no editable project ledger.
- Existing Ledger Statement, Cash Book, Bank Book, MFS Book, Trial Balance, Income Statement, and Balance Sheet behavior is unchanged.

---

## Acceptance Checklist for Future Project Cost Report Implementation (Report B)

After explicit user confirmation, the future Project Cost Report implementation is accepted only if:

- The backend endpoint `GET /reports/project-cost` exists and is guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required. The endpoint returns 400 if `projectId` is missing.
- The report derives only from posted voucher lines where `VoucherLine.projectId = projectId`.
- Rows are grouped by account class (Asset, Liability, Equity, Income, Expense), then by ledger account or account group within each class.
- An optional grouping toggle allows switching between "by account class" and "by cost center" views.
- Each row shows debit total, credit total, and signed net movement (normal-balance-aware).
- Section totals exist for each account class.
- Grand total shows overall debit, credit, and net movement.
- An optional `expenseOnly` toggle filters to EXPENSE-class (and optionally ASSET-class) lines only.
- Asset-class totals are labeled separately from Expense-class totals, not mixed.
- Optional `accountGroupId` and `accountClassCode` filters work correctly.
- Money values use `Prisma.Decimal.toFixed(2)` string serialization.
- The frontend page `/app/reports/project-cost` renders under the protected app shell with project filter (required), fiscal year filter (required), period/date range, optional cost center, optional account class/group, and optional expense-only toggle.
- Empty states explain what data is needed.
- Browser print foundation is included.
- No Prisma schema change, no migration, no report table, no editable project cost table.
- Existing report behavior is unchanged.

---

## Acceptance Checklist for Future Cost Center Summary Implementation (Report C)

After explicit user confirmation, the future Cost Center Summary implementation is accepted only if:

- The backend endpoint `GET /reports/cost-center-summary` exists and is guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required. The endpoint returns 400 if `projectId` is missing.
- The report derives only from posted voucher lines where `VoucherLine.projectId = projectId` and `VoucherLine.costCenterId` is set (or null for unassigned lines).
- Only cost centers belonging to the selected project appear in the summary.
- Each cost center row shows: code, name, debit total, credit total, net movement, number of voucher lines, and last transaction date.
- An "Unassigned" row appears if the project has posted lines without a cost center.
- Optional cost center filter works correctly (must belong to the selected project).
- Optional ledger/account group filter works correctly.
- Drill-down link to Project Ledger filtered by that cost center is present.
- Money values use `Prisma.Decimal.toFixed(2)` string serialization.
- The frontend page `/app/reports/cost-center-summary` renders under the protected app shell with project filter (required), fiscal year filter (required), and optional cost center/ledger filters.
- Empty states explain what data is needed.
- Browser print foundation is included.
- No Prisma schema change, no migration, no report table, no editable cost center summary table.
- Existing report behavior is unchanged.

---

## Acceptance Checklist for Future Project Financial Summary Implementation (Report D)

After explicit user confirmation, the future Project Financial Summary implementation is accepted only if:

- The backend endpoint `GET /reports/project-financial-summary` exists and is guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required. The endpoint returns 400 if `projectId` is missing.
- The report derives only from posted voucher lines where `VoucherLine.projectId = projectId`.
- The summary shows: total debit, total credit, net movement, and a per-account-class breakdown (Asset, Liability, Equity, Income, Expense) with debit total, credit total, and signed net movement for each class.
- Expense-class total and Asset-class total are labeled separately, not mixed.
- Income-class total is shown even when zero.
- Cash/bank movement section shows the sum of project-tagged lines that also carry `cashBankAccountId`.
- A compact cost center breakdown is included inline (may reuse Cost Center Summary data).
- Money values use `Prisma.Decimal.toFixed(2)` string serialization.
- The frontend page `/app/reports/project-financial-summary` renders under the protected app shell with project filter (required) and fiscal year filter (required).
- Empty states explain what data is needed.
- Browser print foundation is included.
- No Prisma schema change, no migration, no report table, no editable project financial summary table.
- No dashboard analytics are added. The Project Financial Summary is a report page, not a dashboard widget.
- Existing report behavior is unchanged.

---

## Acceptance Checklist for Optional Project Cash/Bank Movement View (Report E)

If this report is implemented in a later sub-chunk, it is accepted only if:

- The endpoint correctly uses line-level project/cost-center metadata on the same cash/bank/MFS voucher line, not opposite-line filters.
- The filter labels accurately describe the line-level behavior.
- Cash/Bank/MFS separation is preserved (CASH, BANK, MFS are separate types).
- Existing Cash Book, Bank Book, and MFS Book behavior is unchanged.
- The report is clearly labeled as showing cash/bank/MFS movements **directly tagged** with the project.

---

## Regression Criteria

All existing acceptance criteria from Phase 2F, 2E, 2D, 2C, 2A, and 1A continue to pass after Phase 2G implementation:

- All seven existing backend report endpoints return correct results.
- All seven existing frontend report pages render correctly (Ledger, Cash Book, Bank Book, MFS Book, Trial Balance, Income Statement, Balance Sheet).
- Voucher create, post, and print functionality works unchanged.
- Cash Book shows only CASH transactions.
- Bank Book shows only BANK transactions.
- MFS Book shows only MFS transactions.
- Trial Balance total debits equal total credits.
- Income Statement net profit calculation is correct.
- Balance Sheet balance check (both unadjusted and P/L-adjusted) is correct.
- MFS account setup and MFS Book page work unchanged.
- Voucher posting rejects MFS cash-bank accounts (MFS posting remains deferred).
- Voucher line dynamic field visibility works unchanged.
- Report filter UX clarity (advanced filters on Cash/Bank/MFS Book) works unchanged.

---

## Explicit Non-Acceptance Conditions

Phase 2G requirement lock and future implementation are NOT accepted if:

- MFS is forced under BANK or CASH account type.
- Cash Book or Bank Book shows MFS transactions.
- MFS voucher posting support is added without explicit approval.
- New roles are introduced.
- PDF/Excel export is added.
- Dashboard analytics are added (the Project Financial Summary is a report page, not a dashboard widget).
- Party/customer/vendor module is added.
- Closing-entry automation is added.
- Editable project ledger, project cost, cost center summary, or project financial summary tables are added to the Prisma schema.
- Direct posted voucher editing is enabled.
- Prisma schema is changed without explicit justification.
- A migration is created without explicit justification.
- Existing report API contracts are broken.
- Project reports include lines where `VoucherLine.projectId` does not match the selected project.
- Project Cost Report mixes asset totals with expense totals without explicit labels.
- Cost Center Summary includes cost centers that do not belong to the selected project.
- Project Cash/Bank Movement View mislabels line-level filters as opposite-line filters.
- Business seed data containing real passwords, real wallet numbers, or private business data is added.

---

## Verification Commands

Run these commands for Phase 2G documentation lock:

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
git log --oneline -10
```

Since this is documentation-only, source behavior must remain unchanged. All verification commands should pass without any new errors or warnings introduced by the Phase 2G documentation.
