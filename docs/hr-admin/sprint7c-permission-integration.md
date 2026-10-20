# Real Capita Group — Sprint 7C granular permission integration

Technical integration is implemented in source and isolated fixtures. Deployment and genuine authority activation remain BLOCKED. This is not a production authorization or payment activation.

## Registry and backend enforcement

The canonical registry is `apps/api/src/authority/permission-registry.ts`. Each entry records its implemented action, fixed existing data scope, specialized prerequisite, assignability and delegability. Nest controller/handler metadata determines the required action; URLs, request bodies and frontend labels cannot supply authority.

| Module | Implemented permission families | Preserved prerequisites and scope |
|---|---|---|
| Workspace | dashboard.view | Authenticated shell; no new analytics endpoint |
| Roles / protected authority | roles.view/manage, authority.review/delegate | PRIMARY, private broker, independent MD review; protected codes cannot enter ordinary roles |
| Users | users.view/create/manage | Explicit SYSTEM_ADMIN remains mandatory. Legacy elevation and first-account provisioning close after MD activation until the reviewed MD-to-specialized-authority bridge exists |
| Employee / departments | employees.view/create/edit, departments.view/create/edit | Global employee identity; explicit dynamic grants can replace the old ACCOUNTANT entry role only for these nonfinancial masters |
| Attendance / schedules | attendance.view/edit/approve/manage, schedules.view/manage | ACCOUNTANT, selected office, existing finalization, revision and correction authority |
| Leave | leave.view/create/withdraw/review/approve, leave.categories.manage | Own verified binding, or separate HR_ADMIN plus granular permission for HR scope. No access to another employee from a binding. Final decisions stay closed after MD initialization |
| Payroll | payroll.view/preview/create/approve, payroll.documents.view | ACCOUNTANT, active PRIMARY, exact approved sources/attendance, independent maker-checker, approved immutable snapshots |
| Payment preparation | payroll.preparation.view, payroll.batches.create | Existing ACCOUNTANT and grant/evidence controls; no generic confirmation permission |
| Salary sources | salary.view/manage/approve/preview | ACCOUNTANT; existing source approval/effective-date validation |
| Accounting | accounting.view/manage, vouchers.view/create/edit/delete/post/reverse, reports.view | ACCOUNTANT, owning fiscal year, active office/period and existing posting/reversal contracts |
| Projects / cost centers | projects.view/create/edit, cost-centers.view/create/edit | ACCOUNTANT; existing globally shared records. Activation changes use the existing edit action |
| Existing customer booking control | bookings.view/manage | ACCOUNTANT and existing booking/receipt controls; no new Bill domain |

No export permission is advertised: browser printing is part of authorized document/report viewing. No bill approval or external settlement is invented. Scope labels describe existing enforcement; they do not introduce an office/project/department filter policy. Arbitrary payload scopes are rejected. Finer delegated per-office or project-specific scopes need a separately specified service contract.

## Compatibility and navigation

AuthGuard checks fresh authority after session/user validation. No authority migration or no initialized MD preserves the existing entry checks. An initialized but revoked MD never re-enables legacy bypasses. Errors do not downgrade into legacy mode.

After activation, backend allowlisted capabilities filter navigation and direct-page access. Financial and HR capabilities also require their specialized authority. Revocation is effective on subsequent requests and navigation refresh; already executing operations are not retroactively cancelled. Every protected API independently checks authority. Employee, Users, Attendance, Payroll, Project, Cost Center, Voucher, Accounting setup, Company and Salary source mutation/document controls use shared permission-aware affordances. Employee readers do not mount salary/payment-profile panels or fetch unauthorized optional department lookups.

The editor groups real operations by module and displays fixed scope/prerequisites, allowed choices, out-of-ceiling choices and protected MD-only choices. Assignments, permission changes and reactivation stay pending until independent MD approval. Metadata edits remain routine within ceiling and current version. Current grants and immutable before/after history remain available.

## SQL and approval boundaries

Only UNAPPLIED migration 18 changes. Its registry arrays and bootstrap/root ceiling match the source registry. Effective role grants additionally require the role's current permissions to remain inside the originating mandate ceiling: a later broader role edit cannot silently widen an earlier grant. Isolated acceptance expands a role through a different properly delegated actor and independent MD decision, proves the old grant becomes ineffective, then proves an approved narrowing restores only in-ceiling access.

Role/grant/request mutations retain the private bounded writer, Serializable transactions, company lock order, versions, idempotency, independent review and atomic immutable audit history. Runtime cannot directly provision authority or execute the private command. Business-module permission enforcement is application-level; the shared runtime role's legitimate business-table DML is not per-human SQL/RLS authorization. A privileged database owner remains outside application immutability guarantees.

Payroll's ACCOUNTANT maker-checker is unchanged. The unresolved leave policy is whether MD replaces the HR final reviewer or adds a separate final stage. After MD initialization, both approve and reject remain blocked by existing service/SQL guards, and capabilities/UI do not advertise an executable final decision. Owner clarification and a combined transactional contract are required. Ordinary authorized category configuration does not invent entitlements or deductions.

There is no Bill approval aggregate. Voucher posting is not bill approval. Salam OR MD eligibility with no self-approval remains a future Bill integration contract.

## Operational gates

Salary-dev remains PostgreSQL 17 at localhost:55532 / real_capita_accounts_salary_dev, with 16 applied migrations. Migration 15 stays deferred; 18 stays unapplied. No schema, role, credential, privilege, permission, binding or business record is changed there.

A real MD verified account identifier/email, independent authorization ceremony, trusted private claim verifier/broker and explicit delegate ceilings are still required. No production synthetic providers are registered. The legacy SYSTEM_ADMIN/HR_ADMIN/accounting provisioning bridge after MD activation remains closed; generic role selection cannot replace that protected workflow.

## Verification

See the final acceptance results below. PostgreSQL fixtures use only uniquely owned disposable PostgreSQL 17 instances with restricted runtime identities and genuine application login. Synthetic authority is technical evidence, not real onboarding. Exact databases and containers are removed after identity/session checks. Salary-dev read-only verification confirms 16 exact checksums, 56 tables, six empty HR tables, runtime restrictions and preservation of 50 historical-table contents against the Sprint 6 baseline.

### Final executed results

- 56 canonical permission entries; exact SQL role, mandate and MD-root registry parity.
- 112 genuine authenticated browser/API checks: 85 existing HR workflows plus 27 role-editor, different-menu, direct-URL/API and Employee reader/privacy/control checks.
- 186 PostgreSQL-backed HR/authority assertions: 31 pending-account/legacy compatibility, 47 HR lifecycle, 24 central ownership and 84 authority/integration checks. Includes concurrent role edits/approvals, permission revocation, broader-role ceiling invalidation, atomic audit rollback and private writer denials. Counts are assertions from the final complete run, not additional independent scenarios from repeated diagnostic runs.
- 239 focused offline assertions across granular authorization (51), read/auth (20), calculator (18), approval (8), preview (5), documents (8), Attendance (57), Employee (34), readiness (13), DRAFT (8) and approval-readiness (17). Additional default-provider/registry contracts passed. In-memory transaction tests are not presented as PostgreSQL acceptance.
- 58 rendered permission-control assertions prove action suppression, explicit allowance and unchanged pre-MD presentation across financial and HR actions.
- Prisma validation; authority, HR identity and Leave schema/migration parity; API/web/verifier TypeScript; targeted API/web/verifier lint; frontend production build (46 static pages) passed. Git diff and edited-file whitespace checks passed.
- Final read-only salary-dev preservation report: `E:\Joy\salary-dev-backups\hr-sprint6-9888f0007cab4c36983f1536b46bb28a\hr-final-sprint-seven-c.json`.
- Disposable databases, exact task-owned tmpfs containers and synthetic browser fixture files were cleaned. No business database writes or migration deployment occurred.

An initial browser run exposed an edited-file encoding error and outdated fixture selectors after module grouping; these were corrected and the final full browser run passed. Targeted lint/type findings were corrected. No unresolved functional test failures remain. The existing PostgreSQL driver emits a client-query deprecation warning; it did not fail acceptance.

Verdict: **PARTIAL** overall activation readiness. Source integration and focused acceptance pass; genuine MD identity/private ceremony, specialized authority provisioning bridge, finer optional scopes and combined HR/MD leave final-decision authorization remain operational/contract boundaries. No Bill domain is invented.

## Exact Sprint 7C source files

- `apps/api/src/auth/auth.types.ts`
- `apps/api/src/auth/business-permissions.ts`
- `apps/api/src/auth/guards/auth.guard.ts`
- `apps/api/src/auth/guards/roles.guard.ts`
- `apps/api/src/authority/permission-registry.ts`
- `apps/api/src/authority/authority.service.ts`
- `apps/api/src/leave/leave-authority.ts`
- `apps/api/src/leave/leave.service.ts`
- `prisma/migrations/20261018000000_md_authority_foundation/migration.sql`
- `apps/web/src/lib/authority-api.ts`
- `apps/web/src/lib/workspace-permissions.ts`
- `apps/web/src/lib/leave-api.ts`
- `apps/web/src/app/app/layout.tsx`
- `apps/web/src/app/app/page.tsx`
- `apps/web/src/app/app/_components/permission-controls.tsx`
- `apps/web/src/app/app/roles/page.tsx`
- `apps/web/src/app/app/employees/page.tsx`
- `apps/web/src/app/app/employees/[id]/page.tsx`
- `apps/web/src/app/app/employees/attendance/daily-attendance-panel.tsx`
- `apps/web/src/app/app/employees/attendance/settings-rules-panel.tsx`
- `apps/web/src/app/app/employees/attendance/settings-calendar-panel.tsx`
- `apps/web/src/app/app/employees/attendance/attendance-history-detail.tsx`
- `apps/web/src/app/app/payroll-runs/page.tsx`
- `apps/web/src/app/app/payroll-runs/new/page.tsx`
- `apps/web/src/app/app/payroll-runs/[id]/page.tsx`
- `apps/web/src/app/app/payroll-runs/_components/payroll-run-list-view.tsx`
- `apps/web/src/app/app/projects/page.tsx`
- `apps/web/src/app/app/cost-centers/page.tsx`
- `apps/web/src/app/app/leave-requests/page.tsx`
- `apps/web/src/app/app/users/page.tsx`
- `apps/web/src/app/app/vouchers/page.tsx`
- `apps/web/src/app/app/vouchers/_lib/VoucherForm.tsx`
- `scripts/verify-business-permissions.ts`
- `scripts/verify-authority-migration.ts`
- `scripts/authority-postgres-acceptance.ts`
- `scripts/authority-browser-scenario.js`
- `scripts/hr-admin-browser-environment.ts`
- `scripts/verify-payroll-read.ts`
- `docs/hr-admin/sprint7c-permission-integration.md`
- `docs/hr-admin/administrator-onboarding.md`
- `docs/hr-admin/real-capita-hr-feature-status.md`
- `docs/hr-admin/real-capita-authority-matrix.md`
- `apps/web/src/app/app/accounts/groups/page.tsx`
- `apps/web/src/app/app/accounts/ledger/page.tsx`
- `apps/web/src/app/app/fiscal-years/page.tsx`
- `apps/web/src/app/app/accounting-periods/page.tsx`
- `apps/web/src/app/app/cash-bank/page.tsx`
- `apps/web/src/app/app/company/page.tsx`
- `apps/web/src/app/app/company/_components/OfficeEditor.tsx`
- `apps/web/src/app/app/company/_components/OfficeList.tsx`
- `apps/web/src/app/app/company/_components/CompanyMediaField.tsx`
- `apps/web/src/app/app/_components/salary-structures-workspace.tsx`
- `apps/web/src/app/app/_components/salary-assignment-panel.tsx`
- `apps/web/src/app/app/_components/payment-profile-panel.tsx`
- `apps/web/src/app/app/_components/salary-preview-workspace.tsx`
- `scripts/verify-permission-controls.ts`
