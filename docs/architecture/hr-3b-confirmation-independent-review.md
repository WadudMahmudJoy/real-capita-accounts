# HR-3B 002E-3C — independent confirmation security review

## Verdict

**Migration financial-integrity review: PASS after corrections; ready for independent source review, not deployment.**

**Live privilege/trust activation: FIX REQUIRED.** The SQL runtime boundary passed, but same-Windows-user credential storage is not OS process isolation. External verification authority and human business delegation remain unavailable. Keep production verifier and writer disabled. This is not authorization to apply the migration or enable a payment integration.

## Corrections in the still-unapplied migration/implementation

1. Evidence occurrence/verification and CASH acknowledgment timestamps now require canonical UTC `Z` strings before parsing. TIMESTAMP(3) storage remains unchanged. Local-time strings cannot be interpreted differently in UTC, Dhaka or New York sessions.
2. PostgreSQL computes SHA-256 from canonical JSONB evidence. The legacy digest parameter is ignored; client/private caller hashes are neither provenance nor settlement authority. The service no longer sends its own digest.
3. Outer identifier whitespace is rejected by service and SQL constraints. Canonical issuer namespaces and identifier case/alias normalization must still be defined by a genuinely approved external adapter, not guessed by generic SQL.
4. A pre-DDL gate stops if legacy CASH confirmations lack claims, duplicate confirmation identities exist, or legacy references have noncanonical outer spaces. No paid history is backfilled, deleted or repaired. The migration must run after the deployed payment foundation.
5. Malformed beneficiary arrays fail validation rather than reaching confirmation SQL. No new application role, approval policy, source grant or business evidence is introduced.

Applied SQL was not changed: all **14** salary-dev migration checksums were independently compared with repository files using an explicit READ ONLY connection to the verified existing PostgreSQL 17 instance. New migration `20261015000000_payroll_confirmation_evidence` remains pending. Prisma schema was unchanged during this review.

## Integrity guarantees and tested boundaries

- Unique `(verificationAuthority,evidenceKind,evidenceReference)` binds one canonical BANK record to one confirmation. Actual replay against a second independently prepared employee batch failed with conflict and retained its PREPARED state.
- Unique `(authority,acknowledgmentId)` plus unique line ID protects CASH receipts across unrelated employee/batch instructions. Actual reused receipt in a second prepared CASH batch failed and rolled back its attempted confirmation; a fresh authoritative synthetic receipt then succeeded.
- Restrictive FKs and binding guards require the correct confirmation/batch/channel/employee line, full exact approved amount and UTC occurrence chronology. Deferred CASH coverage requires every covered employee's acknowledgment. Claims cannot be updated, deleted or truncated to permit reuse.
- Serializable/source/batch/obligation locks and rechecks protect status/version, current grant, immutable allocations and HELD reservations. Confirmation, permanent consumption and one audit commit atomically. Repeated confirmations and competing cancellation are blocked. Audit injection caused full rollback.
- Restricted migration owner owns the bounded definer; fixed path `pg_catalog,public,pg_temp`; PUBLIC EXECUTE revoked. Runtime has no EXECUTE, protected DML, schema CREATE, finance SET ROLE, credential catalog/file access or trigger-execution escalation path. Private finance gets only the existing reviewed lifecycle ACLs plus bounded confirmation EXECUTE and claims SELECT; it cannot directly INSERT confirmations/claims.
- Caller-supplied actor/hash alone cannot authorize normal API/runtime confirmation. Session identity is server-derived; default provider and private writer reject. An unknown configured provider with the default writer also fails closed before evidence is called.

## Important limits — do not claim these are database-enforced external authority

The private EXECUTE holder is a **trusted backend principal**. It can submit structurally valid JSON naming an active ACCOUNTANT. SQL can bind that JSON to obligations, but cannot independently authenticate a bank transfer, a signature or the HTTP session. A compromised private writer can fabricate matching external claims. A SHA-256 digest does not cure this. The private finance principal also has source-provisioning lifecycle duties; review whether confirmation warrants a narrower separate database identity before live activation.

The API environment/provider configuration excludes migration/finance credentials. Nevertheless, the private DPAPI directory and normal local process are under the same Windows identity. That principal can read the private directory and can decrypt its DPAPI material. SQL role separation does not prevent same-user application-code compromise from obtaining those credentials. No production secret was decrypted, printed or included in the bundle during this review.

Required operational fix: run ordinary API under a distinct restricted OS/service identity or equivalent container/secret boundary that cannot read/decrypt maintenance and finance credentials. Keep provisioning/writer credentials in a separately controlled worker. No ACL, credential or service-identity rollout was performed here. The present local arrangement is a developer trust boundary, not proof of credential isolation from the process.

Before any live integration, approve and establish: genuine finance designations/source grants; an authenticated external BANK source; independent CASH acknowledgment registry/signature verification; canonical stable authority/record IDs; mapping to approved historical beneficiary payment instructions; private worker authentication of the human confirmer; and independent verification/attestation. No adapter may be enabled by a free-text reference, boolean, caller hash or uploaded file alone. Default production remains 503.

## Actual verification

`pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/verify-database-role-security.ts --confirmation-security-review`

**24 focused actual PostgreSQL groups passed** on a uniquely labelled PostgreSQL 17 tmpfs instance and disposable database under the reviewed runtime/private role profile. Genuine synthetic login, salary approval, attendance finalization and payroll approval establish fixtures. Legacy lifecycle suites are skipped after necessary setup. Results include three synthetic confirmations/three consumed reservations/two CASH claims, distinct-batch BANK/CASH replay failures, source expiry/drift/revocation rejection, UTC direct SQL probes in three timezones, canonical stored digest, nine privilege attacks, untrusted-provider rejection, audit rollback and overlapping confirmation/cancellation. These are not real payments or business authority.

Migration sequence/parity, Prisma validation, API/verifier TypeScript, targeted lint and diff checks passed. The existing pg concurrent-query deprecation warning remains. Disposable database and exact owned container cleanup passed. Salary-dev was read-only; no new table/function/migration or business rows were installed. Protected database/Aafiyat were not accessed.

## Questions for independent review

1. Are the financial/replay/immutability guards complete, including direct privileged SQL routes and deferred triggers?
2. Is the trusted-writer boundary acceptable, or should a separate executor identity and authoritative verification-record registry/signature checks be mandatory before deployment?
3. Does OS/service identity isolation adequately prevent API access to private provisioning/migration secrets?
4. Are canonical authority namespaces, receipt/transaction ID normalization and historical beneficiary mapping defined strongly enough for real integrations?
5. Should legacy confirmations halt the migration entirely, rather than only unsupported CASH/noncanonical/duplicate records, before any future nonempty deployment?

## Package scope

The ZIP contains exact allowlisted source copies, dependency context, implementation report and these notes. Its manifest records original repository paths, SHA-256, sizes and whether each file changed during this task. It excludes `.env`, secrets, credential stores, backups, business rows, node_modules and generated artifacts. This is an independent **source-review** bundle, not a standalone application checkout.
