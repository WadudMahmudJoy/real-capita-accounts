# Phase 2B: Voucher Requirement Lock

## Purpose

Phase 2B locks voucher requirements and acceptance criteria before any voucher schema, API, UI, or business logic is implemented.

This document exists so the next agent or developer can continue from repository context alone, without relying on hidden chat memory.

## A. Confirmed Business Context

- AGM sir is the first and only confirmed real operator.
- His role in the system is Accountant.
- The software should make accounting navigation easy for AGM sir.
- Other roles are not confirmed.
- Future roles are deferred until Real Capita confirms exact office responsibilities.
- The previous ERP is reference only, not the implementation base.
- This system must remain accounting-first, not ERP-first.
- Phase 2A accounting foundation is complete and accepted: Company, FiscalYear, AccountingPeriod, Project, CostCenter, AccountClass, AccountGroup, LedgerAccount, and CashBankAccount exist in schema, backend, and frontend.

## Confirmed Single-Role Rule

The only active role is:

- `ACCOUNTANT`, displayed as `Accountant`

Do not implement, seed, display, or model Admin, Super Admin, Data Entry, Checker, MD Viewer, HR, Sales, Payroll, or any other role in the current phase.

## B. Phase 2B Scope

Phase 2B is documentation/specification lock only.

Phase 2B does not include:

- Database schema changes
- Prisma model additions
- API business modules
- Frontend business pages
- Business seed data
- Additional roles
- Accounting transaction logic runtime

## What Phase 2B Is

Phase 2B defines voucher module requirements, constraints, open questions, and acceptance criteria for a future implementation phase.

## What Phase 2B Is Not

Phase 2B is not a coding phase. It must not add Voucher, VoucherLine, VoucherType, VoucherStatus, or any voucher runtime behavior.

## C. Voucher Module Purpose

The voucher module is the core transaction engine of the accounting system. Every accounting entry passes through vouchers. Vouchers record financial transactions, enforce debit-credit balance rules, link to fiscal years and accounting periods, and provide the data source for all future reports (ledger, cash book, bank book, trial balance, financial statements).

Without vouchers, the Phase 2A foundation has no way to record transactions. Vouchers are the bridge between setup data (accounts, projects, periods) and reporting output.

## D. Voucher Types To Support

The system should support these voucher types in future implementation:

1. **Debit Voucher** - Records transactions where the primary debit entry is the focus (e.g., expense payments, asset purchases).
2. **Credit Voucher** - Records transactions where the primary credit entry is the focus (e.g., income received, liability increases).
3. **Journal Voucher** - Records general double-entry transactions where neither side is primary (e.g., adjustments, transfers between accounts).
4. **Contra Voucher** - Records transactions between two cash/bank accounts (e.g., cash deposited into bank, bank withdrawal to cash).
5. **Payment Voucher** - Records outgoing payments, typically from a cash or bank account to an expense, asset, or liability account.
6. **Receipt Voucher** - Records incoming receipts, typically from an income, asset, or liability source into a cash or bank account.

### Overlap Clarification: Debit/Credit vs Payment/Receipt

Debit Voucher and Credit Voucher are traditional Bangladeshi accounting voucher type labels. They describe which side of the entry is the focus:

- A **Debit Voucher** emphasizes the debit side. It is conceptually similar to a Payment Voucher when the payment debits an expense or asset account.
- A **Credit Voucher** emphasizes the credit side. It is conceptually similar to a Receipt Voucher when the receipt credits an income or liability account.

**Payment Voucher** and **Receipt Voucher** are more specific and operationally useful labels:

- A **Payment Voucher** always involves an outgoing flow from a cash/bank account (credit side is cash/bank, debit side is the target account).
- A **Receipt Voucher** always involves an incoming flow into a cash/bank account (debit side is cash/bank, credit side is the source account).

The system should support all six types. In practice, the accountant will use Payment/Receipt Vouchers for cash/bank transactions, Journal Vouchers for adjustments, Contra Vouchers for inter-cash/bank transfers, and Debit/Credit Vouchers for general entries when the more specific types do not fit. The UI should present all six types clearly and guide the accountant toward the most appropriate type based on whether a cash/bank account is involved.

### Decision Point

Real Capita should confirm whether they prefer the simpler four-type model (Journal, Contra, Payment, Receipt) or the full six-type model (Debit, Credit, Journal, Contra, Payment, Receipt). The six-type model preserves traditional Bangladeshi accounting terminology. If Real Capita prefers fewer types, Debit/Credit Vouchers can be merged into Journal Vouchers in the implementation.

## E. Voucher Header Requirements

### System-Generated Voucher Number

Every voucher must have a system-generated voucher number that is unique within the company and fiscal year context.

The numbering approach must be:

- Deterministic and sequential within a fiscal year per voucher type or per company-wide sequence.
- Never reused, even after deletion of a draft voucher.
- Generated at creation time or at first save, not at posting time, to avoid numbering gaps from abandoned drafts.

Open question for Real Capita: Should voucher numbering be per-type (e.g., `PV-0001`, `RV-0001`, `JV-0001`) or per-company-wide sequence (e.g., `V-0001`, `V-0002`) regardless of type?

### Physical SI No / Physical Voucher Number

Every voucher must carry a **Physical SI No** field that records the physical serial number or invoice number from the paper document in the office. This is separate from the system-generated voucher number.

Rules:

- Physical SI No is optional but recommended.
- Physical SI No is a free-text field, not system-enforced unique.
- It helps the accountant cross-reference the digital voucher with the physical paper trail.
- It may hold the supplier invoice number, receipt number, or internal office serial number.

### Voucher Date

Every voucher must have a voucher date.

Rules:

- Voucher date determines which accounting period the voucher belongs to.
- Voucher date must fall within an open accounting period of the active fiscal year.
- Voucher date must not fall in a locked or closed accounting period.
- The accountant should be warned if the voucher date is outside an open period.

### Fiscal Year and Accounting Period Linkage

Every voucher must belong to a fiscal year and an accounting period.

Rules:

- The fiscal year is derived from the voucher date at creation, or explicitly selected if the date spans a year boundary.
- The accounting period is derived from the voucher date.
- Only vouchers in open accounting periods can be created or edited.
- Only vouchers in open accounting periods can be posted.
- Vouchers in locked or closed periods cannot be created, edited, or posted.

### Draft vs Posted Workflow

Vouchers must support a draft-to-posted workflow:

- **Draft**: The voucher is being prepared. It can be edited, line items can be added/removed, and totals can change. Draft vouchers do not affect account balances and do not appear in reports.
- **Posted**: The voucher is finalized. It affects account balances, appears in ledger reports, and cannot be freely edited. Posting is a deliberate action.

Rules:

- The accountant creates a voucher as a draft.
- The accountant reviews the draft and posts it when confident.
- Only the `ACCOUNTANT` role can create, edit, and post vouchers in the current phase.
- A future approval/checker workflow may be added when Real Capita confirms additional roles, but is not implemented in the voucher phase.

### Posting Date

When a voucher is posted, the system must record a posting date and the posting user.

Rules:

- Posting date is the timestamp when the post action occurs.
- Posting date may differ from voucher date (e.g., a voucher dated June 5 posted on June 10).
- The accounting period is determined by voucher date, not posting date.

### Narration / Description

Every voucher must carry a narration/description field.

Rules:

- Narration is required at the voucher header level.
- Narration should describe the transaction purpose (e.g., "Payment to contractor for Phase 1 work").
- Individual voucher lines may optionally carry their own description/narration for line-level context.

## F. Voucher Line Requirements

### Debit-Credit Line Structure

Every voucher must have at least two lines: one debit line and one credit line.

Rules:

- Each line references a LedgerAccount (account head).
- Each line has an amount.
- Each line is either a debit or a credit entry.
- Debit total must equal credit total before posting. If they do not match, the voucher cannot be posted.
- A voucher may have more than two lines (e.g., one debit and two credits, or two debits and one credit).
- Each line may optionally reference a Project if the selected LedgerAccount requires project tracking.
- Each line may optionally reference a CostCenter if the selected LedgerAccount requires cost center tracking.
- Each line may optionally reference a CashBankAccount if the line involves a cash/bank ledger account.

### Ledger Account Selection

Rules:

- Only active LedgerAccounts can be selected in voucher lines.
- Inactive LedgerAccounts must not appear in selection dropdowns.
- The normal balance of the LedgerAccount determines whether debit or credit increases the account balance.

### Project Requirement Validation

Rules:

- If a selected LedgerAccount has `requiresProject = true`, the voucher line must include a Project reference.
- If a selected LedgerAccount has `requiresProject = false`, the voucher line may optionally include a Project reference.
- Only active projects can be selected.

### Cost Center Requirement Validation

Rules:

- If a selected LedgerAccount has `requiresCostCenter = true`, the voucher line must include a CostCenter reference.
- If a selected LedgerAccount has `requiresCostCenter = false`, the voucher line may optionally include a CostCenter reference.
- Only active cost centers can be selected.
- The cost center must belong to the selected project if both project and cost center are provided.

### Cash/Bank Behavior

Rules:

- If a voucher line references a LedgerAccount where `isCashBank = true`, the line should also link to a specific CashBankAccount.
- Payment Vouchers and Receipt Vouchers must involve at least one cash/bank line.
- Contra Vouchers must involve exactly two cash/bank lines (one debit, one credit, representing the transfer).
- Journal Vouchers may or may not involve cash/bank accounts.
- Debit/Credit Vouchers may or may not involve cash/bank accounts.
- Cash/bank lines determine which cash/bank account shows the transaction in future cash book and bank book reports.

## G. Audit Trail Expectations

Rules:

- Every voucher creation must be recorded in AuditEvent with the creating user, action type, and timestamp.
- Every voucher posting must be recorded in AuditEvent with the posting user, action type, and timestamp.
- Every voucher edit (draft) must be recorded in AuditEvent.
- Every voucher reversal/correction must be recorded in AuditEvent if such features are implemented.
- Audit trail must include the voucher number, voucher type, and amounts for traceability.

## H. Print / Export Expectation

Print and export features are expected for vouchers but are deferred to a later phase after the voucher engine is stable.

Future expectations:

- Printable voucher format matching or improving on the current office paper voucher layout.
- PDF export for individual vouchers.
- List/export for voucher registers (all vouchers in a period or fiscal year).
- These are not implemented in the first voucher implementation phase.

## I. Attachment Decision

File attachments for vouchers (e.g., scanned invoices, supporting documents) are deferred unless Real Capita confirms this requirement.

Decision points:

- If attachments are needed, they require a file upload infrastructure (storage, MIME validation, size limits, security).
- If attachments are not needed initially, the voucher phase proceeds without attachment fields.
- This decision should be confirmed before the first voucher implementation phase starts.

## J. No Reports in Phase 2B

Phase 2B does not include any reporting functionality. Reports are explicitly deferred:

- No ledger reports.
- No cash book.
- No bank book.
- No trial balance.
- No financial statements.
- No dashboard analytics.
- No project finance reports.

Reports should be derived from posted VoucherLine records in a future phase. They should not be stored as separate primary manual tables.

## K. No Parties / Customers / Vendors in Phase 2B

Phase 2B does not include party, customer, or vendor modules.

Decision point:

- If Real Capita wants vouchers to reference a party (e.g., a supplier or customer name), a party module must be designed and confirmed separately before implementation.
- Without a party module, the accountant can use narration/description to record party names as free text.
- Party references should not be forced into voucher lines until a party model is confirmed.

## L. Module-By-Module Requirement Lock

| Area | Locked Phase 2B Intent | Explicitly Deferred |
| --- | --- | --- |
| Voucher Header | System number, physical SI No, date, type, narration, fiscal year/period linkage, draft/posted workflow | Approval workflow, multi-level authorization |
| Voucher Line | Debit-credit structure, ledger account selection, project/cost center validation, cash/bank linkage | Party references, cost allocation splits |
| Voucher Types | Six types: Debit, Credit, Journal, Contra, Payment, Receipt (pending Real Capita confirmation) | Custom voucher types, type-specific mandatory fields |
| Voucher Numbering | Sequential within fiscal year, never reused, deterministic | Auto-prefix formatting, per-type vs per-company numbering (open question) |
| Posting Validation | Debit total equals credit total, open period required, project/cost center required when LedgerAccount flags demand them | Approval gate, checker approval |
| Audit Trail | Creation, edit, post, reversal events in AuditEvent | Detailed change diffs, line-level audit |
| Print/Export | Deferred to later phase | PDF, printable format, voucher register export |
| Attachments | Deferred unless Real Capita confirms | File upload, scanned documents |
| Reports | Not in Phase 2B | Ledger, cash book, bank book, trial balance, financial statements |
| Parties | Not in Phase 2B unless separately confirmed | Party module, customer/vendor references in voucher lines |

## M. Open Questions For Real Capita

- Should voucher numbering be per-type (PV-0001, RV-0001) or per-company-wide (V-0001)?
- Should Debit/Credit Vouchers be kept as separate types, or merged into Journal Vouchers for a simpler four-type model?
- What prefix/format should voucher numbers follow?
- Should draft vouchers be editable by anyone with ACCOUNTANT role, or should a future checker/approver gate be planned from the start?
- Should physical SI No be mandatory or optional?
- Are file attachments needed for vouchers? If yes, what file types and size limits?
- Should voucher lines reference parties (suppliers/customers) by name now, or should a party module be designed first?
- What is the preferred voucher date behavior when the date is near a period boundary?
- Should reversal vouchers be a separate voucher or a special action on the original voucher?
- Should the accountant be able to create multiple vouchers in a batch, or is single-entry the expected workflow?

## N. Implementation Readiness Checklist

Before voucher implementation coding starts:

- User explicitly confirms the next implementation phase.
- User confirms this requirement lock is still accurate.
- User answers or defers the open questions above.
- Agent checks `git status --short --branch`.
- Agent confirms `DATABASE_URL` uses `localhost:55432`.
- Agent confirms only `ACCOUNTANT` exists as a role.
- Agent confirms Phase 2A accounting foundation is complete and accepted.
- Agent reads `docs/architecture/phase-2b-voucher-model-proposal.md`.
- Agent reads `docs/acceptance/phase-2b-acceptance-criteria.md`.
- Agent confirms no voucher models were already added unexpectedly.

## O. Strict Stop Conditions

Stop before coding if:

- User has not confirmed the voucher implementation phase.
- Working tree is not clean.
- Git remote is not `https://github.com/MaruflRana/real-capita-accounts`.
- `DATABASE_URL` does not use port `55432`.
- Any unconfirmed role exists in schema, seed data, source, or database.
- Voucher models already exist unexpectedly in the Prisma schema.
- Phase 2A accounting foundation is not complete.
- The agent is not inside `D:\real-capita-accounts`.

## P. Next Prompt Summary

Next agent: read `AGENTS.md`, run `pnpm agent:start`, then read this Phase 2B requirement lock, the Phase 2B model proposal, and the Phase 2B acceptance criteria. Do not implement anything until the user explicitly confirms the next voucher implementation phase. If confirmed, implement only the voucher engine for the single `ACCOUNTANT` role. Do not add reports, dashboards, payroll, parties, customers, vendors, business seed data, additional roles, or file uploads without separate confirmation.
