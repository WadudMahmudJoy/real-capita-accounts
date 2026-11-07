# HR-3B 002E-3B — transactional confirmation, production fail-closed

Review update (002E-3C): the unapplied migration now enforces canonical UTC evidence dates, server-calculated digest, canonical outer whitespace and a legacy-history preflight. Focused review tested distinct-batch BANK/CASH replay. SQL integrity passed; OS same-user credential isolation and external writer authority remain live-use blockers. See [independent-review notes](hr-3b-confirmation-independent-review.md). The historical 002E-3B results below are retained.

## Implemented contract

`POST /payroll-runs/payment-batches/:id/confirm` uses the existing session/ACCOUNTANT guards and write-capable context. Its DTO permits only expected version, idempotency key and an opaque evidence locator. Actor IDs, amounts, recipients, hashes and claimed approvals are not accepted from clients. The response permits only confirmation ID, batch ID, CONFIRMED status and new version.

`PayrollPaymentConfirmationService` obtains independently verified evidence through the existing provider interface. The production provider remains unconfigured/null, and the production confirmation writer holds no finance connection and always refuses operations. Authenticated production requests receive 503; no environment flag installs a test verifier or writer. This task adds an engine and disabled contract, not an enabled live disbursement facility.

A future approved private writer must supply a Serializable transaction. The engine reuses readiness inside that transaction and then validates canonical exact money/currency, PRIMARY ownership, approved historical obligations, current grant/source, status/version, maker-checker, full reserved coverage and complete evidence beneficiary bindings. Missing, expired, revoked, superseded or materially changed source authorization blocks. Evidence must occur after instruction creation and no later than independent verification; pre-instruction historical payment recording is unsupported. Historical salary/profile data is never replaced or recalculated.

The bounded `payroll_payment_confirm` function independently requires Serializable isolation, locks parent/source/batch/approved obligations in the existing order, rechecks current wall-clock authorization, rejects cancellation/confirmation conflicts and stale versions, validates evidence bindings, and creates confirmation, CASH claims, status/version, permanent reservation consumption and one audit event atomically. Audit time uses UTC wall clock. Repeated requests/status conflicts return conflict rather than a second confirmation/audit. Any failure rolls back all changes; no automatic repair or payment reversal is attempted.

## Evidence and persistence addition

New unapplied migration: `20261015000000_payroll_confirmation_evidence`.

- Existing confirmation headers gain uniqueness across `(verificationAuthority, evidenceKind, evidenceReference)`. Adapters must return canonical stable authority/record identifiers; references are not client proof.
- New `PayrollCashAcknowledgment` stores one immutable claim per payment line, amount Decimal(18,2), authoritative acknowledgment ID and UTC occurrence time. Restrictive FKs protect line/confirmation history; `(authority, acknowledgmentId)` prevents reuse across unrelated lines/batches.
- CASH requires each covered employee's independently verified acknowledgment, exact amount/date and source/recipient relationship. Aggregate evidence is insufficient without the required independently verified individual bindings.
- A deferred coverage guard prevents a CASH confirmation without all claims. Binding, amount/chronology and history guards reject mismatches, updates, deletion and TRUNCATE.
- BANK requires an independently authenticated external transaction and exact batch/source/currency/beneficiary allocation binding. Header uniqueness prevents reuse across BANK batches. No transfer is initiated.

The applied `20261014000000_payroll_payment_foundation` migration was not edited or redeployed. The new migration ran only in disposable PostgreSQL. Salary-dev must not receive it without separate review/deployment authorization; preflight must investigate any existing confirmations or duplicate references before changing historical enforcement, rather than fabricating missing evidence.

## Privilege boundary

The new mutator is SECURITY DEFINER under the restricted migration owner with `search_path=pg_catalog,public,pg_temp`, no dynamic SQL and PUBLIC execution revoked. The reviewed profile grants EXECUTE only to the private finance identity when the additive schema exists. Runtime retains no confirmation INSERT, batch UPDATE, reservation mutation or mutator execution. Finance receives SELECT on CASH claims for deferred coverage checks, but no direct INSERT/UPDATE/DELETE on claims or confirmations.

The function trusts the separately controlled private writer to authenticate the human actor and independently validate external evidence. PostgreSQL cannot prove a bank settlement or a real signature merely from JSON/IDs. A compromised private provisioner or object owner remains an administrative trust boundary. Credentials alone do not establish business delegation. No private finance credential/provider is registered in the API.

## Actual verification

**43 real PostgreSQL acceptance groups passed** using the existing isolated PostgreSQL 17 instance/database harness and restricted runtime/private finance identities. Genuine synthetic login, source approval, attendance finalization and payroll approval workflows remained intact. The new confirmation extension verified:

- BANK and CASH positives for two employee allocations each: two confirmation records, two CASH claims, four permanently consumed reservations and two confirmation audits.
- Authenticated CASH HTTP success with explicitly injected isolated dependencies and an allowlisted response; normal configured HTTP still returns 503.
- Maker-checker, absent/negative/mismatched source, amount, recipient and date evidence; missing individual acknowledgment; expired/revoked/materially changed grants; duplicate confirmation/idempotency rejection.
- Two BANK connections yield one confirmation. CASH HTTP confirmation actually overlapped a cancellation request at PostgreSQL locks; confirmation succeeded, cancellation failed and left no request row.
- Injected audit failure restores PREPARED status and leaves no confirmation. Direct reservation release, claim alteration/duplication and runtime/direct finance confirmation-write bypasses are rejected.
- Existing salary/payroll/readiness/document/authorization, financial, UTC expiry, cancellation, rollback and privilege regressions passed. Positive synthetic records are technical fixtures, not real settlement or business authorization.

The isolated CASH coverage check initially exposed missing private SELECT permission at deferred commit; the profile was corrected narrowly and final runs passed. The existing pg concurrent-query deprecation warning remains. Both disposable database and exact owned tmpfs container were removed after session/identity assertions.

Other checks passed: 28 deterministic readiness/provider assertions, 20 read/auth checks, seven preparation checks, API/verifier TypeScript, targeted lint, old and new migration parity, Prisma validation and diff checks. No schema/base-migration mismatch was accepted; the old verifier was updated to compare its historical delta independently of the new additive delta.

Salary-dev was inspected with READ ONLY transactions only: zero confirmations, batches and business delegates; new claim table and mutator absent. No salary-dev schema, roles, credentials or business data changed. Protected database and Aafiyat were not accessed.

## Exact task files

- `apps/api/src/payroll/payroll-payment-confirmation.service.ts` (new), `dto/payroll-payment-confirm.dto.ts` (new), `payroll-payment-evidence.provider.ts`, `payroll.controller.ts`, `payroll.module.ts`.
- `prisma/schema.prisma`, new `prisma/migrations/20261015000000_payroll_confirmation_evidence/migration.sql`.
- `scripts/db/role-profile.ts`, `scripts/db/security-acceptance.ts`.
- New `scripts/payroll-confirmation-acceptance.ts`, new `scripts/verify-payroll-confirmation-migration.ts`.
- `scripts/verify-payroll-acceptance.ts`, `scripts/verify-payroll-read.ts`, `scripts/verify-payment-confirmation-readiness.ts`, `scripts/payroll-payment-schema.ts`, `scripts/verify-payroll-payment-foundation.ts`, `scripts/payroll-payment-lifecycle-acceptance.ts` (clarified historical test message).
- This document. Generated ignored Prisma client refreshed locally; no secrets or generated output committed.

Verdict: **PASS for the isolated transactional engine and production-disabled API contract**. Remaining deployment gates are independent migration/profile review, approved private worker integration, genuine finance designation/source grants and trusted canonical BANK/CASH evidence adapters with historical beneficiary mapping and independent human attestation. No bank receipts UI, voucher posting or external transfer integration was started.


## 002E-3D private-writer hardening

Provisioning and confirmation now have distinct privilege profiles. Legacy master-ID column grants are explicitly revoked; bounded locks and guarded trigger elevation preserve lifecycle operations. The confirmation schema requires a separate executor identity. See [Windows isolation and rollout gates](../operations/private-finance-worker-isolation.md). No salary-dev roles were changed. Actual OS isolation and live settlement evidence remain BLOCKED.
