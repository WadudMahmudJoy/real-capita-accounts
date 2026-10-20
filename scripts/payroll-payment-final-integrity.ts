import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { payrollPaymentErrorCode } from "../apps/api/src/payroll/payroll-payment-error";
// Reuses the existing isolated application-fixture harness. No real delegates,
// external evidence, confirmations or server-wide roles are provisioned.
export async function verifyPaymentFinalIntegrity(c: any) {
  const {db,c1,c2,lifecycleFor,parent,actor,checker,user,checkerUser,bankSource,pass,databaseName}=c;
  assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(databaseName));
  for(const client of [db,c1,c2])assert.equal((await client.$queryRawUnsafe('SELECT current_database() AS db'))[0].db,databaseName);
  const designation=(generation: number,expiresAt?: Date)=>({companyId:parent.id,userId:actor.id,canInitiate:true,canReview:true,generation,initiatedById:actor.id,reviewedById:checker.id,expiresAt,authorityReference:'ISOLATED_SYNTHETIC_NOT_BUSINESS_DELEGATION',auditSnapshot:{actorId:actor.id,reviewerId:checker.id,fixtureOnly:true}});
  const revoke=async(id: string)=>db.payrollFinanceDelegateRevocation.create({data:{delegateId:id,initiatedById:actor.id,reviewedById:checker.id,authorityReference:'ISOLATED_SYNTHETIC_REVOCATION',auditSnapshot:{actorId:actor.id,reviewerId:checker.id,fixtureOnly:true}}});
  await verifyPaymentChronology(c);
  for(const zone of ['UTC','Asia/Dhaka','America/New_York']) {
    await c1.$executeRawUnsafe(`SET TIME ZONE '${zone}'`);
    const service=lifecycleFor(c1),expiry=new Date(Date.now()+1600);
    const grant=await service.requestGrant({sourceAccountId:bankSource.id,channel:'BANK',expiresAt:expiry.toISOString(),idempotencyKey:randomUUID()},user);
    await service.reviewSourceAction(grant.actionId,checkerUser);
    const record=await c1.payrollSourceAuthorization.findUnique({where:{id:grant.grantId}});
    assert.equal(record.expiresAt.toISOString(),expiry.toISOString()); assert(Math.abs(Date.now()-record.grantedAt.getTime())<1500);
    await c1.$transaction(async(tx: any)=>{
      assert.equal((await tx.$queryRawUnsafe('SELECT payroll_payment_grant_valid($1) AS valid',grant.grantId))[0].valid,true);
      await tx.$queryRawUnsafe('WITH delay AS MATERIALIZED (SELECT pg_sleep(1.7)) SELECT true AS waited FROM delay');
      assert.equal((await tx.$queryRawUnsafe('SELECT payroll_payment_grant_valid($1) AS valid',grant.grantId))[0].valid,false);
    },{timeout:5000});
    const a=await c1.payrollSourceAction.findUnique({where:{id:grant.actionId},include:{decision:true}});
    assert(a.createdAt.getTime()>=record.grantedAt.getTime());assert(a.decision.reviewedAt.getTime()>=a.createdAt.getTime());
  }
  await c1.$executeRawUnsafe("SET TIME ZONE 'UTC'");
  pass('PostgreSQL UTC defaults, Date input round-trip and wall-clock expiry agree in UTC, Dhaka and New York sessions, including long transactions');
  const pending=await lifecycleFor(db).requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:randomUUID()},user);
  await db.$transaction(async(tx: any)=>{
    const probes: [string,string,unknown[],string][]=[
      ['decision predates request',`INSERT INTO payroll_source_decisions(id,"actionId","reviewedById","reviewedAt","authorityReference","auditSnapshot") SELECT $1,id,$2,"createdAt"-interval '1 day','claimed reference',jsonb_build_object('actorId',$2::text) FROM payroll_source_actions WHERE id=$3`,[randomUUID(),checker.id,pending.actionId],'23514'],
      ['original grantor self-review',`INSERT INTO payroll_source_decisions(id,"actionId","reviewedById","authorityReference","auditSnapshot") VALUES($1,$2,$3,'claimed reference',jsonb_build_object('actorId',$3::text))`,[randomUUID(),pending.actionId,actor.id],'23514'],
      ['action predates grant',`INSERT INTO payroll_source_actions(id,"grantId",kind,"initiatedById","createdAt","idempotencyKey","auditSnapshot") SELECT $1,id,'REVOKE',$2,"grantedAt"-interval '1 day',$3,jsonb_build_object('actorId',$2::text) FROM payroll_source_authorizations WHERE id=$4`,[randomUUID(),actor.id,randomUUID(),pending.grantId],'23514'],
      ['self-designation review',`INSERT INTO payroll_finance_delegates(id,"companyId","userId",generation,"initiatedById","reviewedById","authorityReference","auditSnapshot") VALUES($1,$2,$3,2,$3,$3,'claimed reference',jsonb_build_object('actorId',$3::text,'reviewerId',$3::text))`,[randomUUID(),parent.id,actor.id],'23514'],
    ];
    for(const [name,sql,args,code]of probes){await tx.$executeRawUnsafe('SAVEPOINT final_probe');try{await tx.$executeRawUnsafe(sql,...args);assert.fail(name);}catch(e){assert.equal(payrollPaymentErrorCode(e),code,name);}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT final_probe');}}
  });
  pass('PostgreSQL impossible source chronology, original grantor self-review and self-designation are rejected directly');
  const original=await db.payrollFinanceDelegate.findFirst({where:{companyId:parent.id,userId:actor.id},orderBy:{generation:'desc'}});
  await assert.rejects(()=>db.payrollFinanceDelegate.create({data:designation(2)}),(e: any)=>payrollPaymentErrorCode(e)==='23514');
  await revoke(original.id);
  assert.equal((await db.$queryRawUnsafe('SELECT payroll_payment_delegate($1,$2,false) AS valid',parent.id,actor.id))[0].valid,false);
  await assert.rejects(()=>lifecycleFor(db).requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:randomUUID()},user),(e: any)=>e.getStatus()===403);
  const expiring=await db.payrollFinanceDelegate.create({data:designation(2,new Date(Date.now()+1800))});
  await c2.$executeRawUnsafe("SET TIME ZONE 'Asia/Dhaka'");
  const waitingGrant=await lifecycleFor(db).requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:randomUUID()},user);
  assert.equal((await c2.$queryRawUnsafe('SELECT payroll_payment_delegate($1,$2,false) AS valid',parent.id,actor.id))[0].valid,true);
  let waitingReview: Promise<any>;
  await db.$transaction(async(tx: any)=>{
    await tx.$queryRawUnsafe('SELECT id FROM cash_bank_accounts WHERE id=$1 FOR UPDATE',bankSource.id);
    waitingReview=lifecycleFor(c1).reviewSourceAction(waitingGrant.actionId,checkerUser).then((value: any)=>({value}),(error: any)=>({error}));
    await tx.$queryRawUnsafe('WITH delay AS MATERIALIZED (SELECT pg_sleep(1.9)) SELECT true AS waited FROM delay');
  },{timeout:5000});
  const waited=await waitingReview!;assert.equal(waited.error?.getStatus(),409);
  assert.equal(await db.payrollSourceDecision.count({where:{actionId:waitingGrant.actionId}}),0);
  assert.equal((await c2.$queryRawUnsafe('SELECT payroll_payment_delegate($1,$2,false) AS valid',parent.id,actor.id))[0].valid,false);
  await c2.$executeRawUnsafe("SET TIME ZONE 'UTC'");
  await assert.rejects(()=>lifecycleFor(db).requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:randomUUID()},user),(e: any)=>e.getStatus()===403);
  await assert.rejects(()=>db.payrollFinanceDelegate.create({data:{...designation(3),requestedAt:new Date(Date.now()+86400000)}}),(e: any)=>payrollPaymentErrorCode(e)==='23514');
  await assert.rejects(()=>db.payrollFinanceDelegateRevocation.create({data:{delegateId:expiring.id,initiatedById:actor.id,reviewedById:checker.id,requestedAt:expiring.authorizedAt,revokedAt:new Date(expiring.authorizedAt.getTime()-1000),authorityReference:'synthetic-only',auditSnapshot:{actorId:actor.id,reviewerId:checker.id}}}),(e: any)=>payrollPaymentErrorCode(e)==='23514');
  const renewed=await db.payrollFinanceDelegate.create({data:designation(3)});
  assert.equal((await db.$queryRawUnsafe('SELECT payroll_payment_delegate($1,$2,false) AS valid',parent.id,actor.id))[0].valid,true);
  assert.deepEqual(await db.payrollFinanceDelegate.findUnique({where:{id:original.id}}),original);
  assert.equal((await db.payrollFinanceDelegate.findUnique({where:{id:expiring.id}})).expiresAt.toISOString(),expiring.expiresAt.toISOString());
  await revoke(renewed.id);
  const competing=await Promise.allSettled([c1.payrollFinanceDelegate.create({data:designation(4)}),c2.payrollFinanceDelegate.create({data:designation(4)})]);
  assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);for(const r of competing)if(r.status==='rejected')assert(['23514','23505','P2002','P2034'].includes(payrollPaymentErrorCode(r.reason)));
  assert.equal(await db.payrollFinanceDelegate.count({where:{companyId:parent.id,userId:actor.id,generation:4}}),1);
  pass('PostgreSQL immutable delegation expiry/revocation and independent re-designation preserve history and prevent overlapping/concurrent active authority');
  await db.$transaction(async(tx: any)=>{
    await tx.$executeRawUnsafe('SET LOCAL ROLE pg_read_all_data');await tx.$executeRawUnsafe('SAVEPOINT privilege_probe');
    try{await tx.$executeRawUnsafe(`INSERT INTO payroll_finance_delegates(id,"companyId","userId",generation,"initiatedById","reviewedById","authorityReference","auditSnapshot") VALUES($1,$2,$3,5,$3,$4,'free text','{}')`,randomUUID(),parent.id,actor.id,checker.id);assert.fail('Read-only role created delegation');}
    catch(e){assert.equal(payrollPaymentErrorCode(e),'42501');}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT privilege_probe');}
  });
  assert.equal(await db.payrollFinanceDelegate.count({where:{companyId:parent.id,userId:actor.id}}),4);assert.equal(await db.payrollPaymentConfirmation.count(),0);
  pass('PostgreSQL non-provisioning role cannot create finance authority; no role/permission grants or confirmations were created');
  if(!c.privilegesSeparated) console.log('BLOCKED deployment privilege acceptance: configured application identity is an owning superuser; PUBLIC revocation cannot restrict it. Separate non-owning runtime and trusted provisioning credentials are required.');
}
async function verifyPaymentChronology(c: any) {
  const {db,lifecycleFor,actor,checker,user,pass}=c;
  const prepared=await db.payrollPaymentBatch.findFirst({where:{status:'PREPARED',channel:'BANK'}});
  assert(prepared);assert.equal((await db.$queryRawUnsafe('SELECT payroll_payment_grant_valid($1) AS valid',prepared.sourceAuthorizationId))[0].valid,true);
  const cancellation=await lifecycleFor(db).requestCancellation({batchId:prepared.id,expectedVersion:prepared.version,evidenceReference:'untrusted-proposed-only',idempotencyKey:randomUUID()},user);
  await db.$transaction(async(tx: any)=>{
    const probes: [string,string,unknown[]][]=[
      ['cancellation predates batch',`INSERT INTO payroll_cancellation_requests(id,"batchId","expectedVersion","initiatedById","createdAt","evidenceReference","idempotencyKey","auditSnapshot") SELECT $1,id,version,$2,"createdAt"-interval '1 day','proposed-only',$3,jsonb_build_object('actorId',$2::text) FROM payroll_payment_batches WHERE id=$4`,[randomUUID(),actor.id,randomUUID(),prepared.id]],
      ['decision predates cancellation',`INSERT INTO payroll_cancellation_decisions(id,"requestId","reviewedById","reviewedAt","evidenceDigest","verificationAuthority","verifiedAt","auditSnapshot") SELECT $1,id,$2,"createdAt"-interval '1 day',repeat('a',64),'synthetic-only',"createdAt",jsonb_build_object('actorId',$2::text) FROM payroll_cancellation_requests WHERE id=$3`,[randomUUID(),checker.id,cancellation.requestId]],
      ['confirmation predates instruction',`INSERT INTO payroll_payment_confirmations(id,"batchId","confirmedById","confirmedAt","evidenceKind","evidenceReference","evidenceDigest","verificationAuthority","verifiedAt",attestation,"auditSnapshot","idempotencyKey") SELECT $1,id,$2,"createdAt"-interval '1 day','BANK_TRANSACTION','synthetic-only',repeat('a',64),'synthetic-only',"createdAt"-interval '1 day',jsonb_build_object('verifierId',$2::text),jsonb_build_object('actorId',$2::text),$3 FROM payroll_payment_batches WHERE id=$4`,[randomUUID(),checker.id,randomUUID(),prepared.id]],
    ];
    for(const [name,sql,args]of probes){await tx.$executeRawUnsafe('SAVEPOINT chronology_probe');try{await tx.$executeRawUnsafe(sql,...args);assert.fail(name);}catch(e){assert.equal(payrollPaymentErrorCode(e),'23514',name);}finally{await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT chronology_probe');}}
  });
  assert.equal(await db.payrollPaymentConfirmation.count(),0);
  pass('PostgreSQL cancellation requests/decisions and confirmation timestamps cannot predate instructions; zero confirmations retained');
}
