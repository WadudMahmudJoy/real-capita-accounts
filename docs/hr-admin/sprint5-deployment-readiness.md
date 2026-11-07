# Real Capita Group — HR-Admin Sprint 5 deployment readiness

Review date: 2026-10-16. Branch Joy, HEAD `20cdc5a94e2f24df781e313ab3850a456d913c1c`.
**Current state — Sprint 6: approved HR migrations 16 and 17 are APPLIED with
HR-only runtime grants. Migration 15 remains PENDING. See the Sprint 6 deployment
record at the end; earlier sections are preserved pre-deployment evidence.**
All accumulated uncommitted work is retained. This report authorizes no deployment,
privilege assignment, identity binding or real leave decision.

Current correction: see the Sprint 5A appendix below. It supersedes any earlier
description that could imply selected office/company context owns a leave request.

## Sprint 5 pre-deployment decision (historical)

**PARTIAL operational readiness; independent source review may proceed.** The
seven approved functional scopes have isolated browser/API acceptance. Existing
salary-dev has neither HR migration. Genuine System Administrator and HR/Admin
identities have not been designated. Standard full-source `prisma migrate deploy`
is unsuitable for HR-only deployment because it also applies pending payment
evidence. A curated, checksum-preserving Prisma artifact is a technically tested
alternative, requiring separate review and explicit deployment authorization.

## Actual migration order

Salary-dev history contains exactly these 14 successful migrations, in order.
Every stored SHA-256 checksum matches the current original SQL bytes; no failed,
rolled-back or unfinished entry exists.

1. `20260613193905_phase_1a_auth`
2. `20260613211712_phase_2a_accounting_foundation`
3. `20260614163238_phase_2c_voucher_schema_foundation`
4. `20260615123515_phase_2e_mfs_schema_foundation`
5. `20260619204559_add_voucher_reversal_linkage`
6. `20260623000000_phase_2m_customer_booking_foundation`
7. `20260809193952_salary_foundation_phase_1`
8. `20260823000000_phase_2_employee_records`
9. `20260830000000_phase_2_employee_records_integrity_fix`
10. `20260902000000_hr_2b_work_schedule_foundation`
11. `20260906000000_hr_2c_attendance_foundation`
12. `20260906212958_multi_office_company_foundation`
13. `20261013000000_hr_3b_payroll_foundation`
14. `20261014000000_payroll_payment_foundation`

Pending, in full-source order:

15. `20261015000000_payroll_confirmation_evidence` — unrelated payment claims,
    evidence uniqueness, private confirmation function; do not deploy for HR.
16. `20261016000000_leave_request_foundation` — leave categories, global Employee
    requests/events, User/Company references, inclusive date exclusion and history.
17. `20261017000000_hr_admin_identity` — requires 16's categories, requests,
    events and immutable-history function. Adds permission grants, verified
    bindings, administration events and versioning; replaces 16's withdrawal and
    decision guards to implement the subsequently approved identity policy.

Neither 16 nor 17 depends on 15. Both use existing User/Employee/Company and audit
structures. `btree_gist` is required by 16; the migration identity must be allowed
to install this trusted extension. Schema contains the combined pending contracts,
not a claim that salary-dev already has them. Exact generated base DDL parity for
16 and 17 passes independently of manually authored SQL safeguards.

## Selective deployment proposal — not executed on salary-dev

The disposable-only `--hr-migration-sequence` harness performs:

1. Copy original migration lock and migrations 1–14 into a private temporary
   artifact, with unchanged names/SQL. Prisma deploys the baseline there.
2. Add only original 16 and 17. A temporary Prisma configuration explicitly points
   at that artifact and the isolated database; Prisma deploys both successfully.
3. Verify 16 successful history entries and original checksums, six HR tables,
   absence of confirmation-evidence objects, curated `migrate status` exit 0.
4. Against the full source, verify `migrate status` exit **1** correctly reports
   pending 15. This is expected pending status, not a failed migration.
5. Apply the current reviewed three-role privilege profile to that HR-only schema.
   Actual runtime startup attestation and HR SELECT privileges pass; an attempted
   permission INSERT without trusted Administrator authority fails closed.
6. Only in that disposable test, subsequently deploy full source: Prisma applies
   deferred 15 normally. All 17 history checksums remain correct and status exits
   0. No `resolve`, handwritten history rows or fabricated applied states are used.

This proves technical compatibility for the installed Prisma version. It does not
approve a new production operating procedure. Retain and hash the exact curated
artifact/configuration for future authorized deployment. Do not run full-source
`migrate deploy` against salary-dev. Full-source development/reset commands are
not part of this proposal. Future migration workflows must acknowledge deferred
15; re-review the artifact whenever migrations change.

## Identity, privacy and integrity review

| Concern | Verified contract and boundary |
|---|---|
| Global identity | Employee master unchanged; active User and Employee bindings each have a partial unique index. Release/rebind preserves prior rows and restrictive references. No office-scoped Employee duplication. |
| Authority | Separate `SYSTEM_ADMIN` and `HR_ADMIN` grants; ACCOUNTANT confers neither. No default account, permission seed or HTTP bootstrap. Live expiry, revocation and active-user checks apply. |
| Administration | Server session actor, sorted user locks, Serializable transaction, expected version, target-session revocation, credential-free before/after events and global audit. Self-administration denied. |
| Leave privacy | Own list/detail/withdrawal requires current verified global employee binding. Cross-employee access requires explicit HR authority. HR reviewer also requires a verified employee identity. |
| Leave dates | Inclusive PostgreSQL GiST exclusion reserves pending/approved employee dates globally. Rejected/withdrawn requests retain history and release date overlap. |
| Decisions | Pending version 1 transitions once to final version 2; duplicate/stale/concurrent decisions fail. Own employee leave cannot be approved or rejected by HR self. Final decisions cannot reopen. |
| History | Immutable request instructions, complete matching before/after LeaveRequestEvent, deferred atomic event requirement; immutable grants/bindings/admin events, restrictive FKs. Category changes do not rewrite historical labels. |
| Payroll/attendance | No leave-to-money, quota, entitlement or attendance mutation. Existing payroll calculation and independent approval are reused unchanged. Approved documents read historical snapshots. |

SQL transaction-local actor context is supplied by trusted server code. It is not
cryptographic end-user authentication: arbitrary SQL compromise of the runtime
could claim an already genuinely configured actor. Application audit atomicity
does not mean every conceivable owner/direct-SQL change is independently audited.
Privileged DBA/owner maintenance can bypass or disable guards. These limitations
must remain explicit; no protection against a malicious database owner is claimed.

## Runtime privileges and maintenance identity

The existing three database roles remain unchanged. Runtime is non-superuser,
non-owner, has no memberships/CREATEDB/CREATEROLE/BYPASSRLS/replication, cannot own
or disable guards, and uses only `RUNTIME_DATABASE_URL` plus explicit database
name. Legacy/maintenance/private-finance connection variables are rejected at API
startup; no owner fallback exists.

After separately authorized HR deployment, use the reviewed explicit table/column
allowlist in `scripts/db/role-profile.ts`: SELECT on six HR tables; INSERT on
requests/events/admin events/grants/bindings/categories and users/user_roles;
bounded UPDATE columns for leave decisions, grant revocation, binding release,
category configuration and User administration; DELETE only user_roles for role
removal. Runtime has no HR history DELETE/TRUNCATE or schema privileges. Existing
sequence usage and fixed-search-path invoker triggers are included in the profile.
HR triggers do not need runtime direct EXECUTE grants to fire. No new role or
confirmation executor is required for HR-only rollout. Preserve existing finance
and accounting restrictions. No ACL is changed in this sprint.

Migration/maintenance credentials remain private DPAPI data outside Git. They are
used only for read-only preflight/backup here. No private credentials are passed
to web/browser fixtures or included in the review package.

## Salary-dev evidence and backup

- Exact target: `localhost:55532/real_capita_accounts_salary_dev`, PostgreSQL
  **17.11**, independently checked using `current_database()` before checks.
- PRIMARY: active Real Capita Group / Real Capita Group Ltd,
  `cmrum7eym0003n4w0sbd6byzd`. No company created or altered.
- 50 public tables; no HR tables/enums, no cash-acknowledgment table from 15.
- No other client sessions at the backup gate. All table counts and canonical
  content fingerprints match again after acceptance; all 14 checksums unchanged.
- Fresh custom archive, 358940 bytes:
  `E:\Joy\salary-dev-backups\hr-sprint5-a088b5bd0162424581f8c0d5d926ceb0\salary-dev.dump`
- SHA-256: `a893f1a4db7e7cddd86317da5f094e7fc02c744f1158be0821d5b6dd8ca643f3`.
- Snapshot-consistent dump, readable catalog/full extraction; directory ACL
  restricted to current Windows identity. Backup is outside Git and excluded
  from the review ZIP.
- Actual restore rehearsal in a new labelled tmpfs PostgreSQL 17 container:
  all 50 table counts/content fingerprints and migration history match; every
  constraint is validated. Exact owned instance removed afterward.
- Restore intentionally uses no-owner/no-privileges; ownership/ACL recovery is a
  separate reviewed provisioning step, not claimed tested by this restore.
- Final actual runtime startup attestation and Employee, Salary, Attendance,
  Payroll and Voucher reads pass. No authenticated live HR acceptance is possible
  before schema deployment and genuine designation.

An initial preflight stopped on Prisma's rendering of the ten identical UTC
defaults (`'UTC'` versus PostgreSQL's `'UTC'::text`). The verifier now checks all
ten actual expressions before normalizing this known representational difference;
the resulting deployed-14 model comparison is clean. No SQL/schema was repaired.
The initial incomplete external backup attempt is retained, not a restore point.

## Exact future deployment / recovery order

1. Independent review of ZIP, 16/17 SQL, actor trust boundary, privilege profile
   and the curated migration procedure. Obtain explicit HR-only deployment
   authorization and genuine designation separately.
2. At the authorized window, stop only identified application writers; recheck
   exact host/database, 14 checksums, pending set, PRIMARY, inventory and disk
   space. Compare fingerprints to backup; take a new snapshot backup/rehearsal
   if data/schema changed. Never terminate unknown/unrelated sessions.
3. Produce/hash the curated original 1–14,16,17 artifact and temporary Prisma
   config. Use private maintenance/migration connection, never API credentials.
   Run `migrate deploy --config <reviewed-private-config>` exactly once. STOP on
   error; do not blindly retry, mark resolved, or edit migration history.
4. Verify original 16 history entries/checksums, constraints/triggers/indexes,
   absence of 15 objects and pending 15 under full-source status. Apply the
   reviewed three-role profile with existing identities, no password rotation or
   new finance delegates. Recheck default grants, safe function ownership/search
   paths, runtime denials and unchanged non-HR business fingerprints.
5. Start the compatible API/web release with runtime-only credentials. Verify
   startup attestation, genuine existing ACCOUNTANT login and Accounting,
   Voucher, Employee, Salary, Attendance, payroll/approved-document reads.
   Absent genuine Administrator/HR designations must remain fail-closed.
6. Only after separate owner-supplied actual User IDs and authorizer identity,
   follow administrator-onboarding.md for auditable private first designation,
   then normal Users UI permissions and verified employee bindings. Configure
   only owner-approved active categories; do not invent leave entitlements.
7. Verify genuine onboarding/login/permissions/privacy and read-only legacy smoke
   acceptance; record deployment artifact hashes and results. No fabricated real
   leave/payroll is required to demonstrate activation.

On failure: stop writers/further changes, retain failed migration evidence and
backup. Diagnose exact state in a separate restored instance. Never overwrite the
existing target automatically. Any restore/cutover, database ownership/ACL repair
or migration resolution requires a separately reviewed authorization. Preserve
original target and backup until an independently verified recovery is accepted.

## Acceptance and remaining operational gates

Fresh isolated genuine-auth browser suites cover Administrator/HR/employee
privacy, payroll preview/DRAFT/independent approval/documents and attendance
entry/finalization/correction. Focused PostgreSQL tests cover grant/binding
uniqueness, expiry/revocation races, leave overlap/decisions, restrictive FKs and
atomic immutable history. Payroll engine/source rules are unchanged. Print media
checks compare exact approved money cells and row counts, hide controls, preserve
A4 portrait/landscape and never show PAID. No physical printer/PDF output is
claimed. Synthetic technical identities are not real business delegations.

Required before live activation: review and deployment authorization; actual
System Administrator recipient/independent authorizer User IDs; separate HR/Admin
designation and verified reviewer/employee bindings; approved category definitions;
private credential/operator availability. No additional payroll or leave-money
policy is introduced. Payments remain outside this sprint.

## Sprint 5A — central leave ownership correction and final HR-only gates

The owner approved: **all employee leave belongs centrally to active PRIMARY;
office context is optional and non-authoritative.** This is implemented without
new Prisma fields, tables or grants. Company is the existing multi-office company
entity; there is no separate Office model or verified employee-office assignment
to infer. All active Company records configured in this application are permitted
as reporting labels only; their visibility or selection confers no leave access.

### API, snapshots and SQL guarantees

- The controller no longer requires or passes selected office ownership. The
  service resolves unique PRIMARY inside the transaction, independently of any
  legacy internal selected-office argument. Missing/inactive PRIMARY fails closed.
- POST accepts optional `officeContextCompanyId`, not `companyId`. HTTP whitelist
  rejects ownership injection; the reusable service also rejects ownership claims.
  Reporting references must identify an existing active configured Company.
- Existing LeaveRequest.companyId/FK is preserved as the parent relationship.
  Snapshot `owningCompany` records historical parent identity/name/legal name and
  PRIMARY marker. Separate `officeContext` is null or records Company ID/name,
  `reportingOnly: true`, `assignmentVerified: false`.
- No selected office is defaulted in the form. Both forms/lists identify the
  central owner and label optional context as non-authoritative. Review filters
  combine historical department and reporting Company correctly; context never
  changes employee identity, privacy, review eligibility or approval scope.
- Own list/detail, HR queue, withdrawal and decision lookups are scoped to active
  PRIMARY. Exact idempotency includes the optional reporting ID, so reusing a key
  with changed reporting instructions is a conflict. No historical instruction
  or final decision is repaired/reparented/reopened.
- Unapplied migration 16 adds `leave_parent_context_guard` and a BEFORE
  INSERT/UPDATE trigger. SQL rechecks/locks PRIMARY and rejects a different
  companyId. Inserts require the verified parent snapshot and an explicit null or
  valid, active reporting snapshot with non-authoritative flags. Updates do not
  compare historical display names with today's names; existing immutable-row
  and before/after audit guards continue to preserve those instructions.
- This is an invoker trigger with fixed search path and revoked PUBLIC EXECUTE;
  current runtime SELECT/UPDATE rights on configured Company records support the
  existing lock mechanism. No SECURITY DEFINER, role or grant was added. The
  reviewed profile owns/grants the new function under the migration identity.
  Runtime startup and actual guarded operations pass. DBA/backend trust limits
  described above still apply.

### Revised migration / deployment artifact

Applied 1–14 remain byte/checksum-identical. Migration 15 remains unchanged and
deferred. Only unapplied 16 SQL changed; 17 and schema.prisma are unchanged by 5A.
Both HR Prisma base DDL parity checks still pass; manual trigger SQL is reviewed
and behaviorally exercised separately. The new central guard is a material HR
contract correction: review that focused delta and regenerate/hash the curated
artifact. The old Sprint 5 ZIP/SQL checksum is historical, not the deployment input.

SQL identifiers for this review (SHA-256): deferred 15
`c0a0aad7c3882cc601acfdcccfe8778ee9a623e761a54772186b8d5b01154059`,
revised 16 `87b2dfb8b675fc5ce9e43c895e9e3ca623883126e0995dbc8b4c7b734ed83b17`,
unchanged 17 `1eb72f7b089c29891d309912ddbd20bf1f94fe93196efad49311b5f0554cb6c9`.

Exact HR-only sequence remains: verified original 1–14 baseline, then revised
`20261016000000_leave_request_foundation`, then unchanged
`20261017000000_hr_admin_identity`. Exclude 15 from the private artifact. Do not
rename/reorder source folders, use resolve/db push/reset, or edit Prisma history.
The full-source schema includes pending 15; full-source migrate deploy must not
be used for this HR-only release.

New application acceptance uses `--hr-only-artifact` with the existing isolated
PostgreSQL harness: exactly 16 real successful history entries and original SQL
checksums are verified before application startup, and cash-acknowledgment objects
from 15 are absent. Restricted runtime authentication, leave operations and
payroll/document/fiscal-year/Voucher reads all pass on this actual HR-only schema.
The separate three-role migration rehearsal again verifies curated status exit 0,
full-source status exit 1 (expected pending 15), and later compatibility by applying
15 normally only in the disposable environment. No fake history is used.

### Fresh acceptance

- 73 genuine-auth HR/Admin browser/API assertions: central owner display,
  ownership-injection rejection, optional reporting selection/absence, invalid
  context, global identity, category/configuration, privacy, centralized queue,
  independent approval/rejection, self-decision denial, withdrawal, history,
  permissions, user bindings and responsive UI.
- 47 existing HR PostgreSQL assertions plus 24 new central-ownership assertions:
  exact SQL guard rejection messages, parent fail-closed behavior, optional
  context/filter isolation, idempotency, historical names after master changes,
  before/after audit consistency and rollback. Existing binding/leave concurrency,
  overlap, expiry/revocation and audit-failure tests pass.
- 36 actual payroll browser/API checks on the HR-only schema: preview/readiness,
  exact custom percentages and allocations, DRAFT creation, global uniqueness,
  maker-checker and independent approval, historical payslip/salary sheet, print
  media integrity, existing fiscal-year/Voucher reads; no payments/vouchers created.
- 142 focused Employee/Attendance/payroll offline regressions, the new ownership
  behavior test, API/frontend/verifier TypeScript, Prisma validation, both HR
  migration parity checks, targeted lint, frontend build and diff checks passed.
  Offline doubles are not presented as PostgreSQL evidence.
- Salary-dev remains at 14 applied migrations. Read-only preservation again
  verifies all 50 table fingerprints, exact existing migration checksums and the
  recorded backup SHA-256. No salary-dev schema/ACL/user/binding/business changes.
  The unchanged verified Sprint 5 backup remains the recovery prerequisite;
  no redundant restore rehearsal was needed. The new deployment sequence was
  reconstructed from the validated 14-migration baseline in disposable PostgreSQL.

### Activation and recovery gates

Use the ordered deployment/recovery plan above with the revised 16 checksum.
Obtain independent approval of the focused owner-guard change and exact curated
artifact, then separate deployment authorization. At the maintenance window,
reconfirm target localhost:55532, PostgreSQL 17, salary-dev identity, 14 checksums,
zero partial HR objects, PRIMARY, writer state and backup fingerprints. If data
changed, refresh/rehearse backup before any deployment. After authorized 16/17
deployment apply only the reviewed profile with existing roles, attest runtime,
verify SQL guards/constraints/history and run the focused legacy/HR smoke checks.

If anything fails, stop further changes, retain target/history/logs/backup, diagnose
in an isolated restore and obtain specific recovery authorization. Never silently
overwrite the target or fabricate migration status. Genuine Administrator/HR IDs
and an independent authorizer must still come from the owner, followed by audited
bootstrap, explicit permissions, verified bindings and approved categories. The
central-ownership policy does not designate any actual identity or leave benefit.

Verdict: **PARTIAL operational readiness; central correction and HR-only technical
acceptance PASS.** No deployment or next sprint is authorized by these results.

## Sprint 6 — authorized HR-only deployment and security acceptance

### Applied state and target

Authorized local target verified independently before writes and again afterward:
`localhost:55532/real_capita_accounts_salary_dev`, PostgreSQL **17.11**. PRIMARY
remains active Real Capita Group / Real Capita Group Ltd with unchanged identity.
Branch Joy and all accumulated uncommitted work remain preserved.

Final Prisma history is the original 14 migrations listed above, unchanged, then:

15th applied entry: `20261016000000_leave_request_foundation` — successful,
checksum `87b2dfb8b675fc5ce9e43c895e9e3ca623883126e0995dbc8b4c7b734ed83b17`.

16th applied entry: `20261017000000_hr_admin_identity` — successful,
checksum `1eb72f7b089c29891d309912ddbd20bf1f94fe93196efad49311b5f0554cb6c9`.

`20261015000000_payroll_confirmation_evidence` is still the **only pending**
migration. No history row, CASH acknowledgment table or confirmation/coverage/
private-parent-lock function from that migration exists. Its source is unchanged.
All 16 actual history entries are finished with no failure/rollback entry. Curated
Prisma status exits 0; full-source status exits 1 correctly reports the deferred
migration, not a failed deployment. No resolve/manual history edits were used.

### Fresh backup and maintenance gate

- Fresh custom archive outside Git:
  `E:\Joy\salary-dev-backups\hr-sprint6-9888f0007cab4c36983f1536b46bb28a\salary-dev.dump`.
- 358940 bytes; SHA-256
  `3581cd085fb737919d0290f30b6ed04b150a83e7f5e0c34a969666635de20d6f`.
- Snapshot-consistent catalog and full extraction pass. Actual restoration into a
  separate labelled PostgreSQL 17 tmpfs instance matched all 50 baseline table
  counts/content fingerprints and history; zero unvalidated constraints. The
  exact owned instance was removed. Ownership/ACL restore was intentionally
  excluded and remains a separate recovery operation.
- Baseline matched the independently recorded Sprint 5A data. No other client
  sessions existed. Windows E: had approximately 13.7 GB free; the database
  filesystem passed the required 1 GiB headroom check. Migration-owner CREATE
  permissions and three existing restricted identities were verified.
- Runtime/finance CONNECT was temporarily revoked **only on salary-dev** to
  prevent new writers. No sessions were indiscriminately terminated. Existing
  credentials, role attributes/memberships and other databases were untouched.
  Successful acceptance restored the exact original connection ACL.

### Exact execution and installed objects

`scripts/db/deploy-hr-salary-dev.ts --approved-sprint6` used the existing private
DPAPI maintenance source and migration identity. The ordinary API never received
those secrets. A retained curated artifact includes original 1–14 plus only
approved 16/17; its private config points explicitly at that directory. The full
pending directory was never deployed. Existing roles/passwords were not created,
rotated or broadened. No source migration/schema was edited in this sprint.

Actual catalog verification passes: six new HR tables, two enums, **10 exact
reviewed guard bodies, 20 enabled triggers, 12 explicit indexes and 17 restrictive
foreign keys**. Partial active-binding/grant uniqueness, global leave date
exclusion, final-state/authority constraints, deferred atomic audit events,
immutable history and PRIMARY owner/context guards are installed. All constraints
are validated. Live Prisma model diff is clean against deployed HR schema with
deferred-15 fields excluded and the already verified UTC text-cast normalization.

### Effective HR-only ACL delta

Only reviewed HR object and account-administration permissions changed:

| Object | Added runtime permission |
|---|---|
| Six HR tables | SELECT and INSERT |
| leave_requests | UPDATE status/version, withdrawal and review metadata columns only |
| leave_categories | UPDATE code/name/description/isActive/version only |
| user_permissions | UPDATE revokedAt/revokedById only |
| employee_account_bindings | UPDATE unboundAt/unboundById only |
| users | INSERT; UPDATE email/fullName/isActive/adminVersion only, retaining previous login/update timestamp permissions |
| user_roles | INSERT and DELETE, retaining SELECT |

PUBLIC has no new HR table privileges. Runtime has no HR history DELETE/TRUNCATE,
passwordHash UPDATE, ownership, trigger-management or role-administration rights.
New CUID models require no sequences. Existing table/sequence/column/function
permissions outside users/user_roles and the new HR objects were compared before
and after and remained unchanged. Existing finance permissions were not broadened.
No new function EXECUTE, schema privilege, database role or privileged credential
was introduced. Full before/after metadata is retained outside Git in the backup
directory; the source subset is `scripts/db/hr-runtime-privileges.ts`.

Actual runtime attestation passes: non-owner, NOSUPERUSER/NOCREATEDB/NOCREATEROLE/
NOBYPASSRLS/NOREPLICATION, no memberships or owner/private-finance SET ROLE.
14 live rollback-only denial probes passed: schema/trigger changes, protected
history deletion/truncation, migration-history access, role assumption, and default
inserts into users/grants/bindings/categories/leave without trusted authority.
No probe retained any record. SQL actor context remains a trusted-backend boundary;
this does not claim cryptographic end-user database identity or protection from a
privileged DBA. Existing explicitly documented trust limits remain unchanged.

### Application and functional acceptance

A **separate runtime-only child process** started actual Nest/Prisma against
salary-dev. It inherited no maintenance, migration or finance secret/configuration.
Health, 15 HTTP authentication denials, 17 model reads, Employee list/search/detail,
FiscalYear/Voucher service reads, Payroll list and read-only preview passed.
Preview remained BLOCKED for incomplete real evidence; no DRAFT was created.
Users authority flags were false and management denied; Leave capabilities were
BLOCKED for unconfigured authoritative identity, and review access was denied.

There is no approved business payroll and no supplied genuine browser session.
Live positive document/print and authenticated HR browser flows are **NOT TESTABLE**
under those preconditions; no session/token, real user, approved payroll or binding
was fabricated. Positive functional acceptance uses genuine cookie authentication
and actual approved/finalized workflows only in disposable synthetic environments.
The temporary runtime smoke process was closed after acceptance; normal .env,
credentials and application configuration remain unchanged.

Fresh isolated acceptance: 73 HR/Admin browser/API checks, 47 existing plus 24
central-ownership PostgreSQL assertions, and 36 Payroll/document/print and legacy
HTTP browser/API checks passed on curated HR-only schemas. The new catalog/HR ACL
subset was also exercised in the isolated migration rehearsal. Focused Employee,
Attendance, payroll read/calculation/approval/preview/document regressions, Prisma
validation/parity, API/web/verifier TypeScript, targeted lint, frontend build and
diff checks passed. In-memory regressions are not labelled database acceptance.

### Business preservation and evidence

Original 50 table counts and business content are preserved. The only permitted
differences are two genuine Prisma history rows and User.adminVersion default 1;
canonical comparisons explicitly exclude that added column, and its default was
verified independently. All six HR tables remain empty: no genuine grant, binding,
category, request, approval or administration event was inserted. There are now
56 public tables. No original financial/employee/attendance records changed.

Retained outside-Git evidence in the fresh backup directory: preflight and restore
reports, original backup, curated artifact/config, before/after ACLs and fingerprints,
CLI exit/selection, runtime-only smoke report, clean schema diff, deployment result
and independent read-only final acceptance. No secrets are written to those
reports. `scripts/db/verify-hr-salary-dev.ts` is the read-only Sprint 6 verifier;
the older preflight intentionally expects 14 migrations and must not be used as a
post-deployment check. Do not rerun the deployment script after successful apply.

### Recovery and genuine onboarding

If a later problem appears: stop identified writers, retain target/history and
this backup, inspect in an isolated restore, then obtain explicit authorization
for any recovery/cutover. Never automatically restore over salary-dev or fabricate
migration status. Restoring the 14-migration backup would also require a reviewed
ownership/ACL and application-version recovery plan; this is not an unattended
rollback recipe. Migration 15 must remain deferred until separately authorized.

Technical deployment verdict: **PASS; ready for separately authorized genuine
onboarding.** Obtain owner-designated actual System Administrator recipient and
independent authorizer User IDs, scope/expiry and private identity evidence. Perform
only a separately authorized audited first designation, then normal Users UI
assigns HR/Admin separately and verifies unique global Employee bindings. HR may
activate only approved category definitions. Finally verify genuine login, own
privacy and independent review without inventing leave benefits or deductions.
No real designation, category activation, request or approval was performed here.
