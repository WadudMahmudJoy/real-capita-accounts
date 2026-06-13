# ADR-0006: Phase 1B Documentation Lock Before Business Schema

## Status

Accepted

## Decision

Before adding business schema/models, lock accounting foundation requirements and acceptance criteria in repository documentation.

## Context

Business modules affect database shape, API boundaries, UI navigation, and future accounting workflows. These decisions are expensive to change after implementation. The project is transitioning from Codex to another agent/tool, so the next implementation must not depend on hidden chat context.

## Consequences

- Phase 1B is documentation/specification only.
- No Company, FiscalYear, AccountingPeriod, Project, CostCenter, Account, CashBank, Voucher, Ledger, Report, Payroll, Party, Dashboard, or additional role models should be added in Phase 1B.
- No Company/FiscalYear/Project/Account models should be added until the user confirms Phase 2A implementation scope.
- The next agent must read the Phase 1B docs before coding.
- The first business schema change must be a deliberate Phase 2A implementation after user confirmation.

