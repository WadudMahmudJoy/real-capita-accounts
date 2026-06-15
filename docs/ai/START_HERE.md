# Start Here

This file is the first stop for any AI agent or developer continuing the Real Capita Accounting & Project Finance System.

## Current Status

Phase 0 is complete and accepted. Phase 1A adds multi-agent continuity plus single-accountant authentication.

Phase 1A is implemented in this repository.

Phase 1B documentation/specification lock is complete. Phase 2A accounting foundation is implemented and accepted.

Phase 2B voucher requirement documentation/specification lock is complete. Phase 2C voucher implementation is complete and accepted.

Phase 2D accounting reports implementation is complete and accepted. All six backend report APIs, all six frontend report pages, and the browser print foundation are implemented.

Phase 2E MFS / bKash transaction support requirement lock is complete. No runtime MFS implementation exists yet. No schema, API, UI, or report behavior has changed.

The only confirmed role is `ACCOUNTANT`, displayed as `Accountant`. It represents AGM sir as the main accounting operator for now. Do not add other roles until Real Capita confirms exact responsibilities.

## Where To Look First

1. `AGENTS.md` for project rules and strict boundaries.
2. `docs/ai/CURRENT_STATE.md` for implemented and non-implemented scope.
3. `docs/ai/WORKFLOW.md` for safe agent workflow.
4. `docs/handoff.md` for the latest project handoff.
5. `prisma/schema.prisma` for the current database model.
6. `apps/api/src` and `apps/web/src` for implementation.
7. `docs/requirements/phase-2d-accounting-reports-requirement-lock.md` before any report-module coding.
8. `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md` before any MFS implementation.
9. `docs/prompts/phase-2d-next-prompt.md` if continuing in Droid CLI or another agent.

## Local Setup

```powershell
cd D:\real-capita-accounts
git pull --ff-only
git status --short --branch
pnpm install
Copy-Item .env.example .env
docker compose up -d postgres
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
```

## Verification

```powershell
pnpm check:all
pnpm doctor
```

Manual auth verification:

- Start the API with `pnpm dev:api`.
- Start the web app with `pnpm dev:web`.
- Visit `/login`.
- Sign in with `accountant@realcapita.local` and `ChangeMe123!`.
- Confirm `/app` shows the user and the Accountant role.

## If Previous AI Context Was Lost

Do not rely on hidden chat memory. Reconstruct state from this repo:

1. Run `pnpm agent:start`.
2. Read `docs/ai/CURRENT_STATE.md`.
3. Check `git log --oneline --max-count=8`.
4. Check `git status --short --branch`.
5. Continue only from documented requirements.

If continuing after Codex limit in Droid CLI, GLM, DeepSeek, Opus, Gemini, or another tool, read `docs/plans/phase-2e-mfs-bkash-support-implementation-plan.md` and `docs/requirements/phase-2e-mfs-bkash-support-requirement-lock.md` before coding.
