-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('SUBMITTED', 'WITHDRAWN', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "leave_categories" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "leave_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "withdrawnById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "decisionReason" VARCHAR(1000),
    "reviewAuthoritySnapshot" JSONB,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "supportingReference" VARCHAR(500),
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "identitySnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ(3),

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request_events" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_categories_code_key" ON "leave_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "leave_requests_idempotencyKey_key" ON "leave_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_startDate_endDate_idx" ON "leave_requests"("employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "leave_requests_createdById_status_createdAt_idx" ON "leave_requests"("createdById", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "leave_request_events_requestId_version_key" ON "leave_request_events"("requestId", "version");

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "leave_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_events" ADD CONSTRAINT "leave_request_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "leave_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_request_events" ADD CONSTRAINT "leave_request_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- BEGIN LEAVE INTEGRITY
-- Central owner is PRIMARY. Configured Company records may be optional reporting
-- context only; there is no Employee-office assignment relationship to infer.
CREATE FUNCTION leave_parent_context_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent companies%ROWTYPE; context jsonb; reporting companies%ROWTYPE;
BEGIN
 SELECT * INTO parent FROM companies WHERE "singletonKey"='PRIMARY' FOR SHARE;
 IF parent.id IS NULL OR NOT parent."isActive" OR NEW."companyId" IS DISTINCT FROM parent.id THEN RAISE EXCEPTION 'Active PRIMARY leave ownership required' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW."identitySnapshot"->'owningCompany' IS DISTINCT FROM jsonb_build_object('id',parent.id,'name',parent.name,'legalName',parent."legalName",'marker','PRIMARY') OR NOT (NEW."identitySnapshot" ? 'officeContext') THEN RAISE EXCEPTION 'Verified historical PRIMARY snapshot required' USING ERRCODE='23514'; END IF;
  context:=NEW."identitySnapshot"->'officeContext';
  IF context IS DISTINCT FROM 'null'::jsonb THEN
   IF jsonb_typeof(context) IS DISTINCT FROM 'object' OR context->'reportingOnly' IS DISTINCT FROM 'true'::jsonb OR context->'assignmentVerified' IS DISTINCT FROM 'false'::jsonb THEN RAISE EXCEPTION 'Reporting context is non-authoritative' USING ERRCODE='23514'; END IF;
   SELECT * INTO reporting FROM companies WHERE id=context->>'companyId' FOR SHARE;
   IF reporting.id IS NULL OR NOT reporting."isActive" OR context->>'name' IS DISTINCT FROM reporting.name THEN RAISE EXCEPTION 'Active configured reporting Company required' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION leave_parent_context_guard() SET search_path=pg_catalog,public,pg_temp;
REVOKE ALL ON FUNCTION leave_parent_context_guard() FROM PUBLIC;
CREATE TRIGGER leave_parent_context BEFORE INSERT OR UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION leave_parent_context_guard();
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE leave_requests ADD CONSTRAINT leave_dates_valid CHECK ("startDate" <= "endDate" AND length(btrim(reason))>0 AND jsonb_typeof("identitySnapshot")='object');
ALTER TABLE leave_requests ADD CONSTRAINT leave_state_valid CHECK (
 (status='SUBMITTED' AND version=1 AND "withdrawnById" IS NULL AND "withdrawnAt" IS NULL AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "decisionReason" IS NULL AND "reviewAuthoritySnapshot" IS NULL)
 OR (status='WITHDRAWN' AND version=2 AND "withdrawnById"="createdById" AND "withdrawnById" IS NOT NULL AND "withdrawnAt" IS NOT NULL AND "withdrawnAt">="createdAt" AND "reviewedById" IS NULL AND "reviewedAt" IS NULL AND "decisionReason" IS NULL AND "reviewAuthoritySnapshot" IS NULL)
 OR (status IN ('APPROVED','REJECTED') AND version=2 AND "withdrawnById" IS NULL AND "withdrawnAt" IS NULL AND "reviewedById" IS NOT NULL AND "reviewedById"<>"createdById" AND "reviewedAt" IS NOT NULL AND "reviewedAt">="createdAt" AND "decisionReason" IS NOT NULL AND length(btrim("decisionReason"))>0 AND "reviewAuthoritySnapshot" IS NOT NULL AND jsonb_typeof("reviewAuthoritySnapshot")='object' AND COALESCE(length("reviewAuthoritySnapshot"->>'revision'),0)>0 AND COALESCE(length("reviewAuthoritySnapshot"->>'reviewerEmployeeId'),0)>0 AND "reviewAuthoritySnapshot"->>'reviewerEmployeeId'<>"employeeId")
);
-- Pending and approved dates remain reserved; rejected/withdrawn requests retain history.
ALTER TABLE leave_requests ADD CONSTRAINT leave_employee_range_no_overlap EXCLUDE USING gist ("employeeId" WITH =,daterange("startDate","endDate",'[]') WITH &&) WHERE (status IN ('SUBMITTED','APPROVED'));
CREATE FUNCTION leave_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'SUBMITTED' OR NOT EXISTS(SELECT 1 FROM leave_categories WHERE id=NEW."categoryId" AND "isActive") THEN RAISE EXCEPTION 'Supported active leave category and submission required' USING ERRCODE='23514'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF OLD.status<>'SUBMITTED' OR NEW.status NOT IN ('WITHDRAWN','APPROVED','REJECTED') OR NEW.version<>OLD.version+1 OR (to_jsonb(NEW)-ARRAY['status','version','withdrawnById','withdrawnAt','reviewedById','reviewedAt','decisionReason','reviewAuthoritySnapshot']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','withdrawnById','withdrawnAt','reviewedById','reviewedAt','decisionReason','reviewAuthoritySnapshot']) THEN RAISE EXCEPTION 'Only durable pending request decisions or withdrawal are permitted' USING ERRCODE='23514'; END IF;
 ELSE RAISE EXCEPTION 'Leave history cannot be deleted' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER leave_request_guard BEFORE INSERT OR UPDATE OR DELETE ON leave_requests FOR EACH ROW EXECUTE FUNCTION leave_request_guard();
CREATE FUNCTION leave_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Leave audit history is immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER leave_events_immutable BEFORE UPDATE OR DELETE ON leave_request_events FOR EACH ROW EXECUTE FUNCTION leave_history_immutable();
CREATE TRIGGER leave_events_no_truncate BEFORE TRUNCATE ON leave_request_events FOR EACH STATEMENT EXECUTE FUNCTION leave_history_immutable();
CREATE TRIGGER leave_requests_no_truncate BEFORE TRUNCATE ON leave_requests FOR EACH STATEMENT EXECUTE FUNCTION leave_history_immutable();
CREATE FUNCTION leave_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE r leave_requests%ROWTYPE; prior jsonb; BEGIN
 SELECT * INTO r FROM leave_requests WHERE id=NEW."requestId";
 IF NOT FOUND OR NEW.version<>r.version OR NEW."actorId" IS DISTINCT FROM (CASE WHEN r.status IN ('APPROVED','REJECTED') THEN r."reviewedById" ELSE r."createdById" END) OR NEW.action<>r.status::text OR jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Complete matching leave audit required' USING ERRCODE='23514'; END IF;
 -- Compare complete canonical stored rows, including private instructions and authority revisions.
 IF ((NEW.snapshot->'after')-ARRAY['createdAt','withdrawnAt','reviewedAt','startDate','endDate']) IS DISTINCT FROM (to_jsonb(r)-ARRAY['createdAt','withdrawnAt','reviewedAt','startDate','endDate']) OR (NEW.snapshot->'after'->>'startDate')::date IS DISTINCT FROM r."startDate" OR (NEW.snapshot->'after'->>'endDate')::date IS DISTINCT FROM r."endDate" OR (NEW.snapshot->'after'->>'createdAt')::timestamptz IS DISTINCT FROM r."createdAt" OR (NEW.snapshot->'after'->>'withdrawnAt')::timestamptz IS DISTINCT FROM r."withdrawnAt" OR (NEW.snapshot->'after'->>'reviewedAt')::timestamptz IS DISTINCT FROM r."reviewedAt" THEN RAISE EXCEPTION 'Complete leave after snapshot required' USING ERRCODE='23514'; END IF;
 IF r.version=2 THEN
  SELECT snapshot->'after' INTO prior FROM leave_request_events WHERE "requestId"=r.id AND version=1;
  IF prior IS NULL OR NEW.snapshot->'before' IS DISTINCT FROM prior THEN RAISE EXCEPTION 'Original pending history required' USING ERRCODE='23514'; END IF;
 ELSIF NEW.snapshot->'before' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Initial event has no prior state' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER leave_event_guard BEFORE INSERT ON leave_request_events FOR EACH ROW EXECUTE FUNCTION leave_event_guard();
CREATE FUNCTION leave_event_required() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM leave_request_events WHERE "requestId"=NEW.id AND version=NEW.version) THEN RAISE EXCEPTION 'Atomic leave event required' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER leave_event_required AFTER INSERT OR UPDATE ON leave_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION leave_event_required();
