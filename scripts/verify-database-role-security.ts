import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const req=createRequire(resolve('package.json'));
const token=randomBytes(12).toString('hex'),name=`rc-security-${token}`,password=randomBytes(32).toString('hex'),database=`rc_security_${token}`;
let created=false,containerId='';
const docker=(args: string[])=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
async function main(){
  assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]),'');
  // New instance, unique label, ephemeral tmpfs. No existing volumes/containers.
  containerId=docker(['run','-d','--name',name,'--label',`rc.security.token=${token}`,'--tmpfs','/var/lib/postgresql/data','-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD','-e',`POSTGRES_DB=${database}`,'postgres:17']);created=true;
  const config=JSON.parse(docker(['inspect',name]))[0];assert.equal(config.Id,containerId);assert.equal(config.Config.Labels['rc.security.token'],token);assert.equal(config.Mounts.filter((m: any)=>m.Type==='volume'||m.Type==='bind').length,0);
  const binding=config.NetworkSettings.Ports['5432/tcp'][0];assert.equal(binding.HostIp,'127.0.0.1');assert(!['55532','55432','5432'].includes(binding.HostPort));
  const url=new URL(`postgresql://postgres@127.0.0.1:${binding.HostPort}/${database}`);url.password=password;
  const {Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');
  let ready=false;for(let n=0;n<60;n++){const c=new Client({connectionString:url.toString()});try{await c.connect();assert.equal((await c.query('SELECT current_database() AS db')).rows[0].db,database);ready=true;break;}catch{await new Promise(r=>setTimeout(r,300));}finally{await c.end();}}assert(ready,'Isolated PostgreSQL unavailable');
  console.log('PASS separate PostgreSQL 17 instance: unique label/id, loopback dynamic port, tmpfs, no existing volumes');
  execFileSync(process.execPath,[req.resolve('tsx/cli'),'--tsconfig','apps/api/tsconfig.json','scripts/verify-payroll-acceptance.ts','--role-security',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,PAYROLL_SECURITY_INSTANCE_URL:url.toString(),PAYROLL_SECURITY_TOKEN:token,DATABASE_URL:undefined,MIGRATION_DATABASE_URL:undefined,FINANCE_PROVISIONING_DATABASE_URL:undefined}});
}
// Docker accepts POSTGRES_PASSWORD via the environment; never in command text.
const original=process.env.POSTGRES_PASSWORD;process.env.POSTGRES_PASSWORD=password;
main().catch(()=>{console.error('FAIL isolated database security verification (credentials/commands suppressed)');process.exitCode=1;}).finally(()=>{
 try{if(created){const config=JSON.parse(docker(['inspect',name]))[0];assert.equal(config.Id,containerId);assert.equal(config.Config.Labels['rc.security.token'],token);assert.equal(config.Mounts.filter((m: any)=>m.Type==='volume'||m.Type==='bind').length,0);docker(['rm','-f',containerId]);assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]),'');console.log('PASS cleanup: only exact task-created tmpfs container removed; no business volumes/roles touched');}}
 catch{console.error('BLOCKED isolated container cleanup: ownership assertion failed');process.exitCode=1;}
 finally{if(original===undefined)delete process.env.POSTGRES_PASSWORD;else process.env.POSTGRES_PASSWORD=original;}
});
