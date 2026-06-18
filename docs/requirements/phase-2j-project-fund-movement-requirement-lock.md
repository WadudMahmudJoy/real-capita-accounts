# Phase 2J: Project Fund Movement View Requirement Lock

## Purpose

Phase 2J locks the requirements for a new reporting view: **Project Fund Movement View**. 
Management and accountants need visibility into how much money moved through Cash, Bank, and MFS for a specific project. This view will provide project-wise fund movement visibility by showing cash, bank, and MFS movements related to a selected project.

It is useful for understanding project fund inflow and outflow but must not replace Trial Balance, Cash Book, Bank Book, MFS Book, Project Cost, or Project Financial Summary.

## Current Status

**Requirement lock only. Not implemented.** No backend API, frontend page, Prisma schema change, migration, seed data, or runtime behavior changes have been made for Phase 2J. This document is a specification lock only.

## A. Naming Decision

The chosen product name is **Project Fund Movement View**.
Other options evaluated (Project Cash/Bank/MFS Movement View, Project Payment/Receipt Movement View, Project Money Movement Report) were either too long or less accountant-friendly. "Project Fund Movement View" is concise and accurately reflects that it tracks the movement of funds (Cash/Bank/MFS) tied to a project.

## B. Critical Accounting Rule Decision

### The Problem
A PAYMENT voucher may debit a project expense line (with `projectId`) and credit a Cash in Hand line (without `projectId`).
Should the report infer that the cash outflow is project-related?

### The Decision: Option A — Strict same-line only
A cash/bank/MFS movement is considered project-related **only if the cash/bank/MFS voucher line itself has the `projectId`**.

**Pros**:
* Simple and straightforward.
* Consistent with the existing Phase 2I same-line rule (no inference across lines).
* No hidden project inference or false allocation.
* No Prisma schema or database migration changes required.
* Predictable report behavior.

**Cons**:
* Many PAYMENT vouchers will show no project cash movement if only the expense line has the `projectId`.

**Rejected Options for Phase 2J**:
* **Option B (Controlled voucher-level inference)**: Deemed too complex for this immediate report. High risk of false allocation on multi-project vouchers. Documented as a future enhancement.
* **Option C (Explicit allocation only)**: Requires schema changes, UI changes, and a separate allocation structure. Documented as a future enhancement.

## C. Scope for Phase 2J

### In-Scope
* **Read-Only Report**: API and frontend page only. No mutation.
* **Role**: `ACCOUNTANT` access only.
* **Data Source**: Read from `Voucher.status = POSTED` and `Voucher.isDeleted = false` only (specifically `VoucherLine`).
* **Filters**:
  * Company
  * Fiscal Year
  * Date Range
  * Project (Required/Optional depending on UI, but primarily project-driven)
  * Cost Center
  * Account Type (CASH, BANK, MFS, ALL)
  * Voucher Type (PAYMENT, RECEIPT, CONTRA, JOURNAL)
* **Columns/Display**:
  * Show debit (receipt/inflow) and credit (payment/outflow) based on the cash/bank/MFS line direction.
  * Show opening balance, period debit, period credit, and closing balance for the selected filters if feasible.
* **Export/Print**: Only if the existing report pattern already supports it easily.

### Out-of-Scope
* No MFS provider API integration.
* No payment gateway or customer wallet features.
* No bank reconciliation or MFS fee automation.
* No new accounting tables or report cache tables.
* No Prisma schema migrations unless proven absolutely impossible without one.
* No project allocation engine or automatic inference across multi-project vouchers.
* No editing posted vouchers.
* No new roles (Admin, Manager, etc.).

## D. Demo Dataset Decision

**Decision**: Keep the deterministic demo dataset unchanged.
Do not add optional project-tagged cash/bank/MFS lines during the requirement lock. Only add them in a later implementation chunk if implementation testing proves it necessary.

## E. Risk Assessment

1. **Misleading Totals**: Management might find the totals misleading if they expect inferred project cash movements, because we are using the strict Option A (same-line only) rule.
2. **Multi-Project Vouchers**: If an accountant eventually tags cash lines, multi-project vouchers require careful manual allocation to avoid imbalances.
3. **Missing Data**: Explicitly document that many existing PAYMENT vouchers may not appear in Project Fund Movement View because their cash/bank/MFS lines may not have projectId. This is intentional under Option A. A future voucher UI enhancement may allow optional project tagging on cash/bank/MFS lines, but that is outside Phase 2J requirement lock unless separately approved.
4. **Mismatch with Books**: The sum of project fund movements will not equal the total Cash/Bank/MFS books because non-project cash movements are excluded. This must be clearly communicated to users.
5. **Double-Counting**: Must ensure no double-counting with Project Cost reports. Project Cost tracks expense ledgers; Fund Movement tracks asset (cash/bank/MFS) ledgers. They serve different purposes.
