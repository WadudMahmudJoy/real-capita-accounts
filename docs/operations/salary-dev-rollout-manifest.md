# Salary-dev rollout manifest — HR-3B 002E-2C-2

Status: **preflight PASS; deployment NOT executed or authorized.** Branch `Joy`, HEAD `20cdc5a94e2f24df781e313ab3850a456d913c1c`. Prior uncommitted work is retained.

## Verified target and recovery material

- Endpoint `localhost:55532`; Docker container `real-capita-accounts-postgres`, PostgreSQL **17.11**. Container identity `41c66af4e609542c5714c94a6b262637e4fda9fae8b6836e9a4dfa5590def192`, existing volume `real-capita-accounts_postgres_data`. No restart or volume changes.
- Independently queried `current_database()` = `real_capita_accounts_salary_dev`; internal server port 5432 matches the verified container mapping. No protected database connection.
- Exactly one active PRIMARY: `cmrum7eym0003n4w0sbd6byzd`, Real Capita Group, legal name Real Capita Group Ltd.
- All **13** applied migration checksums match repository SQL; no unfinished migration. Only pending migration: `20261014000000_payroll_payment_foundation`. Its 11 tables, four enums, revision columns and lifecycle functions are absent.
- Live Prisma schema diff against the pre-payment projection exited **0**, meaning no modeled schema differences. Existing six payroll monetary CHECK expressions and eight restrictive foreign keys verified separately. Prisma diff does not inspect arbitrary trigger/function bodies.
- All **39** public tables retained identical row counts and fingerprints before/after the operation, including Employee, Salary, Attendance, Accounting, Payroll and Audit. Existing payroll runs/lines: 0/0. No fixtures or business writes.
- Current connecting role `real_capita` is superuser/owner of this database and all 39 tables; it has no inherited memberships. Public schema belongs to `pg_database_owner`. Existing ACL inventory is retained privately with the backup. These privileges are unsuitable for API runtime.

External backup directory:

`E:\Joy\salary-dev-backups\preflight-20261014-a6e7915ad6bc477d85f1dcdf5be12d4d`

Archive `salary-dev.dump`: **184,132 bytes**, SHA-256 `3f2dea123a7bef070e89e6905f3cb902814660bbcebbafa80489d8b22b3a8edd`.

PostgreSQL 17 `pg_dump --format=custom` used an exported read-only repeatable-read snapshot shared with the inventory. `pg_restore --list` and full SQL extraction to `/dev/null` both exited 0. **No database restore was performed:** readability is verified, restoration acceptance is not claimed. `preflight.json`, `archive-toc.txt`, baseline Prisma schema and empty `schema-diff.sql` accompany the archive. Directory inheritance is disabled and access restricted to the current Windows user. The archive contains private business data; keep it outside Git. It excludes cluster-role passwords and does not replace private credential recovery arrangements.

## Roles and private configuration

Use three distinct, explicitly reviewed identities; proposed local names below are **not created**:

| Identity | Purpose and access |
|---|---|
| `rc_salary_migration` | Non-superuser, no CREATEDB/CREATEROLE/BYPASSRLS/replication, NOINHERIT, no memberships; owns salary-dev, public schema/tables/sequences/functions. Authorized CLI maintenance only. |
| `rc_salary_runtime` | Same restricted attributes; no object ownership, CREATE/TEMP/TRUNCATE or authority/state writes. Explicit application table/column/sequence/function allowlist from `scripts/db/role-profile.ts`. |
| `rc_salary_finance` | Separately held restricted provisioner credential with bounded authority/lifecycle ACLs. Never API credentials, never automatic ACCOUNTANT authority. No confirmation insertion. |

Cluster administration remains a separately controlled maintenance identity. Creating these cluster-wide roles and changing salary-dev ownership/ACLs need explicit authorization. Names must be checked for collisions and existing identities reviewed before creation. The profile refuses privileged existing identities, does not rotate passwords, and expects the full post-payment table inventory.

New role secrets must be privately supplied (at least 32 characters) through maintenance process environment/secret management: `DB_MIGRATION_SECRET`, `DB_RUNTIME_SECRET`, `DB_FINANCE_SECRET`. No secret values belong in this manifest, shell history or source. Prepare the reviewed role names in `DB_MIGRATION_ROLE`, `DB_RUNTIME_ROLE`, `DB_FINANCE_ROLE` and `DB_TARGET_NAME=real_capita_accounts_salary_dev`.

API environment must contain only its private `RUNTIME_DATABASE_URL` and `RUNTIME_DATABASE_NAME=real_capita_accounts_salary_dev`. Remove legacy `DATABASE_URL` and all migration/admin/finance/shadow credentials from that process. The current legacy local configuration remains unchanged and intentionally fails API startup; there is no owner fallback. Separate CLI `MIGRATION_DATABASE_URL` is mandatory. No normal API startup executes migrations. Finance authority remains disabled until genuine human delegates and trusted evidence adapters are separately established.

## Exact deployment order — all mutation steps pending authorization

1. Review the migration, role profile, this manifest and the existing privilege-separation contract. Record approved role names, private secret custody and maintenance-window authorization. Check available disk space and validate the archive hash again.
2. Stop API/watch processes and other writers to salary-dev; preserve the PostgreSQL container/volume. Verify target identity again. Refresh the backup if business state changed after this preflight, and inventory current ownership/ACLs. Do not connect to the protected database.
3. In a **private maintenance-only environment**, use an explicitly authorized existing administrative migration identity in `MIGRATION_DATABASE_URL` for this initial bootstrap deployment. Run `pnpm prisma:status`; pending status is expected, so evaluate output and exit code rather than labeling every nonzero status failure. Require exactly the reviewed payment migration pending, then `pnpm prisma:deploy`. This owner connection must never enter API runtime. Do not use `migrate dev`, `db push`, seed or reset.
4. Independently verify completed payment migration/checksum and the expected full schema. Only then apply the reviewed transactional profile using `pnpm exec tsx scripts/db/provision-roles.ts --apply`, with private `DATABASE_ADMIN_URL` plus the explicit target, role names and secrets above. The profile cannot run safely against the current incomplete payment schema.
5. Replace future CLI `MIGRATION_DATABASE_URL` with the new restricted migration owner. Keep cluster administration out of ordinary CLI/API processes. Verify current database, role flags/memberships, object ownership, ACLs/default ACLs and the full allowlist. Runtime must own nothing, have no authority DML, no migration-table access, no CREATE/TEMP/TRUNCATE or trigger-disabling capability. Verify five narrowly scoped SECURITY DEFINER functions have the non-superuser owner and fixed `search_path=pg_catalog,public,pg_temp`, with only the bounded read/lock RPCs executable directly.
6. Verify all payment restrictive foreign keys, Decimal(18,2) fields, lifecycle/chronology CHECKs, source revisions, permanent confirmed consumption and active reservation uniqueness. Inspect enabled integrity/immutability triggers and deferred batch-total triggers against the reviewed SQL/catalog contracts. Recheck the original six payroll financial expressions. Do not insert business grants or manufacture confirmations to check them; use isolated acceptance only if a deployment discrepancy requires retesting.
7. Install runtime-only API configuration, start API and require successful `assertRuntimeDatabase` startup attestation. Run authorized read-only `/health`, session/accountant access checks, Payroll list/preview/documents as data permits, Employee/Salary/Attendance and Accounting/Voucher retrieval. Existing business-write workflows were covered under least privilege in the previous 40 isolated PostgreSQL acceptance groups; do not create business fixtures now. Empty approved-payroll documents remain unavailable until real approved records exist.
8. Record final migration status, ownership/ACL assertions, protected-table counts and smoke outcomes. Keep finance integration fail-closed and retain the backup. No grant creation, actual payment confirmation, transfer, receipt or voucher posting is part of rollout.

## Failure and recovery

Keep API stopped if migration, provisioning or startup assertions fail. Capture sanitized errors and inspect actual migration state; never rerun blindly or mark a failed migration successful. Role provisioning is transactional, but migration deployment and provisioning are separate transactions. A migration success followed by ACL failure leaves the new schema installed with the old ownership: retain maintenance isolation until the reviewed profile can be completed safely.

Prefer reviewed forward repair or configuration correction. Never restore API access through the superuser fallback. Backup recovery requires **separate explicit authorization**: validate the archive hash, restore into a newly authorized empty isolated recovery database, verify data/constraints/ACLs and application compatibility, then approve any controlled replacement/cutover. Never restore over salary-dev, drop a database, change this volume or run destructive `pg_restore --clean` as an automatic response. Restore the recorded role/ACL plan separately if needed; no cluster-role passwords are contained in the dump. No restore drill or database replacement was performed in this task.

## Compatibility and remaining gates

No source workflow changed in this preflight. Accounting/Voucher/HR/Salary/Attendance/Payroll privileges retain the explicitly verified previous implementation contract; 22 offline configuration assertions and focused migration parity checks are rerun, not all 40 isolated security groups. Live compatibility after role deployment remains a required smoke gate. Runtime privilege attestation cannot establish human business delegation or external payment evidence.

Current-task verification passed: 22 offline configuration/role-attestation assertions; actual local configuration rejection (no owner fallback); payment schema/migration parity and weakened-constraint checks; Prisma validation; strict TypeScript checking and targeted lint of the preflight helper; `git diff --check`. Provisioning CLI review mode made no connection. Backup SHA-256 was independently re-read. Prior 40 isolated PostgreSQL security groups were not rerun; no application source changed here.

Files added in this task: `scripts/db/salary-dev-preflight.ts` and this manifest. Existing sources, migration SQL, environment files, database roles/ACLs and business records were not modified. All connections were disconnected; no disposable database or container was created by this task, and the external backup is intentionally retained.

Controlled rollout is technically prepared, **pending explicit migration/role/ownership/ACL authorization and private credentials**. Finance provisioning must remain operationally inaccessible until genuine authority is configured. Payment confirmation remains a separate milestone.
