# ADR-0007: Phase 2B Voucher Requirement Lock Before Implementation

## Status

Accepted

## Decision

Before adding voucher schema/models, API, or UI, lock voucher module requirements and acceptance criteria in repository documentation.

## Context

Phase 2A accounting foundation is complete and accepted. The foundation provides Company, FiscalYear, AccountingPeriod, Project, CostCenter, AccountClass, AccountGroup, LedgerAccount, and CashBankAccount in schema, backend API, and frontend pages.

Vouchers are the core transaction engine of the accounting system. Every financial entry passes through vouchers. Voucher schema decisions affect:

- Database shape (Voucher, VoucherLine, VoucherNumberSequence)
- API boundaries (creation, validation, posting, deletion rules)
- UI workflows (draft editing, line management, posting action)
- Future reporting (all reports derive from posted voucher lines)
- Accounting integrity (debit-credit balance, period enforcement, audit trail)
- Concurrency (voucher numbering, idempotency)

These decisions are expensive to change after implementation. The voucher engine is the most critical business module in the system. Locking requirements before coding prevents assumptions from hardening into schema constraints that are difficult to reverse.

## Decision

Phase 2B is documentation/specification only. It locks voucher requirements, model proposals, validation rules, posting rules, deletion policies, reversal/correction proposals, and acceptance criteria before any Prisma schema change, API module, or frontend page is created.

## Consequences

- Phase 2B adds only documentation files. No Prisma schema changes, no migrations, no API modules, no frontend pages.
- No Voucher, VoucherLine, VoucherType, VoucherStatus, or VoucherNumberSequence models are added to the Prisma schema in Phase 2B.
- The next agent must read the Phase 2B docs before coding any voucher implementation.
- The first voucher schema change must be a deliberate implementation phase after user confirmation.
- Voucher types, numbering format, and overlap decisions remain open questions for Real Capita until confirmed.
- Reports, parties, file uploads, payroll, dashboard analytics, and additional roles remain explicitly out of scope.

## Out-of-Scope Items

Phase 2B does not include:

- Voucher Prisma models or migrations
- Voucher API endpoints
- Voucher UI pages
- Ledger reports, cash book, bank book, trial balance, or financial statements
- Party, customer, or vendor modules
- File upload or attachment infrastructure
- Approval workflow or additional roles
- Payroll or salary modules
- Dashboard analytics
- Business seed data with real transactions
- Code copied from the old ERP prototype
