# Sprint 7H-B gateway timeout and ambiguity acceptance

2026-11-06 (Asia/Dhaka). **PASS for the focused source correction and isolated tests.**
Branch Joy; accumulated uncommitted Sprint 7F/7G/7H-A work preserved. No deployment
or genuine operational acceptance is implied.

## Failure scenario and correction

The gateway's 10-second socket timeout covered database work before Resend, whose
own full request timeout was also 10 seconds, and delivery bookkeeping afterwards.
A valid delayed private operation could therefore commit/deliver while the gateway
reported `No authority was granted`. Connection/acknowledgment loss after other
privileged commands had the same reporting defect. Incomplete response handling
also relied on error events rather than explicitly handling abort/partial close.

The gateway now permits an absolute 120 seconds for mutation transport and 15
seconds for readiness/preparation, alongside socket inactivity protection. Resend's
10-second abort budget is unchanged and named as a constant. Readiness is a separate
preflight. Pool acquisition remains five seconds in the private host; SQL transaction
statement_timeout remains 15 seconds per statement. Broker requestTimeout=20s and
headersTimeout=10s limit incoming request reception, not asynchronous processing.
There is no aggregate guarantee that worker work ends when the gateway times out.

Lost, aborted, truncated, invalid or oversized responses and unconfirmed 5xx results
for commands/claims return HTTP503 with `status=OUTCOME_UNKNOWN`, `retryable=false`
and `recovery=AUTHORIZED_READ_ONLY_RECONCILIATION_REQUIRED`. The message states that
the private operation may have committed and forbids automatic retry/reissue.
Complete explicit 400/401/403/409/429 broker denials retain their status. Timers are
cleared on settlement, and abort/incomplete-close paths settle without waiting for
an acknowledgment that will never arrive. Malformed INVITE classifications are also
ambiguous rather than successful.

Command ambiguity includes a SHA256 nonce digest for correlation to the durable
onboarding nonce/audit. It does not expose a capability, proof signature, password,
provider exception or routing data, and confers no read permission. Claim ambiguity
does not echo/hash the claim bearer into responses. The ordinary gateway adds no
retry, cancellation or direct SQL access. Workers continue their committed lifecycle
and bookkeeping after caller disconnection. INVITE hash-only storage, single-use,
expiry, explicit cancellation/reissue, idempotency and durable audits are unchanged.
All other privileged mutation commands use the same conservative reporting path.

## Authorized reconciliation

The [private operation procedure](../operations/leadership-onboarding-private-execution.md)
now documents an existing authorized operator using BEGIN READ ONLY, verifying the
database/operator, matching original actor/session/command/payload against the nonce
digest, locating an INVITE audit's invitation ID, and reading lifecycle/delivery
history. Authority operations use the original request ID/idempotency key and
immutable request/audit history, followed by existing authorized state reads.
No new endpoint, role, grant or permission rule was added.

An absent receipt while the worker may still run is not evidence of no change.
Keep the result unresolved until authorized observation establishes completion or
operational quiescence and reviews durable history. Do not terminate workers, retry,
activate accounts or change authority based on the error/digest. Only explicit
independently approved cancellation/reissue may replace a lost invitation capability.

## Focused verification

The first real mTLS regression failed against Sprint 7H-A at the expected assertion:
`Ambiguity never claims no change; automatic retry forbidden`. It used a committed
invitation and accepted fake-provider response, then dropped the actual broker
connection before acknowledgment. Corrected code passes.

`pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/verify-onboarding-postgres.ts`:
PASS on task-owned PostgreSQL 17, with **374** signed-executor/authenticated HTTP
onboarding assertions (including **78 new real HTTPS/mTLS gateway assertions**) and
**44 additional HR-to-MD** PostgreSQL/HTTP assertions. Curated 18-to-19 upgrade (15
omitted), 62 existing-table fingerprints, 19 exact migration checksums and Prisma
projected-schema parity passed. Task-owned container/build/certificate cleanup passed.

The new fixture uses the real gateway configuration/readiness/send/parser, real
pinned-client loopback TLS1.3/mTLS broker, real private executor/SQL and synthetic
signed identities. Only Resend transport is redirected to a local HTTPS fake using
temporary synthetic certificates; no public provider traffic occurs. It covers:

- A real 9200ms provider delay plus 1200ms database delay, producing a valid response
  beyond the old 10-second gateway budget through the default production gateway.
- Provider acceptance followed by a dropped broker acknowledgment; the link and
  DELIVERY_ACCEPTED event remain durable.
- The authenticated Nest HTTP API returning the same structured503 ambiguity through
  the actual gateway transport, without mocking gateway.send.
- Same-proof replay and a fresh-proof duplicate INVITE rejected409 with no extra
  provider send; claim through actual gateway succeeds without account activation.
- Connection interruption while delivery is pending and a truncated broker response.
- A shorter **test-only** gateway deadline (2s) while the worker continues a 3s provider
  response; committed invitation and accepted bookkeeping survive client timeout.
  Only the protected deadline is overridden; send/TLS/parser remain production code.
- The real 10-second provider abort returning confirmed ISSUED with delivery UNKNOWN
  inside the larger gateway budget; the otherwise valid claim remains usable.
- A committed AGM-authorized ROLE_CREATE whose acknowledgment is lost; the gateway
  reports ambiguity, read-only nonce/request checks establish APPLIED, and duplicate
  replay cannot create another role.
- No automatic mutation resubmission, stable per-invitation provider keys and no
  plaintext capability in persisted invitation snapshots.

Additional focused checks:

- `scripts/verify-onboarding-api.ts`: 30 PASS; malformed classifications now assert
  OUTCOME_UNKNOWN/non-retryable. Existing acceptance/unknown filtering retained.
- `scripts/verify-onboarding-private.ts`:PASS proof binding, commit-before-send,
  delivery sanitization and actual mTLS access checks.
- `scripts/verify-onboarding-access.ts`: 41 PASS offline; payroll approval: 8 PASS
  in-memory transaction doubles. These do not establish genuine business activation.
- Workspace `pnpm typecheck`, explicit TypeScript checking of the new fixture and
  API tests, targeted ESLint on gateway/delivery, and `git diff --check`:PASS.

## Exact files changed since Sprint 7H-B start

- apps/api/src/onboarding/onboarding.gateway.ts
- apps/api/src/onboarding/private/delivery.ts
- scripts/onboarding-gateway-acceptance.ts (new)
- scripts/onboarding-lifecycle-acceptance.ts
- scripts/verify-onboarding-api.ts
- docs/operations/leadership-onboarding-private-execution.md
- docs/hr-admin/sprint7hb-gateway-timeout-acceptance.md (new)
- docs/handoff.md

Executor, broker, private host, all permission/MD/AGM/HR approval implementations,
Prisma schema and **all 20 migration SQL files** retain their starting bytes. Existing
uncommitted files outside the above allowlist also retain their starting bytes.

Migration20 was not changed. Its exact SHA256 remains:
`f84a86e2acdef437cae5dc9fb36a418e82ad63b338d7c30032906720a0a1d4be`

## Boundaries and remaining limitations

No salary-dev access/writes, migration15/20 deployment, applied-migration change,
real email, genuine activation, protected DB/Aafiyat access, Git reset/clean/commit/
push/merge/branch switch or unrelated feature development. All identities and
provider traffic in acceptance are synthetic/local. Branch Joy preserved.

Network/proxy failures can always leave an outcome unresolved; the longer budget
reduces avoidable ambiguity but cannot prove rollback. Reconciliation remains a
manual, already authorized read-only operator procedure; no automatic reconciliation
or retry service exists. Genuine provider delivery, production proxy/service budgets
and private OS enrollment were not exercised. No real activation/deployment/browser
acceptance is claimed. Stop after this focused correction.
