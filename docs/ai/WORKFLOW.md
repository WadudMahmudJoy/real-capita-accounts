# Agent Workflow

## Before Editing

1. Confirm the project path is `D:\real-capita-accounts`.
2. Run `git pull --ff-only`.
3. Run `git status --short --branch`.
4. Read `AGENTS.md`, `docs/ai/CURRENT_STATE.md`, and `docs/handoff.md`.
5. Confirm the work is inside the current phase.

## During Work

- Make small, logical commits.
- Keep code aligned with the existing stack.
- Use Prisma models only for confirmed requirements.
- Treat the backend as the authority for auth, authorization, and future accounting rules.
- Never invent requirements.
- Never add roles without confirmed instruction.
- Never build outside the phase boundary.
- Never copy code or data from the old ERP.
- Never add real sensitive data.

## Verification

Run the standard checks before handoff:

```powershell
pnpm prisma:generate
pnpm typecheck
pnpm lint
pnpm build:web
pnpm build:api
docker compose config
pnpm check:all
pnpm doctor
```

For auth work, also verify login, `/auth/me`, logout, `/login`, and `/app`.

## Handoff

Before ending a session:

1. Update `docs/handoff.md`.
2. Run `git status --short --branch`.
3. Leave the working tree clean unless explicitly handing off unfinished work.
4. Record commands run, known caveats, and next recommended task.

