# HR-3B 002E-3D — Private finance writer isolation

## Reviewed technical change

The provisioning role must have **no UPDATE(id)** on companies, cash_bank_accounts or ledger_accounts, even for unreferenced rows. RESTRICT foreign keys were insufficient. The profile explicitly revokes legacy column grants (table-level REVOKE alone is insufficient). The unapplied confirmation migration adds a lock-only PRIMARY function. Lifecycle callers use it and the existing bounded source snapshot instead of direct master locks. Six lifecycle trigger guards that require master row locks run under the restricted migration owner with a fixed pg_catalog,public,pg_temp search path; neither private role can execute them directly, create triggers, or change their owner/body. Source locks retain parent → source → ledger → batch/obligation ordering. Guards and source revision checks are preserved.

Four separate PostgreSQL principals are required:

| Principal | Allowed technical scope |
|---|---|
| Migration/maintenance | Own this database/schema; reviewed maintenance only; never HTTP |
| API runtime | Existing application profile; no authority writes or confirmation EXECUTE |
| Finance provisioner | Reviewed delegate/source/cancellation inserts, batch status/version update, bounded locks; no master UPDATE or confirmation EXECUTE |
| Confirmation executor | Required SELECT and bounded source/obligation locks + confirmation RPC EXECUTE only; no authority INSERT, direct batch/reservation/confirmation/evidence writes, master UPDATE, DDL or role membership |

`DB_CONFIRMATION_ROLE` and separately managed `DB_CONFIRMATION_SECRET` are required when applying the profile to the confirmation schema. No default to the provisioning role exists. Existing salary-dev roles are unchanged. Deploy the pending evidence migration before using the new lifecycle lock call/profile. Do not activate private operations on the old schema. Apply the revised profile only during a separately authorized maintenance rollout. Existing three-role deployment scripts are historical; they do not provision confirmation authority.

Database identity authenticates the private technical caller, **not** an end-user actor or external settlement. Executor credentials remain a trusted boundary. The approved provider must independently authenticate actors, validate external evidence and invoke the bounded transaction. The default API provider/writer still returns 503; no genuine provider or worker host is installed here. Object owners, superusers and Windows administrators remain trusted administrators.

## Current OS finding: BLOCKED

Read-only inspection of the existing private deployment directory found its owner and only FullControl principal to be WADUDMAHMUD\wadud. Ordinary local API and DPAPI ciphertext use that same Windows identity. This does not isolate processes; PostgreSQL role separation does not fix it. No secret was decrypted during this inspection. No account, ACL, scheduled task or salary-dev role was changed.

## Executable Windows rollout procedure — separate authorization required

1. Privately select three distinct existing/nonadministrative Windows SIDs for API, provisioning and confirmation. Creating accounts, logon rights and ACL changes require operational authorization. Restrict service logon/interactive rights, privileges and group memberships; neither API nor either private worker may be local administrator or impersonate the other identities.
2. Stop the API for its independently authorized identity/configuration change. Remove migration/provisioning/confirmation credentials from its environment. Give it only the runtime secret. Do not restore a privileged fallback.
3. Outside Git, create separate private configuration and credential directories for each worker. Disable inherited ACLs; permit that worker SID plus SYSTEM/Administrators only. Secure all ancestors, configuration files, service task configuration and executables against API writes and path replacement/reparse points. Repository/Node/pnpm binaries must be read/execute only to service identities, writable only by deployment administrators. Do not reuse the current same-user private directory.
4. Write a nonsecret JSON configuration in each protected directory: `purpose` (provisioning/confirmation), `repository` (absolute reviewed checkout), `apiSid`, `provisioningSid`, `confirmationSid`, `credentialFile` (absolute outside Git), `databaseRole`, `database: real_capita_accounts_salary_dev`, `hostName: localhost`, `port: 55532`. Match purpose/account/role explicitly; configuration is controlled by maintenance administrators, never HTTP input.
5. Run `scripts/db/private-worker.ps1 -Configuration <private-config> -ProvisionCredential` **as the matching worker account**. Its secure prompt enrolls the scoped connection URL into Windows CurrentUser DPAPI. It refuses overwrite, incorrect SID, shared identity, repository storage and unrelated ACL entries. No secret is a command-line argument or logged. Never copy/re-encrypt the current same-user migration/provisioning credentials into API storage. Generate the new executor credential only during its authorized database rollout.
6. Run the same wrapper with `-AttestOnly` under that account. Both PowerShell and Node check effective Windows SID, exact localhost:55532 database and role. PostgreSQL checks non-superuser/no-membership/no-ownership/no-DDL, master-ID denial, function search paths and purpose-specific authority permissions. Connection errors are suppressed; no password-bearing messages are emitted. Wrong credentials, absent migration/profile or missing configuration fail startup. This is a read-only attestation, not a settlement assertion.
7. `register-private-worker.ps1` defaults to review-only. After separate authorization, pass `-Apply` and a privately supplied PSCredential for that exact existing worker account. It refuses existing task replacement, registers a Limited startup task and stores its OS credential through Windows Task Scheduler. This task runs **attestation only**; it cannot confirm payments. Secure its configuration/action from API alteration. Test startup/reboot/logout and actual API read/decrypt denial under the distinct identities before claiming OS isolation PASS.
8. No enabled production worker host or external evidence adapter is included. Ordinary wrapper execution without `-AttestOnly` refuses activation. Registration is not authorization to implement or activate settlement. Genuine delegates, trusted BANK/CASH verifiers and private-worker deployment acceptance remain separate gates.

Do not use plaintext .env files for private credentials, environment-wide secrets, owner connection fallbacks or a general superuser worker. The scripts do not create accounts or automatically change ACLs. Administrators must inspect the dry-run and approved paths before applying the operational procedure.

## Verification

Actual checks: 43 broader isolated PostgreSQL groups passed, then 25 focused groups passed after narrowing executor privileges. The latter probes actual referenced and unreferenced master rows, cross-role assumption, provisioning confirmation denial, executor provisioning denial, BANK/CASH replay, UTC, rollback and concurrency. The harness deliberately restored legacy UPDATE(id) grants before idempotent reprovisioning, proving the upgrade removes them. All task-created databases and tmpfs containers were removed after ownership/identity checks. No salary-dev connection or security change was made in this task.

Offline outcomes: Prisma validation and additive migration parity passed; API and targeted verifier TypeScript passed; API and verifier targeted lint passed; 28 readiness/provider assertions, 20 payroll read/auth checks and 7 payment preparation checks passed. PowerShell parser checks, three Windows negative configuration cases and six API private-credential refusals passed. These Windows negative tests are not successful service-identity/DPAPI isolation acceptance. The first PostgreSQL attempt failed on Prisma void deserialization; the lock-only call was corrected with a text cast and reruns passed. An existing pg concurrent-query deprecation warning remains in the harness; no acceptance assertion failed in the final runs. Git diff check passed (inherited CRLF conversion warnings only).

Verdicts: confirmation migration integrity PASS for independent review, private writer database technical security PASS in isolated tests, actual OS isolation BLOCKED, live BANK/CASH evidence readiness BLOCKED. Existing deployed role privileges remain unchanged until authorized rollout. Synthetic delegate/evidence fixtures establish technical behavior only. They are never real finance delegation or payment. The pending evidence migration remains unapplied to salary-dev; no existing business database is accessed for write tests.


## Exact task source changes

- `scripts/db/role-profile.ts`
- `scripts/db/provision-roles.ts`
- `scripts/db/security-acceptance.ts`
- `scripts/db/private-worker.ps1` (new)
- `scripts/db/private-worker-attestation.ts` (new)
- `scripts/db/register-private-worker.ps1` (new)
- `scripts/verify-private-worker.ts` (new)
- `scripts/review-payroll-confirmation-security.ts`
- `scripts/payroll-confirmation-acceptance.ts`
- `apps/api/src/payroll/payroll-payment-lifecycle.service.ts`
- `apps/api/src/prisma/database-security.ts`
- `prisma/migrations/20261015000000_payroll_confirmation_evidence/migration.sql`
- `docs/operations/private-finance-worker-isolation.md` (new, this report)
- `docs/operations/postgresql-privilege-separation.md`
- `docs/architecture/hr-3b-transactional-payment-confirmation.md`

No Prisma model or applied migration was edited. No credential file, .env, role, ACL, service account, task, protected database or Aafiyat resource was changed.
