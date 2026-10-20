// Read-only HR rollout evidence and snapshot backup. No deployment or ACL changes.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {closeSync,openSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {assertRuntimeDatabase,runtimeDatabaseUrl} from '../../apps/api/src/prisma/database-security';
const root=resolve(__dirname,'../..'),req=createRequire(join(root,'package.json'));
const target='real_capita_accounts_salary_dev',container='real-capita-accounts-postgres';
const pending=['20261015000000_payroll_confirmation_evidence','20261016000000_leave_request_foundation','20261017000000_hr_admin_identity'];
const hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
async function main(){
 assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'Joy');
 const output=process.env.SALARY_BACKUP_DIRECTORY,privateDirectory=process.env.SALARY_PRIVATE_DIRECTORY;
 assert(output&&isAbsolute(output));assert(privateDirectory&&isAbsolute(privateDirectory));
 const rel=relative(root,resolve(output));assert(rel.startsWith('..')||isAbsolute(rel));
 // Existing CurrentUser DPAPI maintenance secret; never returned in evidence or CLI args.
 const secretFile=join(privateDirectory,'maintenance.clixml');assert(!secretFile.includes("'"));
 const value=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$s=Import-Clixml -LiteralPath '${secretFile}';$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const url=new URL(value);assert(['postgres:','postgresql:'].includes(url.protocol));assert.equal(url.hostname,'localhost');assert.equal(url.port,'55532');assert.equal(decodeURIComponent(url.pathname.slice(1)),target);
 const local=req('dotenv').parse(readFileSync(join(root,'.env')));
 for(const key of ['DATABASE_URL','MIGRATION_DATABASE_URL','DATABASE_ADMIN_URL','FINANCE_PROVISIONING_DATABASE_URL'])assert(!local[key],`Unexpected privileged API setting ${key}`);
 const runtime=new URL(runtimeDatabaseUrl(local));assert.equal(runtime.hostname,'localhost');assert.equal(runtime.port,'55532');assert.equal(runtime.pathname,'/'+target);assert.equal(local.RUNTIME_DATABASE_NAME,target);assert.equal(runtime.username,'rc_salary_runtime');
 const info=JSON.parse(execFileSync('docker',['inspect',container,'--format','{{json .}}'],{encoding:'utf8'}));assert.equal(info.Config.Image,'postgres:17');assert(info.State.Running);assert.deepEqual(info.NetworkSettings.Ports['5432/tcp'],[{HostIp:'127.0.0.1',HostPort:'55532'}]);
 const volume=info.Mounts.find((m:any)=>m.Destination==='/var/lib/postgresql/data');assert.equal(volume?.Name,'real-capita-accounts_postgres_data');
 const {Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');
 const db=new Client({connectionString:value,options:'-c default_transaction_read_only=on'});
 try{
  await db.connect();const identity=(await db.query("SELECT current_database() AS database,current_user AS role,current_setting('server_version_num')::int AS version,inet_server_port() AS internal_port")).rows[0];assert.equal(identity.database,target);assert(identity.version>=170000&&identity.version<180000);assert.equal(identity.internal_port,5432);
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL TIME ZONE 'UTC'");
  const migrations=(await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;assert.equal(migrations.length,14);assert(migrations.every((m:any)=>m.finished_at&&!m.rolled_back_at));
  const dirs=readdirSync(join(root,'prisma/migrations'),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();assert.deepEqual(dirs.filter(d=>!migrations.some((m:any)=>m.migration_name===d)),pending);
  for(const m of migrations)assert.equal(m.checksum,hash(readFileSync(join(root,'prisma/migrations',m.migration_name,'migration.sql'))),`Changed applied migration ${m.migration_name}`);
  const parent=(await db.query('SELECT id,name,"legalName","isActive","singletonKey" FROM companies WHERE "singletonKey"=\'PRIMARY\'')).rows;assert.equal(parent.length,1);assert(parent[0].isActive);assert.equal(parent[0].name,'Real Capita Group');
  const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r:any)=>r.tablename);
  assert.equal(tables.length,50);for(const name of ['payroll_cash_acknowledgments','leave_categories','leave_requests','leave_request_events','user_permissions','employee_account_bindings','user_admin_events'])assert(!tables.includes(name),`Partial pending object ${name}`);
  const partial=(await db.query("SELECT count(*)::int AS n FROM pg_type t WHERE t.typnamespace='public'::regnamespace AND t.typname IN ('LeaveRequestStatus','HrPermission')")).rows[0].n;assert.equal(partial,0);
  const roles=(await db.query("SELECT rolname,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname IN ('rc_salary_runtime','rc_salary_migration','rc_salary_finance') ORDER BY rolname")).rows;assert.equal(roles.length,3);assert(roles.every((r:any)=>!r.rolsuper&&!r.rolcreatedb&&!r.rolcreaterole&&!r.rolreplication&&!r.rolbypassrls));
  const owners=(await db.query("SELECT relname,pg_get_userbyid(relowner) AS owner,relacl::text AS acl FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','S') ORDER BY relname")).rows;assert(owners.every((r:any)=>r.owner==='rc_salary_migration'));
  const memberships=(await db.query("SELECT pg_get_userbyid(member) AS member,pg_get_userbyid(roleid) AS role FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='rc_salary_runtime')")).rows;assert.equal(memberships.length,0);
  const writers=(await db.query("SELECT application_name,state,xact_start IS NOT NULL AS in_transaction FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'")).rows;
  const fingerprint=async()=>{const out=[];for(const table of tables){assert(/^[a-z_]+$/.test(table));const r=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row_hash,'' ORDER BY row_hash),'')) AS fingerprint FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public."${table}" t) rows`)).rows[0];out.push({table,...r});}return out;};
  const records=await fingerprint();
  const restricted=new Client({connectionString:runtime.toString(),options:'-c default_transaction_read_only=on'});
  try{await restricted.connect();await assertRuntimeDatabase(async(sql:string)=>(await restricted.query(sql)).rows,target);for(const table of ['employees','employee_salary_assignments','attendance_records','payroll_runs','vouchers'])await restricted.query(`SELECT id FROM public."${table}" LIMIT 1`);}finally{await restricted.end();}
  if(process.argv.includes('--verify-preservation')){
   const original=JSON.parse(readFileSync(join(output,'preflight.json'),'utf8'));assert.deepEqual(records,original.records);assert.equal(hash(readFileSync(join(output,'salary-dev.dump'))),original.backup.sha256);await db.query('ROLLBACK');
   console.log('PASS final salary-dev read-only preservation: all 50 table counts/fingerprints and 14 migration checksums unchanged; backup SHA-256 verified; actual restricted runtime startup attestation and Employee/Salary/Attendance/Payroll/Voucher reads passed; HR migrations remain pending');return;
  }
  const snapshot=(await db.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
  const archive=join(output,'salary-dev.dump'),fd=openSync(archive,'wx');let dump;
  try{dump=spawnSync('docker',['exec','--env','PGPASSWORD',container,'pg_dump','--host','127.0.0.1','--username',decodeURIComponent(url.username),'--dbname',target,'--format=custom',`--snapshot=${snapshot}`],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},stdio:['ignore',fd,'pipe']});}finally{closeSync(fd);}assert.equal(dump.status,0,'Backup failed; diagnostics withheld');await db.query('ROLLBACK');
  const data=readFileSync(archive);assert(data.length>0);
  const restore=(args:string[])=>spawnSync('docker',['exec','-i',container,'pg_restore',...args],{input:data,maxBuffer:32*1024*1024});const catalog=restore(['--list']);assert.equal(catalog.status,0);assert.equal(restore(['--file=/dev/null']).status,0);writeFileSync(join(output,'archive-toc.txt'),catalog.stdout,{flag:'wx'});
  // Project exactly migration 14, retaining manual CHECKs/triggers outside Prisma's model.
  let baseline=readFileSync(join(root,'prisma/schema.prisma'),'utf8').split('// BEGIN SPRINT4')[0].split('\n').filter(l=>!l.includes('// HR4')).join('\n').replace(/\nenum LeaveRequestStatus[\s\S]*$/,'').replace(/^.*(?:leaveRequests LeaveRequest|withdrawnLeaveRequests LeaveRequest|reviewedLeaveRequests LeaveRequest|leaveEvents LeaveRequestEvent).*\r?\n/gm,'');
  baseline=baseline.replace(/^model PayrollCashAcknowledgment \{[\s\S]*?^\}\r?\n/m,'').replace(/^.*cashAcknowledgment.*\r?\n/gm,'').replace(/^.*@@unique\(\[verificationAuthority, evidenceKind, evidenceReference\]\).*\r?\n/gm,'');
  // PostgreSQL deparses AT TIME ZONE with an explicit text cast. Verify the
  // expression independently before normalizing this known Prisma diff noise.
  const defaults=(await db.query("SELECT pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid WHERE c.relnamespace='public'::regnamespace AND pg_get_expr(d.adbin,d.adrelid) LIKE '%clock_timestamp%'")).rows;
  assert.equal(defaults.length,10);assert(defaults.every((r:any)=>r.expression==="(clock_timestamp() AT TIME ZONE 'UTC'::text)"));
  baseline=baseline.replaceAll("(clock_timestamp() AT TIME ZONE 'UTC')","(clock_timestamp() AT TIME ZONE 'UTC'::text)");
  const schemaPath=join(output,'deployed-14.prisma');writeFileSync(schemaPath,baseline,{flag:'wx'});
  const diff=spawnSync(process.execPath,[req.resolve('prisma/build/index.js'),'migrate','diff','--from-config-datasource','--to-schema',schemaPath,'--script','--exit-code'],{cwd:root,env:{...process.env,MIGRATION_DATABASE_URL:value,PGOPTIONS:'-c default_transaction_read_only=on'},encoding:'utf8'});writeFileSync(join(output,'schema-diff.sql'),diff.stdout??'',{flag:'wx'});assert.equal(diff.status,0,'Schema drift or inspection error; review external diff');
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL TIME ZONE 'UTC'");assert.deepEqual(await fingerprint(),records,'Business records changed during backup');await db.query('ROLLBACK');
  const report={verifiedAt:new Date().toISOString(),identity,parent:parent[0],containerId:info.Id,volume:volume.Name,migrations,pending,roles,owners,memberships,writers,records,backup:{archive,bytes:data.length,sha256:hash(data),catalogReadable:true,fullExtractionReadable:true,exportedSnapshot:true},schemaDrift:false,recordsUnchanged:true};writeFileSync(join(output,'preflight.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({verdict:'PASS',identity,parent:parent[0],applied:14,pending,tables:tables.length,checksumMatches:14,recordsUnchanged:true,schemaDrift:false,backup:report.backup,otherSessions:writers.length,runtimeRestricted:true},null,2));
 }finally{await db.end();}
}
main().catch(e=>{console.error('BLOCKED HR preflight: '+(e instanceof assert.AssertionError?e.message:'operation failed; diagnostics withheld'));process.exitCode=1;});
