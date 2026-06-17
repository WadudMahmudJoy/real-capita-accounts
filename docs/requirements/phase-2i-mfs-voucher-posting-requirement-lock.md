# Phase 2I: MFS Voucher Posting Continuation Requirement Lock

## Purpose

Phase 2I locks the requirements for enabling MFS (Mobile Financial Services) accounts inside voucher posting flows. The system already has MFS account setup (Phase 2E) and MFS Book reporting (Phase 2E), but actual MFS voucher posting behavior is still blocked. Phase 2I enables controlled MFS posting while preserving accounting safety, Cash Book CASH-only semantics, Bank Book BANK-only semantics, MFS Book MFS-only semantics, posted voucher immutability, and all existing report correctness.

This document exists so the next agent or developer can continue from repository context alone, without relying on hidden chat memory.

## Current Status

**Requirement lock only. Not implemented.** No voucher posting logic, backend validation, frontend UI, report behavior, Prisma schema change, migration, seed data, or runtime behavior changes have been made for Phase 2I. This document is a specification lock only.

The existing MFS posting block in `apps/api/src/voucher/voucher.service.ts` (line 672) throws:

```
BadRequestException("Line N: MFS voucher posting is deferred to a later Phase 2E chunk.")
```

This block must be removed and replaced with proper MFS posting acceptance in a future implementation chunk. It must not be removed during this requirement-lock phase.

## A. Confirmed Business Context

- Phase 2H Demo/Test Data Cleanup and Safe Demo Dataset Standardization is complete and accepted at `96fb653` (tag `phase-2h-complete`).
- Phase 2G Project/Cost-Center Financial Reporting is complete and accepted at `7e60a1f` (tag `phase-2g-complete`).
- Phase 2F Accounting Report + Accountant UX Refinement is complete and accepted at `17fede6` (tag `phase-2f-complete`).
- Phase 2E MFS account setup and MFS Book foundation are accepted. MFS account creation, listing, editing, deactivation, and MFS Book report are implemented. MFS voucher posting remains blocked.
- Phase 2D accounting reports are accepted. All 11 backend report endpoints and frontend report pages are implemented.
- Phase 2C voucher engine is accepted. Posted vouchers carry `projectId` and `costCenterId` on each `VoucherLine`.
- Phase 2A accounting foundation is accepted.
- Only the `ACCOUNTANT` role is confirmed. Other roles are deferred until Real Capita confirms exact office responsibilities.
- Reports derive from posted `VoucherLine` rows only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`). No primary report tables.
- MFS accounts already exist in the schema (`CashBankAccountType.MFS`, `MfsProvider` enum, `provider`, `providerOtherName`, `walletNumber`, `accountHolderName` fields on `CashBankAccount`). No schema/migration changes are needed for Phase 2I.

### Confirmed Single-Role Rule

The only active role is:

- `ACCOUNTANT`, displayed as `Accountant`

Do not implement, seed, display, or model Admin, Super Admin, Data Entry, Checker, MD Viewer, HR, Sales, Payroll, Viewer, Manager, or any other role in Phase 2I.

## B. Phase 2I Scope

Phase 2I is a documentation/specification lock only.

Phase 2I does not include:

- Database schema changes
- Prisma model additions or enum changes
- Migrations
- Backend API business endpoints beyond voucher posting validation changes
- Frontend business pages beyond voucher UI MFS selection
- Runtime voucher posting logic changes during requirement lock
- Report behavior changes during requirement lock
- Business seed data changes
- Additional roles
- Demo dataset changes during requirement lock

## What Phase 2I Is

Phase 2I defines the requirements, constraints, validation rules, reporting impact, UI requirements, and implementation chunks for enabling MFS accounts inside voucher posting flows. The existing `CashBankAccount` schema with `accountType = MFS` already supports MFS posting; the blocker is the explicit reject in `validatePostingLine`.

## What Phase 2I Is Not

Phase 2I is not a coding phase. It must not remove the MFS posting block, add MFS voucher runtime logic, change MFS Book report behavior, alter Cash Book/Bank Book semantics, modify the Prisma schema, or add demo MFS vouchers during this requirement-lock chunk.

## C. MFS Posting Scope

### Core Rule

A voucher line should be allowed to reference a `cashBankAccountId` where `CashBankAccount.accountType = MFS` when:

1. The `CashBankAccount` exists and is active.
2. The `CashBankAccount.ledgerAccountId` matches the voucher line's `ledgerAccountId`.
3. The selected ledger account has `isCashBank = true`.
4. The voucher type is PAYMENT, RECEIPT, or CONTRA.

### MFS Is Treated as Asset-Like Cash/Bank

MFS is an asset-like cash/bank account type, parallel to CASH and BANK, but reported separately in MFS Book. The accounting treatment:

- MFS wallet debit = money received into the MFS wallet (Receipt side).
- MFS wallet credit = money paid out from the MFS wallet (Payment side).
- MFS wallet running balance = cumulative debit minus credit, same pattern as Cash Book and Bank Book.
- MFS wallet balances appear as assets in the Balance Sheet when the linked ledger account class is ASSET.

### Existing CASH and BANK Behavior Must Remain Unchanged

- Cash Book must continue to show only CASH-type `CashBankAccount` transactions.
- Bank Book must continue to show only BANK-type `CashBankAccount` transactions.
- MFS Book must continue to show only MFS-type `CashBankAccount` transactions.
- No existing voucher validation, report behavior, or UI logic for CASH or BANK must be altered by Phase 2I implementation.

## D. Voucher Type Decisions

### PAYMENT

Example: Pay project expense from bKash wallet.

| Line | Side | Ledger Account | Cash/Bank/MFS | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | Land Development Expense | -- | 5,000.00 |
| 2 | CREDIT | bKash Merchant Wallet | bKash Merchant (MFS) | 5,000.00 |

Rules:

- PAYMENT vouchers require at least one cash/bank/MFS credit line before posting.
- `projectId` and `costCenterId` on the expense line follow `requiresProject` and `requiresCostCenter` on that ledger.
- MFS wallet line does not require `projectId` or `costCenterId` unless the MFS ledger itself requires them.
- MFS `cashBankAccountId` must reference an active MFS account linked to the line's ledger account.

### RECEIPT

Example: Receive booking/application money into bKash wallet.

| Line | Side | Ledger Account | Cash/Bank/MFS | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | bKash Merchant Wallet | bKash Merchant (MFS) | 10,000.00 |
| 2 | CREDIT | Capital Introduced / Income ledger | -- | 10,000.00 |

Rules:

- RECEIPT vouchers require at least one cash/bank/MFS debit line before posting.
- Do not introduce customer/party logic in this phase. Use generic ledger-level accounting only.
- MFS `cashBankAccountId` must reference an active MFS account linked to the line's ledger account.

### CONTRA

Example: Move money between Office Cash and bKash wallet (cash-in).

| Line | Side | Ledger Account | Cash/Bank/MFS | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | bKash Merchant Wallet | bKash Merchant (MFS) | 20,000.00 |
| 2 | CREDIT | Cash in Hand | Office Cash (CASH) | 20,000.00 |

Example: Move money from bKash wallet to City Bank (bank transfer).

| Line | Side | Ledger Account | Cash/Bank/MFS | Amount |
| --- | --- | --- | --- | --- |
| 1 | DEBIT | City Bank Account | City Bank Uttara (BANK) | 50,000.00 |
| 2 | CREDIT | bKash Merchant Wallet | bKash Merchant (MFS) | 50,000.00 |

Rules:

- CONTRA vouchers require exactly two cash/bank/MFS lines, one debit and one credit, before posting.
- The two lines may be any combination of CASH, BANK, and MFS account types.
- Debit total must equal credit total.
- MFS-to-CASH (cash-in), MFS-to-BANK (transfer to bank), CASH-to-MFS (cash-out), BANK-to-MFS, and MFS-to-MFS are all valid Contra combinations.

### JOURNAL

**Locked decision: JOURNAL must NOT support MFS cashBankAccountId in Phase 2I.**

JOURNAL remains ledger-only for operational cash/bank/MFS movement. Payment, Receipt, and Contra carry MFS operational movement. This boundary preserves workflow clarity and prevents accounting ambiguity.

If a future phase explicitly confirms that JOURNAL + MFS is needed (e.g., for MFS service charge recording where the MFS wallet is one side), that decision must be locked in a separate requirement document before implementation. Phase 2I does not open this path.

The existing backend already accepts `cashBankAccountId` on JOURNAL voucher lines for CASH and BANK. That existing behavior is preserved. The new rule is: JOURNAL voucher lines must NOT reference MFS-type `CashBankAccount`. Posting validation must reject JOURNAL + MFS with a clear error message.

## E. Validation Rules

Future implementation must enforce these rules. Backend validation remains the authority; frontend provides UX guidance only.

### E1. cashBankAccountId Consistency

If a voucher line has `cashBankAccountId`:

1. `cashBankAccount` must exist and be active.
2. `cashBankAccount.ledgerAccountId` must match `line.ledgerAccountId`.
3. `cashBankAccount.accountType` may be CASH, BANK, or MFS (for PAYMENT, RECEIPT, CONTRA).
4. `cashBankAccount.accountType` may be CASH or BANK only (for JOURNAL). MFS is rejected on JOURNAL lines.
5. MFS `cashBankAccountId` is accepted only when `accountType = MFS` and the linked ledger matches.

### E2. Ledger Consistency

If the selected ledger is cash/bank enabled (`isCashBank = true`):

1. `cashBankAccountId` should be required for operational cash/bank/MFS line posting.
2. No arbitrary `cashBankAccountId` on non-cash-bank ledgers.
3. No mismatched ledger-account/cashBankAccount pair.

### E3. Project/Cost Center Consistency

1. MFS wallet lines generally should NOT require `projectId` or `costCenterId` unless the selected MFS ledger itself requires them.
2. Expense/income/asset project lines must follow existing `requiresProject`/`requiresCostCenter` rules.
3. Do NOT infer `projectId` or `costCenterId` from opposite voucher lines. Use same-line metadata only.
4. Project reports include MFS lines only if the same MFS line carries `projectId`.
5. Payment example: `projectId` and `costCenterId` on the expense line only; MFS wallet line carries no project unless the MFS ledger itself requires it.

### E4. Voucher Balance and Immutability

1. Debit total must equal credit total.
2. Existing posted voucher immutability remains.
3. Draft/post validation remains backend authority.
4. Corrections remain via reversal/rectification later, not editing posted vouchers.

### E5. MFS-Specific Validation

1. MFS provider, wallet number, display name rules must follow existing `CashBankAccount` schema. No new provider validation is added.
2. No real wallet numbers in demo data; use placeholders.
3. No provider API integration.
4. No live bKash/Nagad/Rocket API calls.
5. No balance inquiry or payment gateway behavior.
6. This is accounting recordkeeping only.

### E6. Voucher Type Cash/Bank Rules Extension

The existing `validateVoucherTypeCashBankRules` method checks for PAYMENT (at least one cash/bank credit line), RECEIPT (at least one cash/bank debit line), and CONTRA (exactly two cash/bank lines, one debit, one credit). These rules must be extended to include MFS alongside CASH and BANK:

- PAYMENT: at least one CASH/BANK/MFS credit line.
- RECEIPT: at least one CASH/BANK/MFS debit line.
- CONTRA: exactly two CASH/BANK/MFS lines, one debit, one credit.
- JOURNAL: no MFS cash/bank lines allowed; CASH/BANK journal lines are accepted per existing behavior.
- DEBIT/CREDIT: existing behavior preserved; no MFS-specific changes.

### E7. MFS Posting Block Removal

The existing block at `voucher.service.ts` line 672:

```typescript
if (line.cashBankAccount.accountType === CashBankAccountType.MFS) {
  throw new BadRequestException(
    `${label}: MFS voucher posting is deferred to a later Phase 2E chunk.`,
  );
}
```

Must be removed and replaced with voucher-type-aware MFS acceptance:

- PAYMENT, RECEIPT, CONTRA: MFS `cashBankAccountId` passes validation.
- JOURNAL: MFS `cashBankAccountId` is rejected with a clear error (e.g., "MFS accounts are not allowed on Journal voucher lines. Use Payment, Receipt, or Contra for MFS transactions.")

## F. Reporting Requirements

After MFS posting is enabled:

### MFS Book

- MFS Book must show MFS account movement from posted voucher lines.
- MFS Book derives only from `VoucherLine` rows where linked `CashBankAccount.accountType = MFS`, `Voucher.status = POSTED`, `Voucher.isDeleted = false`.
- MFS Book must show receipts (debit side), payments (credit side), and running balance.
- MFS Book opening/period/closing balance computation follows the same pattern as Cash Book and Bank Book.

### Cash Book

- Cash Book must remain CASH-only. No MFS transactions must appear in the Cash Book.

### Bank Book

- Bank Book must remain BANK-only. No MFS transactions must appear in the Bank Book.

### Trial Balance

- Trial Balance must include posted MFS ledger movements through normal ledger posting.
- No separate MFS section is needed; MFS movements are ledger-account-based.

### Balance Sheet

- Balance Sheet must include MFS wallet balance as an asset if the linked ledger account class is ASSET.
- No separate MFS section is needed.

### Income Statement

- Income Statement must include MFS-related expense and income movements through normal account-class grouping.
- No separate MFS section is needed.

### Project Reports

- Project Ledger must not include MFS wallet lines unless those same lines have `projectId`.
- Project Cost Report must not double-count MFS lines.
- Cost Center Summary must not create false Unassigned rows from MFS wallet lines.
- Project Financial Summary must not double-count MFS lines.

### Contra Vouchers in Reports

Contra vouchers involving MFS accounts must appear correctly:

- MFS-to-CASH (cash-in): MFS debit line appears as receipt in MFS Book; CASH credit line appears as payment in Cash Book.
- MFS-to-BANK (transfer to bank): MFS credit line appears as payment in MFS Book; BANK debit line appears as receipt in Bank Book.
- CASH-to-MFS (cash-out): CASH debit line appears as receipt in Cash Book; MFS credit line appears as payment in MFS Book.

### Report Regression Rule

All existing report behavior (Cash Book, Bank Book, MFS Book, Trial Balance, Balance Sheet, Income Statement, Project Ledger, Project Cost Report, Cost Center Summary, Project Financial Summary) must produce identical results on the same posted voucher data before and after MFS posting is enabled, except that MFS Book now shows MFS movement from newly posted MFS vouchers.

## G. UI Requirements

Future voucher UI should:

### G1. MFS Account Selection

- Allow selecting MFS `cashBankAccountId` where appropriate (PAYMENT, RECEIPT, CONTRA).
- Hide or disable the `cashBankAccountId` selector when the selected ledger is not cash/bank enabled.
- Scope the MFS account dropdown to active MFS accounts linked to the selected ledger account.

### G2. Clear Labeling

- Clearly label account type: CASH, BANK, MFS.
- Avoid confusing MFS with bank account.
- Show MFS provider/wallet display if available (provider name, wallet number placeholder).
- Use the existing `cashBankFieldLabel` and `cashBankTypeWord` helpers from Phase 2F.

### G3. Dynamic Field Behavior

- Preserve existing voucher line dynamic field behavior from Phase 2F.
- Project/Cost Center visibility follows `requiresProject`/`requiresCostCenter` on the selected ledger.
- Cash/Bank/MFS visibility follows `isCashBank` on the selected ledger.
- MFS wallet lines generally do not show Project/Cost Center fields unless the MFS ledger requires them.

### G4. Client-Side Validation Guidance

- Prevent mismatched `cashBankAccount`/ledger pair client-side.
- Prevent JOURNAL + MFS selection client-side with a clear message.
- Backend remains final authority.

### G5. Posted Voucher Read-Only Behavior

- Posted vouchers remain read-only and immutable.
- Posted voucher detail view and print layout are unchanged.
- MFS metadata (provider, wallet) appears in posted voucher line display alongside CASH/BANK metadata.

### G6. Voucher Type Filter

- No new voucher type is added. The existing six types (PAYMENT, RECEIPT, JOURNAL, CONTRA, DEBIT, CREDIT) remain.

## H. Demo Dataset Decision

Future demo reset/verify may be extended to include optional MFS posting scenarios, but do not force MFS vouchers into the base deterministic two-voucher dataset yet.

### Recommended Optional MFS Demo Scenario for Later

When Phase 2I implementation is stable and accepted:

1. MFS Receipt:
   - Dr bKash Merchant Wallet 15,000
   - Cr Capital Introduced / Booking Advance ledger 15,000

2. MFS Payment:
   - Dr Project Expense 3,000
   - Cr bKash Merchant Wallet 3,000

Because customer advance/income/liability ledgers are not fully scoped yet, keep this optional and do not implement during requirement lock or the first implementation chunks.

### Demo Verify Adjustment

The current `demo-verify` assertion "No MFS posted voucher lines" (check 2f) must be updated after MFS posting is implemented. When the optional MFS demo scenario is added, the assertion must check for expected MFS voucher lines instead. Until then, the assertion remains "No MFS posted voucher lines" and passes because the base dataset does not include MFS vouchers.

## I. Security and Safety

### Role Access

Only the `ACCOUNTANT` role can access MFS voucher posting and MFS-related endpoints. This follows existing auth patterns:

- All voucher endpoints guarded by `AuthGuard + RolesGuard + ACCOUNTANT`.
- Unauthenticated access returns 401.
- Non-ACCOUNTANT users receive 403.

### Explicitly Out of Scope for Phase 2I

- Real bKash/Nagad/Rocket integration
- SMS/OTP
- Payment gateway collection
- Customer wallet reconciliation
- Merchant statement import
- Live API credentials
- Webhook handling
- External provider settlement
- Uploaded statement parsing
- Production MFS automation

### No Secrets

- No secrets should be added.
- No `.env` changes unless a future chunk explicitly needs harmless local flags.
- No real wallet numbers in code or docs.

### Voucher Immutability

- Posted vouchers remain immutable.
- No editing of posted vouchers.
- Corrections via reversal/rectification in future phases only.

## J. Implementation Chunks

### 2I-1: Requirement Lock and Acceptance Docs

**Objective**: Lock Phase 2I requirements, acceptance criteria, and implementation plan in documentation.

**Scope**: Documentation only. No runtime code changes.

**Files likely to change**:
- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md` -- new file
- `docs/acceptance/phase-2i-acceptance-criteria.md` -- new file
- `docs/plans/phase-2i-mfs-voucher-posting-plan.md` -- new file
- `AGENTS.md` -- update
- `README.md` -- update
- `docs/ai/START_HERE.md` -- update
- `docs/ai/CURRENT_STATE.md` -- update
- `docs/handoff.md` -- update

**In-scope**: Requirement lock, acceptance criteria, implementation plan, and project docs updates.

**Out-of-scope**: Runtime code, schema changes, migrations, API endpoints, frontend pages, demo data changes.

**Safety checks**: Working tree must be clean. `pnpm check:all` must pass. `pnpm demo:audit` and `pnpm demo:verify` must pass.

**Acceptance checks**: All three docs exist and cover the locked requirements. Project docs reflect Phase 2I. No runtime changes.

**Verification commands**: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor`, `pnpm demo:audit`, `pnpm demo:verify`.

**Recommended model**: GLM 5.1 High for documentation lock.

**Stop condition**: Docs committed, verification passes, working tree clean.

### 2I-2: Backend Validation and Posting Support for MFS cashBankAccountId in Vouchers

**Objective**: Remove the MFS posting block and extend voucher posting validation to accept MFS `cashBankAccountId` for PAYMENT, RECEIPT, and CONTRA; reject MFS on JOURNAL.

**Scope**: Backend voucher service validation only. No frontend changes, no report changes, no schema changes.

**Files likely to change**:
- `apps/api/src/voucher/voucher.service.ts` -- remove MFS block, add JOURNAL+MFS rejection, extend voucher type cash/bank rules
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs

**In-scope**: MFS posting block removal, JOURNAL+MFS rejection, voucher type rule extension, backend validation tests.

**Out-of-scope**: Frontend voucher UI, report changes, demo dataset changes, new API endpoints, schema/migration changes.

**Safety checks**: Cash Book must remain CASH-only. Bank Book must remain BANK-only. Trial Balance must balance. Posted voucher immutability preserved. Existing CASH/BANK posting behavior unchanged.

**Acceptance checks**:
- PAYMENT voucher with MFS credit line passes posting.
- RECEIPT voucher with MFS debit line passes posting.
- CONTRA voucher with MFS lines (mixed CASH/BANK/MFS) passes posting.
- JOURNAL voucher with MFS `cashBankAccountId` is rejected with clear error.
- MFS Book shows MFS movement from posted vouchers.
- Cash Book does not show MFS transactions.
- Bank Book does not show MFS transactions.

**Verification commands**: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:api`, `pnpm build:web`, `docker compose config`, `pnpm check:all`, `pnpm doctor`.

**Recommended model**: DeepSeek V4 Pro Max for backend implementation.

**Stop condition**: MFS posting passes for PAYMENT/RECEIPT/CONTRA; MFS rejected on JOURNAL; existing reports unchanged; verification passes.

### 2I-3: Frontend Voucher UI Support for MFS Account Selection and Clear Labels

**Objective**: Update the voucher form UI to allow MFS account selection for PAYMENT, RECEIPT, CONTRA; prevent JOURNAL+MFS; display MFS provider/wallet metadata.

**Scope**: Frontend voucher UI only. No backend changes, no report changes.

**Files likely to change**:
- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx` -- MFS account selection, JOURNAL+MFS prevention
- `apps/web/src/app/app/vouchers/_lib/voucher-ui.tsx` -- MFS display helpers, JOURNAL rule
- `apps/web/src/app/app/vouchers/_lib/VoucherDetail.tsx` or equivalent -- MFS metadata display in posted voucher detail
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs

**In-scope**: MFS account selection in voucher lines, JOURNAL+MFS client-side prevention, MFS metadata display, dynamic field behavior preservation.

**Out-of-scope**: Report UI changes, new pages, new sidebar entries, demo data changes.

**Safety checks**: Posted vouchers remain read-only. Existing CASH/BANK voucher UI behavior unchanged.

**Acceptance checks**:
- Voucher form shows MFS accounts for PAYMENT, RECEIPT, CONTRA.
- Voucher form prevents MFS selection on JOURNAL lines.
- MFS provider/wallet metadata displays in line detail.
- Posted voucher detail shows MFS metadata.
- Existing CASH/BANK voucher behavior unchanged.

**Verification commands**: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `pnpm check:all`.

**Recommended model**: DeepSeek V4 Pro High/Low for frontend follow-up if bounded.

**Stop condition**: MFS selection works in voucher form; JOURNAL+MFS prevented; posted voucher detail shows MFS metadata; verification passes.

### 2I-4: MFS Report Regression and Deterministic Demo Extension Decision

**Objective**: Verify all reports produce correct results after MFS posting; decide whether to add optional MFS demo voucher scenario.

**Scope**: Report regression testing, demo dataset extension decision, demo-verify adjustment if MFS demo vouchers are added.

**Files likely to change**:
- `prisma/demo-verify.ts` -- update MFS assertion if MFS demo vouchers added
- `prisma/demo-reset.ts` -- add optional MFS vouchers if approved
- `docs/ai/CURRENT_STATE.md`, `docs/handoff.md` -- update docs

**In-scope**: Report regression verification, MFS Book correctness check, demo dataset decision, demo-verify adjustment if needed.

**Out-of-scope**: PDF/Excel export, dashboard, payroll, parties, new roles.

**Safety checks**: Cash Book CASH-only, Bank Book BANK-only, Trial Balance balanced, Balance Sheet correct, Project reports no double-counting.

**Acceptance checks**: All reports produce correct results with MFS posted vouchers. MFS Book shows MFS movement. Project reports handle MFS lines correctly (include only when `projectId` present).

**Verification commands**: `pnpm demo:audit`, `pnpm demo:verify`, API smoke tests for all 11 report endpoints.

**Recommended model**: DeepSeek V4 Pro Max for regression testing.

**Stop condition**: All reports correct; demo dataset decision made; verification passes.

### 2I-5: Browser/API Smoke, Docs Cleanup, and Phase 2I Completion Tag

**Objective**: Final integration review, browser smoke tests, documentation cleanup, and completion tag.

**Scope**: Review and verification only. No runtime source changes.

**Files likely to change**:
- `AGENTS.md` -- update
- `README.md` -- update
- `docs/ai/START_HERE.md` -- update
- `docs/ai/CURRENT_STATE.md` -- update
- `docs/handoff.md` -- update

**In-scope**: Final integration review, browser smoke, docs cleanup, completion tag.

**Out-of-scope**: Runtime source changes, schema changes, new features.

**Safety checks**: Working tree clean. All verification passes. Git remote matches.

**Acceptance checks**: All 2I-1 through 2I-4 acceptance criteria pass. Docs reflect Phase 2I completion. Tag `phase-2i-complete` created.

**Verification commands**: `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor`, `pnpm demo:audit`, `pnpm demo:verify`.

**Recommended model**: GLM 5.1 High for review/acceptance.

**Stop condition**: Phase 2I accepted and tagged. Next phase decision documented.

## K. Open Questions with Recommended Answers

1. **Should JOURNAL allow MFS cashBankAccountId?**
   - Recommended answer: **No.** JOURNAL remains ledger-only. MFS operational movement is carried by Payment, Receipt, and Contra. This preserves workflow clarity. If a future phase confirms JOURNAL+MFS is needed (e.g., for MFS service charge), that must be locked separately before implementation.

2. **Should MFS wallet line require project/cost center when opposite expense line has project/cost center?**
   - Recommended answer: **No.** Do not infer project metadata across lines. Use same-line project metadata only. The MFS wallet line carries `projectId` only if the MFS ledger itself requires it.

3. **Should MFS Book include all MFS wallet movements regardless of project?**
   - Recommended answer: **Yes.** MFS Book is an account-type book, not a project report. All posted MFS movements appear in MFS Book, regardless of project metadata on the lines.

4. **Should Project reports include MFS wallet lines without projectId?**
   - Recommended answer: **No.** Project reports (Project Ledger, Project Cost, Cost Center Summary, Project Financial Summary) include MFS wallet lines only when those lines carry `projectId`. Lines without `projectId` do not appear in project reports.

5. **Should demo reset add MFS posted vouchers?**
   - Recommended answer: **Not in base dataset yet.** Add optional MFS demo scenario only after Phase 2I behavior is stable and accepted. The base deterministic dataset remains two vouchers with CASH/BANK only.

6. **Should provider API integration be planned now?**
   - Recommended answer: **No.** This is accounting posting only. No bKash/Nagad/Rocket API integration, no live connectivity, no SMS/OTP.

7. **Should MFS posting support fees/charges now?**
   - Recommended answer: **Not in first implementation.** MFS service charges can be represented manually as extra expense lines in a separate voucher later if needed. No auto-calculation or fee formulas.

## L. Module-By-Module Requirement Lock

| Area | Locked Phase 2I Intent | Explicitly Deferred |
| --- | --- | --- |
| MFS posting block removal | Remove the Phase 2E block; accept MFS `cashBankAccountId` for PAYMENT/RECEIPT/CONTRA | JOURNAL+MFS (locked: rejected) |
| JOURNAL + MFS | **Rejected**. JOURNAL remains ledger-only for MFS. Clear error on posting attempt. | Future JOURNAL+MFS possibility requires separate lock |
| Voucher type rules | PAYMENT: at least one CASH/BANK/MFS credit; RECEIPT: at least one CASH/BANK/MFS debit; CONTRA: exactly two CASH/BANK/MFS lines; JOURNAL: no MFS | DEBIT/CREDIT voucher MFS behavior unchanged |
| Validation | cashBankAccountId consistency, ledger consistency, project/cost center same-line only, balance/immutability, MFS-specific rules | Provider API, wallet format validation, auto service charges |
| MFS Book | Shows MFS movement from posted vouchers; same pattern as Cash/Bank Book | MFS statement import, auto-reconciliation |
| Cash Book | No change; remains CASH-only | -- |
| Bank Book | No change; remains BANK-only | -- |
| Trial Balance | No change; remains ledger-account-based | -- |
| Balance Sheet | No change; MFS wallet as asset when ledger class = ASSET | -- |
| Project reports | MFS lines included only when `projectId` present; no double-counting | -- |
| Voucher UI | MFS account selection for PAYMENT/RECEIPT/CONTRA; JOURNAL+MFS prevented; MFS metadata display | MFS-specific voucher templates, auto wallet selection |
| Demo dataset | Base dataset unchanged; optional MFS scenario later | Mandatory MFS demo vouchers |
| Security | ACCOUNTANT role only; no provider API; no secrets | Viewer/Manager role, provider API credentials |
| Decimal handling | Same Decimal(18,2) / string serialization | -- |

## M. Strict Stop Conditions

Stop before coding if:

- User has not confirmed the Phase 2I implementation phase.
- Working tree is not clean.
- Git remote is not `https://github.com/MaruflRana/real-capita-accounts`.
- `DATABASE_URL` does not use port `55432`.
- Any unconfirmed role exists in schema, seed data, source, or database.
- Phase 2H is not complete and accepted.
- Phase 2E is not complete and accepted.
- `CashBankAccountType.MFS` or `MfsProvider` enum does not exist in the Prisma schema.
- The MFS posting block has been removed before this requirement-lock chunk is accepted.
- The agent is not inside `D:\real-capita-accounts`.

## N. Exclusions

Phase 2I requirement lock and implementation must not include:

- MFS provider API integration (bKash API, Nagad API, etc.)
- MFS statement import or auto-reconciliation
- MFS transaction auto-discovery
- Auto-calculated or auto-deducted service charges
- MFS-specific voucher templates beyond the existing six types
- Party/customer/vendor module
- Customer aging or receivable tracking specific to MFS
- Dashboard analytics or MFS charts
- Payroll or salary modules
- PDF/Excel export for MFS reports
- File uploads or attachments for MFS transactions
- Additional roles beyond ACCOUNTANT
- Admin, Super Admin, Checker, Data Entry, MD Viewer, HR, Sales, Payroll, or other roles
- Separate MFS report tables (MFSBook table, etc.)
- Business seed data containing real MFS transaction amounts or wallet numbers
- Code copied from the old ERP prototype
- Prisma schema changes or migrations (MFS schema already exists from Phase 2E)
- Production credentials
- Real wallet numbers in code or docs
- Changing existing Cash Book/Bank Book/MFS Book semantics
- Changing posted voucher immutability
- JOURNAL voucher lines with MFS `cashBankAccountId`
- Balance inquiry, payment gateway, or live provider interaction

## O. Next Prompt Summary

Next agent: read `AGENTS.md`, run `pnpm agent:start`, then read the Phase 2I requirement lock, acceptance criteria, and implementation plan. Do not implement anything until the user explicitly confirms the next Phase 2I implementation chunk. If confirmed, implement only the MFS posting validation and voucher UI features for the single `ACCOUNTANT` role. Do not add dashboard analytics, payroll reports, party reports, MFS provider API integration, MFS-specific voucher templates, or additional roles without separate confirmation. JOURNAL voucher lines must not accept MFS `cashBankAccountId`.
