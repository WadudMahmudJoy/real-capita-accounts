> Follow-up: Task 002E-2C-1 now implements and isolated-tests credential/privilege separation. See [PostgreSQL operational contract](../operations/postgresql-privilege-separation.md). Existing salary-dev remains unchanged and requires separately authorized rollout; this earlier review is retained as history.

# HR-3B Task 002E-2B-FINAL — final integrity correction

Date: 2026-10-14. **FIX REQUIRED for deployment readiness: runtime database privilege acceptance is BLOCKED.** Timestamp/delegation/schema integrity checks PASS. This section supersedes the earlier review verdicts retained below. The payment migration remains UNAPPLIED to salary-dev; no deployment authorization is implied.

## Timestamp contract

Existing TIMESTAMP(3) WITHOUT TIME ZONE storage is retained; all payment timestamps represent UTC civil time. New payment defaults use (clock_timestamp() AT TIME ZONE 'UTC'), not transaction-start CURRENT_TIMESTAMP. Expiry comparisons explicitly convert the wall clock to UTC after required locks; event future checks use matching millisecond precision. Source approval now locks the source before checking delegate expiry. Application grant expiry input requires canonical UTC ISO strings with milliseconds and Z, rejecting timezone-less/invalid dates. Direct SQL provisioning must also submit UTC civil timestamps; a naive timestamp cannot encode or prove its originating timezone.

Chronology guards require delegate authorization >= request, revocation >= request >= designation, source action >= grant, decision >= action, cancellation request >= batch, cancellation decision >= request, and verification/confirmation >= batch creation. Future decision timestamps and expiry <= authorization are rejected. Dedicated immutable records carry authoritative lifecycle event timestamps; generic AuditEvent's legacy transaction-start timestamp is only a summary timestamp, not evidence of the decision instant. No applied migration or existing accounting timestamp representation changed.

## Durable delegate lifecycle

PayrollFinanceDelegate now has generation, request/authorization timestamps and distinct initiating/reviewing user references. Company/user/generation is unique. A locked scope rejects overlapping authority and retrospective overlap; immutable PayrollFinanceDelegateRevocation stores independently reviewed revocation and chronology with restrictive identity FKs. Expired/revoked designations remain preserved; a separately authorized new generation is possible only after the old effective interval ends. Current authority is the latest generation, within UTC expiry and without revocation. Revocation/expiry blocks future finance-user operations; it does not fabricate cancellation, release or reversal of payment instructions. Existing account grants have their own preserved revocation/expiry contract.

There is no delegate provisioning endpoint or trusted business designation adapter. ACCOUNTANT status and reference text never authorize such an application operation. Production PayrollPaymentAuthority remains fail-closed. SQL validates durable identities/chronology but cannot authenticate the human decisions; designation insertion belongs solely to a separately trusted provisioning connection.

## Database privilege gate — BLOCKED

Read-only inspection independently verified localhost:55532/current_database = real_capita_accounts_salary_dev. PrismaService uses the single DATABASE_URL identity. That configured identity is superuser, database/table owner, CREATE ROLE/CREATE DATABASE capable and BYPASSRLS capable. It could insert its own authority records, impersonate recorded user IDs, disable triggers or alter schema. The migration explicitly revokes PUBLIC authority-table INSERT/UPDATE/DELETE/TRUNCATE, but that cannot restrict an owner/superuser.

Required remedy before deployment: separate migration/provisioning ownership credentials from a non-owning runtime identity. Runtime must have no superuser, role/database creation, BYPASSRLS, schema CREATE/ALTER, trigger-disabling or authority-provisioner membership. It may read delegation/revocation records but must not INSERT/UPDATE/DELETE/TRUNCATE them. Grant/action/cancellation business writes remain trusted-backend operations with verified session identity and external authority adapters; ordinary direct SQL cannot prove external authorization/settlement. Trigger functions remain SECURITY INVOKER, with no new elevated execution path. No runtime/provisioning credential separation currently exists; changing shared server roles or credentials would exceed this isolated correction. No real role, permission or delegate was provisioned.

## Actual verification

36 isolated PostgreSQL acceptance check groups PASS: real salary/attendance/payroll workflows and prior financial/reservation/source-drift/rollback/concurrency regressions, 16 direct SQL rejection probes, UTC defaults/input round-trips and long transactions in UTC/Asia-Dhaka/America-New_York, delegate expiry during a held account-lock wait, original grantor self-review rejection, impossible event chronology, immutable revocation/expiry/re-designation history, conflicting designation writers and denied authority INSERT under pg_read_all_data. SET LOCAL ROLE was confined to the disposable database transaction; no cluster roles/memberships were created. All authority fixtures are isolated synthetic technical data, not real delegation or payment evidence. Positive CONFIRMED lifecycle remains SKIPPED; rejected chronology probes retained zero confirmations.

Prisma schema validation, generated schema/migration parity, foundation contracts, API/verifier TypeScript, targeted API lint and diff checks pass. Offline checks: 10 lifecycle/input/adapter, 7 preparation and 20 read/auth groups. Each disposable database was removed only after exact identity/ownership/marker and zero-session verification; safe-source business counts unchanged. The migration was not applied to salary-dev.

## Exact files changed by this correction

- prisma/schema.prisma
- prisma/migrations/20261014000000_payroll_payment_foundation/migration.sql
- apps/api/src/payroll/payroll-payment-lifecycle.service.ts
- scripts/payroll-payment-schema.ts
- scripts/review-payroll-payment-integrity.ts
- scripts/verify-payroll-acceptance.ts
- scripts/payroll-payment-direct-probes.ts
- scripts/verify-payroll-payment-lifecycle.ts
- scripts/payroll-payment-final-integrity.ts (new)
- docs/architecture/hr-3b-payment-migration-review.md

Remaining gates: reviewed least-privilege runtime/provisioning separation, genuine delegate designation and trusted non-disbursement/settlement evidence adapters. No Task 002E-2C, paid transition, transfer, receipt or voucher work began.

---

# HR-3B Task 002E-2B — payment integrity corrections

Current date: 2026-10-14. **PASS for independent migration review**, subject to the explicit authority and confirmation-acceptance gates below. This supersedes the 002E-2A findings retained later in this document. Payment migration remains unapplied to salary-dev; deployment requires separate authorization.

## Six findings and resolution

| Finding | Implemented resolution | Remaining boundary |
|---|---|---|
| No durable grant lifecycle | Immutable pending grant, APPROVE/REVOKE action and independent decision records; restrictive actor FKs; scoped increasing generations. Only the highest generation ever approved can authorize; expiry/revocation never restores an older grant. | No real delegates designated; no delegate provisioning endpoint. |
| Abandoned PREPARED reservations | Immutable instruction history separated from one versioned reservation per obligation/channel. PREPARED -> CANCELLED requires a matching independent decision; atomic release then permits a new full allocation. CONSUMED can never change or release. | No auto-expiry or deletion to free reservations. Real cancellation remains blocked by evidence authority. |
| Transaction-start expiry | Protected grant checks use clock_timestamp after parent/source/ledger/run/obligation locks as applicable. Expiry is checked again at each protected insertion/transition. | Future confirmation must use the same transaction contract. |
| Unlocked related SQL reads | Parent serialization, source/ledger locks, approved-run lock and obligation locks; deferred coverage/totals; unique request/reservation keys. Serializable service operations map PostgreSQL adapter conflicts as well as Prisma conflicts. | Arbitrary privileged SQL can disable safeguards; deployment must review runtime privileges. |
| Claimed actor/evidence authority | Production PayrollPaymentAuthority returns no delegation or evidence proof. Operations also require active ACCOUNTANT plus explicit persisted initiate/review designation. Separate reviewers, immutable dedicated decisions and atomic generic audit. | SQL checks identities, permissions and structural provenance, not external truth. No authoritative designation registry or non-disbursement source exists. |
| Unbound material source | Database-managed company authority, fund-master and ledger revisions plus server-generated immutable source snapshot/hash. Material changes, including A-to-B-to-A, invalidate grants. Display names/branding do not alter financial authority. | Reauthorization is independent; it does not authorize an actual transfer. |

## Exact revised persistence contract

The additive migration now has four enums, ten new tables and three default-1 revision columns on Company, CashBankAccount and LedgerAccount. Earlier migrations are unchanged. Prisma generated delta matches tables, indexes, columns and restrictive FKs; manual CHECKs/triggers are tested independently.

- Grant uniqueness: (companyId, sourceAccountId, channel, generation); action uniqueness: (grantId, kind), with unique idempotency key; one decision per action.
- Instructions: (batchId, payrollRunLineId, channel) unique; reservation: (payrollRunLineId, channel) and current lineId unique. No all-history deletion is needed for release.
- Batch/line money remains positive DECIMAL(18,2). SQL requires the exact full approved channel allocation and exact captured obligation snapshot. Deferred checks require nonempty coverage and exact sum = batch total; HELD/CONSUMED reservation coverage must match PREPARED/CONFIRMED status.
- State transitions only PREPARED -> CANCELLED or paired future CONFIRMED, with version+1 and all original instruction fields unchanged. Cancellation request retains expected version, initiator and proposed reference; separate decision retains reviewer, digest, authority, verification time and audit. No request alone releases anything.
- Grant/action/decision/instruction/confirmation/cancellation history cannot UPDATE, DELETE or TRUNCATE through enabled guards. Reservation deletion is prohibited; holder changes only after authorized cancellation. Dedicated restrictive actor FKs preserve attribution even though generic AuditEvent alone has weaker retention.
- Confirmation metadata remains a future-only schema contract. No confirmation endpoint/service, actual confirmation row or payment was created. External transfer or signed receipt verification requires a genuine trusted adapter and independent attestation; stale PREPARED batches need reconciliation, not an invented reversal.

## Implemented lifecycle services

PayrollPaymentLifecycleService supports reusable grant request, revocation request, source-action review, cancellation request and independent cancellation review. It is not exposed through new routes. Identity comes from the server's authenticated-user contract, is rechecked against persisted active ACCOUNTANT permissions, and must be verified by the trusted provider and designation record. Production provider denies all such operations. Free text is a proposed evidence reference only.

Cancellation verification receives the exact persisted batch, source grant/snapshot and employee-line instructions; a future adapter must bind non-disbursement to those original destinations/amounts and independently exclude settled or pending transfers. Source drift/expiry/revocation does not erase old instructions or release reservations. Atomic decision, status/version, reservations and generic audit either all commit or all roll back. Ordinary account visibility is never a grant.

## Verification and recovery

Branch Joy and HEAD 20cdc5a94e2f24df781e313ab3850a456d913c1c preserved. Recovery found no interrupted payroll verifier, temporary acceptance build directory or leftover disposable database. Read-only current_database verification at localhost:55532 found zero payment-migration entries in salary-dev.

The existing acceptance harness deployed only to its unique template0 disposable database, used genuine salary approval, attendance finalization, payroll creation/approval and document services, then exercised lifecycle services with **isolated synthetic technical delegation/evidence adapters**, never real business authority. Final run: **31 PostgreSQL acceptance checks**, including **16 rollback/savepoint direct SQL rejection probes**. It verified batch concurrency/idempotency, full allocation, zero/partial/excess rejection, expiry within a transaction, source drift, grant maker-checker, revocation/no fallback, cancellation audit rollback, history retention/reuse and concurrent cancellation/create protection. Cleanup confirmed exact database OID/owner/marker and zero sessions before dropping only that database; safe-source business counts remained unchanged.

Positive confirmed-consumption acceptance remains SKIPPED because paid transitions are excluded. Installed immutable CONSUMED guards were reviewed, and SQL attempts to create consumption/confirmation without the paired lifecycle were rejected; no claim of positive settlement or confirmation acceptance is made.

Commands: pnpm verify:payroll:acceptance; pnpm verify:payroll:payment-foundation; pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/verify-payroll-payment-lifecycle.ts. Focused API/verifier type checks, targeted lint and diff checks accompany the final report.

## Files changed for 002E-2B

- prisma/schema.prisma
- prisma/migrations/20261014000000_payroll_payment_foundation/migration.sql
- apps/api/src/payroll/payroll-payment-lifecycle.service.ts (new)
- apps/api/src/payroll/payroll-payment-error.ts (new)
- apps/api/src/payroll/payroll-payment-batch.service.ts
- apps/api/src/payroll/payroll-payment-preparation.service.ts
- apps/api/src/payroll/payroll.module.ts
- apps/api/src/payroll/dto/payroll-payment-batch.dto.ts
- scripts/payroll-payment-schema.ts
- scripts/review-payroll-payment-integrity.ts
- scripts/verify-payroll-payment-foundation.ts
- scripts/verify-payroll-payment-preparation.ts
- scripts/verify-payroll-acceptance.ts
- scripts/payroll-payment-lifecycle-acceptance.ts (new)
- scripts/verify-payroll-payment-lifecycle.ts (new)
- scripts/payroll-payment-direct-probes.ts (new)
- docs/architecture/hr-3b-payment-migration-review.md

## Remaining gates

Independent schema/SQL and runtime-permission review, separately authorized salary-dev deployment, legitimate finance delegate designation/provisioning, trusted non-disbursement verification and later genuine BANK/CASH confirmation authority. No further policy clarification was required for E-H; concrete authority is still absent. Privileged database administrators can disable triggers or alter rows directly. No payment confirmation or accounting workflow is implemented here.

---

## Historical 002E-2A review (superseded by corrections above)

# HR-3B Task 002E-2A — payment migration review

Review date: 2026-10-14. Verdict: **FIX REQUIRED before salary-dev deployment**. Migration/schema/services remain unchanged by this review. The foundation is ready for independent review, not deployment or confirmation. Policies A–D are approved; the operational grant/release authority contracts below are recommendations requiring approval.

## Exact implemented guarantees

| Contract | PostgreSQL guarantee | Application boundary / limitation |
|---|---|---|
| Additive persistence | Two enums, four tables, 12 supporting indexes (four unique), 13 restrictive FKs; new integrity triggers also attach to existing payroll tables. No business data rewrite. Prisma-generated table/index/FK delta matches migration exactly. | Prisma does not model the manual CHECKs/triggers; their review and independent contract tests are required. |
| References | Grant → company/source/user (3); batch → company/run/source/grant/maker (5); line → batch/payroll line/employee (3); confirmation → batch/confirmer (2). All DELETE/UPDATE RESTRICT. | Existence and durable identity are not proof of an authenticated request or authority to grant funds access. |
| Money | Batch total and line amount are DECIMAL(18,2). `payment_batch_amount_check`: positive total, version ≥1, key length 8–128, 64 lowercase hex request hash, object creation audit. `payment_line_amount_check`: positive amount and object obligation snapshot. | Service derives money from approved history; callers cannot submit amounts. SQL validates hash shape, not its semantic relation to a request. |
| Source grants | `payment_grant_guard` requires active PRIMARY, active fund/ledger, cash/bank ledger flag, matching BANK/CASH type, grant time/expiry ordering and audit actor matching the grantor. `payment_grant_audit_check` requires object audit. | No grantor permission/delegation or authenticated-session test exists in SQL; no grant provisioning endpoint exists. Multiple overlapping grants are allowed. |
| Batch creation | `payment_batch_guard` requires PREPARED/version 1, approved PRIMARY payroll, matching unexpired grant, active channel-compatible fund/ledger and active ACCOUNTANT maker. Audit actor matches maker. | `PayrollPaymentBatchService.prepare` adds server-session identity through controller guards, full snapshot/profile validation, canonical payload hash, selection validation, Serializable transaction and atomic generic audit. SQL permits weaker historical evidence than the service. |
| Full allocations | `payment_line_guard` requires obligation/run/batch/channel/employee consistency, positive exact full BANK/CASH allocation and equality of captured identity/profile/amount snapshots. | SQL trusts APPROVED status and stored allocation; it does not independently establish salary/attendance/deduction approval authority or recompute the frozen percentage rule. |
| Reservations | Unique `payroll_payment_lines_payrollRunLineId_channel_key` applies to all instruction rows, including PREPARED and CONFIRMED. Lines cannot be updated/deleted; batches cannot be deleted. | Prevents overlapping/duplicate payments, but abandoned PREPARED batches permanently consume the slot. There is no cancellation/release contract. |
| Totals | `payment_batch_total_guard` and `payment_line_total_guard` are deferred constraint triggers: nonempty lines and exact sum = batch total at transaction end. | No silently partial batch is permitted. Release cannot simply delete a line: it breaks history, uniqueness and totals. |
| Idempotency | Globally unique batch idempotency key; unique confirmation batch/key. | Service hashes sorted employee IDs, run/source/channel and maker; exact replay returns the old batch without rechecking current source expiry. This is retrieval of retained history, not fresh payment authorization. Competing reservations/keys use DB uniqueness; service maps serialization/unique conflicts to controlled conflict. |
| Confirmation separation | Insert requires PREPARED batch, distinct active ACCOUNTANT confirmer, BANK_TRANSACTION or SIGNED_CASH_RECEIPT kind, timestamp ordering and matching audit/attestation actor. Source/PRIMARY activity and captured-grant expiry are checked. `payment_confirmation_state_guard` requires CONFIRMED state at commit; batch guard allows only paired version+1 transition. | No confirmation service/endpoint is implemented. Metadata cannot prove a real transfer, receipt, signer, amount or recipient coverage. Actual confirmation tests are intentionally not performed. |
| Confirmation evidence | `payment_confirmation_evidence_check`: nonblank reference/authority, 64 lowercase hex digest, bounded key, object attestation/audit. Confirmation rows cannot be updated/deleted; CONFIRMED batches cannot reopen or be edited. | Requires trusted evidence validation and restricted access. Nonempty strings/JSON are not verification authority. |
| History | Grant, line and confirmation UPDATE/DELETE triggers reject mutation; batch updates narrowly controlled. Referenced payroll run/line history is guarded from mutation. Embedded actor/audit snapshots retain identities through restrictive FKs. | Generic AuditEvent has nullable actor/metadata and SET NULL identity; it cannot be the sole durable grant/release evidence. Owners/admins can disable triggers or TRUNCATE multiple related tables; ordinary runtime privileges must be reviewed. |

## Deficiencies requiring review

1. **Grant revocation is unrepresentable.** No revocation field/event/current-authority pointer exists; immutable grant UPDATE/DELETE prevents implementing revocation with existing fields. Null-expiry grants persist indefinitely. A new shorter-lived grant does not supersede an older unexpired grant: the service filters valid grants before choosing the newest. Define one current authority per `(PRIMARY, account, channel)` and an auditable supersession/revocation rule; do not assume inserting a second record revokes the first.
2. **Abandoned reservations cannot be released.** PREPARED/CONFIRMED are the only statuses; global instruction uniqueness and immutable rows prevent safely preserving old instructions while assigning their obligation to a new batch. This avoids double payment but can block future payroll permanently. A reviewed lifecycle/schema extension is required.
3. **Expiry is evaluated at transaction start.** Both batch and confirmation guards use CURRENT_TIMESTAMP for expiry. A long transaction can accept a grant after wall-clock expiry. The focused PostgreSQL test reproduces the time-expression discrepancy without inserting a grant or confirmation. The grant insertion timestamp check is millisecond-rounded while the batch grant-start check is not; same-transaction composition also needs consistent precision.
4. **Direct-SQL concurrency safety is incomplete.** The obligation/source guards read related rows without locking them. The application uses Serializable; direct READ COMMITTED SQL could race a snapshot check against an approved-obligation/source change before the reservation becomes visible. This race was identified by code review, not reproduced with business/confirmation fixtures. Add reviewed locking/serialization and final validity checks before claiming a database-wide guarantee.
5. **Authority and evidence are still application obligations.** Direct SQL can name an existing grantor/maker/confirmer and supply matching audit JSON. It can supply syntactically valid evidence references/digests without verifying payment. Likewise, deep historical provenance and payload-hash correctness are application checks. Require controlled writer privileges and an independently verified artifact/manifest contract. Grant provisioning must remain closed meanwhile.
6. **Source grants are not bound to material master-data revisions.** `CashBankService.update` permits BANK/CASH metadata and ledger changes under existing ACCOUNTANT controls; grant/batch records bind the account ID, not its physical bank identifier or configuration revision. Replacing bank details or the linked ledger while keeping that ID/type active can retain the old grant. A fund-master edit must not become an implicit grant to a different physical source. Define material fields and bind authorization to their server-derived revision/digest, with renewed authorization after material changes. Ordinary display-name changes need not require reauthorization if approved as nonmaterial.

Confirmed obligations cannot currently be reused through the supported paths: their immutable instruction remains under the same unique key. No confirmed-payment release or paid transition was simulated to establish this review.

## Minimum recommended lifecycle contracts (not implemented)

- **Grant creation:** authenticated active ACCOUNTANT is a necessary baseline, not provisioning authority. Business owner explicitly delegates create/revoke authority to named existing identities through trusted server-managed permissions/configuration; never client IDs or an automatic role grant. No new role is needed. Record scope, source/channel, material source configuration revision/digest, issuer, server time, reason/evidence and durable immutable audit. Serialize grants by source scope, with one current authority version and explicit supersession. Material bank/ledger changes suspend the affected authority pending regrant; never automatically copy permission onto changed details. Independent grant review is optional policy requiring approval, not an existing requirement.
- **Revocation/expiry:** recommend immediately blocking new preparations and later confirmations using invalid grants, without deleting history or releasing obligations automatically. Revoked/expired PREPARED batches remain held for review. Previously CONFIRMED payments remain consumed forever. Older grants must not reappear as fallback authority. Decide how to record an externally completed transfer whose confirmation is pending when revocation occurs; do not pretend it never happened or reopen its obligation.
- **Cancellation/release:** recommend a maker cancellation request and independent authorized ACCOUNTANT review. Require PREPARED status, expected version, no confirmation/consumption, and independently checked non-disbursement/non-pending-transfer evidence. Absence of a confirmation row alone is insufficient. In one Serializable transaction lock batch, authority and obligation reservations in stable order; confirmation and cancellation must have one winner. Preserve all old lines, snapshots, totals and actor/reason audit.
- **Required storage change:** separate immutable instruction history from current reservation/consumption. Retain a unique employee/payroll-line/channel reservation with versioned holder/state; permit reallocation only after a reviewed release event. Once consumed, it becomes immutable and cannot be released. Alternatively use separate active-reservation and permanent-consumption records. Replace the all-history line uniqueness only together with these protections; never drop it as a standalone workaround. Grant lifecycle and cancellation storage need independently reviewed additive migrations.
- **Durable audit:** use nonnullable authenticated actor references with RESTRICT and immutable grant/revoke/release records containing before/after authority/reservation versions, affected batches and evidence references. Generic audit summaries can be written atomically alongside these records, but cannot substitute for them.
- **Confirmation/evidence:** retain approved maker-checker separation. Recheck current session/role, PRIMARY, grant/source validity and expected batch version inside the final transaction. A trusted BANK authority must bind settled transaction evidence to source, currency, total and each employee/destination/amount. CASH requires retained signed acknowledgment for every employee and independent signer/receipt verification. A batch-level evidence reference may point to a verified immutable per-employee manifest; one arbitrary reference is insufficient. Server binds artifact digest/revision, verifier identity, verification time and explicit attestation; client text/flags never establish truth. Confirmation and permanent consumption commit atomically. No payment approval automatically posts a voucher.

## Remaining business approvals and acceptance

Smallest decision set: (1) nominated grant/revoke delegates, review requirement and material source-change reauthorization; (2) effects of revoke/expiry on unconfirmed batches and externally completed transfers; (3) cancellation/release authority and required non-disbursement evidence. Approved A–D already settle full allocations, employee-disjoint batching, preparation/confirmation roles and payment evidence types. Concrete evidence providers/artifact verification and permissions are technical authority contracts requiring review, not a new financial formula or role.

Focused command: `pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/verify-payroll-acceptance.ts --payment-review-only`. It uses the existing isolation/identity/cleanup harness, deploys only into a fresh disposable database, inspects migration checksum/function bodies/FK targets/triggers/precision and exercises read-only clock expressions. It creates no grants, payroll/payment fixtures or confirmations. Conflicting/revoked/abandoned lifecycle scenarios are checked structurally and reported as unsupported; previous accepted concurrency/success tests are not rerun or represented as new acceptance.

Migration/schema/application code is unchanged. The migration is ready for independent review with these findings attached; salary-dev deployment and operational payment confirmation remain blocked pending the reviewed fixes/contracts.
