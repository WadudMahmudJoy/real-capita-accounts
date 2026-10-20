# HR-3B Task 002C-3: DRAFT correction is blocked by history contracts

The business has authorized the principle of audited corrections by authenticated
ACCOUNTANT users, preserving stale DRAFTs and all approved history. This task adds
read-only input validation and defensive approval checks. No correction endpoint,
revision persistence, new lifecycle status, schema change or migration is added.

## Verified existing storage and authority

- `prisma/schema.prisma`, `AuditEvent`: optional JSON metadata, optional actor with
  `onDelete: SetNull`, generic action/entity fields. JSONB can physically hold full
  before/after snapshots, but there is no validated payroll revision payload,
  revision uniqueness/linkage, retention policy or dedicated protected history store.
- `PayrollDraftService.create`: stores current run/lines/snapshots and a creation
  audit containing IDs, period, count and policy metadata. That audit is not a full
  historical image and cannot recover replaced employee-line snapshots.
- `PayrollApprovalReadinessService.assessWithTx`: original maker identity is stored
  on PayrollRun. There is no durable identity set for all material revisers. Existing
  creator-versus-reviewer enforcement alone is insufficient after a correction.
- `PayrollController`, auth guards and safe read/preview DTOs: existing ACCOUNTANT
  authorization and office-independent PRIMARY ownership. Raw payment-profile and
  calculation snapshots are not exposed by payroll read responses. No authorized
  full-revision audit retrieval/access contract exists.
- AuditEvent has no database-enforced append-only contract. Application immutability
  of approved payroll does not prove durable retention of overwritten DRAFT history.

The blocker is the missing reviewed history/identity contract, not JSONB capacity.
This does not assert that a new table is the only possible solution: an explicitly
reviewed and protected AuditEvent revision mechanism could be an alternative.
Adding arbitrary JSON or a free-text correction flag would not establish those
guarantees. The existing source audit events remain valid for their limited salary
approval purpose; they are not silently repurposed as a payroll revision archive.

## Safe components implemented

`PayrollCorrectionPreflightService.assess` uses a read-only RepeatableRead assessment;
`assessWithTx` can reuse a future caller's transaction without nesting. Strict input
requires run/version/month, reason and complete explicit manual deductions. Actor
identity is supplied by trusted server code, rechecked against current active
ACCOUNTANT membership, never accepted from a client field.

The service checks active PRIMARY, ownership, DRAFT/version/month, current global
roster and approved full-month salary sources. It blocks omitted/new payable
employees without inputs and any removal of an existing employee line requiring
review. It reuses original deduction-provenance rules, source approval identities
and audits, the finalized cross-office attendance collector, SalaryCalculator and
financial validator to check proposed input arithmetic. This hypothetical validation
does not modify old amounts, return replacement lines or make stored snapshots
authoritative for a revision.

Even passing input checks return `status=BLOCKED`, `readyForCorrection=false`,
`CORRECTION_HISTORY_STORAGE_CONTRACT_MISSING` and
`CORRECTION_REVISER_IDENTITY_CONTRACT_MISSING`. No raw snapshots are released.
Missing inputs, unconfirmed zeros, unverifiable positive claims, source/attendance
gaps and unsupported eligibility remain blocking.

Approval now rejects a DRAFT version other than the supported creation version 1,
and any unrecognized PayrollRun history event, with
`PAYROLL_REVISION_HISTORY_UNVERIFIABLE`. A claim that someone corrected/approved
an amount never grants authority. Existing genuine version-1 DRAFT approval remains
supported. Maker-checker after real correction is BLOCKED, not claimed as verified.

## Required review before correction persistence

Define and review a durable revision mechanism: complete before/after run and line
images, canonical decimal strings, all historical snapshots/evidence, reason,
authenticated actor, timestamp and previous/new versions. Preserve the original
creator and every material reviser with a stable deletion/retention identity contract.
Enforce version/revision uniqueness, a complete revision chain and atomic audit with
the Serializable status/version-checked correction. Approval must exclude the
creator and every material reviser, not merely the latest editor.

Specify append-only application controls, retention/backup expectations and access
rules for the historical bank/payment-profile snapshots. A dedicated revision store
with restrictive actor/run references is a recommended design for separate review;
a strengthened audit mechanism is an alternative requiring the same guarantees.
No roles, access grants or schema were invented here. Decide whether corrections
that would remove a previously included employee need another approved exception
procedure; the preflight conservatively blocks removal. No REJECTED/CANCELLED/
SUPERSEDED workflow was added.

## Acceptance and next boundary

The existing isolated PostgreSQL harness independently verifies genuine source
approval/finalization, DRAFT creation, maker-checker approval, concurrency, rollback
and approved-history preservation. New actual-database checks assess correction
inputs without writes, verify stale/approved target rejection and confirm audit
schema limitations. Correction-specific persistence, history preservation, concurrency,
audit rollback and corrected-DRAFT approval are explicitly BLOCKED.

Supported DRAFT-to-APPROVED payroll is technically accepted; the correction lifecycle
is incomplete. Payslips/monthly salary sheets could be separately scoped strictly
to existing approved snapshots, with output privacy/format requirements approved
first. Do not declare complete correction acceptance or begin those features here.
