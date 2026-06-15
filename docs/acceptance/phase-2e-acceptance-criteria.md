# Phase 2E Acceptance Criteria

## Purpose

Phase 2E is a documentation/specification lock. It prepares MFS / bKash transaction support requirements and acceptance criteria for a future implementation phase without changing schema, API, UI business modules, roles, or seed data.

## Acceptance Checklist For Phase 2E Documentation

Phase 2E is accepted when:

- `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md` exists and covers: purpose, confirmed business need, current status (future requirement, not implemented), terminology, supported providers, role boundary, accounting source rule, cash/bank/MFS separation, voucher behavior, report behavior, MFS Book concept, validation, print/report requirements, security/privacy, exclusions, and open questions.
- `docs/architecture/phase-2e-mfs-accounting-model-proposal.md` exists and covers: proposed CashBankAccountType extension (CASH, BANK, MFS), MFS provider field concept, wallet/account number concept, account holder name concept, why bKash should not be forced under BANK or CASH, voucher-line impact, report impact per report type, decimal handling, backend authority, migration risk notes, and explicit statement of no current code changes.
- `docs/acceptance/phase-2e-acceptance-criteria.md` exists.
- `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md` exists with future chunks 2E-1 through 2E-7, each with model recommendation, scope, files to read, verification, manual smoke tests, and exact stop condition.
- `AGENTS.md` points future agents to the Phase 2E lock.
- `docs/ai/CURRENT_STATE.md` states that Phase 2E requirement lock is prepared.
- `docs/ai/START_HERE.md` points agents to the Phase 2E docs.
- `docs/handoff.md` records the created Phase 2E files and states that no MFS modules were implemented.
- `README.md` states the current development phase includes the Phase 2E requirement lock.
- `prisma/schema.prisma` is unchanged by Phase 2E.
- No MFS tables, MFS API endpoints, MFS UI pages, MFS dropdowns, MFS enum values, or MFS runtime logic were added.
- Phase 2D acceptance state is preserved and documented.
- Verification passes with `pnpm check:all` and `pnpm doctor`.

## Acceptance Checklist For Future MFS Backend Implementation

After explicit user confirmation, the future MFS backend implementation is accepted only if:

- Accountant can log in.
- `CashBankAccountType` enum includes `MFS` alongside `CASH` and `BANK`.
- `MfsProvider` enum includes `BKASH`, `NAGAD`, `ROCKET`, `UPAY`, `OTHER`.
- `CashBankAccount` model includes `provider`, `providerOtherName`, `walletNumber`, and `accountHolderName` fields.
- MFS accounts can be created with `accountType = MFS`, a provider, and a wallet number.
- MFS accounts are listed alongside CASH and BANK accounts in the cash/bank account API.
- MFS accounts appear in the voucher line cash/bank account dropdown when the ledger account has `isCashBank = true`.
- Voucher lines with MFS `cashBankAccountId` pass all posting validation rules.
- `POST /vouchers/:id/post` accepts vouchers with MFS account references.
- Payment, Receipt, and Contra voucher types work with MFS account lines.
- `GET /reports/mfs-book` returns MFS Book entries with receipts, payments, and running balance.
- MFS Book uses only POSTED vouchers; DRAFT and soft-deleted vouchers do not affect MFS reports.
- Cash Book continues to show only CASH-type transactions.
- Bank Book continues to show only BANK-type transactions.
- MFS Book does not include CASH or BANK transactions.
- Trial Balance, Income Statement, and Balance Sheet work unchanged.
- Date filtering by fiscal year, accounting period, or custom date range works for MFS Book.
- Opening balance computation for MFS Book includes all posted lines before the start date within the fiscal year.
- Normal-balance-aware balance presentation works for MFS ledger accounts.
- Contra vouchers involving MFS accounts appear correctly in MFS Book, Cash Book, and Bank Book.
- No separate MFS report tables exist in the Prisma schema.
- Only `ACCOUNTANT` role can access MFS-related endpoints.
- Unauthenticated access returns 401; non-ACCOUNTANT users receive 403.

## Acceptance Checklist For Future MFS Frontend Implementation

After the backend is accepted, the future MFS frontend is accepted only if:

- Accountant can create and manage MFS accounts from the Cash & Bank page (account type dropdown includes MFS).
- MFS account creation form includes provider selection, wallet number, and optional account holder name.
- When `provider = OTHER`, a custom provider name input appears.
- MFS accounts appear in the voucher line cash/bank account dropdown alongside CASH and BANK accounts.
- MFS Book page shows fiscal year, period/date range, MFS account, and provider filters.
- MFS Book page renders transactions with receipt/payment columns and running balance.
- MFS Book page shows opening/period/closing balance summaries.
- MFS Book page has a "Print report" button that renders a clean print layout.
- Cash Book page does not show any MFS transactions.
- Bank Book page does not show any MFS transactions.
- Existing voucher and report pages work unchanged.
- No MFS-specific voucher templates are added (only existing six types).
- No MFS provider API integration is added.
- No auto-calculated service charges are added.
- The UI follows the existing Phase 2A/2C/2D design patterns (calm, professional, cookie-authenticated).

## Report Correctness Criteria

- MFS Book every figure can be traced back to a specific posted `VoucherLine` record with an MFS-type `CashBankAccount`.
- MFS Book running balance matches the sum of receipts minus payments.
- MFS Book opening balance includes all posted MFS lines before the start date within the fiscal year.
- MFS Book closing balance equals opening balance + period movement.
- Cash Book figures are unchanged after MFS implementation (no MFS lines leak into Cash Book).
- Bank Book figures are unchanged after MFS implementation (no MFS lines leak into Bank Book).
- Trial Balance total debits equal total credits after MFS accounts are included.
- Income Statement net profit calculation is unchanged.
- Balance Sheet balance check is unchanged.
- Contra vouchers between MFS and cash/bank appear correctly in all relevant books.

## Security Criteria

- All MFS-related endpoints require authentication (HttpOnly cookie JWT/session).
- All MFS-related endpoints require the `ACCOUNTANT` role.
- Unauthenticated users are redirected to `/login`.
- Non-ACCOUNTANT users receive a 403 Forbidden response.
- MFS wallet numbers are not exposed in unauthenticated API responses.
- MFS wallet numbers are not stored in localStorage.
- MFS API integration with external providers is not implemented (no API keys, no external calls).

## Regression Criteria

- All existing Phase 2D acceptance criteria continue to pass after MFS implementation.
- All existing Phase 2C acceptance criteria continue to pass after MFS implementation.
- All six existing report endpoints (`ledger`, `cash-book`, `bank-book`, `trial-balance`, `income-statement`, `balance-sheet`) return correct results.
- Existing voucher create, post, and print functionality works unchanged.
- Existing Cash Book shows only CASH transactions; no MFS data leaks in.
- Existing Bank Book shows only BANK transactions; no MFS data leaks in.
- Trial Balance total debits equal total credits on the same set of posted vouchers before and after MFS implementation.
- Income Statement and Balance Sheet calculations produce identical results on the same posted voucher data.

## Explicit Non-Acceptance Conditions

Phase 2E requirement lock and the first MFS implementation are NOT accepted if:

- MFS is forced under BANK or CASH account type without explicit Real Capita approval.
- Cash Book or Bank Book shows MFS transactions mixed in with CASH or BANK data.
- MFS service charges are auto-calculated or auto-deducted.
- MFS provider API integration is added without explicit confirmation.
- MFS provider dropdown appears in runtime code during the requirement-lock phase.
- CashBankAccountType enum is changed in code during the requirement-lock phase.
- MfsProvider enum is added in code during the requirement-lock phase.
- Any MFS runtime logic (account creation, voucher validation, report computation) is implemented during the requirement-lock phase.
- Additional roles are introduced for MFS access.
- Business seed data containing real MFS transaction amounts or wallet numbers is added.
- Phase 2D acceptance state is compromised (any existing report or voucher behavior changes unexpectedly).
- PDF or Excel export for MFS reports is added in the first implementation.
- Party/customer/vendor module is added in the MFS phase.
- Dashboard analytics for MFS are added.

## Verification Commands

Run these commands for Phase 2E documentation:

```powershell
git pull --ff-only
git status --short --branch
pnpm check:all
pnpm doctor
git status --short --branch
git log --oneline --max-count=10
```

Do not run migrations for Phase 2E because no schema change should be made.
