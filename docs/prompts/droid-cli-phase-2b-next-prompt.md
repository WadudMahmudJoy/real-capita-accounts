# Droid CLI Phase 2B Next Prompt

Copy this prompt into Droid CLI with GLM 5.1, DeepSeek V4 Pro, or another agent/model when continuing after the Phase 2B documentation lock.

This prompt is for **review only**. Do not implement anything. Do not change schema, API, UI, or seed data.

```text
You are reviewing the Real Capita Accounting & Project Finance System Phase 2B voucher requirement lock.

Project path:
D:\real-capita-accounts

GitHub:
https://github.com/MaruflRana/real-capita-accounts

This is a REVIEW-ONLY task. No implementation. No schema changes. No voucher code yet.

Start by reading AGENTS.md first.

Then run:
pnpm agent:start

Then read:
- docs/ai/CURRENT_STATE.md
- docs/requirements/phase-2b-voucher-requirement-lock.md
- docs/architecture/phase-2b-voucher-model-proposal.md
- docs/acceptance/phase-2b-acceptance-criteria.md
- docs/decisions/ADR-0007-phase-2b-voucher-requirement-lock.md
- docs/handoff.md

Your task:
1. Review the Phase 2B documents for consistency with the Phase 2A foundation.
2. Check that the voucher model proposal references the correct Phase 2A entities (Company, FiscalYear, AccountingPeriod, Project, CostCenter, LedgerAccount, CashBankAccount).
3. Check that the validation rules are consistent with the Phase 2A LedgerAccount flags (requiresProject, requiresCostCenter, isCashBank, isActive, normalBalance).
4. Check that the acceptance criteria are complete and testable.
5. Check that the ADR is consistent with the requirement lock.
6. Verify that prisma/schema.prisma is unchanged (no Voucher models should exist).
7. Run: git status --short --branch (should be clean).
8. Run: pnpm typecheck, pnpm lint, pnpm check:all, pnpm doctor (all should pass).

Important rules:
- Do not implement any voucher code.
- Do not add Voucher, VoucherLine, VoucherType, VoucherStatus, or VoucherNumberSequence to the Prisma schema.
- Do not create voucher API endpoints.
- Do not create voucher UI pages.
- Do not add migrations.
- Do not add business seed data.
- Do not add additional roles.
- Do not add parties/customers/vendors.
- Do not add reports or dashboard analytics.
- Only the ACCOUNTANT role exists.
- This review checks consistency and completeness only.
- Report any inconsistencies, missing references, or unclear specifications.
- Do not make any code changes unless fixing a typo or inconsistency in the documentation files themselves.

If any stop condition fails (dirty git, unexpected schema changes, unconfirmed roles), stop and report before proceeding.
```
