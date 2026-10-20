# Private leadership onboarding setup

Sprint 7F supplies the adapter, guarded writer and operator wrapper. It does not supply a genuine evidence issuer, verify the nominated people, configure delivery or enroll a privileged OS identity. Migration 20 is unapplied on salary-dev. Obtain separate deployment authorization before installing its SQL or grants. See [acceptance](../hr-admin/sprint7f-onboarding-acceptance.md).

## Independent evidence service

The organization must appoint a genuine registrar with an authenticated existing ERP session. Developer access is insufficient. Independently verify the initial authorizer's personal identity and company appointment authority before collecting the MD attestation; later MD delegation cannot establish that earlier authority.

Operate the evidence collector independently from the API and executor. Retain appointment/identity evidence in controlled private storage with its own retention, access and revocation process. Application records contain evidence digests and bound authorization receipts, never personal documents. An issuer must verify the actual person, authority and intended operation before signing; it must not sign merely because it receives a challenge.

The collector receives an mTLS POST containing actor/session/token identifiers, exact command/payload/hash, random nonce, audience, assurance and a two-minute deadline. Return an HTTPS `evidenceUrl` on an explicitly allowed origin. The authenticated ceremony returns the Ed25519 proof through the exact popup origin/source/nonce contract in `apps/web/src/lib/onboarding-api.ts`. Signing keys belong exclusively to the independent issuer. Configure only its public verification keys and explicit command/assurance ceilings in the worker.

Required assurances are `INITIAL_REGISTRAR` for invitation/identity verification, `COMPANY_AUTHORIZER` for initial MD appointment authorization, `INDEPENDENT_ATTESTATION` for attestation, `ACCOUNT_CONTROL` for MD activation, `RECOVERY_AUTHORIZER` and `RECOVERY_ATTESTATION` for independent root revocation, and `ACCOUNT_RECOVERY` for non-MD account replacement. Other allowlisted authority/leave/specialized operations require `PRIVILEGED_ACTION`. Do not issue blanket assurances or permit arbitrary SQL.

## OS and database enrollment

Use a dedicated Windows executor SID different from the ordinary API SID. Prepare an independently owned immutable release with dependencies, pinned absolute Node executable and tsx CLI paths. The API/developer process must not be able to replace the privileged package, executables or their ancestors. The PowerShell wrapper rejects unrelated write ACLs, reparse paths, `NODE_OPTIONS`, `NODE_PATH` and inherited database credentials. Its full ACL checks must pass on the actual service host; synthetic SQL/mTLS tests do not establish OS enrollment.

After separately authorized migration deployment, enroll a non-owner, non-superuser database login with no memberships, role/database creation, bypass-RLS, replication, TEMP, schema CREATE, object ownership or table writes. Use the reviewed `onboardingPrivatePrivileges` helper in `scripts/db/onboarding-privileges.ts` through the controlled operator process. The executor may invoke exactly `public.onboarding_command(text,text,jsonb,jsonb)` and `public.onboarding_claim_budget()` among SECURITY DEFINER functions. Do not grant direct authority/leave writers or weaken PUBLIC/runtime grants. Startup independently checks this contract. The ordinary runtime receives only the reviewed bounded reads, excluding invitation token hashes.

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

An uncertain delivery/commit result may leave an unusable emailed link. Do not automatically retry privileged commands or replay proofs: inspect durable state privately, then obtain fresh approval and reissue/cancel through the guarded workflow. Database claim-rate budgeting commits separately so invalid claims cannot roll back the abuse budget.

For non-MD recovery, independently verify the new claimed account against the exact authoritative Employee ID/code. `REPLACE_ACCOUNT` suspends the old account, revokes its sessions/delegation, retains the old binding/history and activates the replacement as a basic identity. Privileged grants do not transfer. Independent company recovery authorization can revoke a compromised MD root without the MD's login. It cannot create a replacement MD; that policy remains closed pending separate authorization and implementation.

Collect authoritative Employee IDs/codes, appointment evidence and credentials locally through this process. Do not fabricate records or ask participants to send secrets/personal documents through ChatGPT. Final genuine claims, independent MD ceremony, separate AGM/HR approvals and authenticated user acceptance remain outstanding.
