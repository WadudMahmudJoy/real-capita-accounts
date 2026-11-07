// Disposable-only rehearsal of a proposed curated HR deployment artifact.
// Original migration names/bytes are retained; Prisma owns every history row.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {copyFileSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {provisionDatabaseRoles} from './db/role-profile';
import {assertRuntimeDatabase} from '../apps/api/src/prisma/database-security';
import {applyHrRuntimePrivileges} from './db/hr-runtime-privileges';
import {verifyHrDeploymentCatalog} from './db/verify-hr-deployment-catalog';
export async function verifyHrMigrationSequence(context:{url:URL;directory:string;req:NodeRequire}){
 const {url,directory,req}=context;
 assert.equal(url.hostname,'127.0.0.1');assert(!['55532','55432','5432'].includes(url.port));assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(url.pathname.slice(1)));
 const {Client}=require(require.resolve('pg',{paths:[require.resolve('@prisma/adapter-pg')]}));
 const db=new Client({connectionString:url.toString()});await db.connect();
 try{
  assert.equal((await db.query('SELECT current_database() AS db')).rows[0].db,url.pathname.slice(1));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n,0);
  const migrationRoot=resolve('prisma/migrations'),names=readdirSync(migrationRoot,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();assert.equal(names.length,17);
  const bundle=join(directory,'migrations');mkdirSync(bundle);copyFileSync(join(migrationRoot,'migration_lock.toml'),join(bundle,'migration_lock.toml'));
  const config=join(directory,'selective.config.ts');writeFileSync(config,`import {defineConfig} from 'prisma/config';export default defineConfig({schema:${JSON.stringify(resolve('prisma/schema.prisma'))},migrations:{path:${JSON.stringify(bundle)}},datasource:{url:process.env.MIGRATION_DATABASE_URL}});`);
  const env={...process.env,MIGRATION_DATABASE_URL:url.toString(),DATABASE_URL:undefined};
  const cli=(args:string[])=>spawnSync(process.execPath,[req.resolve('prisma/build/index.js'),...args],{env,encoding:'utf8'});
  const add=(name:string)=>{mkdirSync(join(bundle,name));copyFileSync(join(migrationRoot,name,'migration.sql'),join(bundle,name,'migration.sql'));};
  names.slice(0,14).forEach(add);assert.equal(cli(['migrate','deploy','--config',config]).status,0,'Baseline CLI deployment failed');
  names.slice(15).forEach(add);assert.equal(cli(['migrate','deploy','--config',config]).status,0,'Curated HR CLI deployment failed');
  const hr=(await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;assert.equal(hr.length,16);assert(!hr.some((r:any)=>r.migration_name===names[14]));assert(hr.every((r:any)=>r.finished_at&&!r.rolled_back_at));
  for(const row of hr)assert.equal(row.checksum,createHash('sha256').update(readFileSync(join(migrationRoot,row.migration_name,'migration.sql'))).digest('hex'));
  assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND tablename IN ('leave_categories','leave_requests','leave_request_events','user_permissions','employee_account_bindings','user_admin_events')")).rows[0].n,6);
  assert.equal((await db.query("SELECT to_regclass('public.payroll_cash_acknowledgments') AS t")).rows[0].t,null);
  assert.equal(cli(['migrate','status','--config',config]).status,0,'Curated history status');
  const fullStatus=cli(['migrate','status']);assert.equal(fullStatus.status,1,'Full source must report the deferred migration pending');assert((fullStatus.stdout+fullStatus.stderr).includes(names[14]));
  console.log('PASS isolated selective rehearsal: 14 baseline + original HR migrations 16/17, all original checksums, six HR tables, no confirmation evidence objects; curated status=0, full-source status=1 correctly reports pending 15');
  const suffix=randomBytes(6).toString('hex'),migration='hr_review_owner_'+suffix,runtime='hr_review_runtime_'+suffix,finance='hr_review_finance_'+suffix;
  const password=randomBytes(32).toString('hex');
  await provisionDatabaseRoles(db,{database:url.pathname.slice(1),migration,runtime,finance,passwords:{[migration]:password,[runtime]:password,[finance]:password}});
  await applyHrRuntimePrivileges(db,runtime,migration);
  const catalog=await verifyHrDeploymentCatalog(db,names.slice(15).map(n=>join(migrationRoot,n,'migration.sql')),migration);
  console.log('PASS exact HR catalog and idempotent HR-only grant delta: '+JSON.stringify(catalog));
  const runtimeUrl=new URL(url);runtimeUrl.username=runtime;runtimeUrl.password=password;
  const restricted=new Client({connectionString:runtimeUrl.toString()});
  try{
   await restricted.connect();await assertRuntimeDatabase(async(sql:string)=>(await restricted.query(sql)).rows,url.pathname.slice(1));
   for(const table of ['leave_categories','leave_requests','leave_request_events','user_permissions','employee_account_bindings','user_admin_events'])assert((await restricted.query('SELECT has_table_privilege(current_user,$1,\'SELECT\') AS allowed',[table])).rows[0].allowed);
   assert((await restricted.query("SELECT has_table_privilege('user_permissions','INSERT') AS allowed")).rows[0].allowed);
   await restricted.query('BEGIN');let denied=false;try{await restricted.query('INSERT INTO user_permissions DEFAULT VALUES');}catch(e:any){assert.equal(e.code,'23514');denied=true;}await restricted.query('ROLLBACK');assert(denied,'Absent trusted System Administrator must remain fail-closed');
  }finally{await restricted.end();}
  console.log('PASS curated HR schema with current three-role profile: non-owner runtime startup attestation, all six HR SELECT grants, guarded permission INSERT denied without genuine authority; no confirmation executor or credentials required');
  // Establish compatibility of the deferred migration later, only in this
  // disposable technical environment. This is NOT authorization to deploy it.
  assert.equal(cli(['migrate','deploy']).status,0,'Deferred evidence migration compatibility');
  const final=(await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;assert.equal(final.length,17);assert(final.every((r:any)=>r.finished_at&&!r.rolled_back_at));
  for(const row of final)assert.equal(row.checksum,createHash('sha256').update(readFileSync(join(migrationRoot,row.migration_name,'migration.sql'))).digest('hex'));
  assert.equal(cli(['migrate','status']).status,0);assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated")).rows[0].n,0);
  // Keep only non-sensitive technical evidence; no SQL or business fixtures.
  console.log('PASS isolated later-deploy compatibility: Prisma applied deferred 15 without resolve/manual history edits, 17 checksums intact, status=0 and all constraints validated. Selective production process still requires independent approval.');
  return migration;
 }finally{await db.end();}
}
