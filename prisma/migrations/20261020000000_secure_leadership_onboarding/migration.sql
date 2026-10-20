-- CreateTable
CREATE TABLE "onboarding_identities" (
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "verifiedAt" TIMESTAMPTZ(3),
    "verifiedById" TEXT,
    "evidenceDigest" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "onboarding_identities_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "onboarding_invitations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),

    CONSTRAINT "onboarding_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_authorizations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "kind" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "evidenceDigest" TEXT,
    "parentId" TEXT,
    "sessionId" TEXT,
    "expectedVersion" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "onboarding_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "targetUserId" TEXT,
    "action" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_nonces" (
    "nonceHash" TEXT NOT NULL,
    "actorId" TEXT,
    "sessionId" TEXT,
    "command" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_nonces_pkey" PRIMARY KEY ("nonceHash")
);

-- CreateTable
CREATE TABLE "onboarding_rates" (
    "key" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL,

    CONSTRAINT "onboarding_rates_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_invitations_tokenHash_key" ON "onboarding_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "onboarding_invitations_userId_createdAt_idx" ON "onboarding_invitations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "onboarding_authorizations_targetUserId_state_idx" ON "onboarding_authorizations"("targetUserId", "state");

-- CreateIndex
CREATE INDEX "onboarding_events_targetUserId_createdAt_idx" ON "onboarding_events"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "onboarding_identities" ADD CONSTRAINT "onboarding_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_identities" ADD CONSTRAINT "onboarding_identities_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_identities" ADD CONSTRAINT "onboarding_identities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_identities" ADD CONSTRAINT "onboarding_identities_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_invitations" ADD CONSTRAINT "onboarding_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_invitations" ADD CONSTRAINT "onboarding_invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_authorizations" ADD CONSTRAINT "onboarding_authorizations_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_authorizations" ADD CONSTRAINT "onboarding_authorizations_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_authorizations" ADD CONSTRAINT "onboarding_authorizations_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_authorizations" ADD CONSTRAINT "onboarding_authorizations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_authorizations" ADD CONSTRAINT "onboarding_authorizations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "onboarding_authorizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_events" ADD CONSTRAINT "onboarding_events_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BEGIN SECURE ONBOARDING INTEGRITY
ALTER TABLE onboarding_authorizations ADD COLUMN "decisionReason" TEXT;
ALTER TABLE onboarding_events ADD COLUMN reason TEXT;

ALTER TABLE onboarding_identities ADD CONSTRAINT onboarding_identity_state CHECK(version>0 AND ("verifiedAt" IS NULL OR ("emailVerifiedAt" IS NOT NULL AND "employeeId" IS NOT NULL AND "verifiedById" IS NOT NULL AND COALESCE("evidenceDigest",'') ~ '^[0-9a-f]{64}$')));
ALTER TABLE onboarding_invitations ADD CONSTRAINT onboarding_invitation_state CHECK("tokenHash" ~ '^[0-9a-f]{64}$' AND "expiresAt">"createdAt" AND status IN ('DELIVERED','CONSUMED','CANCELLED') AND ((status='DELIVERED' AND "consumedAt" IS NULL AND "cancelledAt" IS NULL) OR (status='CONSUMED' AND "consumedAt" IS NOT NULL AND "cancelledAt" IS NULL) OR (status='CANCELLED' AND "cancelledAt" IS NOT NULL AND "consumedAt" IS NULL)));
CREATE UNIQUE INDEX onboarding_one_live_invitation ON onboarding_invitations("userId") WHERE status='DELIVERED';
ALTER TABLE onboarding_authorizations ADD CONSTRAINT onboarding_authorization_state CHECK(version>0 AND (kind='SPECIALIZED' OR "actorId"<>"targetUserId") AND kind IN ('ORGANIZATION','ATTESTATION','SPECIALIZED') AND state IN ('PENDING','APPROVED','REJECTED','CONSUMED','REVOKED') AND "expiresAt">"createdAt" AND length(btrim(reason))>0 AND (kind<>'SPECIALIZED' OR scope IN ('SYSTEM_ADMIN','ACCOUNTANT','HR_ADMIN')) AND (kind='SPECIALIZED' OR (scope IN ('INITIAL_MD','MD_RECOVERY') AND COALESCE("evidenceDigest",'') ~ '^[0-9a-f]{64}$')) AND (kind<>'ATTESTATION' OR ("parentId" IS NOT NULL AND "sessionId" IS NOT NULL)));
ALTER TABLE onboarding_nonces ADD CONSTRAINT onboarding_nonce_contract CHECK("nonceHash" ~ '^[0-9a-f]{64}$' AND "payloadHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE onboarding_rates ADD CONSTRAINT onboarding_rate_positive CHECK(attempts>0);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['onboarding_identities','onboarding_invitations','onboarding_authorizations','onboarding_events','onboarding_nonces','onboarding_rates'] LOOP
 EXECUTE format('CREATE TRIGGER onboarding_owner_only BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION authority_owner_only()',t);
 EXECUTE format('CREATE TRIGGER onboarding_no_truncate BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION authority_immutable()',t);
 END LOOP;END $$;
CREATE TRIGGER onboarding_events_immutable BEFORE UPDATE OR DELETE ON onboarding_events FOR EACH ROW EXECUTE FUNCTION authority_immutable();
CREATE TRIGGER onboarding_nonces_immutable BEFORE UPDATE OR DELETE ON onboarding_nonces FOR EACH ROW EXECUTE FUNCTION authority_immutable();
CREATE FUNCTION onboarding_history_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF TG_TABLE_NAME='onboarding_invitations' THEN
 IF OLD.status<>'DELIVERED' OR NEW.status NOT IN ('CONSUMED','CANCELLED') OR (to_jsonb(OLD)-ARRAY['status','consumedAt','cancelledAt']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['status','consumedAt','cancelledAt']) THEN RAISE EXCEPTION 'Immutable single-use invitation' USING ERRCODE='23514';END IF;
 ELSE
 IF OLD.state IN ('REJECTED','REVOKED','CONSUMED') OR NEW.version<>OLD.version+1 OR (to_jsonb(OLD)-ARRAY['state','reviewerId','version','consumedAt','revokedAt','decisionReason']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','reviewerId','version','consumedAt','revokedAt','decisionReason']) OR NEW.state=OLD.state THEN RAISE EXCEPTION 'Immutable authorization instruction' USING ERRCODE='23514';END IF;
 END IF;RETURN NEW;END $$;
CREATE TRIGGER onboarding_invitation_history BEFORE UPDATE ON onboarding_invitations FOR EACH ROW EXECUTE FUNCTION onboarding_history_guard();
CREATE TRIGGER onboarding_authorization_history BEFORE UPDATE ON onboarding_authorizations FOR EACH ROW EXECUTE FUNCTION onboarding_history_guard();
CREATE FUNCTION onboarding_verified_personal(person text) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM onboarding_identities i JOIN users u ON u.id=i."userId" JOIN employee_account_bindings b ON b."userId"=u.id AND b."employeeId"=i."employeeId" JOIN employees e ON e.id=i."employeeId" JOIN companies c ON c.id=i."companyId" WHERE i."userId"=person AND i."emailVerifiedAt" IS NOT NULL AND i."verifiedAt" IS NOT NULL AND b."unboundAt" IS NULL AND u."isActive" AND e."isActive" AND NOT e."isDeleted" AND c."singletonKey"='PRIMARY' AND c."isActive" AND EXISTS(SELECT 1 FROM onboarding_invitations v WHERE v."userId"=u.id AND v.status='CONSUMED' AND v.email=u.email)) $$;
-- The caller is an independently isolated, signed-context private broker, never runtime.
CREATE FUNCTION onboarding_command(actor text, command text, data jsonb, context jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' AS $$
DECLARE parent text; target text; old_target text; rid text; nonce_hash text; inv onboarding_invitations; ident onboarding_identities; authz onboarding_authorizations; org onboarding_authorizations; att onboarding_authorizations; root_md authority_mandates; is_md boolean; assurance text; result jsonb; before_user jsonb; after_user jsonb; capability text; account_version int; ts timestamptz; limiter onboarding_rates; permission_name text;
BEGIN
 SELECT id INTO parent FROM companies WHERE "singletonKey"='PRIMARY' AND "isActive";IF parent IS NULL THEN RAISE EXCEPTION 'PRIMARY_UNAVAILABLE' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('real_capita_authority:'||parent,0));
 PERFORM id FROM companies WHERE id=parent AND "singletonKey"='PRIMARY' AND "isActive" FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'PRIMARY_CHANGED' USING ERRCODE='40001';END IF;
 PERFORM id FROM authority_mandates WHERE "companyId"=parent ORDER BY id FOR SHARE;
 assurance:=context->>'assurance';
 IF context->>'assurance' IS NULL OR context->>'payloadHash' IS NULL OR context->>'issuedAt' IS NULL OR context->>'expiresAt' IS NULL OR context->>'nonce' IS NULL OR length(context->>'nonce')<16 OR context->>'payloadHash' !~ '^[0-9a-f]{64}$' OR (context->>'expiresAt')::numeric<extract(epoch FROM clock_timestamp())*1000 OR (context->>'issuedAt')::numeric>extract(epoch FROM clock_timestamp())*1000+5000 OR (context->>'expiresAt')::numeric-(context->>'issuedAt')::numeric>120000 THEN RAISE EXCEPTION 'INVALID_PROOF_CONTEXT' USING ERRCODE='42501';END IF;
 IF command<>'CLAIM' THEN
 IF context->>'actorId' IS DISTINCT FROM actor OR context->>'command' IS DISTINCT FROM command OR NOT EXISTS(SELECT 1 FROM auth_sessions s JOIN users u ON u.id=s."userId" WHERE s.id=context->>'sessionId' AND s."tokenId"=context->>'tokenId' AND s."userId"=actor AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND u."isActive") THEN RAISE EXCEPTION 'CURRENT_SIGNED_SESSION_REQUIRED' USING ERRCODE='42501';END IF;
 PERFORM id FROM auth_sessions WHERE id=context->>'sessionId' FOR SHARE;
 PERFORM id FROM users WHERE id=actor AND "isActive" FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_ACTOR_REQUIRED' USING ERRCODE='42501';END IF;
 END IF;
 nonce_hash:=encode(sha256(convert_to(context->>'nonce','UTF8')),'hex');
 INSERT INTO onboarding_nonces("nonceHash","actorId","sessionId",command,"payloadHash","expiresAt") VALUES(nonce_hash,NULLIF(actor,''),context->>'sessionId',command,context->>'payloadHash',to_timestamp((context->>'expiresAt')::numeric/1000));
 SELECT * INTO root_md FROM authority_mandates m WHERE m."companyId"=parent AND m.kind='MD' AND m."userId"=actor AND authority_live_mandate(m) FOR SHARE;
 is_md:=FOUND;
 IF command LIKE 'AUTHORITY_%' THEN
 IF assurance<>'PRIVILEGED_ACTION' OR command NOT IN ('AUTHORITY_REQUEST','AUTHORITY_APPROVE','AUTHORITY_REJECT','AUTHORITY_CANCEL','AUTHORITY_EXPIRE') THEN RAISE EXCEPTION 'COMMAND_DENIED' USING ERRCODE='42501';END IF;
 RETURN authority_command(actor,substring(command FROM 11),data);
 ELSIF command IN ('LEAVE_HR','LEAVE_MD') THEN
 IF assurance<>'PRIVILEGED_ACTION' THEN RAISE EXCEPTION 'COMMAND_DENIED' USING ERRCODE='42501';END IF;
 RETURN leave_stage_command(actor,CASE WHEN command='LEAVE_HR' THEN 'HR' ELSE 'MD' END,data);
 ELSIF command='INVITE' THEN
 IF NOT ((assurance='INITIAL_REGISTRAR' AND NOT EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD')) OR (assurance='INITIAL_REGISTRAR' AND (is_md OR ('users.create'=ANY(authority_effective(actor)) AND EXISTS(SELECT 1 FROM user_permissions WHERE "userId"=actor AND code='SYSTEM_ADMIN' AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">clock_timestamp())))))) THEN RAISE EXCEPTION 'VERIFIED_REGISTRAR_OR_MD_REQUIRED' USING ERRCODE='42501';END IF;
 IF data->>'tokenHash' !~ '^[0-9a-f]{64}$' OR data->>'passwordHash' !~ '^\$2[aby]\$' OR data->>'email' IS NULL OR data->>'email'<>lower(btrim(data->>'email')) OR length(btrim(data->>'name'))=0 OR length(btrim(COALESCE(data->>'reason','')))=0 THEN RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE='23514';END IF;
 ts:=(data->>'expiresAt')::timestamptz;IF ts IS NULL OR ts<=clock_timestamp() OR ts>clock_timestamp()+interval '15 minutes' THEN RAISE EXCEPTION 'INVITATION_EXPIRY' USING ERRCODE='23514';END IF;
 SELECT id INTO target FROM users WHERE lower(email)=data->>'email' FOR UPDATE;
 IF FOUND THEN
 SELECT * INTO ident FROM onboarding_identities WHERE "userId"=target FOR UPDATE;
 IF NOT FOUND THEN
 IF EXISTS(SELECT 1 FROM users WHERE id=target AND NOT "isActive") AND EXISTS(SELECT 1 FROM user_admin_events WHERE "targetUserId"=target AND action='PENDING_CREATED') AND NOT EXISTS(SELECT 1 FROM user_roles WHERE "userId"=target) AND NOT EXISTS(SELECT 1 FROM user_permissions WHERE "userId"=target) AND NOT EXISTS(SELECT 1 FROM employee_account_bindings WHERE "userId"=target) THEN
 INSERT INTO onboarding_identities("userId","companyId") VALUES(target,parent) RETURNING * INTO ident;
 ELSE RAISE EXCEPTION 'DUPLICATE_ACCOUNT' USING ERRCODE='23505';END IF;
 END IF;
 IF ident."emailVerifiedAt" IS NOT NULL OR EXISTS(SELECT 1 FROM users WHERE id=target AND "isActive") THEN RAISE EXCEPTION 'DUPLICATE_ACCOUNT' USING ERRCODE='23505';END IF;
 UPDATE onboarding_invitations SET status='CANCELLED',"cancelledAt"=clock_timestamp() WHERE "userId"=target AND status='DELIVERED';
 ELSE
 target:=gen_random_uuid()::text;INSERT INTO users(id,email,"fullName","passwordHash","isActive","updatedAt") VALUES(target,data->>'email',data->>'name',data->>'passwordHash',false,clock_timestamp());
 INSERT INTO onboarding_identities("userId","companyId") VALUES(target,parent);
 INSERT INTO user_admin_events(id,"actorId","targetUserId",action,snapshot) VALUES(gen_random_uuid()::text,actor,target,'PENDING_CREATED',jsonb_build_object('after',jsonb_build_object('id',target,'isActive',false,'adminVersion',1)));
 END IF;
 rid:=gen_random_uuid()::text;INSERT INTO onboarding_invitations(id,"userId",email,"tokenHash","createdById","expiresAt") VALUES(rid,target,data->>'email',data->>'tokenHash',actor,ts);
 result:=jsonb_build_object('invitationId',rid,'userId',target,'email',data->>'email');
 ELSIF command='CLAIM' THEN
 IF assurance<>'EMAIL_CAPABILITY' OR data->>'tokenHash' !~ '^[0-9a-f]{64}$' OR data->>'passwordHash' !~ '^\$2[aby]\$' THEN RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE='42501';END IF;
 SELECT * INTO inv FROM onboarding_invitations WHERE "tokenHash"=data->>'tokenHash' FOR UPDATE;
 IF NOT FOUND OR inv.status<>'DELIVERED' OR inv."expiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE='42501';END IF;
 target:=inv."userId";PERFORM id FROM users WHERE id=target AND email=inv.email AND NOT "isActive" FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE='42501';END IF;
 UPDATE onboarding_invitations SET status='CONSUMED',"consumedAt"=clock_timestamp() WHERE id=inv.id;
 UPDATE onboarding_identities SET "emailVerifiedAt"=clock_timestamp(),version=version+1 WHERE "userId"=target AND "emailVerifiedAt" IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'ALREADY_VERIFIED' USING ERRCODE='23505';END IF;
 UPDATE users SET "passwordHash"=data->>'passwordHash',"updatedAt"=clock_timestamp() WHERE id=target;
 rid:=inv.id;result:=jsonb_build_object('status','EMAIL_VERIFIED','userId',target);
 ELSIF command='VERIFY_IDENTITY' THEN
 IF NOT ((assurance='INITIAL_REGISTRAR' AND NOT EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD')) OR (assurance='INITIAL_REGISTRAR' AND is_md)) THEN RAISE EXCEPTION 'INDEPENDENT_IDENTITY_VERIFIER_REQUIRED' USING ERRCODE='42501';END IF;
 target:=data->>'targetUserId';IF NOT EXISTS(SELECT 1 FROM users u JOIN onboarding_invitations v ON v."userId"=u.id WHERE u.id=target AND v.email=u.email AND v.status='CONSUMED') THEN RAISE EXCEPTION 'CURRENT_EMAIL_CONTROL_REQUIRED' USING ERRCODE='42501';END IF;IF target=actor OR COALESCE(data->>'evidenceDigest','') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INDEPENDENT_VERIFIER_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO ident FROM onboarding_identities WHERE "userId"=target AND "companyId"=parent AND "emailVerifiedAt" IS NOT NULL FOR UPDATE;IF NOT FOUND OR ident."verifiedAt" IS NOT NULL THEN RAISE EXCEPTION 'CURRENT_CLAIM_REQUIRED' USING ERRCODE='42501';END IF;
 PERFORM id FROM employees WHERE id=data->>'employeeId' AND "employeeCode"=data->>'employeeCode' AND "isActive" AND NOT "isDeleted" FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORITATIVE_EMPLOYEE_MISMATCH' USING ERRCODE='42501';END IF;
 PERFORM id FROM users WHERE id=target AND NOT "isActive" FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'PENDING_USER_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT to_jsonb(u) - ARRAY['passwordHash','lastLoginAt'] INTO before_user FROM users u WHERE id=target;
 rid:=gen_random_uuid()::text;INSERT INTO employee_account_bindings(id,"userId","employeeId","verifiedById","verificationReference") VALUES(rid,target,data->>'employeeId',actor,'Independently verified onboarding record '||nonce_hash);
 UPDATE onboarding_identities SET "verifiedAt"=clock_timestamp(),"employeeId"=data->>'employeeId',"verifiedById"=actor,"evidenceDigest"=data->>'evidenceDigest',version=version+1 WHERE "userId"=target;
 UPDATE users SET "isActive"=true,"adminVersion"="adminVersion"+1,"updatedAt"=clock_timestamp() WHERE id=target RETURNING to_jsonb(users.*)-ARRAY['passwordHash','lastLoginAt'] INTO after_user;
 INSERT INTO user_admin_events(id,"actorId","targetUserId",action,snapshot) VALUES(gen_random_uuid()::text,actor,target,'IDENTITY_VERIFIED',jsonb_build_object('before',before_user,'after',after_user));
 result:=jsonb_build_object('status','IDENTITY_VERIFIED','userId',target);
 ELSIF command IN ('AUTHORIZE_INITIAL_MD','AUTHORIZE_MD_RECOVERY') THEN
 IF assurance IS DISTINCT FROM (CASE WHEN command='AUTHORIZE_INITIAL_MD' THEN 'COMPANY_AUTHORIZER' ELSE 'RECOVERY_AUTHORIZER' END) OR (command='AUTHORIZE_INITIAL_MD' AND EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD')) OR (command='AUTHORIZE_MD_RECOVERY' AND NOT EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD' AND "userId"=data->>'targetUserId' AND "revokedAt" IS NULL)) OR actor IS DISTINCT FROM data->>'authorizerId' OR NOT onboarding_verified_personal(actor) OR NOT onboarding_verified_personal(data->>'targetUserId') OR actor=data->>'targetUserId' OR COALESCE(data->>'evidenceDigest','') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INDEPENDENT_COMPANY_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 target:=data->>'targetUserId';ts:=(data->>'expiresAt')::timestamptz;IF ts IS NULL OR ts<=clock_timestamp() OR ts>clock_timestamp()+interval '7 days' THEN RAISE EXCEPTION 'INVALID_AUTHORIZATION_EXPIRY' USING ERRCODE='23514';END IF;
 rid:=gen_random_uuid()::text;INSERT INTO onboarding_authorizations(id,"companyId","actorId","targetUserId",kind,scope,state,reason,"evidenceDigest","expiresAt") VALUES(rid,parent,actor,target,'ORGANIZATION',CASE WHEN command='AUTHORIZE_INITIAL_MD' THEN 'INITIAL_MD' ELSE 'MD_RECOVERY' END,'APPROVED','Independent company appointment authorization',data->>'evidenceDigest',ts);
 result:=jsonb_build_object('authorizationId',rid);
 ELSIF command='ATTEST_MD' THEN
 IF assurance<>'INDEPENDENT_ATTESTATION' OR NOT onboarding_verified_personal(actor) THEN RAISE EXCEPTION 'CURRENT_INDEPENDENT_ATTESTOR_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO org FROM onboarding_authorizations WHERE id=data->>'authorizationId' AND kind='ORGANIZATION' AND state='APPROVED' AND "actorId"=actor AND "targetUserId"=data->>'targetUserId' AND "companyId"=parent AND "expiresAt">clock_timestamp() AND "revokedAt" IS NULL FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'COMPANY_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 target:=org."targetUserId";IF NOT onboarding_verified_personal(target) OR actor=target THEN RAISE EXCEPTION 'MD_PERSONAL_CONTROL_REQUIRED' USING ERRCODE='42501';END IF;
 rid:=gen_random_uuid()::text;INSERT INTO onboarding_authorizations(id,"companyId","actorId","targetUserId",kind,scope,state,reason,"evidenceDigest","parentId","sessionId","expiresAt") VALUES(rid,parent,actor,target,'ATTESTATION',org.scope,'APPROVED','Independent MD appointment attestation',context->>'payloadHash',org.id,context->>'sessionId',least(org."expiresAt",clock_timestamp()+interval '5 minutes'));
 result:=jsonb_build_object('attestationId',rid);
 ELSIF command IN ('ACTIVATE_MD','REVOKE_MD') THEN
 IF assurance<>(CASE WHEN command='ACTIVATE_MD' THEN 'ACCOUNT_CONTROL' ELSE 'RECOVERY_ATTESTATION' END) THEN RAISE EXCEPTION 'MD_CEREMONY_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO att FROM onboarding_authorizations WHERE id=data->>'attestationId' AND kind='ATTESTATION' AND state='APPROVED' AND ((command='ACTIVATE_MD' AND "targetUserId"=actor AND scope='INITIAL_MD') OR (command='REVOKE_MD' AND "actorId"=actor AND scope='MD_RECOVERY')) AND "expiresAt">clock_timestamp() AND "revokedAt" IS NULL FOR UPDATE;IF NOT FOUND OR NOT onboarding_verified_personal(actor) THEN RAISE EXCEPTION 'CURRENT_INDEPENDENT_ATTESTATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO org FROM onboarding_authorizations WHERE id=att."parentId" AND kind='ORGANIZATION' AND state='APPROVED' AND "revokedAt" IS NULL AND "expiresAt">clock_timestamp() AND "targetUserId"=att."targetUserId" AND "actorId"=att."actorId" FOR SHARE;
 IF NOT FOUND OR NOT onboarding_verified_personal(att."actorId") OR NOT EXISTS(SELECT 1 FROM auth_sessions WHERE id=att."sessionId" AND "userId"=att."actorId" AND "revokedAt" IS NULL AND "expiresAt">clock_timestamp()) THEN RAISE EXCEPTION 'ATTESTOR_AUTHORITY_REVOKED' USING ERRCODE='42501';END IF;
 IF command='REVOKE_MD' THEN
 UPDATE authority_mandates SET "revokedAt"=clock_timestamp(),version=version+1 WHERE "companyId"=parent AND "userId"=att."targetUserId" AND kind='MD' AND "revokedAt" IS NULL RETURNING id INTO rid;IF NOT FOUND THEN RAISE EXCEPTION 'LIVE_MD_ROOT_REQUIRED' USING ERRCODE='42501';END IF;
 INSERT INTO authority_events(id,"actorId",action,"entityId",snapshot) VALUES(gen_random_uuid()::text,actor,'MD_RECOVERY_REVOKE',att."targetUserId",jsonb_build_object('attestationId',att.id,'authorizationId',org.id));
 UPDATE auth_sessions SET "revokedAt"=clock_timestamp() WHERE "userId"=att."targetUserId" AND "revokedAt" IS NULL;
 result:=jsonb_build_object('status','REVOKED');
 ELSE
 capability:=gen_random_uuid()::text||gen_random_uuid()::text;rid:=gen_random_uuid()::text;
 INSERT INTO authority_bootstraps(id,"companyId","targetUserId","authorizerId","tokenHash","expiresAt",purpose,provenance) VALUES(rid,parent,actor,att."actorId",encode(sha256(convert_to(capability,'UTF8')),'hex'),least(att."expiresAt",clock_timestamp()+interval '1 minute'),CASE WHEN command='ACTIVATE_MD' THEN 'ACTIVATE' ELSE 'REVOKE' END,jsonb_build_object('onboardingAttestationId',att.id,'organizationalAuthorizationId',org.id));
 result:=authority_command(actor,'BOOTSTRAP',jsonb_build_object('ticketToken',capability));END IF;
 UPDATE onboarding_authorizations SET state='CONSUMED',"consumedAt"=clock_timestamp(),version=version+1 WHERE id=att.id;target:=att."targetUserId";
 ELSIF command='REQUEST_SPECIALIZED' THEN
 IF assurance<>'PRIVILEGED_ACTION' OR NOT ((actor=data->>'targetUserId' AND onboarding_verified_personal(actor)) OR is_md OR ('users.manage'=ANY(authority_effective(actor)) AND EXISTS(SELECT 1 FROM user_permissions WHERE "userId"=actor AND code='SYSTEM_ADMIN' AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">clock_timestamp())))) THEN RAISE EXCEPTION 'CURRENT_ADMIN_OR_MD_REQUIRED' USING ERRCODE='42501';END IF;
 target:=data->>'targetUserId';permission_name:=data->>'permission';IF NOT onboarding_verified_personal(target) OR permission_name NOT IN ('SYSTEM_ADMIN','ACCOUNTANT','HR_ADMIN') OR length(btrim(COALESCE(data->>'reason','')))=0 THEN RAISE EXCEPTION 'INVALID_SPECIALIZED_REQUEST' USING ERRCODE='42501';END IF;
 SELECT "adminVersion" INTO account_version FROM users WHERE id=target FOR UPDATE;IF account_version IS DISTINCT FROM (data->>'expectedVersion')::int THEN RAISE EXCEPTION 'STALE_ACCOUNT' USING ERRCODE='40001';END IF;
 ts:=(data->>'expiresAt')::timestamptz;IF ts IS NULL OR ts<=clock_timestamp() OR ts>clock_timestamp()+interval '30 days' THEN RAISE EXCEPTION 'BOUNDED_SPECIALIZED_EXPIRY_REQUIRED' USING ERRCODE='23514';END IF;
 rid:=gen_random_uuid()::text;INSERT INTO onboarding_authorizations(id,"companyId","actorId","targetUserId",kind,scope,reason,"expectedVersion","expiresAt") VALUES(rid,parent,actor,target,'SPECIALIZED',permission_name,data->>'reason',account_version,ts);result:=jsonb_build_object('requestId',rid,'status','PENDING');
 ELSIF command IN ('DECIDE_SPECIALIZED','REVOKE_SPECIALIZED') THEN
 IF assurance<>'PRIVILEGED_ACTION' OR NOT is_md THEN RAISE EXCEPTION 'MD_ONLY_SPECIALIZED_DECISION' USING ERRCODE='42501';END IF;
 SELECT * INTO authz FROM onboarding_authorizations WHERE id=data->>'requestId' AND kind='SPECIALIZED' AND "companyId"=parent FOR UPDATE;IF NOT FOUND OR actor=authz."actorId" OR actor=authz."targetUserId" THEN RAISE EXCEPTION 'INDEPENDENT_MD_REQUIRED' USING ERRCODE='42501';END IF;
 IF (command='DECIDE_SPECIALIZED' AND (authz.state<>'PENDING' OR authz."expiresAt"<=clock_timestamp())) OR (command='REVOKE_SPECIALIZED' AND authz.state<>'APPROVED') OR length(btrim(COALESCE(data->>'reason','')))=0 THEN RAISE EXCEPTION 'STALE_SPECIALIZED_REQUEST' USING ERRCODE='40001';END IF;
 target:=authz."targetUserId";SELECT to_jsonb(u)-ARRAY['passwordHash','lastLoginAt'] INTO before_user FROM users u WHERE id=target FOR UPDATE;account_version:=(before_user->>'adminVersion')::int;
 IF command='DECIDE_SPECIALIZED' AND account_version<>authz."expectedVersion" THEN RAISE EXCEPTION 'STALE_ACCOUNT' USING ERRCODE='40001';END IF;
 IF command='DECIDE_SPECIALIZED' AND data->>'decision'='REJECT' THEN UPDATE onboarding_authorizations SET state='REJECTED',"decisionReason"=data->>'reason',"reviewerId"=actor,version=version+1 WHERE id=authz.id;
 ELSE
 IF command='DECIDE_SPECIALIZED' AND (data->>'decision' IS DISTINCT FROM 'APPROVE' OR NOT onboarding_verified_personal(target)) THEN RAISE EXCEPTION 'VERIFIED_RECIPIENT_REQUIRED' USING ERRCODE='42501';END IF;
 IF authz.scope='ACCOUNTANT' THEN
 IF command='DECIDE_SPECIALIZED' THEN
 INSERT INTO user_roles(id,"userId","roleId") SELECT gen_random_uuid()::text,target,id FROM roles WHERE code='ACCOUNTANT';IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNTANT_CONFIGURATION_MISSING' USING ERRCODE='23514';END IF;
 ELSE DELETE FROM user_roles WHERE "userId"=target AND "roleId" IN(SELECT id FROM roles WHERE code='ACCOUNTANT');END IF;
 ELSE
 IF command='DECIDE_SPECIALIZED' THEN INSERT INTO user_permissions(id,"userId",code,"grantedById",reason,"expiresAt") VALUES(gen_random_uuid()::text,target,authz.scope::"HrPermission",actor,'MD authorized request '||authz.id,authz."expiresAt");
 ELSE UPDATE user_permissions SET "revokedAt"=clock_timestamp(),"revokedById"=actor WHERE "userId"=target AND code=authz.scope::"HrPermission" AND "revokedAt" IS NULL;END IF;
 END IF;
 UPDATE onboarding_authorizations SET state=CASE WHEN command='DECIDE_SPECIALIZED' THEN 'APPROVED' ELSE 'REVOKED' END,"decisionReason"=data->>'reason',"reviewerId"=actor,"revokedAt"=CASE WHEN command='REVOKE_SPECIALIZED' THEN clock_timestamp() ELSE NULL END,version=version+1 WHERE id=authz.id;
 UPDATE users SET "adminVersion"="adminVersion"+1,"updatedAt"=clock_timestamp() WHERE id=target RETURNING to_jsonb(users.*)-ARRAY['passwordHash','lastLoginAt'] INTO after_user;
 INSERT INTO user_admin_events(id,"actorId","targetUserId",action,snapshot) VALUES(gen_random_uuid()::text,actor,target,command,jsonb_build_object('before',before_user,'after',after_user));
 UPDATE auth_sessions SET "revokedAt"=clock_timestamp() WHERE "userId"=target AND "revokedAt" IS NULL;
 END IF;rid:=authz.id;result:=jsonb_build_object('requestId',rid,'status',CASE WHEN command='REVOKE_SPECIALIZED' THEN 'REVOKED' WHEN data->>'decision'='APPROVE' THEN 'APPROVED' ELSE 'REJECTED' END);
 ELSIF command='REPLACE_ACCOUNT' THEN
 IF assurance<>'ACCOUNT_RECOVERY' OR NOT is_md OR data->>'oldUserId'=actor OR data->>'targetUserId'=actor OR data->>'oldUserId'=data->>'targetUserId' OR COALESCE(data->>'evidenceDigest','') !~ '^[0-9a-f]{64}$' OR length(btrim(COALESCE(data->>'reason','')))=0 THEN RAISE EXCEPTION 'INDEPENDENT_MD_ACCOUNT_RECOVERY_REQUIRED' USING ERRCODE='42501';END IF;
 old_target:=data->>'oldUserId';target:=data->>'targetUserId';IF EXISTS(SELECT 1 FROM authority_mandates WHERE "userId" IN(old_target,target) AND kind='MD') THEN RAISE EXCEPTION 'ROOT_REPLACEMENT_POLICY_REQUIRED' USING ERRCODE='42501';END IF;
 PERFORM id FROM users WHERE id IN(old_target,target) ORDER BY id FOR UPDATE;
 PERFORM id FROM employees WHERE id=data->>'employeeId' AND "employeeCode"=data->>'employeeCode' AND "isActive" AND NOT "isDeleted" FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'AUTHORITATIVE_EMPLOYEE_MISMATCH' USING ERRCODE='42501';END IF;
 PERFORM id FROM employee_account_bindings WHERE "userId"=old_target AND "employeeId"=data->>'employeeId' AND "unboundAt" IS NULL FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'OLD_BINDING_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO ident FROM onboarding_identities WHERE "userId"=target AND "companyId"=parent AND "emailVerifiedAt" IS NOT NULL AND "verifiedAt" IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM users u JOIN onboarding_invitations v ON v."userId"=u.id WHERE u.id=target AND NOT u."isActive" AND v.email=u.email AND v.status='CONSUMED') THEN RAISE EXCEPTION 'CURRENT_REPLACEMENT_CLAIM_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT to_jsonb(u)-ARRAY['passwordHash','lastLoginAt'] INTO before_user FROM users u WHERE id=old_target;
 UPDATE users SET "isActive"=false,"adminVersion"="adminVersion"+1,"updatedAt"=clock_timestamp() WHERE id=old_target RETURNING to_jsonb(users.*)-ARRAY['passwordHash','lastLoginAt'] INTO after_user;
 UPDATE auth_sessions SET "revokedAt"=clock_timestamp() WHERE "userId"=old_target AND "revokedAt" IS NULL;
 UPDATE authority_mandates SET "revokedAt"=clock_timestamp(),version=version+1 WHERE "userId"=old_target AND "revokedAt" IS NULL;
 UPDATE authority_role_grants SET "revokedAt"=clock_timestamp(),version=version+1 WHERE "userId"=old_target AND "revokedAt" IS NULL;
 UPDATE employee_account_bindings SET "unboundAt"=clock_timestamp(),"unboundById"=actor WHERE "userId"=old_target AND "unboundAt" IS NULL;
 INSERT INTO user_admin_events(id,"actorId","targetUserId",action,snapshot) VALUES(gen_random_uuid()::text,actor,old_target,'ACCOUNT_REPLACED',jsonb_build_object('before',before_user,'after',after_user,'replacementUserId',target));
 INSERT INTO onboarding_events(id,"actorId","targetUserId",action,"recordId",reason) VALUES(gen_random_uuid()::text,actor,old_target,'ACCOUNT_REPLACED',target,data->>'reason');
 SELECT to_jsonb(u)-ARRAY['passwordHash','lastLoginAt'] INTO before_user FROM users u WHERE id=target;
 rid:=gen_random_uuid()::text;INSERT INTO employee_account_bindings(id,"userId","employeeId","verifiedById","verificationReference") VALUES(rid,target,data->>'employeeId',actor,'Independent replacement verification '||nonce_hash);
 UPDATE onboarding_identities SET "verifiedAt"=clock_timestamp(),"verifiedById"=actor,"employeeId"=data->>'employeeId',"evidenceDigest"=data->>'evidenceDigest',version=version+1 WHERE "userId"=target;
 UPDATE users SET "isActive"=true,"adminVersion"="adminVersion"+1,"updatedAt"=clock_timestamp() WHERE id=target RETURNING to_jsonb(users.*)-ARRAY['passwordHash','lastLoginAt'] INTO after_user;
 INSERT INTO user_admin_events(id,"actorId","targetUserId",action,snapshot) VALUES(gen_random_uuid()::text,actor,target,'RECOVERY_IDENTITY_VERIFIED',jsonb_build_object('before',before_user,'after',after_user,'previousUserId',old_target));
 result:=jsonb_build_object('status','REPLACED_WITHOUT_PRIVILEGE_TRANSFER','userId',target);
 ELSIF command='SUSPEND' THEN
 IF assurance<>'PRIVILEGED_ACTION' OR NOT is_md OR actor=data->>'targetUserId' THEN RAISE EXCEPTION 'INDEPENDENT_MD_REQUIRED' USING ERRCODE='42501';END IF;target:=data->>'targetUserId';
 IF EXISTS(SELECT 1 FROM authority_mandates WHERE "userId"=target AND kind='MD') THEN RAISE EXCEPTION 'INDEPENDENT_ROOT_RECOVERY_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT to_jsonb(u)-ARRAY['passwordHash','lastLoginAt'] INTO before_user FROM users u WHERE id=target FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'UNKNOWN_TARGET' USING ERRCODE='42501';END IF;
 UPDATE users SET "isActive"=false,"adminVersion"="adminVersion"+1,"updatedAt"=clock_timestamp() WHERE id=target RETURNING to_jsonb(users.*)-ARRAY['passwordHash','lastLoginAt'] INTO after_user;
 UPDATE auth_sessions SET "revokedAt"=clock_timestamp() WHERE "userId"=target AND "revokedAt" IS NULL;
 UPDATE authority_mandates SET "revokedAt"=clock_timestamp(),version=version+1 WHERE "userId"=target AND "revokedAt" IS NULL;
 UPDATE authority_role_grants SET "revokedAt"=clock_timestamp(),version=version+1 WHERE "userId"=target AND "revokedAt" IS NULL;
 INSERT INTO user_admin_events(id,"actorId","targetUserId",action,snapshot) VALUES(gen_random_uuid()::text,actor,target,'SUSPEND',jsonb_build_object('before',before_user,'after',after_user));rid:=target;result:=jsonb_build_object('status','SUSPENDED');
 ELSIF command='CANCEL' THEN
 IF assurance<>'PRIVILEGED_ACTION' OR NOT is_md THEN RAISE EXCEPTION 'MD_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO inv FROM onboarding_invitations WHERE id=data->>'invitationId' AND status='DELIVERED' FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_PENDING' USING ERRCODE='40001';END IF;
 UPDATE onboarding_invitations SET status='CANCELLED',"cancelledAt"=clock_timestamp() WHERE id=inv.id;target:=inv."userId";rid:=inv.id;result:=jsonb_build_object('status','CANCELLED');
 ELSE RAISE EXCEPTION 'UNKNOWN_ONBOARDING_COMMAND' USING ERRCODE='42501';END IF;
 INSERT INTO onboarding_events(id,"actorId","targetUserId",action,"recordId",reason) VALUES(gen_random_uuid()::text,NULLIF(actor,''),target,command,rid,data->>'reason');
 INSERT INTO audit_events(id,"userId",action,"entityType","entityId",metadata) VALUES(gen_random_uuid()::text,NULLIF(actor,''),'ONBOARDING_'||command,'Onboarding',COALESCE(target,rid),jsonb_build_object('recordId',rid,'proofDigest',nonce_hash));
 RETURN result;
END $$;
REVOKE ALL ON onboarding_identities,onboarding_invitations,onboarding_authorizations,onboarding_events,onboarding_nonces,onboarding_rates FROM PUBLIC;
REVOKE ALL ON FUNCTION onboarding_command(text,text,jsonb,jsonb),onboarding_verified_personal(text),onboarding_history_guard() FROM PUBLIC;

-- Preserve legacy pending audit markers; only fully verified new identity releases the block.
CREATE OR REPLACE FUNCTION authority_command(actor text, command text, data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE parent text; m authority_mandates; root_md authority_mandates; ticket authority_bootstraps; req authority_requests; r roles; g authority_role_grants; target text; rid text; perms text[]; outcome jsonb; prior jsonb; prior_role jsonb; review_required boolean; expires timestamptz; v int; md_actor boolean;
BEGIN
 SELECT id INTO parent FROM companies WHERE "singletonKey"='PRIMARY' AND "isActive";IF parent IS NULL THEN RAISE EXCEPTION 'PRIMARY_UNAVAILABLE' USING ERRCODE='23514'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('real_capita_authority:'||parent,0));
 -- Re-lock PRIMARY after the wait: a Serializable snapshot cannot retain
 -- authority over a company deactivated/replaced by a concurrent transaction.
 PERFORM id FROM companies WHERE id=parent AND "singletonKey"='PRIMARY' AND "isActive" FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active PRIMARY changed' USING ERRCODE='42501';END IF;
 -- A Serializable snapshot may precede the advisory wait. Row locks reject
 -- grants/revocations committed since that snapshot instead of using stale authority.
 PERFORM id FROM authority_mandates WHERE "companyId"=parent ORDER BY id FOR SHARE;
 PERFORM id FROM roles WHERE "authorityCompanyId"=parent ORDER BY id FOR SHARE;
 PERFORM locked_grant.id FROM authority_role_grants locked_grant JOIN roles locked_role ON locked_role.id=locked_grant."roleId" WHERE locked_role."authorityCompanyId"=parent ORDER BY locked_grant.id FOR SHARE OF locked_grant;

 PERFORM 1 FROM users WHERE id=actor AND "isActive" FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_ACTOR_REQUIRED' USING ERRCODE='42501'; END IF;
 IF (EXISTS(SELECT 1 FROM user_admin_events WHERE "targetUserId"=actor AND action='PENDING_CREATED') AND NOT onboarding_verified_personal(actor)) OR NOT EXISTS(SELECT 1 FROM employee_account_bindings b JOIN employees e ON e.id=b."employeeId" WHERE b."userId"=actor AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted") THEN RAISE EXCEPTION 'VERIFIED_PERSONAL_IDENTITY_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM authority_mandates x WHERE x."userId"=actor AND authority_live_mandate(x) ORDER BY kind DESC LIMIT 1;
 md_actor:=m.kind='MD';
 IF command='BOOTSTRAP' THEN
 SELECT * INTO ticket FROM authority_bootstraps WHERE "targetUserId"=actor AND "companyId"=parent AND "tokenHash"=encode(sha256(convert_to(data->>'ticketToken','UTF8')),'hex') FOR UPDATE;
 IF NOT FOUND OR ticket."consumedAt" IS NOT NULL OR ticket."expiresAt"<=clock_timestamp() OR ticket."createdAt">clock_timestamp() OR ticket."authorizerId"=actor OR NOT EXISTS(SELECT 1 FROM users u JOIN employee_account_bindings b ON b."userId"=u.id JOIN employees e ON e.id=b."employeeId" WHERE u.id=ticket."authorizerId" AND u."isActive" AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted") THEN RAISE EXCEPTION 'INVALID_INDEPENDENT_BOOTSTRAP' USING ERRCODE='42501'; END IF;
 IF ticket.purpose='ACTIVATE' THEN
 IF EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD' AND "companyId"=parent) THEN RAISE EXCEPTION 'MD_ALREADY_DESIGNATED' USING ERRCODE='23505'; END IF;
 INSERT INTO authority_mandates(id,"companyId","userId",kind,ceiling,"bootstrapId") VALUES(gen_random_uuid()::text,parent,actor,'MD',ARRAY['dashboard.view','roles.view','roles.manage','users.view','users.create','users.manage','employees.view','employees.create','employees.edit','departments.view','departments.create','departments.edit','attendance.view','attendance.edit','attendance.approve','attendance.manage','schedules.view','schedules.manage','leave.view','leave.create','leave.withdraw','leave.review','leave.recommend','leave.history.view','leave.categories.manage','payroll.view','payroll.preview','payroll.create','payroll.approve','payroll.documents.view','payroll.preparation.view','payroll.batches.create','salary.view','salary.manage','salary.approve','salary.preview','projects.view','projects.create','projects.edit','cost-centers.view','cost-centers.create','cost-centers.edit','vouchers.view','vouchers.create','vouchers.edit','vouchers.delete','vouchers.post','vouchers.reverse','reports.view','accounting.view','accounting.manage','company.view','company.manage','bookings.view','bookings.manage'],ticket.id) RETURNING to_jsonb(authority_mandates.*) INTO outcome;
 ELSE
 UPDATE authority_mandates SET "revokedAt"=clock_timestamp(),version=version+1 WHERE "companyId"=parent AND "userId"=actor AND kind='MD' AND "revokedAt" IS NULL RETURNING to_jsonb(authority_mandates.*) INTO outcome;
 IF outcome IS NULL THEN RAISE EXCEPTION 'ACTIVE_MD_REQUIRED' USING ERRCODE='23514'; END IF;
 END IF;
 UPDATE authority_bootstraps SET "consumedAt"=clock_timestamp() WHERE id=ticket.id;outcome:=outcome||jsonb_build_object('ceremonyId',ticket.id,'ceremonyPurpose',ticket.purpose);
 ELSIF command='REQUEST' THEN
 SELECT * INTO req FROM authority_requests WHERE "actorId"=actor AND "idempotencyKey"=data->>'idempotencyKey';
 IF FOUND THEN IF req.payload IS DISTINCT FROM (data->'payload') OR req.operation IS DISTINCT FROM (data->>'operation') OR req."expectedVersion" IS DISTINCT FROM (data->>'expectedVersion')::int OR req.reason IS DISTINCT FROM (data->>'reason') OR req."expiresAt" IS DISTINCT FROM (data->>'expiresAt')::timestamptz(3) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='23505'; END IF;RETURN to_jsonb(req); END IF;
 IF data->>'operation' NOT IN ('DELEGATE','DELEGATE_REVOKE','ROLE_CREATE','ROLE_EDIT','ROLE_ASSIGN','ROLE_REVOKE') THEN RAISE EXCEPTION 'UNKNOWN_OPERATION' USING ERRCODE='23514'; END IF;
 expires:=(data->>'expiresAt')::timestamptz;IF expires IS NULL OR expires<=clock_timestamp() OR expires>clock_timestamp()+interval '7 days' THEN RAISE EXCEPTION 'INVALID_REQUEST_EXPIRY' USING ERRCODE='23514'; END IF;
 IF data->>'operation'<>'DELEGATE' AND (m.id IS NULL OR NOT ('roles.manage'=ANY(m.ceiling)) AND NOT COALESCE(md_actor,false)) THEN RAISE EXCEPTION 'MD_DELEGATION_REQUIRED' USING ERRCODE='42501'; END IF;
 IF data->>'operation'='DELEGATE' AND data->'payload'->>'targetUserId' IS DISTINCT FROM actor THEN RAISE EXCEPTION 'DELEGATION_REQUEST_IS_PERSONAL_NOT_EFFECTIVE' USING ERRCODE='42501'; END IF;
 -- Delegates may request revocation; only a different MD can decide it.
 -- Ordinary role creation/metadata edits are routine; membership/permission changes require MD.
 review_required:=data->>'operation' NOT IN ('ROLE_CREATE','ROLE_EDIT');
 IF data->>'operation' IN ('ROLE_CREATE','ROLE_EDIT') THEN
 SELECT COALESCE(array_agg(value),'{}'::text[]) INTO perms FROM jsonb_array_elements_text(data->'payload'->'permissions');
 IF NOT perms<@ARRAY['dashboard.view','roles.view','users.view','users.create','users.manage','employees.view','employees.create','employees.edit','departments.view','departments.create','departments.edit','attendance.view','attendance.edit','attendance.approve','attendance.manage','schedules.view','schedules.manage','leave.view','leave.create','leave.withdraw','leave.review','leave.recommend','leave.history.view','leave.categories.manage','payroll.view','payroll.preview','payroll.create','payroll.approve','payroll.documents.view','payroll.preparation.view','payroll.batches.create','salary.view','salary.manage','salary.approve','salary.preview','projects.view','projects.create','projects.edit','cost-centers.view','cost-centers.create','cost-centers.edit','vouchers.view','vouchers.create','vouchers.edit','vouchers.delete','vouchers.post','vouchers.reverse','reports.view','accounting.view','accounting.manage','company.view','company.manage','bookings.view','bookings.manage']::text[] OR cardinality(perms)<>(SELECT count(DISTINCT p) FROM unnest(perms)p) OR NOT perms<@m.ceiling THEN RAISE EXCEPTION 'PERMISSION_CEILING' USING ERRCODE='42501'; END IF;
 IF data->>'operation'='ROLE_EDIT' THEN SELECT * INTO r FROM roles WHERE id=data->'payload'->>'roleId' AND "authorityCompanyId"=parent FOR UPDATE;IF NOT FOUND OR r.version<>(data->>'expectedVersion')::int THEN RAISE EXCEPTION 'STALE_ROLE' USING ERRCODE='40001'; END IF;prior_role:=to_jsonb(r);review_required:=perms IS DISTINCT FROM r."permissionCodes" OR (NOT r."isActive" AND COALESCE((data->'payload'->>'isActive')::boolean,false)); END IF;
 END IF;
 INSERT INTO authority_requests(id,"companyId","actorId",operation,payload,"expectedVersion","idempotencyKey",reason,"expiresAt") VALUES(gen_random_uuid()::text,parent,actor,data->>'operation',data->'payload',(data->>'expectedVersion')::int,data->>'idempotencyKey',data->>'reason',expires) RETURNING * INTO req;
 IF review_required THEN outcome:=to_jsonb(req); ELSE
 IF req.operation='ROLE_CREATE' THEN
 IF req.payload->>'code' !~ '^[A-Z][A-Z0-9_]{1,31}$' OR length(btrim(req.payload->>'name'))=0 THEN RAISE EXCEPTION 'INVALID_ROLE' USING ERRCODE='23514'; END IF;
 INSERT INTO roles(id,code,name,description,"updatedAt","authorityCompanyId","createdUnderId","permissionCodes","isActive") VALUES(gen_random_uuid()::text,req.payload->>'code',btrim(req.payload->>'name'),req.payload->>'description',clock_timestamp(),parent,m.id,perms,COALESCE((req.payload->>'isActive')::boolean,true)) RETURNING * INTO r;
 ELSE UPDATE roles SET name=btrim(req.payload->>'name'),description=req.payload->>'description',"isActive"=(req.payload->>'isActive')::boolean,version=version+1,"updatedAt"=clock_timestamp() WHERE id=r.id RETURNING * INTO r; END IF;
 UPDATE authority_requests SET status='APPLIED',version=2,"decidedAt"=clock_timestamp() WHERE id=req.id RETURNING * INTO req;outcome:=jsonb_build_object('request',to_jsonb(req),'role',to_jsonb(r));
 END IF;
 ELSIF command IN ('APPROVE','REJECT','CANCEL','EXPIRE') THEN
 SELECT * INTO req FROM authority_requests WHERE id=data->>'requestId' AND "companyId"=parent FOR UPDATE;
 IF length(btrim(COALESCE(data->>'reason','')))=0 THEN RAISE EXCEPTION 'DECISION_REASON_REQUIRED' USING ERRCODE='23514'; END IF;
 IF NOT FOUND OR req.status<>'PENDING' OR req.version IS DISTINCT FROM (data->>'expectedVersion')::int THEN RAISE EXCEPTION 'STALE_OR_FINAL_REQUEST' USING ERRCODE='40001'; END IF;prior:=to_jsonb(req);
 IF command IN ('APPROVE','REJECT') THEN
 IF NOT COALESCE(md_actor,false) OR req."actorId"=actor THEN RAISE EXCEPTION 'INDEPENDENT_MD_REQUIRED' USING ERRCODE='42501'; END IF;
 IF req."expiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'REQUEST_EXPIRED' USING ERRCODE='23514'; END IF;
 SELECT * INTO root_md FROM authority_mandates x WHERE x."userId"=req."actorId" AND authority_live_mandate(x) ORDER BY kind DESC LIMIT 1;
 IF req.operation<>'DELEGATE' AND root_md.id IS NULL THEN RAISE EXCEPTION 'INITIATOR_AUTHORITY_REVOKED' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users u JOIN employee_account_bindings b ON b."userId"=u.id WHERE u.id=req."actorId" AND u."isActive" AND b."unboundAt" IS NULL) THEN RAISE EXCEPTION 'INITIATOR_IDENTITY_REVOKED' USING ERRCODE='42501'; END IF;
 IF command='APPROVE' THEN
 IF req.operation='DELEGATE' THEN
 SELECT COALESCE(array_agg(value),'{}'::text[]) INTO perms FROM jsonb_array_elements_text(req.payload->'permissions');IF NOT perms<@ARRAY['dashboard.view','roles.view','roles.manage','users.view','users.create','users.manage','employees.view','employees.create','employees.edit','departments.view','departments.create','departments.edit','attendance.view','attendance.edit','attendance.approve','attendance.manage','schedules.view','schedules.manage','leave.view','leave.create','leave.withdraw','leave.review','leave.recommend','leave.history.view','leave.categories.manage','payroll.view','payroll.preview','payroll.create','payroll.approve','payroll.documents.view','payroll.preparation.view','payroll.batches.create','salary.view','salary.manage','salary.approve','salary.preview','projects.view','projects.create','projects.edit','cost-centers.view','cost-centers.create','cost-centers.edit','vouchers.view','vouchers.create','vouchers.edit','vouchers.delete','vouchers.post','vouchers.reverse','reports.view','accounting.view','accounting.manage','company.view','company.manage','bookings.view','bookings.manage']::text[] OR cardinality(perms)=0 THEN RAISE EXCEPTION 'PROTECTED_AUTHORITY_NOT_DELEGABLE' USING ERRCODE='42501'; END IF;
 expires:=(req.payload->>'expiresAt')::timestamptz;IF expires IS NULL OR expires<=clock_timestamp() THEN RAISE EXCEPTION 'DELEGATION_EXPIRY_REQUIRED' USING ERRCODE='23514'; END IF;
 INSERT INTO authority_mandates(id,"companyId","userId",kind,ceiling,"requestId","expiresAt") VALUES(gen_random_uuid()::text,parent,req."actorId",'DELEGATE',perms,req.id,expires);
 ELSIF req.operation='DELEGATE_REVOKE' THEN
 UPDATE authority_mandates SET "revokedAt"=clock_timestamp(),version=version+1 WHERE id=req.payload->>'mandateId' AND kind='DELEGATE' AND "companyId"=parent AND version=req."expectedVersion" AND "revokedAt" IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'STALE_DELEGATE' USING ERRCODE='40001'; END IF;
 ELSIF req.operation IN ('ROLE_EDIT','ROLE_ASSIGN') THEN
 SELECT * INTO r FROM roles WHERE id=req.payload->>'roleId' AND "authorityCompanyId"=parent FOR UPDATE;IF NOT FOUND OR r.version<>req."expectedVersion" THEN RAISE EXCEPTION 'STALE_ROLE' USING ERRCODE='40001'; END IF;
 IF NOT r."permissionCodes"<@root_md.ceiling THEN RAISE EXCEPTION 'GRANTOR_CEILING_CHANGED' USING ERRCODE='42501'; END IF;
 IF req.operation='ROLE_EDIT' THEN
 prior_role:=to_jsonb(r);SELECT COALESCE(array_agg(value),'{}'::text[]) INTO perms FROM jsonb_array_elements_text(req.payload->'permissions');IF NOT perms<@ARRAY['dashboard.view','roles.view','users.view','users.create','users.manage','employees.view','employees.create','employees.edit','departments.view','departments.create','departments.edit','attendance.view','attendance.edit','attendance.approve','attendance.manage','schedules.view','schedules.manage','leave.view','leave.create','leave.withdraw','leave.review','leave.recommend','leave.history.view','leave.categories.manage','payroll.view','payroll.preview','payroll.create','payroll.approve','payroll.documents.view','payroll.preparation.view','payroll.batches.create','salary.view','salary.manage','salary.approve','salary.preview','projects.view','projects.create','projects.edit','cost-centers.view','cost-centers.create','cost-centers.edit','vouchers.view','vouchers.create','vouchers.edit','vouchers.delete','vouchers.post','vouchers.reverse','reports.view','accounting.view','accounting.manage','company.view','company.manage','bookings.view','bookings.manage']::text[] OR NOT perms<@root_md.ceiling THEN RAISE EXCEPTION 'PERMISSION_CEILING' USING ERRCODE='42501'; END IF;
 UPDATE roles SET name=btrim(req.payload->>'name'),description=req.payload->>'description',"permissionCodes"=perms,"isActive"=(req.payload->>'isActive')::boolean,version=version+1,"updatedAt"=clock_timestamp() WHERE id=r.id;
 ELSE
 target:=req.payload->>'targetUserId';IF target IN (actor,req."actorId") OR NOT r."isActive" OR NOT EXISTS(SELECT 1 FROM users u JOIN employee_account_bindings b ON b."userId"=u.id JOIN employees e ON e.id=b."employeeId" WHERE u.id=target AND u."isActive" AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted") OR (EXISTS(SELECT 1 FROM user_admin_events WHERE "targetUserId"=target AND action='PENDING_CREATED') AND NOT onboarding_verified_personal(target)) THEN RAISE EXCEPTION 'VERIFIED_INDEPENDENT_RECIPIENT_REQUIRED' USING ERRCODE='42501'; END IF;
 expires:=(req.payload->>'expiresAt')::timestamptz;IF expires IS NULL OR expires<=clock_timestamp() THEN RAISE EXCEPTION 'GRANT_EXPIRY_REQUIRED' USING ERRCODE='23514'; END IF;
 INSERT INTO authority_role_grants(id,"roleId","userId","mandateId","requestId","expiresAt") VALUES(gen_random_uuid()::text,r.id,target,root_md.id,req.id,expires);
 END IF;
 ELSIF req.operation='ROLE_REVOKE' THEN
 UPDATE authority_role_grants SET "revokedAt"=clock_timestamp(),version=version+1 WHERE id=req.payload->>'grantId' AND version=req."expectedVersion" AND "revokedAt" IS NULL AND "roleId" IN (SELECT id FROM roles WHERE "authorityCompanyId"=parent);IF NOT FOUND THEN RAISE EXCEPTION 'STALE_GRANT' USING ERRCODE='40001'; END IF;
 END IF;
 END IF;
 UPDATE authority_requests SET status=CASE WHEN command='APPROVE' THEN 'APPROVED' ELSE 'REJECTED' END,version=version+1,"reviewerId"=actor,"decisionReason"=data->>'reason',"decidedAt"=clock_timestamp() WHERE id=req.id RETURNING * INTO req;
 ELSE
 IF actor<>req."actorId" AND NOT COALESCE(md_actor,false) THEN RAISE EXCEPTION 'REQUEST_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF command='EXPIRE' AND req."expiresAt">clock_timestamp() THEN RAISE EXCEPTION 'NOT_EXPIRED' USING ERRCODE='23514'; END IF;
 UPDATE authority_requests SET status=CASE WHEN command='EXPIRE' THEN 'EXPIRED' ELSE 'CANCELLED' END,version=version+1,"decisionReason"=data->>'reason',"decidedAt"=clock_timestamp() WHERE id=req.id RETURNING * INTO req;
 END IF;outcome:=to_jsonb(req);
 ELSE RAISE EXCEPTION 'UNKNOWN_AUTHORITY_COMMAND' USING ERRCODE='23514'; END IF;
 rid:=gen_random_uuid()::text;
 INSERT INTO authority_events(id,"requestId","actorId",action,"entityId",snapshot) VALUES(rid,req.id,actor,command,COALESCE(outcome->'role'->>'id',req.id,outcome->>'id'),jsonb_build_object('before',prior,'after',outcome,'beforeRole',prior_role,'afterRole',(SELECT to_jsonb(ar) FROM roles ar WHERE ar.id=r.id)));
 INSERT INTO audit_events(id,"userId",action,"entityType","entityId",metadata) VALUES(gen_random_uuid()::text,actor,'AUTHORITY_'||command,'Authority',COALESCE(req.id,outcome->>'id'),jsonb_build_object('eventId',rid));
 RETURN outcome;
END $$;

CREATE FUNCTION onboarding_claim_budget() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE n int; BEGIN
 INSERT INTO onboarding_rates(key,"windowStartedAt",attempts) VALUES('claims',clock_timestamp(),1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN onboarding_rates."windowStartedAt"<clock_timestamp()-interval '1 minute' THEN 1 ELSE onboarding_rates.attempts+1 END,"windowStartedAt"=CASE WHEN onboarding_rates."windowStartedAt"<clock_timestamp()-interval '1 minute' THEN clock_timestamp() ELSE onboarding_rates."windowStartedAt" END RETURNING attempts INTO n;
 RETURN n<=120;END $$;
REVOKE ALL ON FUNCTION onboarding_claim_budget() FROM PUBLIC;

-- Deferred read-only administration audit validation runs after the bounded writer returns.
-- Preserve the exact guard body and do not grant table reads to the private principal.
ALTER FUNCTION hr_admin_audit_required() SECURITY DEFINER;
ALTER FUNCTION hr_admin_audit_required() SET search_path=pg_catalog,public,pg_temp;
REVOKE ALL ON FUNCTION hr_admin_audit_required() FROM PUBLIC;
