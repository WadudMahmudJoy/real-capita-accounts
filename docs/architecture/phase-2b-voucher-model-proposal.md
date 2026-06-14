# Phase 2B Voucher Model Proposal

## Purpose

This is a proposal only. It is not implemented in Prisma, API code, or frontend code during Phase 2B.

The proposal describes the likely voucher engine models for a future implementation phase after user confirmation.

## Proposed Entities

Only these entities are proposed for the voucher engine implementation:

- Voucher
- VoucherLine
- VoucherType (enum)
- VoucherStatus (enum)
- VoucherNumberSequence (model or equivalent numbering approach)

## Proposed Enums

### VoucherType

```
enum VoucherType {
  DEBIT       // Debit Voucher
  CREDIT      // Credit Voucher
  JOURNAL     // Journal Voucher
  CONTRA      // Contra Voucher
  PAYMENT     // Payment Voucher
  RECEIPT     // Receipt Voucher
}
```

Note: The six-type model preserves traditional Bangladeshi accounting terminology. If Real Capita prefers a simpler four-type model, `DEBIT` and `CREDIT` can be removed, and those transactions would use `JOURNAL` instead. This decision must be confirmed before implementation.

### VoucherStatus

```
enum VoucherStatus {
  DRAFT       // Being prepared, editable
  POSTED      // Finalized, affects account balances, not freely editable
}
```

Note: A future `REVERSED` status or reversal voucher approach may be added when reversal/correction features are implemented, but is not proposed for the first voucher phase.

## Proposed Models

### Voucher

The Voucher model represents the transaction header.

```
model Voucher {
  id                String         @id @default(cuid())
  companyId         String         // links to Company
  fiscalYearId      String         // links to FiscalYear
  accountingPeriodId String        // links to AccountingPeriod
  voucherType       VoucherType    // one of six types
  status            VoucherStatus  @default(DRAFT)
  voucherNumber     String         @unique // system-generated, sequential per fiscal year
  physicalSiNo      String?        // physical SI No / physical voucher number from office paper
  voucherDate       DateTime       // determines the accounting period
  narration         String         // required description of the transaction
  postedAt          DateTime?      // null until posted
  postedByUserId    String?        // null until posted
  createdByUserId   String         // the user who created the voucher
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt
  company           Company        @relation(fields: [companyId], references: [id])
  fiscalYear        FiscalYear     @relation(fields: [fiscalYearId], references: [id])
  accountingPeriod  AccountingPeriod @relation(fields: [accountingPeriodId], references: [id])
  createdBy         User           @relation("VoucherCreatedBy", fields: [createdByUserId], references: [id])
  postedBy          User?          @relation("VoucherPostedBy", fields: [postedByUserId], references: [id], onDelete: SetNull)
  lines             VoucherLine[]

  @@unique([companyId, voucherNumber]) // voucher number unique per company
  @@index([fiscalYearId])
  @@index([accountingPeriodId])
  @@index([voucherType])
  @@index([status])
  @@index([voucherDate])
  @@map("vouchers")
}
```

### VoucherLine

The VoucherLine model represents each debit or credit entry within a voucher.

```
model VoucherLine {
  id                String   @id @default(cuid())
  voucherId         String   // links to Voucher
  ledgerAccountId   String   // links to LedgerAccount (required)
  isDebit           Boolean  // true for debit, false for credit
  amount            Decimal  @db.Decimal(18,2) // amount for this line
  projectId         String?  // optional, required if LedgerAccount.requiresProject is true
  costCenterId      String?  // optional, required if LedgerAccount.requiresCostCenter is true
  cashBankAccountId String?  // optional, links to CashBankAccount when the line involves cash/bank
  narration         String?  // optional line-level description
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  voucher           Voucher        @relation(fields: [voucherId], references: [id], onDelete: Cascade)
  ledgerAccount     LedgerAccount  @relation(fields: [ledgerAccountId], references: [id])
  project           Project?       @relation(fields: [projectId], references: [id], onDelete: SetNull)
  costCenter        CostCenter?    @relation(fields: [costCenterId], references: [id], onDelete: SetNull)
  cashBankAccount   CashBankAccount? @relation(fields: [cashBankAccountId], references: [id], onDelete: SetNull)

  @@index([voucherId])
  @@index([ledgerAccountId])
  @@index([projectId])
  @@index([costCenterId])
  @@map("voucher_lines")
}
```

### VoucherNumberSequence

The VoucherNumberSequence model manages sequential voucher numbering per fiscal year per voucher type (or per company-wide, depending on the confirmed approach).

```
model VoucherNumberSequence {
  id            String   @id @default(cuid())
  companyId     String   // links to Company
  fiscalYearId  String   // links to FiscalYear
  voucherType   VoucherType? // null if per-company numbering; specific type if per-type numbering
  lastNumber    Int      @default(0) // the last assigned number
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  company       Company    @relation(fields: [companyId], references: [id])
  fiscalYear    FiscalYear @relation(fields: [fiscalYearId], references: [id])

  // Unique constraint ensures one sequence per company+fiscalYear+(voucherType or null)
  @@unique([companyId, fiscalYearId, voucherType])
  @@map("voucher_number_sequences")
}
```

Note: If per-type numbering is confirmed, each voucher type gets its own sequence (e.g., PV-0001, RV-0001, JV-0001). If per-company-wide numbering is confirmed, `voucherType` is null and all vouchers share one sequence per fiscal year. The implementation must use database-level locking or atomic increment to prevent numbering gaps or duplicates under concurrent access.

## Proposed Relationships

### Voucher to Company

- Every voucher belongs to a company.
- Voucher number is unique within the company scope.
- Company context is required for voucher numbering sequences.

### Voucher to FiscalYear

- Every voucher belongs to a fiscal year.
- The fiscal year is derived from the voucher date at creation.
- Fiscal year determines the voucher numbering sequence scope.

### Voucher to AccountingPeriod

- Every voucher belongs to an accounting period.
- The accounting period is derived from the voucher date.
- Only vouchers in open accounting periods can be created or posted.
- Vouchers in locked or closed periods cannot be created, edited, or posted.

### VoucherLine to LedgerAccount

- Every voucher line references a LedgerAccount (account head).
- Only active LedgerAccounts can be selected.
- The LedgerAccount's normal balance, `requiresProject`, `requiresCostCenter`, and `isCashBank` flags govern validation rules for the line.

### VoucherLine to Project (optional)

- A voucher line may reference a Project.
- If the LedgerAccount has `requiresProject = true`, the project reference is mandatory.
- If the LedgerAccount has `requiresProject = false`, the project reference is optional.
- Only active projects can be selected.

### VoucherLine to CostCenter (optional)

- A voucher line may reference a CostCenter.
- If the LedgerAccount has `requiresCostCenter = true`, the cost center reference is mandatory.
- If the LedgerAccount has `requiresCostCenter = false`, the cost center reference is optional.
- Only active cost centers can be selected.
- If both project and cost center are provided, the cost center must belong to the selected project.

### VoucherLine to CashBankAccount (optional)

- A voucher line may reference a CashBankAccount when the line involves a cash/bank ledger account.
- Payment Vouchers and Receipt Vouchers must have at least one line linked to a CashBankAccount.
- Contra Vouchers must have exactly two lines linked to CashBankAccounts (one debit, one credit).
- Only active CashBankAccounts can be selected.

### Voucher to User (createdBy / postedBy)

- Every voucher records the user who created it (`createdByUserId`).
- When posted, the voucher records the user who posted it (`postedByUserId`).
- Only the `ACCOUNTANT` role can create, edit, and post vouchers in the current phase.

### Audit Behavior Through AuditEvent

The existing `AuditEvent` model should record voucher lifecycle events:

- `VOUCHER_CREATED`: recorded when a draft voucher is created.
- `VOUCHER_EDITED`: recorded when a draft voucher is modified.
- `VOUCHER_POSTED`: recorded when a voucher is posted.
- `VOUCHER_REVERSED`: recorded when a reversal/correction happens (future).

AuditEvent should reference the voucher through `entityType = "Voucher"` and `entityId = voucher.id`.

## Validation Rules

### Debit-Credit Balance

- The sum of all debit line amounts must equal the sum of all credit line amounts.
- This equality must hold before a voucher can be posted.
- If the totals do not match, the post action must fail with a clear error message.

### Minimum Lines

- A voucher must have at least two lines (at least one debit and one credit).
- A single-line voucher is invalid.

### Ledger Account Active Check

- Only active LedgerAccounts (`isActive = true`) can be referenced in voucher lines.
- The backend must validate this at creation and at posting.

### Project Requirement Enforcement

- If a LedgerAccount has `requiresProject = true`, the voucher line must include `projectId`.
- The backend must validate this at creation and at posting.

### Cost Center Requirement Enforcement

- If a LedgerAccount has `requiresCostCenter = true`, the voucher line must include `costCenterId`.
- If both `projectId` and `costCenterId` are provided, the cost center must belong to the project.
- The backend must validate this at creation and at posting.

### Cash/Bank Type Validation

- Payment Vouchers must have at least one line with a cash/bank LedgerAccount and CashBankAccount reference, where the cash/bank line is on the credit side (outgoing payment).
- Receipt Vouchers must have at least one line with a cash/bank LedgerAccount and CashBankAccount reference, where the cash/bank line is on the debit side (incoming receipt).
- Contra Vouchers must have exactly two lines with CashBankAccount references, one debit and one credit.
- Journal, Debit, and Credit Vouchers have no mandatory cash/bank line requirement.

### Accounting Period Open Check

- The voucher date must fall within an open (`OPEN`) accounting period.
- Vouchers with dates in locked or closed periods must be rejected at creation and at posting.

### Fiscal Year Active Check

- The fiscal year must be active (`isActive = true`) for voucher creation.
- Closed fiscal years (`isClosed = true`) must reject all voucher operations.

## Posting Rules

### Posting Transition

- Only `DRAFT` vouchers can be posted.
- Posting changes the voucher status from `DRAFT` to `POSTED`.
- Posting records `postedAt` (current timestamp) and `postedByUserId` (current user).

### Posting Immutability

- Once posted, the voucher header (date, type, narration) and all lines become immutable.
- Posted vouchers cannot be edited. They can only be reversed or corrected through new vouchers.

### Posting Validation at Post Time

The backend must re-validate all rules at the moment of posting, even if they were validated at creation time:

- Debit total equals credit total.
- All referenced LedgerAccounts are active.
- Project/cost center requirements are satisfied per LedgerAccount flags.
- Accounting period is still open (it may have been locked between creation and posting).
- Fiscal year is still active.
- Cash/bank type-specific rules are satisfied.

### Balance Effect

- Posting a voucher updates the running balance of each referenced LedgerAccount.
- The balance effect is derived from the posted VoucherLine records, not stored in a separate balance table.
- Account balances should be computed as: sum of debit line amounts minus sum of credit line amounts for each LedgerAccount, adjusted by the LedgerAccount's normal balance.

## Reversal / Correction Policy Proposal

### Approach: Reversal Voucher

When a posted voucher needs to be corrected or reversed:

1. The accountant creates a new reversal voucher that mirrors the original voucher with debits and credits swapped.
2. The reversal voucher references the original voucher through a `reversalOfVoucherId` field (optional future addition to the Voucher model).
3. The reversal voucher goes through the same draft-to-posted workflow.
4. The original posted voucher remains unchanged and retains its audit trail.

### Approach: Correction Voucher

For partial corrections where only some lines need adjustment:

1. The accountant creates a new correction voucher with the adjusting entries.
2. The correction voucher references the original voucher through a `correctionOfVoucherId` field (optional future addition).
3. The correction voucher goes through the same draft-to-posted workflow.

### Policy Recommendation

- Reversal and correction should use new vouchers, never direct modification of posted vouchers.
- The original voucher and the reversal/correction voucher together represent the true transaction history.
- This preserves a clean audit trail and follows standard accounting practice.

### Not Implemented in First Voucher Phase

Reversal/correction features are proposed for future implementation. The first voucher phase should support only DRAFT and POSTED status. A `REVERSED` status or reversal reference fields can be added when reversal features are confirmed.

## Deletion Policy Proposal

### No Hard Delete After Posting

- Posted vouchers must never be hard-deleted from the database.
- Deleting a posted voucher would break the accounting trail and balance integrity.
- If a posted voucher needs to be removed from active accounting, it must be reversed through a reversal voucher.

### Draft Voucher Deletion

- Draft vouchers may be soft-deleted or hard-deleted since they have no balance effect.
- If hard-deleted, the system-generated voucher number is still consumed and not reused.
- A soft-delete approach (adding `deletedAt` and `isDeleted` fields) is recommended for draft vouchers to preserve the audit trail of attempted entries.

### Recommendation

- Add `deletedAt DateTime?` and `isDeleted Boolean @default(false)` to the Voucher model for soft-delete of drafts.
- Posted vouchers cannot be soft-deleted or hard-deleted.
- Deleted draft voucher numbers remain consumed in the VoucherNumberSequence.

## Draft Editing Policy

### Draft Voucher Editing

- Draft vouchers can be freely edited by the `ACCOUNTANT` role.
- Edits include: changing voucher date (within an open period), changing narration, adding/removing/modifying lines, changing amounts.
- Each edit must be recorded in AuditEvent with action `VOUCHER_EDITED`.
- The system-generated voucher number does not change during edits.
- The voucher type may be changeable during the draft phase (open question for Real Capita).

### Draft Voucher Line Editing

- Lines can be added, removed, or modified in the draft phase.
- Each line modification must still satisfy validation rules (active LedgerAccount, project/cost center flags, etc.).

## Posted Editing Policy

### Posted Vouchers Are Immutable

- Posted vouchers cannot have their header fields, lines, amounts, date, or narration modified.
- The only permissible action on a posted voucher is reversal through a new reversal voucher.
- Direct modification of a posted voucher's data is prohibited at the backend level.

### No "Unpost" Action

- There should be no "unpost" or "revert to draft" action for posted vouchers.
- Reverting a posted voucher to draft would remove its balance effect and break the audit trail.
- Instead, reversal vouchers handle corrections.

## Accounting Period Lock / Close Behavior

### Period Lock

When an accounting period is locked (`LOCKED` status):

- No new vouchers can be created with dates in the locked period.
- No draft vouchers in the locked period can be posted.
- No draft vouchers in the locked period can be edited.
- Existing posted vouchers in the locked period remain visible but immutable.

### Period Close

When an accounting period is closed (`CLOSED` status):

- All behaviors of a locked period apply.
- Closed periods are a stronger state indicating the period is finalized.
- No voucher operations are permitted in closed periods.

### Fiscal Year Close

When a fiscal year is closed (`isClosed = true`):

- All accounting periods within the fiscal year become effectively closed.
- No voucher operations are permitted in any period of a closed fiscal year.
- Year-end closing is a deliberate action and should be confirmed by the accountant.

## Idempotency / Concurrency Concerns for Voucher Numbering

### Sequential Numbering Under Concurrency

- Voucher numbering must be atomic and deterministic even under concurrent requests.
- The `VoucherNumberSequence` model must use database-level locking to prevent duplicate numbers.
- Recommended approach: use a PostgreSQL `UPDATE ... RETURNING` transaction that increments `lastNumber` and returns the new number in a single atomic operation.

### Number Gap Prevention

- Even if a draft voucher is deleted or abandoned, its voucher number remains consumed.
- This prevents numbering gaps and ensures chronological integrity.
- The `VoucherNumberSequence.lastNumber` must never decrease.

### Idempotency

- The voucher creation endpoint must be idempotent for the same input if called twice accidentally.
- If a duplicate creation request arrives, the system should detect it (e.g., by checking if a voucher with the same system number already exists within the current transaction) and return the existing voucher rather than creating a duplicate.

## Derived Reports: Not Stored as Primary Manual Tables

### Key Principle

Trial Balance, ledger reports, cash book, bank book, and financial statements should be derived from posted VoucherLine records. They should not be stored as separate primary manual tables.

### Why

- Storing balances or report summaries in separate tables creates a dual-source problem: the VoucherLine data and the stored report data could diverge.
- Computing reports from posted VoucherLines ensures a single source of truth.
- Derived reports can be computed on demand or cached with a refresh mechanism, but the VoucherLine records remain the authoritative source.

### Future Implementation

- Ledger report: sum of debit and credit amounts per LedgerAccount, filtered by date range and accounting period.
- Cash book: filter posted VoucherLines where the LedgerAccount is a cash account, ordered by date.
- Bank book: filter posted VoucherLines where the LedgerAccount is a bank account, ordered by date.
- Trial balance: aggregate of all LedgerAccount balances from posted VoucherLines for a given period or fiscal year.
- Financial statements: Income Statement from Income/Expense LedgerAccounts; Balance Sheet from Asset/Liability/Equity LedgerAccounts.

These are not implemented in the voucher phase. They are proposed for a future reporting phase.

## What Not To Model Yet

Do not model these in the voucher implementation phase unless the user gives a new explicit instruction:

- Party / Customer / Vendor
- Payroll / SalaryRun
- FinancialStatement stored table
- TrialBalance stored table
- Dashboard analytics
- File attachments on vouchers
- Additional roles (Checker, Approver, Admin)
- Approval workflow models
- Reversal reference fields on Voucher (until reversal features are confirmed)

## Proposal Status

This proposal is locked for discussion and next-agent orientation only. It becomes implementation scope only after the user confirms the next voucher implementation phase.
