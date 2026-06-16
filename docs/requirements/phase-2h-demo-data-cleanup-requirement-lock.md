# Phase 2H: Demo/Test Data Cleanup and Safe Demo Dataset Standardization Requirement Lock

## Purpose

Phase 2H locks requirements for safe demo/test data audit, cleanup, reset, and verification tooling. The system now has stable accounting, reports, MFS Book foundation, and project/cost-center reports. The current database may contain self-testing/smoke/demo entries from manual testing sessions. Before the next demo or review, the project needs safe tooling and clear rules to produce a clean, deterministic demo dataset without risking accidental production data loss.

This document exists so the next agent or developer can continue from repository context alone, without relying on hidden chat memory.

## Current Status

**Requirement lock only. Not implemented.** No seed script, audit script, reset script, verification script, Prisma schema change, migration, backend API, frontend page, or runtime behavior changes have been made for Phase 2H. This document is a specification lock only.

## A. Confirmed Business Context

- Phase 2G Project/Cost-Center Financial Reporting is complete and accepted at `7e60a1f` (tag `phase-2g-complete`). All four primary reports (Project Ledger, Project Cost Report, Cost Center Summary, Project Financial Summary) are implemented and verified.
- Phase 2F Issue F (demo/test data cleanliness planning) is deferred to this phase. Phase 2F Issues A-D are implemented.
- Phase 2E MFS account setup and MFS Book foundation are accepted. MFS voucher posting remains deferred.
- Phase 2D accounting reports are accepted. All 11 backend report endpoints and frontend pages are implemented.
- Phase 2C voucher engine is accepted. Posted vouchers carry `projectId` and `costCenterId` on each `VoucherLine`.
- Phase 2A accounting foundation is accepted. Projects, Cost Centers, Ledger Accounts, Account Groups, Account Classes, Cash/Bank/MFS Accounts exist as first-class entities.
- Only the `ACCOUNTANT` role is confirmed. Other roles are deferred until Real Capita confirms exact office responsibilities.
- Reports derive from posted `VoucherLine` rows only (`Voucher.status = POSTED`, `Voucher.isDeleted = false`). No primary report tables.
- The current database may contain duplicate-looking fiscal years, smoke-test vouchers, ad-hoc test rows, and development session data that make clean accountant demos harder.

### Confirmed Single-Role Rule

The only active role is:

- `ACCOUNTANT`, displayed as `Accountant`

Do not implement, seed, display, or model Admin, Super Admin, Data Entry, Checker, MD Viewer, HR, Sales, Payroll, Viewer, Manager, or any other role in Phase 2H.

### Safety-First Design

Phase 2H is safety-first by design:

- No accidental production reset.
- No automatic destructive command without explicit confirmation.
- No data deletion during requirement lock.
- No schema/migration unless explicitly justified later.
- Preserve auth/admin/accountant access.
- Produce a deterministic Real Capita demo dataset when reset is explicitly approved.
- Never run in production.

---

## B. Phase 2H Scope

Phase 2H is a documentation/specification lock only.

Phase 2H does not include:

- Database schema changes
- Prisma model additions or enum changes
- New API business endpoints
- New frontend business pages
- Runtime code changes
- Report table additions
- MFS voucher posting support
- PDF/Excel export
- Dashboard analytics
- Party/customer/vendor module
- Payroll
- File attachment handling
- MinIO/object storage cleanup (deferred to separate future approval)

## What Phase 2H Is

Phase 2H defines four future tooling capabilities:

1. **Demo Data Audit** -- read-only report of current demo/test data state without modifying anything
2. **Safe Demo Reset** -- destructive reset of approved demo/UAT data with confirmation guard, producing a clean deterministic dataset
3. **Demo Verification** -- assertion-based check that the deterministic demo dataset produces expected accounting/report totals
4. **Docs Cleanup** -- final integration review, browser smoke, docs, tagging

## What Phase 2H Is Not

Phase 2H is not a coding phase. It must not add seed scripts, audit scripts, reset scripts, verification scripts, report tables, MFS posting, new roles, PDF/Excel export, dashboard analytics, party modules, payroll, or any other feature outside the four tooling capabilities locked in this document.

---

## C. Tool A: Demo Data Audit

### Purpose

Report current demo/test data state without modifying anything. The audit tool helps the developer or accountant understand what data exists, what looks suspicious, and what cleanup actions are recommended, before any destructive operation.

### Future Command Name

`pnpm demo:audit`

### Required Audit Output

The audit must produce a structured report containing:

| Category | Items |
| --- | --- |
| Entity counts | Company count, fiscal year count, accounting period count, project count, cost center count, account class count, account group count, ledger account count, cash/bank/MFS account count (by type) |
| Voucher counts | Total voucher count, posted voucher count, draft voucher count, soft-deleted voucher count (if > 0), voucher count by type |
| Duplicate detection | Duplicate-looking fiscal year names or date ranges, duplicate-looking accounting period names within the same fiscal year, duplicate-looking ledger account codes, duplicate-looking cash/bank/MFS account display names |
| Orphan checks | Projects with no cost centers, cost centers with `projectId` pointing to inactive or missing project, ledger accounts with inactive account group, cash/bank accounts with inactive or non-cash-bank ledger account |
| Consistency checks | Voucher lines where `projectId` does not match the voucher's fiscal year scope or is orphan, voucher lines where `costCenterId` belongs to a different project than `projectId`, voucher lines where `cashBankAccountId` belongs to a non-cash-bank ledger account, posted vouchers with `isDeleted = true` (should not exist) |
| Report readiness | Trial Balance `isBalanced` and `difference`, Balance Sheet adjusted current P/L and `isBalancedAdjusted`, Cash Book closing balance exists, Bank Book closing balance exists, MFS Book closing balance exists (if MFS account present), Project Ledger data exists (if project present), Project Cost data exists (if project present), Cost Center Summary data exists (if project present), Project Financial Summary data exists (if project present) |

### Rules

- Must be strictly read-only. Never delete, update, or insert data.
- Must work on local/dev DB only. Should print a warning if `DATABASE_URL` does not appear local.
- Must clearly print warnings and recommended cleanup actions for each issue found.
- Must print a summary line at the end: "Audit complete. N issues found. Run `pnpm demo:reset` with confirmation to clean up (if desired)."

---

## D. Tool B: Safe Demo Reset / Standardization

### Purpose

Reset only approved demo/UAT data and recreate a clean deterministic Real Capita accounting demo dataset. The reset destroys all accounting-transaction data in the target database and recreates a known-good state for demos and testing.

### Future Command Name

`pnpm demo:reset`

### Safety Requirements

The reset command must satisfy all of the following safety rules:

1. **Explicit confirmation required**: Must refuse to run unless environment variable `CONFIRM_DEMO_RESET=YES` is set. Must print a clear warning and exit if the variable is not set.
2. **Local/dev DB guard**: Must refuse to run if `DATABASE_URL` does not appear to point to `localhost`, `127.0.0.1`, or `55432` (the local dev port). Must refuse to run if the database name does not contain `real_capita_accounts` or a similar dev-pattern name. Must refuse to run if `NODE_ENV=production`. If a developer explicitly wants to override this guard (e.g., for a staging DB), a second override variable `CONFIRM_DEMO_RESET_OVERRIDE=YES` must also be set.
3. **Target URL display**: Must print the full `DATABASE_URL` host, port, and database name before doing anything destructive, so the operator can visually confirm they are targeting the correct database.
4. **Dry-run support**: Must support a `--dry-run` or `DEMO_RESET_DRY_RUN=YES` mode that prints what would be deleted/recreated without actually performing any destructive operation.
5. **Preserve seed users**: Must preserve or recreate the deterministic ACCOUNTANT seed user (`accountant@realcapita.local`). Must never delete unknown users by default. The reset recreates the required seed users as part of the deterministic dataset.
6. **Never automatic**: Must never run automatically during build, `pnpm doctor`, `pnpm check:all`, app startup, or any CI pipeline.
7. **Production refusal**: Must hard-refuse to run if `NODE_ENV=production`.
8. **No silent deletion**: Must print every table it is about to clear, and every entity it is about to delete, before performing the deletion.
9. **Backup instruction**: Must print a mandatory `pg_dump` command the operator should run before proceeding, and require the confirmation variable as acknowledgment that a backup was considered. Automated backup execution is an optional future enhancement.
10. **Post-reset verification**: After reset, must automatically run `pnpm demo:verify` to confirm the new dataset is correct. If verification fails, must print a clear error and recommended fix.

### Deletion Scope

The reset may delete/recreate the following data:

- All `VoucherLine` rows
- All `Voucher` rows
- All `VoucherNumberSequence` rows
- All `CashBankAccount` rows (then recreate deterministic ones)
- All `LedgerAccount` rows (then recreate deterministic ones)
- All `AccountGroup` rows (then recreate deterministic ones)
- All `AccountClass` rows (then recreate deterministic ones)
- All `CostCenter` rows (then recreate deterministic ones)
- All `Project` rows (then recreate deterministic ones)
- All `AccountingPeriod` rows (then recreate deterministic ones)
- All `FiscalYear` rows (then recreate deterministic ones)
- All `Company` rows (then recreate deterministic one)
- All `UserRole` rows (then recreate deterministic one)
- All `Role` rows (then recreate deterministic one)
- All `User` rows except the ACCOUNTANT seed user (then recreate deterministic seed user)
- All `AuditEvent` rows
- All `AuthSession` rows

### Preservation Scope

The reset must NOT touch the following unless explicitly approved in a separate future phase:

- Uploaded files/attachments (not yet implemented, but the rule stands)
- MinIO objects or file storage
- Prisma migrations or schema history
- Git history or repository data
- Environment files, secrets, or `.env`
- Production data on any non-local database
- Any data outside the `real_capita_accounts` database

---

## E. Tool C: Deterministic Demo Dataset

The reset must create a clean accounting scenario that produces verifiable, predictable report totals.

### Company

| Field | Value |
| --- | --- |
| name | Real Capita Group |
| legalName | Real Capita Group Ltd |
| currency | BDT |

### Fiscal Year

| Field | Value |
| --- | --- |
| name | FY 2025-2026 |
| startDate | 2025-07-01 |
| endDate | 2026-06-30 |
| isActive | true |

### Accounting Period

| Field | Value |
| --- | --- |
| name | June 2026 |
| startDate | 2026-06-01 |
| endDate | 2026-06-30 |
| status | OPEN |

### Project

| Field | Value |
| --- | --- |
| code | SK-001 |
| name | Shanti Kutir |
| location | Gazipur |
| isActive | true |

### Cost Center

| Field | Value |
| --- | --- |
| code | SK-LD |
| name | Shanti Kutir - Land Development |
| projectId | SK-001 |
| isActive | true |

### Account Classes (standard five)

| Code | Name | Normal Balance |
| --- | --- | --- |
| ASSET | Asset | DEBIT |
| LIABILITY | Liability | CREDIT |
| EQUITY | Equity | CREDIT |
| INCOME | Income | CREDIT |
| EXPENSE | Expense | DEBIT |

### Account Groups

| Code | Name | Account Class |
| --- | --- | --- |
| AG-100 | Current Assets | ASSET |
| AG-300 | Capital & Reserves | EQUITY |
| AG-500 | Operating Expenses | EXPENSE |

### Ledger Accounts

| Code | Name | Account Group | Normal Balance | requiresProject | requiresCostCenter | isCashBank |
| --- | --- | --- | --- | --- | --- | --- |
| 1010 | Cash in Hand | AG-100 | DEBIT | false | false | true |
| 1020 | City Bank Account | AG-100 | DEBIT | false | false | true |
| 1030 | bKash Merchant Wallet | AG-100 | DEBIT | false | false | true |
| 5010 | Land Development Expense | AG-500 | DEBIT | true | true | false |
| 3010 | Capital Introduced | AG-300 | CREDIT | false | false | false |

### Cash/Bank/MFS Accounts

| Display Name | Account Type | Ledger Account | Bank Name | Branch | Provider | Wallet Number |
| --- | --- | --- | --- | --- | --- | --- |
| Office Cash | CASH | 1010 | - | - | - | - |
| City Bank - Uttara Branch | BANK | 1020 | City Bank | Uttara | - | - |
| bKash Merchant - Real Capita | MFS | 1030 | - | - | BKASH | 017XXXXXXX |

The bKash wallet number must use a placeholder (`017XXXXXXX`) and never use a real wallet number. The provider must be `BKASH`.

### Seed User

| Email | Full Name | Password (hashed) | Role |
| --- | --- | --- | --- |
| accountant@realcapita.local | Accountant | ChangeMe123! (hashed via bcrypt) | ACCOUNTANT |

### Deterministic Posted Voucher Scenario

#### Voucher 1: Capital Introduced

| Field | Value |
| --- | --- |
| voucherType | JOURNAL |
| voucherDate | 2026-06-01 |
| narration | Capital introduced by the proprietor |
| accountingPeriod | June 2026 |

| Line | Side | Ledger | Amount | Project | Cost Center | Cash/Bank |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | DEBIT | 1010 Cash in Hand | 100,000 | - | - | Office Cash |
| 2 | CREDIT | 3010 Capital Introduced | 100,000 | - | - | - |

Status: POSTED

#### Voucher 2: Project Land Development Expense Payment

| Field | Value |
| --- | --- |
| voucherType | PAYMENT |
| voucherDate | 2026-06-10 |
| narration | Land development expense for Shanti Kutir project |
| accountingPeriod | June 2026 |

| Line | Side | Ledger | Amount | Project | Cost Center | Cash/Bank |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | DEBIT | 5010 Land Development Expense | 50,000 | SK-001 | SK-LD | - |
| 2 | CREDIT | 1010 Cash in Hand | 50,000 | - | - | Office Cash |

Status: POSTED

### Expected Report Results After Reset

| Report | Expected Result |
| --- | --- |
| Cash Book (FY 2025-2026, June 2026) | Opening 0, period debit 100,000, period credit 50,000, closing 50,000 Dr |
| Ledger 1010 Cash in Hand | Closing 50,000 Dr |
| Ledger 3010 Capital Introduced | Closing 100,000 Cr |
| Ledger 5010 Land Development Expense | Closing 50,000 Dr |
| Trial Balance (June 2026) | Balanced, difference = 0 |
| Income Statement (June 2026) | Net loss = 50,000 (expense 50,000, income 0) |
| Balance Sheet adjusted (as-of June 2026-30) | Balanced with current P/L -50,000 under equity |
| Project Ledger (SK-001, June 2026) | 1 expense line, debit 50,000, project SK-001, cost center SK-LD |
| Project Cost Report (SK-001, June 2026) | Total debit 50,000, project expense 50,000, asset 0, 1 grouped row, no Unassigned duplicate for SK-LD |
| Cost Center Summary (SK-001, June 2026) | SK-LD once, debit 50,000, 0 unassigned lines |
| Project Financial Summary (SK-001, June 2026) | Expense 50,000, asset 0, income 0, SK-LD once in cost-center breakdown |
| MFS Book | No posted MFS voucher lines (MFS posting remains deferred) |

### Voucher Number Expectation

Voucher numbers must follow the existing `VoucherNumberSequence` pattern (format `TYPE-NNNNN`). The deterministic seed must use the existing voucher creation and posting API/services to produce posted vouchers, not raw SQL inserts, so that voucher numbers, totals, and audit events are correctly generated through the established business logic. If the seed must use Prisma direct creates for infrastructure entities (Company, FiscalYear, etc.), the vouchers must be created through the service layer to preserve posting validation.

---

## F. Tool D: Demo Verification

### Purpose

Assert that the deterministic demo dataset produces expected accounting/report totals. The verification tool runs after reset (or at any time) and confirms the demo data is in a known-good state.

### Future Command Name

`pnpm demo:verify`

### Required Verification Checks

The verification must assert all of the following:

| Check | Expected |
| --- | --- |
| Seed user exists | `accountant@realcapita.local` user with ACCOUNTANT role |
| Company exists | Real Capita Group with BDT currency |
| Fiscal year active | FY 2025-2026 is active and not closed |
| Period open | June 2026 is OPEN |
| Project active | SK-001 Shanti Kutir is active |
| Cost center active and linked | SK-LD is active and `projectId` = SK-001 |
| Ledger accounts exist and active | 1010, 1020, 1030, 5010, 3010 all active with correct flags |
| Cash/Bank/MFS linked | Office Cash linked to 1010, City Bank linked to 1020, bKash Merchant linked to 1030 (MFS, BKASH) |
| Posted vouchers count | Exactly 2 posted vouchers, 0 draft vouchers, 0 soft-deleted vouchers |
| Trial Balance | `difference = 0`, `isBalanced = true` |
| Cash Book closing | Closing balance = 50,000 Dr |
| Income Statement | Net loss = 50,000 |
| Balance Sheet adjusted | `isBalancedAdjusted = true` |
| Project Ledger | SK-001 has exactly 1 posted line with debit 50,000, project SK-001, cost center SK-LD |
| Project Cost | Total debit 50,000, expense 50,000, no Unassigned duplicate for SK-LD |
| Cost Center Summary | SK-LD appears once, 0 unassigned lines |
| Project Financial Summary | Expense 50,000, asset 0, income 0, SK-LD once in cost center breakdown |
| MFS posting still blocked | Voucher posting rejects MFS cash-bank accounts |

### Rules

- Must be read-only. Never create, update, or delete data.
- Must call the existing report API endpoints (not raw SQL) to verify report totals, ensuring the full service-layer pipeline is tested.
- Must print a clear PASS/FAIL for each check.
- Must print a summary: "Verification complete. N checks passed, M checks failed."
- Must exit with non-zero code if any check fails, so CI or scripts can detect failure.

---

## G. Cleanup Scope Definition

### What Reset May Delete/Recreate

- All demo vouchers and voucher lines
- All demo fiscal periods and fiscal years
- All demo projects and cost centers
- All demo ledger accounts, account groups, and account classes
- All demo cash/bank/MFS accounts
- All demo companies
- All demo users (except seed user preservation/recreation)
- All demo audit events and auth sessions
- All voucher number sequences

### What Reset Must NOT Touch (Unless Explicitly Approved Separately)

- Real users beyond seed/demo users
- Uploaded files/attachments
- Production data on any non-local database
- MinIO objects or file storage
- Prisma migrations or `_prisma_migrations` table
- Git history
- Environment files or secrets (`.env`)
- Any data outside the `real_capita_accounts` database
- The `prisma/schema.prisma` file or any source code
- CI/CD pipeline configuration

---

## H. Technical Constraints

1. **No Prisma schema change.** Phase 2H does not add models, enums, or migrations. The existing schema is sufficient for demo data operations.
2. **Seed must use existing services where possible.** For vouchers, the seed must create and post through the existing `VoucherService` API to preserve posting validation, voucher number generation, totals computation, and audit events. For infrastructure entities (Company, FiscalYear, etc.), the seed may use Prisma direct creates since no service-layer validation exists for those.
3. **Scripts live in `prisma/` and `scripts/`.** The audit, reset, and verify scripts should be TypeScript files runnable via `tsx` (matching the existing seed pattern). The `package.json` `scripts` section must gain `demo:audit`, `demo:reset`, `demo:verify` commands.
4. **Decimal-safe.** All money comparisons in verification must use `Prisma.Decimal` or string comparison with `toFixed(2)`, never floating-point.
5. **Preserve HttpOnly cookie auth.** No localStorage token usage. No auth changes.
6. **Read-only audit.** `pnpm demo:audit` must never modify data.
7. **Confirmation-guarded reset.** `pnpm demo:reset` must never run without `CONFIRM_DEMO_RESET=YES`.
8. **Local-only reset.** `pnpm demo:reset` must refuse non-local databases.
9. **Verify uses API endpoints.** `pnpm demo:verify` must call the running API's report endpoints (or start the API if not running) to verify report totals through the full service pipeline, not raw SQL.

---

## I. UX Constraints

Phase 2H is a tooling phase, not a frontend phase. No new frontend pages or sidebar entries are added. The tools are CLI-only.

- `pnpm demo:audit` prints a structured text report to stdout.
- `pnpm demo:reset` prints progress steps and confirmation prompts to stdout.
- `pnpm demo:verify` prints PASS/FAIL per check to stdout.

---

## J. Security Rule (Preserved)

- HttpOnly cookie-based JWT/session authentication continues.
- No auth tokens in localStorage.
- Cookies: `SameSite=Lax`, `Secure` only in production.
- Password hashing continues. The seed user password `ChangeMe123!` must be bcrypt-hashed, never stored plaintext.
- Backend guards and role checks remain the authority.
- Phase 2H tooling does not change any API endpoint guards or role checks.
- No real passwords, real wallet numbers, real transaction amounts, or private business data in demo seed data.

---

## K. Open Questions and Recommended Answers

### 1. Should reset preserve existing users?

**Recommendation**: Yes. The reset should recreate the deterministic ACCOUNTANT seed user. If other users exist in the database (e.g., from manual testing), the reset should delete them since they are test artifacts. The reset must never delete users from a non-local database. In local/dev mode, clearing all users and recreating the seed user is acceptable because the DB is known to be a development sandbox.

### 2. Should reset delete all vouchers or only demo-labeled vouchers?

**Recommendation**: In local/dev demo DB, explicit reset clears all accounting transaction data (vouchers, voucher lines, voucher number sequences, audit events) after confirmation. There is no reliable way to distinguish "demo" vouchers from "test" vouchers in the current schema (no `isDemo` flag). Clearing all is simpler, safer, and produces a truly clean state. In any non-local DB, the reset must refuse entirely.

### 3. Should demo voucher numbers be deterministic?

**Recommendation**: Voucher numbers should be deterministic enough for demos, but they must follow the existing `VoucherNumberSequence` pattern (`TYPE-NNNNN`). The seed should reset `VoucherNumberSequence` counters so the first JOURNAL voucher gets `JOURNAL-00001` and the first PAYMENT voucher gets `PAYMENT-00001`. If the existing voucher service generates numbers transactionally, the seed must call the service rather than hardcoding voucher numbers, so the system voucher number is whatever the service produces. The verification should check that exactly 2 posted vouchers exist, not that specific voucher numbers match.

### 4. Should MFS wallet be seeded even though MFS posting is deferred?

**Recommendation**: Yes. Seed the bKash Merchant Wallet (MFS account) with placeholder wallet number `017XXXXXXX`. This tests MFS Book readiness and MFS account setup, but do not create any MFS posted vouchers. The MFS Book should show an empty result for the seeded MFS account. The verification must confirm MFS posting still rejects MFS cash-bank accounts.

### 5. Should backup be required?

**Recommendation**: Yes. At minimum, the reset must print a mandatory `pg_dump` command and require `CONFIRM_DEMO_RESET=YES` as acknowledgment that the operator considered a backup. Full automated backup execution is an optional future enhancement; the initial implementation should print the command and proceed after confirmation.

### 6. Should this run on production?

**Recommendation**: No. Hard refusal. The reset must check `NODE_ENV` and `DATABASE_URL` and refuse to run if either indicates production. There is no scenario where demo reset should touch a production database.

### 7. Should cleanup remove smoke duplicate rows?

**Recommendation**: Yes, in demo reset mode only. The audit tool should only report duplicate-looking rows; the reset tool should clear all data and recreate the deterministic dataset, which inherently removes duplicates. The reset does not surgically remove individual duplicate rows; it clears entire tables and recreates from scratch.

---

## L. Explicit Out-of-Scope List

Phase 2H does NOT include:

- New roles beyond ACCOUNTANT
- Party/customer/vendor module
- Payroll/salary module
- File attachments
- PDF/Excel export
- Dashboard analytics
- MFS voucher posting support
- Provider API integration (bKash API, Nagad API, etc.)
- Old ERP copy/paste
- Editable ledger/report/project-cost tables in the Prisma schema
- Direct posted voucher editing
- Closing-entry automation
- Approval workflow
- Business seed data containing real passwords, real wallet numbers, or private business data
- Multi-currency support
- Localization/translation
- Project detail pages (`/app/projects/[id]`) with embedded reports
- Broad sidebar restructuring
- Project budgeting or forecasting
- Receivable/payable tracking without a party module
- MinIO/object storage cleanup (deferred to separate future approval)
- Report calculation changes
- Voucher posting rule changes (except using existing posting API in seed)
- CI/CD pipeline integration of demo reset
- Production database operations

---

## M. Regression Criteria

All existing report behavior must not regress after Phase 2H implementation:

- All 11 backend report endpoints continue to return correct results after demo reset.
- All 11 frontend report pages render correctly.
- Cash Book remains CASH-only. Bank Book remains BANK-only. MFS Book remains MFS-only.
- Trial Balance total debits equal total credits.
- Income Statement net profit/loss calculation is correct.
- Balance Sheet P/L-adjusted and unadjusted views remain intact.
- Voucher posting behavior is unchanged (MFS posting still rejected).
- Voucher line dynamic field visibility is unchanged.
- Project Ledger, Project Cost, Cost Center Summary, and Project Financial Summary continue to produce correct results with the deterministic dataset.

---

## N. Relationship to Phase 2F Issue F

Phase 2F Issue F (demo/test data cleanliness) was deferred to a future implementation phase. Phase 2H directly addresses Issue F by defining the audit, reset, and verification tooling that Phase 2F only planned. Once Phase 2H is implemented, Phase 2F Issue F can be marked as resolved.
