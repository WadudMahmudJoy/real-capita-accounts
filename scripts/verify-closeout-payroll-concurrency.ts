// DB uniqueness probe only: task-owned onboarding container, no approved payroll.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
async function main(){
 const [container,token]=process.argv.slice(2);assert(/^[a-f0-9]{12,64}$/.test(container)&&/^[a-f0-9]{24}$/.test(token));
 const info=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];assert(info.Id.startsWith(container));assert.equal(info.Config.Labels['rc.onboarding.token'],token);assert.equal(info.Config.Image,'postgres:17');assert.equal(info.Mounts.length,0);
 const environment=Object.fromEntries(info.Config.Env.map((entry:string)=>{const i=entry.indexOf('=');return [entry.slice(0,i),entry.slice(i+1)];}));assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(environment.POSTGRES_DB));
 const binding=info.NetworkSettings.Ports['5432/tcp'][0];assert.equal(binding.HostIp,'127.0.0.1');assert(!['5432','55432','55532'].includes(binding.HostPort));
 const req=createRequire(resolve('package.json')),{Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');
 const config={host:'127.0.0.1',port:Number(binding.HostPort),database:environment.POSTGRES_DB,user:'postgres',password:environment.POSTGRES_PASSWORD};const a=new Client(config),b=new Client(config);const first=randomUUID(),second=randomUUID();let owned=false;
 try{
  await a.connect();await b.connect();assert.equal((await a.query('SELECT current_database() db')).rows[0].db,environment.POSTGRES_DB);assert.equal((await a.query('SELECT count(*)::int n FROM payroll_runs')).rows[0].n,0);
  const company=(await a.query(`SELECT id FROM companies WHERE "singletonKey"='PRIMARY' AND name LIKE 'Synthetic%'`)).rows[0],actor=(await a.query(`SELECT id FROM users WHERE email='agmtest@example.invalid'`)).rows[0];assert(company&&actor);
  const pid=(await b.query('SELECT pg_backend_pid() id')).rows[0].id;
  const insert=`INSERT INTO payroll_runs(id,"companyId","payrollYear","payrollMonth","createdById","companySnapshot","updatedAt") VALUES($1,$2,2098,12,$3,'{"syntheticConstraintProbe":true}'::jsonb,clock_timestamp())`;
  await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await b.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await a.query(insert,[first,company.id,actor.id]);owned=true;
  const pending=b.query(insert,[second,company.id,actor.id]).then(()=>({code:'UNEXPECTED_SUCCESS'}),(error:{code:string})=>({code:error.code}));
  let overlap=false;for(let i=0;i<60;i++){if((await a.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){overlap=true;break;}await new Promise(r=>setTimeout(r,20));}assert(overlap,'Second live connection must contend on monthly uniqueness');
  await a.query('COMMIT');const result=await pending;assert(['23505','40001'].includes(result.code));await b.query('ROLLBACK');assert.equal((await a.query('SELECT count(*)::int n FROM payroll_runs WHERE "payrollYear"=2098 AND "payrollMonth"=12')).rows[0].n,1);
  await a.query('DELETE FROM payroll_runs WHERE id=$1',[first]);owned=false;assert.equal((await a.query('SELECT count(*)::int n FROM payroll_runs')).rows[0].n,0);
  console.log('PASS two independent PostgreSQL connections: observed lock contention, one monthly DRAFT winner, unique/serialization rejection, zero probe residue; DB gate only');
 }finally{await a.query('ROLLBACK').catch(()=>undefined);await b.query('ROLLBACK').catch(()=>undefined);if(owned)await a.query('DELETE FROM payroll_runs WHERE id=$1',[first]).catch(()=>undefined);await a.end();await b.end();}
}
main().catch((error:{name?:string;code?:string})=>{console.error(JSON.stringify({status:'FAIL',type:error.name,code:error.code}));process.exitCode=1;});
