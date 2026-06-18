# Phase 2J: Project Fund Movement View Implementation Plan

This plan breaks down the Phase 2J requirements into executable chunks.

## Chunk 2J-1: Requirement Lock (Current)
- **Goal**: Lock requirements, naming (Project Fund Movement View), rule (Option A - Strict same-line only), and scope.
- **Actions**: Create Phase 2J requirement, acceptance, and plan docs. Update system prompt/handoff.
- **Status**: **COMPLETE**

## Chunk 2J-2: Backend Report API
- **Goal**: Implement the `project-fund-movement` report endpoint.
- **Actions**:
  - Add DTOs for filtering (company, date, project, account type, etc.).
  - Implement service logic reading from `VoucherLine` with `isCashBank = true` and `projectId` present.
  - Return formatted lines, totals, and opening/closing balances if applicable.
- **Constraints**: Accountant role only. No schema changes.

## Chunk 2J-3: Frontend Report Page
- **Goal**: Build the UI for the Project Fund Movement View.
- **Actions**:
  - Create `/app/reports/project-fund-movement` page.
  - Add filters (Basic and Advanced).
  - Add data table with Inflow/Outflow/Balance.
  - Handle empty states gracefully.

## Chunk 2J-4: Regression and Demo Verification
- **Goal**: Ensure the new report doesn't break existing reports or the demo dataset.
- **Actions**:
  - Run all report endpoints locally.
  - Verify Cash Book, Bank Book, and MFS Book are unchanged.
  - Run `pnpm demo:audit` and `pnpm demo:verify`.
  - Decide if an optional demo scenario is needed.

## Chunk 2J-5: Final Acceptance and Tag
- **Goal**: Finalize Phase 2J.
- **Actions**:
  - Final docs cleanup.
  - `git tag phase-2j-complete`.
