# HR-3B 002E-2C-3 — deployment safety gate

## Sprint 7E — current authority deployment status

Controlled deployment of migrations 18 and 19 is complete on localhost:55532/real_capita_accounts_salary_dev: 16 → 18 matching successful migrations; 15 remains pending. Fresh external backup and 56-table restoration passed. All 55 original business-table fingerprints and original ACLs are preserved. Runtime/finance CONNECT is restored after acceptance; private authority/stage commands remain migration-owner-only. No real authority was activated. See [full Sprint 7E evidence, checksums and limitations](../hr-admin/sprint7e-deployment-acceptance.md). Earlier entries below are historical.

## Authorized resume — deployed, acceptance PARTIAL

The owner subsequently authorized locally generating deployment secrets. Three independent OS-CSPRNG 32-byte passwords were generated, validated as distinct, and stored as Windows user-DPAPI encrypted SecureString CLIXML in `E:\Joy\salary-dev-private\deployment-9769002735c94d27b92440341eb8dae4`. Directory ACL inheritance is disabled; only the current Windows user has access. Existing maintenance credentials are separately retained there encrypted. Secrets were not printed, passed as command-line values or committed. DPAPI is tied to this Windows identity/machine; preserve its recovery access. Same-user administrators remain a trust boundary, not separate OS service identities.

Final safety checks reconfirmed the exact target/container, no other database client sessions, no role collisions, unchanged backup fingerprints and migration history. The original restore rehearsal remained valid and was not repeated. The API's previous configuration failed closed, and no API listener was active; no unrelated process/session was terminated.

`20261014000000_payroll_payment_foundation` was deployed successfully through the maintenance-only CLI and its installed checksum verified. Payment catalog review passed: function bodies, restrictive foreign keys, unique indexes, lifecycle triggers and Decimal precision match reviewed contracts. The 11 payment tables and four new enums are installed; actual catalog checks found 21 payroll CHECK constraints and 44 enabled named payment triggers.

Reviewed roles `rc_salary_migration`, `rc_salary_runtime`, `rc_salary_finance` were provisioned transactionally. All three credentials authenticated to salary-dev. The restricted migration role owns the database/public objects; runtime has no ownership or elevated memberships/attributes and passed startup attestation. Nineteen actual PostgreSQL runtime denials passed inside rollback-only transactions: owner/finance SET ROLE, DDL/TEMP, trigger disabling, authority/revocation/cancellation/evidence insertion, reservation mutation, forced CONFIRMED status, TRUNCATE, migration-table access and replication-role override. Five bounded SECURITY DEFINER functions have the restricted owner and fixed safe search path. Restricted-owner Prisma migration status exited 0.

Ignored local `.env` now contains only the runtime database URL/name, preserving unrelated application settings, with a user-only ACL. Privileged database variables were removed. Migration/finance credentials are not configured in the API; production finance authority remains null. No genuine delegates, grants, batches, confirmations or vouchers were created.

Actual Nest/Prisma startup under runtime succeeded; temporary loopback HTTP server passed `/health` and unauthenticated payroll 401. Runtime read permissions passed for Company, Employee, Salary, Attendance, schedules, fiscal periods, ledgers, accounts, vouchers and payroll models. Real PayrollPreviewService returned expected BLOCKED for incomplete real evidence. Finance authority returned null and persisted delegate/payment-batch counts remained zero. Original business-table counts/content fingerprints are unchanged after excluding the migration's added revision columns; the only history addition is the authorized payment migration.

**Remaining acceptance gaps:** no unexpired existing authorized session was available, so authenticated HTTP account/module smoke was not executed. No approved payroll exists, so positive salary-document and bank/cash preparation retrieval cannot be exercised on real records. No business data or synthetic payment/grant records were created to bypass these gaps. Earlier isolated technical acceptance is not represented as current positive business acceptance. Overall **PARTIAL**, despite successful migration, provisioning and runtime security acceptance.

A pre-deployment Windows PowerShell module-path incompatibility was diagnosed and corrected in the helper before any database changes. A pg client deprecation warning about concurrent queries appeared during application smoke; no failed query/data change was observed. Neither issue caused a deployment retry after database mutation. Sanitized historical failure evidence and final `deployment-result.json` are retained privately. Temporary compiled API files and the smoke HTTP server were removed/closed; the API is configured but not left running.

Files changed on resume: added `scripts/db/deploy-salary-dev.ts`, updated this report, and changed ignored local `.env` plus its ACL. Private encrypted credential files and acceptance JSON are outside Git. No schema/migration SQL was rewritten. Strict helper TypeScript, API compile, 22 offline configuration assertions and `git diff --check` passed. Do not rerun the deployment helper against an already deployed database; its collision/pre-migration gates intentionally refuse it.

Next acceptance step is an ordinary authorized Accountant login and read-only HTTP smoke against the configured runtime API. Payment confirmation still requires genuine finance delegation, trusted payment/non-disbursement evidence and a separately authorized implementation milestone.

## Prior attempt — credential gate (historical)

**BLOCKED — private role credentials unavailable. No deployment started.**

The business owner's authorization covers the reviewed migration and role profile. The same instruction prohibits inventing deployment passwords and requires stopping if secure private credentials need user input. `DB_MIGRATION_SECRET`, `DB_RUNTIME_SECRET` and `DB_FINANCE_SECRET` are absent from checked local `.env`, process and Windows user configuration. No PowerShell SecretManagement/SecretStore module is installed. No configured trusted secret source was established. Do not reuse bootstrap credentials or generate substitute salary-dev role secrets to bypass this gate.

## Actual safety and recovery checks

- Branch `Joy`; accumulated uncommitted work retained.
- Actual target `localhost:55532/real_capita_accounts_salary_dev`, PostgreSQL 17.11; active PRIMARY identity matches the rollout manifest.
- Thirteen completed migrations match repository checksums. The payment migration remains absent. Existing 39-table inventory and every row-content fingerprint still match the original backup; no refresh required.
- No other target client sessions at inspection. No listener on usual API/web ports 3000, 3001 or 4000. No process was indiscriminately terminated. This establishes an idle observation, **not a durable maintenance window**; before resumption, stop any newly started writers and repeat session/identity checks.
- No collision with reviewed names `rc_salary_migration`, `rc_salary_runtime`, `rc_salary_finance`. Existing maintenance identity has sufficient administration privileges.
- Host E: free approximately 16.5 GB; PostgreSQL volume filesystem approximately 963 GB available at inspection.
- Original archive SHA-256 matches its manifest. Restoration rehearsed on an independently verified, uniquely labelled PostgreSQL 17 tmpfs container, dynamic loopback port, no existing volume mounts. Restoration was single-transaction and excluded owner/ACL replay. All 39 counts/content fingerprints, migration history and validated constraints matched. Owner/ACL restoration remains a separate gate.
- Exact owned restore container removed after identity/label/mount assertions. No existing container or volume changed.

Backup/evidence directory:

`E:\Joy\salary-dev-backups\preflight-20261014-a6e7915ad6bc477d85f1dcdf5be12d4d`

New private evidence: `restore-rehearsal.json`, `deployment-gate.json`. The dump and original evidence remain intact.

## Not executed

Migration deployment, role creation, ownership/ACL/password changes, runtime environment replacement and deployed-runtime privilege/application smoke tests. No finance delegates, grants, payroll records, payment confirmations or vouchers were created. Protected `real_capita_accounts` and Aafiyat were not accessed.

## Required input and resume order

Configure the three reviewed role secrets in a private maintenance-only environment accessible to the task, or identify a supported private secret source containing them. Never send values in chat or place them in repository files. Each new secret must meet the reviewed minimum length of 32 characters. Confirm availability only. The existing administrative connection can be used through a private maintenance environment after the target is reverified; unrelated credentials must not be rotated.

Then repeat the final identity/session/backup gates and execute the already-authorized ordered rollout in `salary-dev-rollout-manifest.md`: deploy only the pending payment migration; verify catalogs/data; provision the reviewed scoped roles transactionally; configure runtime-only API credentials; perform actual PostgreSQL privilege probes and application smoke acceptance. Until these pass, keep normal API startup fail-closed. No destructive recovery is warranted because the target was not modified.

## Task files and checks

Added `scripts/db/salary-dev-restore-rehearsal.ts` and this report. No existing source, migration or local application configuration changed. The helper's ephemeral randomly generated credential belonged only to its isolated technical restore instance; it was never a salary-dev role credential.

Strict helper TypeScript checking, targeted lint and `git diff --check` are recorded in the final task report. Prior isolated security acceptance is not substituted for unexecuted salary-dev deployment acceptance.
