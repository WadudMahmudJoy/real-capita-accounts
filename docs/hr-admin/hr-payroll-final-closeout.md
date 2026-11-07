# Final HR and payroll closeout

Date: 2026-11-07 (Asia/Dhaka). Branch: Joy.

**Final verdict: PARTIAL.** Independent technical closeout is IMPLEMENTED and
TESTED within the approved scope. Genuine operations remain BLOCKED BY REAL-WORLD
PREREQUISITE and separate deployment/activation authorization. No production-ready,
genuine identity, payment, or live-authority claim is made.

## Deployment and configuration truth

| Status | Exact current meaning |
| --- | --- |
| IMPLEMENTED | Seven HR modules, bounded dynamic roles, secure onboarding and the approved payroll calculation/DRAFT/independent-approval/document workflow exist; the functional fixes below are in source. |
| TESTED | Disposable PostgreSQL17, authenticated browser journeys, focused contracts/security checks, migration parity and final quality gates passed as detailed below. |
| DEPLOYED | Salary-dev database foundation has18 successful migrations, including18 and19. This closeout's application changes were not deployed/restarted for genuine use. Migration20 is UNAPPLIED;15 remains deferred. |
| CONFIGURED | Synthetic test identities, issuer and mock delivery were configured only in disposable acceptance. Genuine provider, certificate, Windows identity and evidence enrollment were not verified/configured by this task. |
| LIVE VERIFIED | None for genuine MD/AGM/HR activation, genuine onboarding, real leave decisions or real payroll approval. |
| BLOCKED BY REAL-WORLD PREREQUISITE | Independent personal/company authorization evidence, legitimate Employee bindings, private enrollment/delivery, owner deployment authorization and a designated independent payroll checker remain necessary. |

Both initial and final salary-dev checks were explicit BEGIN READ ONLY queries to
localhost:55532/real_capita_accounts_salary_dev. Final PostgreSQL version170011
(17.11);18 successful applied migrations, every applied checksum matches source;
18/19 present,15/20 absent, onboarding tables absent, zero MD mandate records.
No salary-dev business, User, Session or Audit writes were made by this task.
No protected database or Aafiyat database/project was accessed.

## Exact status of the seven original modules

| Module | Technical status and evidence | Operational boundary |
| --- | --- | --- |
| Employee | IMPLEMENTED / TESTED. Actual browser create, list/search, detail edit, deactivate/reactivate; stable global ID and department selection. API/SQL authorization/audit checks retained. | One global Employee master, not copies per office. Department is an actual relation; office is operational context, not a fabricated authoritative employment-office assignment. Genuine roster/office facts must be verified. |
| Users | IMPLEMENTED / TESTED. Discovery, independently authorized invitation, durable inactive reservation, positive browser claim, verification state, reconciliation messages; API/SQL exact Employee verification/binding, protected approvals, suspension/revocation and audit coverage. | Under MD governance, ordinary legacy provisioning is intentionally closed. UI now routes creation to secure invitation rather than offering a rejected legacy action. Claim verifies mailbox control only; real identity/binding and grants still need the private ceremony. Pre-MD pending-reservation contract remains tested. |
| Monthly Payroll | IMPLEMENTED / TESTED. Preview, blocking/readiness messages, explicit zero-deduction inputs, actual UI DRAFT creation, duplicate-month denial, distinct ACCOUNTANT approval, approved immutability affordances and correct document navigation. | Central PRIMARY ownership, organization-wide roster and Asia/Dhaka boundaries preserved. No salary-dev payroll transaction. DRAFT correction is explicitly deferred below. |
| Payroll Slip / Salary Sheet | IMPLEMENTED / TESTED. A genuinely application-approved synthetic run produced positive payslips and a five-employee consolidated sheet; screen/print money cells, A4 portrait/landscape, approved-only controls and authorization tested. | Approval is not payment. Existing browser print is the approved output path; no new PDF/Excel export, self-service financial access, actual printer acceptance or settlement claim. |
| Employee Attendance | IMPLEMENTED / TESTED. Daily save/retrieval, finalization, history and audited correction through the browser. Fresh protected HR acceptance passed without ACCOUNTANT; MD-approved role revocation removed access immediately. | Current active-office checks, record/revision locks and history remain authoritative. HR needs both independently approved HR_ADMIN and the specific current MD-delegated attendance permission. Financial/schedule permissions are not implied. |
| Leave Apply | IMPLEMENTED / TESTED. Authenticated own-Employee submission, accurate employee-visible state, private reads and rejection of unauthorized access; API self/overlap/stale/withdrawal boundaries retained. | Global PRIMARY ownership; office context remains non-authoritative. Real leave categories/quotas/paid-unpaid policy were not invented or seeded. |
| Apply Leave List | IMPLEMENTED / TESTED. Browser HR recommendation followed by MD approval that disagreed with HR rejection.44 focused PostgreSQL/HTTP cases cover all four recommendation/decision combinations, self-review/MD-own-leave denial, finality, stale/concurrent decisions, revocation and privacy. | HR recommendation is never final. No automatic salary deduction or attendance mutation; relevant SQL before/after invariants passed. |

Category management remains the existing global, versioned, authorized HR service;
synthetic category creation was exercised through its real service in acceptance.
No genuine category, entitlement, quota or paid/unpaid policy was created.

## Proven functional defects fixed

1. Payroll UI discarded a valid preview after an unrelated company-directory403.
   It now consumes only safe PRIMARY display name/currency from the authorized
   preview response, keeps deduction forms, and never needs company.view to preview
   payroll. Parent selection/calculation/approval rules did not change.
2. Role Management sent literal SELF through the signed dispatcher instead of the
   authenticated actor ID. It now binds the actual session user's ID. The worker
   still verifies exact actor/session/payload/signature and independent authority.
3. Gateway identifiers intentionally omit an arbitrary nested role object. Role UI
   now reloads the canonical authorized role read, preventing stale version/edit
   state or another ROLE_CREATE after a successful creation.
4. Delegation requests could select only hardcoded role-management permissions.
   UI now requests actual supported registry operations; selection grants nothing.
   Own live delegation ID/version/expiry is read-only and owner-scoped; an existing
   delegation requires explicit MD-reviewed revocation before replacement. The
   action remains subject to roles.manage and backend independent MD approval.
   Loss of route access after revocation is intentional; re-establishment uses the
   separately authorized private ceremony, not an automatic regrant.
5. Users discarded delivery/outcome classifications and suggested retrying ambiguous
   mutations. Client preserves bounded OUTCOME_UNKNOWN metadata; network, invalid
   response and unconfirmed5xx command failures are ambiguous/non-retryable. Users
   reports issuance versus provider acceptance honestly and holds further protected
   operations for authorized reconciliation. No privileged command is retried.
6. Users showed legacy creation after MD activation although backend correctly
   denied it. Legacy creation/elevation affordances are now gated; the pending-state
   notice no longer falsely says no invitation exists or claiming is unconfigured.
7. Legacy ACCOUNTANT entry blocked independently approved HR attendance despite an
   actual MD-delegated operational permission. AuthGuard now computes a server-side
   protected-HR attendance authorization from current database state. RolesGuard
   accepts that bounded attendance alternative only. Protected HR_ADMIN, current
   delegated operation, active-office checks and existing revision/finalization
   rules remain required. Payroll, vouchers and schedules retain financial gates;
   neither a title nor a generic role can manufacture ACCOUNTANT/MD authority.

No financial calculation, leave approval stages, independent protected-grant
approval, MD bootstrap/recovery policy, applied migration, Prisma schema or
onboarding worker/gateway timeout/security implementation was redesigned.

## Payroll calculation, correction and document readiness

- Existing Decimal arithmetic/configurable earning components remain unchanged.
  BANK is calculated from gross; CASH is net minus BANK; BANK greater than NET is
  rejected.18 calculation checks cover these and invalid-source cases.
- The positive browser fixture used five legitimate synthetic full-month source
  approvals and finalized attendance,100.01 per employee, configured37.5/62.5 earning
  percentages and60% planned bank allocation. Actual approved net total500.05;
  planned BANK300.05 / CASH200.00. These are isolated test amounts, not company data.
- UI created the DRAFT; the maker was denied own approval; a separately MD-approved
  ACCOUNTANT approved it through the actual approval endpoint. Persisted checks
  confirmed APPROVED, different creator/reviewer, exact five-line roster and zero
  payment batches/vouchers. Documents read approved snapshots; no fabricated real
  approved run or salary-dev fixture was used.
- Duplicate monthly creation was rejected by the API. An additional two-connection
  PostgreSQL probe observed real lock contention, one DRAFT winner and23505/40001
  rejection, then deleted its exact synthetic probe row and restored zero runs.
  This probe establishes the database uniqueness gate; it is not represented as a
  concurrent full application payroll-creation test. Application serializable
  creation/validation is separately covered by existing contract tests and actual
  UI creation/duplicate denial.
- DRAFT correction: existing read-only preflight is IMPLEMENTED / TESTED; durable
  correction/replacement remains deliberately deferred. Nine tests retain
  CORRECTION_HISTORY_STORAGE_CONTRACT_MISSING and
  CORRECTION_REVISER_IDENTITY_CONTRACT_MISSING. Safely overwriting a DRAFT would
  require approved reviser authority, retained prior line/source snapshots, atomic
  versioned replacement and schema/history contracts. No destructive shortcut or
  approved-snapshot edit was added. A mistaken DRAFT must be escalated, not edited
  directly in SQL. This is a legitimate unresolved capability, not falsely closed.
- Joiner/leaver/midmonth cases and unsupported positive deductions remain explicit
  blockers. No proration, leave deduction or other unapproved salary policy was
  invented. The current calculation/approval scope can be used only when inputs
  satisfy those existing guards.

## Dynamic RBAC and secure onboarding readiness

MD root, independent initial company authorization/attestation, bounded AGM roles,
protected SYSTEM_ADMIN/ACCOUNTANT/HR_ADMIN approvals, verified Employee bindings,
request versions, immutable history and revocation remain backend authorities.
UI navigation is not authorization. Direct API/URL denial and revocation were
exercised; HR could not acquire payroll/schedule access from an attendance grant.

Sprint7H-B controls remain intact:120-second mutation deadline,15-second
readiness/preparation,10-second provider abort; commit/release before send;
hash-only token storage; ISSUED claim eligibility independent of delivery bookkeeping;
explicit cancellation/reissue; one active invitation; stable Resend idempotency;
OUTCOME_UNKNOWN with no automatic retry. Existing authorized read-only nonce/audit/
request reconciliation guidance remains in the private operation procedure.
No genuine provider, OS/private database role or actual human authority is attested
by synthetic signer, email or mTLS fixtures.

## Verification evidence and limits

Verification evidence is retained outside Git.

| Verification | Result / boundary |
| --- | --- |
| PostgreSQL17 current source | Final affected-area run:214 onboarding/API assertions plus44 HR-to-MD cases; task-owned dynamic-port/tmpfs database only; complete cleanup. Primary browser fixture additionally persisted the genuine synthetic approved payroll. Counts are not added across reruns. |
| Invitation/gateway regression | Initial isolated evidence retained64 delivery/recovery checks and78 real HTTPS/mTLS gateway checks before a fixture-setup failure. Unchanged private security implementation was not repeatedly rerun for unrelated UI fixes. |
| Primary authenticated browser | Final resumable driver PASS45 checks covering role request/MD decision, custom-role creation/edit, preview/DRAFT/independent approval/documents, Employee lifecycle, attendance finalization/correction, staged leave, invitation/claim and UI ambiguity handling. |
| Fresh final HR browser | PASS13 checks on the newly compiled backend: no ACCOUNTANT identity, allowed HR attendance save/finalize/correct, financial/schedule denial, actual AGM revocation request and MD approval, immediate API/URL denial and mobile boundary. |
| Current payroll metadata browser/API | PASS3 additional checks: company directory denied, safe metadata supplied by preview, and usable preview/deduction forms without directory permission. These same checks are retained in the reusable HR scenario. |
| Focused contracts/security | Calculation18, preview5, DRAFT8, approval8, correction9, documents8; HR entry14, effective access41, API boundary30; pending-user and authority contracts passed. Contract doubles are identified as such, not positive PostgreSQL approvals. |
| Protected-client result | Structured unknown, network interruption and unconfirmed upstream502 regressions pass without another mutation call. The browser503 interception tests UI behavior only; durable response-loss recovery is covered by the separate real gateway/PostgreSQL evidence. |
| Migration compatibility | Curated18-to19 upgrade with15 omitted;62 pre-existing table fingerprints preserved;19 exact migration checksums and projected Prisma schema parity passed. Projection deliberately excludes deferred15; this is not a claim that salary-dev has the full current schema. |
| TypeScript / validation | Workspace typecheck, explicit focused-script TypeScript and Prisma validation PASS. |
| Lint / build / whitespace | Targeted API/frontend lint, final production frontend build (47 static routes plus dynamic routes), and git diff --check PASS. |
| Preservation | All20 SQL migration files, Prisma schema and accumulated work outside the reviewed closeout allowlist retain their starting bytes. Temporary credential-bearing browser drivers were removed. No dependency change. |

Initial failures were retained and fixed or correctly identified as fixture/guard
behavior: actor SELF rejection, unrelated company-view dependency, source encoding,
legacy provisioning denial and missing proper delegation. Tests used explicit
MD-approved scopes rather than weakening guards. The browser driver checkpoints
completed journeys instead of recreating an existing monthly run. Evidence is by
affected area, not a claim of one uninterrupted frozen-build run of every historical
suite. Privacy exclusion is also checked by document/preview contract allowlists;
print-media verification is distinct from genuine printer/live acceptance.

## Migration20 and applied history

Migration20 remains UNAPPLIED on salary-dev. Its reviewed exact-file SHA256 is
unchanged:

`f84a86e2acdef437cae5dc9fb36a418e82ad63b338d7c30032906720a0a1d4be`

Salary-dev has18 matching successful migrations.18 and19 are deployed;15 and20 are
not. All source migration bytes are preserved. No unrestricted Prisma deploy, live
migration, genuine invitation, real activation, payroll approval, salary transaction,
commit, push, reset, clean, merge or branch switch occurred.

## One consolidated private setup and live-acceptance checklist

These are owner/operator handoff requirements, not actions executed or automatically
authorized by this report. Do not send secrets, keys, evidence or personal records
through chat or place them in Git.

1. Obtain independent review of the closeout source allowlist and explicit owner
   authorization for an application release and selective migration20 deployment.
   Reconfirm the actual database,18 applied checksums, deferred15 and exact reviewed
   migration20 hash. Prepare a controlled backup/restore rehearsal and preservation
   evidence outside Git. Do not rerun18/19 or use unrestricted migrate deploy.
2. Enroll the independently operated evidence issuer and private Windows executor:
   verified service SID separate from API/developer, immutable release/parent ACLs,
   pinned executables, approved TLS1.3/mTLS CA/client pins, public issuer keys and
   exact command/assurance ceilings. Use the existing reviewed PowerShell wrapper,
   protected DPAPI credential process and bounded private database-role profile.
   Confirm non-owner/non-superuser identity, no direct table/column writes and only
   the reviewed definer functions. Review the operations guide for exact controls.
3. Configure a genuine verified mail sender/provider, HTTPS claim URL and exact
   application/evidence origins. Test approved/unapproved clients and absent
   configuration. Upstream proxy/client timeouts must respect the worker timeline;
   lost acknowledgment always requires authorized read-only reconciliation. Do not
   automatically resend, cancel, reissue or retry a privileged mutation.
4. Privately verify the owner-supplied intended MD/AGM/HR identities, mailbox control
   and authoritative global Employee IDs/codes. No supplied name/email constitutes
   evidence. Verify the initial independent authorizer's company appointment
   authority before the MD bootstrap; later MD software delegation cannot establish
   it. Complete independent authorization, attestation and consume-once activation.
   Claiming an email alone must leave an account inactive.
5. Independently MD-approve each protected SYSTEM_ADMIN, ACCOUNTANT and HR_ADMIN
   responsibility, then exact bounded module/action ceilings. AGM's accounting
   grant is separate from System Administration; HR must not be granted financial
   authority merely to make attendance work. Existing delegation replacement needs
   explicit revocation and a separately reviewed request; never silently supersede.
6. Designate and genuinely onboard a second legitimate ACCOUNTANT maker/checker.
   The supplied intended responsibilities identify only one accounting operator;
   an independent monthly approver must not be invented or assigned to HR/MD by
   inference. Both protected accounting authority and the relevant granular payroll
   permissions are required. Confirm approved salary components/gross/BANK profiles,
   exact Employee dates, schedules, finalized attendance and explicit deductions.
   Confirm real leave categories and any unresolved paid/unpaid policy separately.
7. Decide the DRAFT correction history/reviser contract before relying on correction.
   Until separately approved/implemented, validate sources and preview carefully;
   stop/escalate a mistaken DRAFT. Do not overwrite snapshots or invent proration.
8. Obtain separate authorization for genuine user acceptance and any real business
   transaction in an agreed controlled environment. Have each real operator sign
   in personally and verify the seven journeys, MD/AGM role ceilings, HR privacy,
   immediate revocation, unknown-outcome reconciliation and approved document print.
   Reuse a legitimately approved run only with owner consent; never create a live
   payroll merely for screenshots. Record owner acceptance before LIVE VERIFIED.

Intentionally deferred business capabilities: actual bank transfer, CASH disbursement
confirmation, salary settlement, payment-evidence migration15, automatic leave or
other unapproved deductions, voucher posting, unapproved proration and a future Bill
domain/approval policy. Their absence is not a defect in the approved calculation/
independent-approval/document scope. Dedicated new export/payment functionality was
not introduced.

## Exact closeout file allowlist

Relative to the start of this task, not to HEAD (prior Sprint7F/7G/7H work remains):

- `apps/api/src/auth/auth.types.ts`
- `apps/api/src/auth/business-permissions.ts`
- `apps/api/src/auth/guards/auth.guard.ts`
- `apps/api/src/auth/guards/roles.guard.ts`
- `apps/api/src/authority/authority.service.ts`
- `apps/api/src/authority/permission-registry.ts`
- `apps/api/src/payroll/payroll-preview.service.ts`
- `apps/web/src/app/app/payroll-runs/new/page.tsx`
- `apps/web/src/app/app/roles/page.tsx`
- `apps/web/src/app/app/users/_components/onboarding-panel.tsx`
- `apps/web/src/app/app/users/page.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/authority-api.ts`
- `apps/web/src/lib/onboarding-api.ts`
- `apps/web/src/lib/payroll-workflow-api.ts`
- `docs/handoff.md`
- `docs/hr-admin/hr-payroll-closeout-checkpoint.md`
- `docs/hr-admin/hr-payroll-final-closeout.md`
- `docs/hr-admin/real-capita-hr-feature-status.md`
- `scripts/hr-attendance-closeout-browser-scenario.js`
- `scripts/hr-payroll-closeout-acceptance.ts`
- `scripts/hr-payroll-closeout-browser-scenario.js`
- `scripts/onboarding-browser-acceptance.ts`
- `scripts/onboarding-lifecycle-acceptance.ts`
- `scripts/verify-closeout-payroll-concurrency.ts`
- `scripts/verify-hr-attendance-entry.ts`
- `scripts/verify-onboarding-client-outcome.ts`
- `scripts/verify-payroll-preview.ts`

No verified functional defect remains open in the implemented HR, payroll calculation, independent approval and document scope. DRAFT correction remains explicitly deferred; genuine operational prerequisites remain outstanding.

All independent work above is complete within the stated boundaries. Genuine
operational readiness remains PARTIAL pending the private prerequisites, owner
approvals and the explicit DRAFT-correction deferral. Stop here; no next sprint,
deployment or activation is started automatically.
