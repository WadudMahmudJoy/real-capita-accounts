# Phase 1B: Accounting Foundation Requirement Lock

## Purpose

Phase 1B locks the first accounting foundation requirements and acceptance criteria before any business database schema, API modules, or UI pages are implemented.

This document exists so the next agent or developer can continue from repository context alone, without relying on hidden chat memory.

## A. Confirmed Business Context

- AGM sir is the first and only confirmed real operator.
- His role in the system is Accountant.
- The software should make accounting navigation easy for AGM sir.
- Other roles are not confirmed.
- Future roles are deferred until Real Capita confirms exact office responsibilities.
- The previous ERP is reference only, not the implementation base.
- This system must remain accounting-first, not ERP-first.

## Confirmed Single-Role Rule

The only active role is:

- `ACCOUNTANT`, displayed as `Accountant`

Do not implement, seed, display, or model Admin, Super Admin, Data Entry, Checker, MD Viewer, HR, Sales, Payroll, or any other role in the current phase.

## B. Phase 1B Scope

Phase 1B is documentation/specification lock only.

Phase 1B does not include:

- Database schema changes
- Prisma model additions
- API business modules
- Frontend business pages
- Business seed data
- Additional roles
- Accounting transaction logic

## What Phase 1B Is

Phase 1B defines the first accounting foundation scope, constraints, open questions, and acceptance criteria for a future implementation phase.

## What Phase 1B Is Not

Phase 1B is not a coding phase. It must not add Company, FiscalYear, Project, CostCenter, Account, CashBank, Voucher, Ledger, Report, Payroll, Party, or Dashboard runtime behavior.

## C. First Accounting Foundation Target For Next Implementation

The next implementation phase should likely prepare the foundation for:

- Company Profile / Company Setup
- Fiscal Year
- Accounting Period
- Project
- Cost Center under Project
- Cash/Bank account setup
- Controlled Account Head / Ledger Account foundation

These are targets for the next confirmed coding phase only. They are not implemented in Phase 1B.

## D. Proposed Phase 2A Implementation Scope

After explicit user confirmation, Phase 2A should implement only:

- Company setup
- Fiscal year setup
- Accounting period setup
- Project setup
- Cost center setup under projects
- Basic account class, account group, and account-head foundation
- Cash/bank account setup linked to account heads

Phase 2A should not include:

- Vouchers
- Ledger reports
- Trial balance
- Financial statements
- Payroll
- Parties, customers, or vendors unless explicitly approved
- Dashboard analytics
- Additional roles

## E. Accounting Foundation Requirements

### Company

Required fields:

- Company name
- Legal name, optional
- Address, optional
- Phone, optional
- Email, optional
- Logo, optional later
- Currency, default `BDT`

Rules:

- The system should support a primary company profile before transaction modules.
- Logo support may be deferred if file upload is not approved.
- No real company private documents should be seeded.

### Fiscal Year

Required fields:

- Name
- Start date
- End date
- Status: active or closed

Rules:

- Only one active fiscal year initially.
- End date must be after start date.
- Closing a fiscal year should be a deliberate action in a later implementation.

### Accounting Period

Required fields:

- Fiscal year
- Period name/month
- Start date
- End date
- Status: open, locked, or closed

Rules:

- Accounting periods belong to a fiscal year.
- Period date range must fit inside the fiscal year.
- No voucher posting should be allowed later in locked or closed periods.
- Voucher posting is not implemented in Phase 2A.

### Project

Required fields:

- Code
- Name
- Location, optional
- Status
- Notes, optional

Rules:

- Codes should be unique.
- Inactive projects should not be selectable later in transaction workflows.
- No real project list should be seeded unless Real Capita confirms it.

### Cost Center

Required fields:

- Project, recommended required for project cost centers
- Code
- Name
- Description, optional
- Active/inactive status

Rules:

- Cost centers should be created under projects for project cost tracking.
- Codes should be unique within a project.
- Inactive cost centers should not be selectable later.

### Account Foundation

Required fields:

- Account class: Asset, Liability, Equity, Income, Expense
- Account group
- Ledger account / account head
- Code
- Name
- Normal balance
- Active/inactive status
- Requires project: yes/no
- Requires cost center: yes/no
- Is cash/bank: yes/no

Rules:

- Account creation must be controlled.
- No random uncontrolled account creation.
- Account classes should be constrained to the five accounting classes listed above.
- Account groups organize ledger accounts.
- Ledger accounts are the account heads future vouchers will post against.
- Inactive ledger accounts should not be selectable later.

### Cash/Bank

Required fields:

- Display name
- Account type: cash or bank
- Linked ledger account
- Bank name, optional
- Branch, optional
- Account number, optional
- Active/inactive status

Rules:

- Cash/bank records must link to ledger accounts marked as cash/bank.
- Inactive cash/bank accounts should not be selectable later.
- Account number is optional and should not be seeded with real private data.

## Module-By-Module Requirement Lock

| Area | Locked Phase 2A Intent | Explicitly Deferred |
| --- | --- | --- |
| Company | Maintain company profile and default currency | File uploads, multi-company complexity |
| Fiscal Year | Create and manage one active fiscal year | Closing automation, year-end processing |
| Accounting Period | Create periods and support open/locked/closed status | Voucher posting enforcement until vouchers exist |
| Project | Create projects with code/name/status | Project operations, project finance reports |
| Cost Center | Create cost centers under projects | Cost allocation reports |
| Account Foundation | Controlled account classes, groups, and ledger accounts | Voucher posting, ledgers, trial balance |
| Cash/Bank | Define cash/bank accounts linked to ledger accounts | Cash book, bank book, reconciliation |

## Non-Goals

Do not implement:

- Company module in Phase 1B
- Fiscal year module in Phase 1B
- Project module in Phase 1B
- Cost center module in Phase 1B
- Chart of accounts in Phase 1B
- Ledger accounts in Phase 1B
- Vouchers
- Journal
- Cash book
- Bank book
- Trial balance
- Reports
- Payroll
- Salary sheet
- Project finance
- Parties, customers, or vendors
- File uploads
- Dashboard analytics
- Additional roles
- Business seed data

## F. Acceptance Criteria For Future Implementation

For a future Phase 2A implementation to be accepted:

- Accountant can log in.
- Accountant can create and update the company profile.
- Accountant can create one fiscal year and accounting periods.
- Accountant can create projects.
- Accountant can create cost centers under projects.
- Accountant can create account groups and account heads.
- Accountant can create cash/bank accounts linked to account heads.
- Inactive records cannot be selected later.
- No vouchers exist yet.
- No trial balance exists yet.
- No unconfirmed roles exist.

## Phase 1B Documentation Acceptance Criteria

Phase 1B is accepted only if:

- Requirements are documented in this repository.
- Architecture proposal is documented as proposal-only.
- Acceptance criteria are documented.
- Next-agent prompt is documented.
- No Prisma schema changes are made.
- No business modules are implemented.
- No new roles are added.
- Verification passes with existing checks.

## G. Open Questions For Real Capita

- What exact company legal name should display in the system?
- What fiscal year start/end convention should be used?
- Do projects always need cost centers?
- What is the initial list of real projects?
- What is the initial account head list from the office?
- What cash/bank account names should appear?
- Should parties/customers/vendors come before vouchers or together with vouchers?
- Does AGM sir want company setup first or project setup first in the UI?
- Do account codes already exist?

## Implementation Readiness Checklist

Before Phase 2A coding starts:

- User explicitly confirms Phase 2A implementation.
- User confirms this requirement lock is still accurate.
- User answers or defers the open questions above.
- Agent checks `git status --short --branch`.
- Agent confirms `DATABASE_URL` uses `localhost:55432`.
- Agent confirms only `ACCOUNTANT` exists as a role.
- Agent confirms no business modules were already added unexpectedly.
- Agent reads `docs/architecture/phase-1b-accounting-foundation-model-proposal.md`.
- Agent reads `docs/acceptance/phase-1b-acceptance-criteria.md`.

## Strict Stop Conditions

Stop before coding if:

- User has not confirmed Phase 2A implementation.
- Working tree is not clean.
- Git remote is not `https://github.com/MaruflRana/real-capita-accounts.git`.
- `DATABASE_URL` does not use port `55432`.
- Any unconfirmed role exists in schema, seed data, source, or database.
- Business modules already exist unexpectedly.
- A requested change would require vouchers, reports, payroll, parties, dashboards, or additional roles.
- The agent is not inside `D:\real-capita-accounts`.

## H. Next Prompt Summary

Next agent: read `AGENTS.md`, run `pnpm agent:start`, then read this Phase 1B requirement lock, the Phase 1B model proposal, and the Phase 1B acceptance criteria. Do not implement anything until the user explicitly confirms Phase 2A. If confirmed, implement only Company setup, Fiscal Year, Accounting Period, Project, Cost Center, Account Foundation, and Cash/Bank setup for the single `ACCOUNTANT` role. Do not add vouchers, dashboards, reports, parties, payroll, business seed data, or additional roles.

