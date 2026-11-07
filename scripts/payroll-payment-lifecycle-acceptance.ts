// Extends the existing disposable-database harness. This adapter is isolated
// technical authority, NEVER a real finance delegation/evidence provider.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
export function technicalPaymentAuthority(databaseName: string, evidence: Map<string, { digest: string; batchId: string }>) {
  assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(databaseName));
  const isolated = async (tx: any) => assert.equal((await tx.$queryRawUnsafe('SELECT current_database() AS db'))[0].db,databaseName);
  return {
    delegate: async (_companyId: string, _userId: string, _reviewing: boolean, tx: any) => { await isolated(tx); return { reference: 'ISOLATED_SYNTHETIC_AUTHORITY_NOT_BUSINESS_DELEGATION' }; },
    nonDisbursement: async (request: any, _reviewerId: string, tx: any) => { await isolated(tx); const proof=evidence.get(request.evidenceReference); return proof && proof.batchId===request.batchId ? { digest: proof.digest, authority: 'ISOLATED_SYNTHETIC_NON_DISBURSEMENT_NOT_EXTERNAL_PROOF', verifiedAt: new Date() } : null; },
  };
}
export async function verifyPaymentLifecycle(c: any) {
  const { db,c1,c2,lifecycle,lifecycleFor,payment,batchInput,user,checkerUser,parent,bankSource,cashSource,firstBatch,secondBatch,evidence,pass }=c;
  const forbidden=(e: any)=>e.getStatus?.()===403, conflict=(e: any)=>e.getStatus?.()===409;
  const baseline=async()=>({ batches: await db.payrollPaymentBatch.findMany({orderBy:{id:'asc'}}),lines:await db.payrollPaymentLine.findMany({orderBy:{id:'asc'}}),reservations:await db.payrollPaymentReservation.findMany({orderBy:{id:'asc'}}),decisions:await db.payrollCancellationDecision.count(),audits:await db.auditEvent.count() });
  const key=()=>randomUUID();
  const pending=await lifecycle.requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:key()},user);
  await assert.rejects(()=>lifecycle.reviewSourceAction(pending.actionId,user),forbidden);
  const valid=(id: string)=>db.$queryRawUnsafe('SELECT payroll_payment_grant_valid($1) AS valid',id).then((r: any)=>r[0].valid);
  assert.equal(await valid(pending.grantId),false);
  await lifecycle.reviewSourceAction(pending.actionId,checkerUser);
  await assert.rejects(()=>lifecycle.reviewSourceAction(pending.actionId,checkerUser),conflict);
  const oldGrant=await db.payrollSourceAuthorization.findFirst({where:{sourceAccountId:bankSource.id,generation:1}});
  assert.equal(await valid(oldGrant.id),false); assert.equal(await valid(pending.grantId),true);
  const revoked=await lifecycle.requestRevocation(pending.grantId,key(),user);
  await assert.rejects(()=>lifecycle.reviewSourceAction(revoked.actionId,user),forbidden);
  await lifecycle.reviewSourceAction(revoked.actionId,checkerUser);
  assert.equal(await valid(pending.grantId),false); assert.equal(await valid(oldGrant.id),false);
  await assert.rejects(()=>payment.prepare(batchInput(c.employee.id),user),(e: any)=>e.getStatus()===422);
  pass('PostgreSQL pending grants, distinct finance reviewers, repeat decisions, latest-generation precedence and durable revocation prevent older fallback');
  const drift=await lifecycle.requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:key()},user); await lifecycle.reviewSourceAction(drift.actionId,checkerUser);
  await db.cashBankAccount.update({where:{id:bankSource.id},data:{accountNumber:'changed-isolated'}}); assert.equal(await valid(drift.grantId),false);
  await db.cashBankAccount.update({where:{id:bankSource.id},data:{accountNumber:bankSource.accountNumber}}); assert.equal(await valid(drift.grantId),false);
  const renewed=await lifecycle.requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:key()},user); await lifecycle.reviewSourceAction(renewed.actionId,checkerUser);
  const g=await db.payrollSourceAuthorization.findUnique({where:{id:renewed.grantId}});
  await db.ledgerAccount.update({where:{id:bankSource.ledgerAccountId},data:{normalBalance:'CREDIT'}}); assert.equal(await valid(g.id),false);
  await db.ledgerAccount.update({where:{id:bankSource.ledgerAccountId},data:{normalBalance:'DEBIT'}});
  const usable=await lifecycle.requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:key()},user); await lifecycle.reviewSourceAction(usable.actionId,checkerUser);
  pass('PostgreSQL material bank and ledger changes, including A-to-B-to-A, invalidate frozen grants; renewed independent approval restores authority');
  await assert.rejects(()=>lifecycle.requestGrant({sourceAccountId:bankSource.id,channel:'BANK',expiresAt:'2000-01-01T00:00:00.000Z',idempotencyKey:key()},user),conflict);
  const exp=await lifecycle.requestGrant({sourceAccountId:cashSource.id,channel:'CASH',expiresAt:new Date(Date.now()+1500).toISOString(),idempotencyKey:key()},user); await lifecycle.reviewSourceAction(exp.actionId,checkerUser);
  await db.$transaction(async(tx: any)=>{assert.equal((await tx.$queryRawUnsafe('SELECT payroll_payment_grant_valid($1) AS valid',exp.grantId))[0].valid,true); await tx.$queryRawUnsafe('WITH delay AS MATERIALIZED (SELECT pg_sleep(1.6)) SELECT true AS waited FROM delay'); assert.equal((await tx.$queryRawUnsafe('SELECT payroll_payment_grant_valid($1) AS valid',exp.grantId))[0].valid,false);},{timeout:5000});
  pass('PostgreSQL wall-clock expiry is rejected within the same long-running transaction after required locks');
  const cashGrant=await lifecycle.requestGrant({sourceAccountId:cashSource.id,channel:'CASH',idempotencyKey:key()},user); await lifecycle.reviewSourceAction(cashGrant.actionId,checkerUser);
  // Cancellation never accepts the caller reference by itself; the isolated
  // adapter resolves a separately held exact batch-bound technical artifact.
  const q=await lifecycle.requestCancellation({batchId:firstBatch.id,expectedVersion:1,evidenceReference:'unverified-client-text',idempotencyKey:key()},user);
  await assert.rejects(()=>lifecycle.reviewCancellation(q.requestId,user),forbidden);
  let before=await baseline(); await assert.rejects(()=>lifecycle.reviewCancellation(q.requestId,checkerUser),(e: any)=>e.getResponse?.().code==='NON_DISBURSEMENT_AUTHORITY_UNAVAILABLE'); assert.deepEqual(await baseline(),before);
  const reference=key(); evidence.set(reference,{batchId:firstBatch.id,digest:createHash('sha256').update(JSON.stringify(await db.payrollPaymentBatch.findUnique({where:{id:firstBatch.id},include:{lines:true}}))).digest('hex')});
  const request=await lifecycle.requestCancellation({batchId:firstBatch.id,expectedVersion:1,evidenceReference:reference,idempotencyKey:key()},user);
  await db.$executeRawUnsafe(`CREATE FUNCTION payment_lifecycle_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PAYROLL_PAYMENT_BATCH_CANCELLED' THEN RAISE EXCEPTION 'isolated cancellation audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER payment_lifecycle_audit_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION payment_lifecycle_audit_fail()');
  before=await baseline(); try {await assert.rejects(()=>lifecycle.reviewCancellation(request.requestId,checkerUser));assert.deepEqual(await baseline(),before);} finally {await db.$executeRawUnsafe('DROP TRIGGER payment_lifecycle_audit_fail ON audit_events');await db.$executeRawUnsafe('DROP FUNCTION payment_lifecycle_audit_fail()');}
  const cancelled=await lifecycle.reviewCancellation(request.requestId,checkerUser);assert.equal(cancelled.version,2);assert.equal(cancelled.status,'CANCELLED');
  const history=await db.payrollPaymentLine.findMany({where:{batchId:firstBatch.id}}); assert.equal(history.length,1);assert.equal(history[0].amount.toFixed(2),firstBatch.totalAmount);
  assert.equal((await db.payrollPaymentReservation.findUnique({where:{lineId:history[0].id}})).state,'RELEASED');
  await assert.rejects(()=>lifecycle.reviewCancellation(request.requestId,checkerUser),conflict);
  await assert.rejects(()=>lifecycle.requestCancellation({batchId:firstBatch.id,expectedVersion:1,evidenceReference:reference,idempotencyKey:key()},user),conflict);
  const replacement=await payment.prepare(batchInput(c.employee.id),user); assert.notEqual(replacement.id,firstBatch.id); assert.equal((await db.payrollPaymentReservation.findFirst({where:{payrollRunLineId:history[0].payrollRunLineId,channel:'BANK'}})).state,'HELD');
  assert.deepEqual(await db.payrollPaymentLine.findMany({where:{batchId:firstBatch.id}}),history);
  pass('PostgreSQL unverified evidence and self-review rejection, audit-failure rollback, atomic cancellation/release, version increment and immutable old instructions with safe re-reservation');
  const ref2=key(); evidence.set(ref2,{batchId:secondBatch.id,digest:'a'.repeat(64)});
  const qr=await lifecycle.requestCancellation({batchId:secondBatch.id,expectedVersion:1,evidenceReference:ref2,idempotencyKey:key()},user);
  // Two real sessions compete at the same protected parent lock.
  const results=await Promise.allSettled([lifecycleFor(c1).reviewCancellation(qr.requestId,checkerUser),lifecycleFor(c2).reviewCancellation(qr.requestId,checkerUser)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);for(const r of results)if(r.status==='rejected')assert.equal(r.reason.getStatus(),409);
  assert.equal(await db.payrollCancellationDecision.count({where:{requestId:qr.requestId}}),1);assert.equal(await db.auditEvent.count({where:{entityId:secondBatch.id,action:'PAYROLL_PAYMENT_BATCH_CANCELLED'}}),1);
  assert.equal(await db.payrollPaymentConfirmation.count(),0);
  const conflictReference=key();evidence.set(conflictReference,{batchId:replacement.id,digest:'b'.repeat(64)});
  const conflictRequest=await lifecycle.requestCancellation({batchId:replacement.id,expectedVersion:1,evidenceReference:conflictReference,idempotencyKey:key()},user);
  let competing: Promise<any[]>;
  await db.$transaction(async(tx: any)=>{await tx.$queryRawUnsafe('SELECT id FROM companies WHERE id=$1 FOR UPDATE',parent.id); competing=Promise.allSettled([lifecycleFor(c1).reviewCancellation(conflictRequest.requestId,checkerUser),c.paymentFor(c2).prepare(batchInput(c.employee.id),user)]); await tx.$queryRawUnsafe('WITH delay AS MATERIALIZED (SELECT pg_sleep(0.1)) SELECT true AS waited FROM delay');});
  const conflictResults=await competing!;assert.equal(conflictResults[0].status,'fulfilled');if(conflictResults[1].status==='rejected')assert.equal(conflictResults[1].reason.getStatus(),409);
  assert.equal(await db.payrollCancellationDecision.count({where:{requestId:conflictRequest.requestId}}),1);
  assert.equal(await db.payrollPaymentReservation.count({where:{payrollRunLineId:history[0].payrollRunLineId,channel:'BANK'}}),1);
  assert.deepEqual(await db.payrollPaymentLine.findMany({where:{batchId:firstBatch.id}}),history);
  pass('two PostgreSQL sessions permit one cancellation decision/audit only; failed concurrent operation rolls back; zero confirmations');
  console.log('Positive CONFIRMED-reservation acceptance belongs to the isolated confirmation-engine extension; this lifecycle-only portion verifies structural guards and negative state/release probes.');
}
