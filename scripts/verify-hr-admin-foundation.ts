import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const temp=mkdtempSync(join(tmpdir(),'rc-hr4-parity-'));
try{
 const schema=readFileSync('prisma/schema.prisma','utf8').split('// BEGIN SPRINT7B')[0].split('\n').filter(l=>!l.includes('// SPRINT7B')&&!l.includes('// SPRINT7D')).join('\n'),before=schema.split('// BEGIN SPRINT4')[0].split('\n').filter(l=>!l.includes('// HR4')).join('\n');writeFileSync(join(temp,'before.prisma'),before);
 writeFileSync(join(temp,'hr.prisma'),schema);const generated=execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','diff','--from-schema',join(temp,'before.prisma'),'--to-schema',join(temp,'hr.prisma'),'--script'],{encoding:'utf8'}),sql=readFileSync('prisma/migrations/20261017000000_hr_admin_identity/migration.sql','utf8');
 const normalize=(s:string)=>s.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();assert.equal(normalize(sql.split('-- BEGIN HR ADMIN INTEGRITY')[0]),normalize(generated));
 for(const term of ['employee_binding_active_user_unique','employee_binding_active_employee_unique','user_permission_unreleased_unique','DEFERRABLE INITIALLY DEFERRED','clock_timestamp()','Atomic administration history required'])assert(sql.includes(term));
 assert(!sql.includes('DROP TABLE'));assert(!sql.includes('INSERT INTO user_permissions'));console.log('PASS exact HR/Admin additive Prisma/migration parity, durable binding/grant uniqueness, expiry and immutable audit contract; no database connection or privilege bootstrap');
}finally{rmSync(temp,{recursive:true,force:true});}
