// Explicitly authorized local rollout. Stop on failure; never automatic recovery.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { provisionDatabaseRoles } from './role-profile';
import { assertRuntimeDatabase } from '../../apps/api/src/prisma/database-security';
import { reviewPaymentDatabase } from '../review-payroll-payment-integrity';
const root=resolve(__dirname,'../..'),req=createRequire(join(root,'package.json'));
const directory=process.env.SALARY_PRIVATE_DIRECTORY;assert(directory?.startsWith('E:\\Joy\\salary-dev-private\\deployment-'));
const backup='E:\\Joy\\salary-dev-backups\\preflight-20261014-a6e7915ad6bc477d85f1dcdf5be12d4d';
const target='real_capita_accounts_salary_dev',migration='20261014000000_payroll_payment_foundation';
const names={migration:'rc_salary_migration',runtime:'rc_salary_runtime',finance:'rc_salary_finance'};
const hash=(v: Buffer)=>createHash('sha256').update(v).digest('hex');
let stage='final safety gate',build='',admin: any,runtime: any,app: any;
const evidence: Record<string,unknown>={};
function pass(name: string){console.log(`PASS ${name}`);}
const powershell=(code: string,input?: string)=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{encoding:'utf8',input,stdio:['pipe','pipe','pipe'],env:{...process.env,PSModulePath:join(process.env.SystemRoot!,'System32/WindowsPowerShell/v1.0/Modules')}});
async function main(){
  assert.equal(execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),'Joy');
  const original=readFileSync(join(root,'.env'),'utf8'),local=req('dotenv').parse(original),url=new URL(local.DATABASE_URL);
  assert.equal(url.hostname,'localhost');assert.equal(url.port,'55532');assert.equal(url.pathname,`/${target}`);
  const saved=JSON.parse(readFileSync(join(backup,'preflight.json'),'utf8'));
  assert.equal(hash(readFileSync(join(backup,'salary-dev.dump'))),saved.backup.sha256);
  assert(JSON.parse(readFileSync(join(backup,'restore-rehearsal.json'),'utf8')).allCountsAndFingerprintsMatch);
  const secrets: Record<string,string>={};
  for(const key of ['migration','runtime','finance']){
    const file=join(directory!,`${key}.clixml`);assert(!file.includes("'"));
    secrets[key]=powershell(`$s=Import-Clixml -LiteralPath '${file}'; $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}`).trim();
    assert.equal(Buffer.from(secrets[key],'base64').length,32);
  }
  assert.equal(new Set(Object.values(secrets)).size,3);
  // Existing maintenance secret retained encrypted, never in API configuration.
  const adminFile=join(directory!,'maintenance.clixml');assert(!adminFile.includes("'"));
  powershell(`$s=[Console]::In.ReadToEnd();ConvertTo-SecureString $s -AsPlainText -Force | Export-Clixml -LiteralPath '${adminFile}'`,local.DATABASE_URL);
  const docker=JSON.parse(execFileSync('docker',['inspect','real-capita-accounts-postgres'],{encoding:'utf8'}))[0];
  assert.equal(docker.Id,saved.containerId);assert.equal(docker.Config.Image,'postgres:17');
  assert.deepEqual(docker.NetworkSettings.Ports['5432/tcp'],[{HostIp:'127.0.0.1',HostPort:'55532'}]);
  const {Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');
  admin=new Client({connectionString:local.DATABASE_URL});await admin.connect();
  assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db,target);
  assert((await admin.query("SELECT current_setting('server_version_num')::int AS v")).rows[0].v>=170000);
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'")).rows[0].n,0);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_roles WHERE rolname=ANY($1::text[])',[Object.values(names)])).rows[0].n,0);
  const parent=(await admin.query('SELECT id,name,"legalName","isActive","singletonKey" FROM companies WHERE "singletonKey"=\'PRIMARY\'')).rows;
  assert.deepEqual(parent,[saved.parent]);
  const migrations=(await admin.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;
  assert.equal(migrations.length,13);for(const m of migrations){assert(m.finished_at&&!m.rolled_back_at);assert.equal(m.checksum,hash(readFileSync(join(root,'prisma/migrations',m.migration_name,'migration.sql'))));}
  const sql=readFileSync(join(root,'prisma/migrations',migration,'migration.sql'),'utf8');
  const fingerprints=async()=>{await admin.query("SET TIME ZONE 'UTC'");const out=[];for(const r of saved.records){if(r.table==='_prisma_migrations')continue;assert(/^[a-z_]+$/.test(r.table));const result=(await admin.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) AS fingerprint FROM (SELECT md5((to_jsonb(t)-'payrollAuthorityVersion'-'payrollMaterialVersion')::json::text) AS h FROM public."${r.table}" t) s`)).rows[0];out.push({table:r.table,...result});}return out;};
  // JSONB canonical ordering provides stable comparison across additive columns.
  const before=await fingerprints();
  for(const r of saved.records){const hashes=(await admin.query(`SELECT md5(row_to_json(t)::text) AS h FROM public."${r.table}" t`)).rows.map((v: any)=>v.h).sort();assert.equal(hashes.length,r.count);assert.equal(createHash('md5').update(hashes.join('')).digest('hex'),r.fingerprint);}
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n,39);
  pass('credential isolation, current target, idle writer gate, PRIMARY, backup and unchanged data');
  stage='migration deployment';
  // Private CLI environment only. Captured output may contain connection metadata.
  const deployed=spawnSync(process.execPath,[req.resolve('tsx/cli'),'scripts/db/prisma-admin.ts','deploy'],{cwd:root,env:{...process.env,MIGRATION_DATABASE_URL:local.DATABASE_URL,DATABASE_URL:undefined},encoding:'utf8'});
  assert.equal(deployed.status,0,'Migration CLI failed; stop and inspect retained state');
  const applied=(await admin.query('SELECT checksum,finished_at,rolled_back_at FROM _prisma_migrations WHERE migration_name=$1',[migration])).rows;
  assert.equal(applied.length,1);assert(applied[0].finished_at&&!applied[0].rolled_back_at);assert.equal(applied[0].checksum,hash(Buffer.from(sql)));
  await reviewPaymentDatabase({$queryRawUnsafe:async(s: string)=>(await admin.query(s)).rows},sql);
  assert.deepEqual(await fingerprints(),before);pass('migration deployed, reviewed catalog contracts and original business fingerprints');
  stage='role provisioning';
  await provisionDatabaseRoles(admin,{database:target,...names,passwords:Object.fromEntries(Object.entries(names).map(([k,v])=>[v,secrets[k]]))});
  const connection=(key: string)=>{const u=new URL(local.DATABASE_URL);u.username=names[key as keyof typeof names];u.password=secrets[key];return u.toString();};
  for(const key of ['migration','runtime','finance']){const c=new Client({connectionString:connection(key)});try{await c.connect();assert.equal((await c.query('SELECT current_database() AS db')).rows[0].db,target);}finally{await c.end();}}
  runtime=new Client({connectionString:connection('runtime')});await runtime.connect();
  await assertRuntimeDatabase(async(s: string)=>(await runtime.query(s)).rows,target);
  const definers=(await admin.query("SELECT proname,pg_get_userbyid(proowner) AS owner,proconfig FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef")).rows;
  assert.equal(definers.length,5);assert(definers.every((r: any)=>r.owner===names.migration&&r.proconfig.includes('search_path=pg_catalog, public, pg_temp')));
  const denialSql=[`SET ROLE ${names.migration}`,`SET ROLE ${names.finance}`,'CREATE TABLE public.rollout_probe(id int)','CREATE TEMP TABLE rollout_probe(id int)','ALTER TABLE payroll_payment_batches DISABLE TRIGGER ALL','DROP TABLE payroll_payment_reservations','ALTER TABLE payroll_payment_lines ADD COLUMN forbidden int',"INSERT INTO payroll_finance_delegates DEFAULT VALUES","INSERT INTO payroll_source_decisions DEFAULT VALUES","INSERT INTO payroll_finance_delegate_revocations DEFAULT VALUES","INSERT INTO payroll_source_actions DEFAULT VALUES","INSERT INTO payroll_cancellation_decisions DEFAULT VALUES","INSERT INTO payroll_payment_confirmations DEFAULT VALUES","UPDATE payroll_payment_reservations SET state='RELEASED' WHERE false","DELETE FROM payroll_payment_reservations WHERE false","UPDATE payroll_payment_batches SET status='CONFIRMED' WHERE false",'TRUNCATE payroll_payment_lines','SELECT * FROM _prisma_migrations',"SET session_replication_role='replica'"];
  await runtime.query('BEGIN');for(const statement of denialSql){await runtime.query('SAVEPOINT denial');let denied=false;try{await runtime.query(statement);}catch(e: any){assert.equal(e.code,'42501');denied=true;}await runtime.query('ROLLBACK TO SAVEPOINT denial');assert(denied,'Unexpected runtime privilege');}await runtime.query('ROLLBACK');
  assert.deepEqual(await fingerprints(),before);pass(`${denialSql.length} actual runtime privilege denials and rollback; five bounded definers`);
  stage='runtime configuration';
  const runtimeEnv=original.split(/\r?\n/).filter(l=>!/^\s*(?:export\s+)?(?:DATABASE_URL|RUNTIME_DATABASE_URL|RUNTIME_DATABASE_NAME|MIGRATION_DATABASE_URL|MIGRATION_SHADOW_DATABASE_URL|DATABASE_ADMIN_URL|FINANCE_PROVISIONING_DATABASE_URL|DB_(?:MIGRATION|RUNTIME|FINANCE)_SECRET)=/.test(l)).join('\n')+`\nRUNTIME_DATABASE_NAME=${target}\nRUNTIME_DATABASE_URL=${connection('runtime')}\n`;
  writeFileSync(join(root,'.env'),runtimeEnv);
  powershell(`$p='${join(root,'.env')}';$a=Get-Acl -LiteralPath $p;$a.SetAccessRuleProtection($true,$false);$a.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule([System.Security.Principal.WindowsIdentity]::GetCurrent().Name,'FullControl','Allow')));Set-Acl -LiteralPath $p -AclObject $a`);
  for(const key of ['DATABASE_URL','MIGRATION_DATABASE_URL','MIGRATION_SHADOW_DATABASE_URL','DATABASE_ADMIN_URL','FINANCE_PROVISIONING_DATABASE_URL','DB_MIGRATION_SECRET','DB_RUNTIME_SECRET','DB_FINANCE_SECRET'])delete process.env[key];
  Object.assign(process.env,req('dotenv').parse(runtimeEnv));
  stage='application smoke';
  build=mkdtempSync(join(root,'apps/api/.salary-rollout-'));
  execFileSync(process.execPath,[req.resolve('typescript/bin/tsc'),'-p','apps/api/tsconfig.json','--outDir',build,'--incremental','false','--declaration','false','--sourceMap','false'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const load=(file: string)=>req(join(build,file));
  const {NestFactory}=req('@nestjs/core'),{ValidationPipe}=req('@nestjs/common');
  app=await NestFactory.create(load('app.module.js').AppModule,{logger:false});app.use(req('cookie-parser')());app.useGlobalPipes(new ValidationPipe({forbidNonWhitelisted:true,transform:true,whitelist:true}));await app.listen(0,'127.0.0.1');
  const base=`http://127.0.0.1:${app.getHttpServer().address().port}`;
  assert.equal((await fetch(`${base}/health`)).status,200);
  assert.equal((await fetch(`${base}/payroll-runs`)).status,401);
  const prisma=app.get(load('prisma/prisma.service.js').PrismaService);
  const session=await prisma.authSession.findFirst({where:{revokedAt:null,expiresAt:{gt:new Date()},user:{isActive:true,roles:{some:{role:{code:'ACCOUNTANT'}}}},activeCompany:{isActive:true}},orderBy:{createdAt:'desc'}});
  let authenticatedHttp=false;
  if(session){
    const {JwtService}=req('@nestjs/jwt');const token=await new JwtService().signAsync({sid:session.id,jti:session.tokenId,sub:session.userId},{secret:process.env.JWT_SECRET,expiresIn:60});
    const headers={Cookie:`${process.env.COOKIE_NAME??'rcg_auth'}=${token}`};
    // Persisted existing session, not a fabricated identity or new login/write.
    const endpoints=['/auth/me','/company/list','/employees','/salary-structures','/payroll-runs'];
    evidence.http=[];
    for(const endpoint of endpoints){const response=await fetch(base+endpoint,{headers});(evidence.http as unknown[]).push({endpoint,status:response.status});assert.equal(response.status,200,`Smoke route ${endpoint}`);}
    authenticatedHttp=true;
  }
  // Real Prisma reads cover permissions without creating business fixtures.
  for(const model of ['company','employee','salaryStructure','employeeSalaryAssignment','employeePaymentProfile','attendanceRecord','workSchedule','fiscalYear','accountingPeriod','ledgerAccount','cashBankAccount','voucher','voucherLine','payrollRun','payrollRunLine'])await prisma[model].findMany({take:1});
  const parentResolver=app.get(load('payroll/payroll-parent.resolver.js').PayrollParentResolver);await parentResolver.resolve();
  const preview=app.get(load('payroll/payroll-preview.service.js').PayrollPreviewService);const previewResult=await preview.preview({year:2026,month:10,deductions:[]});assert.equal(previewResult.status,'BLOCKED');
  const authority=app.get(load('payroll/payroll-payment-lifecycle.service.js').PayrollPaymentAuthority);assert.equal(await authority.delegate(saved.parent.id,'unassigned',false,prisma),null);
  assert.equal(await prisma.payrollFinanceDelegate.count(),0);assert.equal(await prisma.payrollPaymentBatch.count(),0);
  assert.deepEqual(await fingerprints(),before);
  evidence.status=authenticatedHttp?'PASS':'PARTIAL';evidence.authenticatedHttp=authenticatedHttp;evidence.migration=migration;evidence.privilegeDenials=denialSql.length;evidence.businessDataUnchanged=true;evidence.preview='BLOCKED expected: incomplete real evidence';evidence.documents='No approved payroll exists; positive document/payment-preparation smoke unavailable';
  pass('Nest/Prisma runtime startup, health, unauthorized rejection, module reads, preview and fail-closed finance; no business writes');
  const status=spawnSync(process.execPath,[req.resolve('tsx/cli'),'scripts/db/prisma-admin.ts','status'],{cwd:root,env:{...process.env,MIGRATION_DATABASE_URL:connection('migration')},encoding:'utf8'});assert.equal(status.status,0);
  writeFileSync(join(directory!,'deployment-result.json'),JSON.stringify(evidence,null,2));console.log(`Deployment acceptance ${evidence.status}; secrets never printed`);
}
main().catch((e: any)=>{writeFileSync(join(directory!,'deployment-failure.json'),JSON.stringify({stage,errorCode:e?.code??e?.name,locations:e?.stack?.split('\n').filter((l: string)=>/^\s+at /.test(l)),status:'STOPPED',evidence},null,2));console.error(`STOPPED at ${stage}; sanitized evidence preserved; no automatic rollback`);process.exitCode=1;}).finally(async()=>{if(app)await app.close();if(runtime)await runtime.end();if(admin)await admin.end();if(build){assert(build.startsWith(join(root,'apps/api/.salary-rollout-')));rmSync(build,{recursive:true,force:true});}});
