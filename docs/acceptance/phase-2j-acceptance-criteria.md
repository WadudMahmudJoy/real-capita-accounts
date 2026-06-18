# Phase 2J: Project Fund Movement View Acceptance Criteria

This document defines the acceptance criteria for the Phase 2J implementation chunks.

## 1. Backend API / Report Service
- [ ] `GET /reports/project-fund-movement` (or similar endpoint) is implemented.
- [ ] Only accessible by the `ACCOUNTANT` role.
- [ ] Derives data strictly from POSTED, non-deleted `VoucherLine` records.
- [ ] Follows **Option A**: Only includes voucher lines where the linked ledger has `isCashBank = true` AND the line itself has a non-null `projectId`.
- [ ] Supports filtering by: Company, Fiscal Year, Date Range, Project, Cost Center, Account Type (CASH, BANK, MFS, ALL), and Voucher Type.
- [ ] Calculates period inflow (debit), outflow (credit).
- [ ] Calculates opening and closing balances for the selected project's cash/bank/MFS lines if feasible.

## 2. Frontend Report Page
- [ ] A new page exists at `/app/reports/project-fund-movement`.
- [ ] Page title is "Project Fund Movement View".
- [ ] Includes standard report filters matching the API capabilities.
- [ ] Renders a data table showing date, voucher number, particular/narration, inflow, outflow, and running balance.
- [ ] Empty state clearly explains that only cash/bank/MFS lines explicitly tagged with a project are shown.

## 3. Demo Dataset Impact
- [ ] The base deterministic demo dataset remains unchanged unless explicitly modified and approved in a later implementation chunk.
- [ ] `pnpm demo:verify` and `pnpm demo:audit` run successfully without breaking due to new report logic.

## 4. Verification Commands
- [ ] `pnpm prisma:generate` completes without errors.
- [ ] `pnpm typecheck` finds no TypeScript errors.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build:web` and `pnpm build:api` complete successfully.
- [ ] `pnpm check:all` and `pnpm doctor` pass.
- [ ] `pnpm demo:audit` and `pnpm demo:verify` pass against the database.
