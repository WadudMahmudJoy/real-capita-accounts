-- CreateTable
CREATE TABLE "leave_workflows" (
    "requestId" TEXT NOT NULL,
    "stage" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "leave_workflows_pkey" PRIMARY KEY ("requestId")
);

-- CreateTable
CREATE TABLE "leave_stage_decisions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stage" VARCHAR(8) NOT NULL,
    "actorId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "decision" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "requestVersion" INTEGER NOT NULL,
    "requestFingerprint" VARCHAR(32) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "authoritySnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_stage_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_workflows_stage_requestId_idx" ON "leave_workflows"("stage", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "leave_stage_decisions_idempotencyKey_key" ON "leave_stage_decisions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "leave_stage_decisions_actorId_createdAt_idx" ON "leave_stage_decisions"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "leave_stage_decisions_requestId_stage_key" ON "leave_stage_decisions"("requestId", "stage");

-- AddForeignKey
ALTER TABLE "leave_workflows" ADD CONSTRAINT "leave_workflows_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "leave_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_stage_decisions" ADD CONSTRAINT "leave_stage_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "leave_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_stage_decisions" ADD CONSTRAINT "leave_stage_decisions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_stage_decisions" ADD CONSTRAINT "leave_stage_decisions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_stage_decisions" ADD CONSTRAINT "leave_stage_decisions_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "employee_account_bindings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- BEGIN TWO STAGE LEAVE INTEGRITY

-- Depends on authority migration 18, not payment evidence migration 15.
ALTER TABLE leave_workflows ADD CONSTRAINT leave_workflow_state CHECK ((stage='PENDING_HR_REVIEW' AND version=1) OR (stage='PENDING_MD_DECISION' AND version=2) OR (stage='FINAL' AND version=3) OR (stage='WITHDRAWN' AND version=2));
ALTER TABLE leave_stage_decisions ADD CONSTRAINT leave_stage_contract CHECK ((stage='HR' AND decision IN ('RECOMMEND_APPROVAL','RECOMMEND_REJECTION') AND "requestVersion"=1) OR (stage='MD' AND decision IN ('APPROVED','REJECTED') AND "requestVersion"=2));
ALTER TABLE leave_stage_decisions ADD CONSTRAINT leave_stage_provenance CHECK (length(btrim(reason))>0 AND length("idempotencyKey") BETWEEN 8 AND 128 AND "requestFingerprint" ~ '^[a-f0-9]{32}$' AND jsonb_typeof("authoritySnapshot")='object');
ALTER TABLE leave_requests DROP CONSTRAINT leave_state_valid;
ALTER TABLE leave_requests ADD CONSTRAINT leave_state_valid CHECK (
 (status='SUBMITTED' AND version IN (1,2) AND "withdrawnById" IS NULL AND "withdrawnAt" IS NULL AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "decisionReason" IS NULL AND "reviewAuthoritySnapshot" IS NULL)
 OR (status='WITHDRAWN' AND version=2 AND "withdrawnById" IS NOT NULL AND "withdrawnAt" IS NOT NULL AND "withdrawnAt">="createdAt" AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "decisionReason" IS NULL AND "reviewAuthoritySnapshot" IS NULL)
 OR (status IN ('APPROVED','REJECTED') AND version IN (2,3) AND "withdrawnById" IS NULL AND "withdrawnAt" IS NULL AND "reviewedById" IS NOT NULL AND "reviewedById"<>"createdById" AND "reviewedAt" IS NOT NULL AND "reviewedAt">="createdAt" AND "decisionReason" IS NOT NULL AND length(btrim("decisionReason"))>0 AND "reviewAuthoritySnapshot" IS NOT NULL AND jsonb_typeof("reviewAuthoritySnapshot")='object' AND COALESCE(length("reviewAuthoritySnapshot"->>'revision'),0)>0 AND COALESCE(length("reviewAuthoritySnapshot"->>'reviewerEmployeeId'),0)>0 AND "reviewAuthoritySnapshot"->>'reviewerEmployeeId'<>"employeeId" AND (version=2 OR "reviewAuthoritySnapshot"->>'authority'='EXPLICIT_MD_FINAL'))
);
CREATE FUNCTION leave_workflow_owner_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF current_user<>(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Private leave writer required' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='leave_stage_decisions' AND TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Immutable leave stage evidence' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='leave_stage_decisions' THEN IF NEW."createdAt"<(SELECT "createdAt" FROM leave_requests WHERE id=NEW."requestId") OR (NEW.stage='MD' AND NEW."createdAt"<(SELECT "createdAt" FROM leave_stage_decisions WHERE "requestId"=NEW."requestId" AND stage='HR')) THEN RAISE EXCEPTION 'Impossible leave decision chronology' USING ERRCODE='23514';END IF;END IF;
 IF TG_TABLE_NAME='leave_workflows' THEN IF TG_OP='UPDATE' THEN IF (NEW."requestId"<>OLD."requestId" OR NEW.version<>OLD.version+1 OR NOT ((OLD.stage='PENDING_HR_REVIEW' AND NEW.stage IN ('PENDING_MD_DECISION','WITHDRAWN')) OR (OLD.stage='PENDING_MD_DECISION' AND NEW.stage='FINAL'))) THEN RAISE EXCEPTION 'Invalid leave workflow transition' USING ERRCODE='23514'; END IF; END IF; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER leave_workflow_owner BEFORE INSERT OR UPDATE OR DELETE ON leave_workflows FOR EACH ROW EXECUTE FUNCTION leave_workflow_owner_guard();
CREATE TRIGGER leave_stage_owner BEFORE INSERT OR UPDATE OR DELETE ON leave_stage_decisions FOR EACH ROW EXECUTE FUNCTION leave_workflow_owner_guard();
CREATE TRIGGER leave_workflow_no_truncate BEFORE TRUNCATE ON leave_workflows FOR EACH STATEMENT EXECUTE FUNCTION leave_history_immutable();
CREATE TRIGGER leave_stage_no_truncate BEFORE TRUNCATE ON leave_stage_decisions FOR EACH STATEMENT EXECUTE FUNCTION leave_history_immutable();
CREATE FUNCTION leave_workflow_start() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM authority_mandates m JOIN employee_account_bindings b ON b."userId"=m."userId" WHERE m.kind='MD' AND authority_live_mandate(m) AND b."unboundAt" IS NULL AND b."employeeId"=NEW."employeeId") THEN RAISE EXCEPTION 'MD_OWN_LEAVE_POLICY_REQUIRED' USING ERRCODE='42501'; END IF;
 INSERT INTO leave_workflows("requestId",stage,version) VALUES(NEW.id,'PENDING_HR_REVIEW',1);RETURN NULL;END $$;
CREATE TRIGGER leave_workflow_start AFTER INSERT ON leave_requests FOR EACH ROW EXECUTE FUNCTION leave_workflow_start();
CREATE OR REPLACE FUNCTION leave_request_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE w leave_workflows%ROWTYPE; BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'SUBMITTED' OR NEW.version<>1 OR NOT EXISTS(SELECT 1 FROM leave_categories WHERE id=NEW."categoryId" AND "isActive") THEN RAISE EXCEPTION 'Active category and initial submission required' USING ERRCODE='23514'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  SELECT * INTO w FROM leave_workflows WHERE "requestId"=OLD.id;
  IF w."requestId" IS NULL OR OLD.status<>'SUBMITTED' OR NEW.version<>OLD.version+1 OR (to_jsonb(NEW)-ARRAY['status','version','withdrawnById','withdrawnAt','reviewedById','reviewedAt','decisionReason','reviewAuthoritySnapshot']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','withdrawnById','withdrawnAt','reviewedById','reviewedAt','decisionReason','reviewAuthoritySnapshot']) THEN RAISE EXCEPTION 'Immutable original/final or legacy leave history' USING ERRCODE='23514'; END IF;
  IF NEW.status='WITHDRAWN' THEN
   IF w.stage<>'PENDING_HR_REVIEW' OR OLD.version<>1 THEN RAISE EXCEPTION 'Withdrawal after HR review is not authorized' USING ERRCODE='23514'; END IF;
  ELSIF current_user<>(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid=TG_RELID) THEN RAISE EXCEPTION 'Private HR/MD writer required' USING ERRCODE='42501';
  ELSIF NEW.status='SUBMITTED' AND OLD.version=1 AND w.stage='PENDING_HR_REVIEW' AND EXISTS(SELECT 1 FROM leave_stage_decisions WHERE "requestId"=OLD.id AND stage='HR' AND "requestVersion"=1) THEN NULL;
  ELSIF NEW.status IN ('APPROVED','REJECTED') AND OLD.version=2 AND w.stage='PENDING_MD_DECISION' AND EXISTS(SELECT 1 FROM leave_stage_decisions WHERE "requestId"=OLD.id AND stage='MD' AND decision=NEW.status::text AND "actorId"=NEW."reviewedById") THEN NULL;
  ELSE RAISE EXCEPTION 'HR recommendation and independent MD decision required' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Leave history cannot be deleted' USING ERRCODE='23514'; END IF; RETURN NEW;END $$;
CREATE FUNCTION leave_workflow_withdraw() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NEW.status='WITHDRAWN' THEN UPDATE leave_workflows SET stage='WITHDRAWN',version=NEW.version WHERE "requestId"=NEW.id;END IF; RETURN NULL;END $$;
CREATE TRIGGER leave_workflow_withdraw AFTER UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION leave_workflow_withdraw();
CREATE OR REPLACE FUNCTION leave_event_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$ DECLARE r leave_requests%ROWTYPE; prior jsonb; actor text; action text; BEGIN
 SELECT * INTO r FROM leave_requests WHERE id=NEW."requestId";
 actor:=CASE WHEN r.status='WITHDRAWN' THEN r."withdrawnById" WHEN r.status IN ('APPROVED','REJECTED') THEN r."reviewedById" WHEN r.status='SUBMITTED' AND r.version=2 THEN (SELECT "actorId" FROM leave_stage_decisions WHERE "requestId"=r.id AND stage='HR') ELSE r."createdById" END;
 action:=CASE WHEN r.status='SUBMITTED' AND r.version=2 THEN 'HR_RECOMMENDED' ELSE r.status::text END;
 IF r.id IS NULL OR NEW.version<>r.version OR NEW."actorId" IS DISTINCT FROM actor OR NEW.action<>action OR jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Matching leave stage history required' USING ERRCODE='23514';END IF;
 IF ((NEW.snapshot->'after')-ARRAY['createdAt','withdrawnAt','reviewedAt','startDate','endDate']) IS DISTINCT FROM (to_jsonb(r)-ARRAY['createdAt','withdrawnAt','reviewedAt','startDate','endDate']) OR (NEW.snapshot->'after'->>'startDate')::date IS DISTINCT FROM r."startDate" OR (NEW.snapshot->'after'->>'endDate')::date IS DISTINCT FROM r."endDate" OR (NEW.snapshot->'after'->>'createdAt')::timestamptz IS DISTINCT FROM r."createdAt" OR (NEW.snapshot->'after'->>'withdrawnAt')::timestamptz IS DISTINCT FROM r."withdrawnAt" OR (NEW.snapshot->'after'->>'reviewedAt')::timestamptz IS DISTINCT FROM r."reviewedAt" THEN RAISE EXCEPTION 'Complete canonical leave after snapshot required' USING ERRCODE='23514';END IF;
 IF r.version>1 THEN SELECT snapshot->'after' INTO prior FROM leave_request_events WHERE "requestId"=r.id AND version=r.version-1;IF prior IS NULL OR NEW.snapshot->'before' IS DISTINCT FROM prior THEN RAISE EXCEPTION 'Complete prior history required' USING ERRCODE='23514';END IF;
 ELSIF NEW.snapshot->'before' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Initial event cannot invent history' USING ERRCODE='23514';END IF;RETURN NEW;END $$;
-- This is a database-computed authority revision, never caller-supplied proof.
CREATE FUNCTION leave_hr_authority_revision(actor text) RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT encode(sha256(convert_to(COALESCE(string_agg(source,'|' ORDER BY source),''),'UTF8')),'hex') FROM (
 SELECT jsonb_build_object('mandate',m.id,'version',m.version,'ceiling',m.ceiling,'expires',extract(epoch from m."expiresAt"))::text source FROM authority_mandates m WHERE m."userId"=actor AND authority_live_mandate(m) AND (m.kind='MD' OR 'leave.recommend'=ANY(m.ceiling))
 UNION ALL SELECT jsonb_build_object('grant',g.id,'grantVersion',g.version,'role',r.id,'roleVersion',r.version,'permissions',r."permissionCodes",'mandate',m.id,'mandateVersion',m.version,'expires',extract(epoch from g."expiresAt"))::text FROM authority_role_grants g JOIN roles r ON r.id=g."roleId" JOIN authority_mandates m ON m.id=g."mandateId" WHERE g."userId"=actor AND g."revokedAt" IS NULL AND (g."expiresAt" IS NULL OR g."expiresAt">clock_timestamp()) AND r."isActive" AND r."authorityCompanyId"=m."companyId" AND r."permissionCodes"<@m.ceiling AND 'leave.recommend'=ANY(r."permissionCodes") AND authority_live_mandate(m)
 ) revisions $$;
REVOKE ALL ON FUNCTION leave_hr_authority_revision(text) FROM PUBLIC;
CREATE FUNCTION leave_stage_command(actor text, stage text, data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp SET timezone='UTC' AS $$
DECLARE parent text; r leave_requests%ROWTYPE; before_row jsonb; w leave_workflows%ROWTYPE; b employee_account_bindings%ROWTYPE; root authority_mandates%ROWTYPE; hr leave_stage_decisions%ROWTYPE; old_decision leave_stage_decisions%ROWTYPE; d leave_stage_decisions%ROWTYPE; grant_id text; fingerprint text; action text;
BEGIN
 SELECT id INTO parent FROM companies WHERE "singletonKey"='PRIMARY' AND "isActive";IF parent IS NULL THEN RAISE EXCEPTION 'Active PRIMARY required' USING ERRCODE='42501';END IF;
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

 IF stage NOT IN ('HR','MD') OR length(btrim(COALESCE(data->>'reason','')))=0 OR length(data->>'reason')>1000 OR length(COALESCE(data->>'idempotencyKey','')) NOT BETWEEN 8 AND 128 THEN RAISE EXCEPTION 'Explicit stage, reason and idempotency required' USING ERRCODE='23514';END IF;
 SELECT * INTO hr FROM leave_stage_decisions WHERE "requestId"=data->>'requestId' AND leave_stage_decisions.stage='HR';
 PERFORM id FROM users WHERE id IN (actor,hr."actorId") ORDER BY id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND "isActive") THEN RAISE EXCEPTION 'Active authenticated actor required' USING ERRCODE='42501';END IF;
 PERFORM b2.id FROM employee_account_bindings b2 WHERE b2."userId" IN (actor,hr."actorId") AND b2."unboundAt" IS NULL ORDER BY b2.id FOR SHARE;
 PERFORM p.id FROM user_permissions p WHERE p."userId" IN (actor,hr."actorId") AND p.code='HR_ADMIN' ORDER BY p.id FOR SHARE;
 SELECT b1.* INTO b FROM employee_account_bindings b1 JOIN employees e ON e.id=b1."employeeId" WHERE b1."userId"=actor AND b1."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted" FOR SHARE OF b1;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Verified active personal binding required' USING ERRCODE='42501';END IF;
 IF stage='HR' THEN
  SELECT id INTO grant_id FROM user_permissions WHERE "userId"=actor AND code='HR_ADMIN' AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">clock_timestamp());
  IF grant_id IS NULL OR NOT ('leave.recommend'=ANY(authority_effective(actor))) OR data->>'decision' NOT IN ('RECOMMEND_APPROVAL','RECOMMEND_REJECTION') THEN RAISE EXCEPTION 'Current explicit HR recommendation authority required' USING ERRCODE='42501';END IF;
 ELSE
  SELECT * INTO root FROM authority_mandates m WHERE m."userId"=actor AND m.kind='MD' AND authority_live_mandate(m);
  IF root.id IS NULL OR NOT ('leave.finalize'=ANY(authority_effective(actor))) OR data->>'decision' NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'Protected MD final authority required' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO old_decision FROM leave_stage_decisions WHERE "idempotencyKey"=data->>'idempotencyKey';
 IF old_decision.id IS NOT NULL THEN
  IF old_decision."actorId"<>actor OR old_decision."requestId" IS DISTINCT FROM data->>'requestId' OR old_decision.stage<>stage OR old_decision.decision IS DISTINCT FROM data->>'decision' OR old_decision.reason IS DISTINCT FROM btrim(data->>'reason') OR old_decision."requestVersion" IS DISTINCT FROM (data->>'expectedVersion')::int THEN RAISE EXCEPTION 'Conflicting idempotent leave instructions' USING ERRCODE='40001';END IF;
  RETURN jsonb_build_object('decisionId',old_decision.id,'requestId',old_decision."requestId",'replayed',true);
 END IF;
 SELECT * INTO r FROM leave_requests WHERE id=data->>'requestId' AND "companyId"=parent FOR UPDATE;
 SELECT * INTO w FROM leave_workflows WHERE "requestId"=r.id FOR UPDATE;
 IF r.id IS NULL OR w."requestId" IS NULL OR r.status<>'SUBMITTED' OR r.version IS DISTINCT FROM (data->>'expectedVersion')::int OR w.version<>r.version THEN RAISE EXCEPTION 'Missing, legacy, final or stale leave workflow' USING ERRCODE='40001';END IF;
 IF b."employeeId"=r."employeeId" THEN RAISE EXCEPTION 'Self review or MD own leave prohibited' USING ERRCODE='42501';END IF;
 PERFORM id FROM employees WHERE id=r."employeeId" AND "isActive" AND NOT "isDeleted" AND "joiningDate"<=r."startDate" AND ("separationDate" IS NULL OR r."endDate"<"separationDate") FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Leave employment source changed' USING ERRCODE='42501';END IF;
 fingerprint:=md5((to_jsonb(r)-ARRAY['version','status','withdrawnById','withdrawnAt','reviewedById','reviewedAt','decisionReason','reviewAuthoritySnapshot'])::text);SELECT snapshot->'after' INTO before_row FROM leave_request_events WHERE "requestId"=r.id AND version=r.version;IF before_row IS NULL THEN RAISE EXCEPTION 'Complete previous immutable history required' USING ERRCODE='23514';END IF;
 IF stage='HR' THEN
  IF w.stage<>'PENDING_HR_REVIEW' OR r.version<>1 THEN RAISE EXCEPTION 'One HR recommendation only' USING ERRCODE='40001';END IF;
 ELSE
  IF w.stage<>'PENDING_MD_DECISION' OR r.version<>2 OR hr.id IS NULL OR hr."requestFingerprint"<>fingerprint OR actor IN (hr."actorId",r."createdById") THEN RAISE EXCEPTION 'Independent MD requires unchanged HR recommendation' USING ERRCODE='42501';END IF;
  IF NOT EXISTS(SELECT 1 FROM users u JOIN employee_account_bindings hb ON hb."userId"=u.id JOIN employees e ON e.id=hb."employeeId" JOIN user_permissions hp ON hp."userId"=u.id WHERE u.id=hr."actorId" AND u."isActive" AND hb.id=hr."bindingId" AND hb."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted" AND hp.id=hr."authoritySnapshot"->>'permissionId' AND hp.code='HR_ADMIN' AND hp."revokedAt" IS NULL AND (hp."expiresAt" IS NULL OR hp."expiresAt">clock_timestamp())) OR NOT ('leave.recommend'=ANY(authority_effective(hr."actorId"))) OR hr."authoritySnapshot"->>'authorityRevision' IS DISTINCT FROM leave_hr_authority_revision(hr."actorId") THEN RAISE EXCEPTION 'HR recommendation authority changed; auditable revision required' USING ERRCODE='42501';END IF;
 END IF;
 INSERT INTO leave_stage_decisions(id,"requestId",stage,"actorId","employeeId","bindingId",decision,reason,"requestVersion","requestFingerprint","idempotencyKey","authoritySnapshot","createdAt") VALUES(gen_random_uuid()::text,r.id,stage,actor,b."employeeId",b.id,data->>'decision',btrim(data->>'reason'),r.version,fingerprint,data->>'idempotencyKey',jsonb_build_object('authorityRevision',CASE WHEN stage='HR' THEN leave_hr_authority_revision(actor) ELSE NULL END,'permissionId',grant_id,'mandateId',root.id,'bindingId',b.id,'actorName',(SELECT "fullName" FROM users WHERE id=actor)),clock_timestamp()) RETURNING * INTO d;
 IF stage='HR' THEN
  UPDATE leave_requests SET version=2 WHERE id=r.id RETURNING * INTO r;
  UPDATE leave_workflows SET stage='PENDING_MD_DECISION',version=2 WHERE "requestId"=r.id;action:='HR_RECOMMENDED';
 ELSE
  UPDATE leave_requests SET status=(data->>'decision')::"LeaveRequestStatus",version=3,"reviewedById"=actor,"reviewedAt"=d."createdAt","decisionReason"=d.reason,"reviewAuthoritySnapshot"=jsonb_build_object('revision',root.id,'reviewerEmployeeId',b."employeeId",'reviewerName',(SELECT "fullName" FROM users WHERE id=actor),'authority','EXPLICIT_MD_FINAL','hrDecisionId',hr.id) WHERE id=r.id RETURNING * INTO r;
  UPDATE leave_workflows SET stage='FINAL',version=3 WHERE "requestId"=r.id;action:=r.status::text;
 END IF;
 INSERT INTO leave_request_events(id,"requestId","actorId",action,version,snapshot,"createdAt") VALUES(gen_random_uuid()::text,r.id,actor,action,r.version,jsonb_build_object('before',before_row,'after',to_jsonb(r),'stageDecisionId',d.id),d."createdAt");
 INSERT INTO audit_events(id,"userId",action,"entityType","entityId",metadata,"createdAt") VALUES(gen_random_uuid()::text,actor,'LEAVE_'||stage||'_DECISION','LeaveRequest',r.id,jsonb_build_object('decisionId',d.id,'version',r.version),d."createdAt" AT TIME ZONE 'UTC');
 RETURN jsonb_build_object('decisionId',d.id,'requestId',r.id,'version',r.version,'replayed',false);
END $$;
CREATE FUNCTION leave_stage_audit_required() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM audit_events WHERE "entityType"='LeaveRequest' AND "entityId"=NEW."requestId" AND "userId"=NEW."actorId" AND metadata->>'decisionId'=NEW.id AND action='LEAVE_'||NEW.stage||'_DECISION') OR NOT EXISTS(SELECT 1 FROM leave_request_events WHERE "requestId"=NEW."requestId" AND version=NEW."requestVersion"+1 AND snapshot->>'stageDecisionId'=NEW.id) THEN RAISE EXCEPTION 'Atomic stage and global audit required' USING ERRCODE='23514';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER leave_stage_audit_required AFTER INSERT ON leave_stage_decisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION leave_stage_audit_required();
REVOKE ALL ON FUNCTION leave_stage_command(text,text,jsonb),leave_workflow_start(),leave_workflow_withdraw(),leave_workflow_owner_guard(),leave_stage_audit_required() FROM PUBLIC;

-- Deferred read-only audit checks execute at COMMIT after the bounded writer
-- returns. Keep the writer table-less; the fixed-path trigger reads as owner.
ALTER FUNCTION leave_event_required() SECURITY DEFINER;
ALTER FUNCTION leave_event_required() SET search_path=pg_catalog,public,pg_temp;
REVOKE ALL ON FUNCTION leave_event_required() FROM PUBLIC;

ALTER TABLE leave_stage_decisions ADD CONSTRAINT leave_stage_source_revision CHECK (
 (stage='HR' AND "authoritySnapshot" ? 'authorityRevision' AND jsonb_typeof("authoritySnapshot"->'authorityRevision')='string' AND "authoritySnapshot"->>'authorityRevision' ~ '^[a-f0-9]{64}$' AND "authoritySnapshot" ? 'permissionId' AND jsonb_typeof("authoritySnapshot"->'permissionId')='string')
 OR (stage='MD' AND "authoritySnapshot" ? 'mandateId' AND jsonb_typeof("authoritySnapshot"->'mandateId')='string')
);
