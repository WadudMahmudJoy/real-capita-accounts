# Phase 2K: Voucher Fund-Line Project Tagging Implementation Plan

This plan breaks down the Phase 2K requirements into executable chunks.

## Chunk 2K-1: Requirement Lock
- **Goal**: Lock requirements, naming (Voucher Fund-Line Project Tagging), business rules (Option A same-line, explicit tagging, optional fields, helper texts), and scope.
- **Actions**: Create Phase 2K requirement lock, acceptance, and plan docs. Update system prompt/handoff.
- **Status**: **COMPLETE** (in this session)

## Chunk 2K-2: Backend Validation Audit / Support
- **Goal**: Verify that the NestJS backend and DTO validation allow optional `projectId` and `costCenterId` on lines where `cashBankAccountId` is present.
- **Actions**:
  - Audit `validatePostingLine` in `apps/api/src/voucher/voucher.service.ts` to ensure it doesn't reject `projectId` on cash/bank ledger lines.
  - Review `VoucherLineDto` in `apps/api/src/voucher/dto/voucher-line.dto.ts` to ensure `projectId` and `costCenterId` are correctly marked as optional.
  - If any validation blocks them, adjust backend logic to permit optional project tagging on Cash/Bank/MFS lines.
- **Status**: **NOT STARTED**

## Chunk 2K-3: Frontend Voucher Form Update
- **Goal**: Update the frontend voucher form to display optional Project and Cost Center selectors on Cash/Bank/MFS lines.
- **Actions**:
  - Update visibility flags (`showProject`, `showCostCenter`) in `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx` to include `requirements.isCashBank`.
  - Update `deriveVoucherLineFieldRequirements` in `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx` to enrich guidance text for Cash/Bank/MFS lines:
    *"Cash/Bank/MFS account is required. Project and cost center are optional for fund-line tagging (enables fund visibility in Project Fund Movement report)."*
  - Ensure dynamic scoping of Cost Center to the selected Project works correctly on Cash/Bank/MFS lines.
  - Ensure clearing the ledger account clears Project/Cost Center values from the line state.
- **Status**: **NOT STARTED**

## Chunk 2K-4: Browser/API/Report Regression Verification
- **Goal**: Verify end-to-end functionality via manual UI / API testing and ensure zero regression.
- **Actions**:
  - Run the application locally and log in as Accountant.
  - Create a draft PAYMENT voucher, select a Cash ledger account, and verify that Project and Cost Center selectors are rendered as optional with the new guidance.
  - Tag the Cash line with Project `SK-001` and Cost Center `SK-LD`. Post the voucher.
  - Navigate to Project Fund Movement View and verify that the cash movement appears correctly.
  - Verify that the transaction does not cause double-counting in Project Cost or Project Financial Summary reports.
  - Verify that the base demo dataset is unchanged, and `pnpm demo:audit` (62 PASS) and `pnpm demo:verify` (47 PASS) pass successfully.
- **Status**: **NOT STARTED**

## Chunk 2K-5: Final Acceptance and Docs Cleanup
- **Goal**: Finalize Phase 2K documentation and prepare for final user review.
- **Actions**:
  - Clean up guide files (`AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`).
  - Confirm readiness for user-created tag `phase-2k-complete`. Do not tag automatically.
- **Status**: **NOT STARTED**
