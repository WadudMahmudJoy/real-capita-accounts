import { payrollPaymentErrorCode } from "../../apps/api/src/payroll/payroll-payment-error";
import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import { provisionDatabaseRoles } from "./role-profile";
import { assertRuntimeDatabase,runtimeDatabaseUrl } from "../../apps/api/src/prisma/database-security";
export async function createRoleSecurityContext(c: any) {
  const {db,isolatedUrl,databaseName,load,req,clients}=c;
  assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(databaseName));assert.equal(isolatedUrl.hostname,'127.0.0.1');assert(!['55532','55432'].includes(isolatedUrl.port));
  const suffix=databaseName.slice(-20),migration=`rc_owner_${suffix}`,runtime=`rc_runtime_${suffix}`,finance=`rc_finance_${suffix}`,executor=`rc_confirm_${suffix}`;
  const passwords={ [migration]:randomBytes(32).toString('hex'),[runtime]:randomBytes(32).toString('hex'),[finance]:randomBytes(32).toString('hex'),[executor]:randomBytes(32).toString('hex') };
  const {Client}=require('node:module').createRequire(req.resolve('@prisma/adapter-pg'))('pg');
  const admin=new Client({connectionString:isolatedUrl.toString()});await admin.connect();
  try{await provisionDatabaseRoles(admin,{database:databaseName,migration,runtime,finance,executor,passwords});for(const t of ['companies','cash_bank_accounts','ledger_accounts'])await admin.query(`GRANT UPDATE(id) ON ${t} TO "${finance}"`);await provisionDatabaseRoles(admin,{database:databaseName,migration,runtime,finance,executor,passwords});}finally{await admin.end();}
  const url=(role: string)=>{const u=new URL(isolatedUrl);u.username=role;u.password=passwords[role];return u.toString();};
  const {PrismaClient}=load('generated/prisma/client.js'),{PrismaPg}=req('@prisma/adapter-pg');
  const make=async(role: string)=>{const client=new PrismaClient({adapter:new PrismaPg({connectionString:url(role),max:1})});clients.push(client);await client.$connect();assert.equal((await client.$queryRawUnsafe('SELECT current_database() AS db'))[0].db,databaseName);return client;};
  const runtimeClient=await make(runtime),financeClient=await make(finance),finance1=await make(finance),finance2=await make(finance),executorClient=await make(executor),executor1=await make(executor),executor2=await make(executor);
  await assertRuntimeDatabase(sql=>runtimeClient.$queryRawUnsafe(sql),databaseName);
  const mapping=new Map<any,any>([[db,financeClient],[runtimeClient,financeClient],[financeClient,financeClient],[finance1,finance1],[finance2,finance2]]);
  let runtimeCount=0;const newRuntime=async()=>{const r=await make(runtime);mapping.set(r,runtimeCount++===0?finance1:finance2);return r;};
  const oldRuntime=process.env.RUNTIME_DATABASE_URL,oldName=process.env.RUNTIME_DATABASE_NAME;
  try{process.env.RUNTIME_DATABASE_URL=url(runtime);process.env.RUNTIME_DATABASE_NAME=databaseName;const {PrismaService}=load('prisma/prisma.service.js');const service=new PrismaService();await service.onModuleInit();await service.onModuleDestroy();}finally{if(oldRuntime===undefined)delete process.env.RUNTIME_DATABASE_URL;else process.env.RUNTIME_DATABASE_URL=oldRuntime;if(oldName===undefined)delete process.env.RUNTIME_DATABASE_NAME;else process.env.RUNTIME_DATABASE_NAME=oldName;}
  console.log('PASS actual runtime startup attestation, four non-superuser/no-membership identities, owned migration objects and idempotent privilege provisioning');
  return {migration,runtime,finance,executor,executorClient,executor1,executor2,url,runtimeClient,financeClient,finance1,finance2,newRuntime,financeFor:(client: any)=>{assert(mapping.has(client),'Unknown finance client');return mapping.get(client);}};
}
export async function verifyScopedDatabaseSecurity(c: any) {
  const {db,security,load,req,bankSource,approvedRun,user,checkerUser,lifecycleFor,pass}=c;
  const runtime=security.runtimeClient;
  assert.equal(runtimeDatabaseUrl({RUNTIME_DATABASE_URL:security.url(security.runtime),RUNTIME_DATABASE_NAME:c.databaseName}),security.url(security.runtime));
  assert.throws(()=>runtimeDatabaseUrl({DATABASE_URL:security.url(security.migration)}));assert.throws(()=>runtimeDatabaseUrl({RUNTIME_DATABASE_URL:security.url(security.runtime),RUNTIME_DATABASE_NAME:c.databaseName,MIGRATION_DATABASE_URL:security.url(security.migration)}));
  await assert.rejects(()=>assertRuntimeDatabase(sql=>db.$queryRawUnsafe(sql),c.databaseName));
  const probes=[
    'CREATE TABLE public.runtime_intruder(id int)',
    'CREATE TEMP TABLE runtime_intruder(id int)',
    'ALTER TABLE payroll_payment_batches DISABLE TRIGGER ALL',
    'ALTER TABLE payroll_payment_batches ADD COLUMN intrusion int',
    'DROP TABLE payroll_payment_reservations',
    'INSERT INTO payroll_finance_delegates DEFAULT VALUES',
    'INSERT INTO payroll_finance_delegate_revocations DEFAULT VALUES',
    'INSERT INTO payroll_source_authorizations DEFAULT VALUES',
    'INSERT INTO payroll_source_actions DEFAULT VALUES',
    'INSERT INTO payroll_source_decisions DEFAULT VALUES',
    'INSERT INTO payroll_cancellation_decisions DEFAULT VALUES',
    'INSERT INTO payroll_payment_confirmations DEFAULT VALUES',
    "UPDATE payroll_payment_reservations SET state='RELEASED',version=version+1",
    "UPDATE payroll_payment_batches SET status='CONFIRMED',version=version+1",
    'DELETE FROM payroll_payment_lines',
    'TRUNCATE payroll_payment_lines CASCADE',
    `SET ROLE "${security.finance}"`,
    `SET ROLE "${security.migration}"`,
    "SET session_replication_role='replica'",
  ];
  for(const sql of probes)await assert.rejects(()=>runtime.$executeRawUnsafe(sql),(e: any)=>payrollPaymentErrorCode(e)==='42501');
  const elevated=await runtime.$queryRawUnsafe("SELECT proname,proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND prosecdef ORDER BY proname");
  assert.deepEqual(elevated.map((r: any)=>r.proname),['payroll_payment_confirm','payroll_payment_line_guard','payroll_payment_lock_obligations','payroll_payment_lock_parent','payroll_payment_reserve_line','payroll_payment_source_snapshot','payroll_payment_transition_reservations','payroll_payment_source_action_guard','payroll_payment_source_decision_guard','payroll_payment_cancellation_request_guard','payroll_payment_cancellation_decision_guard','payroll_payment_delegate_designation_guard','payroll_payment_delegate_revocation_guard'].sort());assert(elevated.every((r: any)=>r.proconfig.includes('search_path=pg_catalog, public, pg_temp')));
  await assert.rejects(()=>runtime.$queryRawUnsafe('SELECT payroll_payment_reserve_line()'));
  pass('19 real runtime privilege attacks denied: DDL, trigger disabling, temp objects, authority/evidence writes, payment states, reservations and provisioning impersonation');
  const {PayrollParentResolver}=load('payroll/payroll-parent.resolver.js'),{PayrollPaymentBatchService}=load('payroll/payroll-payment-batch.service.js'),{PayrollPaymentPreparationService}=load('payroll/payroll-payment-preparation.service.js'),{PayrollDocumentsService}=load('payroll/payroll-documents.service.js');
  const fin=lifecycleFor(security.financeClient),g=await fin.requestGrant({sourceAccountId:bankSource.id,channel:'BANK',idempotencyKey:randomUUID()},user);await fin.reviewSourceAction(g.actionId,checkerUser);
  const doc=new PayrollDocumentsService(runtime,new PayrollParentResolver(runtime));assert.equal((await doc.salarySheet(approvedRun.id)).employeeCount,2);
  const payments=new PayrollPaymentBatchService(runtime,new PayrollParentResolver(runtime),new PayrollPaymentPreparationService(runtime,doc));
  const run=await db.payrollPaymentBatch.findMany({where:{payrollRunId:approvedRun.id,status:'PREPARED',channel:'BANK'},include:{lines:true}});
  const consumed=new Set(run.flatMap((b: any)=>b.lines.map((l: any)=>l.employeeId)));
  const available=approvedRun.lines.find((l: any)=>!consumed.has(l.employeeId));
  if(available){const result=await payments.prepare({payrollRunId:approvedRun.id,sourceAccountId:bankSource.id,channel:'BANK',employeeIds:[available.employeeId],idempotencyKey:randomUUID()},user);assert.equal(result.status,'PREPARED');assert.equal(result.lines.length,1);assert.equal((await runtime.payrollPaymentReservation.findFirst({where:{line:{batchId:result.id}}})).state,'HELD');}
  else assert.fail('Isolated fixture needs a released bank allocation');
  pass('private non-superuser finance authority workflow succeeds; runtime approved documents/full-allocation preparation succeeds through bounded reservation trigger without direct reservation privilege');
  const beforeVoucher=await runtime.voucher.count(),rollback=Symbol('accounting rollback');
  try { await runtime.$transaction(async(tx: any)=>{
    const scoped=new Proxy(runtime,{get(_target,key){if(key==='$transaction')return async(fn: any)=>fn(tx);return Reflect.get(tx,key);}});
    const fiscal=new (load('fiscal-year/fiscal-year.service.js').FiscalYearService)(scoped);
    const fy=await fiscal.create(c.office.id,{companyId:c.office.id,name:'Isolated Runtime FY',startDate:'2026-01-01',endDate:'2026-12-31'});
    const period=await new (load('accounting-period/accounting-period.service.js').AccountingPeriodService)(scoped).create(c.office.id,{fiscalYearId:fy.id,name:'Isolated Runtime Period',startDate:'2026-01-01',endDate:'2026-12-31'});
    const group=await tx.accountGroup.findFirst();const ledgers=[];
    for(const code of ['SECDEBIT','SECCREDIT'])ledgers.push(await tx.ledgerAccount.create({data:{accountGroupId:group.id,code,name:'Isolated Runtime Ledger',normalBalance:'DEBIT'}}));
    const voucher=await new (load('voucher/voucher.service.js').VoucherService)(scoped).create(c.office.id,{fiscalYearId:fy.id,accountingPeriodId:period.id,voucherType:'JOURNAL',voucherDate:'2026-09-01',narration:'Rollback-only technical privilege test',lines:[{side:'DEBIT',ledgerAccountId:ledgers[0].id,amount:1},{side:'CREDIT',ledgerAccountId:ledgers[1].id,amount:1}]},{userId:user.id,ipAddress:null,userAgent:'isolated technical fixture'});
    assert.equal(voucher.status,'DRAFT');assert.equal(voucher.totalDebit.toFixed(2),'1.00');throw rollback;
  });assert.fail('Accounting probe did not roll back');}catch(e){assert.equal(e,rollback);}
  assert.equal(await runtime.voucher.count(),beforeVoucher);
  pass('real runtime fiscal-year/period/ledger and VoucherService DRAFT creation succeeds inside rollback-only PostgreSQL transaction; no posting or retained accounting records');
  const migrationStatus=require('node:child_process').execFileSync(process.execPath,[req.resolve('prisma/build/index.js'),'migrate','status'],{encoding:'utf8',env:{...process.env,MIGRATION_DATABASE_URL:security.url(security.migration),RUNTIME_DATABASE_URL:undefined,DATABASE_URL:undefined}});assert(migrationStatus.includes('up to date'));
  pass('actual Prisma migration status uses separate non-superuser owner credentials; API rejects owner fallback and privileged secrets');
}
