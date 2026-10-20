// Sprint 7E independent read-only verification; external evidence only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
const root=resolve('.'),req=createRequire(join(root,'package.json'));
const target='real_capita_accounts_salary_dev';
const added=['authority_bootstraps','authority_mandates','authority_role_grants','authority_requests','authority_events','leave_workflows','leave_stage_decisions'];
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const directory=process.env.SALARY_BACKUP_DIRECTORY!,privateDirectory=process.env.SALARY_PRIVATE_DIRECTORY!;
let admin:any;
const save=(name:string,value:any)=>writeFileSync(join(directory,name),JSON.stringify(value,null,2),{flag:'wx'});
function secret(name:string){const file=join(privateDirectory,name+'.clixml');assert(!file.includes("'"));return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$s=Import-Clixml -LiteralPath '${file}';$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
async function main(){
 assert(directory.startsWith('E:\\Joy\\salary-dev-backups\\sprint7e-'));
 const url=new URL(secret('maintenance'));assert.equal(url.host,'localhost:55532');assert.equal(url.pathname,'/'+target);
 const {Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg');admin=new Client({connectionString:url.toString(),options:'-c default_transaction_read_only=on'});await admin.connect();
 const identity=(await admin.query("SELECT current_database() db,current_user role,current_setting('server_version_num')::int version")).rows[0];assert.equal(identity.db,target);
 const history=(await admin.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name')).rows;for(const m of history){assert(m.finished_at&&!m.rolled_back_at);assert.equal(m.checksum,hash(readFileSync(join('prisma/migrations',m.migration_name,'migration.sql'))));}assert(!history.some((m:any)=>m.migration_name==='20261015000000_payroll_confirmation_evidence'));
 const functions=(await admin.query("SELECT proname,prosecdef,proconfig,proacl::text acl,pg_get_userbyid(proowner) owner FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'authority_%' OR proname LIKE 'leave_%') ORDER BY proname")).rows;
 const connections=(await admin.query("SELECT rolname,has_database_privilege(rolname,current_database(),'CONNECT') allowed FROM pg_roles WHERE rolname IN ('rc_salary_runtime','rc_salary_finance') ORDER BY rolname")).rows;
 const saved=JSON.parse(readFileSync(join(directory,'preflight.json'),'utf8')),old=JSON.parse(readFileSync(join(directory,'authority-before.json'),'utf8'));await admin.query("SET TIME ZONE 'UTC'");let compared=0;
 for(const r of old.records){const names=old.columns.filter((c:any)=>c.table_name===r.table).map((c:any)=>'"'+c.column_name+'"').join(',');const row=(await admin.query(`SELECT count(*)::int count,md5(COALESCE(string_agg(h,'' ORDER BY h),'')) fingerprint FROM (SELECT md5(row_to_json(t)::text) h FROM (SELECT ${names} FROM "${r.table}") t) q`)).rows[0];assert.equal(row.count,r.count);assert.equal(row.fingerprint,r.fingerprint);compared++;}
 const tables=(await admin.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r:any)=>r.tablename);const empty:any={};for(const t of added.filter(t=>tables.includes(t)))empty[t]=(await admin.query(`SELECT count(*)::int n FROM ${t}`)).rows[0].n;
 assert.equal(history.length,18);assert(connections.every((r:any)=>r.allowed));assert(Object.values(empty).every(n=>n===0));assert.equal(tables.length,63);
 for(const row of saved.owners){const actual=(await admin.query("SELECT relname,pg_get_userbyid(relowner) owner,relacl::text acl FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=$1",[row.relname])).rows[0];assert.deepEqual(actual,row,'Original table ACL/owner changed '+row.relname);}
 const grants=[];for(const t of added){for(const role of ['rc_salary_runtime','rc_salary_finance']){const row=(await admin.query("SELECT has_table_privilege($1,$2,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') writes",[role,t])).rows[0];assert.equal(row.writes,false);}const p=(await admin.query("SELECT count(*)::int n FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=$1::regclass AND a.grantee=0",[t])).rows[0];assert.equal(p.n,0);grants.push({table:t,runtimeWrite:false,financeWrite:false,publicGrants:0});}
 for(const f of functions){assert.equal(f.owner,'rc_salary_migration');if(f.prosecdef)assert(f.proconfig?.some((p:string)=>p.startsWith('search_path=')));}
 for(const name of ['authority_command','leave_stage_command']){const f=functions.find((f:any)=>f.proname===name);assert(f&&f.acl==='{rc_salary_migration=X/rc_salary_migration}');}
 const dbAcl=(await admin.query("SELECT grantor::regrole::text,grantee::regrole::text,privilege_type,is_grantable FROM pg_database d CROSS JOIN LATERAL aclexplode(d.datacl) WHERE d.datname=current_database() ORDER BY 1,2,3")).rows;assert.deepEqual(dbAcl,old.acl);
 const report={grants,databaseAclRestored:true,originalObjectAclPreserved:true,verifiedAt:new Date().toISOString(),identity,history,functions,connections,businessTablesPreserved:compared,newTableCounts:empty,backupSha256:hash(readFileSync(join(directory,'salary-dev.dump'))),originalBackupSha256:saved.backup.sha256};assert.equal(report.backupSha256,saved.backup.sha256);
 save(process.env.AUTHORITY_VERIFY_REPORT??'authority-final-readonly.json',report);console.log(JSON.stringify({identity,migrations:history.length,connections,businessTablesPreserved:compared,newTableCounts:empty,functions:functions.filter((f:any)=>f.prosecdef)},null,2));
}
main().catch(()=>{console.error('BLOCKED read-only authority verification');process.exitCode=1;}).finally(async()=>{if(admin)await admin.end();});
