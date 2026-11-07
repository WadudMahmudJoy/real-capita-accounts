-- CreateEnum
CREATE TYPE "HrPermission" AS ENUM ('SYSTEM_ADMIN', 'HR_ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "adminVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "leave_categories" ADD COLUMN     "description" VARCHAR(1000),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" "HrPermission" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedById" TEXT,
    "revokedAt" TIMESTAMPTZ(3),
    "reason" VARCHAR(1000) NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_account_bindings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "verifiedById" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationReference" VARCHAR(1000) NOT NULL,
    "unboundById" TEXT,
    "unboundAt" TIMESTAMPTZ(3),

    CONSTRAINT "employee_account_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_admin_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_admin_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permissions_userId_code_idx" ON "user_permissions"("userId", "code");

-- CreateIndex
CREATE INDEX "employee_account_bindings_employeeId_idx" ON "employee_account_bindings"("employeeId");

-- CreateIndex
CREATE INDEX "user_admin_events_targetUserId_createdAt_idx" ON "user_admin_events"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employee_account_bindings" ADD CONSTRAINT "employee_account_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employee_account_bindings" ADD CONSTRAINT "employee_account_bindings_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employee_account_bindings" ADD CONSTRAINT "employee_account_bindings_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "employee_account_bindings" ADD CONSTRAINT "employee_account_bindings_unboundById_fkey" FOREIGN KEY ("unboundById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_admin_events" ADD CONSTRAINT "user_admin_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "user_admin_events" ADD CONSTRAINT "user_admin_events_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- BEGIN HR ADMIN INTEGRITY
CREATE UNIQUE INDEX user_permission_unreleased_unique ON user_permissions("userId",code) WHERE "revokedAt" IS NULL;
CREATE UNIQUE INDEX employee_binding_active_user_unique ON employee_account_bindings("userId") WHERE "unboundAt" IS NULL;
CREATE UNIQUE INDEX employee_binding_active_employee_unique ON employee_account_bindings("employeeId") WHERE "unboundAt" IS NULL;
ALTER TABLE user_permissions ADD CONSTRAINT user_permission_lifecycle CHECK ("userId"<>"grantedById" AND length(btrim(reason))>0 AND ("expiresAt" IS NULL OR "expiresAt">"grantedAt") AND (("revokedAt" IS NULL AND "revokedById" IS NULL) OR ("revokedAt" IS NOT NULL AND "revokedById" IS NOT NULL AND "revokedAt">="grantedAt" AND "revokedById"<>"userId")));
ALTER TABLE employee_account_bindings ADD CONSTRAINT employee_binding_lifecycle CHECK ("verifiedById"<>"userId" AND length(btrim("verificationReference"))>0 AND (("unboundAt" IS NULL AND "unboundById" IS NULL) OR ("unboundAt" IS NOT NULL AND "unboundById" IS NOT NULL AND "unboundAt">="verifiedAt" AND "unboundById"<>"userId")));
CREATE FUNCTION hr_authority_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Authority history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='user_permissions' THEN
  IF OLD."revokedAt" IS NOT NULL OR NEW."revokedAt" IS NULL OR (to_jsonb(NEW)-ARRAY['revokedAt','revokedById']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['revokedAt','revokedById']) THEN RAISE EXCEPTION 'Grant instructions immutable; explicit one-way revocation required' USING ERRCODE='23514'; END IF;
 ELSE
  IF OLD."unboundAt" IS NOT NULL OR NEW."unboundAt" IS NULL OR (to_jsonb(NEW)-ARRAY['unboundAt','unboundById']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['unboundAt','unboundById']) THEN RAISE EXCEPTION 'Binding history immutable; explicit release required' USING ERRCODE='23514'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER user_permission_history BEFORE UPDATE OR DELETE ON user_permissions FOR EACH ROW EXECUTE FUNCTION hr_authority_history_guard();
CREATE TRIGGER employee_binding_history BEFORE UPDATE OR DELETE ON employee_account_bindings FOR EACH ROW EXECUTE FUNCTION hr_authority_history_guard();
CREATE TRIGGER user_permission_no_truncate BEFORE TRUNCATE ON user_permissions FOR EACH STATEMENT EXECUTE FUNCTION leave_history_immutable();
CREATE TRIGGER employee_binding_no_truncate BEFORE TRUNCATE ON employee_account_bindings FOR EACH STATEMENT EXECUTE FUNCTION leave_history_immutable();
CREATE TRIGGER user_admin_event_immutable BEFORE UPDATE OR DELETE ON user_admin_events FOR EACH ROW EXECUTE FUNCTION leave_history_immutable();
CREATE TRIGGER user_admin_event_no_truncate BEFORE TRUNCATE ON user_admin_events FOR EACH STATEMENT EXECUTE FUNCTION leave_history_immutable();
ALTER TABLE users ADD CONSTRAINT user_admin_version_positive CHECK ("adminVersion">0);
ALTER TABLE leave_categories ADD CONSTRAINT leave_category_valid CHECK (code ~ '^[A-Z0-9_]{1,32}$' AND length(btrim(name))>0 AND version>0);
-- Bound employees may withdraw their own pending request even when HR submitted it.
ALTER TABLE leave_requests DROP CONSTRAINT leave_state_valid;
ALTER TABLE leave_requests ADD CONSTRAINT leave_state_valid CHECK (
 (status='SUBMITTED' AND version=1 AND "withdrawnById" IS NULL AND "withdrawnAt" IS NULL AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "decisionReason" IS NULL AND "reviewAuthoritySnapshot" IS NULL)
 OR (status='WITHDRAWN' AND version=2 AND "withdrawnById" IS NOT NULL AND "withdrawnAt" IS NOT NULL AND "withdrawnAt">="createdAt" AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "decisionReason" IS NULL AND "reviewAuthoritySnapshot" IS NULL)
 OR (status IN ('APPROVED','REJECTED') AND version=2 AND "withdrawnById" IS NULL AND "withdrawnAt" IS NULL AND "reviewedById" IS NOT NULL AND ("reviewedById"<>"createdById" OR COALESCE("identitySnapshot"->>'submissionMode','')='HR_ON_BEHALF') AND "reviewedAt" IS NOT NULL AND "reviewedAt">="createdAt" AND "decisionReason" IS NOT NULL AND length(btrim("decisionReason"))>0 AND "reviewAuthoritySnapshot" IS NOT NULL AND jsonb_typeof("reviewAuthoritySnapshot")='object' AND COALESCE(length("reviewAuthoritySnapshot"->>'revision'),0)>0 AND COALESCE(length("reviewAuthoritySnapshot"->>'reviewerEmployeeId'),0)>0 AND "reviewAuthoritySnapshot"->>'reviewerEmployeeId'<>"employeeId")
);
CREATE OR REPLACE FUNCTION leave_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE r leave_requests%ROWTYPE; prior jsonb; BEGIN
 SELECT * INTO r FROM leave_requests WHERE id=NEW."requestId";
 IF NOT FOUND OR NEW.version<>r.version OR NEW."actorId" IS DISTINCT FROM (CASE WHEN r.status IN ('APPROVED','REJECTED') THEN r."reviewedById" WHEN r.status='WITHDRAWN' THEN r."withdrawnById" ELSE r."createdById" END) OR NEW.action<>r.status::text OR jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Complete matching leave audit required' USING ERRCODE='23514'; END IF;
 -- Compare complete canonical stored rows, including private instructions and authority revisions.
 IF ((NEW.snapshot->'after')-ARRAY['createdAt','withdrawnAt','reviewedAt','startDate','endDate']) IS DISTINCT FROM (to_jsonb(r)-ARRAY['createdAt','withdrawnAt','reviewedAt','startDate','endDate']) OR (NEW.snapshot->'after'->>'startDate')::date IS DISTINCT FROM r."startDate" OR (NEW.snapshot->'after'->>'endDate')::date IS DISTINCT FROM r."endDate" OR (NEW.snapshot->'after'->>'createdAt')::timestamptz IS DISTINCT FROM r."createdAt" OR (NEW.snapshot->'after'->>'withdrawnAt')::timestamptz IS DISTINCT FROM r."withdrawnAt" OR (NEW.snapshot->'after'->>'reviewedAt')::timestamptz IS DISTINCT FROM r."reviewedAt" THEN RAISE EXCEPTION 'Complete leave after snapshot required' USING ERRCODE='23514'; END IF;
 IF r.version=2 THEN
  SELECT snapshot->'after' INTO prior FROM leave_request_events WHERE "requestId"=r.id AND version=1;
  IF prior IS NULL OR NEW.snapshot->'before' IS DISTINCT FROM prior THEN RAISE EXCEPTION 'Original pending history required' USING ERRCODE='23514'; END IF;
 ELSIF NEW.snapshot->'before' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Initial event has no prior state' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
-- Backend supplies authenticated actor IDs; these checks also reject nonexistent/unauthorized grantors.
-- Owner-only maintenance bootstrap is a separately authorized operational boundary, never an HTTP endpoint.
CREATE FUNCTION hr_admin_authority_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE actor text; BEGIN
 IF current_user=(SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename=TG_TABLE_NAME) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='user_permissions' THEN
  IF TG_OP='INSERT' THEN actor:=NEW."grantedById"; ELSE actor:=NEW."revokedById"; END IF;
 ELSE
  IF TG_OP='INSERT' THEN actor:=NEW."verifiedById"; ELSE actor:=NEW."unboundById"; END IF;
 END IF;
 IF actor IS DISTINCT FROM current_setting('real_capita.user_admin_actor',true) THEN RAISE EXCEPTION 'Authenticated administrator context required' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM user_permissions p JOIN users u ON u.id=p."userId" WHERE p."userId"=actor AND u."isActive" AND p.code='SYSTEM_ADMIN' AND p."revokedAt" IS NULL AND (p."expiresAt" IS NULL OR p."expiresAt">clock_timestamp())) THEN RAISE EXCEPTION 'Active designated administrator required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER user_permission_authority BEFORE INSERT OR UPDATE ON user_permissions FOR EACH ROW EXECUTE FUNCTION hr_admin_authority_guard();
CREATE TRIGGER employee_binding_authority BEFORE INSERT OR UPDATE ON employee_account_bindings FOR EACH ROW EXECUTE FUNCTION hr_admin_authority_guard();
CREATE UNIQUE INDEX user_admin_event_revision_unique ON user_admin_events("targetUserId",((snapshot->'after'->>'adminVersion')::int));
CREATE FUNCTION hr_admin_audit_required() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."adminVersion"<>OLD."adminVersion" AND NOT EXISTS(SELECT 1 FROM user_admin_events WHERE "targetUserId"=NEW.id AND (snapshot->'after'->>'adminVersion')::int=NEW."adminVersion") THEN RAISE EXCEPTION 'Atomic administration history required' USING ERRCODE='23514'; END IF;RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER hr_admin_audit_required AFTER UPDATE ON users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hr_admin_audit_required();
-- Transaction-local actor context is supplied only by guarded backend services;
-- it is NOT an independent PostgreSQL authentication mechanism.
CREATE FUNCTION hr_runtime_actor_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE actor text; required "HrPermission"; BEGIN
 IF current_user=(SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename=TG_TABLE_NAME) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_TABLE_NAME='users' AND TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['updatedAt','lastLoginAt']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['updatedAt','lastLoginAt']) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='leave_categories' THEN actor:=current_setting('real_capita.hr_actor',true);required:='HR_ADMIN'; ELSE actor:=current_setting('real_capita.user_admin_actor',true);required:='SYSTEM_ADMIN'; END IF;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM user_permissions p JOIN users u ON u.id=p."userId" WHERE p."userId"=actor AND u."isActive" AND p.code=required AND p."revokedAt" IS NULL AND (p."expiresAt" IS NULL OR p."expiresAt">clock_timestamp())) THEN RAISE EXCEPTION 'Explicit active backend authority required' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER hr_users_actor BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION hr_runtime_actor_guard();
CREATE TRIGGER hr_user_roles_actor BEFORE INSERT OR DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION hr_runtime_actor_guard();
CREATE TRIGGER hr_category_actor BEFORE INSERT OR UPDATE ON leave_categories FOR EACH ROW EXECUTE FUNCTION hr_runtime_actor_guard();
CREATE FUNCTION hr_leave_actor_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE actor text; bound_id text; bound_employee text; grant_id text; BEGIN
 IF current_user=(SELECT tableowner FROM pg_tables WHERE schemaname='public' AND tablename=TG_TABLE_NAME) OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN RETURN NEW; END IF;
 actor:=current_setting('real_capita.leave_actor',true);
 IF actor IS NULL THEN RAISE EXCEPTION 'Authenticated leave context required' USING ERRCODE='23514'; END IF;
 PERFORM id FROM users WHERE id=actor AND "isActive" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active leave identity required' USING ERRCODE='23514'; END IF;
 SELECT b.id,b."employeeId" INTO bound_id,bound_employee FROM employee_account_bindings b JOIN employees e ON e.id=b."employeeId" WHERE b."userId"=actor AND b."unboundAt" IS NULL AND e."isActive" AND NOT e."isDeleted";
 SELECT id INTO grant_id FROM user_permissions WHERE "userId"=actor AND code='HR_ADMIN' AND "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">clock_timestamp());
 IF TG_OP='INSERT' THEN
  IF NEW."createdById"<>actor OR (bound_employee IS DISTINCT FROM NEW."employeeId" AND grant_id IS NULL) THEN RAISE EXCEPTION 'Bound employee or explicit HR on-behalf authority required' USING ERRCODE='23514'; END IF;
 ELSIF NEW.status='WITHDRAWN' THEN
  IF NEW."withdrawnById"<>actor OR bound_employee IS DISTINCT FROM NEW."employeeId" THEN RAISE EXCEPTION 'Only the verified employee may withdraw' USING ERRCODE='23514'; END IF;
 ELSE
  IF grant_id IS NULL OR bound_id IS NULL OR NEW."reviewedById"<>actor OR (actor=NEW."createdById" AND COALESCE(NEW."identitySnapshot"->>'submissionMode','')<>'HR_ON_BEHALF') OR bound_employee=NEW."employeeId" OR NEW."reviewAuthoritySnapshot"->>'revision' IS DISTINCT FROM grant_id||':'||bound_id THEN RAISE EXCEPTION 'Current independent HR permission and binding revision required' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_leave_actor BEFORE INSERT OR UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION hr_leave_actor_guard();
-- Invoker trigger functions never confer ownership or schema privileges.
ALTER FUNCTION hr_authority_history_guard() SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION hr_admin_authority_guard() SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION hr_admin_audit_required() SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION hr_runtime_actor_guard() SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION hr_leave_actor_guard() SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION leave_event_guard() SET search_path=pg_catalog,public,pg_temp;
REVOKE ALL ON FUNCTION hr_authority_history_guard(),hr_admin_authority_guard(),hr_admin_audit_required(),hr_runtime_actor_guard(),hr_leave_actor_guard() FROM PUBLIC;
