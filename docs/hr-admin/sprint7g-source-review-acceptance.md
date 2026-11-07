# Sprint 7G reconciliation and secure onboarding source review

Date: 2026-10-31, Asia/Dhaka. Decision: **READY FOR INDEPENDENT SOURCE REVIEW**. Overall verdict: **PARTIAL** because login operator/legitimacy attribution is unresolved and genuine onboarding/deployment prerequisites remain outstanding. This decision authorizes neither deployment nor activation.

Branch `Joy`, checkpoint `9b3e93678385c79028b88ff38c731b4d572af05d`. Existing work is preserved. No reset, clean, commit, push, merge or branch change was performed. Sprint 7G stops at this review package.

## Read-only reconciliation

The read-only review used a retained reference restored into an isolated PostgreSQL 17 instance. The comparison matched the prior acceptance snapshot. The differences from the older baseline were limited to login-related metadata. The comparison found no changes to roles, permissions, employee bindings or business tables. Operator attribution remains unresolved. Detailed records and backup evidence are retained privately.

No salary-dev records changed during this review. Applied migrations 1–19 were preserved, including the deferred migration 15 source.

## Migration 20 review and minimal corrections

`20261020000000_secure_leadership_onboarding` remains **unapplied** on salary-dev. The six new Prisma models, column types, foreign keys, indexes and restrictive historical relations match the SQL. Installation adds objects without rewriting existing business records. It depends on the installed 17/18/19 contracts and does not require migration 15. The existing selective procedure remains applicable: curate an explicit reviewed migration directory, exclude 15, preserve original SQL bytes and Prisma checksums, apply in order and verify; never use unrestricted deployment against salary-dev.

Reviewed boundaries include hash-only claim capabilities, 15-minute expiry, cancellation/consume-once states, inactive claimed accounts, independent verified Employee binding, exact signed actor/session/token/command/payload/assurance, two-minute proof expiry, immutable nonce consumption, distinct independent authorizer, live attestor session, bounded initial bootstrap, protected writers, immutable history, and guarded recovery/revocation. The migration retains the reviewed leave policy and only the existing two verified-onboarding exemptions in its forward replacement of `authority_command`. Applied migration SQL was not edited.

One integration defect was reproduced with original migration 20: approving specialized ACCOUNTANT responsibility for an existing membership raised `23505`; expired specialized grants also blocked renewal through uniqueness. The original-source isolated run failed on the expected membership constraint, not a missing configuration gate.

The correction reuses an existing ACCOUNTANT membership; a fresh independent MD approval supersedes earlier APPROVED same-scope instructions into final REVOKED history with immutable supersession events. For HR_ADMIN/SYSTEM_ADMIN it retains and one-way revokes the previous permission before inserting a new bounded MD grant. Stale revocation of an old request cannot remove a newer grant. Expected account version, distinct MD review, session revocation and atomic audits remain enforced. No schema or applied migration change was needed.

Corrected migration SHA-256: `1bd809c753286020a5f32c343acf9263db034b8f8cd96b7cfd551bb0552bfdab`. The 7F acceptance checksum remains historical evidence of the pre-correction source.

## Private executor findings and corrections

1. **Column-only writes:** table privilege checks missed column-specific INSERT/UPDATE grants. Startup now checks `has_any_column_privilege` too. RED/GREEN tests and a real disposable PostgreSQL column-only grant prove refusal before execution; the fixture grant is revoked afterward.
2. **Transformer executable injection:** inherited `ESBUILD_BINARY_PATH` can redirect the tsx transformer before host validation and inherit the worker secret. The wrapper rejects it before DPAPI decoding; the runtime helper also rejects it. Synthetic proof intercepted selection without launching an attacker executable or using real credentials.
3. **Windows path injection:** inherited `SystemRoot` previously selected an unchecked PowerShell executable. The wrapper now validates it against the OS-reported system directory and checks the pinned PowerShell path/ancestor ACLs. TrustedInstaller is allowed solely for that OS package; private configuration and Node/tsx owner policies remain unchanged. Pure launcher tests do not enroll or attest the actual Windows service.

Ed25519 proofs still require explicit trusted issuer command/assurance ceilings, exact identity/session/token/payload binding, expiry and audience. mTLS authenticates the API transport separately from human authorization. The private role remains non-owner/non-superuser with no membership/DDL/TEMP/table or column writes and exactly the bounded onboarding functions among accessible SECURITY DEFINER functions. No arbitrary SQL is accepted. Durable claim-rate budgeting, replay/concurrency rejection, immutable audits, bounded recovery, sanitized errors and no automatic privileged retries remain in place.

The independent issuer must actually verify people and company evidence before signing. Synthetic signatures, TLS certificates, provider responses, private fixture roles and claim capabilities are tests, not genuine identity evidence or production configuration. Real issuer/collector/mail, Windows SID/ACL/DPAPI enrollment and service startup remain **UNCONFIGURED/UNVERIFIED**.

## Focused fresh acceptance

| Verification | Sprint 7G result |
|---|---|
| Isolated selective upgrade | PASS: installed 18 prior migrations with 15 omitted, added nonempty synthetic User/Session/Audit fixtures, then applied corrected 20. All 62 existing table fingerprints preserved |
| Prisma migration provenance/parity | PASS: 19 isolated successful migration checksums match curated bytes; empty diff against deferred-15 schema projection |
| Onboarding PostgreSQL/API | PASS **227** assertions, including 65 governance, 29 authenticated reads and 54 legacy/expired-renewal checks |
| HR-to-MD leave PostgreSQL/API | PASS **44** assertions; four outcomes, MD disagreement, self/privacy/revocation/stale/concurrency and no Attendance/Payroll/Voucher effects |
| Synthetic authenticated browser | PASS **15** checks: individual login, safe status, permission/unavailable paths, 390px layouts, fragment stripping, invalid claim, cleared credential input and anonymous denial |
| API and effective access boundaries | PASS **24** and **41** focused assertions |
| Private crypto and actual TLS 1.3 mTLS | PASS signature/binding/expiry/assurance and pinned/missing/unapproved certificate/collector/command denials |
| Launcher regressions | PASS pure OS-path, pre-DPAPI ESBUILD rejection and scoped TrustedInstaller owner checks; no actual enrollment |
| Payroll maker-checker | PASS **8** focused atomic test-double checks; no new payroll transaction or full payment acceptance claim |
| TypeScript | PASS workspace typecheck and actual Nest compilation in the isolated harness |
| Prisma and frontend | PASS Prisma validation, isolated parity and frontend production build (47 pages) |
| Targeted lint and whitespace | PASS recommended TypeScript lint on changed API/scripts, explicit-any disabled as in prior acceptance; final diff/UTF-8 whitespace checks |

The PostgreSQL/API total is **271**, plus 15 browser assertions; component counts included in 227 must not be added again. All temporary PostgreSQL/reference containers and task browser/compilation resources were removed. An initial upgrade fixture omitted required session `updatedAt`; this harness-only error was corrected before the meaningful original-source RED and corrected-source GREEN runs. The pg concurrency fixture emits a non-fatal pg@9 deprecation warning; current assertions and transaction outcomes pass. Positive genuine provider/issuer browser ceremonies remain untested because those services are not configured.

Commands: `pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/verify-onboarding-postgres.ts --original-onboarding` (expected RED), the same with `--browser` (corrected GREEN), `verify-onboarding-private.ts`, `verify-onboarding-api.ts`, `verify-onboarding-access.ts`, `verify-payroll-approval.ts`, `powershell -File scripts/verify-onboarding-launcher.ps1`, `pnpm typecheck`, `pnpm exec prisma validate`, targeted ESLint and `pnpm build:web`.

Existing SYSTEM_ADMIN/HR_ADMIN specialization, effective ACCOUNTANT responsibility, maker-checker restrictions, role ceilings/protected permissions, unique verified global Employee bindings, two-stage leave, Employee privacy, Payroll Slip separation and Accounting/Project read boundaries remain intact in focused acceptance. No generic title is elevated automatically.

## Evidence, independent review and remaining gates

Reconciliation evidence and verification logs are retained outside Git.

The independent-review ZIP and manifest are recorded below when final packaging completes. It is a source subset, not a deployment bundle. Reviewers should assess the migration correction, exact privilege gates and launcher trust assumptions, retaining the explicit unresolved login attribution.

Remaining human/private requirements: independently verified registrar; genuine control and identity evidence for all nominees; authoritative Employee IDs/codes; verified company appointment authority for Salam independently of later MD delegation; actual issuer/public-key policy, provider/domain delivery, collector and mTLS; distinct Windows service/database identity and reviewed grants after separately authorized deployment; local DPAPI/ACL enrollment; independent MD ceremony; separate AGM System Administrator/ACCOUNTANT approvals and bounded role delegation; HR approval; approved leave categories and authenticated real-user acceptance. Collect credentials and personal evidence through the local private process, never chat. MD root replacement/reissue remains closed pending a separately approved policy.

No genuine account was activated. Migration 15 remains deferred, migration 20 remains unapplied, and 18/19 were not reapplied. No deployment, production ceremony, next sprint or business transaction follows from this report.

## Current successful salary-dev migration checksums

These 18 entries were verified read-only against the local files. Deferred 15 and unapplied 20 are absent from database history.

| Migration | SHA-256 |
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

## Review archive and exact Sprint 7G changes

The independent review archive is retained privately outside Git.

The adjacent `.zip.sha256` records the archive checksum. `manifest.json` and `MANIFEST.sha256` inside the ZIP contain original source paths and exact payload SHA-256 values. Archive CRC and all manifest hashes are verified by the packaging script. Exclusions include all environment files, secrets, keys/certificates, tokens, dumps, raw real business/authentication records, private documents, dependencies and generated artifacts. The included reconciliation is a redacted technical summary only.

Exact changed files (all uncommitted; SQL 17/18/19 and all other applied SQL unchanged):

- `apps/api/src/onboarding/private/executor.ts`
- `apps/api/src/onboarding/private/host.ts`
- `apps/api/src/onboarding/private/runtime.ts`
- `docs/handoff.md`
- `docs/hr-admin/sprint7f-onboarding-acceptance.md`
- `docs/hr-admin/sprint7g-source-review-acceptance.md`
- `docs/operations/leadership-onboarding-private-execution.md`
- `prisma/migrations/20261020000000_secure_leadership_onboarding/migration.sql`
- `scripts/db/authority-onboarding-worker.ps1`
- `scripts/db/reconcile-authentication-salary-dev.ts`
- `scripts/onboarding-lifecycle-acceptance.ts`
- `scripts/onboarding-renewal-acceptance.ts`
- `scripts/package-onboarding-review.py`
- `scripts/verify-onboarding-launcher.ps1`
- `scripts/verify-onboarding-postgres.ts`
- `scripts/verify-onboarding-private.ts`
