# Phase 2L: Voucher Reversal / Rectification Workflow Plan

This plan breaks down the Phase 2L requirements into executable chunks.

## Chunk 2L-1: Requirement Lock
- **Goal**: Lock requirements, business logic, schema modifications, date boundaries, and out-of-scope boundaries.
- **Actions**: Create Phase 2L requirement lock, acceptance, and plan docs. Update status files.
- **Status**: **COMPLETE** (in this session)

## Chunk 2L-2: Schema / Linkage & Backend Reversal Draft Generation
- **Goal**: Implement database model extensions and the NestJS backend reversal generation endpoint.
- **Actions**:
  - Update `prisma/schema.prisma` to add self-referencing relationship fields and `correctionReason` to `Voucher` model.
  - Run database migration to apply schema changes.
  - Create `POST /vouchers/:id/reversal` endpoint in the NestJS api.
  - Validate that the target voucher is `POSTED`, not soft-deleted, and not already reversed.
  - implement transactional draft voucher generation swapping debit/credit sides and copying relevant metadata.
- **Status**: **NOT STARTED**

## Chunk 2L-3: Frontend Reversal UX
- **Goal**: Build the frontend UI workflows for initiating and reviewing voucher reversals.
- **Actions**:
  - Add a "Create Reversal" button on the posted voucher detail page.
  - Implement a reversal reason dialog on click.
  - Route the user to the generated draft form with reversal banner alerts.
  - Render linkage banners on both the original and reversal voucher detail views.
- **Status**: **NOT STARTED**

## Chunk 2L-4: Posting & Report Regression Verification
- **Goal**: Verify end-to-end reversal posting and correctness across general ledger and project reports.
- **Actions**:
  - Run local dev servers and verify the reversal flow manually.
  - Confirm that reversal vouchers post correctly to open periods and reject closed ones.
  - Verify that reports (Trial Balance, Ledger, Books, Project reports) net out corrected entries correctly.
  - Restore database and verify that `pnpm demo:audit` (62 PASS) and `pnpm demo:verify` (47 PASS) pass successfully.
- **Status**: **NOT STARTED**

## Chunk 2L-5: Final Acceptance and Docs Cleanup
- **Goal**: Finalize documentation and prepare for final user review.
- **Actions**:
  - Clean up status files (`AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`).
  - Confirm readiness for user-created tag `phase-2l-complete`.
- **Status**: **NOT STARTED**
