# Droid CLI Phase 2D Next Prompt

Copy this prompt into Droid CLI with GLM 5.1, DeepSeek V4 Pro, or another agent/model when continuing after the Phase 2D documentation lock.

This prompt is for **review only**. Do not implement anything. Do not change schema, API, UI, or seed data.

```text
You are reviewing the Real Capita Accounting & Project Finance System Phase 2D accounting reports requirement lock.

Project path:
D:\real-capita-accounts

GitHub:
https://github.com/MaruflRana/real-capita-accounts

This is a REVIEW-ONLY task. No implementation. No schema changes. No report API endpoints. No frontend report pages.

Start by reading AGENTS.md first.

Then run:
pnpm agent:start

Then read:
- docs/ai/CURRENT_STATE.md
- docs/requirements/phase-2d-accounting-reports-requirement-lock.md
- docs/architecture/phase-2d-report-query-model-proposal.md
- docs/acceptance/phase-2d-acceptance-criteria.md
- docs/decisions/ADR-0008-phase-2d-report-requirement-lock.md
- docs/plans/phase-2d-accounting-reports-implementation-plan.md
- docs/handoff.md

Your task:
1. Review the Phase 2D documents for consistency with the Phase 2C posted voucher workflow.
2. Check that the report query model references the correct Phase 2A and 2C entities (Voucher, VoucherLine, LedgerAccount, AccountGroup, AccountClass, FiscalYear, AccountingPeriod, Project, CostCenter, CashBankAccount).
3. Check that the accounting formulas (debit/credit movement, opening/closing balance, normal-balance-aware presentation) are consistent with the Phase 2A AccountClass normalBalance and LedgerAccount flags.
4. Check that the acceptance criteria are complete and testable.
5. Check that the ADR is consistent with the requirement lock.
6. Verify that prisma/schema.prisma is unchanged (no report tables should exist).
7. Run: git status --short --branch (should be clean).
8. Run: pnpm typecheck, pnpm lint, pnpm check:all, pnpm doctor (all should pass).

Important rules:
- Do not implement any report code.
- Do not add report tables to the Prisma schema.
- Do not create report API endpoints.
- Do not create report UI pages.
- Do not add migrations.
- Do not add business seed data.
- Do not add additional roles.
- Do not add parties/customers/vendors.
- Do not add dashboard analytics.
- Only the ACCOUNTANT role exists.
- This review checks consistency and completeness only.
- Report any inconsistencies, missing references, or unclear specifications.
- Do not make any code changes unless fixing a typo or inconsistency in the documentation files themselves.

If any stop condition fails (dirty git, unexpected schema changes, unconfirmed roles), stop and report before proceeding.
```
