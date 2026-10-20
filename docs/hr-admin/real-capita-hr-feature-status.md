# Real Capita Group HR-Admin feature status — Sprint 1

## Sprint 7F — current source readiness and genuine activation boundary

Secure individual claiming, independent MD onboarding, private signed execution,
MD-approved specialized permissions and bounded dynamic roles are implemented in
source. Authenticated synthetic browser acceptance passed 15 checks; onboarding
API passed 24, effective-access acceptance passed 41, and production frontend build
passed. The [Sprint 7F acceptance report](sprint7f-onboarding-acceptance.md) holds
final database/private/parity/preservation evidence and the nine-feature readiness
matrix; synthetic results do not establish genuine provider or real-user acceptance.

Salary-dev retains the deployed 18/19 foundation and 18 successful migrations.
New onboarding migration 20 is unapplied, payment-evidence migration 15 remains
deferred, and genuine provider/private OS/database configuration, verified Employee
bindings and MD/AGM/HR activation have not occurred. Initial authorization requires
a genuine registrar session and independent signed evidence. Claimed email control
alone leaves accounts inactive. MD authority is established through independent
company authorization/attestation, then separate MD approvals and bounded delegation.
HR recommends and the MD decides leave. MD approvals use the existing leave queue
and Role Management views; no standalone MD dashboard is claimed. Earlier sections
remain historical status, not current deployment or live-authorization claims.

## Sprint 7E — deployed, operational activation remains gated

Migrations 18 and 19 are actually deployed; salary-dev has 18 successful migrations and deferred 15 remains unapplied. Employee/Attendance/Payroll/Accounting reads, 20 HTTP denials and 11 frontend sign-in shells passed. Isolated authority (84) and leave (121) assertions passed. No genuine MD/AGM/HR activation, real leave decision or payroll operation occurred. A standalone MD dashboard is not implemented; the deployed MD leave queue is within Apply Leave List. Genuine authenticated acceptance, approved live payslip viewing, private executor/verifier and real-person onboarding remain pending. See the [nine-area readiness table and complete evidence](sprint7e-deployment-acceptance.md). Earlier status entries are retained as history.

## Sprint 7D — latest seven-module status

The approved HR→MD policy supersedes all earlier HR-only final-decision statements.
Prior sprint results below remain historical evidence.

| Module | Status | Current acceptance / operational boundary |
|---|---|---|
| Employee | COMPLETE | Established global identity/browser scope; 34 focused regressions passed |
| Users | PARTIAL | Secure technical administration preserved; genuine MD/private bootstrap and protected legacy permission bridge remain closed |
| Payroll | COMPLETE | Restricted monthly engine and independent ACCOUNTANT maker-checker preserved; no formulas or payment behavior changed |
| Payroll Slip | COMPLETE | Approved historical read/print scope preserved; no paid claims |
| Employee Attendance | COMPLETE | Existing authorized workflow preserved; 57 focused regressions passed; leave never mutates attendance |
| Leave Apply | PARTIAL | New staged submission, private history and pre-HR withdrawal accepted in isolation; requires unapplied 18/19 and genuine bindings/category authority for activation |
| Apply Leave List | PARTIAL | HR recommendations and independent MD final decisions, queues/history/privacy accepted in isolated PostgreSQL and browser; deployment/private MD authority not activated |

COMPLETE describes the previously approved technical scope, not genuine privileged
onboarding. New stages: PENDING_HR_REVIEW → PENDING_MD_DECISION → APPROVED/REJECTED;
withdrawal only before HR review. Historical HR-final rows retain their original
meaning and are never relabelled MD-approved. See [the exact report, tests and changed
files](sprint7d-deployment-review.md). Salary-dev remains at 16 successful migrations;
15, 18 and 19 are unapplied. No genuine leave decision or authority assignment occurred.


Current assessment is the Sprint 7F section near the top of this document. Earlier
sections are retained as status history, not current deployment claims.

Scope: the seven named reference workflows, using the existing global Employee master and approved payroll foundation. Reference screenshots were not supplied for this sprint; no pixel-perfect visual parity is claimed. Existing Real Capita components, office themes and document layouts are reused.

COMPLETE means the defined workflow has end-to-end acceptance evidence. PARTIAL means implemented with a remaining workflow gap. BLOCKED means authority/policy is required. MISSING means absent. Prior accepted document evidence is identified separately from Sprint 1 browser coverage.

| Reference feature | Status | UI route/menu and browser usability | Backend and implemented operations | Search, validation, authorization, print | Remaining gap |
|---|---|---|---|---|---|
| Employee | COMPLETE for ordinary master operations | /app/employees and /app/employees/:id; Employees menu. List, add, detail, section edit, active/inactive, department management, errors and success states. Global identity across office switching. Sprint 1 browser acceptance covers these workflows. | EmployeeController GET /employees, GET /employees/:id, POST /employees, PATCH /employees/:id; EmployeeService; DepartmentController CRUD-compatible management. No destructive Employee delete. | Server search (code/name/designation/department), status/department filters; 20-row client pagination. DTO and cross-field validation; globally unique employee code/NID/official email; ACCOUNTANT/session guards. No Employee export/print feature is promised. | Server still returns the filtered array; pagination bounds rendering rather than transfer. No Employee office FK exists: offices own schedules/attendance, not duplicate employees. Very large rosters may need additive server pagination later. |
| Users | BLOCKED for administration | /app/users; new Users menu. Only the signed-in account's name/email/assigned roles and an explicit unavailable-management notice. Safe current-account workflow is browser tested. | AuthController login/me/session/logout and AuthService. User/UserRole/Role models exist; no user-management service/controller, administrator permission or provisioning endpoint. | HttpOnly session cookie and existing ACCOUNTANT guard; own response allowlist; no hashes/tokens, user enumeration, role mutation or provisioning. Search/pagination is inapplicable to one own account. | Business owner must designate legitimate administrator authority and approve secure provisioning, role assignment and deactivation/session revocation. ACCOUNTANT alone is insufficient. No new privileged role is invented. |
| Payroll | PARTIAL | /app/payroll-runs; Payroll Runs menu, paginated list and approved document/preparation links. Backend workflows have prior isolated acceptance. | PayrollController list/detail, POST preview, POST DRAFT, POST :id/approve; existing readiness, source, attendance, Decimal and maker-checker services. | Bounded backend list/filter DTO; PRIMARY ownership; authenticated ACCOUNTANT write context for mutations. Approved rows immutable. | No integrated New Payroll manual-deduction/preview/DRAFT/approval frontend yet; list UI lacks backend month/year/status filter controls. Audited DRAFT correction remains blocked. Payment preparation is not disbursement. |
| Payroll Slip | COMPLETE for approved read/print scope | /app/payroll-runs/:id/payslips/:employeeId and :id/salary-sheet; contextual salary-sheet and employee payslip links rather than a separate reference menu. Prior 002D-1/002D-2 document/print acceptance applies; not rebuilt/retested with paid fixtures this sprint. | PayrollDocumentsService and approved-only GET payslip/salary-sheet endpoints. Stored snapshots and exact Decimal strings; reconciled monthly totals. | ACCOUNTANT, active PRIMARY, APPROVED-only. A4 payslip and landscape sheet browser print; safe DTO, planned allocations explicitly not payments. No public URLs or PDF export. | Separate Payroll Slip discovery/menu may be refined against reference screenshots. Explicit over-1,000-employee sheet limit retained. No self-service or receipt/paid status. |
| Employee Attendance | PARTIAL | /app/employees/attendance; new direct Employee Attendance menu plus existing Employee link. Daily entry/history/settings panels and work-schedule route exist. | AttendanceController day/save/discard/finalize/history/corrections/not-applicable; policies/calendar controllers; office-owned finalizations and revision evidence. | Date/department/search controls, existing validation, ACCOUNTANT authorization; schedule/office/version/correction safeguards. No unauthorized attendance-to-money formula. | Full rendered daily save/finalize/correction mobile acceptance is outside this sprint's Employee/Users tests; existing focused attendance tests are reused, not treated as exhaustive browser proof. Reference print/export and leave-linked behavior are unconfirmed. |
| Leave Apply | MISSING | No route/menu/form. | No LeaveApplication model/controller/service. Attendance early-leave fields are not a leave-management workflow. | No invented leave types, entitlement, paid/unpaid rules or approval authority. | Require a small business-policy lock before schema/UI implementation. |
| Apply Leave List | MISSING | No route/menu/application or approval list. | No persisted leave lifecycle or approval endpoints. | Search/status filters and approval audit contracts absent. | Depends on Leave Apply model, permitted actors and lifecycle decisions; cannot be derived from attendance history. |

## Preservation and Sprint 2

SalaryCalculator, monthly calculation/readiness/DRAFT/approval, attendance rules, payslips, payment preparation and all migrations are unchanged. No advanced payment work, confirmation activation, real finance designation or business database write is part of this sprint. Users information reuses /auth/me; it is not user management.

Sprint 2 recommendation: implement the compact New Payroll UI using existing preview/DRAFT/approval contracts, with explicit zero deductions and unchanged blocking policies. In parallel obtain two minimal decisions: legitimate Users administrator/provisioning authority, and Leave Apply/List rules (types, duration, eligibility, approver and audit lifecycle). Do not resume advanced payment infrastructure as the next HR-Admin feature.

## Exact Sprint 1 files

- apps/web/src/app/app/employees/page.tsx
- apps/web/src/app/app/users/page.tsx (new)
- apps/web/src/app/app/layout.tsx
- apps/web/next.config.ts (isolated test build directory only)
- scripts/verify-payroll-acceptance.ts (early HR-only browser branch; payroll scenarios preserved)
- scripts/hr-admin-browser-environment.ts (new)
- scripts/hr-admin-browser-scenario.js (new)
- docs/hr-admin/real-capita-hr-feature-status.md (new, this matrix)

The browser driver executes the generated scenario against actual Next/Nest/PostgreSQL, then records its returned PASS/FAIL JSON into the environment's temporary result.json to release the harness. Only isolated synthetic fixtures are writable. Task-owned database/container/build and temporary files are cleaned up after acceptance; no salary-dev fixtures are created.
## Sprint 1 verification results

Final fresh Next.js/NestJS/restricted PostgreSQL browser run: 23 checks PASS. Covered anonymous page/API denial, genuine ACCOUNTANT login, Employee navigation, 20-row pagination, search/empty state, required fields, duplicate code rejection, create/detail/profile edit, deactivate/inactive filter/reactivate, real office switching with one global identity, own Users information, absence of administrator actions/endpoints, secret-field exclusion, 390px layouts, and genuine non-ACCOUNTANT login rejection without issuing a session. Administrator CRUD acceptance is BLOCKED, not simulated.

The harness independently confirmed 22 isolated employees, two bootstrap users, one existing ACCOUNTANT role, and zero payroll/payment/voucher records; no user/role mutation occurred through the UI. Disposable database identity and zero sessions were checked before cleanup; task-owned tmpfs container, build directories and temporary fixtures were removed. No salary-dev or protected database was connected for these write tests.

Frontend production build and frontend/API TypeScript: PASS. Targeted frontend and browser-environment lint: PASS. Employee pure verification: 34 PASS; payroll read/auth regression: 20 PASS; Attendance focused client/source checks: 120 PASS (not full browser finalization acceptance). git diff --check: PASS, with pre-existing CRLF conversion warnings.

Early attempts caught a source-encoding error (corrected before the final build/browser run) and test assumptions about office reload synchronization and unprivileged login status. Those assertions were corrected to the actual established authentication flow; no auth policy was weakened. Each failed disposable environment was cleaned up. No payment security suite was repeated.

Overall Sprint 1 verdict: PARTIAL due to the explicit Users authority and missing Leave workflows, plus the Payroll UI gaps above. Employee ordinary master operations are complete for this sprint scope; larger-roster server pagination remains a documented scalability improvement.
## Sprint 2 — Real Capita monthly payroll workflow (2026-10-15)

The earlier Sprint 1 matrix above is retained as status history. This is the current seven-module position:

| Real Capita HR-Admin module | Current status | Delivered behavior / remaining gap |
|---|---|---|
| Employee | COMPLETE for ordinary master operations | Sprint 1 list/detail/create/edit/status/department/search/client pagination retained unchanged; global office-independent identity. |
| Users | BLOCKED for administration | Own authenticated account view retained; legitimate administrator/provisioning authority still requires approval. |
| Payroll | COMPLETE for the approved restricted monthly workflow | New monthly form, calendar period, active PRIMARY identity, roster/department/designation/components, explicit manual zeros, safe preview and blockers, transactional DRAFT creation, history year/month/status filters, detail, independent approval and document links. Unsupported positive deduction authority, partial-month configurations and incomplete attendance remain blocking. No DRAFT correction workflow. |
| Payroll Slip | COMPLETE for approved read/print scope | Approved historical payslip and consolidated sheet opened through actual browser acceptance; planned allocation is not payment. Existing limits retained. |
| Employee Attendance | PARTIAL | Existing entry/finalization/history/correction/settings preserved. Broader rendered attendance editing acceptance remains a separate gap; finalized cross-office evidence was generated through genuine services for this sprint's payroll tests. |
| Leave Apply | MISSING | Requires leave types/duration/eligibility and authorized approval contract before implementation. |
| Apply Leave List | MISSING | Depends on persisted leave application and approved lifecycle; no invented roles or policies. |

### Implemented routes and contracts

- `/app/payroll-runs`: New monthly payroll action, bounded history and year/month/status filters, DRAFT/APPROVED detail links and existing approved document/preparation links.
- `/app/payroll-runs/new`: Asia/Dhaka calendar period; first preview discovers the authoritative potential roster; every category is explicit. The zero-confirmation action is a deliberate accountant attestation, not an assumed zero. Amounts remain decimal strings. Positive amounts can be entered but cannot pass absent independent evidence authority. Changing inputs invalidates preview success. Creation revalidates inside the existing Serializable DRAFT service.
- `/app/payroll-runs/:id`: stored financial categories, net/BANK/CASH, department/designation, status/version/approval time, maker-checker messaging and approval action. APPROVED exposes documents and no editing/reopening operation. The UI uses a server-derived `isCreator` boolean; raw creator IDs are not released. Server identity/version/approval validation remains authoritative.
- Preview response adds only allowlisted historical component names/codes/percentages/amounts and organizational fields when complete candidates are released. No private payment snapshot, banking account number, source proof or payroll mutation is exposed by preview.

The period is the existing payroll calendar year/month, not a new accounting-period or fiscal-year posting policy. No project salary allocation, voucher posting or real disbursement is implied. The real estate company's department/office boundaries remain unchanged. Real Capita Group branding replaces vendor wording in this project-owned feature document; its neutral filename is `docs/hr-admin/real-capita-hr-feature-status.md`.

### Actual acceptance and preservation

27 browser assertions PASS using actual Next.js, NestJS, cookie authentication and restricted PostgreSQL runtime in a disposable instance. Tests cover accountant navigation, missing deduction/incomplete attendance blockers, confirmed zeros, exact custom 37.5/62.5 earning allocations, READY preview, active PRIMARY, creation, duplicate month rejection, same-user HTTP 403 and disabled UI, genuine independent accountant approval, salary sheet, payslip, private-field exclusion and tablet layout. Persisted assertions independently confirmed one APPROVED run/version 2, two unique employee lines, different authenticated creator/approver, one creation audit, one approval audit, and zero confirmations/payment batches/vouchers. Synthetic fixtures are technical acceptance, never real payroll or payment authorization.

Salary sources were approved and all September workday/rest evidence finalized through genuine existing application workflows across two offices. An initial fixture schedule name failed the established historical setup contract; it was corrected to the exact existing contract, without changing its rules. A read-privacy regression exposed unnecessary creator-ID disclosure; it was replaced with the server-derived boolean. Browser testing caught double JSON serialization in the new API wrapper; the wrapper now follows the existing apiFetch object-body convention. Final acceptance passed after these corrections. Failed test environments and final fixtures were cleaned up after identity/zero-session checks.

SalaryCalculator, eligibility/proration rules, approved source provenance, attendance authority, global uniqueness, financial validator, transactional DRAFT/approval/audit logic, approved-history immutability and private payment-security boundaries are unchanged. No schema/migration file or salary-dev business record was changed. No payment/security suite or production delegation was introduced.

### Exact Sprint 2 source changes

- apps/api/src/payroll/payroll-preview.service.ts
- apps/api/src/payroll/dto/payroll-response.dto.ts
- apps/api/src/payroll/payroll.service.ts
- apps/api/src/payroll/payroll.controller.ts
- apps/web/src/lib/payroll-workflow-api.ts (new)
- apps/web/src/lib/payroll-documents-api.ts
- apps/web/src/app/app/payroll-runs/page.tsx
- apps/web/src/app/app/payroll-runs/_components/payroll-run-list-view.tsx
- apps/web/src/app/app/payroll-runs/new/page.tsx (new)
- apps/web/src/app/app/payroll-runs/[id]/page.tsx (new)
- scripts/hr-admin-browser-environment.ts
- scripts/verify-payroll-acceptance.ts (HR-only browser branch accepts payroll UI mode)
- scripts/payroll-ui-browser-scenario.js (new)
- scripts/verify-payroll-preview.ts
- scripts/verify-payroll-read.ts
- docs/hr-admin/real-capita-hr-feature-status.md (renamed status history and updated report)

Sprint 3 recommendation: resolve the minimum Leave Apply/List policy and approval decisions, then implement those two missing workflows, with focused attendance browser completion. Users administration awaits its own legitimate authority contract. Advanced payment infrastructure remains deferred.
### Final focused verification

PASS: frontend production build; API/frontend TypeScript; targeted API/frontend/verifier/browser-scenario lint; verifier TypeScript; git diff --check (pre-existing CRLF notices only). Focused offline checks: preview 5, read/auth 20, calculation 18, DRAFT 8, approval 8, approval-readiness 17, approved documents 8, Employee preservation 34: 118 checks in total. These are distinct from the 27 actual browser assertions and persisted PostgreSQL checks above. No full payment-security suite was repeated.

Sprint 2 verdict: PASS for the authorized restricted monthly payroll UI and approval milestone. The seven-module program remains incomplete because Users authority, broader Attendance browser completion and the two missing Leave workflows remain outstanding. All prior uncommitted work and branch Joy are preserved. No migration, database security deployment, actual payment or accounting posting was performed.

## Sprint 3 — Attendance completion and leave foundation (2026-10-15)

Earlier sprint matrices remain status history. Current position:

| Real Capita HR-Admin module | Current status | Remaining gap |
|---|---|---|
| Employee | COMPLETE for ordinary master operations | Large-roster server pagination remains a future improvement. |
| Users | BLOCKED for administration | Approved administrator/provisioning authority is absent. Own account view remains available. |
| Payroll | COMPLETE for restricted monthly workflow | Unsupported proration, positive-deduction authority and audited DRAFT correction remain blocked. |
| Payroll Slip | COMPLETE for approved read/print scope | Existing 1,000-employee sheet limit; no paid status or employee self-service. |
| Employee Attendance | COMPLETE for tested entry/finalization/correction scope | Existing authorized correction contract retained; no extra correction privileges, leave automation or unconfirmed exports. |
| Leave Apply | PARTIAL foundation; live authority BLOCKED | Verified User-to-Employee binding and approved category configuration authority are required, followed by reviewed migration deployment. |
| Apply Leave List | PARTIAL foundation; live authority BLOCKED | Same identity gate; no leave approval/rejection authority or controls. |

### Attendance acceptance

Existing attendance production implementations were reused unchanged. Actual authenticated browser acceptance covered employee search/empty state, date/office selection, incomplete and late statuses derived by existing rules, save/reload, invalid time rejection, daily finalization, repeated-finalization rejection, history, authorized correction with retained reason, and same employee/date protection across offices. No attendance status, correction authority or salary deduction policy was added.

### Leave contracts and privacy

Routes: `/app/leave-apply` and `/app/leave-requests`, with Real Capita navigation. API: `GET /leave-requests/capabilities`, bounded/searchable/status-filtered `GET /leave-requests`, own detail `GET /leave-requests/:id`, `POST /leave-requests`, and versioned `POST /leave-requests/:id/withdraw`. Existing session and ACCOUNTANT guards apply, but ACCOUNTANT alone is insufficient for private employee leave authority.

The reusable `LeaveAuthority` defaults to no verified employee binding and no supported categories. Production fails closed before accessing request data. No user-email/name inference, client identity claim, category seed, authority provisioning endpoint or environment switch activates it. Isolated tests explicitly inject a technical authority provider into a private test application. This proves technical behavior, not real business authorization. A future reviewed binding/provider must establish legitimate subject identity and category authority.

Under verified authority, the conservative foundation permits only the authenticated creator's own globally identified employee to submit, retrieve or withdraw requests. Office is historical context, not a duplicate employee identity or permission grant. Dates are validated against known employment dates; no duration, entitlement, holiday, paid/unpaid or salary treatment is inferred. Supporting references are not approvals. New submission requires an active supported category; existing own history remains readable when new category availability is blocked. Detail excludes raw snapshots and internal audit payloads; list excludes private reason/reference. Withdrawal requires the current submitted version and preserves all original instructions.

The unapplied additive migration `20261016000000_leave_request_foundation` creates LeaveCategory, LeaveRequest and LeaveRequestEvent, with only SUBMITTED/WITHDRAWN statuses. It adds restrictive foreign keys, bounded strings, DATE periods and TIMESTAMPTZ(3) events, idempotency, global inclusive employee/date overlap exclusion for submitted requests, immutable request instructions and event history, and a deferred event requirement. A valid withdrawal releases overlap reservations without deleting history. Application transactions also persist global AuditEvent records atomically. Runtime category provisioning and request/event deletion are denied. Database constraints enforce integrity, while verified employee identity/privacy remains a trusted backend contract; a privileged database administrator is not constrained by application authorization.

No leave approval endpoint, approver, quota, automatic attendance update or payroll deduction was introduced. No salary-dev schema, role grant or business record was changed. New leave capability responses remain blocked with the default provider even before deployment, so existing modules do not require querying the new tables to start.

### Actual verification

- 25 actual browser assertions PASS against isolated Next.js/NestJS/cookie authentication/restricted PostgreSQL. Attendance workflows above plus leave form validation, submission, overlap rejection, foreign employee rejection, search/detail, withdrawal/history, stale rejection, 390px layout, and a second authenticated identity denied another employee's private detail/list. There are no approval controls. Positive leave paths use isolated technical identity/category authority only.
- Real PostgreSQL tests PASS: migration deployment, three timezone-aware timestamp columns, seven restrictive FKs, two-connection overlapping submission (exactly one succeeds), idempotency, cross-office/category overlap protection, audit-failure rollback, invalid FK/state rejection, immutable event/request rejection, category write denial, deferred event enforcement and complete before/after withdrawal evidence. Production-default authority remains BLOCKED and causes no writes even when technical categories exist.
- Rejected probes preserve request/event/global audit counts. Isolated fixtures contain no payroll, payment confirmation or voucher records. Disposable identities and sessions were checked before cleanup; task-owned databases/containers and temporary build/browser files were removed. Neither salary-dev nor protected databases were used for writes.
- Focused offline regressions: Attendance client 120, Attendance pure 57, payroll preview 5, calculation 18, read/auth 20 and approval 8: 228 PASS. These are separate from browser and PostgreSQL acceptance.
- PASS: Prisma validation/generation; exact additive Prisma/migration base parity plus manual integrity contracts; API/frontend/verifier TypeScript; frontend production build; targeted API/frontend/verifier/browser lint; git diff --check (inherited CRLF notices only).

Initial test-only issues (alertdialog selector, SQL CASE parentheses, Reflect metadata typing and PostgreSQL internal catalog character deserialization) were corrected, then the affected real checks rerun. No production authority was weakened to make tests pass.

### Exact Sprint 3 files

- prisma/schema.prisma
- prisma/migrations/20261016000000_leave_request_foundation/migration.sql (new, unapplied)
- apps/api/src/app.module.ts
- apps/api/src/leave/leave-authority.ts (new)
- apps/api/src/leave/leave.dto.ts (new)
- apps/api/src/leave/leave.service.ts (new)
- apps/api/src/leave/leave.controller.ts (new)
- apps/api/src/leave/leave.module.ts (new)
- apps/web/src/app/app/layout.tsx
- apps/web/src/app/app/leave-apply/page.tsx (new)
- apps/web/src/app/app/leave-requests/page.tsx (new)
- apps/web/src/lib/leave-api.ts (new)
- scripts/db/role-profile.ts (new leave-table permissions only)
- scripts/verify-payroll-acceptance.ts (focused attendance/leave branch)
- scripts/hr-admin-browser-environment.ts (isolated fixture/authority integration)
- scripts/attendance-leave-browser-scenario.js (new)
- scripts/verify-leave-postgres.ts (new)
- scripts/verify-leave-foundation.ts (new)
- docs/hr-admin/real-capita-hr-feature-status.md

### Required business decisions and next milestone

1. Approve a controlled, auditable User-to-global-Employee identity binding source and its provisioning authority. Confirm who may submit/withdraw: verified own employee versus explicitly authorized on-behalf HR access, with private read scope. Existing ACCOUNTANT status does not establish this.
2. Approve leave categories and their legitimate configuration authority. Entitlements, paid/unpaid treatment and holiday calculations remain undefined and are not needed to claim this technical request foundation works.
3. Approve leave approval/rejection actors, maker-checker rules if applicable, lifecycle and audit requirements. Payroll approval permissions do not authorize leave approval.
4. Independently review the new leave migration/runtime grants and explicitly authorize deployment. Do not bulk-apply pending confirmation migrations to enable leave.

Recommended next milestone: resolve identity/category authority, then enable the reviewed leave submission/list workflow and design its approved decision lifecycle. Users administration requires its separate administrator contract. SalaryCalculator, monthly payroll readiness/DRAFT/approval, financial rules, approved history and private payment boundaries remain unchanged.

Sprint 3 verdict: PARTIAL. Attendance's tested ordinary workflow is complete; Leave Apply/List technical foundations pass isolated acceptance but live operations intentionally remain blocked. No next sprint, payment infrastructure, payment confirmation or accounting posting was started.

## Sprint 3 policy confirmation — HR/Admin leave decisions (2026-10-16)

This update supersedes the earlier absence of an approved leave-approval policy. The business owner authorizes only explicitly authorized HR/Admin personnel to approve or reject leave. Department Heads, Reporting Managers, ACCOUNTANT status and navigation labels confer no automatic authority. Self-decision authority remains unresolved and is blocked.

### Delivered lifecycle

- Authenticated leave routes use a verified employee identity contract for own submission/list/detail/withdrawal. A separate trusted `LeaveAuthority.reviewer` contract is required for review-queue access, another employee's detail and decisions. Both production identity and reviewer authority default to absent. No role was created, no user was assigned privileges, and no name/email mapping or client-supplied reviewer identity is trusted.
- `SUBMITTED` is the persisted pending-review state; APPROVED and REJECTED are final decisions. WITHDRAWN remains available only before a decision. The UI labels submitted rows as Pending review. Own-history pages remain private; explicit HR/Admin queue access is a distinct server-authorized view, not an accountant-wide employee list.
- New `GET /leave-requests/review-queue` and `POST /leave-requests/:id/decision` reuse authentication and validated bounded query/version/reason contracts. The server derives actor identity from the authenticated session. An active reviewer, independently verified HR/Admin authority revision and verified reviewer employee binding are required. Same creator or same global employee decisions return `LEAVE_SELF_APPROVAL_POLICY_UNRESOLVED` rather than assuming permission.
- Serializable decisions lock the employee shared with submission/withdrawal, revalidate authority/status/version, conditionally transition exactly once, increment the version and atomically write the complete before/after request event and global audit. A failed audit rolls back the decision. Approved/rejected requests cannot be withdrawn, reopened or decided again.
- Reviewer identity, timezone-aware decision time, reason and authority provenance are durable. Private authority snapshots and raw audit payloads are not returned by DTOs. Database guards compare complete historical before/after instructions, preserve final records and reject incomplete state/audit metadata. Pending and approved periods reserve the employee/date range; rejected and withdrawn periods release overlap without deleting history.
- The source-only, still-unapplied `20261016000000_leave_request_foundation` migration was extended, not an applied migration. It adds the two final enum values, reviewer fields/restrictive FK and strengthened state/history constraints. Exact Prisma base DDL parity passes. No migration was deployed and no existing salary-dev objects/roles/business data changed.

### Authority boundary and remaining gates

The existing auth model confirms only ACCOUNTANT and permits login only for that role. It has no HR/Admin permission or verified User-to-Employee relationship. Leave endpoints no longer equate ACCOUNTANT with employee/private-leave/reviewer authority: authentication plus the separate trusted subject/reviewer contracts are decisive. Existing Accounting, HR, Salary and Payroll role guards are unchanged. This foundation does not expand the shared login or application shell to newly invented HR/Admin roles.

Production reviewer authority remains fail-closed until Real Capita explicitly authorizes a mapping to existing identities/permissions and a trusted provisioning mechanism. Employee self-service additionally requires approved secure account/employee bindings and supported authentication access; category definitions/configuration authority remain outstanding. A future authority provider must verify these facts through trusted server-side records inside the transaction, not through caller claims or free text. No live provider is registered by this sprint.

PostgreSQL enforces state/version/overlap/FK/history integrity. It does not independently establish that a caller is genuinely HR/Admin: verified session identity and HR/Admin mapping are trusted backend responsibilities. Snapshot provenance alone is not a permission grant, and a privileged database administrator can bypass application authorization. No claim of database-authenticated business approval authority is made.

Self-leave decisions require a separate business decision; current behavior blocks both same creator and same employee identity. No quota, entitlement, paid/unpaid classification, holiday policy, automatic attendance update or payroll deduction is inferred. Approval of leave does not modify finalized attendance or approved payroll.

### Fresh verification and cleanup

33 actual browser assertions PASS in a uniquely isolated PostgreSQL 17 environment with restricted runtime, actual Next/Nest and genuine cookie login. Attendance entry/retrieve/finalize/correction and cross-office duplicate protection passed again. Leave acceptance covers own request submission/search/detail/withdrawal, validation, overlap/foreign employee denial, ordinary-accountant review/decision denial, explicitly injected technical HR/Admin queue, authenticated rejection and approval, hidden repeated-decision actions, duplicate final decision rejection, private own-list scoping, final statuses visible to the requester and responsive layout.

Real PostgreSQL lifecycle acceptance PASS: approval/rejection with distinct identities, stored reviewer/time/revision, active-user checks, self-policy rejection, approved overlap retained, rejected overlap released, stale/final/duplicate rejection, two-connection conflicting decisions with one winner, immutable full history, invalid direct metadata writes rejected, FK/overlap/event constraints, category write denial, production-default authority denial and complete audit-failure rollback. Attendance row counts remained unchanged by leave operations; no payroll, payment or voucher records were created. All business authority fixtures were explicitly injected into a private test application only; synthetic results are not real business approvals.

Focused regressions executed fresh: Attendance pure 57 PASS; payroll read/auth 20 PASS; payroll approval 8 PASS; payroll preview 5 PASS (90 total). Prisma validation/parity, API/frontend/verifier TypeScript and targeted lint PASS. Frontend production build and git diff --check also PASS. Initial isolated SQL JSON-operator precedence and browser-selector encoding issues were corrected and the final actual database/browser run passed. All failed and successful task-owned disposable databases/containers were removed after ownership and zero-session checks; temporary scenario copies were removed. Salary-dev and protected databases were not used for these writes.

### Exact files updated for this policy confirmation

- prisma/schema.prisma
- prisma/migrations/20261016000000_leave_request_foundation/migration.sql (unapplied only)
- apps/api/src/leave/leave-authority.ts
- apps/api/src/leave/leave.controller.ts
- apps/api/src/leave/leave.dto.ts
- apps/api/src/leave/leave.service.ts
- apps/web/src/app/app/leave-requests/page.tsx
- apps/web/src/lib/leave-api.ts
- scripts/db/role-profile.ts (new leave-review columns only)
- scripts/hr-admin-browser-environment.ts
- scripts/attendance-leave-browser-scenario.js
- scripts/verify-leave-postgres.ts
- scripts/verify-leave-foundation.ts
- docs/hr-admin/real-capita-hr-feature-status.md

Current seven-module statuses: Employee COMPLETE for ordinary operations; Users administration BLOCKED; restricted Payroll COMPLETE; approved Payroll Slip COMPLETE; tested Attendance workflow COMPLETE; Leave Apply PARTIAL; Apply Leave List PARTIAL. Leave now includes tested approval/rejection lifecycle foundations, but live identity/category/HR-Admin mappings, self-decision policy and reviewed migration deployment remain explicit gates.

Verdict: PARTIAL for live leave availability; the approved HR/Admin decision lifecycle is implemented and technically verified in isolation. No Sprint 4, finance-worker change, payment operation or accounting posting was begun.

## Sprint 4 — Users administration and complete leave lifecycle (2026-10-16)

This table supersedes earlier sprint statuses while preserving their history. COMPLETE below describes the approved functional scope verified through actual isolated browser/API acceptance; it does not claim genuine production privileges have been activated.

| Real Capita module | Functional status | Evidence and operational position |
|---|---|---|
| Employee | COMPLETE | Ordinary global Employee workflows preserved; 34 fresh pure checks and genuine synthetic Employee creation/attendance integration. Existing accepted browser coverage retained. |
| Users | COMPLETE | Administrator list/search/status/pagination, provisioning, details/edit, activation/deactivation, ACCOUNTANT assignment/removal, separate explicit permissions, binding/unbind/rebind and paginated audit history implemented. Actual browser/API acceptance passed. Live use requires reviewed migration/profile rollout and genuine Administrator designation. |
| Payroll | COMPLETE for approved restricted workflow | Existing monthly readiness/calculation/DRAFT/independent approval is unchanged; fresh read/auth, preview, calculation and approval regressions pass. Unsupported proration, positive-deduction authority and audited correction stay blocked. |
| Payroll Slip | COMPLETE for approved read/print scope | Previously accepted historical payslip/salary-sheet behavior and authorization preserved. No employee self-service or payment receipt is added. |
| Employee Attendance | COMPLETE for established authorized workflow | Actual browser entry/save/finalization and cross-office duplicate protection passed again; 57 pure checks pass. Existing correction/history behavior from Sprint 3 retained without new privileges/statuses. |
| Leave Apply | COMPLETE | Verified non-Accountant employee login, own submission/history/detail/withdrawal, authorized HR on-behalf requests, active categories, dates/overlap/identity/privacy and responsive browser workflows passed. Live use awaits genuine bindings/HR designation and deployment. |
| Apply Leave List | COMPLETE | Own private list and separate explicit HR review queue; employee search, department/office/category/date/status filters, pagination/detail, approve/reject, reviewer/time/reason/history, concurrency and immutable final-state controls passed actual browser/API/database acceptance. Live permissions remain unassigned. |

### Implemented authority and identity

SYSTEM_ADMIN and HR_ADMIN are distinct durable permissions, not additional accounting roles or automatic job-title rights. Existing ACCOUNTANT membership remains unchanged and does not confer either permission. A System Administrator cannot obtain HR approval authority by their title or navigation label. Department Heads and Reporting Managers gain none.

There is no default Administrator, public bootstrap, startup seed or auto-assignment. `UserPermission` preserves grantor, scope, timestamps, expiry, reason and one-way revocation. Expired unreleased grants require explicit revocation before renewed assignment. Account changes revoke existing sessions; expiry/current authority is rechecked server-side and at protected SQL operations.

`EmployeeAccountBinding` records Administrator verification, the global employee, documentation and release history. One active binding per user and per employee is protected by partial unique indexes and restrictive foreign keys. Rebinding is an atomic release/new record, never an overwritten identity. Names/emails are not used as proof. Only verified bindings establish employee self-service. Only HR permission plus a verified reviewer binding establishes leave-decision authority.

Authentication retains HttpOnly cookie sessions, password hashing and live session/user/role validation. Bound employees and explicitly permissioned HR/Administrators can log in without receiving ACCOUNTANT. A restricted HR/employee workspace avoids accounting navigation; existing protected Accounting, Voucher, Salary and Payroll routes still require their original authorization. `/auth/me`, session and logout support genuinely authenticated non-Accountant identities without exposing credentials.

### Completed screens and API

- `/app/users`: own safe account view for ordinary users; explicitly authorized management interface for Administrators. Search/status/20-row pages, create, safe edit, activate/deactivate, ACCOUNTANT role changes, permission grant/revoke/expiry, globally unique verified binding/unbind/rebind, explicit confirmation/reason, and paginated credential-free history. Initial passwords are never returned or audited. Self-administration/elevation is blocked; use another designated Administrator.
- `/users`: guarded list/create/detail/action/history plus minimal employee lookup for Administrators/HR on-behalf use. `/users/access` returns only current capability booleans. All sensitive operations recheck database-backed authority and expected version; no caller-supplied actor is accepted.
- `/app/leave-categories`: explicit HR-only code/name/description, active/inactive management, search/filter/pages, duplicate prevention and paginated configuration history. No destructive delete, allowances or paid/unpaid defaults.
- `/app/leave-apply`: current verified employee or explicit HR on-behalf mode, global employee lookup, active category, office context, dates, reason/reference, loading/error/success states. On-behalf provenance records the actual actor and permission source. Supporting references alone do not authorize anything.
- `/app/leave-requests`: private own records across offices, including HR-created requests; own pending withdrawal. HR-only review mode adds employee name/code search, department/office/category/date/status filters and final decisions with recorded reason/reviewer/time/history. No quota, balance, holiday treatment or salary formula exists.
- Own-employee approval AND rejection are prohibited. Original self-service creators also remain blocked after rebinding, preventing identity-history evasion. A genuinely authorized HR/Admin may decide a recorded on-behalf request for another employee; an extra creator/checker rule is not invented for that case. If no eligible reviewer exists, leave stays pending. Final decisions cannot be overridden/reopened or withdrawn.

Historical employee/department/office/category and decision snapshots remain immutable. Category renaming/deactivation does not rewrite existing leave. No leave event modifies finalized attendance or approved payroll. Approval is not payment and does not authorize deductions.

### Persistence and PostgreSQL boundary

New unapplied migration: `20261017000000_hr_admin_identity`, after the still-unapplied Sprint 3 `20261016000000_leave_request_foundation`. No previously applied migration was modified. Added UserPermission, EmployeeAccountBinding and UserAdminEvent; User adminVersion; category description/version; nine restrictive new foreign keys; active uniqueness; immutable lifecycle/history guards; required atomic administration events; and timestamp/expiry checks. Existing Employee is only related to bindings and remains global.

Transactions use Serializable isolation, authenticated actor-user locks, optimistic versions and atomic credential-free before/after events plus global audit. SQL guards require current real grant/binding records and transaction-local server actor context, and use wall-clock expiry at the protected operation. Trigger functions have fixed search paths, invoker execution and no PUBLIC execute privileges. Existing finance provisioning/executor privileges are unchanged; runtime still cannot insert finance delegates.

Actor context is a trusted-backend boundary, not independent cryptographic PostgreSQL user authentication. Do not claim protection against arbitrary SQL compromise of the backend or privileged database administrators. No genuinely designated users/grants/bindings were added to salary-dev. Updated runtime grants are source-only and require separately authorized rollout after schema review.

### Acceptance evidence

- 63 actual browser/API assertions PASS: real Next/Nest, restricted PostgreSQL runtime and genuine cookie login. Covers Administrator creation/edit and HR grant UI; role assignment/removal; duplicate/stale/self-elevation rejection; verified bindings and duplicate rejection; user/category search/validation/history; non-Accountant employee login; unauthorized administration/accounting/category/review access denial; employee and HR-on-behalf submission; own private history/withdrawal; independent approval/rejection; self-approval and self-rejection denial; final-state immutability; historical category/reviewer preservation; session revocation; reactivation/rebinding; existing attendance save/finalization/office identity; and 390px user/category/leave layouts.
- 47 final focused real PostgreSQL assertions PASS: genuine persisted grants/bindings, global uniqueness and concurrent assignments, controlled conflicts, expiry inside a held transaction, revocation competing with a decision, full audit rollback, immutable history, current permission/binding SQL checks, invalid foreign keys and preserved original instructions. A final focused extension also verifies HR decisions on genuinely recorded other-employee on-behalf requests. No business authority provider is mocked/injected. Scheduling gates delay real transactions solely to exercise races.
- The only initial Administrator fixture is an explicitly synthetic owner/maintenance bootstrap in the disposable database. Every subsequent user, binding, HR assignment, category and leave operation uses actual application contracts. These technical tests are not genuine business delegations or leave authorizations.
- Fresh offline regressions: Employee 34, Attendance 57, payroll read/auth 20, calculation 18, approval 8 and preview 5: 142 PASS. Payroll approval tests use in-memory atomic doubles; they are not mislabeled as PostgreSQL payroll acceptance. Existing payroll/document acceptance from earlier sprints is retained, not redundantly rerun.
- Prisma validation and exact base migration parity for both pending HR migrations PASS. API/frontend/verifier TypeScript, targeted lint, frontend production build (45 routes) and git diff checks PASS. No advanced payment-security suite was repeated.
- An early expanded race test exposed unmapped raw adapter serialization errors; Users administration now returns controlled 409 using the existing error normalizer. The test TypeError was corrected and the real database races rerun successfully. A frontend loading-effect lint issue was corrected; final checks pass. The existing pg concurrent-query deprecation notice remains informational, not a failed assertion.
- Failed and successful test databases/containers are cleaned up only after task ownership, database identity and zero-session checks. Temporary scenario copies are removed. Salary-dev business/schema/role state, protected databases, Aafiyat and real finance/payment/voucher records were untouched.

### Exact Sprint 4 files

1. prisma/schema.prisma
2. prisma/migrations/20261017000000_hr_admin_identity/migration.sql (new; unapplied)
3. apps/api/src/app.module.ts
4. apps/api/src/auth/auth.service.ts
5. apps/api/src/auth/auth.controller.ts
6. apps/api/src/auth/guards/auth.guard.ts
7. apps/api/src/auth/hr-access.ts (new)
8. apps/api/src/users/users.dto.ts (new)
9. apps/api/src/users/users.service.ts (new)
10. apps/api/src/users/users.controller.ts (new)
11. apps/api/src/users/users.module.ts (new)
12. apps/api/src/leave/leave-authority.ts
13. apps/api/src/leave/leave.service.ts
14. apps/api/src/leave/leave.controller.ts
15. apps/api/src/leave/leave.dto.ts
16. apps/web/src/app/app/layout.tsx
17. apps/web/src/app/app/users/page.tsx
18. apps/web/src/app/app/leave-apply/page.tsx
19. apps/web/src/app/app/leave-requests/page.tsx
20. apps/web/src/app/app/leave-categories/page.tsx (new)
21. apps/web/src/lib/leave-api.ts
22. apps/web/src/lib/hr-admin-api.ts (new)
23. scripts/db/role-profile.ts
24. scripts/verify-payroll-acceptance.ts (focused Sprint 4 branch only)
25. scripts/hr-admin-browser-environment.ts
26. scripts/verify-leave-postgres.ts (persisted authority/current self-decision contract)
27. scripts/verify-leave-foundation.ts (retained migration parity with additive Sprint 4 fields separated)
28. scripts/verify-hr-admin-postgres.ts (new)
29. scripts/verify-hr-admin-foundation.ts (new)
30. scripts/hr-admin-sprint4-browser-scenario.js (new)
31. docs/hr-admin/real-capita-hr-feature-status.md
32. docs/hr-admin/administrator-onboarding.md (new)

### Remaining operational gates

Review the two pending HR migrations and source-only runtime grants; authorize a controlled schema/code/profile rollout separately without deploying unrelated pending finance migrations. Obtain genuine System Administrator designation and independently identified authorizing identities through the private maintenance onboarding procedure. Then explicitly configure genuine employee bindings and HR/Admin assignments/categories. No real identity is inferred or automatically appointed by the policies or by technical tests.

See `docs/hr-admin/administrator-onboarding.md` for the secure procedure and trust limits. No additional leave-approval policy decision is required for the six approved policies. Balances, allowances, paid/unpaid treatment and deductions remain outside this implementation. Password reset/recovery and final-leave corrections are not introduced.

Sprint 4 verdict: PARTIAL overall operational readiness. The approved Users and leave functional scopes pass isolated acceptance; production activation remains BLOCKED by genuine identity designation and authorized deployment. No Sprint 5 or deployment was begun.

## Sprint 5 — final functional acceptance and deployment readiness

This is the current assessment. COMPLETE below means approved technical scope
passed actual isolated browser/API acceptance, not that genuine authority is active
or pending HR schema is deployed. No reference interface is mechanically copied.

| Module | Current functional status | Fresh Sprint 5 evidence | Live activation / remaining boundary |
|---|---|---|---|
| Employee | COMPLETE | Actual create, profile edit, search/pagination, deactivate/reactivate, global identity after office switch, validation and mobile layout: 23 Employee/own-Users browser checks. | Existing master unchanged; large-list transfer pagination remains a future scalability improvement. No destructive delete. |
| Users | COMPLETE within approved administration scope | Genuine Administrator login; create/edit/activation, accounting permission assignment/removal, explicit HR grants, verified unique bindings, session revocation/history, unauthorized/self-elevation denial in 63 HR browser/API assertions. | BLOCKED live until migrations 16/17, reviewed grants and genuine Administrator recipient/authorizer designation. No automatic promotion or password recovery feature. |
| Payroll | COMPLETE within restricted monthly scope | Genuine accountant preview, explicit zeros, blockers, DRAFT creation, duplicate rejection, maker-checker denial and separate-accountant approval, approved history: 27 workflow assertions. | Salary/attendance/source policies unchanged. Audited DRAFT correction still separately blocked; positive deduction authority is not fabricated. Approval is not payment. |
| Payroll Slip | COMPLETE for approved read/print | Historical sheet and payslip retrieval plus seven actual print-media assertions: exact money cells, two unique rows, A4 portrait/landscape, hidden controls, row-break protection, no PAID label. | No physical printer or PDF is claimed. Existing 1,000-employee sheet ceiling, accountant-only access and planned allocation labels retained. |
| Employee Attendance | COMPLETE within existing authorized scope | Actual save/retrieve, derived statuses, validation, finalization, repeated-finalization denial, authorized correction/history, cross-office duplicate prevention: included in 33 attendance/leave browser assertions. | Uses only existing correction authority; leave does not automatically mutate finalized attendance. |
| Leave Apply | COMPLETE within approved request scope | Verified employee submission/private history/withdrawal, HR on-behalf submission, active category selection, overlap/privacy/error/mobile checks across 63 and 33 browser/API assertions. | BLOCKED live by 16/17 deployment, genuine bindings/HR authority and approved category activation. No invented balances, quotas or paid/unpaid formulas. |
| Apply Leave List | COMPLETE within approved decision scope | Explicit HR queue/categories, approval/rejection, history and self-decision denial; 47 real PostgreSQL assertions plus additional leave overlap/decision/rollback checks. | BLOCKED live by same deployment/identity gates. Final decisions cannot reopen. No entitlement or payroll deduction feature is implied. |

### Fresh verification and preservation

- 153 distinct browser/API assertions passed: Employee 23, HR/Admin 63,
  attendance/leave 33, payroll workflow 27 and print media 7. Genuine cookie
  authentication and restricted PostgreSQL runtime are used throughout.
- 47 focused HR PostgreSQL assertions passed, plus real leave decision/overlap,
  concurrency, idempotency, FK, immutable audit and rollback acceptance groups.
- A new isolated migration rehearsal proved original 1–14 plus 16/17 can be
  deployed by Prisma from a curated artifact with original checksums, six HR
  tables and no 15 objects. The current three-role profile passes actual runtime
  attestation and fail-closed authority checks on that schema. Deferred 15 was
  subsequently applied normally only inside the disposable test, with no manual
  history edits. The alternative requires independent review/authorization.
- 142 offline regressions passed: Employee 34, Attendance 57, payroll read/auth
  20, calculation 18, approval 8 and preview 5. In-memory tests are not represented
  as database acceptance.
- Prisma validation, both HR schema/migration parity checks, API/frontend and
  focused verifier TypeScript, targeted lint, 45-page frontend production build
  and git diff whitespace check passed.
- The Employee scenario now expects 403 from the existing Users API for an
  ordinary ACCOUNTANT; its obsolete Sprint 1 expectation of a missing 404 route
  was updated. Print tests compare exact money cells rather than whitespace that
  changes with print layout. No product workflow, migration or schema was changed.
- Salary-dev remains at 14 matching applied migrations with 15/16/17 pending.
  All 50 table counts/content fingerprints match before/after. Actual restricted
  runtime startup and existing module reads passed. Fresh external backup and
  isolated restore match all tables/history; no business records/roles/grants or
  identity bindings changed. Exact disposable databases/containers were removed.

### Exact Sprint 5 changes

1. scripts/db/hr-rollout-preflight.ts (new, read-only backup/preservation evidence)
2. scripts/verify-hr-migration-sequence.ts (new, disposable-only Prisma selection rehearsal)
3. scripts/verify-payroll-acceptance.ts (focused migration rehearsal branch only)
4. scripts/payroll-ui-browser-scenario.js (actual print-media assertions)
5. scripts/hr-admin-browser-scenario.js (current Users authorization expectation)
6. docs/hr-admin/sprint5-deployment-readiness.md (new, exact order/dependency/recovery report)
7. docs/hr-admin/administrator-onboarding.md (link to reviewed deployment gates)
8. docs/hr-admin/real-capita-hr-feature-status.md (this current status/history)

Sprint 5 verdict: **PARTIAL operational readiness; independent review ready.**
Complete the independent source review, authorize the exact HR-only migration
artifact/profile rollout, then provide genuine Administrator/HR designations and
verified employee bindings/categories. No deployment or genuine onboarding was
performed. Do not start another sprint or payment integration automatically.

## Sprint 5A — centralized Leave ownership and HR-only finalization

Current statuses remain COMPLETE for the approved technical scopes of all seven
modules: **Employee, Users, Payroll, Payroll Slip, Employee Attendance, Leave Apply
and Apply Leave List**. Live Users/Leave activation remains BLOCKED by authorized
16/17 deployment and genuine Administrator/HR designation, binding and categories.
No real identity was promoted, bound or assigned permission by this sprint.

Leave ownership is now always the active PRIMARY Company resolved by the server.
Optional `officeContextCompanyId` references an active configured Company record
for reporting only. It is stored separately in the immutable snapshot and never
implies employee assignment, ownership or approval scope. Company is not renamed
or mistaken for a separate Office entity. No Prisma fields/tables are added.
Unapplied leave migration 16 adds a matching SQL owner/context guard; applied
migrations 1–14, deferred 15, identity migration 17 and schema.prisma are unchanged.

Both Leave Apply and Apply Leave List show the central owning company. Reporting
context is optional, initially empty, and clearly non-authoritative. Existing
search, pagination, historical department/context filters, detail, withdrawal,
centralized review, independent decisions, privacy and responsive behavior remain.

Fresh HR-only isolated PostgreSQL acceptance: **73 authenticated HR/Admin
browser/API assertions**, **47 existing plus 24 central-ownership PostgreSQL
assertions**, and **36 payroll/document/print/fiscal-year/Voucher browser/API
assertions** pass. These environments have exactly 14 original plus revised 16/17
Prisma history rows and no migration 15 objects. Later deferred-15 deployment was
tested only in a separate disposable rehearsal, preserving all checksums and real
Prisma history. All exact task-owned test resources were removed afterward.

142 focused offline Employee/Attendance/payroll regressions, new ownership behavior
tests, Prisma validation/parity, API/web/verifier types, targeted lint, frontend
build and diff checks pass. No salary/attendance rules, approvals, payments,
accounting postings or real business data changed. Salary-dev's 50 table
fingerprints, 14 applied checksums and existing verified backup remain unchanged.

See [deployment readiness](sprint5-deployment-readiness.md) for the revised guard,
exact HR-only deployment order, runtime privileges, backup/recovery/startup gates
and targeted independent-review requirements. Sprint 5A is PARTIAL operationally;
the implemented correction and isolated functional acceptance pass.

### Exact Sprint 5A changed files

1. apps/api/src/leave/leave.controller.ts
2. apps/api/src/leave/leave.dto.ts
3. apps/api/src/leave/leave.service.ts
4. apps/web/src/lib/leave-api.ts
5. apps/web/src/app/app/leave-apply/page.tsx
6. apps/web/src/app/app/leave-requests/page.tsx
7. prisma/migrations/20261016000000_leave_request_foundation/migration.sql
8. scripts/verify-central-leave-ownership.ts (new offline behavior tests)
9. scripts/verify-central-leave-postgres.ts (new real PostgreSQL assertions)
10. scripts/verify-hr-admin-postgres.ts
11. scripts/verify-leave-foundation.ts
12. scripts/verify-payroll-acceptance.ts
13. scripts/hr-admin-sprint4-browser-scenario.js
14. scripts/payroll-ui-browser-scenario.js
15. docs/hr-admin/sprint5-deployment-readiness.md
16. docs/hr-admin/administrator-onboarding.md
17. docs/hr-admin/real-capita-hr-feature-status.md

## Sprint 6 — controlled HR deployment and security acceptance

**PASS technical deployment.** Approved HR migrations 16 and 17 are now applied
to `localhost:55532/real_capita_accounts_salary_dev` (PostgreSQL 17.11). Original
14 migration checksums remain unchanged; deferred payment evidence migration 15
still has no history row or objects. The curated artifact was used, never an
unrestricted deploy of the full pending source directory. No source migration or
schema changed in this sprint.

| Module | Current technical status | Salary-dev acceptance / activation boundary |
|---|---|---|
| Employee | COMPLETE | Actual runtime list/search/detail and model reads pass; isolated browser workflows retained; no real record changed. |
| Users | COMPLETE | Schema/grants installed; actual runtime management denial and safe authority flags pass. Genuine System Administrator designation remains required. |
| Payroll | COMPLETE | Actual runtime list/preview pass with expected blocking evidence; 36 isolated browser/API checks verify DRAFT/independent approval/documents/print and exact existing rules. No business payroll created. |
| Payroll Slip | COMPLETE | Routes initialize and require authentication. Positive live documents are NOT TESTABLE with no approved business payroll; isolated historical/print acceptance passes. |
| Employee Attendance | COMPLETE | Runtime/model reads, existing focused regressions and isolated save/finalization/browser acceptance pass. No real attendance changed. |
| Leave Apply | COMPLETE | Central owner/identity/category schema installed. Actual capability is fail-closed without a genuine binding/category. Positive submission remains isolated only. |
| Apply Leave List | COMPLETE | Actual review permission denial and protected schema installed; isolated HR review/privacy/concurrency/self-decision/history checks pass. Genuine HR assignment/reviewer binding required. |

Fresh verified backup/restoration matched the baseline. Live metadata matches six
HR tables, 10 reviewed guard functions, 20 triggers, 12 explicit indexes and 17
restrictive foreign keys. All constraints are validated. HR-only privilege changes
preserve unrelated accounting/finance/attendance permissions. Runtime is non-owner
and non-superuser with no elevated memberships; 14 actual rollback-only SQL denial
checks passed. No user was auto-promoted and all six HR tables remain empty.

Independent post-deployment read-only acceptance confirms 56 tables, unchanged
original business fingerprints/counts excluding approved schema/history additions,
unchanged original 14 checksums, deferred-15 absence, exact restored connection ACL
and restricted runtime identity. No protected database, Aafiyat, payment, voucher
or real leave operation was performed. Temporary resources were cleaned up.

Fresh isolated acceptance: 73 authenticated HR browser/API checks, 47 + 24 real
PostgreSQL assertions and 36 Payroll/document/print/legacy HTTP checks. Live runtime
startup, health, 15 authentication denials and seven-module service/read/fail-closed
checks pass. Genuine live authenticated browser acceptance is NOT TESTABLE without
an existing supplied session and genuine HR designation; no token/session was
manufactured to conceal this limit. Offline Employee/Attendance/payroll regressions,
Prisma/parity, API/web/verifier types, targeted lint, frontend build and diff pass.

### Exact Sprint 6 files and configuration

1. scripts/db/deploy-hr-salary-dev.ts (new, one-shot authorized curated deployment)
2. scripts/db/hr-runtime-privileges.ts (new, HR-only reviewed ACL subset)
3. scripts/db/verify-hr-deployment-catalog.ts (new, exact guard/catalog assertions)
4. scripts/db/hr-runtime-smoke.ts (new, separate runtime-only process)
5. scripts/db/verify-hr-salary-dev.ts (new, read-only applied-state verification)
6. scripts/verify-hr-migration-sequence.ts (exercise the subset/catalog in isolation)
7. docs/hr-admin/administrator-onboarding.md
8. docs/hr-admin/sprint5-deployment-readiness.md
9. docs/hr-admin/real-capita-hr-feature-status.md

No permanent .env, credential, application runtime or frontend configuration was
changed. Persistent database changes are only the approved migrations and HR ACL
delta. Existing roles/passwords are unchanged; temporary salary-dev runtime/finance
CONNECT restrictions were restored exactly. Curated SQL/config and evidence are
retained outside Git with the fresh backup; deployment build output was removed.

Next authorized stage: genuine owner designation of System Administrator and
independent authorizer identities, audited private first grant, separate HR/Admin
permission assignment, verified global Employee bindings, approved category
activation and final genuine live browser acceptance. No onboarding, next sprint,
payment confirmation or migration 15 deployment was started automatically.

## Sprint 7 — existing-user verification and conditional onboarding

**BLOCKED genuine onboarding; technical acceptance PASS.** The owner nominated AGM
Abdus Salam ([private onboarding email]) for SYSTEM_ADMIN and A H M Tareq
([private onboarding email]) for HR_ADMIN, subject to independent identity and bootstrap
authorization. Restricted read-only exact-email discovery found neither account.
One unrelated existing User and ACCOUNTANT role exist; permission grants, bindings,
administration events, categories, leave requests and payroll runs remain empty.
Neither candidate's authentication identity or independent reviewing authority was
established. No account was created and no permission or binding was assigned.

Exact candidate-name/email Employee discovery returned no matches. Discovery is
not identity proof and does not exclude differently recorded Employee records.
No name/email-based binding, default password, authentication attempt with guessed
credentials or forged session was used.

| Module | Technical scope | Actual salary-dev acceptance in Sprint 7 | Genuine activation gap |
|---|---|---|---|
| Employee | COMPLETE | Restricted-runtime list, search, detail and model reads PASS; 34 offline integrity checks PASS. Existing browser CRUD acceptance retained. | No authorized candidate login supplied; no real Employee edits performed. |
| Users | COMPLETE | Management remains denied without SYSTEM_ADMIN. Fresh isolated genuine-auth browser/API and PostgreSQL provisioning, role, revocation, binding and audit tests PASS. | Both nominated accounts absent; initial secure account provisioning and independently verified first-grant identities required. |
| Payroll | COMPLETE | Runtime list and blocked preview PASS. Fresh isolated browser/API verifies preview, DRAFT, duplicate-month rejection, self-approval denial and distinct-accountant approval. | No business payroll or genuine candidate session; no real payroll created. Audited DRAFT correction remains separately blocked. |
| Payroll Slip | COMPLETE | Live routes reject unauthenticated access. Fresh isolated approved salary-sheet/payslip, exact totals, historical privacy and print checks PASS. | Live positive documents NOT TESTABLE: no approved business payroll. |
| Employee Attendance | COMPLETE | Runtime reads PASS; 57 offline date/status/finalization/correction-rule checks PASS. Existing browser save/finalization acceptance retained. | No genuine candidate session or authorized live write test; finalized data unchanged. |
| Leave Apply | COMPLETE | Runtime identity/capability checks fail closed. Fresh isolated submission, own history, withdrawal, overlapping-request and privacy acceptance PASS. | Verified bindings and approved active categories absent. |
| Apply Leave List | COMPLETE | Runtime review denial PASS. Fresh isolated HR permission, review, self-decision rejection, immutable history and concurrency acceptance PASS. | Genuine HR_ADMIN grant and reviewer binding absent; no real decisions made. |

COMPLETE describes the approved implemented scope with end-to-end isolated
acceptance; it does not mean genuine authority or live positive use is activated.
Authenticated salary-dev browser acceptance remains NOT TESTABLE. The existing
password-login model contains no stored email-ownership verification field, and
no registration/invitation endpoint exists. Both people must be independently
verified rather than treating their nominated email addresses as authentication.

### Fresh acceptance results

- 73 actual HR browser/API assertions and 36 Payroll/document/print/browser/API
  assertions passed using genuine application login in disposable PostgreSQL 17
  fixtures under restricted runtime privileges. No fixture proves real authority.
- 47 real PostgreSQL authority/binding/lifecycle assertions plus 24 central leave
  ownership assertions passed, including concurrent decisions and audit rollback.
- 150 offline Employee (34), Attendance (57), Payroll calculation (18), read/auth
  (20), approval (8), preview (5) and document (8) checks passed. The approval tests
  use in-memory transaction doubles; they are not database acceptance claims.
- Prisma validation, exact HR/leave schema-migration parity, API/web TypeScript,
  targeted API/frontend lint and git diff whitespace checks passed. No frontend
  build or unrelated payment-security suite was repeated in this documentation
  and operational-verification sprint.
- Restricted-runtime Nest/Prisma startup, health, 15 actual unauthenticated HTTP
  denials and 17 model reads passed, including Accounting/Voucher and HR fail-closed
  service checks. The first standalone smoke launch failed to resolve the API-local
  reflect-metadata dependency; setting NODE_PATH to apps/api/node_modules for that
  test process resolved the launcher issue. No application code/config changed.
- Final read-only verification confirms 16 successful exact migration entries,
  applied HR 16/17, deferred evidence 15 with no objects, unchanged original 14
  checksums/history fingerprints, 56 tables, unchanged historical business records
  excluding approved schema/history additions, and empty six HR tables. Runtime
  remains restricted and non-owner with no elevated role memberships.

Task-owned disposable databases, tmpfs containers, API/Next private builds and
ignored browser scenario copies were cleaned up. Salary-dev received no writes;
its credential configuration, roles, ACLs, migrations and backup were preserved.
Protected databases and Aafiyat were not accessed.

### Exact Sprint 7 changed files and next gate

Only these project documents changed in this sprint:

1. docs/hr-admin/administrator-onboarding.md
2. docs/hr-admin/real-capita-hr-feature-status.md

Read-only runtime/metadata evidence was stored outside Git beside the existing
Sprint 6 backup. All accumulated source work was retained; no feature, migration,
permission or authentication code was changed.

The next step is a separately reviewed, explicitly authorized initial account
provisioning procedure plus private verification of both people and the distinct
authorizing/operator identity. UsersService.create requires an existing authorized
System Administrator, while the private first-grant contract assumes existing User
IDs; neither path authorizes silently creating missing candidates. After valid
bootstrap, use normal Users UI for separate HR_ADMIN assignment and documented
global Employee binding. Salam's own binding requires another designated System
Administrator; Tareq is not automatically one. The owner must specify actual leave
category names/codes before activation. Do not infer quotas or payroll deductions.
No further sprint or privileged operation is started automatically.

## Sprint 7A — account reconciliation and controlled pending onboarding

**PARTIAL: safe pending provisioning implemented; genuine onboarding BLOCKED.**
Restricted read-only inspection of salary-dev found none of the six departmental
emails or two nominated personal emails. The supplied company_admin,
company_accountant, company_hr, company_payroll, company_sales and company_member
roles are absent in persistent roles and the inspected auth/users/seed configuration.
Only ACCOUNTANT exists. No automatic role aliases or duplicate roles were added.
The existing User matches the development seed, not a verified candidate identity
or independent authorizer. No real user was promoted or renamed.

Four global Employees exist. Exact candidate-name/email discovery found no matches;
no authoritative alternative personnel identifiers were supplied. Neither person
can be bound from those discovery results. Obtain each existing Employee Code/ID
from the personnel register and independently verify identity before binding.

### New safe functionality

The Users interface now offers **Reserve pending account without sign-in access**.
Its authenticated `POST /users/pending` endpoint requires explicit SYSTEM_ADMIN
authority, revalidated after actor locking inside a Serializable transaction.
It creates an inactive account with no roles, grants or bindings, no issued
password/token and atomic credential-free administration/global audit history.
No email invitation or verification claim is generated.

The immutable PENDING_CREATED history marker blocks activation, accounting-role
assignment, permission grants and Employee binding at the service boundary. The UI
shows the pending gate and disables those operations. Safe profile editing retains
the marker. No trusted claim-completion provider exists, and no free-text flag can
clear the gate. These additional pending restrictions are application-level; no
new PostgreSQL activation constraint or migration is claimed.

This endpoint cannot bootstrap its own Administrator. Neither real pending account
was created because no verified, authorized initiating User exists. The user's
conditional nominations and permission for inert onboarding do not fabricate the
independent human authorizer required by the existing first-grant contract.

| Module | Technical readiness | Genuine operational state |
|---|---|---|
| Employee | COMPLETE; existing UI preserved, 34 fresh offline integrity checks | Runtime reads previously accepted; no candidate identity/binding inferred. |
| Users | PARTIAL for the new onboarding lifecycle: pending reservation/API/UI accepted; existing administration retained | BLOCKED for real initial creation/designation; secure first-account/bootstrap and trusted claim ceremony needed. |
| Payroll | COMPLETE existing monthly scope; 18 calculation, 20 read/auth and 8 approval regressions pass | No real payroll created; existing source/readiness/maker-checker rules unchanged. |
| Payroll Slip | COMPLETE approved historical read/print scope; accepted Sprint 7 evidence retained | Positive live documents unavailable with zero approved business runs. |
| Employee Attendance | COMPLETE; fresh authenticated browser save/finalize and cross-office duplicate checks plus 57 offline checks | No real attendance record changed. |
| Leave Apply | COMPLETE approved submission/privacy/withdrawal scope in fresh isolated acceptance | BLOCKED live without verified bindings and approved active categories. |
| Apply Leave List | COMPLETE approved queue/decision/history scope in fresh isolated acceptance | BLOCKED live without explicit HR_ADMIN and reviewer Employee binding; no self-decision exception. |

### Actual Sprint 7A verification

- **85 authenticated browser/API assertions passed**, including the new pending
  UI, absence of a password input, DTO-injection/duplicate rejection, server-side
  activation/permission/binding denials and employee provisioning denial. Existing
  Users, HR category, leave approval/rejection/privacy, attendance and responsive
  workflows also passed through genuine application login in isolated fixtures.
- **102 final real PostgreSQL assertions passed**: 31 pending/role-compatibility,
  47 existing authority/identity/lifecycle and 24 central leave-ownership checks.
  Coverage includes stale versions, concurrent pending creation, audit rollback,
  login denial, preserved history and no implicit company-role authority. Explicit
  ACCOUNTANT assignment enables only accounting; HR/Admin flags remain false.
- The first browser attempt stopped at an incorrect test selector expecting an
  explicit HTML option value attribute. The selector was corrected to its accessible
  option name; its isolated database/container were removed and a fresh full browser
  run passed. No production workaround was introduced. A subsequent database-only
  run added role-label compatibility coverage without repeating the browser suite.
- Pending-user offline service/DTO tests passed after first observing the missing
  service fail. Existing Employee/Attendance/payroll regressions total **137 PASS**.
  Prisma validation and exact leave/HR schema-migration parity pass; API/frontend
  TypeScript, focused verifier TypeScript and targeted lint pass. No unrelated
  payment-security suite was run.
- Post-test read-only verification confirms 16 exact successful migrations,
  unchanged original 14 checksums/history, applied HR 16/17, no migration-15 history
  or objects, 56 tables and unchanged historical business fingerprints. All six HR
  tables remain empty. Runtime privileges, credentials, ownership and backup were
  unchanged. All disposable databases, tmpfs containers and task-owned browser/build
  files were cleaned up; no protected database or Aafiyat was accessed.

### Exact Sprint 7A files added or changed

1. apps/api/src/users/users.dto.ts
2. apps/api/src/users/users.controller.ts
3. apps/api/src/users/users.service.ts
4. apps/web/src/lib/hr-admin-api.ts
5. apps/web/src/app/app/users/page.tsx
6. scripts/verify-pending-user-onboarding.ts (new)
7. scripts/verify-pending-user-postgres.ts (new)
8. scripts/verify-hr-admin-postgres.ts
9. scripts/hr-admin-sprint4-browser-scenario.js
10. docs/hr-admin/administrator-onboarding.md
11. docs/hr-admin/real-capita-hr-feature-status.md

No Prisma schema, migration, runtime credential or database role configuration was
changed. Branch Joy and accumulated unrelated work were preserved. Read-only final
evidence is outside Git at
`E:\Joy\salary-dev-backups\hr-sprint6-9888f0007cab4c36983f1536b46bb28a\hr-final-sprint-seven-a.json`.

Remaining genuine actions: privately verify Salam, Tareq and a distinct authorized
initial onboarding operator; complete a reviewed initial-account/claim ceremony
with secure private credentials and durable independent authorization; then appoint
Salam and separately grant Tareq HR_ADMIN through supported workflows. No shared
mailbox, seed login or claimed role substitutes for that proof. Supply verified
personnel identifiers before binding, and actual approved category codes/names
before activation. Salam's own binding needs another authorized Administrator.
Do not send passwords or identity documents in chat. No further sprint, migration
deployment or genuine privilege operation is started automatically.

## Sprint 7B — MD-first authority and dynamic role foundation

**PARTIAL implementation; genuine onboarding and deployment remain BLOCKED.**
Arifuzzaman Babu is the intended highest initial MD authority, superseding the
historical Salam-first assumption. Salam's administration follows MD delegation;
Tareq's HR authority remains separate. No MD email/verified account, independent
real authorizer, claim provider or private authority broker was supplied. No genuine
identity, role, binding or business record was created or activated.

The new /app/roles UI and /authority API support managed-role search/pagination,
creation, metadata/activation changes, canonical permission selection, protected
assignment/revocation requests, MD review/rejection, cancellation/expiry, recorded
grants and immutable history. The existing Role model is extended. Ordinary roles
currently support roles.view; role management requires an explicit expiring MD
mandate. MD review/delegation permissions cannot be assigned through ordinary roles.
This is not yet granular RBAC for all Accounting, Payroll, HR and Project operations.
Those existing guarded modules are not represented as dynamically enabled features.

Privileged membership/permission changes remain pending until a different MD approves.
Routine role metadata work executes within the live ceiling without a false approval
record. Expected versions, idempotency, Serializable execution, database uniqueness
and atomic audits protect retries/concurrency. The private writer is a distinct
non-owner principal; normal runtime cannot execute the privileged function or write
authority tables. No private writer/provider is registered in production; writes
fail closed. No elevated credentials are added to ordinary API configuration.

After MD initialization, old positive administrator/accounting/HR grant paths are
closed until their MD adapters are implemented. The HR-to-MD leave decision rule
overlaps the old HR-only decision contract: both service and SQL block that final
transition after MD initialization until the combined rule is explicitly resolved
and implemented. Payroll keeps its accepted independent ACCOUNTANT approval rule.
No Bill domain was found; approved Salam-or-MD eligibility is documented only, not
implemented by treating vouchers as bills or creating disbursements.

| Module | Current technical scope | Genuine operating boundary |
|---|---|---|
| Employee | COMPLETE established scope; protected MD personnel changes receive controlled denial | Existing data unchanged; no real identity binding. |
| Users | PARTIAL for revised MD-first scope; established administration and inert pending reservations preserved | Real first-account/claim and MD-to-SYSTEM_ADMIN/HR_ADMIN execution bridges remain missing. |
| Payroll | COMPLETE established monthly scope; existing calculation, preview, maker-checker and history retained | No MD stage, payment or posting added; no new real payroll. |
| Payroll Slip | COMPLETE established approved historical read/print scope | No approved business payroll manufactured for live testing. |
| Employee Attendance | COMPLETE established scope; authenticated save/finalize/office identity regressions pass | No salary-dev attendance mutation or leave-derived deduction. |
| Leave Apply | COMPLETE established submission/privacy/withdrawal scope | Genuine bindings/categories still absent; no invented entitlements. |
| Apply Leave List | PARTIAL under revised MD routing; old guarded lifecycle accepted before MD initialization | Combined HR/MD final-decision contract remains unresolved and closes after MD activation. |

Fresh acceptance: **99 authenticated browser/API assertions**, **102 existing
PostgreSQL HR/identity assertions** and **54 authority PostgreSQL/HTTP integration
assertions** passed using isolated synthetic identities and genuine application
authentication. The actual production-default MD claim endpoint returned 503 in
that isolated application before its test-only dependencies were injected. This
does not establish real MD authority or external identity verification.

The role browser identified and verified the correction of a stale editor-version
race. Final focused runs also check private-writer SQL restrictions, null-safe
versions/permission arrays, expired/replayed capabilities, delegation ceilings,
independent review, concurrent approval, protected personnel denial, immutable
history, revocation and complete audit rollback. Failed diagnostic runs were cleaned
up and rerun; no outstanding test failure is being reported as PASS.

Prisma validation, exact authority/HR/leave migration parity, backend/SQL registry
parity, API/frontend/verifier types, targeted lint and whitespace checks passed.
Frontend production build passed (46 static pages). Existing offline Employee,
Attendance and payroll regressions total **150 PASS**, plus authority/pending/central
ownership contract checks. No unrelated payment-confirmation suite was repeated.

New migration **20261018000000_md_authority_foundation is UNAPPLIED** to salary-dev.
It adds five authority tables and Role metadata with restrictive references,
version/lifecycle checks, scoped grant uniqueness, immutable events and bounded
private execution. Source changes do not alter applied migrations. A final read-only
salary-dev check confirms all 16 applied checksums/history, 56 tables, preserved
business fingerprints and six empty HR tables. Migrations 15 and 18 remain unapplied.
The older-schema auth Role projection works under actual restricted read-only Prisma.
All disposable databases/containers and task browser/private-build files were removed.

Final actual runtime-only salary-dev startup, health, 15 unauthenticated HTTP denials,
legacy reads, blocked payroll preview and HR fail-closed smoke checks passed, followed
by another unchanged business-fingerprint/history check. No genuine MD authentication
or privileged live onboarding is claimed.

See [the authority matrix](real-capita-authority-matrix.md) for the complete approved
versus implemented contract, exact 31-file Sprint 7B source manifest, privilege/trust
limits and genuine MD onboarding steps. Final evidence is retained outside Git at
`E:\Joy\salary-dev-backups\hr-sprint6-9888f0007cab4c36983f1536b46bb28a\hr-final-sprint-seven-b.json`.
The final post-smoke preservation report is `hr-final-sprint-seven-b-complete.json`
and the runtime smoke report is `hr-sprint-seven-b-runtime-smoke.json` in that same
outside-Git evidence directory.

Next required work is review and completion of the real first-account/claim/private
broker, legacy permission adapters, broader module permissions and the combined
leave rule; Bill approval needs a real Bill contract/domain. Actual MD identity,
independent authorization and separately approved deployment are mandatory. MD
succession after root revocation needs a reviewed recovery policy. No additional
sprint, migration deployment or real authority activation starts automatically.


## Sprint 7C — organization-wide permission integration

| Module | Current status | Acceptance and operational boundary |
|---|---|---|
| Employee | COMPLETE for approved technical scope | Genuine isolated browser/API create/edit and global identity; dynamic view-only browser/API access and edit/create denial. No duplicate office masters |
| Users | PARTIAL | Existing secure administration accepted in isolation; granular view/create/manage adapters retain SYSTEM_ADMIN. Genuine onboarding and post-MD protected legacy-grant bridge remain closed |
| Payroll | COMPLETE for restricted approved scope | Existing preview/DRAFT/independent approval preserved; granular gates retain ACCOUNTANT, PRIMARY, source/attendance and financial controls. No correction or disbursement added |
| Payroll Slip | COMPLETE for approved read/print scope | Historical approved-only DTOs/print unchanged; additional document permission, no paid claims |
| Employee Attendance | COMPLETE for established authorized scope | Existing browser/finalization/history acceptance and office constraints preserved; granular view/edit/finalize/configuration checks |
| Leave Apply | COMPLETE for approved technical scope | Verified own identity/privacy, submission/withdrawal and category prerequisites preserved. No genuine bindings/categories activated |
| Apply Leave List | PARTIAL | Review/list and privacy accepted. After MD activation, final approval/rejection remains blocked until the combined MD/HR final-decision policy is specified |

All COMPLETE classifications describe accepted technical scopes, not genuine
production authority activation. Dynamic roles and navigation supplement specialized
financial/HR permissions. Salary-dev retains 16 applied migrations; 15 and 18 remain
unapplied. See [exact Sprint 7C scope, tests and file manifest](sprint7c-permission-integration.md).
