# Real Capita Group — MD-first authority foundation

## Sprint 7F — current protected onboarding and execution

The technical onboarding bridge is implemented in source; it is not deployed or
configured for genuine people. Migrations 18/19 remain installed, migration 20 is
unapplied, and migration 15 remains deferred. Read [Sprint 7F acceptance and
operational readiness](sprint7f-onboarding-acceptance.md) and the
[implementation record](sprint7f-implementation-plan.md). No supplied email/title
proves individual identity, Employee binding or effective authority.

| Boundary | Required authorization | Scope that does not follow automatically |
|---|---|---|
| Initial registrar | Genuine current ERP session plus independent INITIAL_REGISTRAR evidence | Developer identity, default account or anonymous bootstrap |
| Initial MD authorizer | Verified individual and independently evidenced company appointment authority | Any later powers delegated by the MD |
| Account claim | Single-use privately delivered email capability | Active identity or business permission before independent Employee verification |
| MD activation | Independent company authorization/attestation plus nominated MD account-control proof | Replayed, expired, self-authorized or manually granted root |
| System Administrator / ACCOUNTANT / HR_ADMIN | Verified bound recipient request followed by independent live MD approval | Pending requests, titles or generic custom roles |
| Dynamic Role Management | Explicit current MD delegation and granular permission ceiling | Unbounded AGM authority or protected permission bypass |
| Non-MD account replacement | Independent ACCOUNT_RECOVERY evidence and authoritative Employee verification | Transfer of the old privileged grants |
| MD recovery revocation | Fresh independent company recovery authorization and attestation | New MD replacement/reissue |

The private OS/database executor and ordinary API runtime stay separate. mTLS is
transport authentication; independently signed, session/command/payload-bound
evidence and current database authorization remain mandatory. Missing providers
or private configuration fail closed. Genuine activation and new migration
deployment require their outstanding prerequisites; earlier matrices below remain
historical where they describe an unimplemented bridge or unapplied 18/19.

## Sprint 7D — current mandatory leave authority

This section supersedes earlier HR-only final-decision and combined-rule statements;
older sprint evidence below is retained as history.

| Actor | Current authorized leave scope | Prohibited |
|---|---|---|
| Verified employee | Own submission, status/history, pre-HR withdrawal | Other employees' private requests |
| Explicit HR/Admin + current dynamic permissions | Review another employee; recommend approval/rejection with comments; queue/history within scope | Final decision; own employee review |
| Live actual MD | View pending MD queue, review original request and HR evidence, independently approve/reject | Bypass HR; own leave; own recommendation/request approval |
| AGM / System Administrator / ACCOUNTANT | Only individually granted routine scope | Implicit MD final authority or self-elevation |

Protected leave.md.view and leave.finalize are not assignable custom-role permissions.
HR needs leave.review and leave.recommend plus verified binding/live HR_ADMIN.
Detailed history additionally needs leave.history.view except verified own history.
Both HR outcomes route to MD. Final MD may disagree. Source authority revisions and
revocations invalidate stale proof; final history is immutable through supported
operations. No leave implies salary deductions, attendance edits or payments.

See [Sprint 7D implementation, SQL constraints and deployment gates](sprint7d-deployment-review.md).
Genuine onboarding/private service remains blocked; no actual authority was assigned.


Sprint 7B implementation status: **PARTIAL; source-only and not deployment-ready**.
No genuine identity, permission or business record was changed. The existing
salary-dev deployment still has 16 migrations; evidence migration 15 is deferred.
New migration `20261018000000_md_authority_foundation` is UNAPPLIED there.

## Approved organization and implemented boundary

| Identity / responsibility | Approved policy | Implemented scope / remaining boundary |
|---|---|---|
| MD — Arifuzzaman Babu | Highest initial business authority; protected delegation and MD-required decisions | One-time capability-backed MD mandate, MD-only authority review and private revocation ceremony. No email, account identifier or real verifier supplied. No activation occurred. |
| AGM — Abdus Salam | Accounting and day-to-day operation; administration/role management after MD delegation | Existing ACCOUNTANT remains separate. A verified user may request a bounded role-management mandate; a different MD must approve. SYSTEM_ADMIN/legacy accounting assignment is not automatically created by that mandate. |
| HR — A H M Tareq | HR operations and leave management after MD-authorized onboarding | No accounting/admin authority from title. Personal authority requests route to MD. Existing HR_ADMIN remains separate; its MD grant bridge is not implemented and legacy elevation is closed after MD initialization. |
| Future custom roles | Explicit permissions within grantor ceiling | Existing Role table is extended, not duplicated. Role view is assignable; management requires an MD mandate. No inheritance graph or title/email aliases. |
| Bill approvers | Independently authorized Salam OR MD; creator cannot approve | Approved eligibility contract only. No Bill/Payable approval aggregate exists in schema. Voucher, expense ledger and booking are not reinterpreted as bills. No bill endpoint, payment or posting was added. |

## Canonical permissions and actual integration — Sprint 7C

The expanded registry and module adapters supersede the original four-permission
Sprint 7B boundary. See [Sprint 7C coverage and exact prerequisites](sprint7c-permission-integration.md).
Roles group real actions with fixed existing scopes. Employee/department entry may
use explicit dynamic grants; Accounting, Payroll, Attendance and HR retain their
specialized prerequisites. No title, email alias, frontend selection or pending
request creates authority. Protected MD codes remain unavailable to ordinary roles.
The current effective role must remain within the original grantor ceiling.

Navigation and direct-page checks use backend capabilities; every API independently
checks fresh authority. Before MD activation, existing authorization remains intact.
This source-only integration does not activate genuine authority or deploy migration18.

## Requests, execution and maker-checker

| Operation | Execution rule |
|---|---|
| Personal DELEGATE request | Verified active, bound requester; no access before a different MD approves. Explicit expiry and ceiling required. |
| ROLE_CREATE | Routine within the live mandate ceiling; globally unique code. Reserved MD/AGM/HR/ACCOUNTANT/administrator codes cannot be used for managed roles. |
| ROLE_EDIT name/description or deactivation | Routine within ceiling and expected role version. Complete role before/after history retained. |
| ROLE_EDIT permissions or reactivation | Pending until independent MD review; stale role version or changed requester authority rejects execution. |
| ROLE_ASSIGN / ROLE_REVOKE | Pending MD decision, verified independent recipient, current role/grant version and full scope checks. No self-assignment. |
| DELEGATE_REVOKE | Independent requester and MD reviewer; preserves original mandate and request history. |
| CANCEL / EXPIRE | Only requester or MD; pending/version/expiry checks, durable terminal state, no protected execution. |

MD cannot approve their own pending request. A sole MD must have another verified
person initiate a protected change; no second MD is invented. This does not impose
dual bill approval. Routine metadata work is recorded as APPLIED with no fabricated
approver. Protected APPROVED/REJECTED decisions require a distinct MD reviewer.

The private command function holds a deterministic company authority advisory lock,
locks the actor/request/role as appropriate and runs in a Serializable transaction.
Idempotency is actor/key/instruction-bound. Stale/concurrent/duplicate commands return
controlled conflicts. Amounts, payroll snapshots and payments are never touched.
Audit failure rolls back the mutation, request decision and both audit records.

Revocation, expiry, inactive users, released bindings, inactive PRIMARY and inactive
roles remove effective access on subsequent checks. Revoking MD removes downstream
delegation. Consumed bootstrap capabilities cannot be replayed. No automatic root
replacement exists: MD succession/recovery needs a separately reviewed procedure.

## Specialized approval conflicts

Payroll DRAFT/approval retains its accepted ACCOUNTANT maker-checker contract. No MD
stage, payment or accounting posting is silently attached.

The new HR-to-MD routing statement overlaps the prior HR_ADMIN-only leave decision
contract. It does not specify whether MD replaces HR review or is a separate stage.
After an MD mandate is initialized, legacy leave approval/rejection is blocked by
both service and SQL guards until that combined rule is implemented. Submission,
private reads, withdrawal and category configuration keep their established rules.
Before MD initialization, the existing approved leave workflow remains unchanged.

Legacy SYSTEM_ADMIN/HR_ADMIN and ACCOUNTANT elevation cannot bypass MD via old Users
operations after initialization. User provisioning/binding and positive authority
changes remain closed until their MD execution adapters are reviewed. Revocation
is preserved. Existing legacy read access is not represented as a new MD delegation.
The MD account's activation/email and linked personnel deactivation are protected
from ordinary runtime writes; private independent recovery is required.

## Database and private execution trust boundaries

Five additive tables: authority_bootstraps, authority_mandates,
authority_role_grants, authority_requests and authority_events. Existing Role gains
central ownership, creator mandate, permissions, active status and version. User,
Company and related existing models gain relation metadata only.

Foreign keys are restrictive. Partial uniqueness protects the single initial MD,
unreleased delegations and unreleased role grants. New temporal fields use
TIMESTAMPTZ(3), clock_timestamp expiry and versioned state transitions. CHECKs reject
null permission ceilings/managed permission arrays, invalid statuses, chronology,
protected permissions and unsupported role codes. Authority events cannot be updated
or deleted. Instructions and decisions remain in durable requests/history.

The normal runtime receives only required SELECT and read-function EXECUTE. It
cannot mutate protected authority tables, change managed role definitions, execute
the private command, assume its writer role or disable guards. Bootstrap hashes
and provenance are not runtime-readable. PUBLIC cannot execute privileged functions.
Functions have fixed pg_catalog/public/pg_temp search paths and a restricted migration
owner. A distinct private writer has CONNECT/USAGE and only bounded command EXECUTE,
no table DML or elevated membership. No real writer role/credential was provisioned.

The production AuthorityWriter and MdClaimVerifier always return 503. No environment
flag registers a synthetic verifier or private database credential in HTTP handlers.
SqlAuthorityExecutor is an unregistered private-broker building block. It attests
database/actual login/role attributes/ownership and fixes transaction timezone to UTC.
It must not be wired directly into the public API with maintenance credentials.

The future broker must authenticate the server-side actor envelope and independently
verify the authorization ceremony. The private database function trusts that broker's
actor identity; it is not cryptographic PostgreSQL end-user authentication. Compromise
of that trusted executor or a privileged DBA is outside the runtime SQL boundary.
Do not describe actor IDs, mailbox names, hashes or textual references as authority.

## Real MD onboarding — required steps, not performed

1. Obtain the owner's explicit MD personal account identifier/email and a distinct
   independently verified human authorizer/operator. No MD email was supplied.
2. Establish actual personal account control and independent identity evidence using
   an approved private claim/authentication process. No mail/identity provider is
   currently configured. The existing pending-account flow deliberately cannot be
   activated by a claimed reference or Administrator checkbox.
3. Complete the missing secure first-account/claim bridge. The ceremony currently
   requires an existing active personal User with a verified global Employee binding;
   it does not silently provision/activate missing or pending real users. Obtain the
   actual personnel identifiers; do not bind by name/email or create duplicates.
4. Independently review this source migration, privilege profile, missing legacy
   adapters and recovery contract. Seek separate deployment authorization. Use the
   reviewed curated process to preserve applied 1–14/16/17 and defer 15; never deploy
   the entire pending directory indiscriminately.
5. Separately configure a restricted private authority executor and trusted identity
   verifier outside the ordinary API credential boundary. Review its authenticated
   transport. No live provider or service identity is created by this sprint.
6. Authorized maintenance may then issue a short-lived random 256-bit capability
   bound to the verified User, active PRIMARY and distinct verified authorizer,
   recording private independent evidence. Store only its SHA-256 digest in the
   bootstrap table. Never put the secret in source, logs or public API responses.
7. The verified private ceremony consumes that capability exactly once and records
   the mandate, ceremony ID/purpose and atomic audit history. No ordinary runtime SQL
   or self-authorization may insert initial authority.
8. AGM/HR submit personal requests; MD independently reviews exact bounded authority.
   Legacy SYSTEM_ADMIN/HR_ADMIN/ACCOUNTANT bridges and combined leave routing must be
   completed before those powers can be activated through the new model. Bind real
   Employees and activate only owner-specified leave categories through approved flows.
9. Perform genuine authenticated live acceptance without synthetic business records.
   MD replacement after revocation remains a separate recovery-policy decision.

## Executed verification and acceptance limits

- 85 existing authenticated HR/User/Leave/Attendance browser/API assertions and
  14 new authenticated MD/AGM Role Management browser/API assertions passed in
  disposable PostgreSQL fixtures. The role browser found a stale editor-version
  race; the editor now retains its known saved revision and displays the version.
  A fresh-role rerun passed. Stale requests continued to return controlled 409s.
- 102 existing real PostgreSQL HR/identity/ownership assertions passed. The final
  focused authority run passed 54 PostgreSQL/HTTP integration assertions, including
  root/downstream revocation, null-safe versions/ceilings, restricted writer SQL
  denial, protected personnel 403, expiry/replay, MD routing and audit rollback.
  Synthetic independent verification was injected only into the isolated app;
  it is not proof of real identity or business authority.
- Production-default verifier/writer refusal was checked through the service
  contracts and genuine authenticated HTTP: no claim reference enables MD
  activation; the unconfigured claim endpoint returns 503.
- The additive migration applied successfully without evidence migration 15 in
  PostgreSQL 17. Exact Prisma base-DDL parity and SQL/backend registry parity pass.
  Existing HR/leave migration projections remain exact; applied SQL was not edited.
- 150 existing Employee, Attendance and payroll calculation/read/auth/approval/
  preview/document offline checks passed. Targeted API/web/verifier TypeScript,
  targeted lint, Prisma validation and git diff whitespace checks pass. The frontend
  production build passed with 46 static pages, including /app/roles.
- Read-only salary-dev verification passed: 16 unchanged successful migrations,
  original history/business fingerprints preserved, six HR tables empty and neither
  evidence-15 nor authority-18 objects installed. A real restricted, read-only Prisma
  query confirmed the authentication Role projection still works against the older
  deployed schema; auth queries explicitly select only established role fields.
- The final runtime-only salary-dev Nest/Prisma startup, health, 15 unauthenticated
  HTTP denials, legacy service reads, blocked payroll preview and HR fail-closed
  checks passed. The subsequent independent preservation check still matched every
  historical fingerprint. This is non-destructive smoke, not genuine MD login.
- All task-owned disposable databases, tmpfs containers and browser/private-build
  files were cleaned up. No actual business user, role assignment, binding, leave,
  payroll, attendance, salary or accounting record changed. No protected database
  or Aafiyat access occurred. Salary-dev roles, credentials and backup were untouched.

Early runs stopped at missing profile allowlist coverage, a maintenance fixture
identity mismatch, a missing harness argument and a test-string syntax error. Each
failed environment was cleaned up; the corrected focused runs passed. Broader
business permission adapters, the real claim/broker, legacy assignment execution,
combined leave routing and Bill integration are still missing functionality, not
passed acceptance cases. No live authenticated MD acceptance is claimed.

## Exact Sprint 7B source scope

The accumulated worktree contains prior work. Only the following files were added
or changed in Sprint 7B; generated Prisma/build output is excluded:

```text
prisma/schema.prisma
prisma/migrations/20261018000000_md_authority_foundation/migration.sql
apps/api/src/app.module.ts
apps/api/src/authority/permission-registry.ts
apps/api/src/authority/authority-writer.ts
apps/api/src/authority/authority.dto.ts
apps/api/src/authority/authority.service.ts
apps/api/src/authority/authority.controller.ts
apps/api/src/authority/authority.module.ts
apps/api/src/authority/sql-authority-executor.ts
apps/api/src/auth/auth.service.ts
apps/api/src/auth/guards/auth.guard.ts
apps/api/src/users/users.service.ts
apps/api/src/leave/leave.service.ts
apps/api/src/employee/employee.service.ts
apps/web/src/lib/authority-api.ts
apps/web/src/app/app/roles/page.tsx
apps/web/src/app/app/layout.tsx
scripts/verify-authority-contract.ts
scripts/verify-authority-migration.ts
scripts/authority-postgres-acceptance.ts
scripts/authority-browser-scenario.js
scripts/db/authority-privileges.ts
scripts/db/role-profile.ts
scripts/verify-payroll-acceptance.ts
scripts/hr-admin-browser-environment.ts
scripts/verify-hr-admin-foundation.ts
scripts/verify-leave-foundation.ts
docs/hr-admin/administrator-onboarding.md
docs/hr-admin/real-capita-hr-feature-status.md
docs/hr-admin/real-capita-authority-matrix.md
```
