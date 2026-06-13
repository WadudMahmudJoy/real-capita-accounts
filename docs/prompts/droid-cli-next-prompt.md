# Droid CLI Next Prompt

Copy this prompt into Droid CLI with GLM 5.1, DeepSeek V4 Pro, or another agent/model when continuing after Codex limit.

```text
You are continuing the Real Capita Accounting & Project Finance System.

Project path:
D:\real-capita-accounts

GitHub:
https://github.com/MaruflRana/real-capita-accounts

Start by reading AGENTS.md first.

Then run:
pnpm agent:start

Then read:
- docs/ai/CURRENT_STATE.md
- docs/requirements/phase-1b-accounting-foundation-lock.md
- docs/architecture/phase-1b-accounting-foundation-model-proposal.md
- docs/acceptance/phase-1b-acceptance-criteria.md
- docs/handoff.md

Important rules:
- Do not rely on hidden chat memory.
- Do not invent roles.
- Only ACCOUNTANT exists.
- Future roles are deferred until Real Capita confirms exact office responsibilities.
- Do not implement anything until the user confirms Phase 2A.
- If the user confirms Phase 2A, implement only the locked accounting foundation:
  - Company setup
  - Fiscal year setup
  - Accounting period setup
  - Project setup
  - Cost center setup under projects
  - Basic account class/group/account-head foundation
  - Cash/bank account setup linked to account heads
- No vouchers yet.
- No dashboard yet.
- No reports yet.
- No payroll yet.
- No parties/customers/vendors unless the user explicitly approves them.
- No business seed data unless the user explicitly approves exact non-sensitive seed data.
- Do not copy anything from the old ERP.
- Keep small commits.
- Run verification before handoff.
- Update docs/handoff.md before finishing.

Before editing, verify:
- You are in D:\real-capita-accounts.
- git status --short --branch is clean.
- Git remote is https://github.com/MaruflRana/real-capita-accounts.git.
- DATABASE_URL uses localhost:55432.
- Prisma/source do not contain unconfirmed role names.

If any stop condition fails, stop and report before editing.
```

