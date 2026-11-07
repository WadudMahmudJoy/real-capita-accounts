# Sprint 7F secure onboarding implementation record

Technical source is implemented. Genuine configuration, identity verification, migration 20 deployment and leadership activation are not complete. Read [Sprint 7F acceptance and readiness](sprint7f-onboarding-acceptance.md) for the evidence register and remaining operational gates. Stop after Sprint 7F.

## Scope and boundaries

The sprint extends existing claiming, independent MD bootstrap, specialized permissions, dynamic roles and HR→MD leave decisions. It does not deploy a migration, activate real people or change salary-dev business records. Branch `Joy` and accumulated uncommitted work remain preserved; no commit, push, merge, reset, clean or branch switch is authorized. Applied migration files remain unchanged, and migration 15 remains deferred.

New additive migration `20261020000000_secure_leadership_onboarding` is **unapplied on salary-dev**. The existing deployed foundation is migrations 18 and 19 within the 18-successful-migration Sprint 7E baseline. A separate reviewed deployment authorization is required for migration 20 and its privilege configuration.

## Implemented trust model

An initial registrar requires a genuine current authenticated ERP session and independently signed `INITIAL_REGISTRAR` evidence for the exact operation. The developer is not assumed to be the registrar, MD or company authorizer. There is no anonymous/offline registrar bypass. If an independently trusted registrar, issuer or evidence process is absent, onboarding stays unavailable.

The approved independent initial authorizer must first prove individual identity and company appointment authority independently of later MD software delegation. Company authorization, attestation and MD account-control confirmation are separate signed operations. Evidence binds the nominated MD, approved authority, actor, current session/token, payload, nonce and expiry. The protected writer consumes bootstrap/attestation capabilities once and preserves immutable history.

Email claiming verifies account control only. A claimed account remains inactive until independent employment identity verification and authoritative global Employee Code/ID binding. Neither supplied names/emails nor possession of a claim link grants a business permission.

## Implemented interfaces

- Private command envelope: `{actorId,sessionId,tokenId,command,payload,proof}`. Independent Ed25519 proof binds actor/session/token, allowlisted command, canonical payload SHA-256, nonce, issuer, audience and short validity window. Transport credentials supply no human authority.
- SQL: `onboarding_command(actor text, command text, data jsonb, context jsonb)`. The private broker supplies verified context; SERIALIZABLE execution rechecks current sessions/authority and consumes a unique nonce transactionally.
- Invitation delivery occurs inside the private invitation operation through the configured provider. There is no separately callable delivery-status command. Capabilities are cryptographically generated, hash-only in storage, short-lived and delivered privately; API responses never contain them.
- Core commands: `INVITE`, `CLAIM`, `VERIFY_IDENTITY`, `AUTHORIZE_INITIAL_MD`, `ATTEST_MD`, `ACTIVATE_MD`, `REQUEST_SPECIALIZED`, `DECIDE_SPECIALIZED`, `REVOKE_SPECIALIZED`, `SUSPEND`, `CANCEL`, `AUTHORIZE_MD_RECOVERY`, `REVOKE_MD` and `REPLACE_ACCOUNT`. Allowlisted authority/leave commands reuse reviewed dynamic Role Management and two-stage leave contracts.
- `GET /onboarding/status` returns safe own verification state, readiness/blockers and permission-scoped invitations, specialized requests and audit summaries. Token hashes, credentials and private evidence artifacts are excluded. Own requests are visible without permission to enumerate other people.
- `POST /onboarding/prepare` binds the proposed action to the configured independent authenticated collector. The UI accepts proof only from the expected popup source/origin and matching challenge nonce. No editable proof/token field is provided.
- `POST /onboarding/commands` requires the authenticated HttpOnly-cookie session and independent proof. `POST /onboarding/claim` accepts the private capability and individual password through same-origin, rate-limited handling. Missing schema/provider/private service fails closed with documented denial/503 behavior.

## Protected permissions and recovery

A verified bound recipient can request `SYSTEM_ADMIN`, `ACCOUNTANT` or `HR_ADMIN` for their own account; the request is ineffective until an independent live MD approves. Generic roles cannot bypass specialized permissions. The AGM's System Administrator, ACCOUNTANT and bounded Role Management responsibilities require separate authorization. Dynamic role creation/assignment remains within the current MD-approved delegation ceiling, and protected changes retain independent MD review.

`REPLACE_ACCOUNT` replaces an independently verified non-MD account after authoritative Employee matching, preserves history and revokes the old account's sessions/binding/authority. Privileged grants do not transfer; new permissions require fresh approvals.

MD root revocation uses fresh independent company recovery authorization and attestation, independent of software powers delegated by that MD. It does not require the compromised MD login. It revokes the root; it does not permit replacement/reissue of a new MD. New-root replacement remains closed pending a separately approved policy.

The leave policy remains Employee submission → independent HR recommendation → MD final decision. Self-review, stale/replayed requests, revoked authority and private-data access remain guarded. Leave decisions do not automatically mutate Attendance or Payroll.

## Implementation delivered

- Durable onboarding schema, guarded commands, private writer boundaries and history in unapplied migration 20.
- Independently signed evidence verification, allowlisted broker, private delivery and distinct OS/database execution configuration with fail-closed startup.
- Public safe status/preparation/claiming integration and specialized effective-authority checks using existing authentication.
- Users onboarding state/checklist, pending invitations, own specialized requests, MD review/revocation and private evidence flow; existing Role Management/leave interfaces use the signed command path.
- Isolated PostgreSQL, synthetic authenticated browser/API and access acceptance; final authoritative results are recorded in the acceptance report.

Genuine delivery/issuer credentials, private OS/database enrollment, verified Employee IDs, independent company evidence, deployment authorization and final real-user acceptance remain operational prerequisites. No genuine nomination has been verified or activated by source implementation or synthetic tests.
