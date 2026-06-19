# Phase 2K: Voucher Fund-Line Project Tagging Acceptance Criteria

This document defines the acceptance criteria for the Phase 2K implementation.

## 1. Backend validation Audit & Support
- [ ] Backend `VoucherService` validation allows `projectId` and `costCenterId` to be present on lines where `cashBankAccountId` is specified.
- [ ] If both `projectId` and `costCenterId` are present on a Cash/Bank/MFS line, the backend verifies that the cost center belongs to the project (maintaining existing consistency validation).
- [ ] Backend rejects vouchers if other standard constraints are violated (e.g. inactive projects/cost centers, mismatched accounts).
- [ ] MFS accounts remain strictly rejected on JOURNAL vouchers.
- [ ] No Prisma schema changes or database migrations are created.

## 2. Frontend Voucher Form UX
- [ ] When editing a draft voucher (PAYMENT, RECEIPT, CONTRA), selecting a Cash, Bank, or MFS ledger account on a line makes the "Project" and "Cost Center" fields visible on that line.
- [ ] The Project and Cost Center fields on Cash/Bank/MFS lines are optional (not marked with a red asterisk).
- [ ] The fields display the hint: `"Optional for this ledger."`
- [ ] Cost Center dropdown values are scoped to the selected project on that line.
- [ ] The line-level guidance text for a Cash/Bank/MFS line reads: 
  *"Cash/Bank/MFS account is required. Project and cost center are optional for fund-line tagging (enables fund visibility in Project Fund Movement report)."*
- [ ] Clearing the Cash/Bank/MFS ledger account or switching to a ledger that does not require project/cost center hides these fields and clears their values (preserving Phase 2F state cleanup).
- [ ] Switch to a JOURNAL voucher hides MFS accounts and ensures no MFS is selectable, conforming to Phase 2I.

## 3. Posting & Report Verification
- [ ] Tagged Cash/Bank/MFS voucher lines are successfully posted to the database with `projectId` and `costCenterId` saved.
- [ ] Posted and tagged lines appear correctly in the **Project Fund Movement View** under Inflow/Outflow/Balance.
- [ ] Untagged Cash/Bank/MFS lines do not appear in the Project Fund Movement View (Option A strict same-line rule).
- [ ] Project Ledger, Project Cost, Cost Center Summary, and Project Financial Summary reports function normally and do not double-count (Cash/Bank/MFS lines are not included in expense-based project costs).
- [ ] Cash Book, Bank Book, and MFS Book reports remain unaffected and continue to show all cash/bank/MFS transactions correctly.

## 4. Demo Dataset Integrity
- [ ] The base deterministic demo dataset remains unchanged.
- [ ] `pnpm demo:audit` and `pnpm demo:verify` run successfully and output 100% PASS on the base database.

## 5. Verification Commands
- [ ] `pnpm prisma:generate` completes without errors.
- [ ] `pnpm typecheck` finds no TypeScript errors.
- [ ] `pnpm lint` passes.
- [ ] `pnpm build:web` and `pnpm build:api` complete successfully.
- [ ] `pnpm check:all` and `pnpm doctor` pass.
- [ ] `pnpm demo:audit` (62 PASS) and `pnpm demo:verify` (47 PASS) pass against the database.
