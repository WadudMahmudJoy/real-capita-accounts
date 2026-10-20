// Task-owned PostgreSQL 17 only. No connection to salary-dev, no real provider.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const root=resolve('.'),req=createRequire(join(root,'package.json')),{Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');
const token=randomBytes(12).toString('hex'),name='rc-onboarding-'+token,password=randomBytes(32).toString('hex'),database='real_capita_payroll_accept_'+randomBytes(16).toString('hex');
const build=mkdtempSync(resolve('apps/api/.onboarding-accept-'));const temp=mkdtempSync(join(tmpdir(),'rc-onboarding-')),env={...process.env,POSTGRES_PASSWORD:password};let id='',db:any;
const docker=(args:string[])=>execFileSync('docker',args,{env,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
async function main(){
 execFileSync(process.execPath,[req.resolve('typescript/bin/tsc'),'-p','apps/api/tsconfig.json','--outDir',build,'--incremental','false','--declaration','false','--sourceMap','false'],{stdio:['ignore','pipe','pipe']});
 assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]),'');id=docker(['run','-d','--name',name,'--label','rc.onboarding.token='+token,'--tmpfs','/var/lib/postgresql/data','-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD','-e','POSTGRES_DB='+database,'postgres:17']);
 const info=JSON.parse(docker(['inspect',id]))[0];assert.equal(info.Config.Labels['rc.onboarding.token'],token);assert.equal(info.Mounts.length,0);const port=info.NetworkSettings.Ports['5432/tcp'][0].HostPort;assert(!['5432','55432','55532'].includes(port));
 const url=new URL(`postgresql://postgres@127.0.0.1:${port}/${database}`);url.password=password;
 for(let i=0;i<80;i++){const candidate=new Client({connectionString:url.toString()});try{await candidate.connect();db=candidate;break;}catch{await candidate.end();await new Promise(r=>setTimeout(r,200));}}assert(db);assert.equal((await db.query('SELECT current_database() db')).rows[0].db,database);
 const artifact=join(temp,'migrations');mkdirSync(artifact);copyFileSync('prisma/migrations/migration_lock.toml',join(artifact,'migration_lock.toml'));
 for(const name of readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)&&n!=='20261015000000_payroll_confirmation_evidence')){mkdirSync(join(artifact,name));copyFileSync(join('prisma/migrations',name,'migration.sql'),join(artifact,name,'migration.sql'));}
 const config=join(temp,'prisma.config.ts');writeFileSync(config,`import {defineConfig} from ${JSON.stringify(req.resolve('prisma/config').replaceAll('\\','/'))};export default defineConfig({schema:${JSON.stringify(resolve('prisma/schema.prisma'))},migrations:{path:${JSON.stringify(artifact)}},datasource:{url:process.env.TEST_ONBOARDING_DATABASE}});`);
 const deployed=spawnSync(process.execPath,[req.resolve('prisma/build/index.js'),'migrate','deploy','--config',config],{env:{...process.env,TEST_ONBOARDING_DATABASE:url.toString()},encoding:'utf8'});if(deployed.status!==0)console.error((String(deployed.stdout)+String(deployed.stderr)).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[redacted]').slice(-4500));assert.equal(deployed.status,0,'Disposable curated migration deploy failed');
 assert.equal((await db.query("SELECT to_regprocedure('onboarding_command(text,text,jsonb,jsonb)') IS NOT NULL present")).rows[0].present,true,'Secure bounded onboarding command is missing');
 const projected=join(temp,'projected.prisma');
 const schema=readFileSync('prisma/schema.prisma','utf8').replace(/model PayrollCashAcknowledgment \{[\s\S]*?\n\}/,'').replace(/^.*cashAcknowledgment.*\r?\n/gm,'').replace(/^.*@@unique\(\[verificationAuthority, evidenceKind, evidenceReference\]\).*\r?\n/gm,'').replaceAll("AT TIME ZONE 'UTC')","AT TIME ZONE 'UTC'::text)");
 writeFileSync(projected,schema);
 const parity=spawnSync(process.execPath,[req.resolve('prisma/build/index.js'),'migrate','diff','--from-config-datasource','--to-schema',projected,'--config',config,'--exit-code'],{env:{...process.env,TEST_ONBOARDING_DATABASE:url.toString()},encoding:'utf8'});
 if(parity.status!==0)console.error((String(parity.stdout)+String(parity.stderr)).replace(/postgres(?:ql)?:\/\/[^\s"']+/g,'[redacted]').slice(-4500));assert.equal(parity.status,0,'Disposable schema parity failed');
 const history=(await db.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows;assert.equal(history.length,19);for(const entry of history)assert.equal(entry.checksum,createHash('sha256').update(readFileSync(join('prisma/migrations',entry.migration_name,'migration.sql'))).digest('hex'));
 console.log('PASS new onboarding migration installed only on task-owned PostgreSQL17, deferred15 absent; 19 exact checksums and Prisma schema parity');
 // More lifecycle assertions are appended below as each protected operation is implemented.
 const {verifyOnboardingLifecycle}=await import('./onboarding-lifecycle-acceptance');await verifyOnboardingLifecycle({db,req,url,database,digest,randomUUID,load:(name:string)=>req(join(build,name))});
} main().catch(e=>{console.error(JSON.stringify({result:'FAIL',code:e?.code,type:e?.name,detail:e instanceof assert.AssertionError?e.message:undefined}));process.exitCode=1;}).finally(async()=>{if(db)await db.end();if(id){const info=JSON.parse(docker(['inspect',id]))[0];assert.equal(info.Id,id);assert.equal(info.Config.Labels['rc.onboarding.token'],token);assert.equal(info.Mounts.length,0);docker(['rm','-f',id]);console.log('PASS exact task-owned PostgreSQL cleanup');}assert(temp.startsWith(join(tmpdir(),'rc-onboarding-')));rmSync(temp,{recursive:true,force:true});assert(build.startsWith(resolve('apps/api/.onboarding-accept-')));rmSync(build,{recursive:true,force:true});});
