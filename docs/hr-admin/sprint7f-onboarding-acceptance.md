# Sprint 7F secure leadership onboarding acceptance

Status as of 2026-10-20 (Asia/Dhaka): **PARTIAL for genuine operational readiness**. The technical source is implemented. Genuine configuration, migration 20 deployment, identity verification and leadership activation have not been performed. The evidence section records completed checks and the final integration record.

This sprint implements the technical onboarding workflow. It does not activate the nominated leaders, deploy migration 20, deliver genuine invitations or establish anyone's identity from a supplied email and title.

## Deployment boundary

The accepted Sprint 7E baseline is PostgreSQL 17.11 at `localhost:55532/real_capita_accounts_salary_dev`, with 18 successful migrations, including migrations 18 and 19. That baseline is inherited from [Sprint 7E acceptance](sprint7e-deployment-acceptance.md); the final read-only verification is recorded below, including its authentication-table fingerprint exception.

`20261020000000_secure_leadership_onboarding` is new and **unapplied on salary-dev**. `20261015000000_payroll_confirmation_evidence` remains deferred. No new migration deployment is authorized in Sprint 7F. The ordinary application must continue to fail closed when the onboarding schema, private executor or genuine provider is unavailable.

No salary-dev business mutation, real identity activation, business leave decision, payroll transaction or accounting transaction is part of this acceptance. Disposable synthetic databases and identities are distinct from the development business database. Applied migration files and existing accumulated work must remain preserved on branch `Joy`.

## Initial MD onboarding process

1. Independently appoint a trusted registrar and establish that person's genuine authenticated ERP session. Obtain independently signed `INITIAL_REGISTRAR` evidence bound to the current actor, session, token, exact command and payload. Developer access alone supplies no registrar authority. A missing genuine registrar session or issuer is an operational blocker; there is no anonymous or fabricated offline registrar shortcut.
2. Configure the actual delivery provider and independent evidence collector through private local setup. The registrar initiates individual invitations through the allowlisted private executor. Bearer capabilities are generated cryptographically, expire, persist only as hashes, and are delivered privately. They are never returned in API responses or copied into chat.
3. Each person claims their own account through the delivered capability and sets their individual password. Email capability consumption proves email/account control only. The account remains inactive until independent identity verification and authoritative global Employee binding complete.
4. Verify the nominated MD and independent authorizer against authoritative Employee Code/ID records and privately held identity evidence. The stored digest/reference identifies the durable private evidence record; personal documents and credentials do not belong in application logs or source control.
5. Authenticate the independent authorizer. Obtain fresh `COMPANY_AUTHORIZER` proof of company appointment authority that exists independently of any later MD software delegation. Record `AUTHORIZE_INITIAL_MD` for the exact nominated MD, authorizer, approved authority and expiry.
6. The independently verified authorizer submits `ATTEST_MD` under fresh `INDEPENDENT_ATTESTATION` proof. The attestation binds to the authorization, nominated MD, current authorizer session, nonce and short expiry.
7. The nominated MD completes the account-control ceremony with fresh `ACCOUNT_CONTROL` proof. The protected writer consumes the attestation and bootstrap once, establishes the MD mandate and records immutable history. Expired, replayed, revoked or mismatched capabilities cannot establish authority.

The designated independent authorizer's company appointment authority must precede and be evidenced separately from software privileges the MD might later delegate to that person. The proposed MD cannot authorize their own initial appointment. No default MD privilege, shared bootstrap password, email-only identity proof or unchecked manual database grant is acceptable.

## Private execution and protected permission bridge

The web/API runtime does not receive private writer credentials. A separately operated OS identity and restricted database execution identity host an allowlisted broker. Mutual TLS authenticates transport; independent Ed25519 evidence authenticates the exact human-approved operation. These are separate controls. Proof binds actor/session/token, command, canonical payload hash, issuer, audience, nonce and expiry. Transactional nonce consumption, current session and authority checks protect replay and concurrent requests.

Private configuration includes the evidence issuer/public-key and command-assurance policy, collector origin, delivery-provider account, verified sender, TLS material, isolated worker credentials and protected executable/configuration paths. Genuine credentials and evidence must be collected locally through the private authenticated process. Missing or invalid configuration produces denial/503; transport access alone cannot elevate authority. Actual restricted SQL/mTLS/recovery checks passed as recorded below. Genuine Windows service enrollment and private ACL verification remain operational prerequisites.

An independently verified, bound person may request a specialized responsibility for their **own** account without already holding that responsibility. This creates a pending request only. An independent live MD reviews `SYSTEM_ADMIN`, `ACCOUNTANT` and `HR_ADMIN` requests. Approval is distinct from account claiming and from generic custom role assignment. Expiry, revocation and current authority must remain effective at backend authorization boundaries.

The intended AGM requires separate MD approval for System Administrator and ACCOUNTANT responsibilities, followed by a bounded dynamic Role Management delegation. A title does not grant the entire permission registry. Role creation, permission selection and assignment remain constrained by the live MD-approved ceiling and protected review requirements. HR/Admin authorization is independently approved for the nominated HR person; it does not confer MD final-decision authority.

## Recovery and leave policy

`REPLACE_ACCOUNT` supports independently evidenced replacement of a non-MD account after authoritative Employee verification. It must revoke the old account/session/binding authority and retain history; privileged permissions do not transfer automatically. Any needed new permissions require fresh approved requests.

MD root revocation requires fresh independent company recovery authorization (`AUTHORIZE_MD_RECOVERY` / `RECOVERY_AUTHORIZER`), attestation and `RECOVERY_ATTESTATION` execution. It must not rely on privileges delegated by that MD or require access to the compromised MD login. Revocation does not authorize a replacement MD. New MD replacement/reissue remains closed pending a separately approved recovery policy and implementation.

The leave policy remains Employee submission → independent HR recommendation → MD final decision. HR recommendations can be accepted or disagreed with by the MD. Self-review, self-approval, revoked authority, stale versions and privacy violations must be rejected. Leave decisions must not automatically modify Payroll or Attendance. No real leave request is created or decided for this sprint.

## Technical evidence register

| Evidence | Verified result |
|---|---|
| Authenticated synthetic browser scenario | PASS, 15 checks |
| Onboarding API acceptance | PASS, 24 checks |
| Specialized effective-access acceptance | PASS, 41 checks |
| Production frontend build | PASS |

The final integrated PostgreSQL run passed **156 onboarding assertions plus 44 staged-leave assertions: 200 total**. The 156 include **65 real SQL governance assertions** and **29 authenticated read/access assertions**. These replace the earlier 53/127 onboarding counts. The harness compiled and started the actual restricted-runtime Nest API, authenticated individual synthetic cookie sessions and ran the independently signed command path with a distinct restricted private database login. It deployed the curated projection only onto newly created, labelled PostgreSQL 17, excluded migration 15, verified all 19 installed checksums and proved empty Prisma schema diff against the deferred-15 schema projection. It removed the exact task-owned container and temporary API compilation resources after verification.

Coverage includes individual email claims without elevation, consumed-claim replay, missing evidence rejection, independent company authorization/attestation, one-time MD bootstrap, specialized self-request and independent MD approval, SYSTEM_ADMIN/ACCOUNTANT/HR_ADMIN provisioning, AGM dynamic roles and permission ceilings, protected-permission/direct-SQL denials, revocation, non-MD account replacement without privilege transfer, independent MD root revocation, concurrent nonce consumption and audit rollback. Pending/rejected proposals preserve legacy permissions; expired approvals/revocations remain restrictive. The governance fixtures prove restored counts after rollback.

Authenticated GET acceptance covers Employee list/detail, Attendance history, Payroll list, Accounting ledger and Project reads, ordinary-user denials and separate Payroll Slip permission restrictions. The 44 leave assertions cover all four HR recommendation/MD final outcomes, MD disagreement, Employee submission/status, HR-only/MD-only enforcement, self-review/approval rejection, privacy, revoked authority, stale recommendations and concurrent decisions. Leave operations leave Attendance, Payroll and Voucher counts unchanged. **Eight focused payroll maker-checker checks passed with in-memory atomic test doubles**; this is not a new full payment/database acceptance claim.

The private suite passed Ed25519 identity/session/payload binding, expiry/TTL, provider-adapter success/failure with synthetic fetch, exact startup role/function restrictions, durable claim budget and rollback/error behavior. Its actual loopback TLS 1.3 broker accepted the pinned client and rejected missing/unapproved certificates; unsigned commands and absent collector failed closed. NODE_OPTIONS/NODE_PATH injection checks and PowerShell parsing passed. Genuine Windows service enrollment and real provider/issuer operation remain unconfigured.

Prisma client generation/validation, API TypeScript/compilation, frontend TypeScript/production build, targeted API/web lint and final whitespace verification passed. API/script lint used the same recommended TypeScript profile as 7E with explicit-any disabled; this is not repository-wide lint acceptance of unrelated accumulated work. Successful unchanged browser/build checks were retained.

Final command: `pnpm exec tsx --tsconfig apps/api/tsconfig.json scripts/verify-onboarding-postgres.ts`. External evidence directory: `E:/Joy/salary-dev-backups/sprint7f-44e3453d621f454088c86edc61b0845a`; final log `onboarding-final-postgres-v3.log`. Earlier failed logs remain retained. A fixture issuer initially omitted REPLACE_ACCOUNT; the final run corrects its allowlist and verifies the identity-mismatch denial is specifically 403. Integration also corrected deferred audit execution context, required role-link IDs, pending/rejected governance, NULL evidence handling and exact private startup grants. Applied migration SQL was never edited.

## Salary-dev preservation and migration state

Final verification used `default_transaction_read_only=on` against only `localhost:55532/real_capita_accounts_salary_dev`, PostgreSQL **17.11** (`170011`). It confirmed **18 successful applied migrations**, exact repository checksums, original database/table ACLs, runtime/finance write restrictions and owner-only protected authority/leave functions. All seven migration-18/19 authority/workflow tables remain empty. Migration **15 remains pending**; migrations 18/19 were not rerun; migration **20 remains unapplied**. All **19 existing migration SQL files**, including deferred 15, match the external pre-7F SHA-256 snapshot byte-for-byte.

The older 7E fingerprint comparison is **PARTIAL: 52/55 exact table matches**. `audit_events` increased **95 to 96**, `auth_sessions` **39 to 40**, and the one existing `users` row has a different fingerprint with unchanged count. Current latest LOGIN_SUCCESS metadata is `2026-10-19T01:32:41.465Z`, after the 7E final verification `2026-10-17T16:09:36.343Z`. This is consistent with intervening login activity but does not prove which user fields changed or attribute the activity to an operator. No reconciliation/write was attempted. Employee, Attendance, Payroll, Accounting, Project and every other non-authentication table matched. This continuation performed **no salary-dev write**. Do not describe the three differing tables as preserved byte-for-byte or silently erase authentication history.

Exact exceptions/fingerprints are retained in external `salary-dev-readonly-final.json`, together with the read-only runner. Review the discrepancy before separately authorizing deployment. The original strict 7E verifier correctly refused a full preservation PASS; a diagnostic read-only comparison recorded all mismatches without suppressing them.

New migration `20261020000000_secure_leadership_onboarding` SHA-256: `a12345d4e7224739245c949663173ef4393657af0a93ccc877a623de54290cc0`. Only disposable PostgreSQL received it. No genuine invitation/account/role/Employee binding, leave request, payroll draft or financial transaction was created on salary-dev.

The actual browser run used authenticated synthetic login and tested safe onboarding status, anonymous denial, independent-authorizer messaging, pending-request semantics, unavailable dispatch, 390px layout, claim-fragment stripping, invalid-claim rejection, credential clearing, no new authenticated/elevated session and no-referrer metadata. It found a same-document fragment-navigation bug; a `hashchange` handler corrected it and the rerun passed. This browser evidence does **not** prove genuine external delivery/identity-provider acceptance or positive private-collector activation in a browser.

## Current operational readiness

`Implemented` describes source capability. `Tested in isolation` describes synthetic evidence only. `Deployed` describes salary-dev schema/runtime availability, not a grant to a person. `Configured` requires the actual private service/provider setup. `Identity verified` requires independent evidence. `Live activated` requires completed authorized genuine-user acceptance.

| Feature | Implemented | Tested in isolation | Deployed | Configured | Identity verified | Live activated |
|---|---|---|---|---|---|---|
| Employee | Existing module | Existing acceptance; see final evidence register | Existing baseline | Restricted runtime baseline; genuine setup pending | No nominated person verified | No new genuine authorization |
| Users | Existing module + secure onboarding | API 24 and authenticated browser 15 PASS | Existing administration; migration 20 unapplied | Genuine onboarding providers/private executor not configured | No | No |
| Monthly Payroll | Existing module | Existing maker-checker scope; see evidence register | Existing baseline | Existing restricted setup; no new payment authority | No nominated person verified | No new genuine authorization |
| Payroll Slip | Existing module/access controls | Isolated access coverage; see evidence register | Existing baseline | Genuine authenticated acceptance pending | No nominated person verified | No new genuine authorization |
| Attendance | Existing module | Existing coverage; see evidence register | Existing baseline | Existing restricted setup | No nominated person verified | No new genuine authorization |
| Leave Apply | Existing two-stage workflow | Synthetic staged workflow; see evidence register | Migration 19 installed | Genuine identities/bindings/categories pending | No | No |
| Apply Leave List | Existing HR→MD workflow | Synthetic privacy/review/decision coverage | Migration 19 installed | Genuine HR/MD authority pending | No | No |
| Dynamic Role Management | Existing RBAC + signed execution integration | Synthetic authority/access coverage | Migration 18 installed; migration 20 bridge unapplied | Private executor and real MD delegation pending | No | No |
| MD Approval Dashboard | Integrated leave/role approval views; no standalone dashboard | Synthetic authority/leave coverage | Migration 18/19 foundation; migration 20 unapplied | Genuine MD claim/attestation/private executor pending | No | No |

| Nominated person | Intended responsibilities captured | Technical support implemented/tested | Deployed/configured for genuine use | Identity/Employee binding verified | Live activated |
|---|---|---|---|---|---|
| MD nominee | Highest business authority, MD approvals, initial delegation | Source implemented; synthetic acceptance recorded above | No migration 20 deployment or genuine provider/private setup | No authoritative Employee ID or genuine evidence supplied | No |
| AGM nominee / independent initial authorizer | Independent company MD appointment attestation; later separately approved System Administrator, ACCOUNTANT and bounded Role Management | Source implemented; synthetic acceptance recorded above | No genuine provider/private setup | No independent appointment evidence or authoritative Employee ID verified | No |
| HR nominee | HR/Admin and HR leave recommendations | Source implemented; synthetic acceptance recorded above | No genuine provider/private setup | No authoritative Employee ID or genuine evidence verified | No |

The private per-person checklist is retained outside source control at `E:\Joy\salary-dev-backups\sprint7f-44e3453d621f454088c86edc61b0845a\leadership-private-checklist.md`. It contains the owner-supplied identity claims and operational steps, not credentials or identity artifacts.

## Outstanding acceptance and authorization gates

- Review the three authentication-table fingerprint differences before any separately authorized deployment; no destructive reconciliation is authorized.
- Organization: supply authoritative global Employee IDs/codes for all three nominees through the private process; independently verify individual account control and employment identity.
- Organization: verify the designated initial authorizer's company appointment authority independently of future MD delegation and collect durable evidence privately.
- Private service operator: configure independently controlled issuer/collector, genuine delivery, verified sender, TLS, isolated OS/database identities and protected execution/configuration storage. Do not send secrets or personal documents through chat.
- Owner: separately authorize any deployment of migration 20 and its reviewed privilege configuration after final technical acceptance. Migration 15 remains deferred.
- Genuine participants: complete individual claims, verified bindings, independent initial MD ceremony, separate MD approvals/delegation, approved leave-category setup and final authenticated real-user acceptance.

No genuine-user activation is recorded by this document. Stop after Sprint 7F; do not infer approval for another sprint, deployment or business transaction.


## Exact Sprint 7F file manifest

These 49 paths identify Sprint 7F source, verification and documentation changes within the larger preserved uncommitted workspace. Earlier unrelated changes remain intact. Generated Prisma/build outputs are excluded; accumulated `apps/web/tsconfig.json` is retained and is not newly attributed to this sprint. The external `source-manifest.json` records final SHA-256 values.

- `apps/api/src/app.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/guards/auth.guard.ts`
- `apps/api/src/auth/hr-access.ts`
- `apps/api/src/auth/onboarding-access.ts`
- `apps/api/src/authority/authority.service.ts`
- `apps/api/src/onboarding/onboarding.controller.ts`
- `apps/api/src/onboarding/onboarding.dto.ts`
- `apps/api/src/onboarding/onboarding.gateway.ts`
- `apps/api/src/onboarding/onboarding.module.ts`
- `apps/api/src/onboarding/onboarding.service.ts`
- `apps/api/src/onboarding/private/assurance.ts`
- `apps/api/src/onboarding/private/broker.ts`
- `apps/api/src/onboarding/private/collector.ts`
- `apps/api/src/onboarding/private/delivery.ts`
- `apps/api/src/onboarding/private/executor.ts`
- `apps/api/src/onboarding/private/host.ts`
- `apps/api/src/onboarding/private/proof.ts`
- `apps/api/src/onboarding/private/runtime.ts`
- `apps/api/src/users/users.service.ts`
- `apps/web/src/app/app/users/_components/onboarding-panel.tsx`
- `apps/web/src/app/app/users/page.tsx`
- `apps/web/src/app/claim/layout.tsx`
- `apps/web/src/app/claim/page.tsx`
- `apps/web/src/lib/authority-api.ts`
- `apps/web/src/lib/leave-api.ts`
- `apps/web/src/lib/onboarding-api.ts`
- `docs/handoff.md`
- `docs/hr-admin/administrator-onboarding.md`
- `docs/hr-admin/real-capita-authority-matrix.md`
- `docs/hr-admin/real-capita-hr-feature-status.md`
- `docs/hr-admin/sprint7f-implementation-plan.md`
- `docs/hr-admin/sprint7f-onboarding-acceptance.md`
- `docs/operations/leadership-onboarding-private-execution.md`
- `prisma/migrations/20261020000000_secure_leadership_onboarding/migration.sql`
- `prisma/schema.prisma`
- `scripts/db/authority-onboarding-worker.ps1`
- `scripts/db/onboarding-privileges.ts`
- `scripts/db/role-profile.ts`
- `scripts/onboarding-browser-acceptance.ts`
- `scripts/onboarding-browser-scenario.js`
- `scripts/onboarding-governance-acceptance.ts`
- `scripts/onboarding-leave-acceptance.ts`
- `scripts/onboarding-lifecycle-acceptance.ts`
- `scripts/onboarding-read-acceptance.ts`
- `scripts/verify-onboarding-access.ts`
- `scripts/verify-onboarding-api.ts`
- `scripts/verify-onboarding-postgres.ts`
- `scripts/verify-onboarding-private.ts`

Private setup: [leadership onboarding private execution](../operations/leadership-onboarding-private-execution.md). The external private checklist retains the previously supplied names/emails and local collection steps. No secrets or personal evidence should be supplied in chat.

Overall verdict: **PARTIAL**. Technical implementation and focused isolated acceptance pass. New deployment authorization, actual private configuration, authoritative Employee IDs, verified individual identities, independent company authorization and final genuine-user acceptance remain outstanding. No genuine account was activated. MD replacement/reissue remains closed pending a separately approved policy. Stop after Sprint 7F.
