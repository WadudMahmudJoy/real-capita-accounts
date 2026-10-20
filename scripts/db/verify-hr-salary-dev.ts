// Post-deployment verifier: read-only connections; never deploys or provisions.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {assertRuntimeDatabase,runtimeDatabaseUrl} from '../../apps/api/src/prisma/database-security';
import {verifyHrDeploymentCatalog} from './verify-hr-deployment-catalog';
import {hrTables} from './hr-runtime-privileges';
const req=createRequire(resolve('package.json')),target='real_capita_accounts_salary_dev';
async function main(){
 assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'Joy');
 const directory=process.env.SALARY_BACKUP_DIRECTORY,privateDirectory=process.env.SALARY_PRIVATE_DIRECTORY;assert(directory&&privateDirectory);
 const before=JSON.parse(readFileSync(join(directory,'hr-deployment-before.json'),'utf8')),saved=JSON.parse(readFileSync(join(directory,'preflight.json'),'utf8'));
 assert.equal(createHash('sha256').update(readFileSync(join(directory,'salary-dev.dump'))).digest('hex'),saved.backup.sha256);
 const file=join(privateDirectory,'maintenance.clixml');assert(!file.includes("'"));
 const value=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$s=Import-Clixml -LiteralPath '${file}';$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const url=new URL(value);assert.equal(url.host,'localhost:55532');assert.equal(url.pathname,'/'+target);
 const local=req('dotenv').parse(readFileSync('.env')),runtimeUrl=runtimeDatabaseUrl(local),r=new URL(runtimeUrl);assert.equal(r.host,url.host);assert.equal(r.pathname,url.pathname);
 const {Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg'),db=new Client({connectionString:value,options:'-c default_transaction_read_only=on'}),runtime=new Client({connectionString:runtimeUrl,options:'-c default_transaction_read_only=on'});
 try{
  await db.connect();const identity=(await db.query("SELECT current_database() AS db,current_setting('server_version_num')::int AS version")).rows[0];assert.equal(identity.db,target);assert(identity.version>=170000&&identity.version<180000);
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL TIME ZONE 'UTC'");
  const migrations=(await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;assert.equal(migrations.length,16);assert(migrations.every((m:any)=>m.finished_at&&!m.rolled_back_at&&m.migration_name!=='20261015000000_payroll_confirmation_evidence'));
  for(const m of migrations)assert.equal(m.checksum,createHash('sha256').update(readFileSync(join('prisma/migrations',m.migration_name,'migration.sql'))).digest('hex'));
  assert.deepEqual(migrations.slice(0,14).map((m:any)=>({name:m.migration_name,checksum:m.checksum})),saved.migrations.map((m:any)=>({name:m.migration_name,checksum:m.checksum})));
  const originalHistory=saved.records.find((r:any)=>r.table==='_prisma_migrations');
  const originalRows=(await db.query("SELECT count(*)::int AS count,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS fingerprint FROM (SELECT md5(row_to_json(t)::text) AS h FROM _prisma_migrations t WHERE migration_name=ANY($1::text[])) q",[saved.migrations.map((m:any)=>m.migration_name)])).rows[0];assert.equal(originalRows.count,originalHistory.count);assert.equal(originalRows.fingerprint,originalHistory.fingerprint);
  for(const row of before.canonicalRecords){assert(/^[a-z_]+$/.test(row.table));const record=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS fingerprint FROM (SELECT md5((to_jsonb(t)-'${row.table==='users'?'adminVersion':'__no_added_column__'}')::text) AS h FROM "${row.table}" t) q`)).rows[0];assert.equal(record.count,row.count);assert.equal(record.fingerprint,row.fingerprint);}
  assert.equal((await db.query('SELECT count(*)::int AS n FROM users WHERE "adminVersion"<>1')).rows[0].n,0);
  for(const table of hrTables)assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n,0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n,56);
  const parent=(await db.query('SELECT id,name,"legalName","isActive","singletonKey" FROM companies WHERE "singletonKey"=\'PRIMARY\'')).rows;assert.deepEqual(parent,[saved.parent]);
  assert.equal((await db.query("SELECT to_regclass('public.payroll_cash_acknowledgments')::text AS t")).rows[0].t,null);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('payroll_payment_confirm','payroll_cash_ack_guard','payroll_payment_confirmation_coverage','payroll_payment_lock_parent')")).rows[0].n,0);
  assert.equal((await db.query("SELECT to_regclass('public.authority_mandates')::text AS authority,to_regclass('public.leave_workflows')::text AS workflow,to_regclass('public.leave_stage_decisions')::text AS decisions")).rows.some((r:any)=>r.authority||r.workflow||r.decisions),false);
  const catalog=await verifyHrDeploymentCatalog(db,['20261016000000_leave_request_foundation','20261017000000_hr_admin_identity'].map(m=>join('prisma/migrations',m,'migration.sql')),'rc_salary_migration');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated")).rows[0].n,0);
  const databaseAcl=(await db.query("SELECT grantor::regrole::text,grantee::regrole::text,privilege_type,is_grantable FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) WHERE d.datname=current_database() ORDER BY 1,2,3")).rows;assert.deepEqual(databaseAcl,before.databaseAcl);
  await runtime.connect();await assertRuntimeDatabase(async(s:string)=>(await runtime.query(s)).rows,target);
  await db.query('ROLLBACK');
  const report={status:'PASS',identity,parent:parent[0],catalog,history:migrations.map((m:any)=>({name:m.migration_name,checksum:m.checksum})),historicalTablesPreserved:50,hrTablesEmpty:6,deferredEvidenceObjectsAbsent:true,authority18AndLeave19Absent:true,connectionAclRestored:true,runtimeRestricted:true,backupSha256:saved.backup.sha256};
  const reportName=process.env.HR_VERIFY_REPORT??'hr-final-acceptance.json';assert(/^hr-final-[a-z-]+\.json$/.test(reportName));
  writeFileSync(join(directory,reportName),JSON.stringify(report,null,2),{flag:'wx'});
  console.log('PASS independent read-only salary-dev acceptance: 16 exact migrations, deferred15 history/table/functions absent, 56 tables, 50 historical-table contents preserved except approved schema/history additions; empty HR authority/business tables, central guards and runtime restrictions verified');
 }finally{await runtime.end();await db.end();}
}
main().catch(()=>{console.error('BLOCKED independent HR acceptance; no database changes performed');process.exitCode=1;});
