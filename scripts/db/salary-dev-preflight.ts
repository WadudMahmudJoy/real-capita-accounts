// Read-only rollout preflight and custom-format backup. Never deploys or provisions.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { withoutPaymentFoundation } from '../payroll-payment-schema';
import { appendOnlyTables, paymentTables, readOnlyTables, runtimeWriteTables } from './role-profile';

const root=resolve(__dirname,'../..'),req=createRequire(join(root,'package.json'));
const target='real_capita_accounts_salary_dev',pending='20261014000000_payroll_payment_foundation';
const container='real-capita-accounts-postgres';
const digest=(value: string|Buffer)=>createHash('sha256').update(value).digest('hex');
async function main(){
  assert.equal(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),'Joy');
  const output=process.env.SALARY_BACKUP_DIRECTORY;
  assert(output&&isAbsolute(output),'Explicit external backup directory required');
  const rel=relative(root,resolve(output));assert(rel.startsWith('..')||isAbsolute(rel),'Backup must be outside repository');
  const local=req('dotenv').parse(readFileSync(join(root,'.env')));
  const value=process.env.SALARY_PREFLIGHT_DATABASE_URL??local.DATABASE_URL;assert(value);
  const url=new URL(value);
  assert(['postgres:','postgresql:'].includes(url.protocol));assert.equal(url.hostname,'localhost');
  assert.equal(url.port,'55532');assert.equal(decodeURIComponent(url.pathname.slice(1)),target);
  assert.equal(url.hash,'');assert.equal(url.searchParams.get('schema')??'public','public');
  assert([...url.searchParams.keys()].every(k=>['schema','sslmode','connect_timeout','connection_limit','pool_timeout'].includes(k)));
  const info=JSON.parse(execFileSync('docker',['inspect',container,'--format','{{json .}}'],{encoding:'utf8'}));
  assert.equal(info.Config.Image,'postgres:17');assert.equal(info.State.Running,true);
  assert.deepEqual(info.NetworkSettings.Ports['5432/tcp'],[{HostIp:'127.0.0.1',HostPort:'55532'}]);
  const volume=info.Mounts.find((m: any)=>m.Destination==='/var/lib/postgresql/data');
  assert.equal(volume?.Name,'real-capita-accounts_postgres_data');assert.equal(volume.Type,'volume');
  const {Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');
  const db=new Client({connectionString:value});
  try{
    await db.connect();
    const identity=(await db.query('SELECT current_database() AS database, current_user AS role, current_setting(\'server_version_num\')::int AS version, inet_server_port() AS internal_port')).rows[0];
    assert.equal(identity.database,target);assert(identity.version>=170000&&identity.version<180000);assert.equal(identity.internal_port,5432);
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await db.query("SET LOCAL TIME ZONE 'UTC'");
    const migrations=(await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;
    assert(!migrations.some((m: any)=>!m.finished_at&&!m.rolled_back_at),'Unfinished migration');
    assert(!migrations.some((m: any)=>m.migration_name===pending),'Payment migration has a history entry');
    const applied=migrations.filter((m: any)=>m.finished_at&&!m.rolled_back_at);
    const dirs=readdirSync(join(root,'prisma/migrations'),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name);
    assert.deepEqual(dirs.filter(n=>n!==pending).sort(),applied.map((m: any)=>m.migration_name).sort());
    for(const m of applied)assert.equal(m.checksum,digest(readFileSync(join(root,'prisma/migrations',m.migration_name,'migration.sql'))),`Applied checksum mismatch: ${m.migration_name}`);
    const parent=(await db.query('SELECT id,name,"legalName","isActive","singletonKey" FROM companies WHERE "singletonKey"=\'PRIMARY\'')).rows;
    assert.equal(parent.length,1);assert.equal(parent[0].isActive,true);assert.equal(parent[0].name,'Real Capita Group');
    const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r: any)=>r.tablename);
    assert.deepEqual(tables,[...runtimeWriteTables,...readOnlyTables,...appendOnlyTables,'users','payroll_runs','payroll_run_lines','_prisma_migrations'].sort());
    assert(!tables.some((t: string)=>paymentTables.includes(t)));
    assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('payrollMaterialVersion','payrollAuthorityVersion')")).rows[0].n,0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname IN ('PayrollPaymentChannel','PayrollPaymentBatchStatus','PayrollSourceActionKind','PayrollReservationState')")).rows[0].n,0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'payroll_payment_%' OR p.proname LIKE 'payroll_source_%' OR p.proname LIKE 'payroll_finance_%')")).rows[0].n,0);
    const foundation=readFileSync(join(root,'prisma/migrations/20261013000000_hr_3b_payroll_foundation/migration.sql'),'utf8');
    const constraints=(await db.query("SELECT conname,contype,convalidated,confdeltype,pg_get_constraintdef(oid,true) AS expression FROM pg_constraint WHERE conrelid IN ('payroll_runs'::regclass,'payroll_run_lines'::regclass)")).rows;
    const normalize=(s: string)=>s.replace(/::numeric/g,'').replace(/[()\s]/g,'');
    const checks=[...foundation.matchAll(/ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "([^"]+)" (CHECK \([^;]+\));/g)];assert.equal(checks.length,6);
    for(const [,name,expr] of checks){const c=constraints.find((c: any)=>c.conname===name);assert(c?.convalidated);assert.equal(normalize(c.expression),normalize(expr));}
    assert.equal(constraints.filter((c: any)=>c.contype==='f'&&c.convalidated&&c.confdeltype==='r').length,8);
    const role=(await db.query('SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolbypassrls,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];
    const ownership=(await db.query("SELECT 'database' AS kind,datname AS object,pg_get_userbyid(datdba) AS owner,datacl::text AS acl FROM pg_database WHERE datname=current_database() UNION ALL SELECT 'schema',nspname,pg_get_userbyid(nspowner),nspacl::text FROM pg_namespace WHERE nspname='public' UNION ALL SELECT c.relkind::text,c.relname,pg_get_userbyid(c.relowner),c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY kind,object")).rows;
    const memberships=(await db.query('SELECT pg_get_userbyid(roleid) AS granted_role FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)')).rows;
    const fingerprint=async()=>{const results=[];for(const table of tables){assert(/^[a-z_]+$/.test(table));const r=(await db.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row_hash,'' ORDER BY row_hash),'')) AS fingerprint FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public."${table}" t) rows`)).rows[0];results.push({table,...r});}return results;};
    const before=await fingerprint();
    const snapshot=(await db.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
    const archive=join(output,'salary-dev.dump'),fd=openSync(archive,'wx');
    let dump;try{dump=spawnSync('docker',['exec','--env','PGPASSWORD',container,'pg_dump','--host','127.0.0.1','--port','5432','--username',decodeURIComponent(url.username),'--dbname',target,'--format=custom',`--snapshot=${snapshot}`],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},stdio:['ignore',fd,'pipe']});}finally{closeSync(fd);}
    assert.equal(dump.status,0,'pg_dump failed (diagnostics withheld)');
    await db.query('ROLLBACK');
    const data=readFileSync(archive);assert(data.length>0);
    const restore=(args: string[])=>spawnSync('docker',['exec','-i',container,'pg_restore',...args],{input:data,maxBuffer:32*1024*1024});
    const list=restore(['--list']);assert.equal(list.status,0,'Archive catalog unreadable');
    const contents=list.stdout.toString();assert(contents.includes('TABLE DATA public employees'));assert(contents.includes('TABLE DATA public _prisma_migrations'));
    assert.equal(restore(['--file=/dev/null']).status,0,'Full archive extraction failed');
    writeFileSync(join(output,'archive-toc.txt'),contents,{flag:'wx'});
    // Live schema diff is read-only; compare against exactly the pre-payment model.
    const baseline=join(output,'pre-payment.prisma');writeFileSync(baseline,withoutPaymentFoundation(readFileSync(join(root,'prisma/schema.prisma'),'utf8')),{flag:'wx'});
    const diff=spawnSync(process.execPath,[req.resolve('prisma/build/index.js'),'migrate','diff','--from-config-datasource','--to-schema',baseline,'--script','--exit-code'],{cwd:root,env:{...process.env,MIGRATION_DATABASE_URL:value},encoding:'utf8',maxBuffer:8*1024*1024});
    const diffStatus=diff.status;writeFileSync(join(output,'schema-diff.sql'),diff.stdout??'',{flag:'wx'});
    assert.equal(diffStatus,0,'Schema drift or inspection error; review external schema-diff.sql');
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL TIME ZONE 'UTC'");
    assert.deepEqual(await fingerprint(),before,'Live rows changed during preflight/backup');
    await db.query('ROLLBACK');
    const report={verifiedAt:new Date().toISOString(),identity,containerId:info.Id,volume:volume.Name,parent:parent[0],pending,appliedMigrationCount:applied.length,migrations,role,memberships,ownership,records:before,backup:{archive,bytes:data.length,sha256:digest(data),catalogReadable:true,fullExtractionReadable:true,restoreIntoDatabasePerformed:false,exportedSnapshot:true},schemaDrift:false,recordsUnchanged:true};
    writeFileSync(join(output,'preflight.json'),JSON.stringify(report,null,2),{flag:'wx'});
    console.log(JSON.stringify({verdict:'PASS',database:target,version:identity.version,parent:parent[0],appliedMigrations:applied.length,pending,tableCount:tables.length,owningSuperuser:role.rolsuper,backup:report.backup,schemaDrift:false,recordsUnchanged:true},null,2));
  }finally{await db.end();}
}
main().catch((e: unknown)=>{console.error(`BLOCKED salary-dev preflight: ${e instanceof assert.AssertionError?e.message:'operation failed; connection diagnostics suppressed'}`);process.exitCode=1;});
