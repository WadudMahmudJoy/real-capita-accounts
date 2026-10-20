import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { payrollPaymentErrorCode } from '../apps/api/src/payroll/payroll-payment-error';
export async function reviewConfirmationSecurity(c: any) {
  const {db,apiDb,security,load,pass,databaseName}=c;
  assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(databaseName));
  const f=(await db.$queryRawUnsafe("SELECT p.prosecdef,p.proconfig,r.rolname,r.rolsuper,EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_exec FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='public.payroll_payment_confirm(text,integer,text,text,text,jsonb,text)'::regprocedure"))[0];
  assert(f.prosecdef&&!f.rolsuper&&!f.public_exec);assert.equal(f.rolname,security.migration);assert(f.proconfig.includes('search_path=pg_catalog, public, pg_temp'));
  for(const [role,allowed] of [[security.runtime,false],[security.finance,false],[security.executor,true]]){
    const rows=await db.$queryRawUnsafe("SELECT has_function_privilege($1,'public.payroll_payment_confirm(text,integer,text,text,text,jsonb,text)','EXECUTE') AS allowed",role);assert.equal(rows[0].allowed,allowed);
  }
  const denials=["SELECT * FROM payroll_payment_confirm('x',1,'forged-actor','abcdefgh','x','{}'::jsonb,'forged-hash')",'SELECT * FROM pg_authid',"SELECT pg_read_file('/etc/passwd',0,1)",`SET ROLE "${security.finance}"`,'INSERT INTO payroll_cash_acknowledgments DEFAULT VALUES','INSERT INTO payroll_payment_confirmations DEFAULT VALUES','SELECT payroll_cash_ack_guard()','CREATE FUNCTION public.review_escalation() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$'];
  for(const sql of denials)await assert.rejects(()=>apiDb.$queryRawUnsafe(sql),(e: any)=>payrollPaymentErrorCode(e)==='42501');
  await assert.rejects(()=>security.financeClient.$executeRawUnsafe('INSERT INTO payroll_cash_acknowledgments DEFAULT VALUES'),(e: any)=>payrollPaymentErrorCode(e)==='42501');
  const company=await db.company.create({data:{name:'Isolated unreferenced lock probe'}});
  const group=await db.accountGroup.findFirstOrThrow();
  const ledger=await db.ledgerAccount.create({data:{accountGroupId:group.id,code:randomUUID(),name:'Isolated lock probe',normalBalance:'DEBIT',isCashBank:true}});
  const account=await db.cashBankAccount.create({data:{ledgerAccountId:ledger.id,displayName:'Isolated unreferenced account',accountType:'BANK'}});
  const unreferencedLedger=await db.ledgerAccount.create({data:{accountGroupId:group.id,code:randomUUID(),name:'Isolated unreferenced ledger',normalBalance:'DEBIT'}});
  for(const client of [security.financeClient,security.executorClient]) {
    for(const [table,fresh] of [['companies',company.id],['cash_bank_accounts',account.id],['ledger_accounts',unreferencedLedger.id]]) {
      const existing=(await db.$queryRawUnsafe(`SELECT id FROM ${table} WHERE id<>$1 LIMIT 1`,fresh))[0].id;
      for(const id of [existing,fresh])await assert.rejects(()=>client.$executeRawUnsafe(`UPDATE ${table} SET id=$1 WHERE id=$2`,randomUUID(),id),(e: any)=>payrollPaymentErrorCode(e)==='42501');
      assert.equal((await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${table} WHERE id=ANY($1::text[])`,[existing,fresh]))[0].n,2);
    }
  }
  await assert.rejects(()=>security.financeClient.$queryRawUnsafe("SELECT * FROM payroll_payment_confirm('x',1,'x','abcdefgh','x','{}'::jsonb,'')"),(e: any)=>payrollPaymentErrorCode(e)==='42501');
  for(const sql of ['ALTER TABLE payroll_payment_batches DISABLE TRIGGER ALL','CREATE TABLE public.executor_escalation(id int)',`SET ROLE "${security.migration}"`,"UPDATE payroll_payment_batches SET status='CONFIRMED',version=version+1","UPDATE payroll_payment_reservations SET state='RELEASED',version=version+1",'INSERT INTO payroll_payment_confirmations DEFAULT VALUES'])await assert.rejects(()=>security.executorClient.$executeRawUnsafe(sql),(e: any)=>payrollPaymentErrorCode(e)==='42501');
  for(const table of ['payroll_finance_delegates','payroll_source_authorizations','payroll_source_decisions','payroll_cancellation_decisions'])await assert.rejects(()=>security.executorClient.$executeRawUnsafe(`INSERT INTO ${table} DEFAULT VALUES`),(e: any)=>payrollPaymentErrorCode(e)==='42501');
  for(const [client,role] of [[apiDb,security.executor],[security.financeClient,security.executor],[security.executorClient,security.finance]])await assert.rejects(()=>client.$queryRawUnsafe(`SET ROLE "${role}"`),(e: any)=>payrollPaymentErrorCode(e)==='42501');
  pass('four identities: master ID writes denied with and without rows; provisioning cannot confirm; executor cannot provision; cross-role assumption denied');
  const {PayrollPaymentConfirmationService,PayrollPaymentConfirmationWriter}=load('payroll/payroll-payment-confirmation.service.js');
  let called=false;
  const untrusted={isConfigured:()=>true,verify:()=>{called=true;return Promise.resolve({});}};
  const engine=new PayrollPaymentConfirmationService({},untrusted,new PayrollPaymentConfirmationWriter());
  await assert.rejects(()=>engine.confirm('batch',{expectedVersion:1,evidenceHandle:'claim',idempotencyKey:'abcdefgh'},{id:'claimed-actor',roles:[{code:'ACCOUNTANT'}]}),(e: any)=>e.getStatus()===503);assert(!called);
  pass('focused confirmation privilege review: safe restricted owner/search path, no PUBLIC/runtime EXECUTE, nine direct credential/evidence/escalation attacks denied, untrusted provider cannot acquire a production writer');
}
