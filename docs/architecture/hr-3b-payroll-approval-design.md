# HR-3B payroll approval: implemented contract

Task 002C-2 implements the business-approved ACCOUNTANT maker-checker policy.
Task 002C-1's unresolved payroll approval authority has been resolved. Positive
deduction authority and unsupported employee/month cases remain fail-closed.

## Authorized business rules

- Existing authenticated ACCOUNTANT users may approve payroll.
- Creator and approver must be different authenticated users; no waiver flag.
- Stale/rejected DRAFTs remain preserved. Corrections require a separately
  authorized, auditable workflow; there is no delete/replacement shortcut.
- APPROVED payroll is immutable through application operations.
- Approval never triggers payments, payslips or accounting posting.

A business environment needs at least two distinct authorized identities.
No users or role grants were created in existing development/business databases.
Two synthetic ACCOUNTANT identities were bootstrapped only inside the isolated
acceptance database and authenticated through the genuine login workflow.

Task 002C-3 adds a read-only correction input preflight, while correction persistence
remains blocked by the missing durable history and material-reviser identity contract.
Approval rejects unsupported DRAFT revisions and history events. See
[DRAFT correction assessment](hr-3b-draft-correction-readiness.md) for the evidence,
required review and explicit correction-specific acceptance blockers.

## Existing infrastructure reused

- AuthGuard verifies cookie JWT/session, expiry/revocation, active user and roles;
  RolesGuard applies ACCOUNTANT. The approval method explicitly sets the existing
  read-only-auth-context metadata to false.
- PayrollParentResolver resolves active Company.singletonKey = PRIMARY in the
  caller's transaction, independently of selected office. A company FK alone
  does not enforce PRIMARY.
- PayrollRun contains DRAFT/APPROVED, creator, approver/time, version and snapshots.
  Global month and run/employee uniqueness, restrictive FKs and approval metadata
  CHECK remain unchanged.
- SalaryService approval records and audit actions provide existing salary-source
  authority. The attendance collector verifies finalized historical expectations,
  markers and latest revisions across offices.
- AuditEvent provides actor/entity/action/time and safe JSON metadata. It has no
  cryptographic digest or database-enforced append-only contract.

## Endpoint and transaction

POST /payroll-runs/:id/approve accepts only expectedVersion. Server-authenticated
identity supplies the approver. Strict DTO validation rejects client approver IDs,
amounts, ownership, self-approval flags and other unknown fields.

PayrollApprovalService opens one Serializable transaction and invokes
PayrollApprovalReadinessService.assessWithTx on that transaction. The validator
rechecks active reviewer identity/ACCOUNTANT membership, active PRIMARY, ownership,
DRAFT/version and distinct creator/approver. It validates the full global roster,
six exact Decimal financial contracts, historical source snapshots/timestamps,
source approval identities/audits, finalized attendance revisions, deduction
provenance and original creation audit. Any unresolved evidence blocks approval.

Stored component allocations and gross-based bank amounts are checked against the
existing salary rounding contract. Approval never generates replacement candidates,
invokes SalaryCalculator or writes historical monetary/snapshot fields.

The sole update uses id, companyId, status=DRAFT, expected version and a creator
different from the approver. Exactly one affected row is required. It sets
APPROVED, authenticated approvedById, server approvedAt and increments version.
Exhausted integer versions fail closed.

PAYROLL_RUN_APPROVED audit is inserted in the same transaction with creator,
approver, parent/month, previous/new version, line count and server policy/source
validation metadata. Audit failure rolls back the update. No payment or voucher
service is called. The response explicitly allowlists identity, period, status,
version, approval metadata and line count; raw snapshots are never returned.

Unauthorized/self-approval is 403; unavailable PRIMARY is 503; missing/foreign run
is 404; stale/already-approved/CAS/serialization conflicts are 409; unresolved
evidence is 422. Unexpected transaction/audit failure is 500. No automatic retry
reuses a readiness result. Standalone assessment is read-only RepeatableRead and
is never a durable permission token.

## Immutability and stale history

The inspected payroll write paths are DRAFT creation and metadata-only approval.
There are no run/line edit, delete, reopen or replacement endpoints/services.
Creation/preview detect the existing global month before recalculation, and
approval rejects APPROVED before inspecting/replaying source history. Subsequent
employee, salary or attendance changes cannot rewrite stored approved snapshots.

Future mutation paths must preserve these boundaries and use state/version
predicates and atomic audit where a separately authorized workflow allows changes.
Stale DRAFTs block their monthly slot; no rejection/cancellation/supersession
workflow was added. Source drift, including effective-range closing that changes
a referenced version, requires review rather than silent refreshing.

Application immutability does not prevent a privileged DBA from directly modifying
rows. Existing CHECK/FK constraints do not freeze approved data or authenticate
coordinated source/snapshot/audit tampering. Additional database controls would
require separate review; no Prisma schema or existing migration was changed.

## Verification and remaining scope

Deterministic tests cover authority, maker-checker, evidence/snapshot/financial
blockers, stale versions, CAS/serialization conflicts, atomic rollback and repeated
requests. HTTP guard tests cover strict input, auth/session/roles and write context.

Actual PostgreSQL acceptance uses a uniquely named disposable database at
localhost:55532 after target/server identity, permission and ownership checks.
Synthetic salary sources pass genuine application approval, and working/rest days
pass genuine attendance entry/finalization across offices. Real approval succeeds
through HTTP; an overlapping separate connection returns 409. Injected audit
failure restores the exact DRAFT and lines. Repeated approval, mutation and
regeneration attempts preserve approved history, including after a genuine salary
source change. Test database cleanup requires its recorded OID/owner/marker and zero
remaining sessions; existing safe-development business counts are unchanged.

These fixtures establish technical acceptance only. Positive deductions without
trusted authority, incomplete attendance and unsupported joiner/leaver/configuration
cases still block. Further business correction procedures and any Task 002C-3
features require their own explicit scope and authorization.
