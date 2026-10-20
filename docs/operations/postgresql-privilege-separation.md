# PostgreSQL privilege separation — HR-3B 002E-2C-1

Deployment update (002E-2C-3): payment migration and reviewed role separation are now installed on salary-dev; runtime configuration and security probes passed. Authenticated HTTP and positive approved-document smoke remain incomplete. See [current deployment acceptance](salary-dev-deployment-acceptance.md). The original pre-deployment decision below is retained as historical context.

## Decision and boundaries

PASS for reviewed controlled rollout; nothing has been deployed to salary-dev. Existing credentials/roles/grants/ownership and the existing Docker volume are unchanged. The current legacy `.env` is intentionally not modified: it must be replaced with the runtime-only configuration during separately authorized rollout. Until then API startup fails closed, rather than using its existing owning superuser.

Docker Compose remains the PostgreSQL-only bootstrap/maintenance service. It contains no API or automatic migrations. Its development defaults are not production credentials; deployment must use separately controlled secrets. No Compose restart, existing container or volume change is needed for this task. Cluster bootstrap credentials are never API credentials.

## Connections

- API: `RUNTIME_DATABASE_URL` and independently specified `RUNTIME_DATABASE_NAME`. Legacy `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `DATABASE_ADMIN_URL` and `FINANCE_PROVISIONING_DATABASE_URL` are rejected in the API process. No credential fallback. Startup verifies actual database, role attributes, memberships, object ownership, authority-write ACLs and accessible SECURITY DEFINER functions; failure disconnects and denies startup.
- Migration CLI only: `MIGRATION_DATABASE_URL`; Prisma config has no runtime/legacy fallback. `pnpm prisma:migrate`, `prisma:deploy`, `prisma:status` require explicit administrative configuration. Restricted `migrate dev` additionally requires a separately provisioned, uniquely named `MIGRATION_SHADOW_DATABASE_URL`; the owner has no CREATEDB and cannot automatically create/reset a business shadow target. The shadow secret is also forbidden in API environments. Seeding also uses explicit migration credentials and is never automatic. Use a private CLI environment/secret manager, not the API `.env`.
- Private finance provisioner/worker: separately managed credentials, never registered as an API database provider. No API provisioning endpoint or real finance delegation is added. Existing production authority provider remains null/fail-closed. A credential is technical access, not proof of human business approval or external non-disbursement. Future worker integration needs genuine designated identities, independently reviewed provenance and trusted evidence adapters.

## Reviewed role profile

`scripts/db/role-profile.ts` contains the explicit current table/function allowlist. Unknown or missing tables fail for review; no automatic grants to future tables/functions. `scripts/db/provision-roles.ts` defaults to review-only/no connection. `--apply` requires separately authorized `DATABASE_ADMIN_URL`, `DB_TARGET_NAME`, `DB_MIGRATION_ROLE`, `DB_RUNTIME_ROLE`, `DB_FINANCE_ROLE` and private `DB_MIGRATION_SECRET`, `DB_RUNTIME_SECRET`, `DB_FINANCE_SECRET` for new identities. URL/database identity and safe identifiers are checked. Protected `real_capita_accounts` is rejected. Existing role attributes/memberships must already be safe; passwords are not silently rotated. ACL provisioning is transactional and repeatable.

| Identity | Permissions |
|---|---|
| Migration owner | LOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS; owns this database/public objects. DDL for explicitly authorized migrations/maintenance only. No memberships in runtime/finance. A separately controlled cluster administrator creates the technical identities. |
| Runtime | Same nonprivileged attributes, no memberships, no ownership, no schema CREATE/TEMP/TRUNCATE/trigger-disabling privileges. Explicit SELECT/INSERT/UPDATE for current mutable application tables. DELETE only salary components, editable attendance records/revisions and draft voucher lines. Roles/user-role/account-class catalogs read-only. Users: SELECT plus lastLoginAt/updatedAt update only. Audit/finalization records append-only. Payroll runs: INSERT and approval metadata/version/updatedAt updates; payroll/payment lines INSERT only. Payment authority/evidence tables read-only; reservations read-only; no payment-batch UPDATE. No access to `_prisma_migrations`. |
| Private finance | Same nonprivileged attributes/no ownership/memberships; SELECT required sources/identity/history, INSERT designation/revocation/source/cancellation/audit records, payment-batch status/version UPDATE only. No confirmation INSERT or direct reservation writes. No master-ID UPDATE grants in the revised profile; bounded definer locks replace them. The old deployed profile must be changed only during separately authorized rollout. Never general ACCOUNTANT access. |

PUBLIC schema/database/function defaults are revoked for this profile. New owner-created tables/functions receive no automatic runtime/finance execution privileges. Future schema changes require reviewing the explicit allowlist. Credentials must not be printed, passed on command lines or committed.

## Bounded elevation and trust

PostgreSQL requires UPDATE permission for row locks. The new payment lock-only function avoids granting UPDATE on historical payroll lines. The unapplied payment migration adds `payroll_payment_lock_obligations`: approved PRIMARY scope, at most 1,000 selected employees, deterministic locks, no DML or returned private snapshots. No Prisma model/type change.

The role profile marks exactly five functions SECURITY DEFINER under the non-superuser migration owner with fixed `search_path=pg_catalog,public,pg_temp`: source snapshot (read/lock), obligation lock (lock only), line integrity trigger, reservation insertion trigger and reservation transition trigger. Trigger functions cannot be called as ordinary functions; runtime/finance cannot create tables/temp objects/triggers to attach them elsewhere. Only bounded read/lock RPCs are executable directly. Existing financial, grant, version, history and deferred-coverage guards still run; elevation does not bypass them. No generic SQL executor or delegate-writing definer function exists.

Database ACLs prevent direct runtime authority/state/reservation writes. They do not authenticate an end-user identity embedded in allowed SQL, establish external settlement or constrain an authorized object owner. NestJS session/ACCOUNTANT guards, authoritative adapters and private credential control remain required. Owners can deliberately alter guards; this is an administrative trust boundary.

## Actual acceptance

`pnpm verify:database:security` starts its own uniquely labelled PostgreSQL 17 container on a dynamic loopback port with tmpfs data and no existing mounts. It verifies identities before migration/role work, extends the existing payroll harness, and removes only its exact ID/label after disconnect/ownership checks. No cluster role was created on localhost:55532.

40 real PostgreSQL acceptance groups passed, including actual least-privilege runtime startup and idempotent provisioning; genuine runtime auth, employee/salary approval, finalized attendance, DRAFT/approval/document/payment-preparation workflows; rollback and two-connection concurrency; 16 financial/lifecycle SQL probes; and 19 runtime privilege denials (DDL, TEMP, trigger disabling, authority/revocation/evidence inserts, reservation release, paid transition, deletion/TRUNCATE, owner/provisioner SET ROLE and replication override). Private non-superuser source authorization services succeeded with isolated synthetic technical authority. Fiscal-year/period/ledger and real VoucherService DRAFT creation succeeded in one rollback-only transaction; no posting or retained voucher. Actual Prisma status used the distinct migration owner. No positive payment confirmation occurred.

Five elevated functions had the expected fixed search path and no unexpected executable escalation function. Role separation exposed required Prisma `updatedAt` column writes and obligation-lock permissions; these were addressed narrowly rather than granting broad user/payroll-line UPDATE.

## Safe salary-dev rollout — requires separate authorization

1. Review SQL/profile/credential controls; verify PostgreSQL 17 identity and exactly `real_capita_accounts_salary_dev`, current migration history, backup and existing volume. Keep protected database off limits.
2. Stop API requests/watch processes for the maintenance window. Keep private migration/provisioning secrets out of its environment.
3. Separately authorized migration deployment uses only the migration/maintenance environment. The current privilege profile expects the payment tables; do not run it against an incomplete schema. No automatic startup migration.
4. Authorized cluster maintenance creates the three scoped identities and applies the profile to the verified salary-dev database. Verify every owner, ACL, membership, definer/search_path and current_database assertion; do not rotate existing credentials or touch other databases implicitly.
5. Configure only runtime URL/name in the API environment; remove legacy/admin/finance variables. Launch and require startup attestation. Run read-only/auth smoke checks under the new role. Existing business writes require their normal separate authorization; use the isolated harness for acceptance fixtures.
6. Keep finance provisioning disabled until genuine authority/credentials/adapters exist. No payment confirmation or voucher posting is enabled by this rollout. Rollback means stopping requests and reviewing configuration/profile; never restore API superuser fallback.

## Exact task files

`.env.example`, `package.json`, `prisma.config.ts`, `prisma/seed.ts`, `apps/api/src/prisma/prisma.service.ts`, new `apps/api/src/prisma/database-security.ts`, `apps/api/src/payroll/payroll-payment-batch.service.ts`, the unapplied `prisma/migrations/20261014000000_payroll_payment_foundation/migration.sql`, `scripts/verify-payroll-acceptance.ts`, `scripts/payroll-payment-final-integrity.ts`, `scripts/payroll-payment-lifecycle-acceptance.ts` (strict fixture-proof narrowing), new `scripts/db/role-profile.ts`, `scripts/db/prisma-admin.ts`, `scripts/db/provision-roles.ts`, `scripts/db/security-acceptance.ts`, `scripts/verify-database-role-security.ts`, `scripts/verify-database-config.ts`, the updated `docs/architecture/hr-3b-payment-migration-review.md` cross-reference, and this document. Prior uncommitted work remains preserved; no schema models or previously applied migrations changed.
