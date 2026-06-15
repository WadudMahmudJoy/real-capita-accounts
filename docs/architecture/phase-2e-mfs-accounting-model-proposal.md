# Phase 2E: MFS Accounting Model Proposal

## Purpose

This is a proposal only. It is not implemented in Prisma, API code, or frontend code during Phase 2E.

The proposal describes the likely MFS accounting model and architecture for a future implementation phase after user confirmation and after the open questions in the Phase 2E requirement lock are resolved.

## Proposed Future Model

### CashBankAccountType Enum Extension

The existing `CashBankAccountType` enum currently has two values:

```
enum CashBankAccountType {
  CASH
  BANK
}
```

The proposed extension adds a third value:

```
enum CashBankAccountType {
  CASH
  BANK
  MFS    // new: Mobile Financial Services / digital wallet
}
```

This is the minimal schema change needed. `CASH` and `BANK` remain unchanged. `MFS` is added as a peer value, not a sub-type of either CASH or BANK.

### Why bKash Should Not Be Forced Under BANK

Arguments against treating MFS as a sub-type of BANK:

1. **Bank Book pollution**: If MFS accounts use `accountType = BANK`, the Bank Book will show bKash/Nagad transactions alongside real bank transactions (Dutch-Bangla Bank, City Bank, etc.). This misrepresents the company's actual bank position. The accountant cannot see a clean bank reconciliation view because it is mixed with MFS transactions.

2. **Different reconciliation workflow**: Bank accounts are reconciled against bank statements (monthly statements from the bank). MFS wallets are reconciled against MFS app balances or MFS provider statements (daily or per-transaction). Mixing them would make reconciliation harder.

3. **Different fee structure**: Bank charges (annual fees, transaction fees) are distinct from MFS charges (cash-in/cash-out fees, merchant payment fees). If MFS is forced under BANK, the Bank Book would show MFS service charges as bank charges, which is misleading.

4. **Regulatory distinction**: Bangladesh Bank recognizes MFS as a separate payment channel. The accounting system should reflect this distinction rather than hiding MFS inside bank accounts.

5. **Audit trail clarity**: Separate MFS Book provides a clear audit trail for all digital wallet transactions. If MFS is mixed into the Bank Book, auditing MFS activity requires filtering bank transactions by account, which is harder and more error-prone.

Arguments for treating MFS under BANK (not recommended, but acknowledged):

- Minimal schema change (no new enum value).
- bKash is technically operated by a bank (BRAC Bank subsidiary).

This proposal recommends MFS as a separate type. If Real Capita explicitly decides to force MFS under BANK, the requirement lock must be revised before implementation.

### Why bKash Should Not Be Forced Under CASH

Arguments against treating MFS as a sub-type of CASH:

1. **Cash Book pollution**: If MFS accounts use `accountType = CASH`, the Cash Book will show bKash/Nagad transactions alongside physical cash transactions. This misrepresents the company's actual physical cash position.

2. **Physical vs digital**: Physical cash can be counted and verified by hand. MFS balances can only be verified through the MFS app or provider statement. Mixing them obscures the physical cash count.

3. **Different audit requirements**: Physical cash audits require counting physical cash on hand. MFS audits require checking app balances and transaction history. They are fundamentally different verification processes.

### MFS Provider Field Concept

The proposed future `CashBankAccount` model extension for MFS:

| Field | Type | Required for MFS | Notes |
| --- | --- | --- | --- |
| `provider` | Enum: `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, `OTHER` | Yes (when accountType = MFS) | Identifies the MFS provider. Null for CASH/BANK accounts. |
| `providerOtherName` | String | Yes (when provider = OTHER) | Custom provider name when "Other" is selected. Null for standard providers and CASH/BANK accounts. |
| `walletNumber` | String | Yes (when accountType = MFS) | The mobile number or account number identifying the MFS wallet. Null for CASH accounts. Could replace or supplement `accountNumber` for BANK accounts. |
| `accountHolderName` | String | Optional | Name of the wallet holder. Useful for personal wallets registered under an individual name. Null by default. |

The existing fields `bankName`, `branch`, and `accountNumber` remain as optional fields primarily used for BANK accounts. For MFS accounts, they would typically be null.

### Proposed Prisma Schema Extension (Future, Not Current)

```prisma
enum CashBankAccountType {
  CASH
  BANK
  MFS
}

enum MfsProvider {
  BKASH
  NAGAD
  ROCKET
  UPAY
  OTHER
}

model CashBankAccount {
  id                String              @id @default(cuid())
  ledgerAccountId   String              @unique
  displayName       String
  accountType       CashBankAccountType
  bankName          String?
  branch            String?
  accountNumber     String?
  provider          MfsProvider?        // null for CASH/BANK; required for MFS
  providerOtherName String?             // required when provider = OTHER
  walletNumber      String?             // required for MFS; null for CASH
  accountHolderName String?
  isActive          Boolean             @default(true)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  ledgerAccount     LedgerAccount       @relation(fields: [ledgerAccountId], references: [id])
  voucherLines      VoucherLine[]

  @@map("cash_bank_accounts")
}
```

This is a proposed future model. It must not be implemented until the user confirms Phase 2E implementation.

### Alternative: Reuse `accountNumber` for `walletNumber`

If Real Capita prefers minimal schema changes, the `walletNumber` concept could reuse the existing `accountNumber` field:

- For BANK accounts: `accountNumber` holds the bank account number.
- For MFS accounts: `accountNumber` holds the MFS wallet number.
- For CASH accounts: `accountNumber` remains null (as it is now).

This approach avoids adding a new column but makes the semantics ambiguous. The recommended approach is a dedicated `walletNumber` field.

## Voucher-Line Level Impact

### Existing VoucherLine Structure

The current `VoucherLine` model has a `cashBankAccountId` optional foreign key referencing `CashBankAccount`. This field is used when the voucher line involves a cash, bank, or (future) MFS account.

### MFS Extension

When `CashBankAccountType` gains the `MFS` value, the `VoucherLine.cashBankAccountId` can reference MFS accounts alongside CASH and BANK accounts. No new field or foreign key is needed on `VoucherLine`.

The voucher line editor UI must offer MFS accounts in the cash/bank account dropdown when:
- The selected ledger account has `isCashBank = true`.
- The `accountType` of the referenced CashBankAccount matches the appropriate context.

### Posting Validation Extension

The existing posting validation rules (Phase 2C Chunk 2C-3) must be extended to include MFS:

1. **cashBankAccountId reference**: If a voucher line has a `cashBankAccountId`, it must reference an active `CashBankAccount`. The account can be CASH, BANK, or MFS. The account's `ledgerAccountId` must match the line's `ledgerAccountId`.

2. **Cash/bank ledger account lines**: Lines where `LedgerAccount.isCashBank = true` must have a `cashBankAccountId` at posting time. This applies to CASH, BANK, and MFS ledger accounts equally.

3. **Payment/Receipt/Contra rules**: The cash/bank side rules for Payment, Receipt, and Contra voucher types must include MFS alongside CASH and BANK. A Payment voucher can pay from an MFS wallet. A Receipt voucher can receive into an MFS wallet. A Contra voucher can transfer between MFS and cash, MFS and bank, or between two MFS wallets.

### No VoucherLine Schema Change

The `VoucherLine` model itself does not need any new fields for MFS support. The existing `cashBankAccountId` foreign key is sufficient.

## Report Impact

### Cash Book: Remains CASH Only

The Cash Book report must continue to filter by `CashBankAccount.accountType = CASH` only. No MFS transactions must appear in the Cash Book.

Existing query filter:

```sql
WHERE CashBankAccount.accountType = 'CASH'
```

This remains unchanged.

### Bank Book: Remains BANK Only

The Bank Book report must continue to filter by `CashBankAccount.accountType = BANK` only. No MFS transactions must appear in the Bank Book.

Existing query filter:

```sql
WHERE CashBankAccount.accountType = 'BANK'
```

This remains unchanged.

### MFS Book / Mobile Wallet Book: Uses MFS Only

A new report concept: MFS Book, filtering by `CashBankAccount.accountType = MFS`.

Proposed query filter:

```sql
WHERE CashBankAccount.accountType = 'MFS'
```

Behavior mirrors the Cash Book and Bank Book:

- Filters posted `VoucherLine` records where the linked `LedgerAccount.isCashBank = true` and the linked `CashBankAccount.accountType = MFS`.
- Shows receipt (debit) and payment (credit) with running balance.
- Opening/period/closing balances computed using the same formulas as Cash Book and Bank Book.
- Optional filter by specific MFS account (provider/wallet), fiscal year, accounting period, date range, project, cost center.
- Optional group-by-provider summary.

### Trial Balance: Remains Ledger-Account Based

The Trial Balance aggregates posted voucher lines by `ledgerAccountId`. MFS transactions affect ledger accounts through voucher lines. The Trial Balance automatically includes MFS-related movements without any special logic.

No change to Trial Balance query or presentation.

### Income Statement: Remains Account-Class Based

The Income Statement groups by `AccountClassCode` (INCOME, EXPENSE). MFS service charge expenses appear under EXPENSE. MFS-related income appears under INCOME. No special MFS grouping or section is needed.

No change to Income Statement query or presentation.

### Balance Sheet: Remains Account-Class Based

The Balance Sheet groups by `AccountClassCode` (ASSET, LIABILITY, EQUITY). MFS wallet balances appear under ASSET as part of the cash/bank asset group (same group as Cash in Hand and Bank Accounts). No special MFS section is needed.

No change to Balance Sheet query or presentation.

### Report API Endpoint Proposal

Proposed future endpoint:

| Endpoint | Purpose | Required Filter | Optional Filters |
| --- | --- | --- | --- |
| `GET /reports/mfs-book` | MFS Book / Mobile Wallet Book | `fiscalYearId` | `accountingPeriodId`, `startDate/endDate`, `cashBankAccountId` (MFS type), `projectId`, `costCenterId` |

This endpoint follows the same pattern as `GET /reports/cash-book` and `GET /reports/bank-book`.

The existing `CashBankBookReport` shared service can be extended to support MFS by adding a third account-type path (CASH, BANK, MFS) with the same computation logic.

## Decimal Handling

All MFS amounts follow the same decimal handling rules established in Phase 2C and Phase 2D:

- `VoucherLine.amount` uses `Prisma.Decimal` with `@db.Decimal(18, 2)`.
- Report API responses serialize money values as two-decimal strings using `Prisma.Decimal.toFixed(2)`.
- Frontend types use `string` for money fields.
- No floating-point arithmetic for money. All calculations use `Prisma.Decimal`.
- MFS service charges, transfers, and balances follow the same rules.

No new decimal handling logic is needed. The existing approach is sufficient.

## Backend Authority Rule

The backend remains the authority for all MFS accounting rules:

- MFS account creation and validation rules are enforced in the NestJS backend, not in the frontend.
- MFS posting validation rules (account type, ledger account match, active status) are enforced in the backend.
- MFS report computation is done in the backend; the frontend receives computed results.
- The frontend never computes MFS balances or running balances on its own.
- Wallet number validation (if any) is enforced in the backend.

## Migration Risk Notes for Future Implementation

When Phase 2E implementation begins, the following migration risks must be considered:

1. **Enum extension**: Adding `MFS` to `CashBankAccountType` requires a Prisma migration. PostgreSQL enum extensions are safe but require the `ALTER TYPE ... ADD VALUE` SQL command, which Prisma may handle through a custom migration. The existing CASH and BANK values remain unchanged.

2. **New enum**: Adding `MfsProvider` as a new Prisma enum requires a migration. This is a low-risk operation since it creates a new enum without affecting existing tables.

3. **New columns**: Adding `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName` columns to the `cash_bank_accounts` table requires a migration. These columns are optional (nullable), so existing CASH and BANK rows will have null values. No data loss or corruption risk.

4. **Cash/bank account dropdown**: The frontend cash/bank account dropdown currently offers CASH and BANK accounts. Adding MFS accounts requires the dropdown to include MFS accounts, filtered by context (voucher line ledger account). This is a UI change, not a data risk.

5. **Report service extension**: The existing `CashBankBookReport` shared service must be extended to support `accountType = MFS`. This is a backend code change with no schema impact. Regression risk: the Cash Book and Bank Book must continue to work unchanged after this extension.

6. **Seed data**: No MFS seed data should be added automatically. MFS accounts are created by the accountant through the UI. The existing seed script does not need changes.

7. **Voucher validation**: The posting validation service must include MFS in its cash/bank account type checks. Regression risk: existing CASH and BANK voucher posting must continue to work unchanged.

8. **Frontend routing**: A new `/app/reports/mfs-book` route must be added. This does not affect existing routes.

## No Current Code Changes

This proposal is specification only. No Prisma schema changes, no migrations, no backend code, no frontend code, no API endpoints, no UI pages, no seed data, no roles, and no runtime behavior changes have been made.

The proposal becomes implementation scope only after the user explicitly confirms Phase 2E implementation and the open questions in the Phase 2E requirement lock are resolved or deferred.
