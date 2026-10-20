import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
async function main(){
  assert.equal(process.platform,'win32','Private startup requires Windows identity wrapper');
  const sid=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8'}).trim();
  assert.equal(sid,process.env.PRIVATE_WORKER_EXPECTED_SID);assert.notEqual(sid,process.env.PRIVATE_WORKER_API_SID);
  const value=process.env.PRIVATE_WORKER_DATABASE_URL;assert(value);
  const role=process.env.PRIVATE_WORKER_ROLE,purpose=process.env.PRIVATE_WORKER_PURPOSE;
  assert(role&&['provisioning','confirmation'].includes(purpose??''));
  const url=new URL(value);assert(['postgres:','postgresql:'].includes(url.protocol));assert.equal(url.hostname,'localhost');assert.equal(url.port,'55532');assert.equal(url.pathname,'/real_capita_accounts_salary_dev');assert.equal(decodeURIComponent(url.username),role);
  const req=createRequire(resolve('package.json')),{Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');const client=new Client({connectionString:value});
  try{
    await client.connect();
    const r=(await client.query(`SELECT current_database() db,current_user actor,r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolbypassrls,r.rolreplication,
      EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) member,
      EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=r.oid) db_owner,
      EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=r.oid) object_owner,
      EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proowner=r.oid) function_owner,
      has_schema_privilege(current_user,'public','CREATE') schema_create,
      has_database_privilege(current_database(),'TEMP') temp FROM pg_roles r WHERE rolname=current_user`)).rows[0];
    assert.equal(r.db,'real_capita_accounts_salary_dev');assert.equal(r.actor,role);
    for(const key of ['rolsuper','rolcreatedb','rolcreaterole','rolbypassrls','rolreplication','member','db_owner','object_owner','function_owner','schema_create','temp'])assert.equal(r[key],false);
    for(const table of ['companies','cash_bank_accounts','ledger_accounts']){
      assert.equal((await client.query("SELECT has_column_privilege(current_user,$1,'id','UPDATE') allowed",[table])).rows[0].allowed,false);
    }
    const fn="public.payroll_payment_confirm(text,integer,text,text,text,jsonb,text)";
    assert.equal((await client.query("SELECT has_function_privilege(current_user,$1,'EXECUTE') allowed",[fn])).rows[0].allowed,purpose==='confirmation');
    const available=(await client.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles o ON o.oid=p.proowner WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege(p.oid,'EXECUTE') AND (o.rolsuper OR NOT coalesce(p.proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp'],false) OR p.proname NOT IN ('payroll_payment_source_snapshot','payroll_payment_lock_obligations','payroll_payment_lock_parent','payroll_payment_confirm'))`)).rows;assert.equal(available.length,0);
    if(purpose==='confirmation')for(const table of ['payroll_finance_delegates','payroll_source_authorizations','payroll_source_decisions','payroll_cancellation_decisions','payroll_payment_confirmations','payroll_cash_acknowledgments','payroll_payment_batches','payroll_payment_reservations']) {
      for(const privilege of ['INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await client.query('SELECT has_table_privilege(current_user,$1,$2) allowed',[table,privilege])).rows[0].allowed,false);
    }
    console.log('PASS private worker target, role, ownership, safe-function and privilege attestation; no payment action');
  }finally{await client.end();}
}
main().catch(()=>{console.error('Private startup refused (credential-bearing details suppressed)');process.exitCode=1;});
