-- CreateEnum
CREATE TYPE "PayrollSourceActionKind" AS ENUM ('APPROVE', 'REVOKE');

-- CreateEnum
CREATE TYPE "PayrollReservationState" AS ENUM ('HELD', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "PayrollPaymentChannel" AS ENUM ('BANK', 'CASH');

-- CreateEnum
CREATE TYPE "PayrollPaymentBatchStatus" AS ENUM ('PREPARED', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "payrollAuthorityVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ledger_accounts" ADD COLUMN     "payrollMaterialVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "cash_bank_accounts" ADD COLUMN     "payrollMaterialVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "payroll_finance_delegates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canInitiate" BOOLEAN NOT NULL DEFAULT false,
    "canReview" BOOLEAN NOT NULL DEFAULT false,
    "generation" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "initiatedById" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "authorityReference" TEXT NOT NULL,
    "auditSnapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_finance_delegates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_finance_delegate_revocations" (
    "id" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "initiatedById" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "authorityReference" TEXT NOT NULL,
    "auditSnapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_finance_delegate_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_source_actions" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "kind" "PayrollSourceActionKind" NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "auditSnapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_source_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_source_decisions" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "authorityReference" TEXT NOT NULL,
    "auditSnapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_source_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payment_reservations" (
    "id" TEXT NOT NULL,
    "payrollRunLineId" TEXT NOT NULL,
    "channel" "PayrollPaymentChannel" NOT NULL,
    "lineId" TEXT NOT NULL,
    "state" "PayrollReservationState" NOT NULL DEFAULT 'HELD',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payroll_payment_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_cancellation_requests" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "expectedVersion" INTEGER NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "evidenceReference" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "auditSnapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_cancellation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_cancellation_decisions" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "evidenceDigest" VARCHAR(64) NOT NULL,
    "verificationAuthority" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "auditSnapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_cancellation_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_source_authorizations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "channel" "PayrollPaymentChannel" NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "expiresAt" TIMESTAMP(3),
    "auditSnapshot" JSONB NOT NULL,
    "generation" INTEGER NOT NULL,
    "sourceRevision" VARCHAR(64) NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_source_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payment_batches" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "sourceAuthorizationId" TEXT NOT NULL,
    "channel" "PayrollPaymentChannel" NOT NULL,
    "status" "PayrollPaymentBatchStatus" NOT NULL DEFAULT 'PREPARED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "creationAudit" JSONB NOT NULL,

    CONSTRAINT "payroll_payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payment_lines" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "payrollRunLineId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "channel" "PayrollPaymentChannel" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "obligationSnapshot" JSONB NOT NULL,

    CONSTRAINT "payroll_payment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_payment_confirmations" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "evidenceKind" TEXT NOT NULL,
    "evidenceReference" TEXT NOT NULL,
    "evidenceDigest" VARCHAR(64) NOT NULL,
    "verificationAuthority" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "attestation" JSONB NOT NULL,
    "auditSnapshot" JSONB NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,

    CONSTRAINT "payroll_payment_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_finance_delegates_companyId_userId_generation_key" ON "payroll_finance_delegates"("companyId", "userId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_finance_delegate_revocations_delegateId_key" ON "payroll_finance_delegate_revocations"("delegateId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_source_actions_idempotencyKey_key" ON "payroll_source_actions"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_source_actions_grantId_kind_key" ON "payroll_source_actions"("grantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_source_decisions_actionId_key" ON "payroll_source_decisions"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payment_reservations_lineId_key" ON "payroll_payment_reservations"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payment_reservations_payrollRunLineId_channel_key" ON "payroll_payment_reservations"("payrollRunLineId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cancellation_requests_idempotencyKey_key" ON "payroll_cancellation_requests"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cancellation_decisions_requestId_key" ON "payroll_cancellation_decisions"("requestId");

-- CreateIndex
CREATE INDEX "payroll_source_authorizations_grantedById_idx" ON "payroll_source_authorizations"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_source_authorizations_companyId_sourceAccountId_cha_key" ON "payroll_source_authorizations"("companyId", "sourceAccountId", "channel", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payment_batches_idempotencyKey_key" ON "payroll_payment_batches"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payroll_payment_batches_payrollRunId_channel_idx" ON "payroll_payment_batches"("payrollRunId", "channel");

-- CreateIndex
CREATE INDEX "payroll_payment_batches_companyId_status_idx" ON "payroll_payment_batches"("companyId", "status");

-- CreateIndex
CREATE INDEX "payroll_payment_batches_sourceAuthorizationId_idx" ON "payroll_payment_batches"("sourceAuthorizationId");

-- CreateIndex
CREATE INDEX "payroll_payment_lines_batchId_idx" ON "payroll_payment_lines"("batchId");

-- CreateIndex
CREATE INDEX "payroll_payment_lines_employeeId_idx" ON "payroll_payment_lines"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payment_lines_batchId_payrollRunLineId_channel_key" ON "payroll_payment_lines"("batchId", "payrollRunLineId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payment_confirmations_batchId_key" ON "payroll_payment_confirmations"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payment_confirmations_idempotencyKey_key" ON "payroll_payment_confirmations"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payroll_payment_confirmations_confirmedById_idx" ON "payroll_payment_confirmations"("confirmedById");

-- AddForeignKey
ALTER TABLE "payroll_finance_delegates" ADD CONSTRAINT "payroll_finance_delegates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_finance_delegates" ADD CONSTRAINT "payroll_finance_delegates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_finance_delegates" ADD CONSTRAINT "payroll_finance_delegates_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_finance_delegates" ADD CONSTRAINT "payroll_finance_delegates_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_finance_delegate_revocations" ADD CONSTRAINT "payroll_finance_delegate_revocations_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "payroll_finance_delegates"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_finance_delegate_revocations" ADD CONSTRAINT "payroll_finance_delegate_revocations_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_finance_delegate_revocations" ADD CONSTRAINT "payroll_finance_delegate_revocations_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_source_actions" ADD CONSTRAINT "payroll_source_actions_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "payroll_source_authorizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_source_actions" ADD CONSTRAINT "payroll_source_actions_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_source_decisions" ADD CONSTRAINT "payroll_source_decisions_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "payroll_source_actions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_source_decisions" ADD CONSTRAINT "payroll_source_decisions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_reservations" ADD CONSTRAINT "payroll_payment_reservations_payrollRunLineId_fkey" FOREIGN KEY ("payrollRunLineId") REFERENCES "payroll_run_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_reservations" ADD CONSTRAINT "payroll_payment_reservations_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "payroll_payment_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_cancellation_requests" ADD CONSTRAINT "payroll_cancellation_requests_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payroll_payment_batches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_cancellation_requests" ADD CONSTRAINT "payroll_cancellation_requests_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_cancellation_decisions" ADD CONSTRAINT "payroll_cancellation_decisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "payroll_cancellation_requests"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_cancellation_decisions" ADD CONSTRAINT "payroll_cancellation_decisions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_source_authorizations" ADD CONSTRAINT "payroll_source_authorizations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_source_authorizations" ADD CONSTRAINT "payroll_source_authorizations_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_source_authorizations" ADD CONSTRAINT "payroll_source_authorizations_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_sourceAuthorizationId_fkey" FOREIGN KEY ("sourceAuthorizationId") REFERENCES "payroll_source_authorizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_batches" ADD CONSTRAINT "payroll_payment_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_lines" ADD CONSTRAINT "payroll_payment_lines_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payroll_payment_batches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_lines" ADD CONSTRAINT "payroll_payment_lines_payrollRunLineId_fkey" FOREIGN KEY ("payrollRunLineId") REFERENCES "payroll_run_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_lines" ADD CONSTRAINT "payroll_payment_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_confirmations" ADD CONSTRAINT "payroll_payment_confirmations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payroll_payment_batches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_payment_confirmations" ADD CONSTRAINT "payroll_payment_confirmations_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- BEGIN PAYMENT INTEGRITY (manually authored PostgreSQL invariants)
-- Policies E-H. No delegates, grants, evidence or payments are seeded.
-- SQL proves identity relationships and structural provenance, NOT external truth.
CREATE FUNCTION payroll_payment_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Payroll payment history is immutable' USING ERRCODE='23514'; END $$;

CREATE FUNCTION payroll_payment_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key text; fields text[]; changed boolean; oldj jsonb; newj jsonb;
BEGIN
  IF TG_TABLE_NAME='companies' THEN key:='payrollAuthorityVersion'; fields:=ARRAY['singletonKey','isActive','currency'];
  ELSIF TG_TABLE_NAME='cash_bank_accounts' THEN key:='payrollMaterialVersion'; fields:=ARRAY['accountType','ledgerAccountId','isActive','bankName','branch','accountNumber','provider','providerOtherName','walletNumber','accountHolderName'];
  ELSE key:='payrollMaterialVersion'; fields:=ARRAY['accountGroupId','normalBalance','isActive','isCashBank']; END IF;
  oldj:=to_jsonb(OLD); newj:=to_jsonb(NEW);
  SELECT bool_or(oldj->f IS DISTINCT FROM newj->f) INTO changed FROM unnest(fields) f;
  IF (newj->>key)::int<>(oldj->>key)::int THEN RAISE EXCEPTION 'Material revision is database managed' USING ERRCODE='23514'; END IF;
  IF changed THEN NEW:=jsonb_populate_record(NEW,jsonb_build_object(key,(oldj->>key)::int+1)); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_company_revision BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION payroll_payment_revision_guard();
CREATE TRIGGER payment_account_revision BEFORE UPDATE ON cash_bank_accounts FOR EACH ROW EXECUTE FUNCTION payroll_payment_revision_guard();
CREATE TRIGGER payment_ledger_revision BEFORE UPDATE ON ledger_accounts FOR EACH ROW EXECUTE FUNCTION payroll_payment_revision_guard();

-- All protected operations lock parent -> source -> ledger -> obligation IDs.
-- Conservative parent serialization is deliberate; no advisory-hash collisions.
CREATE FUNCTION payroll_payment_source_snapshot(cid text, sid text, ch "PayrollPaymentChannel") RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c record; a record; l record;
BEGIN
 SELECT * INTO c FROM companies WHERE id=cid FOR UPDATE;
 SELECT * INTO a FROM cash_bank_accounts WHERE id=sid FOR SHARE;
 SELECT * INTO l FROM ledger_accounts WHERE id=a."ledgerAccountId" FOR SHARE;
 IF c.id IS NULL OR c."singletonKey" IS DISTINCT FROM 'PRIMARY' OR NOT c."isActive" OR a.id IS NULL OR NOT a."isActive" OR a."accountType"::text<>ch::text OR l.id IS NULL OR NOT l."isActive" OR NOT l."isCashBank" THEN RAISE EXCEPTION 'Invalid PRIMARY source/channel' USING ERRCODE='23514'; END IF;
 RETURN jsonb_build_object('companyId',c.id,'authorityVersion',c."payrollAuthorityVersion",'currency',c.currency,'sourceAccountId',a.id,'channel',ch,'sourceVersion',a."payrollMaterialVersion",'bankName',a."bankName",'branch',a."branch",'accountNumber',a."accountNumber",'ledgerId',l.id,'ledgerVersion',l."payrollMaterialVersion");
END $$;
CREATE FUNCTION payroll_payment_delegate(cid text, uid text, reviewing boolean) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM payroll_finance_delegates d JOIN users u ON u.id=d."userId" JOIN user_roles ur ON ur."userId"=u.id JOIN roles r ON r.id=ur."roleId" WHERE d."companyId"=cid AND d."userId"=uid AND u."isActive" AND r.code='ACCOUNTANT' AND CASE WHEN reviewing THEN d."canReview" ELSE d."canInitiate" END AND d."authorizedAt"<=(clock_timestamp() AT TIME ZONE 'UTC')::timestamp AND (d."expiresAt" IS NULL OR d."expiresAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp) AND NOT EXISTS(SELECT 1 FROM payroll_finance_delegate_revocations v WHERE v."delegateId"=d.id) AND d.generation=(SELECT max(newer.generation) FROM payroll_finance_delegates newer WHERE newer."companyId"=d."companyId" AND newer."userId"=d."userId"));
$$;
CREATE FUNCTION payroll_payment_grant_valid(gid text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE g record; snap jsonb;
BEGIN
 SELECT * INTO g FROM payroll_source_authorizations WHERE id=gid;
 IF g.id IS NULL THEN RETURN false; END IF;
 snap:=payroll_payment_source_snapshot(g."companyId",g."sourceAccountId",g.channel);
 RETURN g."sourceRevision"=encode(sha256(convert_to(snap::text,'UTF8')),'hex') AND g."sourceSnapshot"=snap
 AND g."grantedAt"<=(clock_timestamp() AT TIME ZONE 'UTC')::timestamp AND (g."expiresAt" IS NULL OR g."expiresAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp)
 AND EXISTS(SELECT 1 FROM payroll_source_actions a JOIN payroll_source_decisions d ON d."actionId"=a.id WHERE a."grantId"=gid AND a.kind='APPROVE')
 AND NOT EXISTS(SELECT 1 FROM payroll_source_actions a JOIN payroll_source_decisions d ON d."actionId"=a.id WHERE a."grantId"=gid AND a.kind='REVOKE')
 AND NOT EXISTS(SELECT 1 FROM payroll_source_authorizations newer JOIN payroll_source_actions a ON a."grantId"=newer.id AND a.kind='APPROVE' JOIN payroll_source_decisions d ON d."actionId"=a.id WHERE newer."companyId"=g."companyId" AND newer."sourceAccountId"=g."sourceAccountId" AND newer.channel=g.channel AND newer.generation>g.generation);
END $$;
CREATE FUNCTION payroll_payment_grant_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snap jsonb; next_generation int;
BEGIN
 snap:=payroll_payment_source_snapshot(NEW."companyId",NEW."sourceAccountId",NEW.channel);
 SELECT coalesce(max(generation),0)+1 INTO next_generation FROM payroll_source_authorizations WHERE "companyId"=NEW."companyId" AND "sourceAccountId"=NEW."sourceAccountId" AND channel=NEW.channel;
 IF NOT payroll_payment_delegate(NEW."companyId",NEW."grantedById",false) OR NEW.generation<>next_generation OR NEW."sourceSnapshot"<>snap OR NEW."sourceRevision"<>encode(sha256(convert_to(snap::text,'UTF8')),'hex') OR NEW."grantedAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) OR (NEW."expiresAt" IS NOT NULL AND NEW."expiresAt"<=(clock_timestamp() AT TIME ZONE 'UTC')::timestamp) OR NEW."auditSnapshot"->>'actorId' IS DISTINCT FROM NEW."grantedById" THEN RAISE EXCEPTION 'Invalid pending source grant' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_source_action_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g record;
BEGIN
 SELECT * INTO g FROM payroll_source_authorizations WHERE id=NEW."grantId";
 PERFORM 1 FROM companies WHERE id=g."companyId" FOR UPDATE;
 IF g.id IS NULL OR NOT payroll_payment_delegate(g."companyId",NEW."initiatedById",false) OR (NEW.kind='APPROVE' AND NEW."initiatedById"<>g."grantedById") OR NEW."createdAt"<g."grantedAt" OR NEW."createdAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) OR NEW."auditSnapshot"->>'actorId' IS DISTINCT FROM NEW."initiatedById" THEN RAISE EXCEPTION 'Invalid source action authority' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_source_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record; g record; snap jsonb;
BEGIN
 SELECT * INTO a FROM payroll_source_actions WHERE id=NEW."actionId";
 SELECT * INTO g FROM payroll_source_authorizations WHERE id=a."grantId";
 PERFORM 1 FROM companies WHERE id=g."companyId" FOR UPDATE;
 IF a.kind='APPROVE' THEN snap:=payroll_payment_source_snapshot(g."companyId",g."sourceAccountId",g.channel); END IF;
 IF a.id IS NULL OR NEW."reviewedById"=a."initiatedById" OR NOT payroll_payment_delegate(g."companyId",a."initiatedById",false) OR NOT payroll_payment_delegate(g."companyId",NEW."reviewedById",true) OR NEW."auditSnapshot"->>'actorId' IS DISTINCT FROM NEW."reviewedById" OR NEW."reviewedAt"<a."createdAt" OR (a.kind='APPROVE' AND NEW."reviewedById"=g."grantedById") OR NEW."reviewedAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) THEN RAISE EXCEPTION 'Independent finance decision required' USING ERRCODE='23514'; END IF;
 IF a.kind='APPROVE' THEN
  snap:=payroll_payment_source_snapshot(g."companyId",g."sourceAccountId",g.channel);
  IF EXISTS(SELECT 1 FROM payroll_source_actions ra JOIN payroll_source_decisions rd ON rd."actionId"=ra.id WHERE ra."grantId"=g.id AND ra.kind='REVOKE') OR g."sourceSnapshot"<>snap OR (g."expiresAt" IS NOT NULL AND g."expiresAt"<=(clock_timestamp() AT TIME ZONE 'UTC')::timestamp) OR EXISTS(SELECT 1 FROM payroll_source_authorizations n JOIN payroll_source_actions na ON na."grantId"=n.id AND na.kind='APPROVE' JOIN payroll_source_decisions nd ON nd."actionId"=na.id WHERE n."companyId"=g."companyId" AND n."sourceAccountId"=g."sourceAccountId" AND n.channel=g.channel AND n.generation>g.generation) THEN RAISE EXCEPTION 'Stale source authorization' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_batch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE g record;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.status='PREPARED' AND NEW.status IN ('CONFIRMED','CANCELLED') AND NEW.version=OLD.version+1 AND (to_jsonb(NEW)-'status'-'version')=(to_jsonb(OLD)-'status'-'version') AND ((NEW.status='CONFIRMED' AND EXISTS(SELECT 1 FROM payroll_payment_confirmations WHERE "batchId"=OLD.id) AND payroll_payment_grant_valid(OLD."sourceAuthorizationId")) OR (NEW.status='CANCELLED' AND NOT EXISTS(SELECT 1 FROM payroll_payment_confirmations WHERE "batchId"=OLD.id) AND EXISTS(SELECT 1 FROM payroll_cancellation_requests q JOIN payroll_cancellation_decisions d ON d."requestId"=q.id WHERE q."batchId"=OLD.id AND q."expectedVersion"=OLD.version))) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Payment batch cannot be overwritten' USING ERRCODE='23514';
 END IF;
 SELECT * INTO g FROM payroll_source_authorizations WHERE id=NEW."sourceAuthorizationId";
 PERFORM payroll_payment_source_snapshot(NEW."companyId",NEW."sourceAccountId",NEW.channel);
 PERFORM 1 FROM payroll_runs WHERE id=NEW."payrollRunId" FOR SHARE;
 IF g.id IS NULL OR g."companyId"<>NEW."companyId" OR g."sourceAccountId"<>NEW."sourceAccountId" OR g.channel<>NEW.channel OR NOT payroll_payment_grant_valid(g.id) OR NEW.status<>'PREPARED' OR NEW.version<>1 OR NOT EXISTS(SELECT 1 FROM payroll_runs p WHERE p.id=NEW."payrollRunId" AND p.status='APPROVED' AND p."companyId"=NEW."companyId") OR NOT EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur."userId"=u.id JOIN roles r ON r.id=ur."roleId" WHERE u.id=NEW."createdById" AND u."isActive" AND r.code='ACCOUNTANT') OR NEW."createdAt"<g."grantedAt" OR NEW."createdAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) OR NEW."creationAudit"->>'actorId' IS DISTINCT FROM NEW."createdById" THEN RAISE EXCEPTION 'Invalid authorized payment batch' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; b record; expected numeric;
BEGIN
 SELECT * INTO b FROM payroll_payment_batches WHERE id=NEW."batchId";
 PERFORM payroll_payment_source_snapshot(b."companyId",b."sourceAccountId",b.channel);
 SELECT * INTO p FROM payroll_run_lines WHERE id=NEW."payrollRunLineId" FOR UPDATE;
 expected:=CASE NEW.channel WHEN 'BANK' THEN p."bankPay" ELSE p."cashPay" END;
 IF p.id IS NULL OR b.id IS NULL OR b.status<>'PREPARED' OR NOT payroll_payment_grant_valid(b."sourceAuthorizationId") OR p."payrollRunId"<>b."payrollRunId" OR p."employeeId"<>NEW."employeeId" OR b.channel<>NEW.channel OR NEW.amount<=0 OR NEW.amount<>expected OR NEW."obligationSnapshot" IS DISTINCT FROM jsonb_build_object('employeeSnapshot',p."employeeSnapshot",'paymentProfileSnapshot',p."paymentProfileSnapshot",'amount',NEW.amount::text) THEN RAISE EXCEPTION 'Payment must equal full approved allocation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_reservation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l record; b record; oldb record;
BEGIN
 SELECT * INTO l FROM payroll_payment_lines WHERE id=NEW."lineId";
 SELECT * INTO b FROM payroll_payment_batches WHERE id=l."batchId";
 PERFORM payroll_payment_source_snapshot(b."companyId",b."sourceAccountId",b.channel);
 PERFORM 1 FROM payroll_run_lines WHERE id=NEW."payrollRunLineId" FOR UPDATE;
 IF l.id IS NULL OR l."payrollRunLineId"<>NEW."payrollRunLineId" OR l.channel<>NEW.channel THEN RAISE EXCEPTION 'Reservation obligation mismatch' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' AND NEW.state='HELD' AND NEW.version=1 AND b.status='PREPARED' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.state<>'CONSUMED' AND NEW.id=OLD.id AND NEW."payrollRunLineId"=OLD."payrollRunLineId" AND NEW.channel=OLD.channel AND NEW.version=OLD.version+1 THEN
  SELECT ob.* INTO oldb FROM payroll_payment_lines ol JOIN payroll_payment_batches ob ON ob.id=ol."batchId" WHERE ol.id=OLD."lineId";
  IF OLD.state='HELD' AND NEW."lineId"=OLD."lineId" AND ((NEW.state='RELEASED' AND b.status='CANCELLED') OR (NEW.state='CONSUMED' AND b.status='CONFIRMED')) THEN RETURN NEW; END IF;
  IF OLD.state='RELEASED' AND NEW.state='HELD' AND OLD."lineId"<>NEW."lineId" AND oldb.status='CANCELLED' AND b.status='PREPARED' THEN RETURN NEW; END IF;
 END IF;
 RAISE EXCEPTION 'Confirmed reservations are permanent; release requires cancellation' USING ERRCODE='23514';
END $$;
CREATE FUNCTION payroll_payment_reserve_line() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO payroll_payment_reservations(id,"payrollRunLineId",channel,"lineId",state,version) VALUES(NEW.id,NEW."payrollRunLineId",NEW.channel,NEW.id,'HELD',1)
 ON CONFLICT ("payrollRunLineId",channel) DO UPDATE SET "lineId"=EXCLUDED."lineId",state='HELD',version=payroll_payment_reservations.version+1;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_transition_reservations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status<>OLD.status THEN
  UPDATE payroll_payment_reservations r SET state=CASE NEW.status WHEN 'CANCELLED' THEN 'RELEASED'::"PayrollReservationState" ELSE 'CONSUMED'::"PayrollReservationState" END,version=r.version+1 FROM payroll_payment_lines l WHERE l.id=r."lineId" AND l."batchId"=NEW.id;
 END IF; RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_totals_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bid text; b record; n integer; total numeric;
BEGIN
 IF TG_TABLE_NAME='payroll_payment_batches' THEN bid:=NEW.id;
 ELSIF TG_TABLE_NAME='payroll_payment_reservations' THEN SELECT "batchId" INTO bid FROM payroll_payment_lines WHERE id=NEW."lineId";
 ELSE bid:=NEW."batchId"; END IF;
 SELECT * INTO b FROM payroll_payment_batches WHERE id=bid;
 SELECT count(*),sum(amount) INTO n,total FROM payroll_payment_lines WHERE "batchId"=bid;
 IF n=0 OR total IS DISTINCT FROM b."totalAmount" OR EXISTS(SELECT 1 FROM payroll_payment_lines l LEFT JOIN payroll_payment_reservations r ON r."lineId"=l.id WHERE l."batchId"=bid AND ((b.status='PREPARED' AND (r.id IS NULL OR r.state<>'HELD')) OR (b.status='CONFIRMED' AND (r.id IS NULL OR r.state<>'CONSUMED')))) THEN RAISE EXCEPTION 'Payment total/reservation coverage mismatch' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION payroll_payment_cancellation_request_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b record;
BEGIN
 SELECT * INTO b FROM payroll_payment_batches WHERE id=NEW."batchId";
 PERFORM 1 FROM companies WHERE id=b."companyId" FOR UPDATE;
 IF b.id IS NULL OR NOT EXISTS(SELECT 1 FROM companies WHERE id=b."companyId" AND "singletonKey"='PRIMARY' AND "isActive") OR b.status<>'PREPARED' OR b.version<>NEW."expectedVersion" OR NOT payroll_payment_delegate(b."companyId",NEW."initiatedById",false) OR EXISTS(SELECT 1 FROM payroll_payment_confirmations WHERE "batchId"=b.id) OR NEW."createdAt"<b."createdAt" OR NEW."createdAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) OR NEW."auditSnapshot"->>'actorId' IS DISTINCT FROM NEW."initiatedById" THEN RAISE EXCEPTION 'Invalid cancellation request' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_cancellation_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q record; b record;
BEGIN
 SELECT * INTO q FROM payroll_cancellation_requests WHERE id=NEW."requestId";
 SELECT * INTO b FROM payroll_payment_batches WHERE id=q."batchId";
 PERFORM 1 FROM companies WHERE id=b."companyId" FOR UPDATE;
 PERFORM 1 FROM cash_bank_accounts WHERE id=b."sourceAccountId" FOR SHARE;
 SELECT * INTO b FROM payroll_payment_batches WHERE id=q."batchId" FOR UPDATE;
 IF q.id IS NULL OR NOT EXISTS(SELECT 1 FROM companies WHERE id=b."companyId" AND "singletonKey"='PRIMARY' AND "isActive") OR b.status<>'PREPARED' OR b.version<>q."expectedVersion" OR NEW."reviewedById" IN (q."initiatedById",b."createdById") OR NOT payroll_payment_delegate(b."companyId",q."initiatedById",false) OR NOT payroll_payment_delegate(b."companyId",NEW."reviewedById",true) OR EXISTS(SELECT 1 FROM payroll_payment_confirmations WHERE "batchId"=b.id) OR NEW."auditSnapshot"->>'actorId' IS DISTINCT FROM NEW."reviewedById" OR NEW."reviewedAt"<q."createdAt" OR NEW."verifiedAt"<b."createdAt" OR NEW."verifiedAt">NEW."reviewedAt" OR NEW."reviewedAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) THEN RAISE EXCEPTION 'Independent non-disbursement attestation required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_cancellation_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_cancellation_requests q JOIN payroll_payment_batches b ON b.id=q."batchId" WHERE q.id=NEW."requestId" AND b.status='CANCELLED') THEN RAISE EXCEPTION 'Cancellation decision/state must commit together' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE FUNCTION payroll_payment_confirmation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b record;
BEGIN
 SELECT * INTO b FROM payroll_payment_batches WHERE id=NEW."batchId";
 PERFORM payroll_payment_source_snapshot(b."companyId",b."sourceAccountId",b.channel);
 SELECT * INTO b FROM payroll_payment_batches WHERE id=NEW."batchId" FOR UPDATE;
 IF b.id IS NULL OR b.status<>'PREPARED' OR b."createdById"=NEW."confirmedById" OR NOT payroll_payment_grant_valid(b."sourceAuthorizationId") OR NOT EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur."userId"=u.id JOIN roles r ON r.id=ur."roleId" WHERE u.id=NEW."confirmedById" AND u."isActive" AND r.code='ACCOUNTANT') OR (b.channel='BANK' AND NEW."evidenceKind"<>'BANK_TRANSACTION') OR (b.channel='CASH' AND NEW."evidenceKind"<>'SIGNED_CASH_RECEIPT') OR NEW."verifiedAt"<b."createdAt" OR NEW."confirmedAt"<b."createdAt" OR NEW."verifiedAt">NEW."confirmedAt" OR NEW."confirmedAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) OR NEW.attestation->>'verifierId' IS DISTINCT FROM NEW."confirmedById" OR NEW."auditSnapshot"->>'actorId' IS DISTINCT FROM NEW."confirmedById" THEN RAISE EXCEPTION 'Invalid independent confirmation provenance' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_confirmation_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_batches WHERE id=NEW."batchId" AND status='CONFIRMED') THEN RAISE EXCEPTION 'Confirmation and state must commit together' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE FUNCTION payroll_payment_obligation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (TG_TABLE_NAME='payroll_run_lines' AND EXISTS(SELECT 1 FROM payroll_payment_lines WHERE "payrollRunLineId"=OLD.id)) OR (TG_TABLE_NAME='payroll_runs' AND EXISTS(SELECT 1 FROM payroll_payment_batches WHERE "payrollRunId"=OLD.id)) THEN RAISE EXCEPTION 'Reserved payroll history cannot change' USING ERRCODE='23514'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
ALTER TABLE payroll_payment_batches ADD CONSTRAINT payment_batch_amount_check CHECK ("totalAmount">0 AND version>=1 AND length("idempotencyKey") BETWEEN 8 AND 128 AND "requestHash" ~ '^[a-f0-9]{64}$' AND jsonb_typeof("creationAudit")='object');
ALTER TABLE payroll_payment_lines ADD CONSTRAINT payment_line_amount_check CHECK (amount>0 AND jsonb_typeof("obligationSnapshot")='object');
ALTER TABLE payroll_source_authorizations ADD CONSTRAINT payment_grant_audit_check CHECK (generation>0 AND "sourceRevision" ~ '^[a-f0-9]{64}$' AND jsonb_typeof("sourceSnapshot")='object' AND jsonb_typeof("auditSnapshot")='object');
ALTER TABLE payroll_finance_delegates ADD CONSTRAINT payment_delegate_authority_check CHECK (length(btrim("authorityReference"))>0 AND jsonb_typeof("auditSnapshot")='object');
ALTER TABLE payroll_source_actions ADD CONSTRAINT payment_action_audit_check CHECK (length("idempotencyKey") BETWEEN 8 AND 128 AND jsonb_typeof("auditSnapshot")='object');
ALTER TABLE payroll_source_decisions ADD CONSTRAINT payment_decision_audit_check CHECK (length(btrim("authorityReference"))>0 AND jsonb_typeof("auditSnapshot")='object');
ALTER TABLE payroll_payment_reservations ADD CONSTRAINT payment_reservation_version_check CHECK (version>=1);
ALTER TABLE payroll_cancellation_requests ADD CONSTRAINT payment_cancellation_request_check CHECK ("expectedVersion">0 AND length(btrim("evidenceReference"))>0 AND length("idempotencyKey") BETWEEN 8 AND 128 AND jsonb_typeof("auditSnapshot")='object');
ALTER TABLE payroll_cancellation_decisions ADD CONSTRAINT payment_cancellation_evidence_check CHECK ("evidenceDigest" ~ '^[a-f0-9]{64}$' AND length(btrim("verificationAuthority"))>0 AND jsonb_typeof("auditSnapshot")='object');
ALTER TABLE payroll_payment_confirmations ADD CONSTRAINT payment_confirmation_evidence_check CHECK (length(btrim("evidenceReference"))>0 AND "evidenceDigest" ~ '^[a-f0-9]{64}$' AND length(btrim("verificationAuthority"))>0 AND length("idempotencyKey") BETWEEN 8 AND 128 AND jsonb_typeof(attestation)='object' AND jsonb_typeof("auditSnapshot")='object');
CREATE TRIGGER payment_grant_guard BEFORE INSERT ON payroll_source_authorizations FOR EACH ROW EXECUTE FUNCTION payroll_payment_grant_guard();
CREATE TRIGGER payment_source_action_guard BEFORE INSERT ON payroll_source_actions FOR EACH ROW EXECUTE FUNCTION payroll_payment_source_action_guard();
CREATE TRIGGER payment_source_decision_guard BEFORE INSERT ON payroll_source_decisions FOR EACH ROW EXECUTE FUNCTION payroll_payment_source_decision_guard();
CREATE TRIGGER payment_batch_guard BEFORE INSERT OR UPDATE ON payroll_payment_batches FOR EACH ROW EXECUTE FUNCTION payroll_payment_batch_guard();
CREATE TRIGGER payment_batch_delete_guard BEFORE DELETE ON payroll_payment_batches FOR EACH ROW EXECUTE FUNCTION payroll_payment_immutable();
CREATE TRIGGER payment_line_guard BEFORE INSERT ON payroll_payment_lines FOR EACH ROW EXECUTE FUNCTION payroll_payment_line_guard();
CREATE TRIGGER payment_reserve_line AFTER INSERT ON payroll_payment_lines FOR EACH ROW EXECUTE FUNCTION payroll_payment_reserve_line();
CREATE TRIGGER payment_reservation_guard BEFORE INSERT OR UPDATE ON payroll_payment_reservations FOR EACH ROW EXECUTE FUNCTION payroll_payment_reservation_guard();
CREATE TRIGGER payment_reservation_delete_guard BEFORE DELETE ON payroll_payment_reservations FOR EACH ROW EXECUTE FUNCTION payroll_payment_immutable();
CREATE TRIGGER payment_transition_reservations AFTER UPDATE ON payroll_payment_batches FOR EACH ROW EXECUTE FUNCTION payroll_payment_transition_reservations();
CREATE CONSTRAINT TRIGGER payment_batch_total_guard AFTER INSERT OR UPDATE ON payroll_payment_batches DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_payment_totals_guard();
CREATE CONSTRAINT TRIGGER payment_line_total_guard AFTER INSERT ON payroll_payment_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_payment_totals_guard();
CREATE CONSTRAINT TRIGGER payment_reservation_total_guard AFTER INSERT OR UPDATE ON payroll_payment_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_payment_totals_guard();
CREATE TRIGGER payment_cancellation_request_guard BEFORE INSERT ON payroll_cancellation_requests FOR EACH ROW EXECUTE FUNCTION payroll_payment_cancellation_request_guard();
CREATE TRIGGER payment_cancellation_decision_guard BEFORE INSERT ON payroll_cancellation_decisions FOR EACH ROW EXECUTE FUNCTION payroll_payment_cancellation_decision_guard();
CREATE CONSTRAINT TRIGGER payment_cancellation_state_guard AFTER INSERT ON payroll_cancellation_decisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_payment_cancellation_state_guard();
CREATE TRIGGER payment_confirmation_guard BEFORE INSERT ON payroll_payment_confirmations FOR EACH ROW EXECUTE FUNCTION payroll_payment_confirmation_guard();
CREATE CONSTRAINT TRIGGER payment_confirmation_state_guard AFTER INSERT ON payroll_payment_confirmations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_payment_confirmation_state_guard();
CREATE TRIGGER payment_run_history_guard BEFORE UPDATE OR DELETE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION payroll_payment_obligation_guard();
CREATE TRIGGER payment_line_history_guard BEFORE UPDATE OR DELETE ON payroll_run_lines FOR EACH ROW EXECUTE FUNCTION payroll_payment_obligation_guard();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['payroll_source_authorizations','payroll_finance_delegates','payroll_finance_delegate_revocations','payroll_source_actions','payroll_source_decisions','payroll_payment_lines','payroll_payment_confirmations','payroll_cancellation_requests','payroll_cancellation_decisions'] LOOP
 EXECUTE format('CREATE TRIGGER payment_history_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION payroll_payment_immutable()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['payroll_source_authorizations','payroll_finance_delegates','payroll_source_actions','payroll_source_decisions','payroll_payment_batches','payroll_payment_lines','payroll_payment_reservations','payroll_payment_confirmations','payroll_cancellation_requests','payroll_cancellation_decisions'] LOOP
 EXECUTE format('CREATE TRIGGER payment_truncate_guard BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION payroll_payment_immutable()',t);
 END LOOP;
END $$;
-- UTC contract: existing timestamp(3) representation is retained. Every stored
-- payment timestamp is a UTC civil timestamp; defaults and wall-clock checks
-- explicitly convert the clock to UTC, independent of the session TimeZone.
CREATE FUNCTION payroll_payment_delegate_designation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior record; end_at timestamp; now_utc timestamp;
BEGIN
 PERFORM 1 FROM companies WHERE id=NEW."companyId" FOR UPDATE;
 now_utc:=(clock_timestamp() AT TIME ZONE 'UTC');
 SELECT d.*,v."revokedAt" INTO prior FROM payroll_finance_delegates d LEFT JOIN payroll_finance_delegate_revocations v ON v."delegateId"=d.id WHERE d."companyId"=NEW."companyId" AND d."userId"=NEW."userId" ORDER BY d.generation DESC LIMIT 1;
 end_at:=least(prior."expiresAt",prior."revokedAt");
 IF NOT EXISTS(SELECT 1 FROM companies WHERE id=NEW."companyId" AND "singletonKey"='PRIMARY' AND "isActive") OR NEW.generation<>coalesce(prior.generation,0)+1 OR NEW."initiatedById"=NEW."reviewedById" OR NEW."authorizedAt"<NEW."requestedAt" OR NEW."authorizedAt">now_utc::timestamp(3) OR (NEW."expiresAt" IS NOT NULL AND NEW."expiresAt"<=NEW."authorizedAt") OR (prior.id IS NOT NULL AND (end_at IS NULL OR NEW."authorizedAt"<end_at)) OR NEW."auditSnapshot"->>'actorId' IS DISTINCT FROM NEW."initiatedById" OR NEW."auditSnapshot"->>'reviewerId' IS DISTINCT FROM NEW."reviewedById" OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW."userId" AND "isActive") OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW."initiatedById" AND "isActive") OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW."reviewedById" AND "isActive") THEN RAISE EXCEPTION 'Invalid or overlapping independently designated finance authority' USING ERRCODE='23514'; END IF;
 -- Identity/chronology is structural. Only a separately trusted provisioning
 -- connection may insert designations; no application provisioning path exists.
 RETURN NEW;
END $$;
CREATE FUNCTION payroll_payment_delegate_revocation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d record;
BEGIN
 SELECT * INTO d FROM payroll_finance_delegates WHERE id=NEW."delegateId";
 PERFORM 1 FROM companies WHERE id=d."companyId" FOR UPDATE;
 IF d.id IS NULL OR NEW."initiatedById"=NEW."reviewedById" OR NEW."requestedAt"<d."authorizedAt" OR NEW."revokedAt"<NEW."requestedAt" OR NEW."revokedAt">(clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3) OR NEW."auditSnapshot"->>'actorId' IS DISTINCT FROM NEW."initiatedById" OR NEW."auditSnapshot"->>'reviewerId' IS DISTINCT FROM NEW."reviewedById" OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW."initiatedById" AND "isActive") OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW."reviewedById" AND "isActive") THEN RAISE EXCEPTION 'Invalid independent delegation revocation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_delegate_designation_guard BEFORE INSERT ON payroll_finance_delegates FOR EACH ROW EXECUTE FUNCTION payroll_payment_delegate_designation_guard();
CREATE TRIGGER payment_delegate_revocation_guard BEFORE INSERT ON payroll_finance_delegate_revocations FOR EACH ROW EXECUTE FUNCTION payroll_payment_delegate_revocation_guard();
ALTER TABLE payroll_finance_delegate_revocations ADD CONSTRAINT payment_delegate_revocation_audit_check CHECK (length(btrim("authorityReference"))>0 AND jsonb_typeof("auditSnapshot")='object');
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON payroll_finance_delegates, payroll_finance_delegate_revocations FROM PUBLIC;
-- Table owners/superusers bypass this ACL boundary. Deployment is BLOCKED until
-- runtime credentials have neither ownership nor provisioning/DDL privileges.
-- Lock-only RPC for the least-privilege runtime. It never updates obligations.
-- The reviewed role profile grants bounded SECURITY DEFINER execution with a
-- fixed search_path; callers receive no historical/private snapshot fields.
CREATE FUNCTION payroll_payment_lock_obligations(run_id text, employee_ids text[]) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF cardinality(employee_ids) NOT BETWEEN 1 AND 1000 OR NOT EXISTS(SELECT 1 FROM payroll_runs p JOIN companies c ON c.id=p."companyId" WHERE p.id=run_id AND p.status='APPROVED' AND c."singletonKey"='PRIMARY' AND c."isActive") THEN RAISE EXCEPTION 'Invalid approved obligation lock scope' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM payroll_runs WHERE id=run_id FOR SHARE;
 PERFORM id FROM payroll_run_lines WHERE "payrollRunId"=run_id AND "employeeId"=ANY(employee_ids) ORDER BY id FOR UPDATE;
END $$;
