# Phase 1B Acceptance Criteria

## Purpose

Phase 1B is a documentation/specification lock. It prepares the next accounting foundation implementation without changing schema, API, UI business modules, roles, or seed data.

## Acceptance Checklist For Phase 1B Documentation

Phase 1B is accepted when:

- `docs/requirements/phase-1b-accounting-foundation-lock.md` exists.
- `docs/architecture/phase-1b-accounting-foundation-model-proposal.md` exists.
- `docs/acceptance/phase-1b-acceptance-criteria.md` exists.
- `docs/prompts/droid-cli-next-prompt.md` exists.
- `docs/decisions/ADR-0006-phase-1b-doc-lock-before-business-schema.md` exists.
- `AGENTS.md` points future agents to the Phase 1B lock and Droid CLI prompt.
- `docs/ai/CURRENT_STATE.md` states that Phase 1B requirement/spec lock is prepared.
- `docs/ai/START_HERE.md` points Codex-limit handoff users to the Droid CLI prompt.
- `docs/handoff.md` records the created Phase 1B files and states that no business modules were implemented.
- `README.md` states the current development phase.
- `prisma/schema.prisma` is unchanged by Phase 1B.
- No Company, FiscalYear, Project, CostCenter, Account, CashBank, Voucher, Ledger, Report, Payroll, Party, Dashboard, or additional role implementation is added.
- Verification passes with `pnpm check:all` and `pnpm doctor`.

## Acceptance Checklist For Future Phase 2A Implementation

After explicit user confirmation, future Phase 2A is accepted only if:

- Accountant can log in.
- Accountant can create and update company profile.
- Accountant can create one fiscal year.
- Accountant can create accounting periods inside a fiscal year.
- Accountant can create projects.
- Accountant can create cost centers under projects.
- Accountant can create account classes, account groups, and ledger accounts.
- Accountant can create cash/bank accounts linked to ledger accounts.
- Inactive records cannot be selected later in transaction workflows.
- Only `ACCOUNTANT` exists as an active role.
- No vouchers exist.
- No ledger reports exist.
- No trial balance exists.
- No financial statements exist.
- No payroll exists.
- No parties/customers/vendors exist unless explicitly approved by the user before implementation.

## Prohibited Outcomes

Phase 1B must not produce:

- Prisma business schema changes
- API business modules
- Frontend business pages
- Business seed data
- New roles
- Permission matrices for unconfirmed roles
- Voucher or voucher-line models
- Ledger, cash book, bank book, trial balance, or report screens
- Payroll or salary modules
- Party, customer, or vendor modules
- Dashboard analytics
- File uploads
- Code copied from the old ERP
- Real sensitive business data

## Verification Commands

Run these commands for Phase 1B:

```powershell
git pull --ff-only
git status --short --branch
pnpm check:all
pnpm doctor
git status --short --branch
git log --oneline --max-count=10
```

Do not run migrations for Phase 1B because no schema change should be made.

