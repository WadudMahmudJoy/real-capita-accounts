# Sprint 7H-A invitation delivery acceptance

2026-11-06 (Asia/Dhaka). **PASS for the focused source fix and isolated verification.**
Branch Joy; HEAD 9b3e93678385c79028b88ff38c731b4d572af05d. Existing Sprint7F/7G work preserved.
This does not authorize deployment or genuine leadership activation.

## Root cause

The executor invoked external `delivery.send` inside the uncommitted invitation transaction. Email could escape a later failed COMMIT; provider failure rolled back the invitation. SQL labelled creation DELIVERED and used that state for claiming, and repeated INVITE silently cancelled old invitations. The ordinary gateway always returned ACCEPTED, hiding delivery uncertainty.

## Updated sequence and outcomes

Verify independently signed command and current session/authority; generate a random 256-bit capability; persist only its SHA-256 hash and invitation metadata; COMMIT successfully; release the connection; call Resend; use a fresh connection to append a bounded delivery event; return sanitized issuance/delivery classification. The capability exists only in memory and the email fragment. No plaintext-bearing outbox or token recovery store exists.

Claim lifecycle is ISSUED / CONSUMED / CANCELLED. Separate immutable onboarding events record DELIVERY_ACCEPTED or DELIVERY_UNKNOWN. ACCEPTED means provider acceptance, never confirmed inbox delivery. Bookkeeping cannot mutate claim eligibility. The unchanged Resend adapter retains `invitation-<invitationId>` idempotency keys.

| Failure | Result and recovery |
| --- | --- |
| Failed COMMIT | Sanitized command error, no email attempt or misleading success/delivery event. Reconcile durable state if acknowledgement was ambiguous. |
| Provider 500, timeout, malformed/lost response | Durable ISSUED invitation; deliveryStatus UNKNOWN. No automatic cancellation or retry; received link remains claimable until expiry, explicit cancellation or consumption. |
| Accepted mail; bookkeeping failure | ISSUED, deliveryStatus ACCEPTED, deliveryRecorded false. Durable INVITE event anchors private reconciliation; otherwise valid link remains usable. |
| Crash between commit and delivery | ISSUED without delivery event is unresolved. Never infer delivered/not delivered. No automatic resend. |
| Repeated/concurrent INVITE | Existing issued invitation preserved; conflict/serialization rejection. Explicit audited CANCEL then fresh independently authorized INVITE creates a new capability, ID and provider key. |

Lost capabilities cannot be reconstructed. Inspect invitation/event metadata privately and reconcile provider activity by invitation idempotency key. If replacement is needed, obtain fresh independent approval for explicit cancellation and subsequent issuance. Even expired issued invitations require cancellation before reissue. Reconciliation SQL and steps are in the [private execution procedure](../operations/leadership-onboarding-private-execution.md).

CANCEL now requires INITIAL_REGISTRAR signed assurance. Before any MD mandate has existed, only the authenticated issuing registrar may cancel their own invitation with fresh independent proof; another registrar cannot. Once any MD mandate exists, only a live MD may cancel. Future issuer configuration must explicitly allow this assurance for CANCEL. This bounded bootstrap recovery grants no activation or MD authority. Independent appointment, attestation, activation, specialized grants, HR-to-MD and payroll business rules remain unchanged.

## Verification

- Original executor failed the regression requiring COMMIT and connection release before the provider callback. The corrected executor passes.
- `pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/verify-onboarding-postgres.ts`: PASS, task-owned PostgreSQL17 only. Curated 18-to-19 migration upgrade (15 omitted); 62 existing-table fingerprints preserved; 19 exact migration checksums and Prisma projected-schema parity passed. **296** signed-executor/authenticated HTTP onboarding assertions, including **64** delivery/recovery assertions; **44 additional** HR-to-MD PostgreSQL/authenticated HTTP assertions. Task container and temporary build artifacts cleaned up.
- `scripts/verify-onboarding-private.ts` via tsx: PASS ordering/release, failed COMMIT no send, committed provider500/timeout, unknown no cancellation, failed bookkeeping, signed proofs and actual TLS1.3/mTLS. Generated capabilities absent from SQL parameters, response and captured console channels.
- `scripts/verify-onboarding-api.ts`: **30 PASS**. All ACCEPTED/UNKNOWN x recorded/unrecorded combinations, internal routing/capability filtering, and malformed result rejection. Actual authenticated HTTP unknown/accepted responses also traverse the production gateway mapper in PostgreSQL acceptance.
- `scripts/verify-onboarding-access.ts`: **41 PASS**. Pending-user service regression PASS. These are offline doubles.
- `scripts/verify-payroll-approval.ts`: **8 PASS**, in-memory transaction doubles. `scripts/verify-authority-contract.ts`: PASS. `scripts/verify-leave-md-contract.ts`: **19 PASS**, offline contract assertions.
- `pnpm prisma:generate`, `pnpm exec prisma validate`, workspace `pnpm typecheck`, explicit TypeScript checking of focused regression scripts, targeted ESLint on four changed API modules, and `git diff --check`: PASS.
- Migrations1-19: all 19 SQL files byte-for-byte unchanged against the starting SHA-256 manifest, including deferred15. Payroll/leave implementation and all pre-existing files outside the changed allowlist retain their starting bytes.

| Mandatory cases | Evidence |
| --- | --- |
| 1-3 order and COMMIT success/failure | Mock callback requires commit+release; real deferred PostgreSQL failure occurs at COMMIT; successful issued mail acceptance tested. |
| 4-5 provider failure/unknown | Committed rows survive mocked500 and accepted-but-response-lost; repeats rejected without another send; lost-response capability successfully claimed. |
| 6 bookkeeping failure | Trigger rejects DELIVERY_ACCEPTED insertion; INVITE remains durable and same link claims without activation. |
| 7-9 cancel/reissue/old rejection | Fresh signed cancellation rejects old capability; new ID/hash/capability and successful replacement claim; both actions audited. |
| 10 uniqueness | Two distinct simultaneous signed proofs produce one invitation/send; independent active-invitation and token-hash unique-constraint probes. |
| 11 no plaintext persistence/logging | Generated capabilities absent from SQL parameters, returned results, captured console channels and persisted invitation/user/nonce/audit/event snapshots; provider exception containing a capability sanitized. |
| 12-13 no activation/independent MD | Claimed users remain inactive; existing appointment, attestation, self-review, bootstrap and replay denials pass. |
| 14 HR-to-MD/payroll | 44 PostgreSQL/HTTP leave assertions, 19 offline contract checks, eight payroll transaction-double checks, unchanged implementation bytes. |

## Migration20 checksum

Changed in source only; remains unapplied on salary-dev. Prior reviewed SHA256 `1bd809c753286020a5f32c343acf9263db034b8f8cd96b7cfd551bb0552bfdab` is superseded and must not be used.

New exact-file SHA256:
`f84a86e2acdef437cae5dc9fb36a418e82ad63b338d7c30032906720a0a1d4be`

SQL retains one issued invitation per user, unique hashes, expiry and immutable single-use/cancel transitions. New `onboarding_record_delivery(text,text)` is revoked from PUBLIC and narrowly granted only to the private executor. Ordinary runtime execution is denied by acceptance. It accepts only ACCEPTED/UNKNOWN and cannot change invitation state. No table/column writes or direct authority-command privileges were added.

## Exact files changed in this sprint

Relative to the starting working tree, not HEAD:

- apps/api/src/onboarding/private/executor.ts
- apps/api/src/onboarding/private/assurance.ts
- apps/api/src/onboarding/onboarding.gateway.ts
- apps/api/src/onboarding/onboarding.service.ts
- prisma/migrations/20261020000000_secure_leadership_onboarding/migration.sql
- prisma/schema.prisma
- scripts/db/onboarding-privileges.ts
- scripts/verify-onboarding-private.ts
- scripts/verify-onboarding-api.ts
- scripts/onboarding-lifecycle-acceptance.ts
- scripts/onboarding-delivery-acceptance.ts (new)
- docs/operations/leadership-onboarding-private-execution.md
- docs/hr-admin/sprint7ha-invitation-delivery-acceptance.md (new)
- docs/handoff.md

`delivery.ts` and `verify-onboarding-postgres.ts` are unchanged from the starting tree, included as review context. Earlier Sprint7F/7G changes are preserved.

## Safety, remaining limitations and package

No real emails sent. No salary-dev access/modification, protected database/Aafiyat access, genuine MD/AGM/HR activation, deployment or Git pull/reset/clean/commit/push/merge/switch. Migration15 remains deferred; migration20 installed only in disposable acceptance databases.

Genuine provider delivery, independent human ceremonies and private OS/database enrollment remain operational prerequisites. No browser acceptance claimed for this source fix. Existing UI shows generic operation completion; the API provides explicit delivery classification. No automatic reconciliation/resend job exists. Lost in-memory capabilities require controlled cancellation and new issuance. Provider acceptance with lost response is intentionally UNKNOWN.

The independent source review ZIP is retained outside Git. Focused source subset, related SQL/tests/docs, review instructions and per-file SHA256 manifests; adjacent `.zip.sha256` records archive checksum. Excludes environment files, real credentials/keys, database rows/dumps, dependencies, builds and raw logs. Requires the full repository to execute.

Stop after this fix and verification; no automatic next sprint or deployment.
