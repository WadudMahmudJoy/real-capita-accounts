# Phase 2L: Voucher Reversal / Rectification Workflow Acceptance Criteria

This document defines the acceptance criteria for the Phase 2L implementation.

## 1. Documentation Lock (Phase 2L-1)
- [ ] Requirements lock, acceptance criteria, and implementation plan are created.
- [ ] Status files (AGENTS.md, README.md, docs/ai/START_HERE.md, docs/ai/CURRENT_STATE.md, docs/handoff.md) are updated.
- [ ] No database schema changes, migrations, or backend/frontend logic updates are implemented in the requirements lock phase.

## 2. Schema Linkage & Backend Draft Generation (Phase 2L-2)
- [ ] Database migration successfully adds `reversalOfVoucherId` and `correctionReason` fields to the `Voucher` model.
- [ ] Self-referencing 1:1 relationship between original and reversal vouchers is validated in the Prisma client.
- [ ] New endpoint `POST /vouchers/:id/reversal` is implemented and guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- [ ] Endpoint validates:
  - Original voucher exists, is not soft-deleted, and status is `POSTED`.
  - Original voucher is not already reversed (i.e. `reversedBy` relation must be null).
  - A non-empty `reason` string (minimum 10 characters) is provided in the request body.
- [ ] Endpoint successfully generates a new `DRAFT` voucher inside a Prisma transaction:
  - Swaps all lines (debits become credits, credits become debits).
  - Copies ledger accounts, project IDs, cost center IDs, cash/bank account IDs, and amounts exactly.
  - Sets the `reversalOfVoucherId` to the original voucher ID.
  - Sets `narration` to `[Reversal of {originalSystemVoucherNo}] - {enteredReversalReason}`.
  - Sets `correctionReason` to the entered reason.
  - Returns the newly created draft voucher ID.

## 3. Frontend Reversal UX (Phase 2L-3)
- [ ] A "Create Reversal" button is rendered on the posted voucher detail page.
- [ ] Clicking the button opens a modal requesting the reversal reason with validation for character length.
- [ ] Submitting the modal redirects the user to the newly generated draft reversal voucher form.
- [ ] The draft reversal form displays a prominent alert linking to the original voucher: `"Reversal of Voucher {originalVoucherNo}"`.
- [ ] The generated draft lines are editable and deletable like any normal draft voucher before posting.
- [ ] If the draft reversal is deleted, the original voucher can have a reversal generated again.
- [ ] Once the reversal voucher is posted, the original voucher detail page shows a notice/badge: `"Reversed by {reversalVoucherNo} on {postingDate}"` with the reason.

## 4. Posting & Report Verification (Phase 2L-4)
- [x] PAYMENT/RECEIPT reversal posting validation fixed: reversal drafts can now be posted. `validateReversalLinkage` validates the original voucher exists, is POSTED, and has matching type. `validateVoucherTypeCashBankRules` allows reversed fund-line direction only for legitimate reversals. Normal non-reversal PAYMENT/RECEIPT rules unchanged.
- [x] **Reversal line-level equivalence enforced**: `validateReversalLineEquivalence` enforces exact line-level equivalence against the original posted voucher using a Map-based multiset comparison. A reversal draft can no longer be edited into a different amount/account/project/cost-center/cash-bank composition and still post. Line count must match; duplicate lines handled safely.
- [x] Posting the reversal voucher follows normal posting rules:
  - Must be balanced (total debit equals total credit).
  - Date must be in an `OPEN` accounting period.
  - Sets `status` to `POSTED` and captures `postingDate` and `postedById`.
- [x] Once posted, the reversal voucher is immutable (no editing or deletion).
- [x] Ledgers, Trial Balance, Cash Book, Bank Book, and MFS Book show the reversed entries chronologically.
- [x] Project Cost report nets out the expense correctly.
- [x] Project Fund Movement report nets out the fund movement correctly (Option A same-line logic).

## 5. Verification Commands (Phase 2L-5)
- [ ] `pnpm prisma:generate` completes without errors.
- [ ] `pnpm typecheck` finds no TypeScript errors.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build:web` and `pnpm build:api` complete successfully.
- [ ] `pnpm check:all` and `pnpm doctor` pass.
- [ ] `pnpm demo:audit` (62 PASS) and `pnpm demo:verify` (47 PASS) pass against the database.
