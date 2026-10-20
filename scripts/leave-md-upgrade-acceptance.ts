import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
export async function verifyLeaveHistoricalUpgrade(c:any,ids:{worker:string;hr:string;employee:string;hrEmployee:string;department:string;company:string;category:string;identity:unknown}){
 const {owner,security,apiReq,temp,req}=c;const target='real_capita_payroll_accept_'+randomBytes(16).toString('hex');
 const base=new URL(security.url(security.migration));assert.equal(base.hostname,'127.0.0.1');assert(!['55532','55432','5432'].includes(base.port));const role=base.username;assert(/^[a-z_][a-z0-9_]*$/.test(role));
 const {Client}=apiReq('pg');let database:any,created=false;
 try{
  assert.equal((await owner.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rows.length,0);await owner.query(`CREATE DATABASE "${target}" OWNER "${role}"`);created=true;base.pathname='/'+target;
  const bundle=join(temp,'historical-upgrade-migrations');mkdirSync(bundle);copyFileSync(resolve('prisma/migrations/migration_lock.toml'),join(bundle,'migration_lock.toml'));
  const names=readdirSync('prisma/migrations',{withFileTypes:true}).filter(d=>d.isDirectory()&&!['20261015000000_payroll_confirmation_evidence','20261018000000_md_authority_foundation','20261019000000_leave_hr_md_workflow'].includes(d.name)).map(d=>d.name).sort();assert.equal(names.length,16);
  const copy=(name:string)=>{mkdirSync(join(bundle,name));copyFileSync(resolve('prisma/migrations',name,'migration.sql'),join(bundle,name,'migration.sql'));};names.forEach(copy);
  const config=join(temp,'historical-upgrade.config.ts');writeFileSync(config,`const {defineConfig}=require(${JSON.stringify(req.resolve('prisma/config'))});export default defineConfig({schema:${JSON.stringify(resolve('prisma/schema.prisma'))},migrations:{path:${JSON.stringify(bundle)}},datasource:{url:process.env.UPGRADE_MIGRATION_URL}});`);
  const deploy=()=>{try{execFileSync(process.execPath,[req.resolve('prisma/build/index.js'),'migrate','deploy','--config',config],{cwd:resolve('.'),env:{...process.env,UPGRADE_MIGRATION_URL:base.toString()},stdio:['ignore','pipe','pipe']});}catch(e:any){const diagnostic=String(e.stderr??e.stdout??'').replace(/postgres(?:ql)?:\/\/[^\s"']+/gi,'[redacted connection]').slice(0,2400);console.error('ISOLATED_UPGRADE_DIAGNOSTIC '+diagnostic);throw Error('Isolated historical upgrade migration deployment failed; no business database involved');}};
  deploy();database=new Client({connectionString:base.toString()});await database.connect();assert.equal((await database.query('SELECT current_database() db')).rows[0].db,target);await database.query("SET TIME ZONE 'UTC'");
  const context=(ids.identity as {officeContext?:{companyId?:string}})?.officeContext?.companyId;
  for(const [table,keys] of [['users',[ids.worker,ids.hr]],['companies',[...new Set([ids.company,...(context?[context]:[])])]],['departments',[ids.department]],['employees',[ids.employee,ids.hrEmployee]],['leave_categories',[ids.category]]] as [string,string[]][]){assert(/^[a-z_]+$/.test(table));const rows=(await owner.query(`SELECT to_jsonb(t) row FROM "${table}" t WHERE id=ANY($1::text[])`,[keys])).rows;assert.equal(rows.length,keys.length);for(const row of rows)await database.query(`INSERT INTO "${table}" SELECT * FROM jsonb_populate_record(NULL::"${table}",$1::jsonb)`,[JSON.stringify(row.row)]);}
  const first='legacy-approved-'+randomBytes(6).toString('hex'),pending='legacy-pending-'+randomBytes(6).toString('hex');
  // Technical historical rows use the OLD deployed SQL lifecycle, never an MD
  // claim or business authorization. New positive flows use the actual HTTP API.
  for(const [id,day] of [[first,'2027-06-01'],[pending,'2027-06-02']]){
   await database.query('BEGIN');const row=(await database.query(`INSERT INTO leave_requests(id,"employeeId","companyId","categoryId","createdById","startDate","endDate",reason,"idempotencyKey","identitySnapshot") VALUES($1::text,$2,$3,$4,$5,$6::date,$6::date,'Synthetic pre-MD history',$1::text,$7::jsonb) RETURNING to_jsonb(leave_requests.*) row`,[id,ids.employee,ids.company,ids.category,ids.worker,day,JSON.stringify(ids.identity)])).rows[0].row;
   await database.query(`INSERT INTO leave_request_events(id,"requestId","actorId",action,version,snapshot) VALUES($1,$1,$2,'SUBMITTED',1,jsonb_build_object('before',NULL,'after',$3::jsonb))`,[id,ids.worker,JSON.stringify(row)]);await database.query('COMMIT');
  }
  await database.query('BEGIN');const before=(await database.query('SELECT to_jsonb(t) row FROM leave_requests t WHERE id=$1',[first])).rows[0].row;
  const after=(await database.query(`UPDATE leave_requests SET status='APPROVED',version=2,"reviewedById"=$2,"reviewedAt"=clock_timestamp(),"decisionReason"='Historical HR final decision',"reviewAuthoritySnapshot"=jsonb_build_object('revision','isolated-legacy-hr','reviewerEmployeeId',$3::text,'reviewerName','Historical HR','authority','EXPLICIT_HR_ADMIN') WHERE id=$1 RETURNING to_jsonb(leave_requests.*) row`,[first,ids.hr,ids.hrEmployee])).rows[0].row;
  await database.query(`INSERT INTO leave_request_events(id,"requestId","actorId",action,version,snapshot) VALUES($1,$2,$3,'APPROVED',2,jsonb_build_object('before',$4::jsonb,'after',$5::jsonb))`,[first+'-final',first,ids.hr,JSON.stringify(before),JSON.stringify(after)]);await database.query('COMMIT');
  const fingerprint=async()=>({requests:(await database.query(`SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) hash FROM leave_requests t`)).rows[0].hash,events:(await database.query(`SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) hash FROM leave_request_events t`)).rows[0].hash});const baseline=await fingerprint();
  copy('20261018000000_md_authority_foundation');copy('20261019000000_leave_hr_md_workflow');deploy();assert.deepEqual(await fingerprint(),baseline);
  assert.equal((await database.query('SELECT count(*)::int n FROM leave_workflows')).rows[0].n,0);assert.equal((await database.query('SELECT count(*)::int n FROM leave_stage_decisions')).rows[0].n,0);
  const history=(await database.query('SELECT migration_name,finished_at,rolled_back_at FROM _prisma_migrations')).rows;assert.equal(history.length,18);assert(history.every((h:any)=>h.finished_at&&!h.rolled_back_at&&h.migration_name!=='20261015000000_payroll_confirmation_evidence'));
  await assert.rejects(()=>database.query(`UPDATE leave_requests SET status='REJECTED' WHERE id=$1`,[first]));
  await assert.rejects(()=>database.query(`UPDATE leave_requests SET status='APPROVED',version=2 WHERE id=$1`,[pending]));
  console.log('PASS historical upgrade: genuine Prisma 16 -> 18 migration history excluding deferred 15; exact legacy approved/pending row and event fingerprints preserved, no fabricated workflow/MD approvals, legacy mutation blocked');
 }finally{if(database)await database.end();if(created){assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(target));assert.equal((await owner.query('SELECT count(*)::int n FROM pg_stat_activity WHERE datname=$1',[target])).rows[0].n,0);await owner.query(`DROP DATABASE "${target}"`);console.log('PASS cleanup exact task-created historical-upgrade database, zero sessions');}}
}
