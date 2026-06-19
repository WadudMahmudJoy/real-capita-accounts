# Phase 2L: Voucher Reversal / Rectification Workflow Requirement Lock

## Purpose
Phase 2L locks the requirements, business logic, accounting rules, schema structure, and UX boundaries for the **Voucher Reversal / Rectification Workflow**.

## Business Background & Core Accounting Principle
In this system, posted vouchers are immutable. Direct editing or deletion of posted vouchers is strictly prohibited to preserve audit trail integrity and prevent accounting discrepancies. 

To correct errors on a posted voucher, accountants must create a new posted voucher that reverses the original entry. This ensures that every correction is fully recorded, audited, and traceable in the general ledger.

## Definitions
1. **Reversal Voucher**: A new voucher that fully negates a previously posted voucher by swapping the debit and credit sides of all lines, while maintaining the same ledger accounts, projects, cost centers, cash/bank/MFS accounts, and amounts.
2. **Rectification Voucher**: A voucher that adjusts specific lines or amounts (e.g., correcting an overpayment/underpayment) without reversing the entire voucher.

## Key Locked Decisions

### 1. Rectification Deferment
* **Decision**: Phase 2L focuses exclusively on **Full Voucher Reversal**.
* **Rationale**: Full voucher reversal is deterministic, unambiguous, and safe. Partial rectifications or automated correction adjustments are deferred to a future phase or sub-chunk unless explicitly requested and approved later.

### 2. Schema Linkage & Migration
* **Decision**: A schema migration is required to link the original voucher and its reversal voucher. 
* **Prisma Model Changes (Locked for Chunk 2L-2)**:
  We will add the following self-referencing relationship fields to the `Voucher` model:
  ```prisma
  // In model Voucher:
  reversalOfVoucherId String?  @unique
  reversalOf          Voucher? @relation("VoucherReversal", fields: [reversalOfVoucherId], references: [id])
  reversedBy          Voucher? @relation("VoucherReversal")
  correctionReason    String?
  ```
* **Migration Rule**: No schema files will be modified or migrations run during Phase 2L-1 (Requirement Lock).

### 3. Reversal Workflow
* **Trigger**: The Accountant opens a posted voucher's detail page and clicks "Create Reversal".
* **Reason Capture**: The system prompts for a mandatory "Reversal Reason" (minimum 10 characters).
* **Draft Generation**:
  * The system creates a new draft voucher of the same `voucherType` (or appropriate reversal type as defined by accounting policy, though keeping the same type is standard for symmetry).
  * Swaps line sides: lines with `side = DEBIT` become `side = CREDIT`, and lines with `side = CREDIT` become `side = DEBIT`.
  * Preserves: `ledgerAccountId`, `projectId`, `costCenterId`, `cashBankAccountId`, and `amount`.
  * Narration is pre-populated as: `[Reversal of {originalSystemVoucherNo}] - {enteredReversalReason}`.
  * Links the new draft voucher to the original voucher via `reversalOfVoucherId`.
* **Draft Lifecycle**:
  * The reversal voucher is generated as a `DRAFT`.
  * The Accountant can review, update narration, or delete the draft if they decide not to proceed.
  * Once the reversal voucher is posted:
    * It becomes `POSTED` and immutable.
    * Both the original and reversal vouchers remain in the ledger, forming the correct audit trail.

### 4. original Voucher Status & UI Flag
* **Status**: The original voucher's status remains `POSTED` and immutable.
* **UI Indicator**: On the original voucher's detail view, if `reversedBy` is present, display a prominent banner: `"This voucher was reversed by {reversalSystemVoucherNo} on {reversalPostingDate}. Reason: {correctionReason}"`.
* **Reports**: Both the original voucher lines and the reversal voucher lines must be included in reports (Trial Balance, Ledger, Books, Project reports) because they form the actual chronological general ledger activity.

### 5. Date & Period Behavior
* **Default Date**: The reversal voucher date defaults to today's date.
* **Allowed Period**: The Accountant can select a different date, but it must belong to a currently `OPEN` accounting period.
* **Constraints**: The system must reject posting if the selected date falls in a `LOCKED` or `CLOSED` period, using the existing validation guards. No backdating into a closed period is allowed.

### 6. Permissions
* **Role**: Restricted strictly to the `ACCOUNTANT` role.
* **Approval**: No multi-level approval or checker authorization is implemented in this phase.

## Report & Accounting Impact
* **General Ledger & Book Reports**: Balance sheets, income statements, and cash/bank/MFS books will automatically net out correctly when both the original and reversal vouchers are posted.
* **Project Reports**: 
  * **Project Cost**: Expenses net out to zero (or the adjusted amount) if the expense line was project-tagged.
  * **Project Fund Movement**: Cash movement nets out to zero if the Cash/Bank/MFS line was project-tagged, maintaining Option A strict same-line logic.

## Out-of-Scope
* Editing posted vouchers directly.
* Deleting posted vouchers from the database.
* Soft-deleting posted vouchers.
* Partial rectifications or adjustments (must reverse and post a new correct voucher instead).
* Multi-level approval/check workflows.
* Automated reversal posting (reversal must start as a draft for review).
* Backdoor database updates or manual status overrides.
* PDF/Excel exports or custom reversal receipt documents.
