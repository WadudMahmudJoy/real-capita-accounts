# Private leadership onboarding setup

Sprint 7F supplies the adapter, guarded writer and operator wrapper. It does not supply a genuine evidence issuer, verify the nominated people, configure delivery or enroll a privileged OS identity. Migration 20 is unapplied on salary-dev. Obtain separate deployment authorization before installing its SQL or grants. See [acceptance](../hr-admin/sprint7f-onboarding-acceptance.md).

## Independent evidence service

The organization must appoint a genuine registrar with an authenticated existing ERP session. Developer access is insufficient. Independently verify the initial authorizer's personal identity and company appointment authority before collecting the MD attestation; later MD delegation cannot establish that earlier authority.

Operate the evidence collector independently from the API and executor. Retain appointment/identity evidence in controlled private storage with its own retention, access and revocation process. Application records contain evidence digests and bound authorization receipts, never personal documents. An issuer must verify the actual person, authority and intended operation before signing; it must not sign merely because it receives a challenge.

The collector receives an mTLS POST containing actor/session/token identifiers, exact command/payload/hash, random nonce, audience, assurance and a two-minute deadline. Return an HTTPS `evidenceUrl` on an explicitly allowed origin. The authenticated ceremony returns the Ed25519 proof through the exact popup origin/source/nonce contract in `apps/web/src/lib/onboarding-api.ts`. Signing keys belong exclusively to the independent issuer. Configure only its public verification keys and explicit command/assurance ceilings in the worker.

Required assurances are `INITIAL_REGISTRAR` for invitation/identity verification and explicit invitation cancellation, `COMPANY_AUTHORIZER` for initial MD appointment authorization, `INDEPENDENT_ATTESTATION` for attestation, `ACCOUNT_CONTROL` for MD activation, `RECOVERY_AUTHORIZER` and `RECOVERY_ATTESTATION` for independent root revocation, and `ACCOUNT_RECOVERY` for non-MD account replacement. Other allowlisted authority/leave/specialized operations require `PRIVILEGED_ACTION`. Do not issue blanket assurances or permit arbitrary SQL.

## OS and database enrollment

Use a dedicated Windows executor SID different from the ordinary API SID. Prepare an independently owned immutable release with dependencies, pinned absolute Node executable and tsx CLI paths. The API/developer process must not be able to replace the privileged package, executables or their ancestors. The PowerShell wrapper rejects unrelated write ACLs, reparse paths, `NODE_OPTIONS`, `NODE_PATH`, `ESBUILD_BINARY_PATH` and inherited database credentials before decoding credentials. It validates `SystemRoot` against the OS-reported system directory and checks the pinned PowerShell package/ancestors. TrustedInstaller ownership is accepted only for that OS package, not private configuration or Node/tsx packages. Always start the host through this wrapper. Its full ACL checks must pass on the actual service host; synthetic SQL/mTLS tests do not establish OS enrollment.

After separately authorized migration deployment, enroll a non-owner, non-superuser database login with no memberships, role/database creation, bypass-RLS, replication, TEMP, schema CREATE, object ownership or table/column writes. Use the reviewed `onboardingPrivatePrivileges` helper in `scripts/db/onboarding-privileges.ts` through the controlled operator process. The executor may invoke exactly `public.onboarding_command(text,text,jsonb,jsonb)` and `public.onboarding_claim_budget()` and `public.onboarding_record_delivery(text,text)` among SECURITY DEFINER functions. Do not grant direct authority/leave writers or weaken PUBLIC/runtime grants. Startup independently checks this contract, including column-only INSERT/UPDATE privileges. The ordinary runtime receives only the reviewed bounded reads, excluding invitation token hashes.

## Configuration and delivery

Store configuration, TLS keys/certificates, issuer policies and DPAPI credentials outside Git. Restrict private file and parent ACLs to the executor SID, SYSTEM and local Administrators. The wrapper configuration requires:

- `repository`, `apiSid`, `executorSid`, `databaseRole`, `port`, `audience`;
- `nodeExecutable`, `tsxCliFile`, `credentialFile`;
- `serverKeyFile`, `serverCertFile`, `clientCaFile`, `clientFingerprints`;
- `from`, HTTPS `claimUrl`, and `proofIssuers` with public keys plus explicit per-command assurances;
- `collector.endpoint`, `collector.allowedOrigins`, `collector.keyFile`, `collector.certFile`, `collector.caFile`.

Under the dedicated executor identity, run `scripts/db/authority-onboarding-worker.ps1 -Configuration <private-config-path> -ProvisionCredential`. Its suppressed local prompt accepts the private JSON keys `databaseUrl` and `resendApiKey`; it saves a current-user DPAPI SecureString without replacing an existing credential. Never pass these values in command arguments, chat, logs or source files. The database URL must identify only `localhost:55532/real_capita_accounts_salary_dev` and the enrolled executor login. Start the same wrapper without `-ProvisionCredential` under that identity. No service was enrolled or started for genuine use by this sprint.

Configure a real Resend account, verified sender/domain and API key, plus the genuine HTTPS claim page. Synthetic acceptance exercises the delivery adapter with a fake HTTP provider response; no actual email was sent. Invitations expire after 15 minutes and persist only capability hashes. Claiming consumes once and sets an individual password but leaves the account inactive until independent identity/Employee verification; it grants no business role.

The API receives only its client TLS identity and trusted CA paths through `ONBOARDING_PRIVATE_GATEWAY_URL`, `ONBOARDING_PRIVATE_GATEWAY_CERT_FILE`, `ONBOARDING_PRIVATE_GATEWAY_KEY_FILE`, `ONBOARDING_PRIVATE_GATEWAY_CA_FILE`. Set the ordinary authentication `APP_ORIGIN` to the approved HTTPS origin. The gateway must be loopback HTTPS with TLS 1.3 and a pinned approved client identity at the broker. It receives neither the private database credential nor issuer signing keys.

## Acceptance and recovery

Verify denied access using ordinary runtime credentials before opening genuine onboarding. Test approved and unapproved TLS clients, missing issuer/provider, revoked/expired evidence, exact identity/session/payload binding, concurrent consumption and immutable audits. Check actual delivery and the independent browser ceremony with the genuine provider before real-user acceptance. Missing configuration remains 503/fail closed.

Sprint 7H-A separates the claim lifecycle (`ISSUED`, `CONSUMED`, `CANCELLED`) from email outcomes. Authenticate/verify the bound command, generate a random 256-bit capability, persist its SHA-256 hash and invitation metadata, COMMIT and release the connection, then call Resend. Only after the call, a fresh connection appends `DELIVERY_ACCEPTED` or `DELIVERY_UNKNOWN` to immutable onboarding events using the bounded private bookkeeping function. No provider ID, bearer, raw provider response or recoverable token is persisted. `ACCEPTED` means provider acceptance, not confirmed inbox delivery. Existing `invitation-<invitationId>` provider idempotency keys are unchanged.

A failed COMMIT returns a sanitized command error with no email attempt. A failed/timeout/malformed provider response returns `status=ISSUED`, `deliveryStatus=UNKNOWN`, `deliveryRecorded` and a reconciliation instruction, never delivery success. A successful provider response with bookkeeping failure returns `ACCEPTED` and `deliveryRecorded=false`. Neither condition cancels or disables the claim link. `ISSUED` remains claimable until the original 15-minute expiry, explicit cancellation or single-use consumption. Claiming alone still grants no activation or authority. Database claim-rate budgeting commits separately so invalid claims cannot roll back the abuse budget.

There is no automatic resend or plaintext-bearing outbox. A crash or lost COMMIT acknowledgement can leave an issued invitation without a delivery event; do not infer that mail was delivered or not delivered. Inspect the durable INVITE event and delivery events privately using the invitation ID; reconcile provider activity using `invitation-<invitationId>`, without copying email links into tickets or logs. If a recipient has received a link, they may claim it while it remains valid. When the capability has been lost, the recovery path is fresh independent approval for explicit CANCEL, then fresh independent approval for INVITE to the same email. Even expired issued invitations require explicit cancellation before reissue. Repeated/concurrent INVITE refuses an existing issued invitation, preserving a potentially delivered link. CANCEL and subsequent INVITE are separate audited actions; the latter creates a new invitation ID, capability and provider key.

CANCEL requires `INITIAL_REGISTRAR` signed assurance (update the independent issuer command policy before any future deployment). A live MD may cancel an issued invitation; before the first MD mandate has ever existed, only that invitation's authenticated issuing registrar may cancel it under fresh independent proof. This bounded bootstrap recovery does not activate an account, authorize an MD or permit another registrar to cancel. Once an MD mandate exists, cancellation requires the live MD. Independent appointment, attestation and activation controls are unchanged.

Read-only reconciliation query for an authorized operator, using an invitation ID parameter (never a token):

```sql
SELECT v.id, v.status, v."createdAt", v."expiresAt", e.action, e."createdAt" AS "eventAt"
FROM onboarding_invitations v
LEFT JOIN onboarding_events e ON e."recordId"=v.id
WHERE v.id=$1
ORDER BY e."createdAt", e.id;
```

An issued invitation with no delivery event is unresolved, not delivered. Keep the durable INVITE audit as the reconciliation anchor when bookkeeping was unavailable. No automatic job or genuine operational reconciliation has been installed by this source fix.

For non-MD recovery, independently verify the new claimed account against the exact authoritative Employee ID/code. `REPLACE_ACCOUNT` suspends the old account, revokes its sessions/delegation, retains the old binding/history and activates the replacement as a basic identity. Privileged grants do not transfer. Independent company recovery authorization can revoke a compromised MD root without the MD's login. It cannot create a replacement MD; that policy remains closed pending separate authorization and implementation.

Collect authoritative Employee IDs/codes, appointment evidence and credentials locally through this process. Do not fabricate records or ask participants to send secrets/personal documents through ChatGPT. Final genuine claims, independent MD ceremony, separate AGM/HR approvals and authenticated user acceptance remain outstanding.


## Sprint 7H-B: gateway deadlines and ambiguous results

The full mutation path is authenticated API request, mTLS readiness/attestation,
mTLS command submission, signed-proof validation and password/capability generation,
private pool acquisition and identity check, Serializable SQL/COMMIT/release,
Resend request, separate delivery bookkeeping and broker acknowledgment. Authority
commands use the same path without Resend. A disconnected caller does not cancel a
worker's committed transaction or its ongoing delivery bookkeeping.

The Resend request retains its 10-second abort deadline (including response body).
The gateway now uses a 120-second **absolute** deadline for commands/claims, plus
socket inactivity protection, with 15 seconds for each readiness/preparation call.
Mutation headroom includes database work before delivery and bookkeeping afterwards;
the prior 10-second gateway deadline conflicted with the provider's full 10 seconds.
The host pool acquisition limit remains five seconds; transaction statement_timeout
remains 15 seconds per statement. Password hashing, scheduling, network/COMMIT
acknowledgment and pool/SQL waits are not one aggregate worker deadline. No finite
caller timeout can prove that the worker rolled back. An upstream proxy/client with
a shorter deadline must treat lost responses as ambiguous too.

The broker's 20-second requestTimeout and 10-second headersTimeout limit incoming
request reception, not asynchronous command execution or provider response time.
They are unchanged. There is no automatic worker abort, rollback, cancellation or
retry when the gateway connection closes. The gateway settles timeout, reset,
aborted/truncated/invalid response and oversized-body failures without hanging.

For commands/claims, an incomplete or unconfirmed response produces HTTP503 with:

```json
{
  "status": "OUTCOME_UNKNOWN",
  "retryable": false,
  "recovery": "AUTHORIZED_READ_ONLY_RECONCILIATION_REQUIRED",
  "message": "The private operation may have committed. Do not retry or reissue automatically. Request authorized read-only reconciliation before any further mutation."
}
```

A command error can additionally contain `reconciliationId`, the SHA256 digest of
the original proof nonce. It exposes no signature, session bearer, invitation
capability, password, provider error or internal routing data. Claims do not echo
or hash the submitted bearer into the error response. The digest is a correlation
key, **not authorization**. Complete explicit 400/401/403/409/429 private rejections
remain known denials. A 5xx or invalid/missing acknowledgment cannot establish that
no mutation happened. This applies to all privileged authority, leave, specialized,
identity and recovery commands, not only INVITE. None are automatically retried.

Distinguish two outcomes: `ISSUED` plus deliveryStatus `UNKNOWN` confirms durable
invitation issuance with uncertain provider acceptance; `OUTCOME_UNKNOWN` means the
gateway could not confirm the overall private result, which may already be durable.
Neither condition invalidates a previously issued link. Single-use, expiry,
cancellation and independent identity/MD authority requirements still apply.

### Authorized read-only reconciliation after response loss

1. Stop resubmission. Retain only the safe reconciliation digest, intended command,
   original request idempotency/reference ID, actor and time window in controlled
   operator records. Never put proof signatures, passwords or claim links into logs
   or tickets. Fresh proof/new nonce is not a safe substitute for reconciliation.
2. An independently authorized operator with **existing approved read access** must
   inspect the intended database through the existing controlled procedure. An
   ordinary API user or possession of a digest does not authorize database access.
   This sprint adds no grant, read endpoint, privileged role or deployment approval.
3. Use bound parameters in an explicitly read-only transaction. Verify database and
   operator identity first; proceed only on the already approved target. The
   following queries are examples for that operator, not commands to run against
   salary-dev as part of this source task:

```sql
BEGIN READ ONLY;
SELECT current_database(), current_user;
SHOW transaction_read_only;
-- $1: reconciliationId; $2/$3: original actor/session IDs;
-- $4/$5: exact original command/payload digest from controlled request context.
SELECT command, "createdAt"
FROM onboarding_nonces
WHERE "nonceHash"=$1 AND "actorId"=$2 AND "sessionId"=$3
  AND command=$4 AND "payloadHash"=$5;
-- For INVITE, this exact proof digest identifies the original invitation audit:
SELECT "entityId" AS "targetUserId", metadata->>'recordId' AS "invitationId", "createdAt"
FROM audit_events
WHERE action='ONBOARDING_INVITE' AND metadata->>'proofDigest'=$1;
-- Then inspect that invitation's lifecycle/delivery events using the query above.
-- For an AUTHORITY_REQUEST, use the original actor/idempotency key:
SELECT id, operation, status, version, "decidedAt"
FROM authority_requests
WHERE "actorId"=$2 AND "idempotencyKey"=$3;
ROLLBACK;
```

Bind the authority query independently: its `$3` is the original idempotency key,
not the session ID from the nonce query. For a decision on an existing request,
inspect that exact request ID/version and immutable authority/audit history; verify
the resulting role/mandate state through existing authorized reads. A committed
nonce receipt establishes execution of that command transaction, not inbox delivery
or present-day authority (which may subsequently have been revoked).

4. For INVITE, preserve a valid ISSUED link regardless of absent/UNKNOWN delivery
   bookkeeping. Reconcile Resend by the stable `invitation-<invitationId>` key using
   already authorized provider access. If replacement is explicitly approved,
   follow the existing audited CANCEL then fresh INVITE procedure. Do not resend an
   unrecoverable capability or silently supersede a possibly delivered invitation.
5. Absence of a receipt in one read is **not proof of no change**: the worker may
   still be running/committing. Keep the result unresolved until authorized
   observation establishes completion or operational quiescence and reviews the
   durable history. Do not kill a worker, change database state or retry based on
   absence alone. There is no automatic reconciliation or mutation retry service.
   A lost claim response may mean the invitation was consumed; inspect its lifecycle
   and email-verification state through authorized reads. Claim-rate budget rows
   are not evidence of claim success. Reconciliation never activates an account or
   substitutes for independent identity/MD approval.
