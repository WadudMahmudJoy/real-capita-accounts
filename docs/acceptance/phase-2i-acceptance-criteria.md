# Phase 2I Acceptance Criteria

## Purpose

Phase 2I locks the requirements for acceptance criteria for enabling MFS accounts inside voucher posting flows. Phase 2I is a documentation/specification lock only. It prepares MFS voucher posting requirements and acceptance criteria for future implementation chunks without changing schema, API, UI, roles, seed data, or or runtime behavior.

## Acceptance Checklist for Phase 2I Documentation Lock

Phase 2I requirement lock is accepted when:

- `docs/requirements/phase-2i-mfs-voucher-posting-requirement-lock.md` exists and covers: purpose, current status, MFS posting scope, voucher type decisions (PAYMENT/RECEIPT/CONTRA + JOURNAL rules), validation rules, reporting requirements, UI requirements, demo dataset decision, security/out-of-scope, implementation chunks, open questions with recommended answers, and exclusions, and `strict stop conditions`.
- `docs/acceptance/phase-2i-acceptance-criteria.md` exists.
- `docs/plans/phase-2i-mfs-voucher-posting-plan.md` exists with five implementation chunks (2I-1 through 2I-5), each with objective, scope, files, safety checks, acceptance checks, verification commands, recommended model, and stop condition.
- `AGENTS.md` points future agents to the Phase 2I docs.
- `docs/ai/CURRENT_STATE.md` states that the Phase 2I requirement lock is prepared.
- `docs/ai/START_HERE.md` points agents to the Phase 2I docs.
- `docs/handoff.md` records the created Phase 2I files and states that no runtime source changes were made.
- `README.md` states the current development phase includes Phase 2I requirement lock.
- `prisma/schema.prisma` is unchanged by Phase 2I.
- No voucher posting logic, backend validation, frontend UI, report behavior, MFS runtime code, or or demo dataset changes were made.
- Phase 2H acceptance state is preserved and documented.
- Verification passes with `pnpm check:all` and `pnpm doctor`.

## Acceptance Checklist for Future Backend MFS Posting Implementation (2I-2)

After explicit user confirmation, future backend MFS posting is accepted only if:

- Accountant can log in.
- The MFS posting block in `voucher.service.ts` is removed ( replaced with acceptance logic for MFS `cashBankAccountId`.
- `POST /vouchers/:id/post` accepts vouchers with MFS `cashBankAccountId` references.
- PAYMENT vouchers with MFS credit lines post successfully.
- RECEIPT vouchers with MFS debit lines post successfully.
- CONTRA vouchers with MFS lines alongside CASH/BANK lines post successfully.
- JOURNAL vouchers with MFS `cashBankAccountId` are **rejected** with a clear error message.
- Voucher lines with MFS `cashBankAccountId` pass all existing validation rules:
  - `cashBankAccount` exists and is active.
  - `cashBankAccount.ledgerAccountId` matches the line `ledgerAccountId`.
  - `cashBankAccount.accountType` is MFS.
  - `ledgerAccount.isCashBank` is true for the line.
- MFS posting does not alter existing CASH/BANK voucher posting behavior.
- Cash Book continues to show only CASH-type transactions after MFS posting is enabled.
- Bank Book continues to show only BANK-type transactions after MFS posting is enabled.
- Trial Balance, Income Statement, and Balance Sheet work unchanged after MFS posting is enabled.
- `demo-verify` assertion for "No MFS posted voucher lines" is updated to reflect the new MFS posting capability.

## Acceptance Checklist for Future Frontend Voucher UI MFS Support (2I-3)

After backend is accepted, future frontend MFS voucher UI is accepted only if:
- Voucher line Cash/Bank/MFS dropdown includes MFS accounts alongside CASH and BANK when the selected ledger is `isCashBank = true`.
- MFS accounts are labelled "MFS wallet" in the dropdown and form.
- MFS provider and wallet metadata is displayed on the selected MFS account ( e.g., "bKash Merchant - 017XXXXXXXXX").
- JOURNAL voucher type does not show Cash/Bank/MFS dropdown on voucher lines.
- PAYMENT, RECEIPT, and CONTRA voucher types show Cash/Bank/MFS dropdown for cash/bank ledger lines.
- The existing dynamic field visibility from Phase 2F continues to work correctly ( `deriveVoucherLineFieldRequirements`).
- No MFS-specific voucher templates are added.
- No MFS provider API integration is added.
- No auto-calculated service charges are added.
- Posted vouchers with MFS lines show MFS metadata in the detail view and print layout.

## Acceptance Checklist for Future Report Regression (2I-4)

After MFS posting is enabled, report regression is accepted only if:
- MFS Book shows MFS account movement from posted MFS vouchers.
- Cash Book remains CASH-only ( no MFS lines leak in).
- Bank Book remains BANK-only ( no MFS lines leak in).
- Trial Balance includes posted MFS ledger movements through normal ledger posting.
- Balance Sheet includes MFS wallet balance as an asset if when the ledger class is ASSET.
- Project Ledger does not include MFS lines without `projectId`.
- Project Cost Report does not include MFS lines without `projectId`.
- Project Cost Report does not double-count MFS lines.
- Cost Center Summary does not create false Unassigned rows from MFS lines.
- Project Financial Summary does not double-count MFS lines.
- Income Statement includes MFS-related expense/income through normal account class grouping.
- All existing report endpoints return identical results on the same posted voucher data before MFS posting is enabled.

## Acceptance Checklist for Final Review (2I-5)

- `pnpm prisma:generate`, `pnpm typecheck`, `pnpm lint`, `pnpm build:web`, `pnpm build:api`, `docker compose config`, `pnpm check:all`, `pnpm doctor` all pass.
- `pnpm demo:audit` and `pnpm demo:verify` pass ( adjusted for MFS posting capability).
- Accountant can log in, create, post, and and view vouchers with MFS lines.
- Browser smoke tests confirm MFS account selection, MFS metadata display, JOURNAL MFS rejection, and and MFS Book showing MFS movement.
- Docs reflect Phase 2I completion: `AGENTS.md`, `README.md`, `docs/ai/START_HERE.md`, `docs/ai/CURRENT_STATE.md`, `docs/handoff.md`.

## Report Correctness Criteria

- MFS Book every figure traces to a specific posted `VoucherLine` with an MFS-type `CashBankAccount`.
- MFS Book running balance matches cumulative debit minus credit.
- MFS Book opening balance includes all posted MFS lines before the start date within the fiscal year.
- MFS Book closing balance equals opening balance + period movement.
- Cash Book figures are unchanged after MFS implementation (no MFS lines leak in).
- Bank Book figures are unchanged after MFS implementation (no MFS lines leak in).
- Trial Balance total debits equal total credits after MFS accounts are included.
- Balance Sheet balance check is unchanged.
- Income Statement net profit calculation is unchanged.
- Project Ledger, Project Cost, Cost Center Summary, and Project Financial Summary all exclude MFS lines without `projectId`.
- Contra vouchers between MFS and cash/bank appear correctly in MFS Book, Cash Book, and Bank Book.

## Security Criteria
- All voucher endpoints with MFS lines continue to require authentication (`AuthGuard`).
- All voucher endpoints with MFS lines continue to require `ACCOUNTANT` role (`RolesGuard`).
- Unauthenticated users are redirected to `/login`.
- Non-ACCOUNTANT users receive 403 Forbidden.
- MFS wallet numbers are not exposed in unauthenticated API responses.
- MFS wallet numbers are not stored in localStorage.
- MFS API integration with external providers is not implemented.

## Regression Criteria
- All existing Phase 2D acceptance criteria continue to pass.
- All existing Phase 2C acceptance criteria continue to pass.
- All existing Phase 2E acceptance criteria continue to pass.
- All existing Phase 2F acceptance criteria continue to pass.
- All existing Phase 2G acceptance criteria continue to pass.
- All existing Phase 2H acceptance criteria continue to pass.
- All 11 backend report endpoints return correct results.
- Existing voucher create, post, and print functionality works unchanged.
- Cash Book shows only CASH transactions.
- Bank Book shows only BANK transactions.
- MFS Book shows only MFS transactions.
- Trial Balance, Income Statement, and Balance Sheet calculations produce identical results on the same posted voucher data.
- Demo audit, demo reset, and demo verify all work unchanged ( adjusted for MFS posting capability).

## Explicit Non-Acceptance Conditions

Phase 2I requirement lock and the first MFS posting implementation are NOT accepted if:

- MFS is forced under BANK or CASH account type without explicit Real Capita approval.
- Cash Book or Bank Book shows MFS transactions mixed in with CASH or BANK data.
- JOURNAL vouchers accept MFS `cashBankAccountId` in Phase 2I.
- MFS service charges are auto-calculated or auto-deducted.
- MFS provider API integration is added without explicit confirmation.
- Additional roles are introduced for MFS access.
- Business seed data containing real MFS transaction amounts or wallet numbers is added.
- Phase 2D, 2E, 2F, 2G, or2H acceptance state is compromised.
- PDF or Excel export is added in the first implementation.
- Party/customer/vendor module is added.
- Dashboard analytics for MFS are added.
- Posted voucher immutability is broken.
- Prisma schema changes or migrations are added unless explicitly justified.

## Verification Commands

Phase 2I documentation lock:

```powershell
git pull --ff-only
git status --short --branch
pnpm check:all
pnpm doctor
git status --short --branch
git log --oneline --max-count=10
```

No migrations for Phase 2I because no schema change should be made.

## Future Implementation Verification Commands

Phase 2I implementation chunks:

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
docker compose config
pnpm check:all
pnpm doctor
pnpm demo:audit
pnpm demo:verify
```
