# Phase 2C Chunk 1: Voucher Schema Prompt

Copy this prompt into Droid CLI with GLM 5.1, DeepSeek V4 Pro, or another agent/model when implementing Chunk 2C-1.

This prompt is for **schema implementation only**. No API, no frontend, no posting service.

```text
You are implementing the Real Capita Accounting & Project Finance System Phase 2C Chunk 1: voucher schema.

Project path:
D:\real-capita-accounts

GitHub:
https://github.com/MaruflRana/real-capita-accounts

This is a SCHEMA-ONLY task. No API, no frontend, no posting service, no reports.

No new roles. No parties/customers/vendors. No file uploads.

Start by reading AGENTS.md first.

Then run:
pnpm agent:start

Then read:
- docs/ai/CURRENT_STATE.md
- docs/plans/phase-2c-voucher-implementation-plan.md
- docs/requirements/phase-2b-voucher-requirement-lock.md
- docs/architecture/phase-2b-voucher-model-proposal.md
- docs/acceptance/phase-2b-acceptance-criteria.md
- prisma/schema.prisma ( to see existing models and relations)

Important rules:
- Implement schema only. Do not add API endpoints, NestJS modules, or frontend pages.
- Do not add posting service logic.
- Do not add reports logic or trial balance, ledger, cash book, bank book, or financial statements.
- Do not add new roles. Only ACCOUNTANT exists.
- Do not add party/customer/vendor references in VoucherLine.
- Do not add file upload or attachment infrastructure.
- Do not add reversal/correction fields on Voucher (reversalOfVoucherId, correctionOfVoucherId are deferred).
- Do not add business seed data.
- Preserve all existing Phase 2A models and Company, FiscalYear, AccountingPeriod, Project, CostCenter, AccountClass, AccountGroup, LedgerAccount, CashBankAccount, User, Role, UserRole, AuthSession, AuditEvent).
- Add VoucherType enum, VoucherStatus enum, Voucher model, VoucherLine model, VoucherNumberSequence model.
- Add relation fields on existing models: Company.vouchers, Company.voucherNumberSequences, FiscalYear.vouchers, FiscalYear.voucherNumberSequences, AccountingPeriod.vouchers, LedgerAccount.voucherLines, Project.voucherLines, CostCenter.voucherLines, CashBankAccount.voucherLines, User.createdVouchers, User.postedVouchers.
- Add soft-delete fields on Voucher: isDeleted Boolean @default(false), deletedAt DateTime?.
- Follow the exact model specification in docs/architecture/phase-2b-voucher-model-proposal.md.

After schema changes, run:
pnpm prisma:generate
pnpm prisma:migrate dev --name add_phase_2c_voucher_schema_foundation

Then run full verification:
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
docker compose config
pnpm check:all
pnpm doctor

All must pass.

Commit message:
feat: add phase 2c voucher schema foundation

Include:
Co-authored-by: Md. Wadud Mahmud Joy <wadudjoy24@gmail.com>

Do not proceed to Chunk 2C-2 ( backend draft voucher API ) until Chunk 2C-1 is accepted, verification passes, working tree is clean, and user confirms the next chunk.

Before starting:
- git pull --ff-only
- git status --short --branch ( must be clean )
- User must confirm Phase 2C Chunk 2C-1 implementation
- DATABASE_URL must use localhost:55432
- No unconfirmed role should exist in schema, seed data, source, or database
```
