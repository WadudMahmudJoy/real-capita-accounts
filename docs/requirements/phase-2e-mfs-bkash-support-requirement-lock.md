# Phase 2E: MFS / bKash Support Requirement Lock

## Purpose

Phase 2E locks the requirements and specifications for Mobile Financial Services (MFS) / bKash transaction support before any implementation, schema change, API endpoint, frontend page, or runtime behavior is added.

This document exists so the next agent or developer can continue from repository context alone, without relying on hidden chat memory.

## Current Status

**Future requirement, not implemented.** No schema, enum, API, frontend, report, validation, or seed data changes have been made for MFS / bKash support. This document is a specification lock only.

## A. Confirmed Business Context

- Phase 2D accounting reports are complete and accepted at commit `be482c2`.
- Phase 2C voucher engine is complete and accepted.
- Phase 2A accounting foundation is complete and accepted.
- Only the `ACCOUNTANT` role is confirmed. Other roles are deferred until Real Capita confirms exact office responsibilities.
- Reports must derive from posted voucher data, not from separate manual report tables.
- Real Capita frequently uses bKash and other MFS providers for daily business transactions beside physical cash and bank transfers.
- MFS / bKash was intentionally not implemented in Phase 2D and must not be forced under existing CASH or BANK account types without explicit design approval.

### Confirmed Single-Role Rule

The only active role is:

- `ACCOUNTANT`, displayed as `Accountant`

Do not implement, seed, display, or model Admin, Super Admin, Data Entry, Checker, MD Viewer, HR, Sales, Payroll, Viewer, Manager, or any other role in Phase 2E.

## B. Phase 2E Scope

Phase 2E is documentation/specification lock only.

Phase 2E does not include:

- Database schema changes
- Prisma model additions or enum changes
- API business modules or endpoints
- Frontend business pages or sidebar entries
- Business seed data
- Additional roles
- Runtime MFS logic
- CashBankAccountType code changes
- MFS provider enum code additions
- Voucher validation changes
- Report behavior changes

## What Phase 2E Is

Phase 2E defines MFS / bKash transaction support requirements, constraints, terminology, accounting model, report impact, validation rules, open questions, and acceptance criteria for a future implementation phase.

## What Phase 2E Is Not

Phase 2E is not a coding phase. It must not add MFS enums, MFS accounts, MFS API endpoints, MFS UI pages, MFS dropdowns, MFS report logic, or any MFS runtime behavior.

## C. Terminology

| Term | Definition |
| --- | --- |
| MFS | Mobile Financial Services. The category of digital wallet-based financial services in Bangladesh, including bKash, Nagad, Rocket, Upay, and similar providers. |
| Wallet / MFS Account | A digital account held with an MFS provider, identified by a mobile phone number or account number. Functionally equivalent to a cash/bank account for accounting purposes, but separate from physical cash and traditional bank accounts. |
| Provider | The MFS service provider (e.g., bKash, Nagad, Rocket, Upay). Each MFS account is associated with exactly one provider. |
| Cash-in | Transferring physical cash into an MFS wallet. Debit: MFS Wallet; Credit: Cash in Hand. |
| Cash-out | Transferring funds from an MFS wallet to physical cash. Debit: Cash in Hand; Credit: MFS Wallet. |
| Merchant payment | A payment made by a customer to Real Capita through an MFS provider. Debit: MFS Wallet; Credit: Customer Receivable or Income, depending on locked future accounting setup. |
| Transfer | Moving funds between two MFS wallets, or between an MFS wallet and a bank account. Recorded as a Contra-type voucher with MFS lines. |
| Service charge | A fee charged by the MFS provider for a transaction (cash-in, cash-out, merchant payment, transfer). Must be recorded as a separate explicit expense line in the voucher. Do not auto-invent service charge formulas or deduction logic. |

## D. Supported Future Providers

The following MFS providers are recognized for future implementation. Real Capita should confirm which providers they actually use before implementation begins.

| Provider | Notes |
| --- | --- |
| bKash | The most widely used MFS provider in Bangladesh. Real Capita's primary MFS channel. |
| Nagad | Postal MFS service operated by Bangladesh Post Office. |
| Rocket | MFS service by Dutch-Bangla Bank. |
| Upay | MFS service by United Commercial Bank. |
| Other | Placeholder for any additional MFS provider Real Capita may use. The "Other" option allows entering a custom provider name not in the predefined list. |

Do not add provider-specific business logic (e.g., bKash API integration, Nagad statement import) until Real Capita explicitly confirms each such requirement.

## E. Accounting Source Rule

### Core Principle: Reports From Posted Voucher Lines Only

All MFS reports must derive from `VoucherLine` rows attached to `Voucher.status = POSTED` and `Voucher.isDeleted = false`.

- `DRAFT` vouchers must not affect MFS reports.
- Soft-deleted vouchers must not affect MFS reports.
- No editable MFS ledger/report rows.
- No primary MFS report tables in the Prisma schema.

This rule is consistent with the Phase 2D core report principle. The MFS Book / Mobile Wallet Book must use the same posted-voucher-line derivation model as the Cash Book and Bank Book.

## F. Cash / Bank / MFS Separation Rule

### MFS Is a Separate Account Type, Not BANK or CASH

MFS accounts must be treated as a separate cash/bank-equivalent account type in the accounting model. The reasons:

1. **Accounting accuracy**: MFS wallets are not bank accounts. They are digital wallets with different reconciliation workflows, service charges, and transaction patterns. Forcing MFS under BANK would make the Bank Book show MFS transactions alongside real bank transactions, which misrepresents the company's bank position.

2. **Accounting accuracy**: MFS wallets are not physical cash. Forcing MFS under CASH would make the Cash Book show digital wallet transactions alongside physical cash transactions, which misrepresents the company's cash position.

3. **Report clarity**: A separate MFS Book / Mobile Wallet Book provides the accountant with a clear view of MFS-only transactions, running balances, and reconciliation, without mixing them with cash or bank data.

4. **Audit clarity**: Each account type has its own reconciliation workflow. Cash is reconciled against physical cash counts. Bank is reconciled against bank statements. MFS is reconciled against MFS provider statements or app balances. Mixing them would obscure the reconciliation trail.

5. **Regulatory consideration**: Bangladesh Bank regulatory guidance treats MFS as a distinct payment channel. The accounting system should reflect this distinction.

### Existing CASH and BANK Behavior Must Remain Unchanged

- Cash Book must continue to show only CASH-type `CashBankAccount` transactions.
- Bank Book must continue to show only BANK-type `CashBankAccount` transactions.
- No existing voucher validation, report behavior, or UI logic for CASH or BANK must be altered by Phase 2E implementation.

### Proposed Account Type Model

The proposed future `CashBankAccountType` enum extension:

```
enum CashBankAccountType {
  CASH
  BANK
  MFS    // new: Mobile Financial Services / digital wallet
}
```

This adds `MFS` as a third option alongside existing `CASH` and `BANK`. The existing `CASH` and `BANK` values remain unchanged.

### When MFS Could Be Forced Under BANK (Not Recommended)

If Real Capita explicitly decides that MFS should be treated as a sub-category of bank accounts (e.g., "bKash is just another bank account"), then the requirement lock must be revised before implementation. This document recommends MFS as a separate type, but acknowledges that Real Capita's explicit decision overrides this recommendation.

## G. MFS Account Setup Requirements

### Future MFS Account Fields

When an MFS account is created in the future, it should include:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ledgerAccountId` | String (FK) | Yes | Links to an `isCashBank = true` ledger account. Same pattern as existing CASH/BANK accounts. |
| `displayName` | String | Yes | Human-readable name for the MFS account (e.g., "bKash - Personal Wallet", "Nagad - Merchant Account"). |
| `accountType` | `MFS` (new enum value) | Yes | Must be `MFS`. The account type dropdown in the UI will offer CASH, BANK, and MFS. |
| `provider` | Enum or String | Yes | The MFS provider (bKash, Nagad, Rocket, Upay, Other). When "Other" is selected, a custom provider name field should appear. |
| `walletNumber` | String | Yes | The mobile phone number or account number that identifies the MFS wallet. This is the primary identifier for the MFS account, analogous to `accountNumber` for BANK accounts. |
| `accountHolderName` | String | Optional | The name of the person or entity that holds the MFS wallet. Useful when the wallet is registered under a different name than the company. |
| `isActive` | Boolean | Yes | Default true. Same pattern as existing CASH/BANK accounts. |

### MFS Wallet Number Handling

The `walletNumber` field stores the MFS account identifier. Considerations:

- **Full vs masked storage**: Whether to store the full wallet number or a masked version is an open question for Real Capita confirmation. Full storage enables reconciliation against MFS statements; masked storage protects privacy in reports and prints.
- **Display in reports**: Whether wallet numbers should appear in print reports is an open question.
- **Validation**: The wallet number should follow the format rules for the selected provider (e.g., bKash numbers are Bangladeshi mobile numbers starting with specific prefixes). Validation rules should be documented per provider, but should not be enforced until Real Capita confirms.

### Legacy CASH/BANK Fields Not Used for MFS

The existing `CashBankAccount` model has optional fields `bankName`, `branch`, and `accountNumber` designed for bank accounts. For MFS accounts:

- `bankName` should remain null/empty (MFS providers are not banks in the traditional sense).
- `branch` should remain null/empty.
- `accountNumber` should remain null/empty (MFS uses `walletNumber` instead).

Alternatively, the `accountNumber` field could be reused for `walletNumber` if Real Capita prefers minimal schema changes. This is an open question. The recommended approach is to add a dedicated `walletNumber` field to keep the semantics clear.

## H. Voucher Behavior Requirements

### MFS in Voucher Lines

Voucher lines that involve MFS accounts must reference a `CashBankAccount` with `accountType = MFS` through the existing `cashBankAccountId` field on `VoucherLine`.

This means:

- The existing `VoucherLine.cashBankAccountId` field can reference CASH, BANK, or MFS accounts.
- No new foreign key or field is needed on `VoucherLine` for MFS support.
- The voucher line editor UI must offer MFS accounts alongside CASH and BANK accounts when the selected ledger account has `isCashBank = true`.

### MFS Voucher Type Rules

The existing voucher types (DEBIT, CREDIT, JOURNAL, CONTRA, PAYMENT, RECEIPT) apply to MFS transactions without change. Specific usage:

| Voucher Type | MFS Usage | Example |
| --- | --- | --- |
| PAYMENT | Expense paid via MFS | Debit: Expense; Credit: bKash Wallet |
| RECEIPT | Income received via MFS | Debit: bKash Wallet; Credit: Income |
| CONTRA | Transfer between MFS and cash/bank | Debit: bKash Wallet; Credit: Cash in Hand (cash-in); or Debit: Cash in Hand; Credit: bKash Wallet (cash-out); or Debit: bKash Wallet; Credit: Bank Account (transfer to bank) |
| JOURNAL | MFS service charge | Debit: MFS Service Charge Expense; Credit: bKash Wallet |

### Posting Validation for MFS Lines

The existing posting validation rules from Phase 2C must be extended for MFS:

1. If a voucher line references a `CashBankAccount` with `accountType = MFS`, the `cashBankAccountId` must be provided (same rule as existing CASH/BANK lines).
2. The `cashBankAccountId` must reference an active MFS-type account belonging to the line's ledger account.
3. Payment, Receipt, and Contra cash/bank side rules must include MFS alongside CASH and BANK.

### Service Charge as Separate Expense Line

MFS service charges must be recorded as a separate expense line in the voucher, not auto-deducted from the transaction amount. For example, a bKash cash-out of BDT 5,000 with a BDT 25 service charge:

| Line | Side | Ledger Account | Amount |
| --- | --- | --- | --- |
| 1 | DEBIT | Cash in Hand | 5,000.00 |
| 2 | CREDIT | bKash Wallet | 5,025.00 |
| 3 | DEBIT | MFS Service Charge Expense | 25.00 |

Or alternatively, the service charge can be recorded in a separate voucher from the cash-out transaction. The accountant decides which approach to use. The system must not auto-invent service charge formulas.

Do not auto-calculate, auto-deduct, or auto-insert service charge amounts. The accountant enters all amounts manually.

## I. Report Behavior Requirements

### MFS Book / Mobile Wallet Book

A new report concept: **MFS Book** (also called Mobile Wallet Book), showing all posted transactions for MFS-type `CashBankAccount` records.

Behavior mirrors the Cash Book and Bank Book:

- Filters posted `VoucherLine` records where the linked `LedgerAccount.isCashBank = true` and the linked `CashBankAccount.accountType = MFS`.
- Each row shows:
  - Voucher number
  - Voucher date
  - Narration
  - Receipt (debit side for MFS account)
  - Payment (credit side for MFS account)
  - Running balance
- Opening balance, period movement, and closing balance, consistent with Cash Book / Bank Book formulas.
- Optional filter by specific MFS account (provider/wallet), fiscal year, accounting period, date range, project, cost center.
- Optional group-by-provider or group-by-account summary view.

### Cash Book: No Change

Cash Book must remain CASH-only. No MFS transactions must appear in the Cash Book.

### Bank Book: No Change

Bank Book must remain BANK-only. No MFS transactions must appear in the Bank Book.

### Trial Balance: No Change in Principle

Trial Balance remains ledger-account-based. MFS transactions affect ledger accounts through voucher lines, so the Trial Balance automatically includes MFS-related movements without any special logic. The Trial Balance does not need a separate MFS section; it continues to group by ledger account.

### Income Statement: No Change in Principle

Income Statement remains account-class-based. MFS service charge expenses appear under the EXPENSE section. MFS-related income appears under the INCOME section. No special MFS grouping is needed.

### Balance Sheet: No Change in Principle

Balance Sheet remains account-class-based. MFS wallet balances appear under the ASSET section (as part of the cash/bank asset group). No special MFS section is needed. The MFS wallet is just another asset ledger account with closing debit balance.

### Contra Vouchers in MFS Reports

Contra vouchers involving MFS accounts must appear correctly in the relevant books:

- MFS-to-cash transfer (cash-in): the MFS debit line appears as a receipt in the MFS Book; the cash credit line appears as a payment in the Cash Book.
- MFS-to-cash transfer (cash-out): the cash debit line appears as a receipt in the Cash Book; the MFS credit line appears as a payment in the MFS Book.
- MFS-to-bank transfer: the MFS credit line appears as a payment in the MFS Book; the bank debit line appears as a receipt in the Bank Book.

### Report API Endpoint for MFS Book

Proposed future endpoint:

- `GET /reports/mfs-book` -- MFS Book for MFS-type CashBankAccount posted voucher lines.

This endpoint follows the same pattern as `GET /reports/cash-book` and `GET /reports/bank-book`, filtered by `accountType = MFS`.

## J. Validation Requirements

### MFS Account Creation Validation

- `accountType` must be `MFS` (not CASH or BANK).
- `provider` must be one of the recognized providers (bKash, Nagad, Rocket, Upay, Other).
- `walletNumber` must be non-empty and valid for the selected provider format (validation deferred to open questions).
- `displayName` must be non-empty.
- `ledgerAccountId` must reference an active ledger account with `isCashBank = true`.
- When `provider = Other`, a custom provider name must be provided.

### MFS Voucher Line Validation

- `cashBankAccountId` for MFS lines must reference an active MFS-type CashBankAccount.
- The MFS CashBankAccount's `ledgerAccountId` must match the voucher line's `ledgerAccountId`.
- All existing posting validation rules (debit=credit, OPEN period, active references, project/cost-center rules) apply unchanged.

### No Auto-Invention of MFS Data

- Do not auto-create MFS accounts, provider enums, or wallet numbers in seed data.
- Do not auto-infer MFS provider from wallet number format.
- Do not auto-calculate MFS service charges.

## K. Print / Report Requirements

### MFS Book Print Foundation

When the MFS Book frontend page is implemented, it must include a browser print foundation following the same pattern as Phase 2D report prints:

- Real Capita Group heading
- Report title: "MFS Book" or "Mobile Wallet Book"
- Date range or period label
- Fiscal year label
- MFS account/provider/wallet number (subject to open questions about visibility)
- Transaction table with running balance
- Opening/period/closing balance summaries
- Footer with generation timestamp
- Prepared/Checked/Authorised signature placeholders

### Wallet Number Visibility in Print

Whether wallet numbers should appear in print reports is an open question for Real Capita confirmation. Options:

1. Full wallet number visible in print (for reconciliation clarity).
2. Masked wallet number (e.g., last 4 digits only) for privacy.
3. Provider name only, no wallet number in print.

### No PDF/Excel Export

PDF and Excel export for MFS reports is deferred, consistent with Phase 2D.

## L. Security / Privacy Requirements

### Role Access

Only the `ACCOUNTANT` role can access MFS-related endpoints and pages in the current phase.

- All MFS endpoints must be guarded by `AuthGuard` + `RolesGuard` + `ACCOUNTANT`.
- Unauthenticated access must return 401.
- Non-ACCOUNTANT users must receive 403.

### Wallet Number Privacy

MFS wallet numbers are sensitive personal/business identifiers. Considerations:

- Wallet numbers should not be exposed in unauthenticated API responses.
- Wallet numbers should not be stored in client-side localStorage.
- Whether wallet numbers are fully visible, partially masked, or hidden in reports and print outputs depends on Real Capita's preference (open question).
- The MFS Book API response may include wallet number metadata; the frontend decides what to display based on confirmed privacy rules.

### No MFS API Integration

Do not connect to any MFS provider's external API (bKash API, Nagad API, etc.) unless Real Capita explicitly confirms this requirement. The accounting system records MFS transactions manually through vouchers, not through automated provider integration.

## M. Decimal-Safe Money Handling

All MFS amounts must use the same decimal-safe approach established in Phase 2C and Phase 2D:

- Voucher line amounts use `Prisma.Decimal` with `@db.Decimal(18, 2)` precision.
- Report API responses serialize money values as two-decimal strings using `Prisma.Decimal.toFixed(2)`.
- Frontend types use `string` for money fields to match API serialization.
- No floating-point arithmetic for money. All calculations use `Prisma.Decimal` on the backend.
- MFS service charges, transfers, and balances follow the same decimal rules.

## N. Exclusions

Phase 2E requirement lock and the first MFS implementation must not include:

- MFS provider API integration (bKash API, Nagad API, etc.)
- MFS statement import or auto-reconciliation
- MFS transaction auto-discovery
- Auto-calculated or auto-deducted service charges
- MFS-specific voucher templates (beyond the existing six types)
- Party/customer/vendor module
- Customer aging or receivable tracking specific to MFS
- Dashboard analytics or MFS charts
- Payroll or salary modules
- Project Summary or Cost Center Summary implementation
- PDF/Excel export for MFS reports
- File uploads or attachments for MFS transactions
- Additional roles beyond ACCOUNTANT
- Admin, Super Admin, Checker, Data Entry, MD Viewer, HR, Sales, Payroll, or other roles
- Separate MFS report tables (MFSBook table, etc.)
- Business seed data containing real MFS transaction amounts or wallet numbers
- Code copied from the old ERP prototype
- bKash runtime dropdowns (until implementation phase)
- CashBankAccountType code changes (until implementation phase)
- MFS provider enum code additions (until implementation phase)
- Budget/forecast for MFS
- Tax/VAT computation specific to MFS
- Inter-company MFS transfers
- MFS merchant POS integration

## O. Open Questions for Real Capita Confirmation

The following questions must be answered or deferred before Phase 2E implementation begins:

1. **Which MFS providers does Real Capita actually use?** Is it only bKash, or does Real Capita also use Nagad, Rocket, Upay, or other providers?

2. **Does Real Capita maintain separate bKash merchant/personal wallets?** If so, each wallet should be a separate MFS account in the system.

3. **Should wallet number be stored fully or masked?** Full storage enables statement reconciliation; masked storage protects privacy.

4. **Are bKash/MFS fees entered manually or imported from transaction statements?** This document assumes manual entry. If Real Capita wants statement import, that is a separate future requirement.

5. **Should MFS Book group by provider/account?** Should the MFS Book default view show all MFS transactions across all providers, or should it group/filter by provider?

6. **Should MFS transfer/cash-in/cash-out need special voucher templates later?** The current six voucher types cover MFS transactions. If Real Capita wants dedicated "MFS Cash-In" or "MFS Cash-Out" templates, that is a future enhancement.

7. **Should account numbers/wallet numbers be visible in print reports?** This affects privacy and reconciliation workflow.

8. **Does Real Capita need a transaction ID/reference field at voucher header or line level?** MFS transactions often have a provider transaction ID (TrxID). Should this be stored on the voucher header, the voucher line, or a future dedicated field?

9. **Does Real Capita need MFS statement import later?** Importing bKash/Nagad statement CSV or API data is a future capability. It should not be built until explicitly confirmed.

10. **Should the `accountNumber` field on CashBankAccount be reused for wallet number, or should a dedicated `walletNumber` field be added?** Reusing minimizes schema changes; a dedicated field keeps semantics clear.

11. **Should MFS accounts have an optional `accountHolderName` field?** Useful when the wallet is registered under a personal name rather than the company name.

12. **Are there regulatory or audit requirements for MFS transaction recording specific to Real Capita's industry?**

## P. Future Transaction Examples

These examples demonstrate how MFS transactions should be recorded through the voucher system. They are specification examples, not runtime implementations.

### 1. bKash Cash-In from Physical Cash

Transferring BDT 10,000 from physical cash to the bKash wallet.

| Line | Side | Ledger Account | Cash/Bank/MFS Account | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | bKash Wallet (ledger) | bKash - Personal (MFS) | 10,000.00 |
| 2 | CREDIT | Cash in Hand (ledger) | Petty Cash (CASH) | 10,000.00 |

Voucher type: CONTRA (transfer between cash and MFS).

### 2. bKash Cash-Out to Physical Cash

Transferring BDT 5,000 from bKash wallet to physical cash, with BDT 25 service charge.

| Line | Side | Ledger Account | Cash/Bank/MFS Account | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | Cash in Hand (ledger) | Petty Cash (CASH) | 5,000.00 |
| 2 | CREDIT | bKash Wallet (ledger) | bKash - Personal (MFS) | 5,025.00 |
| 3 | DEBIT | MFS Service Charge Expense (ledger) | -- | 25.00 |

Voucher type: CONTRA (for lines 1 and 2) or JOURNAL (if service charge is a separate voucher).

Alternative: service charge recorded in a separate JOURNAL voucher.

| Line (separate voucher) | Side | Ledger Account | Cash/Bank/MFS Account | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | MFS Service Charge Expense | -- | 25.00 |
| 2 | CREDIT | bKash Wallet | bKash - Personal (MFS) | 25.00 |

### 3. Customer Payment Received via bKash

A customer pays BDT 50,000 via bKash.

| Line | Side | Ledger Account | Cash/Bank/MFS Account | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | bKash Wallet (ledger) | bKash - Merchant (MFS) | 50,000.00 |
| 2 | CREDIT | Customer Receivable or Income (ledger) | -- | 50,000.00 |

Voucher type: RECEIPT.

Note: "Customer Receivable" or "Income" depends on whether Real Capita uses a party/receivable module (future phase) or records customer payments directly against income accounts. This decision is deferred to the party module requirement lock.

### 4. Expense Paid via bKash

Paying BDT 3,000 for office supplies via bKash.

| Line | Side | Ledger Account | Cash/Bank/MFS Account | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | Office Supplies Expense (ledger) | -- | 3,000.00 |
| 2 | CREDIT | bKash Wallet (ledger) | bKash - Personal (MFS) | 3,000.00 |

Voucher type: PAYMENT.

### 5. bKash Service Charge (Explicit Separate Line)

Any MFS service charge must be recorded explicitly as a separate expense line. Do not auto-invent service charge formulas.

Service charge examples:
- bKash cash-out charge: BDT 25 for BDT 5,000 cash-out.
- bKash merchant payment charge: percentage-based fee (entered manually by the accountant).
- Nagad cash-in charge: varies by amount (entered manually).

The system must never auto-calculate these. The accountant enters the exact charge amount as a separate voucher line or a separate voucher.

## Q. Implementation Readiness Checklist

Before MFS implementation coding starts:

- User explicitly confirms the Phase 2E implementation phase.
- User confirms this requirement lock is still accurate.
- User answers or defers the open questions in section O.
- Agent checks `git status --short --branch`.
- Agent confirms `DATABASE_URL` uses `localhost:55432`.
- Agent confirms only `ACCOUNTANT` exists as a role.
- Agent confirms Phase 2D is complete and accepted.
- Agent reads `docs/architecture/phase-2e-mfs-accounting-model-proposal.md`.
- Agent reads `docs/acceptance/phase-2e-acceptance-criteria.md`.
- Agent confirms no MFS tables or enums already exist unexpectedly in the Prisma schema.

## R. Strict Stop Conditions

Stop before coding if:

- User has not confirmed the MFS implementation phase.
- Working tree is not clean.
- Git remote is not `https://github.com/MaruflRana/real-capita-accounts`.
- `DATABASE_URL` does not use port `55432`.
- Any unconfirmed role exists in schema, seed data, source, or database.
- Phase 2D is not complete and accepted.
- CashBankAccountType enum already has a value besides CASH and BANK unexpectedly.
- The agent is not inside `D:\real-capita-accounts`.

## S. Module-By-Module Requirement Lock

| Area | Locked Phase 2E Intent | Explicitly Deferred |
| --- | --- | --- |
| MFS account setup | CASH/BANK/MFS account type; provider field; wallet number; optional account holder name | MFS provider API integration, auto-validation of wallet format |
| MFS voucher lines | cashBankAccountId references MFS accounts; same posting validation extended for MFS | MFS-specific voucher templates, auto-service charge |
| MFS Book report | POSTED MFS-type voucher lines; running balance; opening/period/closing; provider/account filter | MFS statement import, auto-reconciliation |
| Cash Book | No change; remains CASH-only | -- |
| Bank Book | No change; remains BANK-only | -- |
| Trial Balance | No change; remains ledger-account-based | -- |
| Income Statement | No change; remains account-class-based | -- |
| Balance Sheet | No change; remains account-class-based | -- |
| Service charge | Explicit separate expense line; manual entry only | Auto-calculated service charges, provider fee schedule |
| Print foundation | Browser print for MFS Book following Phase 2D pattern | PDF/Excel export |
| Security | ACCOUNTANT role only | Viewer/Manager role for read-only report access |
| Privacy | Wallet number handling per Real Capita preference (open question) | MFS API key storage, external API credentials |
| Decimal handling | Same Decimal(18,2) / string serialization as Phase 2C/2D | -- |

## T. Next Prompt Summary

Next agent: read `AGENTS.md`, run `pnpm agent:start`, then read the Phase 2E requirement lock, the Phase 2E model proposal, and the Phase 2E acceptance criteria. Do not implement anything until the user explicitly confirms the next MFS implementation phase. If confirmed, implement only the MFS account and report features for the single `ACCOUNTANT` role. Do not add dashboard analytics, payroll reports, party reports, MFS API integration, bKash runtime dropdowns, or additional roles without separate confirmation.
