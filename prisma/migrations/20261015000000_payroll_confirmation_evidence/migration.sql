-- BEGIN CONFIRMATION PREFLIGHT
-- Stop before DDL rather than manufacture claims for legacy paid history.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM payroll_payment_confirmations WHERE "evidenceKind"='SIGNED_CASH_RECEIPT') THEN RAISE EXCEPTION 'Legacy CASH confirmations need independently reviewed evidence migration'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_payment_confirmations GROUP BY "verificationAuthority","evidenceKind","evidenceReference" HAVING count(*)>1) THEN RAISE EXCEPTION 'Legacy confirmation references need independent replay review'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_payment_confirmations WHERE "verificationAuthority"<>btrim("verificationAuthority") OR "evidenceReference"<>btrim("evidenceReference")) THEN RAISE EXCEPTION 'Legacy evidence references need canonical identity review'; END IF;
END $$;
-- END CONFIRMATION PREFLIGHT
-- CreateTable
CREATE TABLE "payroll_cash_acknowledgments" (
    "id" TEXT NOT NULL,
    "confirmationId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "acknowledgmentId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_cash_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cash_acknowledgments_lineId_key" ON "payroll_cash_acknowledgments"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cash_acknowledgments_authority_acknowledgmentId_key" ON "payroll_cash_acknowledgments"("authority", "acknowledgmentId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_payment_confirmations_verificationAuthority_evidenc_key" ON "payroll_payment_confirmations"("verificationAuthority", "evidenceKind", "evidenceReference");

-- AddForeignKey
ALTER TABLE "payroll_cash_acknowledgments" ADD CONSTRAINT "payroll_cash_acknowledgments_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "payroll_payment_confirmations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_cash_acknowledgments" ADD CONSTRAINT "payroll_cash_acknowledgments_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "payroll_payment_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- BEGIN CONFIRMATION INTEGRITY (trusted private writer only; not settlement proof)
ALTER TABLE payroll_cash_acknowledgments ADD CONSTRAINT cash_ack_amount_check CHECK (amount>0 AND length(btrim(authority))>0 AND length(btrim("acknowledgmentId"))>0 AND authority=btrim(authority) AND "acknowledgmentId"=btrim("acknowledgmentId"));
ALTER TABLE payroll_payment_confirmations ADD CONSTRAINT confirmation_reference_canonical_check CHECK ("verificationAuthority"=btrim("verificationAuthority") AND "evidenceReference"=btrim("evidenceReference"));
CREATE FUNCTION payroll_cash_ack_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM payroll_payment_confirmations c JOIN payroll_payment_lines l ON l."batchId"=c."batchId" JOIN payroll_payment_batches b ON b.id=c."batchId" WHERE c.id=NEW."confirmationId" AND l.id=NEW."lineId" AND l.channel='CASH' AND l.amount=NEW.amount AND c."verificationAuthority"=NEW.authority AND NEW."occurredAt">=b."createdAt" AND NEW."occurredAt"<=c."verifiedAt") THEN RAISE EXCEPTION 'Invalid cash acknowledgment binding' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cash_ack_binding BEFORE INSERT ON payroll_cash_acknowledgments FOR EACH ROW EXECUTE FUNCTION payroll_cash_ack_guard();
CREATE TRIGGER cash_ack_history BEFORE UPDATE OR DELETE ON payroll_cash_acknowledgments FOR EACH ROW EXECUTE FUNCTION payroll_payment_immutable();
CREATE TRIGGER cash_ack_truncate BEFORE TRUNCATE ON payroll_cash_acknowledgments FOR EACH STATEMENT EXECUTE FUNCTION payroll_payment_immutable();
CREATE FUNCTION payroll_payment_confirmation_coverage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."evidenceKind"='SIGNED_CASH_RECEIPT' AND EXISTS(SELECT 1 FROM payroll_payment_lines l WHERE l."batchId"=NEW."batchId" AND NOT EXISTS(SELECT 1 FROM payroll_cash_acknowledgments a WHERE a."confirmationId"=NEW.id AND a."lineId"=l.id)) THEN RAISE EXCEPTION 'Missing individual cash acknowledgments' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER confirmation_cash_coverage AFTER INSERT ON payroll_payment_confirmations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION payroll_payment_confirmation_coverage();

CREATE FUNCTION payroll_payment_confirm(bid text, expected integer, actor text, idem text, cid text, proof jsonb, digest text)
RETURNS TABLE(id text, version integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE b record; now_utc timestamp(3); happened timestamp(3); verified timestamp(3); n integer;
BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'Serializable transaction required' USING ERRCODE='23514'; END IF;
 SELECT * INTO b FROM payroll_payment_batches WHERE payroll_payment_batches.id=bid;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Batch missing' USING ERRCODE='23514'; END IF;
 PERFORM payroll_payment_source_snapshot(b."companyId",b."sourceAccountId",b.channel);
 SELECT * INTO b FROM payroll_payment_batches WHERE payroll_payment_batches.id=bid FOR UPDATE;
 IF b.status<>'PREPARED' OR b.version<>expected OR b."createdById"=actor OR EXISTS(SELECT 1 FROM payroll_payment_confirmations WHERE "batchId"=bid) OR EXISTS(SELECT 1 FROM payroll_cancellation_requests WHERE "batchId"=bid) OR NOT payroll_payment_grant_valid(b."sourceAuthorizationId") THEN RAISE EXCEPTION 'Stale or conflicting confirmation' USING ERRCODE='40001'; END IF;
 PERFORM payroll_payment_lock_obligations(b."payrollRunId",ARRAY(SELECT "employeeId" FROM payroll_payment_lines WHERE "batchId"=bid ORDER BY "employeeId"));
 SELECT count(*) INTO n FROM payroll_payment_lines WHERE "batchId"=bid;
 IF n=0 OR EXISTS(SELECT 1 FROM payroll_payment_lines l JOIN payroll_run_lines p ON p.id=l."payrollRunLineId" LEFT JOIN payroll_payment_reservations r ON r."lineId"=l.id WHERE l."batchId"=bid AND (r.id IS NULL OR r.state<>'HELD' OR r."payrollRunLineId"<>p.id OR r.channel<>b.channel OR l.channel<>b.channel OR l.amount<>CASE b.channel WHEN 'BANK' THEN p."bankPay" ELSE p."cashPay" END)) THEN RAISE EXCEPTION 'Obligation not reserved' USING ERRCODE='23514'; END IF;
 now_utc:=clock_timestamp() AT TIME ZONE 'UTC';
 IF COALESCE(proof->>'occurredAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$' OR COALESCE(proof->>'verifiedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$' THEN RAISE EXCEPTION 'Canonical UTC evidence timestamps required' USING ERRCODE='23514'; END IF;
 happened:=(proof->>'occurredAt')::timestamptz AT TIME ZONE 'UTC'; verified:=(proof->>'verifiedAt')::timestamptz AT TIME ZONE 'UTC';
 IF proof->>'batchId' IS DISTINCT FROM bid OR proof->>'channel' IS DISTINCT FROM b.channel::text OR proof->>'sourceAccountId' IS DISTINCT FROM b."sourceAccountId" OR (proof->>'amount')::numeric IS DISTINCT FROM b."totalAmount" OR proof->>'currency' IS DISTINCT FROM (SELECT "companySnapshot"->>'currency' FROM payroll_runs WHERE payroll_runs.id=b."payrollRunId") OR proof->>'currency' IS DISTINCT FROM (SELECT currency FROM companies WHERE companies.id=b."companyId") OR happened IS NULL OR verified IS NULL OR happened<b."createdAt" OR verified<happened OR verified>now_utc OR length(btrim(COALESCE(proof->>'authority','')))=0 OR length(btrim(COALESCE(proof->>'authorityRecordId','')))=0 OR jsonb_array_length(proof->'beneficiaries') IS DISTINCT FROM n THEN RAISE EXCEPTION 'Invalid verified evidence binding' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM payroll_payment_lines l WHERE l."batchId"=bid AND (SELECT count(*) FROM jsonb_to_recordset(proof->'beneficiaries') e("employeeId" text,amount numeric) WHERE e."employeeId"=l."employeeId" AND e.amount=l.amount)<>1) THEN RAISE EXCEPTION 'Evidence beneficiaries differ' USING ERRCODE='23514'; END IF;
 -- The legacy digest argument is deliberately ignored; it is never proof.
 INSERT INTO payroll_payment_confirmations(id,"batchId","confirmedById","confirmedAt","evidenceKind","evidenceReference","evidenceDigest","verificationAuthority","verifiedAt",attestation,"auditSnapshot","idempotencyKey") VALUES(cid,bid,actor,now_utc,CASE b.channel WHEN 'BANK' THEN 'BANK_TRANSACTION' ELSE 'SIGNED_CASH_RECEIPT' END,proof->>'authorityRecordId',encode(sha256(convert_to(proof::text,'UTF8')),'hex'),proof->>'authority',verified,jsonb_build_object('verifierId',actor,'occurredAt',happened,'sourceAccountId',b."sourceAccountId",'beneficiaries',proof->'beneficiaries'),jsonb_build_object('actorId',actor,'expectedVersion',expected),idem);
 IF b.channel='CASH' THEN
  IF jsonb_array_length(proof->'acknowledgments') IS DISTINCT FROM n THEN RAISE EXCEPTION 'Cash acknowledgment coverage missing' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_to_recordset(proof->'acknowledgments') a("occurredAt" text) WHERE COALESCE(a."occurredAt",'') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$') THEN RAISE EXCEPTION 'Canonical UTC acknowledgment timestamps required' USING ERRCODE='23514'; END IF;
  INSERT INTO payroll_cash_acknowledgments(id,"confirmationId","lineId",authority,"acknowledgmentId",amount,"occurredAt") SELECT cid||'_'||l.id,cid,l.id,proof->>'authority',a."acknowledgmentId",a.amount,a."occurredAt"::timestamptz AT TIME ZONE 'UTC' FROM jsonb_to_recordset(proof->'acknowledgments') a("employeeId" text,"acknowledgmentId" text,amount numeric,"occurredAt" text) JOIN payroll_payment_lines l ON l."employeeId"=a."employeeId" AND l."batchId"=bid;
 END IF;
 UPDATE payroll_payment_batches SET status='CONFIRMED',version=payroll_payment_batches.version+1 WHERE payroll_payment_batches.id=bid;
 INSERT INTO audit_events(id,action,"entityType","entityId","userId",metadata,"createdAt") VALUES(cid||'_audit','PAYROLL_PAYMENT_CONFIRMED','PayrollPaymentBatch',bid,actor,jsonb_build_object('confirmationId',cid,'previousVersion',expected,'newVersion',expected+1,'channel',b.channel,'totalAmount',b."totalAmount"::text),now_utc);
 RETURN QUERY SELECT cid,expected+1;
END $$;
REVOKE ALL ON FUNCTION payroll_payment_confirm(text,integer,text,text,text,jsonb,text) FROM PUBLIC;


-- Private provisioning lock only: no master UPDATE privilege or returned data.
CREATE FUNCTION payroll_payment_lock_parent(cid text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM public.companies WHERE id=cid AND "singletonKey"='PRIMARY' AND "isActive" FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active PRIMARY required' USING ERRCODE='23514'; END IF;
END $$;
REVOKE ALL ON FUNCTION payroll_payment_lock_parent(text) FROM PUBLIC;
