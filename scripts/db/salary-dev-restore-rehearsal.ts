// Restore only into this harness's new, labelled, tmpfs PostgreSQL instance.
// No connection to the existing server and no business backup values printed.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, join, resolve } from 'node:path';

const req=createRequire(resolve('package.json'));
const token=randomBytes(12).toString('hex'),name=`rc-restore-${token}`,database=`rc_restore_${token}`;
// Ephemeral technical fixture credential only; never a salary-dev role secret.
const password=randomBytes(32).toString('hex');
let created=false,containerId='',client: any;
const docker=(args: string[])=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],env:{...process.env,POSTGRES_PASSWORD:password}}).trim();
async function main(){
  const directory=process.env.SALARY_BACKUP_DIRECTORY;assert(directory&&isAbsolute(directory));
  const report=JSON.parse(readFileSync(join(directory,'preflight.json'),'utf8'));
  assert.equal(report.identity.database,'real_capita_accounts_salary_dev');
  const data=readFileSync(join(directory,'salary-dev.dump'));
  assert.equal(createHash('sha256').update(data).digest('hex'),report.backup.sha256);
  assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]),'');
  containerId=docker(['run','-d','--name',name,'--label',`rc.restore.token=${token}`,'--tmpfs','/var/lib/postgresql/data','-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD','-e',`POSTGRES_DB=${database}`,'postgres:17']);created=true;
  const config=JSON.parse(docker(['inspect',name]))[0];
  assert.equal(config.Id,containerId);assert.equal(config.Config.Labels['rc.restore.token'],token);
  assert.equal(config.Mounts.filter((m: any)=>m.Type==='volume'||m.Type==='bind').length,0);
  const binding=config.NetworkSettings.Ports['5432/tcp'][0];assert.equal(binding.HostIp,'127.0.0.1');assert(!['55532','55432','5432'].includes(binding.HostPort));
  const {Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');
  const url=new URL(`postgresql://postgres@127.0.0.1:${binding.HostPort}/${database}`);url.password=password;
  let ready=false;
  for(let n=0;n<60;n++){
    const c=new Client({connectionString:url.toString()});
    try{await c.connect();assert.equal((await c.query('SELECT current_database() AS db')).rows[0].db,database);ready=true;break;}
    catch{await new Promise(r=>setTimeout(r,300));}finally{await c.end();}
  }
  assert(ready,'New isolated PostgreSQL unavailable');
  client=new Client({connectionString:url.toString()});await client.connect();
  assert.equal((await client.query('SELECT current_database() AS db')).rows[0].db,database);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public'")).rows[0].n,0);
  const restored=spawnSync('docker',['exec','-i',containerId,'pg_restore','--username=postgres',`--dbname=${database}`,'--no-owner','--no-privileges','--exit-on-error','--single-transaction'],{input:data,maxBuffer:8*1024*1024});
  assert.equal(restored.status,0,'Isolated restore failed; diagnostics withheld');
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL TIME ZONE 'UTC'");
  const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r: any)=>r.tablename);
  assert.deepEqual(tables,report.records.map((r: any)=>r.table));
  for(const r of report.records){
    assert(/^[a-z_]+$/.test(r.table));
    const restoredRows=(await client.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row_hash,'' ORDER BY row_hash),'')) AS fingerprint FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public."${r.table}" t) rows`)).rows[0];
    assert.equal(restoredRows.count,r.count,`${r.table} count differs`);assert.equal(restoredRows.fingerprint,r.fingerprint,`${r.table} contents differ`);
  }
  const migrations=(await client.query('SELECT migration_name,checksum FROM _prisma_migrations ORDER BY migration_name')).rows;
  assert.deepEqual(migrations,report.migrations.map((m: any)=>({migration_name:m.migration_name,checksum:m.checksum})));
  const constraints=(await client.query("SELECT count(*)::int AS n FROM pg_constraint WHERE connamespace='public'::regnamespace AND NOT convalidated")).rows[0].n;assert.equal(constraints,0);
  await client.query('ROLLBACK');await client.end();client=undefined;
  writeFileSync(join(directory,'restore-rehearsal.json'),JSON.stringify({verifiedAt:new Date().toISOString(),archiveSha256:report.backup.sha256,isolatedDatabase:database,containerId,tables:tables.length,allCountsAndFingerprintsMatch:true,migrationHistoryMatches:true,unvalidatedConstraints:0,ownershipAndAclRestoreTested:false},null,2),{flag:'wx'});
  console.log(`PASS actual isolated PostgreSQL 17 restore: ${tables.length} table counts/content fingerprints and migration history match; no unvalidated constraints. Ownership/ACLs deliberately excluded and remain a separate deployment gate.`);
}
main().catch(()=>{console.error('BLOCKED restore rehearsal; secrets and business contents suppressed');process.exitCode=1;}).finally(async()=>{
  if(client)await client.end();
  if(created){
    const config=JSON.parse(docker(['inspect',name]))[0];assert.equal(config.Id,containerId);assert.equal(config.Config.Labels['rc.restore.token'],token);
    assert.equal(config.Mounts.filter((m: any)=>m.Type==='volume'||m.Type==='bind').length,0);
    docker(['rm','-f',containerId]);assert.equal(docker(['ps','-aq','--filter',`name=^/${name}$`]),'');
    console.log('PASS cleanup: exact harness-owned tmpfs restore container removed; existing databases/volumes untouched');
  }
});
