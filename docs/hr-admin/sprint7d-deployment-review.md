# Real Capita Group — Sprint 7D implementation and deployment review

## Verdict and boundary

Technical acceptance passed in disposable PostgreSQL 17 and authenticated synthetic
browser fixtures. Operational readiness is PARTIAL: no genuine MD identity,
independent claim verifier, private authority broker or protected legacy-permission
onboarding bridge is configured. No migration or genuine authority was activated.
Migration 15 remains deferred; 18 and new 19 remain unapplied to salary-dev.
This report supersedes earlier HR-only final-decision and combined-rule blockers.

## Approved lifecycle

| Current public stage | Authorized operation | Next stage / original row version |
|---|---|---|
| New request | Bound employee, or explicitly authorized HR on behalf | PENDING_HR_REVIEW / 1 |
| PENDING_HR_REVIEW | Independent current HR recommends approval OR rejection with comments | PENDING_MD_DECISION / 2 |
| PENDING_HR_REVIEW | Requesting bound employee withdraws | WITHDRAWN / 2 |
| PENDING_MD_DECISION | Independent actual MD approves OR rejects with reason | APPROVED or REJECTED / 3 |
| Final, withdrawn, or legacy pending | No correction, reopening, withdrawal or new decision | Rejected |

Both recommendation outcomes require MD. MD may disagree. HR cannot decide own
employee leave; MD cannot submit own leave under this unresolved exception policy,
review own employee leave, decide a request they created, or finalize their own HR
recommendation. Recommendation is never final approval. No stage changes attendance,
salary, leave allowance, payroll, accounting or payment records.

## Persistence and SQL guarantees

The original leave enum and applied migration files are retained. Additive
LeaveWorkflow stores stage/version; immutable LeaveStageDecision stores separate HR
and MD evidence with restrictive request/user/employee/binding FKs. Unique
(requestId, stage) prevents a second decision. Globally unique idempotency keys replay
only the exact original actor/request/stage/version/decision/comments instruction.
Version/state CHECKs, immutable request hashes, matching transition events and
deferred atomic global-audit checks protect history. Original inclusive overlap and
PRIMARY ownership guards remain effective for both pending stages.

All stage writes pass through leave_stage_command, a bounded SECURITY DEFINER
function with fixed search_path and UTC session contract. Normal runtime has SELECT
only on the two new tables, no stage-function EXECUTE and no stage-table DML. The
private authority principal has narrowly scoped function EXECUTE, no broad table
writes or ownership. Database owner/superuser remains outside these protections.
Caller actor IDs are trusted only from a separately controlled authenticated broker;
a claimed ID alone is not proof of a human identity. That broker is not registered
in the ordinary API configuration, which returns 503 rather than falling back.

Serializable transactions use company advisory serialization followed by re-locking the active PRIMARY row and ordered
row locks for authority mandates, managed roles, grants, user identities, bindings,
permissions and request state. Re-reading/locking actual authority rows after an
advisory wait prevents use of an earlier pre-revocation snapshot; concurrent change
returns a controlled conflict. Clock-time authority expiry is rechecked at execution.
HR proof includes the exact permission grant, verified binding and a database-derived
SHA-256 revision of effective mandate/role/grant sources. MD rejects expired, revoked,
changed or unverifiable HR proof even when an equivalent permission still exists.
There is no silent re-review or correction workaround for stale recommendations.

Global audit failure rolls back decision, original row, workflow and transition
history. Narrow read-only SECURITY DEFINER deferred triggers validate committed audit
coverage without granting private-writer general table reads. Historical rows/events
are not backfilled or rewritten: existing final decisions remain explicitly labelled
LEGACY_HISTORICAL, and old pending requests remain LEGACY_PENDING_BLOCKED until a
separately approved auditable adoption process exists.

## Authorization, endpoints and UI

59 canonical permissions now include leave.recommend, leave.history.view and protected
leave.md.view/leave.finalize; assignable leave.approve is retired. Existing leave.view
and leave.review remain. HR recommendation additionally requires live HR_ADMIN and
verified personnel binding; labels ACCOUNTANT, SYSTEM_ADMIN, HR, AGM and custom-role
names do not confer final MD authority. Protected MD permissions cannot enter ordinary
role selection or delegation ceilings. Revoked MD roots cannot restore legacy access.

POST /leave-requests/:id/recommendation and POST /leave-requests/:id/md-decision
validate separate DTO decision enums, reason, expectedVersion and idempotency key.
Authenticated identity comes from session. GET md-queue and :id/history enforce
current scope. Old POST :id/decision is retired and cannot finalize HR-only leave.
Employee list/detail, HR review queue and MD queue retain PRIMARY/employee privacy.
History/comments/actor details require verified own-request access or explicit
history permission; list projections expose stage summaries without raw authority
snapshots, hashes or private audit payloads.

Existing Leave Apply/List show original request, separate HR recommendation and MD
final outcome, status filters, search, pagination, errors and stable retry keys.
Withdrawal is available only before HR review. MD own form is blocked. HR on-behalf
employee options use a dedicated HR endpoint rather than Users administrator scope.
No pending recommendation is labelled final approved leave.

## Focused migration 18 review

One-time bootstrap retains unique root, independent target/authorizer, private hashed
capability, wall-clock expiry, replay protection and immutable authorization history.
No seed or default MD account exists. Protected permission arrays and root ceiling
match the 59-code registry. Added row locks address the Serializable advisory-wait
revocation race; protected private execution remains unavailable to runtime/PUBLIC.
Private executor startup additionally rejects database ownership, elevated roles,
memberships and object ownership. Existing runtime identity is never reused as the
private writer. Real identity evidence/private claim delivery and OS/service broker
isolation remain deployment acceptance gates, not claims proven by SQL role tests.

Generic authority requests cannot execute leave final decisions: leave has its own
bounded stage command and protected permission. Administrative MD approval, role
ceilings and specialized ACCOUNTANT payroll maker-checker remain unchanged. The
post-MD bridge for legacy SYSTEM_ADMIN/HR_ADMIN/ACCOUNTANT grants is still closed.
Bills have no suitable domain/adapter; Salam-or-MD eligibility is documented only,
with no voucher-to-bill reinterpretation or posting.

## Actual verification

- 121 PostgreSQL-backed HTTP/security assertions: genuine synthetic authentication,
  HR/MD outcomes and disagreement, direct SQL denials, exact retries, concurrent HR
  and MD actions, audit failure rollback, revoked HR/MD and source revision checks,
  plus a real two-connection MD revocation-versus-decision Serializable conflict.
- Separate historical-upgrade test uses real curated Prisma deploy: baseline 16
  successful migrations then 18/19, excluding 15. Original legacy final/pending rows
  and events retain exact fingerprints; no synthetic MD history is backfilled.
- 22 actual authenticated browser/API assertions: employee submission/history,
  HR recommendation, independent MD disagreement/final decision, stale tab conflict,
  self/unauthorized controls, role editor boundary, 390px mobile and 768px tablet.
- Exact Prisma DDL parity for 19, 18, HR identity and original leave projections;
  Prisma validation, API/frontend/verifier TypeScript, targeted lint and production
  frontend build. Focused payroll/read/preview/approval/documents, authorization,
  Employee and Attendance checks are reported separately from PostgreSQL acceptance.
- Synthetic PostgreSQL databases and exact task-owned tmpfs containers cleaned up;
  no existing server roles, volumes, credentials or salary-dev business writes.

- 245 counted offline assertions: leave DTO/privacy/default gates 19, business
  permissions 51, Payroll read 20/calculation 18/DRAFT 8/approval readiness 17/
  approval 8/preview 5/documents 8, Attendance 57 and Employee 34. Additional canonical
  authority/default-provider checks passed (that verifier does not emit a count).
- API and frontend targeted ESLint plus 14 verifier/fixture files: zero errors.
  Frontend production build generated all 46 static pages. API/frontend and focused
  verifier TypeScript checks passed; git diff --check passed (existing CRLF warnings
  are not whitespace errors). No unrelated financial-write suite was repeated.
- Fresh read-only salary-dev verification: PostgreSQL 17, exact localhost:55532
  database real_capita_accounts_salary_dev, 16 checksum-matching migrations, 56
  tables, 50 preserved historical table fingerprints, six empty HR tables, active
  original PRIMARY, restricted runtime and unchanged ACL/backup hash. Explicitly
  confirmed absence of evidence-15, authority-18 and staged-leave-19 objects.
  Evidence: E:\Joy\salary-dev-backups\hr-sprint6-9888f0007cab4c36983f1536b46bb28a\hr-final-sprint-seven-d.json.

A non-failing pg client concurrency deprecation warning occurred in the isolated
fixture harness; PostgreSQL assertions completed successfully. Diagnostic test
failures encountered during implementation were corrected and rerun. A Windows
encoding error during documentation editing was recovered from the exact archived
Sprint 5A document plus every recorded Sprint 6–7C patch; prior status history is
retained and all four current documents validate as UTF-8.

Independent-review archive hashes are recorded with the package.
No synthetic authority or successful technical leave decision is real authorization.

## Future deployment order — NOT authorized or executed here

1. Review this package and actual identity/private-service trust contracts. Obtain
   separate deployment authorization for 18 AND 19 and the bounded HR privilege delta.
2. Confirm Joy, exact localhost:55532 salary-dev/PostgreSQL 17 identity, PRIMARY,
   unchanged 16 successful migration checksums, no partial objects and no writers.
3. Create outside-Git backup, hash/archive verification and disposable restore
   rehearsal; retain baseline record fingerprints/ACLs and sufficient space.
4. Build the reviewed curated migration artifact with the exact applied baseline
   (1–14,16,17), followed by 18 then 19; exclude deferred 15. Verify curated file
   hashes. Run Prisma migrate deploy only against that artifact using private
   migration credentials. Never fabricate history or use unrestricted full deploy.
5. In the same maintenance window inspect actual objects/owners and apply only
   reviewed runtime SELECT on new tables plus private bounded EXECUTE grants.
   Verify PUBLIC/runtime deny stage and authority writers, safe search paths,
   non-owner/non-superuser startup and no escalation. No user is auto-designated.
6. Start API with restricted runtime and default fail-closed claim/writer providers.
   Smoke existing modules; verify checksums, historical fingerprints and no 15.
7. Only after separate genuine identity/onboarding authorization configure the
   independently secured broker/verifier and explicitly designate real MD/HR.
   Do not bridge legacy grants by SQL inserts or infer personnel identity from email.

On failure stop, preserve state/logs/backups and diagnose migration status. No blind
retry, fake migrate resolve, automatic restore over salary-dev or destructive rollback.
A restoration would require separate approval after disposable rehearsal.

## Exact Sprint 7D changed-file manifest

```text
prisma/schema.prisma
prisma/migrations/20261018000000_md_authority_foundation/migration.sql
prisma/migrations/20261019000000_leave_hr_md_workflow/migration.sql
apps/api/src/authority/permission-registry.ts
apps/api/src/authority/authority.service.ts
apps/api/src/authority/authority.module.ts
apps/api/src/authority/sql-authority-executor.ts
apps/api/src/auth/business-permissions.ts
apps/api/src/leave/leave.controller.ts
apps/api/src/leave/leave.dto.ts
apps/api/src/leave/leave.module.ts
apps/api/src/leave/leave.service.ts
apps/api/src/leave/leave-workflow.service.ts
apps/web/src/lib/leave-api.ts
apps/web/src/app/app/leave-apply/page.tsx
apps/web/src/app/app/leave-requests/page.tsx
apps/web/src/app/app/roles/page.tsx
scripts/db/authority-privileges.ts
scripts/db/role-profile.ts
scripts/db/verify-hr-salary-dev.ts
scripts/verify-payroll-acceptance.ts
scripts/hr-admin-browser-environment.ts
scripts/verify-hr-admin-foundation.ts
scripts/verify-leave-foundation.ts
scripts/verify-authority-migration.ts
scripts/verify-business-permissions.ts
scripts/verify-leave-md-migration.ts
scripts/verify-leave-md-contract.ts
scripts/leave-md-postgres-acceptance.ts
scripts/leave-md-upgrade-acceptance.ts
scripts/leave-md-browser-scenario.js
docs/hr-admin/administrator-onboarding.md
docs/hr-admin/real-capita-hr-feature-status.md
docs/hr-admin/real-capita-authority-matrix.md
docs/hr-admin/sprint7d-deployment-review.md
```
