# Phase 2G: Project/Cost-Center Financial Reporting Implementation Plan

## Purpose

Phase 2G plans the implementation of four primary project/cost-center financial reports and one optional sub-view based on the Phase 2G requirement lock. This document splits the implementation into safe, reviewable chunks so each step can be verified before the next begins.

This is a planning document only. It does not change schema, API, frontend, roles, seed data, or any runtime behavior.

## Prerequisite

Phase 2G requirement lock is complete and accepted. The following docs define what Phase 2G must implement:

- `docs/requirements/phase-2g-project-cost-center-reporting-requirement-lock.md`
- `docs/acceptance/phase-2g-acceptance-criteria.md`

Phase 2G must not add anything beyond what is locked in those documents.

## Confirmed Constraints

- Only `ACCOUNTANT` role exists. No additional roles.
- No dashboard analytics, no payroll, no parties/customers/vendors.
- No file uploads, no business seed data, no approval workflow.
- No report tables as primary source; all reports derive from posted VoucherLine records.
- No PDF or Excel export. Browser print foundation continues.
- No MFS voucher posting support.
- Cash Book remains CASH-only. Bank Book remains BANK-only. MFS Book remains MFS-only.
- All four primary reports require `projectId` as a mandatory filter.
- Cost center dropdown must scope to the selected project.
- Asset-class totals must be labeled separately from Expense-class totals.
- Existing seven report endpoints must not regress.

---

## Chunk Overview

| Chunk | Objective | Risk Level |
| --- | --- | --- |
| 2G-1 | Backend Project Ledger API + minimal frontend Project Ledger page | Medium |
| 2G-2 | Backend Project Cost Report API + frontend Project Cost Report page | Medium |
| 2G-3 | Backend Cost Center Summary API + frontend Cost Center Summary page | Medium |
| 2G-4 | Backend Project Financial Summary API + frontend Project Financial Summary page | Medium |
| 2G-5 | Review, browser verification, acceptance, docs cleanup | Low |

Report E (Project Cash/Bank Movement View) is optional and may be added as a sub-chunk of 2G-4 or deferred to a later phase.

---

## Chunk 2G-1: Backend Project Ledger API + Frontend Project Ledger Page

### Objective

Add the Project Ledger backend endpoint and a minimal frontend report page. The Project Ledger shows all posted voucher lines attached to a selected project, with running balance, opening balance, and drill-down to voucher detail.

### Scope

Backend: new report endpoint. Frontend: new report page with filters, report display, and print foundation.

### Files to Read Before Implementation

- `apps/api/src/report/report.service.ts` -- understand `resolveReportContext`, `buildLineFilter`, `buildVoucherDateFilter`, `findReportLines`, `sumDebitCredit`, `sumDebitCreditByLedger` patterns.
- `apps/api/src/report/report.controller.ts` -- understand endpoint registration pattern.
- `apps/api/src/report/dto/report-query.dto.ts` -- understand DTO fields and validation.
- `apps/web/src/lib/api.ts` -- understand existing report API helpers and types.
- `apps/web/src/app/app/reports/_lib/report-ui.tsx` -- understand `ReportFilters`, `ReportFiltersConfig`, formatting helpers.
- `apps/web/src/app/app/reports/_lib/useReportReferences.ts` -- understand reference loading pattern.
- `apps/web/src/app/app/reports/_lib/report-print.tsx` -- understand `PrintReportButton` and `ReportPrintFrame`.
- `apps/web/src/app/app/reports/ledger/page.tsx` -- understand single-account report page pattern (closest analogue to Project Ledger).
- `apps/web/src/app/app/layout.tsx` -- understand sidebar navigation pattern.
- `prisma/schema.prisma` -- verify indexes on `voucher_lines.projectId` and `voucher_lines.costCenterId`.

### Files Likely to Change

- `apps/api/src/report/dto/report-query.dto.ts` -- add `projectId` validation (required flag context), `voucherType`, `accountGroupId`, `accountClassCode`, `expenseOnly`.
- `apps/api/src/report/report.service.ts` -- add `getProjectLedger` method.
- `apps/api/src/report/report.controller.ts` -- add `GET /reports/project-ledger` endpoint.
- `apps/web/src/lib/api.ts` -- add `ProjectLedgerReport` type and `getProjectLedgerReport` helper.
- `apps/web/src/app/app/reports/_lib/report-ui.tsx` -- extend `ReportFiltersConfig` for project-required reports.
- `apps/web/src/app/app/reports/project-ledger/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- add Project Ledger navigation link under Reports.

### In-Scope

- `GET /reports/project-ledger` endpoint with `projectId` required, optional cost center, ledger account, voucher type, fiscal year, period/date range.
- Project Ledger frontend page with required project dropdown, fiscal year dropdown, period/date range, optional cost center, ledger, and voucher type filters.
- Opening balance (project-tagged posted movement before selected start date).
- Running balance (cumulative debit minus credit).
- Line detail with date, voucher no, voucher type, ledger code/name, cost center, narration, debit, credit, running balance.
- Drill-down link to voucher detail page.
- Browser print foundation.
- Project dropdown with required marker.

### Out-of-Scope

- Project Cost Report, Cost Center Summary, Project Financial Summary (Chunk 2G-2 through 2G-4).
- Report E (Project Cash/Bank Movement View).
- PDF/Excel export.
- Dashboard analytics.
- Schema changes or migrations.
- MFS voucher posting support.
- New roles.

### Acceptance Checks

- Endpoint returns 400 when `projectId` is missing.
- Endpoint returns 401 for unauthenticated requests.
- Endpoint returns correct data for authenticated ACCOUNTANT with valid filters.
- Draft and soft-deleted vouchers do not appear.
- Cost center filter validates that the cost center belongs to the selected project.
- Lines are ordered by voucher date, then voucher number, then line number.
- Opening balance and running balance are computed correctly.
- Money values use `toFixed(2)` string format.
- Frontend page renders under protected app shell.
- Empty states explain what data is needed.
- Print button appears after report load.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
pnpm check:all
pnpm doctor
```

Manual API smoke tests:

- Unauthenticated `GET /reports/project-ledger` returns 401.
- `GET /reports/project-ledger` without `projectId` returns 400.
- `GET /reports/project-ledger` with valid `projectId` and `fiscalYearId` returns line data.
- Cost center not belonging to project returns 400.

Manual browser smoke tests:

- Login, navigate to `/app/reports/project-ledger`.
- Select a project, fiscal year, submit, see results.
- Print button appears after report load.

### Recommended Model

DeepSeek V4 Pro Max for backend report service implementation. GLM 5.1 High for frontend page integration and verification.

### Stop Condition

All acceptance checks pass. `pnpm check:all` and `pnpm doctor` pass. Docs updated.

---

## Chunk 2G-2: Backend Project Cost Report API + Frontend Project Cost Report Page

### Objective

Add the Project Cost Report backend endpoint and frontend report page. The Project Cost Report summarizes project-tagged posted voucher lines grouped by account class and optionally by cost center, with expense-only toggle.

### Scope

Backend: new report endpoint. Frontend: new report page with filters, grouped report display, and print foundation.

### Files to Read Before Implementation

- All files from Chunk 2G-1 (especially the Project Ledger patterns established there).
- `apps/api/src/report/report.service.ts` -- understand `getIncomeStatement` and `getBalanceSheet` grouping patterns (closest analogue to grouped Project Cost Report).
- `apps/web/src/app/app/reports/income-statement/page.tsx` -- understand grouped financial statement page pattern.
- `apps/web/src/app/app/reports/trial-balance/page.tsx` -- understand grouped summary page pattern.

### Files Likely to Change

- `apps/api/src/report/dto/report-query.dto.ts` -- add `accountGroupId`, `accountClassCode`, `expenseOnly` fields (if not already added in 2G-1).
- `apps/api/src/report/report.service.ts` -- add `getProjectCost` method.
- `apps/api/src/report/report.controller.ts` -- add `GET /reports/project-cost` endpoint.
- `apps/web/src/lib/api.ts` -- add `ProjectCostReport` type and `getProjectCostReport` helper.
- `apps/web/src/app/app/reports/project-cost/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- add Project Cost Report navigation link under Reports.

### In-Scope

- `GET /reports/project-cost` endpoint with `projectId` required, optional `accountGroupId`, `accountClassCode`, `expenseOnly`, cost center, fiscal year, period/date range.
- Report grouped by account class (Asset, Liability, Equity, Income, Expense), then by account group, then by ledger account within each class.
- Optional grouping toggle: by account class vs by cost center.
- Section totals for each account class.
- Grand total row.
- `expenseOnly` toggle: when set, show only EXPENSE and ASSET-class lines.
- Asset-class total labeled separately from Expense-class total.
- Frontend page with filters, grouping toggle, report display, print foundation.

### Out-of-Scope

- Project Ledger (completed in 2G-1).
- Cost Center Summary, Project Financial Summary (Chunks 2G-3, 2G-4).
- Report E.
- PDF/Excel export.
- Dashboard analytics.
- Schema changes or migrations.

### Acceptance Checks

- Endpoint returns 400 when `projectId` is missing.
- Endpoint returns 401 for unauthenticated requests.
- Rows are correctly grouped by account class and account group.
- Section totals match sum of rows within each section.
- Grand total matches sum of all sections.
- `expenseOnly` toggle correctly filters to EXPENSE and ASSET classes only.
- Asset-class section is labeled "Project Asset (Land/Development)" or similar, not mixed with Expense.
- Optional cost center filter validates project membership.
- Money values use `toFixed(2)` string format.
- Frontend page renders under protected app shell with project filter (required).
- Grouping toggle works.
- Print button appears after report load.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
pnpm check:all
pnpm doctor
```

Manual API smoke tests:

- Unauthenticated returns 401.
- Missing `projectId` returns 400.
- Valid `projectId` + `fiscalYearId` returns grouped data.
- `expenseOnly=true` returns only EXPENSE and ASSET-class rows.
- Invalid `accountClassCode` returns 400 or empty section.

Manual browser smoke tests:

- Login, navigate to `/app/reports/project-cost`.
- Select project, fiscal year, submit, see grouped results.
- Toggle grouping mode.
- Toggle expense-only.
- Print button appears after report load.

### Recommended Model

DeepSeek V4 Pro Max for backend grouping/aggregation. Opus 4.8 only if complex UX/integration needed (grouping toggle). GLM 5.1 High for review/acceptance.

### Stop Condition

All acceptance checks pass. `pnpm check:all` and `pnpm doctor` pass. Docs updated.

---

## Chunk 2G-3: Backend Cost Center Summary API + Frontend Cost Center Summary Page

### Objective

Add the Cost Center Summary backend endpoint and frontend report page. The Cost Center Summary shows cost-center-wise totals under a selected project, with drill-down to Project Ledger.

### Scope

Backend: new report endpoint. Frontend: new report page with filters, summary table, and print foundation.

### Files to Read Before Implementation

- All files from Chunks 2G-1 and 2G-2 (established patterns).
- `apps/api/src/report/report.service.ts` -- understand `sumDebitCreditByLedger` and grouping patterns.

### Files Likely to Change

- `apps/api/src/report/report.service.ts` -- add `getCostCenterSummary` method.
- `apps/api/src/report/report.controller.ts` -- add `GET /reports/cost-center-summary` endpoint.
- `apps/web/src/lib/api.ts` -- add `CostCenterSummaryReport` type and `getCostCenterSummaryReport` helper.
- `apps/web/src/app/app/reports/cost-center-summary/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- add Cost Center Summary navigation link under Reports.

### In-Scope

- `GET /reports/cost-center-summary` endpoint with `projectId` required, optional cost center, ledger/account group, fiscal year, period/date range.
- Cost center rows showing: code, name, debit total, credit total, net movement, number of voucher lines, last transaction date.
- "Unassigned" row for project-tagged lines without a cost center.
- Only cost centers belonging to the selected project appear.
- Drill-down link to Project Ledger filtered by that cost center.
- Frontend page with project filter (required), fiscal year filter, optional cost center, print foundation.

### Out-of-Scope

- Project Ledger, Project Cost Report (completed in 2G-1, 2G-2).
- Project Financial Summary (Chunk 2G-4).
- Report E.
- PDF/Excel export.
- Dashboard analytics.
- Schema changes or migrations.

### Acceptance Checks

- Endpoint returns 400 when `projectId` is missing.
- Endpoint returns 401 for unauthenticated requests.
- Only cost centers belonging to the selected project appear.
- Cost center totals match sum of posted voucher lines tagged with that cost center.
- "Unassigned" row appears if project has lines without cost centers.
- Optional cost center filter validates project membership.
- Money values use `toFixed(2)` string format.
- Number of voucher lines is an integer count.
- Last transaction date is formatted as ISO date slice.
- Frontend page renders under protected app shell.
- Drill-down link navigates to Project Ledger with the cost center pre-filtered.
- Print button appears after report load.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
pnpm check:all
pnpm doctor
```

Manual API smoke tests:

- Unauthenticated returns 401.
- Missing `projectId` returns 400.
- Valid request returns cost center rows.
- Cost center not belonging to project returns 400.

Manual browser smoke tests:

- Login, navigate to `/app/reports/cost-center-summary`.
- Select project, fiscal year, submit, see cost center rows.
- Drill-down link navigates to Project Ledger page.
- Print button appears after report load.

### Recommended Model

DeepSeek V4 Pro Max for backend aggregation. GLM 5.1 High for frontend page and review.

### Stop Condition

All acceptance checks pass. `pnpm check:all` and `pnpm doctor` pass. Docs updated.

---

## Chunk 2G-4: Backend Project Financial Summary API + Frontend Project Financial Summary Page

### Objective

Add the Project Financial Summary backend endpoint and frontend page. The Project Financial Summary shows a management-level summary card/table for a selected project, including per-account-class breakdown, expense/asset/income totals, cash/bank movement, and inline cost center breakdown.

### Scope

Backend: new report endpoint. Frontend: new report page with summary card, class breakdown, and print foundation.

### Files to Read Before Implementation

- All files from Chunks 2G-1 through 2G-3 (established patterns).
- `apps/api/src/report/report.service.ts` -- understand `computeCurrentPeriodPL` pattern for per-class breakdown.
- `apps/web/src/app/app/reports/balance-sheet/page.tsx` -- understand section-based financial statement page pattern (closest analogue to summary card/table).

### Files Likely to Change

- `apps/api/src/report/report.service.ts` -- add `getProjectFinancialSummary` method.
- `apps/api/src/report/report.controller.ts` -- add `GET /reports/project-financial-summary` endpoint.
- `apps/web/src/lib/api.ts` -- add `ProjectFinancialSummaryReport` type and `getProjectFinancialSummaryReport` helper.
- `apps/web/src/app/app/reports/project-financial-summary/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- add Project Financial Summary navigation link under Reports.

### In-Scope

- `GET /reports/project-financial-summary` endpoint with `projectId` required, fiscal year, period/date range.
- Summary data: total debit, total credit, net movement.
- Per-account-class breakdown (Asset, Liability, Equity, Income, Expense) with debit total, credit total, signed net movement for each class.
- Expense-class total labeled "Project Operating Expense".
- Asset-class total labeled "Project Asset (Land/Development)".
- Income-class total shown even when zero.
- Cash/bank movement section: sum of project-tagged lines that also carry `cashBankAccountId`.
- Inline cost center breakdown (reuse Cost Center Summary data).
- Frontend page with summary card, class breakdown table, cost center breakdown, print foundation.

### Out-of-Scope

- Report E (Project Cash/Bank Movement View) -- optional, may be added as sub-chunk or deferred.
- PDF/Excel export.
- Dashboard analytics.
- Schema changes or migrations.

### Optional Sub-Chunk: Report E (Project Cash/Bank Movement View)

If the accountant requests cash/bank visibility per project, this can be added as a sub-chunk of 2G-4:

- New endpoint `GET /reports/project-cash-bank-movement` or extend Project Financial Summary with a cash/bank movement section.
- Must use line-level project/cost-center metadata on the same cash/bank/MFS voucher line.
- Must label the filter behavior accurately (line-level, not opposite-line).
- CASH, BANK, and MFS types must be separate.

If not requested, Report E is deferred to a later phase.

### Acceptance Checks

- Endpoint returns 400 when `projectId` is missing.
- Endpoint returns 401 for unauthenticated requests.
- Per-account-class breakdown is correct (debit total, credit total, signed net movement for each class).
- Expense-class total and Asset-class total are labeled separately.
- Income-class total is shown even when zero.
- Cash/bank movement shows only lines with both `projectId` and `cashBankAccountId`.
- Inline cost center breakdown matches Cost Center Summary data for the same project.
- Money values use `toFixed(2)` string format.
- Frontend page renders under protected app shell with project filter (required).
- Empty states explain what data is needed.
- Print button appears after report load.
- No dashboard widget is added.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
pnpm check:all
pnpm doctor
```

Manual API smoke tests:

- Unauthenticated returns 401.
- Missing `projectId` returns 400.
- Valid request returns summary with class breakdown.
- Expense and Asset totals are labeled correctly.
- Income section shows zero when no project-tagged income exists.

Manual browser smoke tests:

- Login, navigate to `/app/reports/project-financial-summary`.
- Select project, fiscal year, submit, see summary card and class breakdown.
- Cost center breakdown section visible.
- Print button appears after report load.

### Recommended Model

DeepSeek V4 Pro Max for backend summary computation. GLM 5.1 High for frontend summary page. Opus 4.8 only if the summary UX requires complex layout decisions.

### Stop Condition

All acceptance checks pass. `pnpm check:all` and `pnpm doctor` pass. Docs updated.

---

## Chunk 2G-5: Review, Browser Verification, Acceptance, Docs Cleanup

### Objective

Full integration review across all Phase 2G chunks. Verify scope boundaries, accounting correctness, security, regression, and documentation completeness. Update docs to reflect Phase 2G completion.

### Scope

Review and documentation only. No code changes unless a review bug is found.

### Files to Read

- All Phase 2G implementation files (report service, controller, DTO, frontend pages, API types).
- All Phase 2G documentation (requirement lock, acceptance criteria, plan).
- `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

### Files Likely to Change

- `docs/requirements/phase-2g-project-cost-center-reporting-requirement-lock.md` -- no change (already locked).
- `docs/acceptance/phase-2g-acceptance-criteria.md` -- no change (already locked).
- `docs/plans/phase-2g-project-cost-center-reporting-plan.md` -- no change (already locked).
- `AGENTS.md` -- update to reflect Phase 2G acceptance.
- `README.md` -- update to reflect Phase 2G completion.
- `docs/ai/START_HERE.md` -- update to reflect Phase 2G acceptance.
- `docs/ai/CURRENT_STATE.md` -- update to reflect Phase 2G completion.
- `docs/handoff.md` -- update to reflect Phase 2G acceptance and handoff.

### In-Scope

- Verify all four new report endpoints are guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- Verify all reports derive only from posted voucher lines (`Voucher.status = POSTED`, `Voucher.isDeleted = false`).
- Verify project/cost-center filter behavior matches requirement lock.
- Verify Cost Center Summary only shows cost centers belonging to the selected project.
- Verify Project Cost Report separates Asset-class from Expense-class totals.
- Verify Project Financial Summary shows all five account classes.
- Verify existing seven report endpoints still work correctly (regression test).
- Verify voucher create, post, and print still works.
- Verify Cash Book remains CASH-only, Bank Book BANK-only, MFS Book MFS-only.
- Verify MFS voucher posting is still rejected.
- Verify only `ACCOUNTANT` role exists.
- Verify auth uses HttpOnly cookies, no localStorage token usage.
- Verify no Prisma schema changes beyond the approved scope.
- Manual API smoke tests for all four new endpoints.
- Manual browser smoke tests for all four new frontend pages.
- Documentation updates.

### Out-of-Scope

- Any new features beyond Phase 2G scope.
- PDF/Excel export.
- Dashboard analytics.
- New roles.
- MFS voucher posting support.
- Demo/test data cleanup implementation.

### Acceptance Checks

- All 2G-1 through 2G-4 acceptance checks still pass.
- No scope creep beyond the Phase 2G requirement lock.
- All existing report endpoints and pages work unchanged.
- All verification commands pass.

### Verification Commands

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
docker compose config
pnpm check:all
pnpm doctor
```

Manual API smoke tests for all new endpoints plus regression on existing endpoints.

Manual browser smoke tests for all new pages plus regression on existing pages.

### Recommended Model

GLM 5.1 High for review/acceptance. DeepSeek V4 Flash/Low for small docs/fixups.

### Stop Condition

All review goals pass. All verification commands pass. Docs updated. Phase 2G is accepted.

---

## Summary

Phase 2G adds four project/cost-center financial reports (Project Ledger, Project Cost Report, Cost Center Summary, Project Financial Summary) plus one optional sub-view (Project Cash/Bank Movement View) to transform the `projectId` and `costCenterId` dimensions on posted voucher lines into useful accounting summaries. Implementation is split into five chunks (2G-1 through 2G-5), each building on the previous. All reports derive from posted voucher lines only. No schema change is expected. No new roles. No editable report tables. The plan reuses existing report patterns (resolveReportContext, buildLineFilter, buildVoucherDateFilter, Decimal-safe computation, cookie-authenticated API, browser print foundation) and extends the ReportQueryDto and ReportService for the new endpoints.
