import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
// Invoked ONLY by the identity-verified, harness-owned disposable database.
// Every SQL probe runs in a savepoint and the surrounding transaction rolls back.
export async function verifyDirectPaymentProbes(c: any) {
  const { probe, databaseName, db, parent, user, checkerUser, bankSource, firstBatch, cancelledBatch, sourceActionId, pass }=c;
  assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(databaseName));
  assert.equal((await probe.query('SELECT current_database() AS db')).rows[0].db,databaseName);
  const line=await db.payrollPaymentLine.findFirst({where:{batchId:firstBatch.id}});
  const granted=await db.payrollSourceAuthorization.findFirst({where:{sourceAccountId:bankSource.id},orderBy:{generation:'desc'}});
  const before=await db.payrollPaymentBatch.findMany({include:{lines:true,confirmation:true},orderBy:{id:'asc'}});
  const reservations=await db.payrollPaymentReservation.findMany({orderBy:{id:'asc'}});
  const probes: [string,string,unknown[],string][]=[
    ['unreviewed release',`UPDATE payroll_payment_reservations SET state='RELEASED',version=version+1 WHERE "lineId"=$1`,[line.id],'23514'],
    ['reservation deletion',`DELETE FROM payroll_payment_reservations WHERE "lineId"=$1`,[line.id],'23514'],
    ['unattested consumption',`UPDATE payroll_payment_reservations SET state='CONSUMED',version=version+1 WHERE "lineId"=$1`,[line.id],'23514'],
    ['confirmed insertion',`INSERT INTO payroll_payment_reservations(id,"payrollRunLineId",channel,"lineId",state,version) VALUES($1,$2,'BANK',$3,'CONSUMED',1)`,[randomUUID(),line.payrollRunLineId,line.id],'23514'],
    ['unpaired paid transition',`UPDATE payroll_payment_batches SET status='CONFIRMED',version=version+1 WHERE id=$1`,[firstBatch.id],'23514'],
    ['unreviewed cancellation',`UPDATE payroll_payment_batches SET status='CANCELLED',version=version+1 WHERE id=$1`,[firstBatch.id],'23514'],
    ['cancelled reopening',`UPDATE payroll_payment_batches SET status='PREPARED',version=version+1 WHERE id=$1`,[cancelledBatch.id],'23514'],
    ['instruction alteration',`UPDATE payroll_payment_lines SET amount=amount+0.01 WHERE id=$1`,[line.id],'23514'],
    ['source revision forgery',`UPDATE cash_bank_accounts SET "payrollMaterialVersion"="payrollMaterialVersion"+10 WHERE id=$1`,[bankSource.id],'23514'],
    ['grant history overwrite',`UPDATE payroll_source_authorizations SET "expiresAt"=NULL WHERE id=$1`,[granted.id],'23514'],
    ['grant self-review',`INSERT INTO payroll_source_decisions(id,"actionId","reviewedById","authorityReference","auditSnapshot") VALUES($1,$2,$3,'claimed authority',jsonb_build_object('actorId',$3::text))`,[randomUUID(),sourceActionId,user.id],'23514'],
    ['durable decision alteration',`UPDATE payroll_source_decisions SET "authorityReference"='replacement' WHERE "reviewedById"=$1`,[checkerUser.id],'23514'],
    ['invalid delegate identity',`INSERT INTO payroll_finance_delegates(id,"companyId","userId",generation,"initiatedById","reviewedById","authorityReference","auditSnapshot") VALUES($1,$2,'missing-user',1,'missing-init','missing-review','isolated invalid fixture','{}')`,[randomUUID(),parent.id],'23514'],
    ['truncate history',`TRUNCATE payroll_source_authorizations CASCADE`,[],'23514'],
    ['reserved obligation edit',`UPDATE payroll_run_lines SET "bankPay"="bankPay"+0.01 WHERE id=$1`,[line.payrollRunLineId],'23514'],
    ['batch total overwrite',`UPDATE payroll_payment_batches SET "totalAmount"="totalAmount"+0.01 WHERE id=$1`,[firstBatch.id],'23514'],
  ];
  await probe.query('BEGIN');
  try {
    for(const [name,sql,args,code] of probes) {
      await probe.query('SAVEPOINT integrity_probe');
      try { await probe.query(sql,args); assert.fail(`SQL bypass accepted: ${name}`); }
      catch(e: any){assert.equal(e.code,code,name);}
      finally {await probe.query('ROLLBACK TO SAVEPOINT integrity_probe');}
    }
  } finally {await probe.query('ROLLBACK');}
  assert.deepEqual(await db.payrollPaymentBatch.findMany({include:{lines:true,confirmation:true},orderBy:{id:'asc'}}),before);
  assert.deepEqual(await db.payrollPaymentReservation.findMany({orderBy:{id:'asc'}}),reservations);
  assert.equal(await db.payrollPaymentConfirmation.count(),0);
  pass(`${probes.length} real direct-SQL negative probes reject lifecycle/history/revision/financial bypasses; exact rows restored and zero confirmations`);
}
