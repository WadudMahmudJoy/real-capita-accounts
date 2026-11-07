import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { payrollPaymentErrorCode } from '../apps/api/src/payroll/payroll-payment-error';
export async function verifyConfirmationEngine(c: any) {
  console.log('Confirmation acceptance: releasing isolated prepared reservations');
  const {db,apiDb,security,load,app,bankSource,cashSource,approvedRun,user,checkerUser,lifecycle,lifecycleFor,evidence,payment,pass,http}=c;
  assert(security,'Confirmation writes require the isolated role-separated instance');
  const {PayrollParentResolver}=load('payroll/payroll-parent.resolver.js'),{PayrollDocumentsService}=load('payroll/payroll-documents.service.js'),{PayrollPaymentPreparationService}=load('payroll/payroll-payment-preparation.service.js');
  const {PayrollPaymentConfirmationService}=load('payroll/payroll-payment-confirmation.service.js'),{PayrollPaymentConfirmationReadinessService}=load('payroll/payroll-payment-confirmation-readiness.service.js');
  const data=new Map();let pauseCash: (()=>Promise<void>)|undefined;const provider={isConfigured:()=>true,verify:async(handle: string)=>{if(handle==='cash'&&pauseCash)await pauseCash();return data.get(handle)??null;}};
  const engine=(client: any)=>{const parentResolver=new PayrollParentResolver(client);const readiness=new PayrollPaymentConfirmationReadinessService(client,parentResolver,new PayrollPaymentPreparationService(client,new PayrollDocumentsService(client,parentResolver)),provider);return new PayrollPaymentConfirmationService(readiness,provider,{transaction:(fn: any)=>client.$transaction(fn,{isolationLevel:'Serializable',timeout:20000})});};
  const writer=engine(security.executorClient);
  const prepared=await db.payrollPaymentBatch.findMany({where:{status:'PREPARED'}});
  for(const b of prepared){const reference=randomUUID();evidence.set(reference,{batchId:b.id,digest:'c'.repeat(64)});const q=await lifecycle.requestCancellation({batchId:b.id,expectedVersion:b.version,evidenceReference:reference,idempotencyKey:randomUUID()},user);await lifecycle.reviewCancellation(q.requestId,checkerUser);}
  console.log('Confirmation acceptance: renewing isolated source grants');
  const cashExpiry=Date.now()+3000;
  for(const [source,channel] of [[bankSource,'BANK'],[cashSource,'CASH']]){const g=await lifecycle.requestGrant({sourceAccountId:source.id,channel,...(channel==='CASH'?{expiresAt:new Date(cashExpiry).toISOString()}:{}),idempotencyKey:randomUUID()},user);await lifecycle.reviewSourceAction(g.actionId,checkerUser);}
  const prepare=async(channel: string,source: any)=>payment.prepare({payrollRunId:approvedRun.id,sourceAccountId:source.id,channel,employeeIds:[approvedRun.lines[0].employeeId],idempotencyKey:randomUUID()},user);
  let bank=await prepare('BANK',bankSource),cash=await prepare('CASH',cashSource);
  const releasePrepared=async(b: any)=>{const reference=randomUUID();evidence.set(reference,{batchId:b.id,digest:'e'.repeat(64)});const q=await lifecycle.requestCancellation({batchId:b.id,expectedVersion:1,evidenceReference:reference,idempotencyKey:randomUUID()},user);await lifecycle.reviewCancellation(q.requestId,checkerUser);};
  const blockedInput={expectedVersion:1,evidenceHandle:'not-proof',idempotencyKey:randomUUID()};
  await new (load('cash-bank/cash-bank.service.js').CashBankService)(apiDb).update(bankSource.id,{branch:'ISOLATED SOURCE REVISION'});
  await assert.rejects(()=>writer.confirm(bank.id,blockedInput,checkerUser),(e: any)=>e.getResponse?.().blockers?.some((b: any)=>b.code==='SOURCE_AUTHORIZATION_EXPIRED_REVOKED_OR_STALE'));
  const revoked=(await db.payrollPaymentBatch.findUnique({where:{id:bank.id}})).sourceAuthorizationId;
  const revoke=await lifecycle.requestRevocation(revoked,randomUUID(),user);await lifecycle.reviewSourceAction(revoke.actionId,checkerUser);
  await assert.rejects(()=>writer.confirm(bank.id,blockedInput,checkerUser),(e: any)=>e.getResponse?.().blockers?.some((b: any)=>b.code==='SOURCE_AUTHORIZATION_EXPIRED_REVOKED_OR_STALE'));
  await releasePrepared(bank);
  const renewed=await lifecycle.requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:randomUUID()},user);await lifecycle.reviewSourceAction(renewed.actionId,checkerUser);bank=await prepare('BANK',bankSource);
  await new Promise(r=>setTimeout(r,Math.max(0,cashExpiry-Date.now()+20)));
  await assert.rejects(()=>writer.confirm(cash.id,blockedInput,checkerUser),(e: any)=>e.getResponse?.().blockers?.some((b: any)=>b.code==='SOURCE_AUTHORIZATION_EXPIRED_REVOKED_OR_STALE'));await releasePrepared(cash);
  const renewedCash=await lifecycle.requestGrant({sourceAccountId:cashSource.id,channel:'CASH',idempotencyKey:randomUUID()},user);await lifecycle.reviewSourceAction(renewedCash.actionId,checkerUser);cash=await prepare('CASH',cashSource);
  console.log('Confirmation acceptance: verifier rejection and audit rollback');
  const proof=async(batch: any,record=randomUUID())=>{const b=await db.payrollPaymentBatch.findUnique({where:{id:batch.id},include:{lines:true}});const now=new Date().toISOString();return{batchId:b.id,channel:b.channel,sourceAccountId:b.sourceAccountId,amount:b.totalAmount.toFixed(2),currency:approvedRun.companySnapshot.currency,authority:'ISOLATED_TEST_ONLY',authorityRecordId:record,occurredAt:now,verifiedAt:now,beneficiaries:b.lines.map((l: any)=>({employeeId:l.employeeId,amount:l.amount.toFixed(2)})),acknowledgments:b.channel==='CASH'?b.lines.map((l: any)=>({employeeId:l.employeeId,acknowledgmentId:randomUUID(),amount:l.amount.toFixed(2),occurredAt:now})):undefined};};
  const bankProof=await proof(bank);data.set('bank',bankProof);const input={expectedVersion:1,evidenceHandle:'bank',idempotencyKey:randomUUID()};
  const otherBank=await payment.prepare({payrollRunId:approvedRun.id,sourceAccountId:bankSource.id,channel:'BANK',employeeIds:[approvedRun.lines[1].employeeId],idempotencyKey:randomUUID()},user);
  const blocked=await http(`/payroll-runs/payment-batches/${bank.id}/confirm`,input);assert.equal(blocked.status,503);
  await assert.rejects(()=>writer.confirm(bank.id,input,user));await assert.rejects(()=>writer.confirm(bank.id,{...input,evidenceHandle:'missing'},checkerUser));
  data.set('wrong',{...bankProof,sourceAccountId:cashSource.id});await assert.rejects(()=>writer.confirm(bank.id,{...input,evidenceHandle:'wrong'},checkerUser));
  for(const [key,delta] of [['bad-amount',{amount:'0.01'}],['bad-recipient',{beneficiaries:[]}],['bad-date',{occurredAt:'2000-01-01T00:00:00Z'}],['alias',{authorityRecordId:bankProof.authorityRecordId+' '}],['local-time',{occurredAt:bankProof.occurredAt.replace('Z','')}],['negative',null]] as const){data.set(key,delta===null?null:{...bankProof,...delta});await assert.rejects(()=>writer.confirm(bank.id,{...input,evidenceHandle:key},checkerUser));}
  assert.equal(await db.payrollPaymentConfirmation.count(),0);
  await db.$executeRawUnsafe(`CREATE FUNCTION confirm_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PAYROLL_PAYMENT_CONFIRMED' THEN RAISE EXCEPTION 'isolated audit failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER confirm_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION confirm_audit_failure()`);
  try{await assert.rejects(()=>writer.confirm(bank.id,input,checkerUser));assert.equal(await db.payrollPaymentConfirmation.count(),0);assert.equal((await db.payrollPaymentBatch.findUnique({where:{id:bank.id}})).status,'PREPARED');}finally{await db.$executeRawUnsafe('DROP TRIGGER confirm_audit_failure ON audit_events');await db.$executeRawUnsafe('DROP FUNCTION confirm_audit_failure()');}
  console.log('Confirmation acceptance: concurrent BANK writers');
  const results=await Promise.allSettled([engine(security.executor1).confirm(bank.id,input,checkerUser),engine(security.executor2).confirm(bank.id,{...input,idempotencyKey:randomUUID()},checkerUser)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);await assert.rejects(()=>writer.confirm(bank.id,input,checkerUser));
  data.set('bank-replay',await proof(otherBank,bankProof.authorityRecordId));
  await assert.rejects(()=>writer.confirm(otherBank.id,{expectedVersion:1,evidenceHandle:'bank-replay',idempotencyKey:randomUUID()},checkerUser),(e: any)=>e.getStatus()===409);
  assert.equal((await db.payrollPaymentBatch.findUnique({where:{id:otherBank.id}})).status,'PREPARED');
  const stored=await db.payrollPaymentConfirmation.findUnique({where:{batchId:bank.id}});
  const canonical=(await db.$queryRawUnsafe("SELECT encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') AS digest",JSON.stringify(bankProof)))[0].digest;assert.equal(stored.evidenceDigest,canonical);
  const utcProof=await proof(otherBank);const localProof={...utcProof,occurredAt:utcProof.occurredAt.replace('Z','')};
  const aliasProof={...utcProof,authorityRecordId:bankProof.authorityRecordId+' '};
  await assert.rejects(()=>security.executorClient.$transaction(async(tx: any)=>tx.$queryRawUnsafe('SELECT * FROM payroll_payment_confirm($1,1,$2,$3,$4,$5::jsonb,$6)',otherBank.id,checkerUser.id,randomUUID(),randomUUID(),JSON.stringify(aliasProof),'forged-hash'),{isolationLevel:'Serializable'}),(e: any)=>payrollPaymentErrorCode(e)==='23514');
  for(const tz of ['UTC','Asia/Dhaka','America/New_York'])await assert.rejects(()=>security.executorClient.$transaction(async(tx: any)=>{
    await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE '${tz}'`);
    await tx.$queryRawUnsafe('SELECT * FROM payroll_payment_confirm($1,1,$2,$3,$4,$5::jsonb,$6)',otherBank.id,checkerUser.id,randomUUID(),randomUUID(),JSON.stringify(localProof),'forged-digest');
  },{isolationLevel:'Serializable'}),(e: any)=>payrollPaymentErrorCode(e)==='23514');
  const cashProof=await proof(cash);data.set('cash',cashProof);data.set('missing-ack',{...cashProof,acknowledgments:cashProof.acknowledgments.slice(1)});
  await assert.rejects(()=>writer.confirm(cash.id,{expectedVersion:1,evidenceHandle:'missing-ack',idempotencyKey:randomUUID()},checkerUser));
  // Explicit isolated-only dependency injection into this harness's controller;
  // genuine login/session/role guards remain untouched. Never production config.
  const controller=app.get(load('payroll/payroll.controller.js').PayrollController),originalEngine=controller.confirmations;
  let release!: ()=>void,entered!: ()=>void;const held=new Promise<void>(r=>entered=r),permit=new Promise<void>(r=>release=r);
  pauseCash=async()=>{entered();await permit;};
  try{
    controller.confirmations=engine(security.executor1);
    const confirming=http(`/payroll-runs/payment-batches/${cash.id}/confirm`,{expectedVersion:1,evidenceHandle:'cash',idempotencyKey:randomUUID()});await held;
    const reference=randomUUID();evidence.set(reference,{batchId:cash.id,digest:'d'.repeat(64)});
    const cancelling=lifecycleFor(security.finance2).requestCancellation({batchId:cash.id,expectedVersion:1,evidenceReference:reference,idempotencyKey:randomUUID()},user).then(()=>({ok:true}),()=>({ok:false}));
    let overlapped=false;
    for(let i=0;i<100;i++){const locks=await db.$queryRawUnsafe("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'");if(locks[0].n>0){overlapped=true;break;}await new Promise(r=>setTimeout(r,10));}
    release();const response=await confirming;assert(overlapped,'Cancellation must actually overlap confirmation locks');assert.equal(response.status,201,JSON.stringify(response.body));assert.equal((await cancelling).ok,false);assert.deepEqual(Object.keys(response.body).sort(),['batchId','id','status','version']);
    assert.equal(await db.payrollCancellationRequest.count({where:{batchId:cash.id}}),0);
  }finally{release();pauseCash=undefined;controller.confirmations=originalEngine;}
  const otherCash=await payment.prepare({payrollRunId:approvedRun.id,sourceAccountId:cashSource.id,channel:'CASH',employeeIds:[approvedRun.lines[1].employeeId],idempotencyKey:randomUUID()},user);
  const cashReplay=await proof(otherCash);cashReplay.acknowledgments[0].acknowledgmentId=cashProof.acknowledgments[0].acknowledgmentId;data.set('cash-replay',cashReplay);
  await assert.rejects(()=>writer.confirm(otherCash.id,{expectedVersion:1,evidenceHandle:'cash-replay',idempotencyKey:randomUUID()},checkerUser),(e: any)=>e.getStatus()===409);
  assert.equal((await db.payrollPaymentBatch.findUnique({where:{id:otherCash.id}})).status,'PREPARED');
  data.set('other-cash',await proof(otherCash));await writer.confirm(otherCash.id,{expectedVersion:1,evidenceHandle:'other-cash',idempotencyKey:randomUUID()},checkerUser);
  assert.equal(await db.payrollPaymentConfirmation.count(),3);assert.equal(await db.payrollCashAcknowledgment.count(),2);
  assert.equal(await db.auditEvent.count({where:{action:'PAYROLL_PAYMENT_CONFIRMED'}}),3);
  assert.equal(await db.payrollPaymentReservation.count({where:{state:'CONSUMED'}}),3);
  await assert.rejects(()=>security.financeClient.$executeRawUnsafe("UPDATE payroll_payment_reservations SET state='RELEASED',version=version+1"));
  await assert.rejects(()=>db.$executeRawUnsafe("UPDATE payroll_payment_reservations SET state='RELEASED',version=version+1 WHERE state='CONSUMED'"));
  await assert.rejects(()=>db.$executeRawUnsafe('UPDATE payroll_cash_acknowledgments SET amount=amount+1'));
  await assert.rejects(()=>db.$executeRawUnsafe('INSERT INTO payroll_cash_acknowledgments SELECT id||\'_duplicate\',"confirmationId","lineId",authority,"acknowledgmentId",amount,"occurredAt" FROM payroll_cash_acknowledgments LIMIT 1'));
  await assert.rejects(()=>apiDb.$queryRawUnsafe("SELECT * FROM payroll_payment_confirm('x',1,'x','abcdefgh','x','{}'::jsonb,'x')"));
  await assert.rejects(()=>security.financeClient.payrollPaymentConfirmation.create({data:{}}));
  pass('isolated confirmation security: three confirmations/three consumed reservations/two CASH claims; actual cross-batch BANK reference and CASH receipt replay rejected with rollback, cancellation/concurrency/audit and production HTTP 503 verified');
}
