# Sprint 7E controlled deployment and operational readiness

Verdict: **PASS for the authorized deployment and technical acceptance; PARTIAL for live operational readiness.** Sprint 7E ends here. No genuine authority was activated.

## Identity and safety gates

- Branch `Joy`; existing accumulated work retained. No pull/merge, branch switch, commit, push, reset or clean. The explicit sprint prohibition superseded the old pull-first instruction.
- Exact endpoint: `localhost:55532/real_capita_accounts_salary_dev`; PostgreSQL **17.11** (`170011`), internal port 5432, PRIMARY active. Dedicated container `real-capita-accounts-postgres`, ID `41c66af4e609542c5714c94a6b262637e4fda9fae8b6836e9a4dfa5590def192`, existing volume `real-capita-accounts_postgres_data`, loopback-only host mapping. Protected databases and unrelated containers were not accessed.
- All 16 original successful migrations matched their repository SHA-256 checksums and previous independent acceptance. No failed migration or partial authority/workflow objects existed.
- All **47 files** in the Sprint 7D review manifest matched byte-for-byte before deployment and again after technical acceptance, before these intentional documentation updates. Package SHA-256: `5d5875d069402fc32f6495888c8fcb35f1869017202ce29ec8e937795ba5a3ba`. Reviewed application code, schema, SQL and privilege helpers remain unchanged.
- Migration owner/runtime/finance roles are non-superuser, lack role/database creation, replication, bypass-RLS and inherited memberships. Only those three non-superuser roles had salary-dev CONNECT; PUBLIC had none. Migration role owned existing tables and had required database/schema CREATE.
- No other salary-dev client sessions existed at backup/deployment gates. Available database disk headroom exceeded 1 GiB. Runtime/finance CONNECT was revoked during the maintenance window; no existing application session was terminated. Owner-only migration sessions remained available. The original database ACL was restored only after catalog, schema, data and actual runtime-role SQL denial checks passed.

## Retained backup and tested restoration

External directory (restricted current-user ACL, outside Git):

`E:\Joy\salary-dev-backups\sprint7e-12ca9583e72d471cbd785b04de135c4c`

- Archive: `salary-dev.dump`, **414242 bytes**.
- Backup evidence timestamp: **2026-10-17 16:00:47 UTC / 22:00:47 Asia/Dhaka**.
- SHA-256: `17df5953066b00f4c6efaec6a8406c22be610f1e07ec93c80b9df4545c46c308`.
- PostgreSQL 17 custom-format exported-snapshot dump; archive listing and full extraction passed.
- Actual single-transaction restore into new disposable `rc_restore_e510c65ab22f2599ac8de4d7` on a separately labelled PostgreSQL 17 tmpfs instance. All **56 tables**, counts/content fingerprints and migration history matched; no unvalidated constraints. Exact task-owned container removed after identity checks.
- Ownership/ACL replay was deliberately excluded from the disposable restore. Live owner/ACL acceptance was performed independently; this backup is not a claim of complete cluster-role/credential disaster recovery.

## Applied migrations and provenance

Actual result: **16 â†’ 18 successful migrations**, **56 â†’ 63 public tables**.

1. `20261018000000_md_authority_foundation` actually applied by Prisma, checksum `409e1327b8cf8f698369502005c50235dc0ce203f11426ec6b5cc81e997798fc`.
2. `20261019000000_leave_hr_md_workflow` actually applied by Prisma, checksum `28f926770e37ca31dfedd04bf91b4b3a4f3a1fa693b50e24c0cd9e503583850d`.

The established selective procedure copied the exact 16 applied migrations into an external curated artifact, then added/deployed **18 alone**, verified it, then added/deployed **19**. No unrestricted deployment, migration resolve, reset, manual migration-history insert or applied SQL edit occurred.

**Deferred:** `20261015000000_payroll_confirmation_evidence` remains pending and was absent from every deployment artifact/history. Its acknowledgment table remains absent. Its source checksum remains `c0a0aad7c3882cc601acfdcccfe8778ee9a623e761a54772186b8d5b01154059`.

| Successful migration | SHA-256 |
|---|---|
| `20260613193905_phase_1a_auth` | `333de21d9a3cefcfadb06d89fe79338af6ae3f26b2c9a37b870b196d4d90c5ae` |
| `20260613211712_phase_2a_accounting_foundation` | `ef5384413e50c4032cff1b28e8ed43016c79dd84d8e226bceff98a4605d6449a` |
| `20260614163238_phase_2c_voucher_schema_foundation` | `223717314d88951c0ece6e6d4ee71109660bf5eaec4149bae21af3bc4c76236e` |
| `20260615123515_phase_2e_mfs_schema_foundation` | `25b42272183dcc0804ed839e23d2eec4d595389e1a559629229d558cc33f241c` |
| `20260619204559_add_voucher_reversal_linkage` | `6aa5a527086b5ef538cc7fad29fabf511a9108343cb6dc9df1ae3725bc92cb0a` |
| `20260623000000_phase_2m_customer_booking_foundation` | `2c46e9966f2e899ca2e198c20c0a68fe0d61ab8901945938bde9b508e30ad55f` |
| `20260809193952_salary_foundation_phase_1` | `1ff105715ffc66904aa5d59c42ba7c48a0963b1f960c08a36ceb0d7f7d12a212` |
| `20260823000000_phase_2_employee_records` | `a7084c05078f9d4c63f2f85bb1e3e0b86cc56d896665345f1cc85d4d46fb7fb5` |
| `20260830000000_phase_2_employee_records_integrity_fix` | `087d85d2cf467f9a0f485d1632c8dc51bc21ea5f230949abf6f76f8414e3a226` |
| `20260902000000_hr_2b_work_schedule_foundation` | `226f4ded5071db0081d1809c2ae075e0844c44f1a73cfec3aeffce3854da214d` |
| `20260906000000_hr_2c_attendance_foundation` | `0afd557f7f6ec5d1c5458b60c6d2f4fa42a28e6cc75d2d2b55758929dc927d2c` |
| `20260906212958_multi_office_company_foundation` | `0e00134eeef18731aa56c5335d760d5b318778fb2a418ccc16a56f106dc45c21` |
| `20261013000000_hr_3b_payroll_foundation` | `7d307fc15b57a6e580e9839f321c7af6d4fb963b5a9d265a3b4d5e75cf9c528c` |
| `20261014000000_payroll_payment_foundation` | `417a255a1c4330258aa5152b6a6747b863521c0f2b2685b041b15641e226f493` |
| `20261016000000_leave_request_foundation` | `87b2dfb8b675fc5ce9e43c895e9e3ca623883126e0995dbc8b4c7b734ed83b17` |
| `20261017000000_hr_admin_identity` | `1eb72f7b089c29891d309912ddbd20bf1f94fe93196efad49311b5f0554cb6c9` |
| `20261018000000_md_authority_foundation` | `409e1327b8cf8f698369502005c50235dc0ce203f11426ec6b5cc81e997798fc` |
| `20261019000000_leave_hr_md_workflow` | `28f926770e37ca31dfedd04bf91b4b3a4f3a1fa693b50e24c0cd9e503583850d` |

## Catalog, grants and data preservation

- Installed function bodies/owners, reviewed search paths, named enabled triggers (including five dynamically installed owner guards), validated named CHECK/FK constraints and valid indexes were verified against reviewed SQL. Exact additive Prisma DDL parity passed; final deployed-schema Prisma diff is empty after excluding only deferred migration 15 from the model projection.
- Runtime received only SELECT on `authority_mandates`, `authority_role_grants`, `authority_requests`, `authority_events`, `leave_workflows`, `leave_stage_decisions`, plus EXECUTE on read helpers `authority_effective(text)` and `authority_live_mandate(authority_mandates)`.
- `authority_bootstraps` remains unreadable to runtime. Runtime/finance cannot write any of the seven new tables. No PUBLIC grants exist on those tables.
- `authority_command(text,text,jsonb)` and `leave_stage_command(text,text,jsonb)` have **migration-owner-only EXECUTE**. PUBLIC/runtime/finance are denied. No private principal, credential, broker or person was provisioned. A later separately secured private executor must receive only the reviewed bounded grants; do not reuse runtime or finance identity.
- **24 actual SQL denials** ran under the ordinary runtime role inside rollback-only probes before reopening CONNECT: two command calls, INSERT/UPDATE/DELETE on all seven new tables, and protected role-permission UPDATE.
- Independent final read-only verification matched every pre-existing table ACL/owner, original database ACL, all **55 existing business-table** counts/content fingerprints, and all 16 original migration history entries. Roles were compared through their original column projection because migration 18 adds five defaulted columns; no original field changed.
- Employee, Attendance, Payroll, Accounting, companies/offices, users/role assignments, HR categories/bindings and audits are preserved. All seven new tables are empty. No genuine MD, new user, authority grant, leave decision, payroll run, payment or voucher was created.
- Salary-dev has no historical leave requests; immutability and legacy upgrade behavior were exercised using synthetic historical rows in disposable PostgreSQL, not claimed from nonexistent live rows.

## Smoke and isolated functional acceptance

- Restricted runtime Nest/Prisma startup and health passed; **20 actual HTTP 401 boundaries** passed, including Users, Roles, MD queue, Payroll Slip, Employee, Attendance, Accounting and Project routes.
- Existing Employee list/search/detail, 17 legacy model reads, accounting/voucher reads and payroll list passed. Payroll preview correctly remains BLOCKED. No payroll run exists, so an approved live payroll slip could not be positively viewed.
- MD authority absence, Users/role-management denial, MD queue denial and default claim verifier/private writer **503** behavior passed. These are intended onboarding restrictions.
- Next frontend started against the restricted API and rendered 11 routes: login, dashboard shell, Employee, Attendance, Payroll, Users, Roles, Leave Apply, Apply Leave List, Project and ledger. This proves unauthenticated rendering/sign-in shells; **no genuine authenticated browser session was supplied or fabricated**.
- Disposable current leave suite: **121 PostgreSQL-backed HTTP/security assertions**, including HR-only recommendations, MD-only final decisions, both disagreement outcomes, self-decision rejection, retries/concurrency, revoked sources/MD, atomic audit rollback and separate genuine Prisma historical upgrade excluding 15.
- Disposable authority suite: **84 PostgreSQL/HTTP assertions**, including independent one-use bootstrap, expiration/replay rejection, bounded MD-to-AGM delegation, dynamic role creation, protected permission review, grants/revocation, escalation denial, audit rollback, concurrent decisions and root/downstream revocation. A Sprint 7E adapter reused existing suites while asserting the Sprint 7D retired HR-only endpoint; original reviewed test files were preserved.
- Payroll compatibility: 8 focused in-memory approval/maker-checker/rollback/concurrency assertions and 8 frozen-document assertions passed. Actual isolated authority HTTP tests also verified that generic payroll permission does not supply ACCOUNTANT and that specialized permission denials remain effective. This does not claim a new full payroll database transaction run.
- Additional focused checks: 19 leave contract assertions, 51 business permission assertions, full workspace TypeScript, six new runner TypeScript checks, Prisma validate, authority/leave DDL parity, six-file targeted ESLint and git diff --check passed. No unrelated production build was repeated.
- Task-created isolated databases/containers, temporary runner files and API/web outputs were removed; no real transactions or seed data were used on salary-dev.

## Readiness at Sprint 7E stop

| Area | IMPLEMENTED | DEPLOYED | TESTED in 7E | LIVE-AUTHORIZED |
|---|---|---|---|---|
| Employee | Yes | Yes | Existing reads + frontend shell | Existing authorization preserved; genuine-user acceptance not established here |
| Users | Yes, guarded administration | Yes | Denials + isolated identities | No genuine administrator activation |
| Monthly Payroll | Yes | Existing schema retained | Read/blocked preview, approval compatibility | No new payroll authority or payroll operation authorized |
| Payroll Slip | Yes, approved frozen documents | Yes | Access denials + isolated document checks | Live positive viewing pending approved run and authorized user |
| Attendance | Yes | Yes | Model read + protected route/shell | No new attendance authority activated |
| Leave Apply | Yes, two-stage lifecycle | Yes, 18/19 | Fail-closed live + positive isolated HTTP | Pending genuine binding/categories/authority |
| Apply Leave List | Yes, HR/MD stages | Yes | Denials, shell, isolated decisions/history | Pending genuine HR/MD onboarding |
| Dynamic Role Management | Yes | Yes, 18 | 84 isolated assertions + live denial | Pending genuine MD/private broker/delegation |
| MD Approval Dashboard | MD leave queue within Apply Leave List; no separate general dashboard | Queue deployed | MD absence denial + isolated MD decisions | No genuine MD activation |

Remaining real-world prerequisites, requiring separate business/security authorization:

1. Independently verify **MD Arifuzzaman Babu** and the global Employee binding; create/approve his genuine account through an authorized onboarding ceremony.
2. Name a distinct independent initial authorizer, record auditable evidence, issue an expiring one-use hashed bootstrap capability through a secure channel, and deploy a genuine account-claim verifier. Email/name/actor ID is not identity proof.
3. Deploy an independently isolated private authority broker/executor with restricted OS/service identity, non-owner/non-superuser/no-membership database principal, reviewed bounded EXECUTE grants, credential custody and authenticated actor provenance. Default 503 remains until then.
4. Resolve the still-closed protected legacy SYSTEM_ADMIN/HR_ADMIN/ACCOUNTANT onboarding bridge through a separately reviewed pathway; no SQL bypass or fabricated verifier.
5. MD explicitly delegates a bounded, expiring mandate to **AGM Abdus Salam**. Separately authorize appropriate HR/Admin responsibilities for **A H M Tareq**, including verified global Employee binding and any protected MD approvals.
6. Verify all employee-account bindings, approve leave categories and resolve any real MD-own-leave/legacy-pending policy before use.
7. Complete authenticated real-user navigation, role/denial, leave and approved-document acceptance with the actual authorized people. Technical fixtures do not constitute business authorization.

## Actual deviations and retained failures

No migration SQL failed. Prisma applied each migration once and maintained its own history. The deployment verifier stopped safely with CONNECT closed on two harness assumptions: an overly specific search-path string and a trigger-name uniqueness assumption (the reviewed dynamic owner guard deliberately exists on five tables). A later denial probe used nonexistent `leave_workflows.id` instead of `requestId`. These **new verifier defects** were corrected; installed histories/checksums/data were inspected read-only and only verification/remaining authorized work resumed. No migration was retried, falsified, edited or rolled back. Original stop evidence is retained.

The older isolated authority harness attempted the intentionally retired HR-only final-decision endpoint. Its disposable resources were cleaned; the scoped adapter asserted the current 409 contract and the authority suite passed. Initial runtime smoke also attempted to count protected bootstrap rows; that read was removed because the independent maintenance verifier checks empty bootstrap state while runtime must remain denied. No application protection was weakened.

The first targeted lint invocation lacked the repository's per-app config; the external targeted config was then loaded using a valid Windows file URL and passed. The existing pg concurrency deprecation warning remains non-failing. All successful final evidence is separate from failed-attempt logs.

External evidence: `source-integrity.json`, `preflight.json`, `restore-rehearsal.json`, `authority-before.json`, `migration-18-result.json`, `migration-19-result.json`, `authority-deployment-result.json`, `authority-final-readonly.json`, `authority-schema-diff.sql`, `authority-runtime-smoke.json`, `isolated-leave.log`, `isolated-authority-sprint7e.log`.

## Exact Sprint 7E source/document manifest

New files:

- `scripts/db/authority-rollout-preflight.ts`
- `scripts/db/deploy-authority-salary-dev.ts`
- `scripts/db/verify-authority-salary-dev.ts`
- `scripts/db/authority-runtime-smoke.ts`
- `scripts/db/authority-web-smoke.ts`
- `scripts/verify-authority-deployment-acceptance.ts`
- `docs/hr-admin/sprint7e-deployment-acceptance.md`

Existing documents updated:

- `docs/operations/salary-dev-deployment-acceptance.md`
- `docs/hr-admin/administrator-onboarding.md`
- `docs/hr-admin/real-capita-hr-feature-status.md`
- `docs/handoff.md`

Existing application/schema/migration/privilege source files were not edited. Next.js can add test-output include paths to the already-modified `apps/web/tsconfig.json`; the new web runner now removes only its own token entries. Existing test include entries were retained to avoid overwriting accumulated settings. All pre-existing Git work remains uncommitted.
