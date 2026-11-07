# Real Capita HR administration onboarding and deployment

## Sprint 7F — current secure onboarding process

The [Sprint 7F implementation record](sprint7f-implementation-plan.md) and
[acceptance/readiness report](sprint7f-onboarding-acceptance.md) supersede the
historical first-Administrator and missing-bridge instructions below. Source for
secure claiming, independent MD onboarding, specialized permissions and private
execution is implemented. Migration 20 is unapplied; migration 15 stays deferred.
No genuine nominee is identity-verified or activated, and real delivery/issuer,
private OS/database configuration and authoritative Employee IDs remain missing.

An initial registrar needs a genuine authenticated ERP session plus independently
signed `INITIAL_REGISTRAR` evidence; developer access is insufficient. Email claim
consumption alone keeps the account inactive until independent identity/Employee
verification. Salam's company authorization to attest to the initial MD appointment
must be independently verified before, and separately from, later MD delegation.
The MD ceremony consumes a short-lived independent attestation/bootstrap once.

Verified bound recipients may request their own SYSTEM_ADMIN, ACCOUNTANT or
HR_ADMIN responsibility; only an independent live MD approval makes the request
effective. The AGM's dynamic Role Management delegation is separately bounded.
`REPLACE_ACCOUNT` supports evidenced non-MD replacement without transferring
privileges. Independent company recovery evidence permits MD root revocation;
new MD replacement/reissue remains closed. Genuine credentials and evidence must
be collected through the local private authenticated process, never chat or logs.
The HR→MD leave policy remains unchanged. Earlier sections are retained as history,
not alternative permission-grant or bootstrap procedures.

## Sprint 7E — current onboarding gate

Authority 18 and staged-leave 19 are deployed on the dedicated salary-dev database; migration 15 remains deferred. Deployment does not authorize people. MD Arifuzzaman Babu still needs independently verified account/Employee binding, a distinct initial authorizer and secure one-use claim verification. The private authority executor remains unconfigured (default 503), with protected commands executable only by the migration owner. The protected legacy permission onboarding bridge remains closed. MD delegation to AGM Abdus Salam, HR/Admin authorization for A H M Tareq, approved categories and authenticated real-user acceptance require separate authorization. No person was provisioned. See [Sprint 7E deployment and readiness](sprint7e-deployment-acceptance.md); earlier deployment-pending statements below are historical.

## Sprint 7D — current onboarding gate (supersedes earlier HR-final policy)

The owner approved mandatory HR recommendation followed by independent MD final
leave decision. No genuine MD account, identity proof or authority was activated.
Migration 18 and additive 19 remain source-only; payment migration 15 stays deferred.
See [the exact deployment and authority review](sprint7d-deployment-review.md).

Required real steps: supply the MD's genuine account identifier; establish personal
account control and a distinct independently authorized bootstrap authorizer; obtain
reviewed private claim verification and OS/service-isolated authority execution;
separately approve curated 18/19 deployment and ACLs. Complete the guarded one-time
claim, then separately designate verified HR/Admin and employee bindings through an
approved protected legacy-permission bridge, which is not yet implemented. No email,
title, departmental mailbox, ACCOUNTANT or SYSTEM_ADMIN status substitutes for proof.
HR may recommend but only live protected MD authority finalizes. MD own leave stays
blocked pending an explicit exception policy. Stale recommendations/legacy pending
requests need a separately auditable revision/adoption policy; no silent overwrite.


Current update — Sprint 7C: granular module permissions, backend adapters and
permission-driven navigation are implemented and tested only with isolated technical
identities. Read [Sprint 7C integration and activation gates](sprint7c-permission-integration.md).
Migration 18 is still unapplied; no real MD, delegate, user permission or binding
was created. A legacy SYSTEM_ADMIN or HR_ADMIN grant must not be inferred from a
dynamic role. The protected MD-to-specialized-permission provisioning bridge and
combined MD/HR leave final-decision rule remain closed pending reviewed contracts.
Existing pre-MD workflows remain available under their existing authorization.

Current status — Sprint 7B: Arifuzzaman Babu (MD) is the highest proposed initial
authority; Salam's administration follows MD delegation and Tareq's HR authority
remains separate. This supersedes the older Salam-first bootstrap assumption below.
No MD email/verified account or independent claim provider was supplied. The new
authority migration is source-only and unapplied. Real activation stays closed.
See [MD-first authority matrix](real-capita-authority-matrix.md) for implemented
scope, private ceremony, missing adapters, exact file list and safe activation steps.
Do not execute the historical first-Administrator instructions as a substitute.

Previous status — Sprint 7A: all six supplied departmental email accounts and both
personal accounts are absent in salary-dev. No company_* roles are persisted or
defined by the inspected authorization/seed configuration. A controlled pending
account reservation API/UI is implemented and tested in isolation. Genuine
creation and activation remain blocked by the first-Administrator and identity
verification gates; no business account or authority was provisioned.

Previous status — Sprint 7: the owner nominated Salam for System Administrator and
Tareq for HR/Admin, subject to verified accounts and independent authorization.
Restricted read-only inspection found neither nominated account. No account,
permission, binding or category was created. Genuine onboarding remains BLOCKED;
see the Sprint 7 findings below. The deployed state remains the Sprint 6 state.

Deployment status — Sprint 6: leave migration `20261016000000_leave_request_foundation`
and identity migration `20261017000000_hr_admin_identity` are now successfully
applied to salary-dev with the reviewed HR-only runtime grants. Payment evidence
migration 15 remains deferred. No genuine System Administrator, HR/Admin, employee
binding, category, leave request or business approval was provisioned. Use the Sprint 6
section of deployment-readiness.md for deployment evidence and recovery state.

## Authority model

- Existing `ACCOUNTANT` Role/UserRole membership remains the sole accounting role. It does not confer user administration, employee identity or leave-review authority.
- `UserPermission` adds exactly two explicitly approved permissions: `SYSTEM_ADMIN` and `HR_ADMIN`. Existing Role/UserRole storage has no grantor, expiry, immutable authorization instructions or revocation lifecycle; it is retained for ACCOUNTANT while the additive grant model supplies those requirements.
- An active System Administrator may provision other accounts, assign/remove ACCOUNTANT, grant/revoke these permissions, and verify/release employee bindings. Self-administration is blocked; another designated Administrator must change the Administrator's own account, identity or permissions.
- A System Administrator has no implicit HR authority. An HR/Admin has no implicit account-management or accounting authority. Department and reporting relationships confer none.
- Binding is an explicit, independently documented Administrator action, never an email/name match. One current user and one current global employee are unique in both directions. Rebinding releases the previous row and creates a new historical identity record atomically. Inactive/deleted employees do not establish self-service/reviewer identity. Inactive users cannot authenticate.
- HR/Admin may configure active categories and submit on behalf with recorded actor/permission provenance. Own request access and pending withdrawal use the current verified employee binding, including requests created by HR. Review requires HR permission plus a verified reviewer employee identity so self-leave can be detected. An HR/Admin cannot decide their own employee leave. A creator of an original self-service request remains blocked after rebinding as well. An authorized HR/Admin may decide a recorded on-behalf request for a different employee; no additional creator/checker policy is inferred for that case. Own leave requires another authorized HR/Admin. If none exists, the request remains pending. No reopening or final correction path exists.

## Historical first designation — superseded by the MD-first matrix

Sprint 6 cleared the schema/runtime deployment gate only. The next operation still
requires explicit owner designation of actual existing User IDs and an independent
authorizing User identity, permission scope/expiry and verified binding evidence.
Do not rerun the HR deployment script or deploy migration 15 to perform onboarding.
Use the private maintenance mechanism for a separately authorized, fully audited
first designation. Then use normal Users UI for separate HR permission assignment
and verified global Employee bindings, and HR UI for approved category activation.
No existing ACCOUNTANT is automatically entitled to these permissions. Keep the
first Administrator's own permission/binding changes with another independently
designated Administrator. Only after these steps can genuine live browser
acceptance be performed; isolated fixtures are not production designation.

1. Obtain explicit business-owner designation of the actual existing User ID(s), permission scope, expiry where applicable, and the independently identified authorizing/operator identity. These policies alone do not designate anyone. Do not infer a designation from job title, ACCOUNTANT, name, email or a free-text reference.
2. Verify those real account identities independently. Record the owner approval, maintenance operator identity and justification outside public application logs under the existing private operational controls. The durable grant must reference the genuine authorizing User identity, different from the recipient. If those identities are not available, STOP; do not create placeholders or use an arbitrary existing user as grantor.
3. Verify the completed Sprint 6 HR-only deployment, exact 16-entry history, runtime privilege assertions, backup and unchanged business baseline. Do not redeploy 16/17 or apply pending 15 to perform onboarding. Any later schema change requires its own reviewed migration and authorization. Sprint 6 authorized deployment only, not genuine designation.
4. Follow `docs/operations/postgresql-privilege-separation.md`: normal API uses only the restricted runtime identity. Only the private reviewed migration/maintenance workflow may install the schema/profile and perform an explicitly authorized first designation. No maintenance credentials enter public HTTP handlers, web environment or Git.
5. An authorized maintenance operator must create the initial grant with actual recipient/grantor IDs and approved scope/expiry, plus durable UserAdminEvent/global audit evidence of the designation. The table-owner bootstrap exception is for this separately controlled operation, not ordinary runtime use. There is no automatic startup seed, environment bypass, default Administrator/password or public bootstrap endpoint. Do not bootstrap through runtime SQL pretending to be another actor.
6. After genuine first designation, use `/app/users` and the authenticated Users API for all supported account, permission and binding changes. Supply independently verified binding documentation. Do not use a textual reference as a substitute for Administrator authority or actual identity verification. Appoint a separate System Administrator if the first Administrator needs their own profile/binding/permissions changed.
7. Verify genuine login, active/expired/revoked permission behavior and session revocation with the approved identities, without manufacturing business leave. Separately designate HR/Admin and bind reviewers to their global employee identities. No System Administrator automatically receives HR privileges.

No private credential or real identity assignment is supplied by this document. If the required genuine designation/authorizer cannot be established, live provisioning stays BLOCKED.

## Migration and runtime rollout boundaries

Sprint 5A central-ownership policy: every LeaveRequest.companyId references the
active PRIMARY Company. An authenticated caller cannot supply ownership. Optional
office/company reporting context is stored separately in the immutable JSON
snapshot and is explicitly not verified employee assignment or authorization.
There is no separate Office model or Company parent hierarchy in this schema;
only active configured Company records may be supplied as reporting context.
HR approval remains centralized, with unchanged explicit permission/binding and
self-decision safeguards. The added guard is now installed by migration 16 with
its approved checksum; do not edit that applied migration. No additional runtime
grant is necessary to make separately authorized genuine designations.

Sprint 5A reviewed the exact order and curated migration process. Sprint 6 applied
only approved 16/17. Follow [deployment readiness](sprint5-deployment-readiness.md)
for the retained artifact, fresh backup/restore evidence, current state and recovery
gates. Do not run full-source migrate deploy: it would apply the still-unrelated
pending confirmation-evidence migration. Do not rerun the one-shot HR deployment.

- `20261016000000_leave_request_foundation` and `20261017000000_hr_admin_identity` are both successfully applied to salary-dev; their SQL is now immutable. Prisma base DDL parity and exact installed guard bodies are checked independently of manually authored constraints/triggers. Any future correction needs a new separately reviewed migration.
- New tables: user_permissions, employee_account_bindings and user_admin_events. New User adminVersion supplies optimistic concurrency; category description/version supports audited configuration. Existing Employee is extended only with a relation, not duplicated/scoped per office.
- The reviewed HR-only subset in `scripts/db/hr-runtime-privileges.ts` is installed. `scripts/db/role-profile.ts` remains the full desired-profile reference; do not rerun broad provisioning merely to designate users. Runtime retains non-owner/non-superuser status and cannot modify schema/disable triggers. Finance provisioning and confirmation privileges are unchanged; HR permissions confer none of them.
- Grant/binding active uniqueness is database-backed. Revocation/release preserves old rows; expired unreleased grants must be explicitly revoked before renewed assignment. Audit history is immutable and user-version changes require atomic matching administration events. Historical request instructions and before/after events remain protected.
- Users, role membership, grants, bindings, category writes and leave transitions have SQL actor/authority checks. Guarded services set transaction-local actor context from authenticated server identity. Clock expiry is checked at protected SQL operations. Actor-user locks serialize protected writes with revocation/rebinding; application transactions are Serializable and stale/duplicate/serialization conflicts return controlled errors.
- SQL actor context is a backend trust boundary, not cryptographic PostgreSQL end-user authentication. A fully compromised runtime capable of arbitrary SQL could claim a genuinely configured actor ID; do not claim protection against that threat or privileged database administrators. The runtime cannot invent authority merely by a false flag when no legitimate grant/binding exists, and cannot own/disable guards. Trigger functions are invoker functions with fixed search paths and no PUBLIC execute grants.
- Deploy application/schema/profile coherently. The updated authority/access checks fail closed when HR tables are absent. Legacy ACCOUNTANT login/authentication explicitly select established User fields so the new adminVersion column is not required for those auth queries before rollout. New administration/leave operations require their reviewed migrations and grants; do not claim live acceptance against an unmigrated environment.

## Audit and privacy

Every application account action includes authenticated actor, target, reason and credential-free before/after snapshots in UserAdminEvent and AuditEvent, atomically. Permission grants, revocations and bindings retain immutable original instructions and identities. All account changes revoke target sessions; permission expiry is also checked on each sensitive operation. Administrator history is paginated; category history is paginated and HR-only. Password hashes, session tokens and initial passwords are never response/audit fields. Initial passwords are bcrypt-hashed, at least 12 characters and no more than 72 UTF-8 bytes; deliver real credentials only through an approved private channel. Password reset/recovery is not implemented by this sprint.

Employee leave responses are scoped by verified global employee ID. HR review is a separately authorized queue. Historical names, departments, offices, category labels, sources and decisions are preserved in request snapshots; source configuration changes do not rewrite final leave. Approval never updates attendance, payroll, balances, paid/unpaid treatment or deductions. No quotas or holiday policy are inferred.

## Verification

Use the existing isolated harness only:

- `pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/verify-database-role-security.ts --hr-admin-sprint4 --hr-only-artifact`
- Same command with `--hr4-db-only` for focused real PostgreSQL regression after browser acceptance.
- `pnpm exec tsx scripts/verify-hr-admin-foundation.ts`
- `pnpm exec tsx scripts/verify-leave-foundation.ts`

The harness creates a unique PostgreSQL 17 tmpfs instance on a random loopback port, verifies identity, deploys candidate migrations and the reviewed restricted runtime profile only there, and removes only its verified task-owned resources. Its sole first System Administrator designation is explicitly synthetic maintenance bootstrap. All subsequent test provisioning/bindings/HR grants use genuine application services and actual cookie authentication for browser/API acceptance. No test provider substitutes business authority, and no result proves genuine production designation. Credentials and result files are temporary outside Git; only a task-owned browser scenario copy may be placed in the ignored Playwright directory and is removed afterward.

## Sprint 7 — nominated identities and actual activation gate

The business owner conditionally nominated these people. This records the requested
allocation, not completed authentication, appointment or permission assignment.

| Candidate | Intended authority | Actual salary-dev finding |
|---|---|---|
| AGM Abdus Salam — [private onboarding email] | SYSTEM_ADMIN; preserve existing ACCOUNTANT rights if present | No account found by case-insensitive exact email lookup. No authentication identity or ownership established. Nothing assigned. |
| A H M Tareq — [private onboarding email] | HR_ADMIN only; possible independent bootstrap reviewer subject to verification | No account found by case-insensitive exact email lookup. No independent authorizing User identity established. Nothing assigned. |

Inspection used `rc_salary_runtime`, forced read-only, after checking
`localhost:55532/real_capita_accounts_salary_dev` and PostgreSQL 17.11. One existing
User and the ACCOUNTANT role exist. There are zero permission grants, employee
bindings, administration events, categories, leave requests and payroll runs.
No unrelated account identity or authentication material was copied into this
document. Exact candidate-name/email Employee discovery returned no matches; this
is a discovery result only, not proof that no differently recorded Employee exists.

The User model has no email-ownership verification field. AuthController offers
password login, session inspection and logout; it has no registration, invitation
or verified first-account onboarding endpoint. Password login, even if later
successful, is not independent proof of the nominated person's identity. No
password guesses, session forging or credential resets were attempted.

### Minimum remaining operational steps

1. Verify both people and the separate authorizing/operator identity through the
   owner's private identity-verification process. Retain actual evidence privately;
   do not send passwords, identity documents or tokens in chat or commit them.
   Tareq's proposed allocation alone cannot establish an existing independent
   authorizing User or grant him System Administrator authority.
2. Explicitly authorize and review the missing first-account provisioning step.
   The implemented `UsersService.create` / Users interface requires an already
   authorized System Administrator. None exists, and both recipients are absent.
   The documented maintenance first-grant procedure assumes actual existing User
   IDs; it does not implement an invitation or missing-account bootstrap workflow.
   Do not bypass this dependency with direct permission inserts, arbitrary grantors,
   default passwords or the unrelated existing ACCOUNTANT. A separately controlled,
   auditable maintenance provisioning procedure with securely delivered credentials
   must be reviewed before using it for these initial accounts. Ordinary account
   creation can use the existing Users interface after valid first designation.
3. Once genuine accounts and a distinct verified authorizing User exist, perform
   the authorized private first designation with actual IDs and atomic local/global
   audit evidence. Then authenticate as Salam and use the Users workflow to grant
   Tareq HR_ADMIN explicitly. Do not grant Tareq SYSTEM_ADMIN automatically.
4. An authorized Administrator must independently verify and select each global
   Employee identity before binding it. Another designated Administrator is needed
   for Salam's own binding because self-administration is forbidden. Tareq needs a
   valid binding before leave review so own-employee decisions can be rejected.
5. Obtain actual approved category names/codes before HR/Admin activates categories.
   Configuration stays empty; no entitlements, payment treatment or deductions are
   inferred. Genuine live acceptance follows login and these activation gates.

### Fresh Sprint 7 verification and preservation

- Independent read-only post-deployment verification passed: 16 successful exact
  migration entries, original 14 history fingerprints/checksums unchanged, applied
  HR 16/17 unchanged, and evidence migration 15 plus its objects absent. All 50
  historical table checks passed excluding the approved schema/history additions.
- Runtime remains non-superuser/non-owner, with no CREATEDB, CREATEROLE,
  BYPASSRLS or elevated role membership. No database security changes were made.
- Actual restricted-runtime Nest/Prisma startup, health, 15 unauthenticated HTTP
  denials, 17 model reads, Employee list/search/detail, Accounting/Voucher reads,
  Payroll list/blocked preview and Users/Leave fail-closed checks passed.
- Isolated genuine-auth browser/API acceptance passed 73 assertions. Real isolated
  PostgreSQL acceptance passed 47 authority/identity/lifecycle assertions plus 24
  central-ownership assertions. The synthetic first Administrator bootstrap was
  confined to the disposable database. Its database, tmpfs container, private
  builds and task-owned browser scenario were removed.
- Payroll read/auth (20), approval (8), preview (5) and historical documents (8)
  offline regressions passed. HR and leave migration parity and Prisma validation
  passed. API/web TypeScript and targeted lint results are recorded with the final
  Sprint 7 assessment in the feature-status document.

No genuine permission, account, binding, category, leave, payroll, attendance,
salary or accounting record changed. No protected database or Aafiyat was accessed.
Read-only acceptance evidence is retained outside Git beside the Sprint 6 backup:
`E:\Joy\salary-dev-backups\hr-sprint6-9888f0007cab4c36983f1536b46bb28a\hr-final-sprint-seven.json`
and `hr-sprint-seven-runtime-smoke.json`. No migration or application feature was
changed to circumvent the onboarding gate.

## Sprint 7A — company-account reconciliation and pending provisioning

Read-only inspection used the restricted runtime against independently verified
`localhost:55532/real_capita_accounts_salary_dev`, PostgreSQL 17.11. Matching email
strings only discovers records; it cannot verify a person or mailbox ownership.

| Supplied mailbox | Supplied role label | Actual account / assigned role |
|---|---|---|
| [private onboarding email] | company_admin | Account absent; role absent; no assignment |
| [private onboarding email] | company_accountant | Account absent; role absent; no assignment |
| [private onboarding email] | company_hr | Account absent; role absent; no assignment |
| [private onboarding email] | company_payroll | Account absent; role absent; no assignment |
| [private onboarding email] | company_sales | Account absent; role absent; no assignment |
| [private onboarding email] | company_member | Account absent; role absent; no assignment |

There is no basis to classify those absent accounts as verified personal, shared
or seeded identities in this database. They may refer to another environment;
none was accessed to look for them. The one existing User matches the inspected
development seed's email/name, which establishes neither a nominated person's
identity nor a genuine independent bootstrap authorizer. No development credential
was used for live authentication. No account name or email was rewritten.

Both nominated personal emails remain absent. Exact nominated-name User discovery
also returned no matches. Four global Employees exist, but candidate-name/email
discovery returned no matches and no authoritative personnel identifiers were
provided. Whether either person has a differently recorded Employee or account
therefore remains unverified. Obtain the existing Employee Code or immutable
Employee ID from the personnel register, plus independent private identity
verification. Do not request identity documents or credentials in public chat,
derive a binding from names/email, or create duplicate Employees.

### Role compatibility without implicit elevation

Only ACCOUNTANT exists in Role/UserRole. AuthService and AuthGuard recognize that
exact code for accounting access. HR_ADMIN and SYSTEM_ADMIN are separately
audited, revocable UserPermission grants, not company-role aliases.

| Proposed label | Compatibility / safe mapping boundary |
|---|---|
| company_admin | No effective authority. A separately verified SYSTEM_ADMIN designation is required; no automatic alias. |
| company_accountant | Intended accounting scope corresponds to existing ACCOUNTANT, but the label alone confers nothing. Preserve or explicitly assign the real ACCOUNTANT membership through an authorized Administrator. |
| company_hr | Intended leave scope corresponds to explicit HR_ADMIN; an independently verified grant and reviewer Employee binding remain required. No automatic role conversion. |
| company_payroll | No implemented standalone permission contract. Do not infer accounting, Administrator or HR access. |
| company_sales | No implemented authorization contract; no HR/Admin or System Administrator authority. |
| company_member | No employee identity authority. Self-service requires the verified one-to-one Employee binding. |

No duplicate roles, role imports or production permission mappings were created.
Existing Users detail displays stored role names where present. Unknown labels do
not become effective privileges. Isolated PostgreSQL negative fixtures verify all
six labels together cannot authenticate or supply HR/Admin authority; a separate
authorized ACCOUNTANT assignment enables only the existing accounting scope.

### Controlled pending-account implementation

- `POST /users/pending` requires real authenticated SYSTEM_ADMIN permission,
  rechecked after locking the initiating User inside a Serializable transaction.
  It accepts only email, fullName and a documented reason. Actor identity is
  server-derived; callers cannot supply activation, role, binding, password or
  verification fields.
- A pending User is created inactive with no roles, permissions or bindings. A
  discarded OS-cryptographic 32-byte random value is bcrypt-hashed solely to
  satisfy existing passwordHash storage. No password, token, email, invitation
  link or session is issued. The random value is never returned or audited.
- Immutable `PENDING_CREATED` UserAdminEvent and matching AuditEvent retain the
  initiating Administrator and credential-free snapshot atomically. Existing
  email uniqueness and controlled concurrency conflicts apply. Audit failure
  rolls back the User and both histories.
- Users offers a clearly labelled pending reservation option without a password
  field. Details identify unresolved verification. ACTIVATE, SET_ACCOUNTANT,
  GRANT_PERMISSION and BIND are denied server-side for pending-created accounts;
  corresponding UI actions are disabled. Safe editing does not erase the pending
  history or bypass the gate. Pending markers are found across all history, not
  only the first display page. Duplicate password-based creation cannot replace
  the reserved account. Deactivation/revocation/release remain possible.
- No claim-completion or activation provider is configured or implemented. This
  is an inert reservation foundation, not proof of verified email/person identity
  or a completed invitation workflow. No caller flag/reference can complete it.
  Any future secure account-claim ceremony needs separately reviewed identity
  verification, private credential delivery and explicit authority before release.
- These pending lifecycle gates are application controls using existing immutable
  audit storage, not new PostgreSQL activation constraints. Existing SQL actor and
  audit guards remain installed unchanged; a privileged owner/DBA remains outside
  the application immutability boundary. No migration/schema/ACL change was made.

No genuine pending account was created in Sprint 7A. The user's authorization for
inert personal onboarding does not supply an independently verified initiating
User. Existing production APIs still correctly require an authorized Administrator;
maintenance credentials are not a substitute for a human authorizer. No bootstrap
exception, temporary Administrator or arbitrary seed-user grantor was introduced.

### Remaining genuine activation steps

1. Establish the two personal identities and a distinct independent onboarding
   authorizer/operator through the approved private process. Departmental mailboxes
   and Tareq's nomination are not verified human identities or automatic authority.
2. Complete a reviewed first-account/bootstrap and secure account-claim ceremony
   with actual identities and durable authorization evidence. No public first-user
   bypass or email ownership provider exists. The pending reservation endpoint is
   available only after legitimate initial Administrator authority is established.
3. Designate Salam SYSTEM_ADMIN and accounting scope only through the approved
   independent mechanism. Use normal Users actions afterwards for Tareq's separate
   HR_ADMIN grant; grant neither SYSTEM_ADMIN nor accounting access to him by default.
4. Verify actual personnel Employee Codes/IDs before binding. Another authorized
   System Administrator is needed for Salam's own binding; a verified Tareq binding
   is required for HR leave review and self-decision protection.
5. Obtain actual leave category codes/names and activate them through authorized
   HR. No quotas, paid/unpaid rules or automatic salary deductions are inferred.
