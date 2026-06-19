# Current State

## Phase 2L Chunk 2L-1: Voucher Reversal / Rectification Workflow Requirement Lock - this session

Phase 2L Voucher Reversal / Rectification Workflow requirement lock is complete.
- Created `docs/requirements/phase-2l-voucher-reversal-rectification-requirement-lock.md`: defines reversal symmetry rules, metadata copy rules, mandatory justification, draft lifecycle, UI badge and banners on both original and reversed vouchers, and open/closed period validation constraints.
- Created `docs/acceptance/phase-2l-acceptance-criteria.md`: defines acceptance criteria for linkage, endpoint logic, swaps, UX buttons and banners, report nets, and validation scripts.
- Created `docs/plans/phase-2l-voucher-reversal-rectification-plan.md`: defines five implementation chunks (2L-1 to 2L-5).
- Updated status files (`AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`).
- Confirmed no changes to database schema, migrations, backend code, frontend logic, or demo scripts.

## Phase 2K Chunk 2K-5 Final Acceptance and Docs Cleanup - previous session

Phase 2K Voucher Fund-Line Project Tagging is complete and accepted at commit `91fd742` with tag `phase-2k-complete`.
- Cleaned up guide files (`AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`).
- Confirmed readiness for user-created tag `phase-2k-complete`.
- Listed all implemented chunks (2K-1 through 2K-5) in relevant state files.
- Preserved all Phase 2K rules (optional selectors, same-line Option A logic, no double-counting, JOURNAL MFS restriction, posted vouchers read-only).
- Verified end-to-end regression testing with temporary local vouchers, restored the deterministic demo dataset, and passed all checks (`demo:audit` 62 PASS, `demo:verify` 47 PASS).
- Confirmed no changes to database schema, migrations, backend code, frontend logic, or demo scripts.

## Phase 2K Chunk 2K-4 Browser/API/Report Regression Verification - previous session

Phase 2K Chunk 2K-4 Browser/API/Report Regression Verification is complete.
- Ran baseline CLI verification tests successfully (typecheck, lint, build, config, doctor, and read-only demo audit/verify).
- Built and executed a programmatic end-to-end integration test (`scratch/test-fund-tagging.ts`) that logged in as accountant, posted a temporary PAYMENT voucher with project-tagged Cash/Bank fund lines, and verified correct API/report responses:
  - The Project Fund Movement report correctly shows explicitly project-tagged Cash/Bank lines with proper inflow/outflow directions and updated running balance.
  - The Project Cost report correctly includes the expense lines but excludes the project-tagged cash lines, confirming **no double-counting**.
  - Untagged fund lines (like base demo PAYMENT-00001) remain excluded from the Project Fund Movement view under strict same-line logic (Option A).
  - JOURNAL vouchers correctly reject MFS accounts, and existing MFS/ledger cleanup behavior works.
- Fully restored the deterministic demo dataset using the safe demo reset flow (`pnpm demo:reset`) and verified that the database baseline is unchanged (`demo:audit` 62 PASS, `demo:verify` 47 PASS).
- Confirmed no changes to database schema, migrations, backend code, frontend logic, or demo scripts.

## Phase 2K Chunk 2K-3 Frontend Voucher Form Update - previous session

Phase 2K Chunk 2K-3 Frontend Voucher Form Update is complete.
- Updated `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx` to conditionally render optional Project and Cost Center selectors on Cash, Bank, and MFS lines for PAYMENT, RECEIPT, and CONTRA vouchers.
- Updated `deriveVoucherLineFieldRequirements` in `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx` to accept the `voucherType` parameter and customize guidance text for Cash/Bank/MFS lines: `"Cash/Bank/MFS account is required. Project and cost center are optional for fund-line tagging (enables fund visibility in Project Fund Movement report)."`.
- Confirmed Cost Center dropdown is scoped to the selected project on the line and disabled if the project selector is shown but no project is selected yet.
- Preserved all state cleanup rules: switching the ledger away from Cash/Bank/MFS clears `projectId`/`costCenterId`; clearing `projectId` clears `costCenterId`; changing `projectId` clears invalid `costCenterId`; switching voucher type to `JOURNAL` clears `projectId` and `costCenterId` from Cash/Bank lines and filters out/clears MFS cash bank accounts.
- Confirmed no automatic project inference, sibling line copying, or silent allocation.
- Confirmed posted vouchers remain read-only.
- Verified all workspace CLI checks, build, typecheck, lint, and demo audit/verification pass.

## Phase 2K Chunk 2K-2 Backend Validation Audit / Support - previous session

Phase 2K Chunk 2K-2 Backend Validation Audit / Support is complete.
- Audited NestJS backend DTOs (`VoucherLineDto` in `apps/api/src/voucher/dto/voucher-line.dto.ts`) and confirmed that `projectId` and `costCenterId` are optional and no rules block them when `cashBankAccountId` is present.
- Audited backend validation logic (`validatePostingLine` in `apps/api/src/voucher/voucher.service.ts`) and confirmed that Cash/Bank/MFS lines can carry `projectId` and `costCenterId`.
- Verified that if `projectId` is provided, it must exist and be active.
- Verified that if `costCenterId` is provided with `projectId`, the cost center must belong to the selected project.
- Verified that if `costCenterId` is provided without `projectId`, it follows the existing validation convention and does not throw if `projectId` is absent.
- Confirmed that MFS `cashBankAccountId` remains strictly rejected on `JOURNAL` vouchers.
- Confirmed that `PAYMENT`, `RECEIPT`, and `CONTRA` allow MFS according to Phase 2I.
- Confirmed cash/bank account ledger mismatch validation remains intact, and non-cash-bank ledgers cannot carry `cashBankAccountId`.
- Confirmed posted vouchers remain immutable.
- This is a no-code backend audit: backend support is already fully present, and no code edits were required.
- Verified all workspace CLI checks and demo audit/verification pass.

## Phase 2K Chunk 2K-1 Voucher Fund-Line Project Tagging Requirement Lock - previous session

Phase 2K Voucher Fund-Line Project Tagging requirement lock is complete.
- Locked business rules (Option A same-line only, explicit tagging only, no auto-inference/copying, no silent allocation).
- Defined frontend UX enhancement (optional project and cost center dropdowns on Cash, Bank, and MFS lines with descriptive hints and helper text).
- Verified backend validation (NestJS DTO and validation logic already accept optional `projectId` and `costCenterId` on cash/bank/MFS lines; no changes needed).
- Defined out-of-scope items (no schema changes, no migrations, no voucher-level project fields, no automatic splitting).
- Kept deterministic base demo dataset unchanged.
- Created `docs/requirements/phase-2k-voucher-fund-line-project-tagging-requirement-lock.md`.
- Created `docs/acceptance/phase-2k-acceptance-criteria.md`.
- Created `docs/plans/phase-2k-voucher-fund-line-project-tagging-plan.md`.

## Phase 2J Chunk 2J-5 Final Acceptance and Docs Cleanup - previous session

Phase 2J Project Fund Movement View is complete and accepted at commit `98212ba` (tag `phase-2j-complete`).
- Implemented and verified all chunks (2J-1 through 2J-5).
- Project Fund Movement View uses Option A strict same-line only logic.
- Only Cash, Bank, or MFS voucher lines explicitly tagged with the project are included. No sibling-line or voucher-level inference.
- Base demo SK-001 returns empty Project Fund Movement rows intentionally because cash/bank/MFS lines have no projectId.
- Existing reports remain unchanged.
- No schema/migration/demo dataset changes.
- Final docs cleanup completed.

## Phase 2J Chunk 2J-3 Frontend Report Page - previous session

Phase 2J Chunk 2J-3 Frontend Report Page is implemented.
- Created the frontend report page at `/app/reports/project-fund-movement`.
- Added the "Project Fund Movement" navigation link with `Coins` icon under reports in `apps/web/src/app/app/layout.tsx`.
- Extended the shared `ReportFilters` component in `apps/web/src/app/app/reports/_lib/report-ui.tsx` to support the `showAccountType` config rendering the CASH | BANK | MFS | ALL selector.
- Exposed required type definitions (`ProjectFundMovementReportLine`, `ProjectFundMovementReport`), query parameters, and helper fetcher `getProjectFundMovementReport` in `apps/web/src/lib/api.ts`.
- Structured the report page to require `projectId` and `fiscalYearId`, prompting user selection if absent.
- Handled empty state with Option A strict same-line tracking message: *"No project fund movement lines found. This report follows strict same-line tracking: only Cash, Bank, or MFS voucher lines that are explicitly tagged with the selected project are shown. If a voucher tags only the expense line but not the cash/bank/MFS line, it will not appear here."*
- Rendered accountant warning notice: *"Important: This view does not infer project movement from sibling voucher lines."*
- Displayed summary cards with Opening Balance, Period Inflow (debit), Period Outflow (credit), Closing Balance, and Line Count.
- Rendered transaction table with date, voucher no, voucher type, fund ledger, cash/bank/mfs account, project, cost center, particular / narration, inflow, outflow, and running balance.
- Integrated print preview using `ReportPrintFrame` and `PrintReportButton`.
- Omitted `voucherType` parameter when selecting all voucher types to satisfy backend DTO validation.
- No schema changes, database migrations, or backend logic alterations were made.

Verification:
- `pnpm check:all` PASS
- `pnpm doctor` PASS (all ok, warnings only on port 4000 already running)
- `pnpm demo:audit` PASS (62 pass, 0 fail)
- `pnpm demo:verify` PASS (47 pass, 0 fail)

## Phase 2J Chunk 2J-2 Backend Report API - previous session

Phase 2J Chunk 2J-2 Backend Report API is implemented.
- Added `GET /reports/project-fund-movement` endpoint guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required; returns 400 Bad Request if missing.
- Option A accounting rule (strict same-line only) is implemented: cash/bank/MFS movement is considered project-related only if the cash/bank/MFS voucher line itself has the `projectId`. No voucher-level inference, sibling line lookup, or expense line lookup is performed.
- Cumulative running balance and opening/closing balances are computed chronologically starting from opening balance (cumulative debits minus credits before `startDate`).
- Returns structured JSON payload containing metadata/filters, totals (periodDebit, periodCredit, netMovement), opening/closing balance, and lines array.
- Flat and nested fields are both provided for ledgerAccount, project, costCenter, and cashBankAccount.
- Mapped `dateFrom` to `startDate` and `dateTo` to `endDate` query parameters for fallback support.
- Base deterministic demo dataset produces empty results for `SK-001` under Option A because the cash line does not have `projectId`, which is intentional and expected.
- No schema changes, database migrations, frontend changes, voucher posting changes, or demo dataset modifications were made.

Verification:
- `pnpm check:all` PASS
- `pnpm doctor` PASS
- `pnpm demo:audit` PASS (62 pass, 0 fail)
- `pnpm demo:verify` PASS (47 pass, 0 fail)
- API smoke tests verified correct response structure, date mapping, missing projectId validation (400), invalid accountType validation (400), and empty lines array for base dataset.

Files changed:
- `apps/api/src/report/dto/report-query.dto.ts`
- `apps/api/src/report/report.controller.ts`
- `apps/api/src/report/report.service.ts`

## Phase 2J Chunk 2J-1 Requirement Lock - previous session

Phase 2J Project Fund Movement View requirement lock is complete. 
The chosen rule is Option A (strict same-line only): A cash/bank/MFS movement is considered project-related only if the cash/bank/MFS voucher line itself has the `projectId`. This prevents hidden project inference and avoids schema changes.
The report will read strictly from POSTED VoucherLine records where `isCashBank = true` and `projectId` is present.
The deterministic demo dataset remains unchanged for now.

Files created:
- `docs/requirements/phase-2j-project-fund-movement-requirement-lock.md`
- `docs/acceptance/phase-2j-acceptance-criteria.md`
- `docs/plans/phase-2j-project-fund-movement-plan.md`

Docs updated to reflect Phase 2J: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

No schema changes, migrations, backend API endpoints, frontend pages, or runtime logic were added.

## Phase 2I Chunk 2I-5 Final Review and Docs Cleanup - previous session

Phase 2I Chunk 2I-5 final review and docs cleanup is complete. Phase 2I is complete and accepted at `10d6869` (tag `phase-2i-complete`).

Scope check confirmed: PAYMENT supports MFS; RECEIPT supports MFS; CONTRA supports CASH/BANK/MFS; JOURNAL rejects MFS; frontend prevents MFS on JOURNAL; MFS Book shows MFS movements; Cash Book remains CASH-only; Bank Book remains BANK-only; Project reports do not double-count MFS; base deterministic demo dataset unchanged; no schema/migration; no provider API/payment gateway/customer wallet work.

CLI verification: prisma:generate PASS, typecheck PASS, lint PASS, build:web PASS, build:api PASS, docker compose config PASS, check:all PASS, doctor PASS (Docker/Desktop not running, port warnings only). demo:audit and demo:verify could not run because Docker Desktop was not running in the session; these require a running PostgreSQL and are expected to pass when Docker is available.

Browser/API smoke: skipped because Docker Desktop was not running. Previous 2I-4 local smoke tests confirmed PAYMENT/RECEIPT/CONTRA MFS posting, JOURNAL MFS rejection, MFS Book MFS-only, Cash Book CASH-only, Bank Book BANK-only, Trial Balance balanced, Project reports correct.

Docs updated: AGENTS.md, README.md, docs/ai/START_HERE.md, docs/ai/CURRENT_STATE.md, docs/handoff.md.

Implemented chunks:
- 2I-1: requirement lock and acceptance docs
- 2I-2: backend MFS posting (PAYMENT/RECEIPT/CONTRA accept MFS; JOURNAL rejects MFS)
- 2I-3: frontend MFS voucher UI (MFS account selection, JOURNAL MFS prevention, MFS metadata display)
- 2I-4: report regression and demo extension decision (MFS Book MFS-only, Cash/Bank Books unchanged, base dataset unchanged, optional MFS scenario deferred)
- 2I-5: final review and docs cleanup

Phase 2I is complete and accepted.

## Completed Phase

Phase 0 is complete and accepted.

Phase 1A is implemented: multi-agent project continuity plus single-accountant authentication.

Phase 1B requirement/specification lock is complete.

Phase 2A accounting foundation is complete and accepted.

Phase 2B voucher requirement/specification lock is complete.

Phase 2C voucher engine is complete and accepted.

Phase 2D accounting reports are complete and accepted.

Phase 2E MFS / bKash transaction support is complete and accepted (MFS account setup + MFS Book foundation).

Phase 2F Accounting Report + Accountant UX Refinement is complete and accepted at `17fede6` (tag `phase-2f-complete`). Issues A-D implemented, Issue E mostly addressed, Issue F deferred to Phase 2H.

Phase 2G Project/Cost-Center Financial Reporting is complete and accepted at `7e60a1f` (tag `phase-2g-complete`).

Phase 2H Demo/Test Data Cleanup and Safe Demo Dataset Standardization is complete and accepted at `96fb653` (tag `phase-2h-complete`).

Phase 2I MFS Voucher Posting Continuation is complete and accepted at `10d6869` (tag `phase-2i-complete`).

Phase 2J Project Fund Movement View is complete and accepted at commit `98212ba` (tag `phase-2j-complete`).


## Phase 2I Chunk 2I-4 Report Regression and Demo Extension Decision - this session

Phase 2I Chunk 2I-4 report regression verification and demo extension decision is complete. Local MFS smoke tests confirmed end-to-end MFS posting and report correctness:

Smoke results:
- A. PAYMENT with MFS credit line (Dr 5010 3,000, Cr 1030 bKash 3,000): POSTED. MFS Book shows credit 3,000. Cash Book unaffected.
- B. RECEIPT with MFS debit line (Dr 1030 bKash 10,000, Cr 3010 10,000): POSTED. MFS Book shows debit 10,000. Cash/Bank Books unaffected.
- C. CONTRA with MFS+BANK (Dr 1030 bKash 5,000, Cr 1020 City Bank 5,000): POSTED. MFS Book shows debit 5,000. Bank Book shows credit 5,000. Cash Book unaffected.
- D. JOURNAL with MFS cashBankAccountId: REJECTED with "MFS accounts are not allowed on Journal voucher lines. Use Payment, Receipt, or Contra for MFS transactions."
- E. Mismatched ledger/cashBankAccount pair: REJECTED with "cash/bank account can only be used with a cash/bank ledger account."
- E2. Non-cash-bank ledger with cashBankAccountId: REJECTED with same error.

Report regression with MFS vouchers posted:
- MFS Book: 3 lines, periodDebit 15,000, periodCredit 3,000, closing 12,000 Dr. Shows only MFS movements.
- Cash Book: 2 lines (no MFS lines), closing 50,000 Dr. CASH-only. Unchanged from base.
- Bank Book: 1 line (CONTRA bank credit 5,000), no MFS lines. BANK-only.
- Trial Balance: balanced (diff 0.00, closing 115,000).
- Balance Sheet: adjusted balanced.
- Project Ledger: 2 lines (base 50,000 expense + MFS 3,000 expense).
- Project Cost: expense 53,000 (no double-count).
- Cost Center Summary: SK-LD once, 53,000, no Unassigned row.
- Project Financial Summary: expense 53,000, asset 0, income 0.

Deterministic demo dataset restored after smoke. demo:verify 47 PASS, 0 FAIL. No MFS posted voucher lines remain.

Demo extension decision: base deterministic dataset remains unchanged for Phase 2I. Optional MFS demo scenario deferred unless user approves. The base dataset is stable for regression and MFS posting is verified with temporary smoke.

No runtime source changes, schema changes, migrations, report logic changes, or demo dataset changes were made. Only docs updated (CURRENT_STATE.md, handoff.md).

## Phase 2I Chunk 2I-3 Frontend MFS Voucher UI - previous session

Phase 2I Chunk 2I-3 frontend MFS voucher UI support is implemented. The voucher form supports MFS account selection for PAYMENT, RECEIPT, and CONTRA; JOURNAL prevents MFS selection with a clear guidance message. MFS accounts display provider/wallet metadata in the dropdown. Phase 2F dynamic field behavior is preserved.

Changed:
- `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx`: enhanced `cashBankLabel` to show MFS provider/wallet metadata; added `providerDisplayName`, `isMfsCashBankAccount`, and `filterCashBankAccountsByVoucherType` helpers.
- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx`: MFS accounts filtered out of cashBankAccount selector for JOURNAL voucher type; switching to JOURNAL clears MFS cashBankAccountId from all lines; JOURNAL-specific hint when no eligible accounts remain.
- `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`: updated to reflect 2I-3 completion.

No Prisma schema changes, migrations, backend changes, report changes, demo dataset changes, or new roles were added.

## Phase 2I Chunk 2I-2 Backend MFS Voucher Posting - this session

Phase 2I Chunk 2I-2 backend MFS voucher posting support is implemented. The MFS posting block in `voucher.service.ts` has been removed and replaced with voucher-type-aware MFS acceptance. PAYMENT, RECEIPT, and CONTRA now accept MFS cashBankAccountId; JOURNAL rejects MFS cashBankAccountId with a clear error message. Backend validation remains the authority: cashBankAccount existence/active, ledger-cashBankAccount match, isCashBank requirement, JOURNAL MFS rejection, and non-cash-bank ledger rejection with cashBankAccountId.

Changed:
- `apps/api/src/voucher/voucher.service.ts`: removed MFS posting blocker in `validatePostingLine`; added JOURNAL MFS rejection in `validateVoucherTypeCashBankRules`.
- `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`: updated to reflect 2I-2 completion.

No Prisma schema changes, migrations, frontend changes, report changes, demo dataset changes, or new roles were added.

Smoke tests (6 scenarios, all passed):
1. PAYMENT with MFS credit line: POSTED
2. RECEIPT with MFS debit line: POSTED
3. CONTRA with MFS + CASH lines: POSTED
4. JOURNAL with MFS cashBankAccountId: REJECTED with clear error
5. Mismatched ledger/cashBankAccount: REJECTED
6. Non-cash-bank ledger with cashBankAccountId: REJECTED

Report verification: MFS Book shows MFS movement; Cash Book CASH-only; Bank Book BANK-only. Deterministic demo dataset restored and verified after smoke testing. All verification commands pass: prisma:generate, typecheck, lint, build:web, build:api, docker compose config, check:all, doctor, demo:audit (62 pass), demo:verify (47 pass).

## Phase 2I MFS Voucher Posting Continuation Requirement Lock - previous session

## Phase 2H-4 Final Review and Docs Cleanup - previous session

Phase 2H-4 final integration review and docs cleanup is complete. All three Phase 2H CLI commands (`pnpm demo:audit`, `pnpm demo:reset`, `pnpm demo:verify`) work correctly. The deterministic demo dataset produces all expected report results. Reset safety guards (no-confirmation refusal, dry-run mode, local DB guard, production refusal) all pass. demo:audit and demo:verify are confirmed read-only. demo:reset is confirmed destructive only with explicit confirmation. No schema change, migration, report table, new role, MFS voucher posting change, or runtime API/frontend logic was changed by Phase 2H. Phase 2F Issue F is resolved by Phase 2H.

Docs updated to reflect Phase 2H completion: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

Accepted minor notes for Phase 2H: (1) demo-reset creates deterministic posted vouchers directly through Prisma rather than VoucherService; accepted for local deterministic seed/reset, but not production posting behavior. (2) demo-verify uses direct Prisma reads instead of report HTTP APIs; accepted because it verifies the same posted VoucherLine source data and works offline.

## Phase 2H-3 Demo Verification - completed previous session

Phase 2H-3 Demo Verification (`pnpm demo:verify`) is implemented: a read-only CLI command that asserts the deterministic demo dataset exists and matches expected accounting/report totals. It uses only Prisma read operations (count, findFirst, findMany, aggregate, groupBy) and never creates, updates, or deletes data. It exits with code 0 on all-pass and non-zero on any failure.

Created/Changed:
- `prisma/demo-verify.ts`: new read-only verification script with strict entity, voucher, and accounting/report assertions.
- `package.json`: added `demo:verify` script entry.
- Docs updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

No Prisma schema changes, migrations, backend API endpoints, frontend pages, roles, or runtime code were added.

## Phase 2H-2 Safe Demo Reset - completed previous session

Phase 2H-2 Safe Demo Reset (`pnpm demo:reset`) is implemented: a destructive CLI command with `CONFIRM_DEMO_RESET=YES` guard, local DB guard, production refusal, dry-run mode, and mandatory backup instruction. It resets the local/dev database to a clean deterministic Real Capita demo dataset.

Created/Changed:
- `prisma/demo-reset.ts`: new safe demo reset script with all safety guards, deterministic dataset recreation.
- `package.json`: added `demo:reset` script entry.
- Docs updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

No Prisma schema changes, migrations, backend API endpoints, frontend pages, roles, or runtime code were added.

## Phase 2H-1 Demo Data Audit - this session

Phase 2H-1 Demo Data Audit (`pnpm demo:audit`) is implemented: a read-only CLI command that inspects the current local/dev database and prints a structured audit report. It does not modify data.

1. **Demo Data Audit** (`pnpm demo:audit`) -- read-only report of current demo/test data state, entity counts, duplicate detection, orphan checks, consistency checks, report readiness.
2. **Safe Demo Reset** (`pnpm demo:reset`) -- destructive reset with `CONFIRM_DEMO_RESET=YES` guard, local DB guard, production refusal, dry-run mode, mandatory backup instruction, deterministic dataset recreation.
3. **Deterministic Demo Dataset** -- Company (Real Capita Group, BDT), FY 2025-2026, June 2026, SK-001 Shanti Kutir, SK-LD cost center, 5 ledger accounts (1010 Cash in Hand, 1020 City Bank, 1030 bKash Merchant Wallet, 5010 Land Development Expense, 3010 Capital Introduced), 3 cash/bank/MFS accounts (Office Cash, City Bank Uttara, bKash Merchant), 2 posted vouchers (capital introduction 100,000 JOURNAL, land development expense 50,000 PAYMENT with project/cost center).
4. **Demo Verification** (`pnpm demo:verify`) -- read-only assertion checks for seed user, infrastructure entities, voucher counts, report totals, MFS posting block.

Phase 2H directly addresses Phase 2F Issue F (demo data). The audit script (`prisma/demo-audit.ts`) performs entity counts, demo dataset presence checks, duplicate detection, orphan/consistency checks, report readiness, and deterministic demo report checks. Phase 2H-2 Safe Demo Reset (`pnpm demo:reset`) is implemented: a destructive CLI command with CONFIRM_DEMO_RESET=YES guard, local DB guard, production refusal, dry-run mode, and mandatory backup instruction. It resets the local/dev database to a clean deterministic Real Capita demo dataset. Phase 2H-3 Demo Verification (`pnpm demo:verify`) is implemented: a read-only CLI command that asserts the deterministic demo dataset exists and matches expected accounting/report totals. Phase 2H-4 Docs Cleanup remains deferred.

Created/Changed:
- `prisma/demo-audit.ts`: new read-only audit script.
- `package.json`: added `demo:audit` script entry.
- `docs/requirements/phase-2h-demo-data-cleanup-requirement-lock.md`: defines four tooling capabilities (A: Demo Data Audit, B: Safe Demo Reset, C: Deterministic Demo Dataset, D: Demo Verification), safety-first design, confirmation guards, local DB guards, deterministic dataset specification, expected report results, open questions with recommended answers, and explicit out-of-scope list.
- `docs/acceptance/phase-2h-acceptance-criteria.md`: acceptance for documentation lock, future Demo Data Audit, future Safe Demo Reset, future Demo Verification, docs cleanup, regression criteria, and explicit non-acceptance conditions.
- `docs/plans/phase-2h-demo-data-cleanup-plan.md`: four implementation chunks (2H-1 Demo Audit, 2H-2 Safe Demo Reset, 2H-3 Demo Verify, 2H-4 Docs Cleanup), each with objective, scope, files, safety checks, acceptance checks, verification commands, recommended model, and stop condition.

Updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

No Prisma schema changes, migrations, backend API endpoints, frontend pages, reset scripts, verification scripts, roles, or runtime code changes were added beyond the new audit script.

Phase 2G Chunk 2G-2 Project Cost Report API + Frontend Project Cost Report Page is implemented.

### Backend

- Added `GET /reports/project-cost` endpoint guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required; returns 400 when missing.
- Report derives from posted voucher lines only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`).
- Groups project-tagged lines by cost center, account class, account group, and ledger account.
- Optional filters: `costCenterId`, `ledgerAccountId`, `accountGroupId`, `accountClassCode`, `expenseOnly`.
- `expenseOnly=true` filters to EXPENSE and ASSET class lines only.
- Totals include per-class breakdown: debitTotal, creditTotal, netMovement, expenseTotal, assetProjectCostTotal, incomeTotal, liabilityTotal, equityTotal.
- Added `buildProjectCostLineFilter` helper with separate variable for ledger-account filter composition.
- Added `accountGroupId`, `accountClassCode`, and `expenseOnly` fields to `ReportQueryDto`.

### Frontend

- Added `ProjectCostReport` and `ProjectCostReportRow` types in `apps/web/src/lib/api.ts`.
- Added `getProjectCostReport` helper.
- Added `accountGroupId`, `accountClassCode`, `expenseOnly` to `ReportQueryParams` and `buildReportQuery`.
- Added `showExpenseOnly`, `showAccountClass`, `showAccountGroup` config options and UI controls (account class dropdown, account group dropdown, expense-only checkbox) to `ReportFilters`.
- Added `accountGroups` to `useReportReferences` hook.
- Created `/app/reports/project-cost/page.tsx` with required project + fiscal year filters, optional cost center/ledger/account class/account group/expense-only.
- Page renders summary cards (Total Debit, Total Credit, Net Movement, Project Expense, Project Asset/Cap. Cost, Project Income, Liability, Equity, Line Count, Grouped Rows).
- Table columns: Cost Center, Account Class (with human labels), Account Group, Ledger (with drill-down link to Project Ledger), Debit, Credit, Net Amount, Last Date.
- Class labels: EXPENSE="Project Expense", ASSET="Project Asset / Capitalized Project Cost", INCOME="Project Income", LIABILITY="Liability", EQUITY="Equity".
- Helper text explains asset/expense separation.
- Browser print foundation via `ReportPrintFrame`.
- Added Project Cost Report navigation link under Reports in sidebar.

### Files changed

- `apps/api/src/report/dto/report-query.dto.ts` -- added `accountGroupId`, `accountClassCode`, `expenseOnly` fields.
- `apps/api/src/report/report.service.ts` -- added `getProjectCost` method, `buildProjectCostLineFilter` helper, `ProjectCostRow` type.
- `apps/api/src/report/report.controller.ts` -- added `GET /reports/project-cost` endpoint.
- `apps/web/src/lib/api.ts` -- added `ProjectCostReport`, `ProjectCostReportRow` types, `getProjectCostReport` helper, new query params.
- `apps/web/src/app/app/reports/_lib/report-ui.tsx` -- added `showExpenseOnly`, `showAccountClass`, `showAccountGroup` config, filter controls.
- `apps/web/src/app/app/reports/_lib/useReportReferences.ts` -- added `accountGroups` loading.
- `apps/web/src/app/app/reports/project-cost/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- added Project Cost Report navigation link.

### Not added

- No Prisma schema change, no migration, no report table, no new role.
- No MFS voucher posting support.
- No PDF/Excel export, no dashboard analytics.
- No Cost Center Summary, Project Financial Summary (Chunks 2G-3, 2G-4).

### Verification

All passes: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`.

## Phase 2G Chunk 2G-4 Project Financial Summary - completed this session

Phase 2G Chunk 2G-4 Project Financial Summary API + Frontend Project Financial Summary Page is implemented.

### Backend

- Added `GET /reports/project-financial-summary` endpoint guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required; returns 400 when missing.
- Report derives from posted voucher lines only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`).
- Summarizes project-tagged VoucherLine records by account class (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE) and cost center.
- Returns project metadata, top-level totals (debit, credit, net, lineCount, voucherCount, first/last dates).
- Account-class breakdown: debitTotal, creditTotal, netMovement, lineCount, percentageOfTotalDebit/Credit.
- Management totals: projectExpenseTotal, projectAssetCostTotal, projectIncomeTotal, projectLiabilityTotal, projectEquityTotal, projectCostTotal (expense + asset).
- Cost center breakdown: compact per-cost-center rows with debit, credit, net, expense, asset, income, liability, equity, lineCount, lastTransactionDate.
- Lines without cost center appear as "Unassigned" only when they exist (no double counting).
- Top ledger breakdown: top 10 ledger accounts by absolute net movement.
- Uses `buildProjectCostLineFilter` for consistent filtering.
- Optional filters: `costCenterId`, `ledgerAccountId`, `accountGroupId`, `accountClassCode`.

### Frontend

- Added `ProjectFinancialSummaryReport`, `ProjectFinancialSummaryClassBreakdown`, `ProjectFinancialSummaryManagementTotals`, `ProjectFinancialSummaryCostCenterRow`, `ProjectFinancialSummaryTopLedgerRow` types in `apps/web/src/lib/api.ts`.
- Added `getProjectFinancialSummaryReport` helper.
- Added `PROJECT_FINANCIAL_SUMMARY` and `COST_CENTER_SUMMARY` to `ReportType` union.
- Created `/app/reports/project-financial-summary/page.tsx` with required project + fiscal year filters, optional cost center/ledger/account class/account group.
- Page renders summary cards (Total Debit, Total Credit, Net Movement, Project Cost Total, Project Expense, Project Asset/Cap. Cost, Project Income, Voucher Lines).
- Sections:
  - A. Account Class Breakdown table (class, debit, credit, net, lines)
  - B. Cost Center Breakdown table (cost center, debit, credit, net, expense, asset/cap., lines, last date, drill-down)
  - C. Top Ledger Movement table (ledger, class, debit, credit, net, lines)
  - D. Help text explaining report scope
- Drill-down links: cost center row → Project Ledger with costCenterId; ledger row → Project Ledger with ledgerAccountId; "View detailed line entries" link; "View Project Cost Report" link.
- Browser print foundation via `ReportPrintFrame` with class breakdown and cost center breakdown tables.
- Added Project Financial Summary navigation link under Reports in sidebar with `BarChart3` icon.

### Files changed

- `apps/api/src/report/report.service.ts` -- added `getProjectFinancialSummary` method, `classLabel` helper.
- `apps/api/src/report/report.controller.ts` -- added `GET /reports/project-financial-summary` endpoint.
- `apps/web/src/lib/api.ts` -- added `ProjectFinancialSummaryReport` and related types, `getProjectFinancialSummaryReport` helper, extended `ReportType` union.
- `apps/web/src/app/app/reports/project-financial-summary/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- added Project Financial Summary navigation link.

### Not added

- No Prisma schema change, no migration, no report table, no new role.
- No MFS voucher posting support.
- No PDF/Excel export, no dashboard analytics.
- No Project Cash/Bank Movement View (Report E).
- No Phase 2G-5 review.

### Verification

All passes: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor` (port-occupied warning only).

## Phase 2G Chunk 2G-3 Cost Center Summary - completed this session

Phase 2G Chunk 2G-3 Cost Center Summary API + Frontend Cost Center Summary Page is implemented.

### Backend

- Added `GET /reports/cost-center-summary` endpoint guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required; returns 400 when missing.
- Report derives from posted voucher lines only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`).
- Summarizes project-tagged VoucherLine records grouped by cost center.
- Each VoucherLine contributes to exactly one cost-center summary row (no double counting).
- Lines without a cost center appear as "Unassigned" only when such lines actually exist in the data.
- Optional filters: `costCenterId`, `ledgerAccountId`, `accountGroupId`, `accountClassCode`.
- Returns per-cost-center totals: debitTotal, creditTotal, netMovement, lineCount, and drill-down links to Project Ledger.

### Frontend

- Added `CostCenterSummaryReport` and `CostCenterSummaryRow` types in `apps/web/src/lib/api.ts`.
- Added `getCostCenterSummaryReport` helper.
- Created `/app/reports/cost-center-summary/page.tsx` with required project + fiscal year filters, optional cost center/ledger/account class/account group.
- Page renders summary cards (Total Debit, Total Credit, Net Movement, Line Count, Cost Center Count).
- Table columns: Cost Center (with "Unassigned" label for null cost center), Debit, Credit, Net Amount, Line Count, Actions (drill-down link to Project Ledger).
- Browser print foundation via `ReportPrintFrame`.
- Added Cost Center Summary navigation link under Reports in sidebar.

### Files changed

- `apps/api/src/report/report.service.ts` -- added `getCostCenterSummary` method, `CostCenterSummaryRow` type.
- `apps/api/src/report/report.controller.ts` -- added `GET /reports/cost-center-summary` endpoint.
- `apps/web/src/lib/api.ts` -- added `CostCenterSummaryReport`, `CostCenterSummaryRow` types, `getCostCenterSummaryReport` helper.
- `apps/web/src/app/app/reports/cost-center-summary/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- added Cost Center Summary navigation link.

### Not added

- No Prisma schema change, no migration, no report table, no new role.
- No MFS voucher posting support.
- No PDF/Excel export, no dashboard analytics.
- No Project Financial Summary (Chunk 2G-4).

### Verification

All passes: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`.

## Phase 2G Chunk 2G-1 Project Ledger - completed previous session

Phase 2G Chunk 2G-1 Project Ledger API + Frontend Project Ledger Report Page is implemented.

### Backend

- Added `GET /reports/project-ledger` endpoint guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- `projectId` is required; returns 400 when missing.
- Report derives from posted voucher lines only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`) where `VoucherLine.projectId` matches the selected project.
- Draft and soft-deleted vouchers are excluded by the shared `buildVoucherDateFilter`.
- Optional filters: `costCenterId` (scoped to selected project via `resolveReportContext`), `ledgerAccountId`, and `voucherType`.
- Lines sorted by voucher date, system voucher number, line number.
- Opening balance = sum of project-tagged debit minus credit before the selected start date.
- Running balance = cumulative debit minus credit across project-tagged lines.
- Money values use `Prisma.Decimal.toFixed(2)` string serialization.
- Added `voucherType` optional field to `ReportQueryDto` with `@IsIn` validation.
- Added `buildProjectLedgerLineFilter`, `findProjectLedgerLines`, and `summarizeProjectLedgerFilters` private helpers.

### Frontend

- Added `ProjectLedgerReport` and `ProjectLedgerReportLine` types in `apps/web/src/lib/api.ts`.
- Added `getProjectLedgerReport` cookie-authenticated helper.
- Added `voucherType` to `ReportQueryParams` and `buildReportQuery`.
- Added `requireProject` and `showVoucherType` config options to `ReportFiltersConfig`.
- Added voucher type dropdown to the shared `ReportFilters` panel.
- Created `/app/reports/project-ledger/page.tsx` with project filter (required), fiscal year filter (required), period/date range, optional cost center, optional ledger account, and optional voucher type.
- Page renders summary cards (Total Debit, Total Credit, Net Movement, Line Count, Opening Balance).
- Line table shows Date, Voucher No (with drill-down link to `/app/vouchers/[id]`), Voucher Type, Ledger, Account Class, Cost Center, Narration/Description, Debit, Credit, Running Net.
- Empty states: "Select a project to view project-tagged posted voucher lines." when no project; "No posted voucher lines are tagged to the selected project" when no data.
- Browser print foundation included via `ReportPrintFrame`.
- Added Project Ledger navigation link under Reports in the app sidebar with `FolderKanban` icon.

### Files changed

- `apps/api/src/report/dto/report-query.dto.ts` -- added `voucherType` optional field with `@IsIn` validation.
- `apps/api/src/report/report.service.ts` -- added `getProjectLedger` method, `buildProjectLedgerLineFilter`, `findProjectLedgerLines`, `summarizeProjectLedgerFilters` helpers.
- `apps/api/src/report/report.controller.ts` -- added `GET /reports/project-ledger` endpoint.
- `apps/web/src/lib/api.ts` -- added `ProjectLedgerReport`, `ProjectLedgerReportLine` types, `getProjectLedgerReport` helper, `voucherType` to `ReportQueryParams` and `buildReportQuery`.
- `apps/web/src/app/app/reports/_lib/report-ui.tsx` -- added `requireProject`, `showVoucherType` to `ReportFiltersConfig`, voucher type dropdown, project required validation.
- `apps/web/src/app/app/reports/project-ledger/page.tsx` -- new file.
- `apps/web/src/app/app/layout.tsx` -- added Project Ledger navigation link.

### Not added

- No Prisma schema change, no migration, no report table, no new role.
- No MFS voucher posting support.
- No PDF/Excel export, no dashboard analytics.
- No Project Cost Report, Cost Center Summary, Project Financial Summary (Chunks 2G-2 through 2G-4).
- No schema changes to voucher posting logic.

### Verification

All verification passes: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor` (port-occupied warnings only).

## Phase 2G Documentation Lock - this session

Phase 2G Project/Cost-Center Financial Reporting requirement lock is complete and accepted. Phase 2G defines four primary reports (Project Ledger, Project Cost Report, Cost Center Summary, Project Financial Summary) and one optional sub-view (Project Cash/Bank Movement View). All reports derive from posted VoucherLine records only; `projectId` is required for all four primary reports; cost center dropdowns scope to the selected project; asset-class totals labeled separately from expense-class totals. No schema change expected; no new roles; no editable report tables; no dashboard analytics; no PDF/Excel export; no MFS voucher posting support.

Created:
- `docs/requirements/phase-2g-project-cost-center-reporting-requirement-lock.md`: defines four primary reports (A: Project Ledger, B: Project Cost Report, C: Cost Center Summary, D: Project Financial Summary) and one optional sub-view (E: Project Cash/Bank Movement View), with required filters, output columns, rules, API endpoints, accounting source rule, technical constraints, UX constraints, security rule, open questions with recommended answers, and explicit out-of-scope list.
- `docs/acceptance/phase-2g-acceptance-criteria.md`: acceptance for documentation lock, future Project Ledger implementation, future Project Cost Report implementation, future Cost Center Summary implementation, future Project Financial Summary implementation, optional Project Cash/Bank Movement View, regression criteria, and explicit non-acceptance conditions.
- `docs/plans/phase-2g-project-cost-center-reporting-plan.md`: five implementation chunks (2G-1 through 2G-5), each with objective, scope, files to read, files likely to change, in-scope, out-of-scope, acceptance checks, verification commands, recommended model, and stop condition.

Updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

No Prisma schema changes, no migrations, no backend API endpoints, no frontend pages, no MFS runtime logic, no roles, no seed data, and no tooling were added.
Phase 2D Chunk 2D-2 backend ledger/cash-book/bank-book report API is complete.
Phase 2D Chunk 2D-2 backend report API review is complete.
Phase 2D Chunk 2D-3 backend Trial Balance API is complete.
Phase 2D Chunk 2D-4 backend Income Statement and Balance Sheet API is complete.
Phase 2D Chunk 2D-5 frontend operational report pages (Ledger, Cash Book, Bank Book, Trial Balance) are complete.
Phase 2D Chunk 2D-6 frontend financial statement pages (Income Statement, Balance Sheet) and the report browser-print foundation are complete.
Phase 2D Chunk 2D-7 final integration and acceptance review is complete. Phase 2D is now accepted.

Phase 2E MFS / bKash transaction support requirement/specification lock is complete and accepted at commit `fdffcfb`.

Phase 2E Chunk 2E-2 backend schema/model foundation is accepted at commit `c820d7b`.

Phase 2E Chunk 2E-3 backend validation/API changes are accepted at commit `97e69ab`. The backend Cash & Bank account API can manage MFS accounts.

Phase 2E Chunk 2E-4 frontend MFS account setup UI is accepted at `be2392a`. The accountant can create, view, edit, and deactivate MFS accounts from the existing Cash, Bank & MFS setup page. Phase 2E Chunk 2E-5 MFS Book report API is accepted at `d90ffd4`: `GET /reports/mfs-book` exists. Phase 2E Chunk 2E-6 MFS Book frontend and print foundation is accepted: `/app/reports/mfs-book` exists. Phase 2E MFS account setup and MFS Book foundation are now accepted. MFS voucher posting support is deferred to a later explicitly approved chunk/phase.

Phase 2F Accounting Report + Accountant UX Refinement requirement lock is complete and accepted. Phase 2F locks six issues for future implementation: (A) Balance Sheet current-period profit/loss inclusion in equity, (B) report/table layout readability and textbook-style accounting tables, (C) voucher line dynamic field visibility, (D) Cash/Bank/MFS report filter UX clarity, (E) dropdown/table text clipping fixes, (F) demo/test data cleanliness planning. Issue A is implemented. Issue B (report/table layout widening and textbook-style readability) is implemented: the app layout uses full viewport width, report tables hide less-critical columns to eliminate horizontal scroll, and dropdowns use compact labels with tooltips. Issue C (voucher line dynamic field visibility) is implemented: voucher line Project/Cost Center/Cash-Bank-MFS fields respond to the selected ledger account, required fields are marked, non-required fields are hidden unless a stored value exists, and the Cash/Bank/MFS field is type-labelled and scoped to the ledger's linked accounts. Issue D (report filter UX clarity) is implemented: Cash Book, Bank Book, and MFS Book move Project/Cost Center into a collapsible "Advanced filters" section with clear helper text explaining they are line-level filters on the cash/bank/MFS ledger line itself. Backend verification confirmed `buildLineFilter` applies `projectId`/`costCenterId` directly to the same voucher line row. Issues E-F remain locked for future implementation.

## Phase 2F Chunk 2F-6 Report Filter UX Clarity - completed this session

- Verified Cash/Bank/MFS Book backend filter behavior: `buildLineFilter` in `report.service.ts` applies `projectId` and `costCenterId` directly to the `VoucherLineWhereInput` that also includes `cashBankAccountId`, `cashBankAccountType`, and `requireCashBankLedger` conditions. The project/cost center filter is applied to the **same voucher line** that is being reported (the cash/bank/MFS line itself), not to opposite/related lines or the whole voucher. This is Option A.
- Updated `ReportFiltersConfig` in `report-ui.tsx` with a new `advancedProjectCostCenter` boolean option. When set, the Project and Cost Center fields are removed from the main 4-column filter grid and placed in a collapsible "Advanced filters" section below the grid.
- The advanced section uses a toggle button with a chevron icon and an "active" badge when a project or cost center is selected. When expanded, it shows Project and Cost Center dropdowns side by side with helper text: "Advanced line-level filters. These filter report lines by stored project/cost center metadata on the selected cash/bank/MFS ledger line. Use only when voucher lines carry project or cost center metadata."
- Updated `CashBankBookReport.tsx` to pass `advancedProjectCostCenter: true` and updated the `CardHeader` description to mention "Project and cost center filters are advanced line-level options."
- Applied consistently to all three cash/bank/MFS book pages: `/app/reports/cash-book`, `/app/reports/bank-book`, and `/app/reports/mfs-book`.
- Ledger Statement, Trial Balance, Income Statement, and Balance Sheet filter panels remain unchanged (Project/Cost Center remain in the main grid, appropriate for cross-account reports).
- Dropdown/text clipping: compact labels (`fiscalYearLabelCompact`, `accountingPeriodLabelCompact`) and full title tooltips were already implemented in Phase 2F Chunk 2F-4 and remain in place.
- No backend code, Prisma schema, migration, report table, role, MFS posting, or accounting logic changes were made.
- Files changed: `apps/web/src/app/app/reports/_lib/report-ui.tsx`, `apps/web/src/app/app/reports/_lib/CashBankBookReport.tsx`, plus docs.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor`.

## Phase 2F Chunk 2F-5 Voucher Line Dynamic Field Visibility - completed this session

- Made the voucher line form (`apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx`) field-visibility selection-aware: Project, Cost Center, and Cash/Bank/MFS account fields now derive from the selected ledger account instead of appearing generically on every line.
- Added a small reusable helper `deriveVoucherLineFieldRequirements` plus `cashBankFieldLabel` in `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx`. The helper takes the selected ledger and the cash/bank/MFS accounts linked to it and returns `{ requiresProject, requiresCostCenter, isCashBank, cashBankFieldLabel, guidance }`. This documents the selection-aware UX pattern (UI reacts to the selected reference) intended for reuse in later report-filter and setup-form chunks; it is kept small and pure so it can be lifted to a shared module when that work happens.
- Project field: shown with a required marker when `requiresProject = true`; hidden when not required (unless the line already holds a stored project value, in which case it is shown without a required marker and labelled optional).
- Cost Center field: shown with a required marker when `requiresCostCenter = true`; cost center options are scoped to the selected project (`CostCenter.projectId`); the field is disabled with guidance until a project is selected when a project is also required; hidden when not required (unless a stored value exists).
- Cash/Bank/MFS account field: shown only when `isCashBank = true` (or a stored value exists); labelled by type ("Cash account" / "Bank account" / "MFS wallet" / "Cash/Bank/MFS account") based on the linked accounts; scoped to active accounts linked to the selected ledger; a sole matching account is auto-selected on ledger change; an inline warning is shown when no active linked account exists.
- State cleanup: changing a line's ledger clears stale Project/Cost Center/Cash-Bank values so hidden fields never carry forward unseen data; changing the project clears a cost center that no longer belongs to that project.
- Per-line guidance text replaces the old "Project recommended" / "Cost center recommended" hints with concise notes ("This ledger requires project and cost center.", "Cash account is required for this cash/bank ledger.", "No project or cost center is required for this ledger.").
- Posted vouchers remain read-only (`isReadOnly` when `status === "POSTED"`); the read-only detail view and print layout are unchanged and display stored historical values.
- Backend posting validation in `apps/api/src/voucher/voucher.service.ts` is unchanged and remains the authority (it enforces `requiresProject`, `requiresCostCenter`, cash/bank requirement, cost-center-belongs-to-project, and MFS-posting-deferred). The frontend changes are UX guidance only.
- No Prisma schema change, no migration, no report table, no new role, no new module, no backend accounting logic change, no localStorage token usage. Only two frontend files plus documentation were changed.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, and `pnpm doctor` (port-occupied note only).

## Phase 2E Chunk 2E-7 Final Integration and Acceptance Review - completed this session (accepted)

- Full integration review across all Phase 2E chunks: schema, backend account API, frontend MFS account setup, backend MFS Book report API, frontend MFS Book report page, and print foundation.
- Verified scope boundaries: only MFS account schema/model, backend account API validation, frontend MFS account setup, backend MFS Book report, frontend MFS Book page, and browser print foundation were implemented. No Project Summary, Cost Center Summary, report tables, PDF/Excel export, dashboard analytics, payroll, parties/customers/vendors, extra roles, file uploads, business seed data, MFS voucher posting support, or MFS provider API integration were added.
- Confirmed all MFS endpoints are guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- Confirmed MFS Book derives only from `Voucher.status = POSTED` and `Voucher.isDeleted = false`.
- Confirmed Cash Book remains CASH-only, Bank Book remains BANK-only, MFS Book remains MFS-only.
- Confirmed voucher posting still rejects MFS cash-bank accounts.
- Confirmed only `ACCOUNTANT` role exists in the implemented scope.
- Confirmed auth uses HttpOnly cookie behavior; no localStorage token usage.
- Confirmed no schema/migration/report table was added beyond the approved Phase 2E schema foundation.
- Verification passed: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, and `pnpm doctor` (port warning only).
- Docs updated: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, and `docs/handoff.md` reflect Phase 2E acceptance.
- No backend or frontend source changes were made in 2E-7.

## Phase 2E Chunk 2E-6 MFS Book Frontend and Print Foundation - completed this session (accepted)

- Added frontend route/page `/app/reports/mfs-book` using the shared `CashBankBookReport` component scoped to `accountType="MFS"`.
- Extended `CashBankBookReport.tsx` to support MFS alongside CASH and BANK with a safe wider type union; CASH and BANK behavior unchanged.
- MFS Book page uses the same filter panel, report summary, transaction line table, and print layout pattern as Cash Book and Bank Book.
- MFS-specific display: MFS Book title and description, provider/wallet/account holder metadata in report summary when an MFS account is selected, Provider column in the transaction line table for MFS accounts, and MFS metadata in the print layout.
- Added MFS Book navigation link under Reports in `apps/web/src/app/app/layout.tsx` with the `Smartphone` icon.
- Extended `apps/web/src/lib/api.ts`: added `"MFS_BOOK"` to `CashBankReport.reportType` union, added MFS metadata fields (`provider`, `providerOtherName`, `walletNumber`, `accountHolderName`) to `ReportCashBankAccountSummary`, added cookie-authenticated `getMfsBookReport` helper using `apiFetch` with `credentials: "include"`.
- Extended `report-ui.tsx`: updated `cashBankLabel` to show MFS provider name, added `providerDisplayName` helper for "BKASH" → "bKash" etc.
- Print foundation reuses existing `ReportPrintFrame` with MFS-specific meta (provider, wallet/account ID) and the MFS Book title.
- No backend code, Prisma schema, or migration changes. No dashboard analytics, no PDF/Excel export, no MFS voucher posting support. Cash Book remains CASH-only and Bank Book remains BANK-only.

## Phase 2E Chunk 2E-5 MFS Book Report API - completed this session (accepted)

- Added guarded backend endpoint `GET /reports/mfs-book` in the existing report module.
- The endpoint uses the existing class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` report-route protection.
- MFS Book derives only from `VoucherLine` rows attached to `Voucher.status = POSTED`, `Voucher.isDeleted = false`, and `CashBankAccount.accountType = MFS`.
- MFS Book structurally mirrors Cash Book / Bank Book: fiscal year, optional accounting period, date range, cash/bank account (MFS only), filters, opening/period/closing balances, lines with running balances, and opposite accounts.
- Cash Book remains CASH-only and Bank Book remains BANK-only. MFS does not leak into either report.
- CASH or BANK `cashBankAccountId` on MFS Book returns 400.
- MFS `cashBankAccountId` accepts and returns MFS metadata (provider, providerOtherName, walletNumber, accountHolderName) in account summaries.
- Query validation reuses the existing `resolveReportContext` pattern: required fiscal year, optional accounting period belonging to the fiscal year, paired custom dates, date range inside fiscal year/period, project/cost center existence and consistency, ledger account existence, cash/bank account existence and type check.
- No Prisma schema changes, migrations, report tables, frontend MFS Book page, MFS Book navigation link, dashboard/export/PDF/Excel, provider API integration, statement import, seed data, or MFS voucher posting support were added. MFS voucher posting remains blocked from Phase 2E Chunk 2E-3.

## Phase 2E Chunk 2E-4 Frontend MFS Account Setup UI - completed this session (accepted)

- Extended `apps/web/src/lib/api.ts`: `CashBankAccountType` now includes `MFS`; added the `MfsProvider` type (`BKASH`, `NAGAD`, `ROCKET`, `UPAY`, `OTHER`); added nullable `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName` to the `CashBankAccount` type; and added the same optional fields to the `CashBankAccountInput` create/update payload type. The existing cookie-authenticated `apiFetch` with `credentials: "include"` is preserved; no tokens are stored in `localStorage`.
- Updated `apps/web/src/app/app/cash-bank/page.tsx` into the Cash, Bank & MFS setup page:
  - The account type dropdown now offers CASH, BANK, and MFS (labelled "MFS / Mobile Wallet").
  - When MFS is selected, the form shows Provider (required), Provider name (required and shown only when provider is Other), Wallet number / account ID (required), and an optional Account holder name. Bank name, branch, and account number are hidden for MFS.
  - CASH and BANK keep their existing Bank name / Branch / Account number fields and do not show MFS metadata.
  - Client-side validation catches missing MFS provider, missing wallet number, and missing custom provider name (when provider is Other) before submit; backend validation errors continue to surface through the shared `Notice`.
  - A calm informational note explains that MFS account setup is available now but MFS voucher posting is not enabled yet.
  - The account list/table shows the friendly account type label, and for MFS rows it shows the provider (custom name for Other) plus the wallet identifier. Existing CASH/BANK rows display the bank name as before.
  - `startEdit` populates MFS metadata so MFS accounts can be edited and deactivated.
- Updated the sidebar label in `apps/web/src/app/app/layout.tsx` from "Cash & Bank" to "Cash, Bank & MFS" so MFS setup is discoverable. No new sidebar route or section was added.
- No backend code, Prisma schema, or migration changes were made. No voucher UI changes, no MFS Book report API, no MFS Book frontend page, no Reports navigation change, no dashboard cards, no PDF/Excel export, no provider integration, and no seed data were added. MFS voucher posting remains blocked by the backend.

## Phase 2E Chunk 2E-3 Backend Validation / API Changes - completed previous session

- Opened the existing guarded `cash-bank-accounts` API to `accountType = MFS` while preserving the existing `ACCOUNTANT` route protection.
- Added DTO support for MFS metadata: `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName`.
- Enforced MFS account rules in the backend service: provider is required, wallet number is required, `providerOtherName` is required only when provider is `OTHER`, and non-`OTHER` providers clear `providerOtherName`.
- MFS wallet numbers are treated as strings. No Bangladesh phone-number regex was added.
- CASH and BANK accounts do not require MFS metadata; MFS-only metadata is cleared server-side for CASH/BANK writes to avoid stale provider or wallet data.
- MFS accounts must link to a ledger account marked `isCashBank`; MFS setup additionally requires the linked ledger account to be active.
- List/update responses now include the nullable MFS metadata fields because they are returned from the existing `CashBankAccount` model.
- Added a narrow voucher posting safety block so posted voucher behavior is not accidentally expanded before the planned MFS voucher/report chunks: posting rejects voucher lines that use an MFS cash-bank account.
- Cash Book remains CASH-only and Bank Book remains BANK-only. No report API changes, no MFS Book endpoint, no MFS Book page, no frontend MFS account page, no sidebar/navigation change, no provider integration, no seed data, and no new role was added.

## Phase 2E Chunk 2E-2 Backend Schema / Model Foundation - completed this session

- Added `MFS` as a separate `CashBankAccountType` value beside existing `CASH` and `BANK`. Existing CASH and BANK values were not renamed or removed.
- Added `MfsProvider` enum with `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, and `OTHER`.
- Extended `CashBankAccount` with nullable MFS metadata fields: `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName`.
- Created and applied migration `20260615123515_phase_2e_mfs_schema_foundation`.
- Existing CASH and BANK rows migrate without manual data edits because every new MFS-specific column is nullable.
- Added a narrow backend guard in the existing Cash & Bank service so the generic cash-bank account API does not accept `accountType = MFS` before Phase 2E Chunk 2E-3 validation/API work.
- Cash Book remains CASH-only and Bank Book remains BANK-only. No MFS Book endpoint or page was added.
- No frontend MFS account page, sidebar navigation change, report API expansion, voucher posting behavior change, dashboard/report/export expansion, MFS provider API integration, seed data, or new role was added.

## Phase 2E MFS / bKash Requirement Lock - completed this session

- Created `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md`: defines MFS / bKash transaction support purpose, confirmed business need, current status (future requirement, not implemented), terminology (MFS, wallet/account, provider, cash-in, cash-out, merchant payment, transfer, service charge), supported future providers (bKash, Nagad, Rocket, Upay, Other), current role boundary (ACCOUNTANT only), accounting source rule (reports from POSTED voucher lines only), cash/bank/MFS separation rule (MFS is a separate account type, not BANK or CASH), voucher behavior requirements, report behavior requirements (MFS Book concept, Cash Book remains CASH-only, Bank Book remains BANK-only, Trial Balance/Income Statement/Balance Sheet unchanged), validation requirements, print/report requirements, security/privacy requirements, exclusions, and open questions for Real Capita confirmation.
- Created `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`: proposes future model (CashBankAccountType: CASH, BANK, MFS; MfsProvider enum; walletNumber/accountHolderName fields), explains why bKash should not be forced under BANK or CASH, voucher-line level impact, report impact per report type, decimal handling, backend authority rule, migration risk notes, and explicit statement of no current code changes.
- Created `docs/acceptance/phase-2e-acceptance-criteria.md`: acceptance for documentation lock, future backend implementation, future frontend implementation, report correctness, security, regression, and explicit non-acceptance conditions.
- Created `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md`: splits MFS implementation into 7 chunks (2E-1 requirement lock review, 2E-2 backend schema/model, 2E-3 backend validation/API, 2E-4 frontend MFS account setup, 2E-5 MFS Book report API, 2E-6 MFS Book frontend and print foundation, 2E-7 final integration and acceptance review). Each chunk includes model recommendation, scope, files to read, verification, manual smoke tests, and exact stop condition.
- Updated `docs/handoff.md`, `docs/ai/CURRENT_STATE.md`, `README.md`, `AGENTS.md`, `docs/ai/START_HERE.md` to reflect Phase 2E requirement lock.
- No Prisma schema changes, migrations, backend API endpoints, frontend pages, MFS runtime logic, roles, seed data, or tooling were added in Phase 2E Chunk 2E-1 requirement lock.

## Phase 2D Chunk 2D-7 Final Integration and Acceptance Review

Chunk 2D-6 added the accountant-facing Income Statement and Balance Sheet frontend pages and a browser-print foundation for every approved report page, on top of the existing backend financial statement APIs, with no backend, schema, or migration changes.

- Extended `apps/web/src/lib/api.ts` with string-money financial statement types (`FinancialStatementGroupSummary`, `IncomeStatementRow`, `IncomeStatementSection`, `IncomeStatementReport`, `BalanceSheetRow`, `BalanceSheetSection`, `BalanceSheetReport`), added an optional `asOfDate` to `ReportQueryParams` (carried through `buildReportQuery`), and added cookie-authenticated helpers `getIncomeStatementReport` and `getBalanceSheetReport`. Both use the existing `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`. All money values are typed as strings to match the API serialization. No Project Summary or Cost Center Summary helpers were added.
- Added a print foundation module `apps/web/src/app/app/reports/_lib/report-print.tsx`: a `PrintReportButton` (calls `window.print()` only) and a `ReportPrintFrame` print-only layout (Real Capita Group heading, report title, report context meta, report body, generated date/time, and prepared/checked/authorised signature placeholders) using `@media print` CSS modelled on the voucher print foundation. No PDF generation, no Excel export, no file uploads.
- Extended the shared `ReportFilters` panel (`_lib/report-ui.tsx`) with `showDateRange` (default true) and `showAsOfDate` config options plus an `asOfDate` field so the Balance Sheet uses an optional point-in-time as-of date instead of a start/end range, while the Income Statement keeps the optional custom date range.
- Added a `Reports` navigation entry for `Income Statement` and `Balance Sheet` in `apps/web/src/app/app/layout.tsx`. No dashboard cards or analytics.
- Added routes `/app/reports/income-statement` and `/app/reports/balance-sheet`.
- Income Statement page requires a fiscal year; optional period, custom date range, project, and cost center (no ledger account, no cash/bank account, no as-of date). Renders the report header, total income, total expense, net income with profit/loss state, and grouped Income and Expense sections (account code/name, debit movement, credit movement, amount) with section totals. A valid empty report shows zero totals and a calm empty state.
- Balance Sheet page requires a fiscal year; optional period, as-of date, project, and cost center (no start/end date, no ledger account, no cash/bank account). Renders the report header, Assets/Liabilities/Equity sections (account code/name, debit movement, credit movement, balance), total assets, total liabilities, total equity, total liabilities and equity, difference, and `isBalanced`. When unbalanced it shows a clear warning and never hides or forces the difference. It does not invent virtual retained earnings; it shows only what the backend returns.
- Added a "Print report" button (shown after a report loads) and a print-only `ReportPrintFrame` layout to all six report pages: Ledger, Cash Book, Bank Book, Trial Balance, Income Statement, and Balance Sheet. Each print layout includes the Real Capita Group heading, report title, fiscal year, accounting period or date range / as-of date, selected filters, the report table/sections, totals, a generated timestamp, and signature placeholders.
- Every page handles reference loading, report loading, empty reference data, client-side validation before submit, backend validation errors, unauthenticated redirect through the existing app shell, and calm empty states for empty results.

No Project Summary, Cost Center Summary, Project Summary API, Cost Center Summary API, report tables, PDF/Excel export, approval workflow, voucher reversal/correction, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, tooling, Prisma schema changes, migrations, backend API changes, or bKash/MFS implementation were added.

### Future Request Note: bKash / MFS Transaction Support

bKash/MFS transaction support was requested and is deferred to a separate future requirement lock/chunk. No schema, enum, cash/bank logic, voucher validation, or report changes were made for bKash/MFS in this chunk.

## Phase 2D Chunk 2D-5 Frontend Operational Report Pages

Chunk 2D-5 added the accountant-facing frontend report pages on top of the existing backend report APIs, with no backend, schema, or migration changes.

- Extended `apps/web/src/lib/api.ts` with stable report types (`ReportFiscalYearSummary`, `ReportAccountingPeriodSummary`, `ReportDateRange`, `ReportFilterSummary`, `ReportBalanceSummary`, `LedgerReport`, `CashBankReport`, `TrialBalanceReport`, `ReportQueryParams`, and supporting summaries) and cookie-authenticated helpers `getLedgerReport`, `getCashBookReport`, `getBankBookReport`, and `getTrialBalanceReport`. All use the existing `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`. All money values are typed as strings to match the API serialization. No Income Statement or Balance Sheet helpers were added.
- Added a `Reports` navigation section in `apps/web/src/app/app/layout.tsx` with links to Ledger Statement, Cash Book, Bank Book, and Trial Balance. No dashboard cards or analytics.
- Added shared report utilities in `apps/web/src/app/app/reports/_lib/`:
  - `useReportReferences.ts`: loads fiscal years, accounting periods, ledger accounts, projects, cost centers, and cash/bank accounts for the filter dropdowns; redirects unauthenticated users to `/login`.
  - `report-ui.tsx`: formatting helpers (money, date, normal-balance-aware `formatBalance`), label helpers, presentational primitives (`ReportMeta`, `SummaryGrid`), and a reusable `ReportFilters` panel that validates the fiscal-year requirement, the optional ledger-account requirement, and the custom date-range pairing before emitting a clean `ReportQueryParams`.
  - `CashBankBookReport.tsx`: shared Cash Book / Bank Book page used by both routes, scoped by cash/bank account type.
- Added routes: `/app/reports/ledger`, `/app/reports/cash-book`, `/app/reports/bank-book`, `/app/reports/trial-balance`.
- Ledger page requires a fiscal year and a ledger account; optional period, custom date range, project, and cost center. Renders report header, opening balance, period debit, period credit, closing balance, and a line table (date, voucher no., type, narration, line description, debit, credit, running balance, project, cost center, cash/bank account).
- Cash Book and Bank Book pages require a fiscal year; optional period, date range, cash/bank account (scoped to CASH or BANK), ledger account (scoped to eligible cash/bank ledgers), project, and cost center. Render report header, opening/period/closing balances, and a line table including the cash/bank account, ledger account, opposite accounts, debit, credit, running balance, project, and cost center.
- Trial Balance page requires a fiscal year; optional period, date range, project, and cost center. Renders totals (opening debit/credit, period debit/credit, closing debit/credit, difference, balanced flag), a clear balanced/unbalanced notice that never hides or forces the difference, and a row table (code, name, group/class, opening/period/closing debit and credit) with a totals footer.
- Every page handles reference loading, report loading, empty reference data, client-side validation errors before submit, backend validation errors, unauthenticated redirect through the existing app shell, and calm empty states for empty results.

No Income Statement frontend, Balance Sheet frontend, Project Summary, Cost Center Summary, report print layout, PDF/Excel export, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, tooling, Prisma schema changes, migrations, or backend API changes were added.

## Phase 2D Chunk 2D-4 Backend Income Statement and Balance Sheet API

Chunk 2D-4 added two guarded backend endpoints inside the existing report module:

- `GET /reports/income-statement`: Income Statement for a period within a fiscal year.
- `GET /reports/balance-sheet`: Balance Sheet at a point-in-time date within a fiscal year.

Both endpoints use the existing class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` report-route protection.

The shared `ReportQueryDto` gained an optional `asOfDate` field for the balance sheet point-in-time query.

### Income Statement

- Period-based report using only INCOME and EXPENSE account classes.
- Uses existing shared report query validation for fiscal year, accounting period, and date range.
- Income accounts: signed amount = credit - debit (credit increases income).
- Expense accounts: signed amount = debit - credit (debit increases expense).
- Net income = total income - total expense; `isProfit` flag when net income >= 0.
- Rows grouped by account group, sorted by account class (Income then Expense), group code/name, ledger account code/name.
- Rejects `ledgerAccountId`, `cashBankAccountId`, and `asOfDate` with clear 400 errors.
- Empty valid reports return zero totals, `isProfit: true`.

### Balance Sheet

- As-of-date based report using only ASSET, LIABILITY, and EQUITY account classes.
- `asOfDate` determines the point-in-time; falls back to `accountingPeriod.endDate`, then `fiscalYear.endDate`.
- Cumulative movements from `fiscalYear.startDate` through `asOfDate` inclusive.
- Asset accounts: signed amount = debit - credit (debit increases asset).
- Liability accounts: signed amount = credit - debit (credit increases liability).
- Equity accounts: signed amount = credit - debit (credit increases equity).
- Balance check: `difference = totalAssets - totalLiabilitiesAndEquity`; `isBalanced` when zero.
- Rows grouped by account group, sorted by account class (Asset, Liability, Equity), group code/name, ledger account code/name.
- Rejects `ledgerAccountId`, `cashBankAccountId`, `startDate`, and `endDate` with clear 400 errors.
- `asOfDate` must fall inside the fiscal year; when `accountingPeriodId` is also provided, `asOfDate` must fall inside the period.
- Does not invent virtual retained earnings; reports only posted voucher line movements honestly.
- Empty valid reports return zero totals, `isBalanced: true`, `difference: "0.00"`.

### Files changed

- `apps/api/src/report/dto/report-query.dto.ts`: added `asOfDate` field.
- `apps/api/src/report/report.controller.ts`: added `income-statement` and `balance-sheet` endpoints.
- `apps/api/src/report/report.service.ts`: added `getIncomeStatement`, `getBalanceSheet`, `resolveBalanceSheetContext`, `buildBalanceSheetVoucherFilter`, and supporting types/helpers.

No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Project Summary, Cost Center Summary, PDF/Excel export, or report UI were added.

## Phase 2D Chunk 2D-2 Backend Ledger/Cash-Book/Bank-Book API

Chunk 2D-2 added a guarded NestJS report module at `apps/api/src/report` and registered it in `apps/api/src/app.module.ts`.

Endpoints added:

- `GET /reports/ledger`: General Ledger / Ledger Statement for one `ledgerAccountId`.
- `GET /reports/cash-book`: Cash Book for posted cash-type cash/bank voucher lines, optionally filtered by `cashBankAccountId` or `ledgerAccountId`.
- `GET /reports/bank-book`: Bank Book for posted bank-type cash/bank voucher lines, optionally filtered by `cashBankAccountId` or `ledgerAccountId`.

All report routes use the existing `AuthGuard` + `RolesGuard` + `ACCOUNTANT` pattern.

Report behavior:

- Reports derive from `VoucherLine` rows attached to `Voucher.status = POSTED` and `Voucher.isDeleted = false` only.
- `DRAFT` vouchers and soft-deleted vouchers do not affect report totals or lines.
- Shared filters include required `fiscalYearId`, optional `accountingPeriodId`, custom `startDate`/`endDate`, optional `projectId`, `costCenterId`, `ledgerAccountId`, and `cashBankAccountId`.
- If an accounting period is supplied without custom dates, the period date range is used. If custom dates are supplied with a period, the range must fit inside that period and the selected fiscal year.
- Ledger balances are normal-balance-aware. Opening balance uses posted movement before the selected start date within the same fiscal year. Period debit/credit and closing balance are derived on demand.
- Cash Book and Bank Book use receipt/payment behavior from cash/bank linked posted voucher lines, with running balances computed from debit minus credit.

No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Trial Balance, Income Statement, or Balance Sheet implementation were added.

## Phase 2D Chunk 2D-2 Backend Report API Review

Chunk 2D-2 backend report API review passed. The reviewed implementation remains limited to backend General Ledger, Cash Book, and Bank Book report APIs plus docs updates.

Review results:

- Route/security check passed: `GET /reports/ledger`, `GET /reports/cash-book`, and `GET /reports/bank-book` use `AuthGuard`, `RolesGuard`, and `ACCOUNTANT`.
- Posted-only check passed: reports use `Voucher.status = POSTED`, `Voucher.isDeleted = false`, and attached `VoucherLine` rows only.
- Validation check passed for required fiscal year, required ledger account on ledger report, period/date-range rules, project/cost-center mismatch, and cash/bank account type mismatch.
- Accounting calculation review passed for opening, period debit/credit, closing, and running balance behavior in the reviewed scope.
- No backend source changes were needed during review.
- Stale project docs were corrected where older sections still said report APIs were not implemented.

## Phase 2D Chunk 2D-3 Backend Trial Balance API

Chunk 2D-3 added the guarded backend endpoint `GET /reports/trial-balance` inside the existing report module.

Trial Balance behavior:

- The endpoint uses the existing `AuthGuard`, `RolesGuard`, and `ACCOUNTANT` report-controller protection.
- The query requires `fiscalYearId` and supports optional `accountingPeriodId`, custom `startDate`/`endDate`, `projectId`, and `costCenterId`.
- The same report context validation applies: period ownership, paired custom dates, `startDate <= endDate`, fiscal-year range, selected-period range, project and cost-center existence, and cost-center-to-project consistency.
- Trial Balance derives only from `VoucherLine` rows attached to `Voucher.status = POSTED` and `Voucher.isDeleted = false`.
- `DRAFT` vouchers, soft-deleted vouchers, and unposted effects do not affect rows or totals.
- Opening balances use posted movement before the selected start date inside the same fiscal year.
- Period debit and period credit show raw period movement totals.
- Closing balances use normal-balance-aware presentation, including opposite-side presentation when a signed account balance reverses its normal side.
- Empty valid reports return zero totals, `isBalanced: true`, `difference: "0.00"`, and `rows: []`.

No Prisma schema changes, migrations, report tables, frontend report pages, dashboard analytics, payroll, parties/customers/vendors, uploads, roles, seed data, Income Statement, or Balance Sheet implementation were added.

## Phase 2C Implementation Planning

Phase 2C adds only planning documentation. It splits voucher implementation into 6 chunks:

- Chunk 2C-1: Voucher schema only (enums, Voucher, VoucherLine, VoucherNumberSequence; no API, no frontend, no posting).
- Chunk 2C-2: Backend draft voucher API (CRUD for drafts, ACCOUNTANT guard, no posting).
- Chunk 2C-3: Posting validation service (all validation rules, immutability, audit events).
- Chunk 2C-4: Frontend draft/create UI (voucher list, line editor, validation display).
- Chunk 2C-5: Posting UI and print foundation (post action, read-only view, browser print layout).
- Chunk 2C-6: Final integration and acceptance review (smoke tests, audit checks, docs update).

- `docs/plans/phase-2c-voucher-implementation-plan.md`: full chunk plan with objectives, files, out-of-scope, verification, smoke tests, model routing, risk levels, and stop conditions.
- `docs/prompts/phase-2c-chunk-1-voucher-schema-prompt.md`: prompt for schema-only Chunk 2C-1 implementation.

No Prisma schema changes, no migrations, no backend changes, no frontend changes in Phase 2C planning.

## Phase 2C Chunk 2C-1 Voucher Schema Foundation

Chunk 2C-1 added only the Prisma voucher schema foundation and migration:

- `VoucherType`: `DEBIT`, `CREDIT`, `JOURNAL`, `CONTRA`, `PAYMENT`, `RECEIPT`.
- `VoucherStatus`: `DRAFT`, `POSTED`.
- `VoucherLineSide`: `DEBIT`, `CREDIT`.
- `Voucher`, `VoucherLine`, and `VoucherNumberSequence` models.
- Back-relations on existing Company, FiscalYear, AccountingPeriod, LedgerAccount, Project, CostCenter, CashBankAccount, and User models.
- Migration: `20260614163238_phase_2c_voucher_schema_foundation`.

No API, frontend UI, posting service, reports, parties, customers, vendors, file uploads, roles, or seed data were added.

## Phase 2C Chunk 2C-2 Backend Draft Voucher API

Chunk 2C-2 added a NestJS voucher module at `apps/api/src/voucher` for draft voucher list/detail/create/update plus draft soft-delete. Every route requires an authenticated user and the `ACCOUNTANT` role through the existing `AuthGuard` + `RolesGuard` pattern. No global `/api` prefix.

Endpoints:

- `GET /vouchers`: list non-deleted vouchers with optional `voucherType`, `status`, `fiscalYearId`, and `accountingPeriodId` filters; includes fiscal year, accounting period, `createdBy`/`postedBy` basic info, and a line count.
- `GET /vouchers/:id`: voucher detail with ordered lines and their ledger account, project, cost center, and cash/bank account relations; 404 for missing or soft-deleted vouchers.
- `POST /vouchers`: create a `DRAFT` voucher. `companyId` is derived from the fiscal year; `systemVoucherNo` is generated transactionally from `VoucherNumberSequence` scoped by company + fiscal year + voucher type (format `TYPE-NNNNN`). `createdById` comes from the authenticated user; `postedById`/`postingDate` stay null. `totalDebit`/`totalCredit` are computed on the server from line amounts; `lineNo` is assigned from array order. Client `status`, `systemVoucherNo`, `companyId`, totals, and posting fields are rejected by the whitelist validation pipe.
- `PATCH /vouchers/:id`: update a `DRAFT` voucher only; posted vouchers are immutable (400). Narration cannot become blank. When lines are supplied they replace the draft lines transactionally and totals are recalculated. `systemVoucherNo` never changes. Status and posting fields cannot be set.
- `DELETE /vouchers/:id`: soft-delete a `DRAFT` voucher (`isDeleted=true`, `deletedAt=now`). Posted vouchers cannot be deleted; no hard delete. The consumed `systemVoucherNo` is never reused.

Validation in this chunk: fiscal year exists, accounting period exists and belongs to the fiscal year, voucher date inside both the fiscal year and accounting period ranges, ledger accounts exist and are active, optional project/cost center/cash-bank references exist when provided, positive line amounts, valid line side, narration required at the API level, and no client-controlled totals/status/posting fields. Audit events `VOUCHER_CREATED`, `VOUCHER_EDITED`, and `VOUCHER_DELETED` are recorded in the existing `AuditEvent` model.

Deferred to Chunk 2C-3: debit total must equal credit total before posting, accounting period must be OPEN before posting, `requiresProject`/`requiresCostCenter` enforcement, `isCashBank`/cash-bank consistency enforcement, the posting endpoint, the `VOUCHER_POSTED` audit event, and reversal/correction policy.

No frontend, posting service, posting endpoint, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, or tooling were added. No Prisma schema change or migration was made.

## Phase 2C Chunk 2C-3 Backend Posting Validation Service

Chunk 2C-3 extended the existing backend voucher module with `POST /vouchers/:id/post`. The endpoint uses the same class-level `AuthGuard` + `RolesGuard` + `ACCOUNTANT` protection as the other `/vouchers` routes.

Posting behavior:

- Only active, non-deleted `DRAFT` vouchers can be posted.
- On success, posting runs inside a Prisma transaction, sets `status=POSTED`, sets `postingDate`, sets `postedById` from the authenticated user, recalculates `totalDebit` and `totalCredit` from existing voucher lines, preserves `systemVoucherNo`, leaves voucher lines unchanged, and records `VOUCHER_POSTED` in `AuditEvent`.
- Posted vouchers remain immutable through the existing PATCH/DELETE draft-only checks.

Posting validations implemented:

- Voucher exists and is not soft-deleted.
- Voucher status is `DRAFT`.
- Voucher has at least two lines.
- Header narration is present and not blank.
- Debit total equals credit total and total amount is greater than zero.
- Fiscal year exists, is active, and is not closed.
- Accounting period exists, belongs to the voucher fiscal year, and has status `OPEN`.
- Voucher date is inside both fiscal year and accounting period ranges.
- Every ledger account is active.
- `requiresProject`, `requiresCostCenter`, active Project, active CostCenter, and CostCenter-to-Project consistency are enforced.
- Cash/bank account references must be active, belong to the same line ledger account, and only appear with cash/bank ledger accounts.
- Cash/bank ledger accounts require `cashBankAccountId` at posting time.
- Payment, Receipt, and Contra cash/bank side rules are enforced at posting time.

No frontend, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, tooling, Prisma schema changes, migrations, or financial statement/report tables were added.

## Phase 2C Chunk 2C-4 Frontend Voucher Draft/Create UI

Chunk 2C-4 added the accountant-facing voucher draft UI on top of the existing backend, with no backend, schema, or migration changes.

- Extended `apps/web/src/lib/api.ts` with voucher types (`Voucher`, `VoucherLine`, `VoucherType`, `VoucherStatus`, `VoucherLineSide`, `VoucherUserRef`, `VoucherListFilters`), request payload types (`CreateVoucherInput`, `UpdateVoucherInput`, `CreateVoucherLineInput`), and cookie-authenticated helpers `getVouchers`, `getVoucher`, `createVoucher`, `updateVoucher`, and `deleteVoucher`. All use the existing `apiFetch` with `credentials: "include"`; no tokens are stored in `localStorage`. Decimal fields (`amount`, `totalDebit`, `totalCredit`) are typed as strings to match the API serialization.
- Added a `Vouchers` navigation link to `apps/web/src/app/app/layout.tsx` pointing at `/app/vouchers`.
- Added `apps/web/src/app/app/vouchers/page.tsx`: a voucher list with `systemVoucherNo`, type, voucher date, accounting period, status badge, debit/credit totals, and `createdBy`. Filters for voucher type, status, fiscal year, and accounting period (period choices are scoped to the selected fiscal year). A New voucher action and per-row Open (draft) / View (posted) action. No posting button and no reports.
- Added `apps/web/src/app/app/vouchers/new/page.tsx` and `apps/web/src/app/app/vouchers/[id]/page.tsx` backed by a shared `VoucherForm` component and a `useVoucherReference` loader hook in `apps/web/src/app/app/vouchers/_lib/`. The form has the header (voucher type, fiscal year, accounting period filtered by fiscal year, voucher date, physical SI no., narration) and a debit/credit line editor (side, ledger account, project, cost center, cash/bank account shown only for cash/bank ledgers, description, amount). It enforces at least two lines, supports add/remove line, shows server line numbers, and displays debit total, credit total, and difference with a balance indicator.
- Draft behavior: unbalanced drafts can be saved with a clear, non-blocking warning that posting will require matching debit and credit totals. The UI still blocks obviously invalid submissions (missing fiscal year/period/date, missing ledger account, amount <= 0, more than two decimals, blank narration) and surfaces backend validation errors through the shared `Notice`.
- Posted vouchers opened from the list render read-only (all inputs disabled, no save/delete) with an informational notice. No posting action is included; posting UI and print layout remain Chunk 2C-5.
- Only active ledger accounts, projects, cost centers, and cash/bank accounts are offered for new line selections; an already-selected inactive ledger account is preserved on an existing line.

No posting UI, print layout, reports, dashboard analytics, payroll, parties/customers/vendors, roles, file uploads, seed data, tooling, Prisma schema changes, migrations, or backend API changes were added.

## Implemented Features

- pnpm workspace monorepo.
- Next.js App Router frontend.
- NestJS API.
- Prisma ORM.
- PostgreSQL 17 through Docker Compose.
- API health endpoint at `GET /health`.
- PostgreSQL host-port isolation on `localhost:55432`.
- Phase 0 documentation and handoff.
- Phase 1A documentation, ADRs, scripts, and auth foundation.
- Phase 1B requirement/spec lock documents for the accounting foundation implementation.
- Phase 2A Chunk 1: accounting-foundation Prisma models (`Company`, `FiscalYear`, `AccountingPeriod`, `Project`, `CostCenter`, `AccountClass`, `AccountGroup`, `LedgerAccount`, `CashBankAccount`) and a fixed five-class `AccountClass` system seed.
- Phase 2A Chunk 2: backend accounting foundation API guarded by the `ACCOUNTANT` role - `/company`, `/fiscal-years` (+ `/:id/activate`), `/accounting-periods`, `/projects`, `/cost-centers`, `/account-classes`, `/account-groups`, `/ledger-accounts`, `/cash-bank-accounts`.
- Phase 2A Chunk 3A frontend foundation:
  - Typed, cookie-authenticated API helper (`apps/web/src/lib/api.ts`) using `credentials: "include"`, an `ApiError` type with clear auth/connection messages, and no token storage in `localStorage`.
  - Protected `/app` shell layout with real navigation.
  - `/app/company` Company Setup page (create or edit the singleton company profile).
  - `/app/fiscal-years` Fiscal Years page (list, create, edit, activate, with active/closed status).
  - `/app/projects` Projects page (list, create, edit).
  - `/app/accounts/classes` read-only Account Classes page.
- Phase 2A Chunk 3B frontend foundation:
  - `/app/accounting-periods` Accounting Periods page (list, create, edit; fiscal-year dropdown; OPEN/LOCKED/CLOSED status).
  - `/app/cost-centers` Cost Centers page (list, create, edit/deactivate; project dropdown).
  - `/app/accounts/groups` Account Groups page (list, create, edit/deactivate; account-class dropdown).
  - `/app/accounts/ledger` Ledger Accounts page (list, create, edit/deactivate; normal balance and requirement flags).
  - `/app/cash-bank` Cash & Bank page (list, create, edit/deactivate; only ledger accounts marked Cash/Bank are selectable).
  - The Phase 2A accounting foundation frontend is now implemented.

## Confirmed Role Model

Only one role is confirmed now:

- `ACCOUNTANT`, displayed as `Accountant`

Future roles are to be confirmed later. They are not implemented, seeded, displayed, or modeled.

## Current Non-Features

The repo intentionally does not include:
- optional MFS demo dataset extension
- PDF/Excel export
- dashboard analytics
- payroll / salary sheets
- parties / customers / vendors
- file uploads
- reversal / correction implementation
- approval workflow
- MFS provider API / payment gateway / customer wallet integration
- extra roles beyond Accountant (only Accountant is confirmed)
- report tables in the Prisma schema (reports derive dynamically from posted VoucherLine records)

## Next Recommended Task

Phase 2K Voucher Fund-Line Project Tagging is complete and accepted at commit `91fd742` (tag `phase-2k-complete`).

Phase 2L Voucher Reversal / Rectification Workflow requirement lock is complete.
The recommended next steps/possible user decisions are:
- Tag `phase-2l-requirements-locked`.
- Begin Phase 2L implementation (Chunk 2L-2 Schema / Linkage & Backend Reversal Draft Generation) only after explicit user approval.

Do not start next phase/module implementation without explicit user confirmation.

Reference docs before continuing:

- `docs/plans/phase-2l-voucher-reversal-rectification-plan.md`
- `docs/requirements/phase-2l-voucher-reversal-rectification-requirement-lock.md`
- `docs/acceptance/phase-2l-acceptance-criteria.md`
- `docs/plans/phase-2k-voucher-fund-line-project-tagging-plan.md`
- `docs/requirements/phase-2k-voucher-fund-line-project-tagging-requirement-lock.md`
- `docs/acceptance/phase-2k-acceptance-criteria.md`
- `docs/plans/phase-2j-project-fund-movement-plan.md`
- `docs/requirements/phase-2j-project-fund-movement-requirement-lock.md`
- `docs/plans/phase-2i-mfs-voucher-posting-plan.md`
- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md`
