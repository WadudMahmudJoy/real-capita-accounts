# Phase 2B Acceptance Criteria

## Purpose

Phase 2B is a documentation/specification lock. It prepares voucher requirements and acceptance criteria for a future implementation phase without changing schema, API, UI business modules, roles, or seed data.

## Acceptance Checklist For Phase 2B Documentation

Phase 2B is accepted when:

- `docs/requirements/phase-2b-voucher-requirement-lock.md` exists.
- `docs/architecture/phase-2b-voucher-model-proposal.md` exists.
- `docs/acceptance/phase-2b-acceptance-criteria.md` exists.
- `docs/prompts/droid-cli-phase-2b-next-prompt.md` exists.
- `docs/decisions/ADR-0007-phase-2b-voucher-requirement-lock.md` exists.
- `AGENTS.md` points future agents to the Phase 2B lock.
- `docs/ai/CURRENT_STATE.md` states that Phase 2B voucher requirement lock is prepared.
- `docs/ai/START_HERE.md` points agents to the Phase 2B docs.
- `docs/handoff.md` records the created Phase 2B files and states that no business modules were implemented.
- `README.md` states the current development phase.
- `prisma/schema.prisma` is unchanged by Phase 2B.
- No Voucher, VoucherLine, VoucherType, VoucherStatus, VoucherNumberSequence, or any voucher runtime implementation is added.
- Verification passes with `pnpm check:all` and `pnpm doctor`.

## Acceptance Checklist For Future Voucher Backend Implementation

After explicit user confirmation, the future voucher backend implementation is accepted only if:

- Accountant can log in.
- Accountant can create a draft voucher with a system-generated voucher number.
- Accountant can set voucher date, type, narration, and physical SI No.
- Voucher date falls within an open accounting period of the active fiscal year.
- Voucher date in a locked or closed period is rejected.
- Accountant can add debit and credit lines with LedgerAccount references.
- Debit total equals credit total before posting; mismatch prevents posting.
- If a LedgerAccount requires a project, the voucher line must include a project reference.
- If a LedgerAccount requires a cost center, the voucher line must include a cost center reference.
- Only active LedgerAccounts, Projects, CostCenters, and CashBankAccounts are selectable.
- Payment Vouchers require at least one cash/bank credit line.
- Receipt Vouchers require at least one cash/bank debit line.
- Contra Vouchers require exactly two cash/bank lines (one debit, one credit).
- Accountant can post a draft voucher; status transitions to POSTED.
- Posting records the posting timestamp and the posting user.
- Posting re-validates all rules (period still open, accounts still active, totals still balanced).
- Posted vouchers are immutable; no direct editing or deletion.
- Voucher number is never reused, even for deleted drafts.
- Voucher numbering is atomic under concurrent access.
- Every creation, edit, and post action is recorded in AuditEvent.
- Only `ACCOUNTANT` role can access voucher endpoints.
- No party/customer/vendor references exist in voucher lines unless separately confirmed.

## Acceptance Checklist For Future Voucher Frontend Implementation

After the backend is accepted, the future voucher frontend is accepted only if:

- Accountant can navigate to a voucher list page.
- Accountant can create a new voucher (select type, date, narration, physical SI No).
- Accountant can add/edit/remove debit and credit lines in draft vouchers.
- Accountant can select LedgerAccounts from a dropdown showing only active accounts.
- Accountant can select Projects and CostCenters when required by the LedgerAccount flags.
- Accountant can select CashBankAccounts when the line involves a cash/bank account.
- Accountant can see debit total and credit total; mismatches are clearly indicated before posting.
- Accountant can post a draft voucher with a deliberate post action.
- Posted vouchers are displayed with read-only status; no edit or delete buttons.
- Voucher date outside an open period shows a clear warning or error.
- The UI follows the existing Phase 2A design patterns (calm, professional, shadcn/ui-based).
- No voucher UI references parties, customers, or vendors.
- No report screens are added.

## Posting Validation Acceptance Criteria

- Debit total must equal credit total; posting fails with a clear error if they differ.
- All LedgerAccounts in lines must be active at the time of posting.
- All Project references must satisfy the LedgerAccount's `requiresProject` flag.
- All CostCenter references must satisfy the LedgerAccount's `requiresCostCenter` flag.
- CostCenter must belong to the selected Project if both are provided.
- CashBankAccount references must be active and linked to the correct LedgerAccount.
- Accounting period must be OPEN at the time of posting.
- Fiscal year must be active (not closed) at the time of posting.
- Voucher type-specific rules are enforced (Payment, Receipt, Contra cash/bank requirements).
- Voucher number uniqueness is enforced per company.

## Security Acceptance Criteria

- All voucher endpoints require authentication (HttpOnly cookie JWT/session).
- All voucher endpoints require the `ACCOUNTANT` role.
- Unauthenticated users are redirected to `/login`.
- Non-ACCOUNTANT users receive a 403 Forbidden response.
- No voucher data is accessible through unprotected routes.
- Audit trail records the user identity for every voucher action.

## Audit Trail Acceptance Criteria

- `VOUCHER_CREATED` event is recorded when a draft is created.
- `VOUCHER_EDITED` event is recorded when a draft is modified.
- `VOUCHER_POSTED` event is recorded when a voucher is posted.
- Each AuditEvent includes `userId`, `action`, `entityType = "Voucher"`, `entityId = voucher.id`, and timestamp.
- Audit trail is queryable through the existing AuditEvent infrastructure.

## Smoke Tests

After voucher implementation is complete:

1. Log in as accountant.
2. Create a draft Payment Voucher with one debit line (expense account) and one credit line (cash/bank account).
3. Verify debit total equals credit total.
4. Verify the system-generated voucher number is assigned.
5. Verify the physical SI No field is present.
6. Post the voucher.
7. Verify status changes to POSTED.
8. Verify the posted voucher cannot be edited.
9. Verify the posted voucher cannot be deleted.
10. Verify the voucher appears in the voucher list.
11. Attempt to create a voucher with a date in a locked period; verify it is rejected.
12. Attempt to post a voucher where debit total does not equal credit total; verify it is rejected.
13. Attempt to create a voucher line referencing an inactive LedgerAccount; verify it is rejected.
14. Attempt to create a voucher line on a LedgerAccount that requires a project without providing a project; verify it is rejected.
15. Verify AuditEvent records exist for creation, edit (if any), and posting.

## Explicit Out-of-Scope List

Phase 2B documentation and the first voucher implementation must not include:

- Ledger reports or ledger view screens.
- Cash book report.
- Bank book report.
- Trial balance report or screen.
- Financial statements (Income Statement, Balance Sheet).
- Dashboard analytics or charts.
- Party, customer, or vendor modules or references in voucher lines.
- Payroll or salary modules.
- File upload or attachment infrastructure.
- Approval workflow, checker role, or multi-level authorization.
- Voucher reversal or correction features (proposed but not implemented in the first phase).
- Batch voucher creation.
- Custom voucher types beyond the six confirmed types.
- Business seed data containing real transactions.
- Additional roles beyond `ACCOUNTANT`.
- Code copied from the old ERP prototype.
- Real sensitive business data (real voucher amounts, real party names, real invoice numbers).

## Verification Commands

Run these commands for Phase 2B documentation:

```powershell
git pull --ff-only
git status --short --branch
pnpm check:all
pnpm doctor
git status --short --branch
git log --oneline --max-count=10
```

Do not run migrations for Phase 2B because no schema change should be made.
