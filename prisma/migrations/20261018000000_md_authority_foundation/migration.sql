-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "authorityCompanyId" TEXT,
ADD COLUMN     "createdUnderId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permissionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "authority_bootstraps" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "authorizerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "purpose" TEXT NOT NULL,
    "provenance" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authority_bootstraps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authority_mandates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ceiling" TEXT[],
    "bootstrapId" TEXT,
    "requestId" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "authority_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authority_role_grants" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "authority_role_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authority_requests" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "expectedVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "decisionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedAt" TIMESTAMPTZ(3),

    CONSTRAINT "authority_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authority_events" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authority_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "authority_bootstraps_tokenHash_key" ON "authority_bootstraps"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "authority_mandates_bootstrapId_key" ON "authority_mandates"("bootstrapId");

-- CreateIndex
CREATE UNIQUE INDEX "authority_mandates_requestId_key" ON "authority_mandates"("requestId");

-- CreateIndex
CREATE INDEX "authority_mandates_userId_idx" ON "authority_mandates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "authority_role_grants_requestId_key" ON "authority_role_grants"("requestId");

-- CreateIndex
CREATE INDEX "authority_role_grants_userId_idx" ON "authority_role_grants"("userId");

-- CreateIndex
CREATE INDEX "authority_requests_companyId_status_createdAt_idx" ON "authority_requests"("companyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "authority_requests_actorId_idempotencyKey_key" ON "authority_requests"("actorId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "authority_events_entityId_createdAt_idx" ON "authority_events"("entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_authorityCompanyId_fkey" FOREIGN KEY ("authorityCompanyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_createdUnderId_fkey" FOREIGN KEY ("createdUnderId") REFERENCES "authority_mandates"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_bootstraps" ADD CONSTRAINT "authority_bootstraps_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_bootstraps" ADD CONSTRAINT "authority_bootstraps_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_bootstraps" ADD CONSTRAINT "authority_bootstraps_authorizerId_fkey" FOREIGN KEY ("authorizerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_mandates" ADD CONSTRAINT "authority_mandates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_mandates" ADD CONSTRAINT "authority_mandates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_mandates" ADD CONSTRAINT "authority_mandates_bootstrapId_fkey" FOREIGN KEY ("bootstrapId") REFERENCES "authority_bootstraps"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_mandates" ADD CONSTRAINT "authority_mandates_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "authority_requests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_role_grants" ADD CONSTRAINT "authority_role_grants_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_role_grants" ADD CONSTRAINT "authority_role_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_role_grants" ADD CONSTRAINT "authority_role_grants_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "authority_mandates"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_role_grants" ADD CONSTRAINT "authority_role_grants_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "authority_requests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_requests" ADD CONSTRAINT "authority_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_requests" ADD CONSTRAINT "authority_requests_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_requests" ADD CONSTRAINT "authority_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_events" ADD CONSTRAINT "authority_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "authority_requests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "authority_events" ADD CONSTRAINT "authority_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- BEGIN AUTHORITY INTEGRITY

ALTER TABLE authority_bootstraps ADD CONSTRAINT authority_bootstrap_contract CHECK ("targetUserId"<>"authorizerId" AND purpose IN ('ACTIVATE','REVOKE') AND "tokenHash" ~ '^[0-9a-f]{64}$' AND "expiresAt">"createdAt" AND ("consumedAt" IS NULL OR "consumedAt">="createdAt") AND jsonb_typeof(provenance)='object');
ALTER TABLE authority_mandates ADD CONSTRAINT authority_mandate_contract CHECK (kind IN ('MD','DELEGATE') AND version>0 AND ((kind='MD' AND "bootstrapId" IS NOT NULL AND "requestId" IS NULL) OR (kind='DELEGATE' AND "bootstrapId" IS NULL AND "requestId" IS NOT NULL)) AND ceiling IS NOT NULL AND ceiling <@ ARRAY['dashboard.view','roles.view','roles.manage','users.view','users.create','users.manage','employees.view','employees.create','employees.edit','departments.view','departments.create','departments.edit','attendance.view','attendance.edit','attendance.approve','attendance.manage','schedules.view','schedules.manage','leave.view','leave.create','leave.withdraw','leave.review','leave.recommend','leave.history.view','leave.categories.manage','payroll.view','payroll.preview','payroll.create','payroll.approve','payroll.documents.view','payroll.preparation.view','payroll.batches.create','salary.view','salary.manage','salary.approve','salary.preview','projects.view','projects.create','projects.edit','cost-centers.view','cost-centers.create','cost-centers.edit','vouchers.view','vouchers.create','vouchers.edit','vouchers.delete','vouchers.post','vouchers.reverse','reports.view','accounting.view','accounting.manage','company.view','company.manage','bookings.view','bookings.manage']::text[]);
CREATE UNIQUE INDEX authority_one_initial_md ON authority_mandates("companyId") WHERE kind='MD';
CREATE UNIQUE INDEX authority_active_delegate ON authority_mandates("companyId","userId") WHERE kind='DELEGATE' AND "revokedAt" IS NULL;
CREATE UNIQUE INDEX authority_active_role_grant ON authority_role_grants("roleId","userId") WHERE "revokedAt" IS NULL;
ALTER TABLE authority_role_grants ADD CONSTRAINT authority_grant_version CHECK(version>0);
ALTER TABLE roles ADD CONSTRAINT authority_role_contract CHECK (version>0 AND ("authorityCompanyId" IS NULL OR ("createdUnderId" IS NOT NULL AND code NOT IN ('ACCOUNTANT','SYSTEM_ADMIN','HR_ADMIN','MD','AGM','HR') AND "permissionCodes" IS NOT NULL AND "permissionCodes" <@ ARRAY['dashboard.view','roles.view','users.view','users.create','users.manage','employees.view','employees.create','employees.edit','departments.view','departments.create','departments.edit','attendance.view','attendance.edit','attendance.approve','attendance.manage','schedules.view','schedules.manage','leave.view','leave.create','leave.withdraw','leave.review','leave.recommend','leave.history.view','leave.categories.manage','payroll.view','payroll.preview','payroll.create','payroll.approve','payroll.documents.view','payroll.preparation.view','payroll.batches.create','salary.view','salary.manage','salary.approve','salary.preview','projects.view','projects.create','projects.edit','cost-centers.view','cost-centers.create','cost-centers.edit','vouchers.view','vouchers.create','vouchers.edit','vouchers.delete','vouchers.post','vouchers.reverse','reports.view','accounting.view','accounting.manage','company.view','company.manage','bookings.view','bookings.manage']::text[])));
ALTER TABLE authority_requests ADD CONSTRAINT authority_request_contract CHECK(operation IN ('DELEGATE','DELEGATE_REVOKE','ROLE_CREATE','ROLE_EDIT','ROLE_ASSIGN','ROLE_REVOKE') AND status IN ('PENDING','APPLIED','APPROVED','REJECTED','CANCELLED','EXPIRED') AND jsonb_typeof(payload)='object' AND length(btrim(reason))>0 AND "expiresAt">"createdAt" AND version>0 AND "expectedVersion">=0 AND ("reviewerId" IS NULL OR "reviewerId"<>"actorId") AND ("decisionReason" IS NULL OR length(btrim("decisionReason"))>0) AND ("decidedAt" IS NULL OR "decidedAt">="createdAt") AND ((status='PENDING' AND "decidedAt" IS NULL) OR (status<>'PENDING' AND "decidedAt" IS NOT NULL)) AND (status NOT IN ('APPROVED','REJECTED') OR "reviewerId" IS NOT NULL));
CREATE FUNCTION authority_live_mandate(m authority_mandates) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$ SELECT (m.kind='MD' OR EXISTS(SELECT 1 FROM authority_mandates root JOIN users ru ON ru.id=root."userId" WHERE root."companyId"=m."companyId" AND root.kind='MD' AND root."revokedAt" IS NULL AND ru."isActive" AND EXISTS(SELECT 1 FROM employee_account_bindings rb WHERE rb."userId"=ru.id AND rb."unboundAt" IS NULL))) AND m."revokedAt" IS NULL AND (m."expiresAt" IS NULL OR m."expiresAt">clock_timestamp()) AND EXISTS(SELECT 1 FROM users u JOIN employee_account_bindings b ON b."userId"=u.id JOIN employees e ON e.id=b."employeeId" WHERE u.id=m."userId" AND u."isActive" AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted") AND EXISTS(SELECT 1 FROM companies c WHERE c.id=m."companyId" AND c."singletonKey"='PRIMARY' AND c."isActive") $$;
CREATE FUNCTION authority_effective(actor text) RETURNS text[] LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT COALESCE(array_agg(DISTINCT p),'{}'::text[]) FROM (
 SELECT unnest(CASE WHEN m.kind='MD' THEN ARRAY['dashboard.view','roles.view','roles.manage','authority.review','authority.delegate','users.view','users.create','users.manage','employees.view','employees.create','employees.edit','departments.view','departments.create','departments.edit','attendance.view','attendance.edit','attendance.approve','attendance.manage','schedules.view','schedules.manage','leave.view','leave.create','leave.withdraw','leave.review','leave.recommend','leave.history.view','leave.md.view','leave.finalize','leave.categories.manage','payroll.view','payroll.preview','payroll.create','payroll.approve','payroll.documents.view','payroll.preparation.view','payroll.batches.create','salary.view','salary.manage','salary.approve','salary.preview','projects.view','projects.create','projects.edit','cost-centers.view','cost-centers.create','cost-centers.edit','vouchers.view','vouchers.create','vouchers.edit','vouchers.delete','vouchers.post','vouchers.reverse','reports.view','accounting.view','accounting.manage','company.view','company.manage','bookings.view','bookings.manage']::text[] ELSE m.ceiling END) p FROM authority_mandates m WHERE m."userId"=actor AND authority_live_mandate(m)
 UNION ALL SELECT unnest(r."permissionCodes") FROM authority_role_grants g JOIN roles r ON r.id=g."roleId" JOIN authority_mandates m ON m.id=g."mandateId" WHERE g."userId"=actor AND g."revokedAt" IS NULL AND (g."expiresAt" IS NULL OR g."expiresAt">clock_timestamp()) AND r."isActive" AND r."authorityCompanyId"=m."companyId" AND r."permissionCodes"<@m.ceiling AND authority_live_mandate(m) AND EXISTS(SELECT 1 FROM users u JOIN employee_account_bindings b ON b."userId"=u.id JOIN employees e ON e.id=b."employeeId" WHERE u.id=actor AND u."isActive" AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted")
 ) q $$;
CREATE FUNCTION authority_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'Immutable authority history' USING ERRCODE='23514'; END $$;
CREATE TRIGGER authority_events_immutable BEFORE UPDATE OR DELETE ON authority_events FOR EACH ROW EXECUTE FUNCTION authority_immutable();
CREATE FUNCTION authority_owner_only() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF current_user<>(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN RAISE EXCEPTION 'Private authority writer required' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Authority history cannot be deleted' USING ERRCODE='23514'; END IF;
 RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['authority_bootstraps','authority_mandates','authority_role_grants','authority_requests','authority_events'] LOOP EXECUTE format('CREATE TRIGGER authority_owner_only BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION authority_owner_only()',t); END LOOP; END $$;
CREATE FUNCTION authority_legacy_boundary() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD') AND current_user<>(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN
 IF TG_TABLE_NAME='users' AND TG_OP='UPDATE' THEN
 IF EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD' AND "userId"=OLD.id) AND (NEW."isActive" IS DISTINCT FROM OLD."isActive" OR NEW.email IS DISTINCT FROM OLD.email) THEN RAISE EXCEPTION 'MD identity changes require independent private ceremony' USING ERRCODE='42501'; END IF;
 ELSE RAISE EXCEPTION 'MD permission routing integration required; legacy elevation closed' USING ERRCODE='42501'; END IF;
 END IF;RETURN NEW; END $$;
CREATE TRIGGER authority_legacy_permission_boundary BEFORE INSERT ON user_permissions FOR EACH ROW EXECUTE FUNCTION authority_legacy_boundary();
CREATE TRIGGER authority_legacy_role_boundary BEFORE INSERT ON user_roles FOR EACH ROW EXECUTE FUNCTION authority_legacy_boundary();
CREATE TRIGGER authority_user_provision_boundary BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION authority_legacy_boundary();
CREATE TRIGGER authority_binding_boundary BEFORE INSERT OR UPDATE ON employee_account_bindings FOR EACH ROW EXECUTE FUNCTION authority_legacy_boundary();
CREATE TRIGGER authority_md_identity_boundary BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION authority_legacy_boundary();
CREATE FUNCTION authority_command(actor text, command text, data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
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
 IF EXISTS(SELECT 1 FROM user_admin_events WHERE "targetUserId"=actor AND action='PENDING_CREATED') OR NOT EXISTS(SELECT 1 FROM employee_account_bindings b JOIN employees e ON e.id=b."employeeId" WHERE b."userId"=actor AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted") THEN RAISE EXCEPTION 'VERIFIED_PERSONAL_IDENTITY_REQUIRED' USING ERRCODE='42501'; END IF;
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
 target:=req.payload->>'targetUserId';IF target IN (actor,req."actorId") OR NOT r."isActive" OR NOT EXISTS(SELECT 1 FROM users u JOIN employee_account_bindings b ON b."userId"=u.id JOIN employees e ON e.id=b."employeeId" WHERE u.id=target AND u."isActive" AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted") OR EXISTS(SELECT 1 FROM user_admin_events WHERE "targetUserId"=target AND action='PENDING_CREATED') THEN RAISE EXCEPTION 'VERIFIED_INDEPENDENT_RECIPIENT_REQUIRED' USING ERRCODE='42501'; END IF;
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
REVOKE ALL ON authority_bootstraps,authority_mandates,authority_role_grants,authority_requests,authority_events FROM PUBLIC;
REVOKE ALL ON FUNCTION authority_command(text,text,jsonb),authority_live_mandate(authority_mandates),authority_effective(text),authority_immutable(),authority_owner_only(),authority_legacy_boundary() FROM PUBLIC;

-- The new MD routing policy overlaps the established HR-only leave decision.
-- Keep that transition closed after MD initialization until the combined contract
-- is implemented; payroll retains its separate approved maker-checker policy.
CREATE FUNCTION authority_leave_boundary() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.status IN ('APPROVED','REJECTED') AND EXISTS(SELECT 1 FROM authority_mandates WHERE kind='MD') AND current_user<>(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN RAISE EXCEPTION 'MD_LEAVE_ROUTING_CONTRACT_REQUIRED' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE TRIGGER authority_leave_boundary BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION authority_leave_boundary();
REVOKE ALL ON FUNCTION authority_leave_boundary() FROM PUBLIC;

CREATE FUNCTION authority_md_personnel_boundary() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF (NOT NEW."isActive" OR NEW."isDeleted") AND EXISTS(SELECT 1 FROM authority_mandates m JOIN employee_account_bindings b ON b."userId"=m."userId" WHERE m.kind='MD' AND m."revokedAt" IS NULL AND b."unboundAt" IS NULL AND b."employeeId"=OLD.id) AND current_user<>(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN RAISE EXCEPTION 'Independent MD identity ceremony required' USING ERRCODE='42501'; END IF; RETURN NEW; END $$;
CREATE TRIGGER authority_md_personnel_boundary BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION authority_md_personnel_boundary();
REVOKE ALL ON FUNCTION authority_md_personnel_boundary() FROM PUBLIC;
