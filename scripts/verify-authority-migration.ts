import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PERMISSION_REGISTRY} from '../apps/api/src/authority/permission-registry';
const directory=mkdtempSync(join(tmpdir(),'rc-authority-parity-'));
try{
 const schema=readFileSync('prisma/schema.prisma','utf8').split('// BEGIN SPRINT7D')[0].split('\n').filter(l=>!l.includes('// SPRINT7D')).join('\n');
 const authoritySchema=join(directory,'authority.prisma');writeFileSync(authoritySchema,schema);
 const base=join(directory,'base.prisma');writeFileSync(base,schema.split('// BEGIN SPRINT7B')[0].split('\n').filter(l=>!l.includes('// SPRINT7B')).join('\n'));
 const generated=execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','diff','--from-schema',base,'--to-schema',authoritySchema,'--script'],{encoding:'utf8'});
 const migration=readFileSync('prisma/migrations/20261018000000_md_authority_foundation/migration.sql','utf8');const normalize=(value:string)=>value.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();
 assert.equal(normalize(generated),normalize(migration.split('-- BEGIN AUTHORITY INTEGRITY')[0]));
 const sqlCodes=(pattern:RegExp)=>[...migration.match(pattern)![1].matchAll(/'([^']+)'/g)].map(m=>m[1]).sort();
 assert.deepEqual(sqlCodes(/"permissionCodes" <@ ARRAY\[([^\]]*)\]/),PERMISSION_REGISTRY.filter(p=>p.assignable).map(p=>p.code).sort());
 assert.deepEqual(sqlCodes(/ceiling <@ ARRAY\[([^\]]*)\]/),PERMISSION_REGISTRY.filter(p=>p.delegable).map(p=>p.code).sort());
 for(const match of migration.matchAll(/ARRAY\[([^\]]*)\]/g)){
  const values=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).sort();
  if(!values.includes('roles.view'))continue;
  const expected=values.includes('authority.review')?PERMISSION_REGISTRY:values.includes('roles.manage')?PERMISSION_REGISTRY.filter(p=>p.delegable):PERMISSION_REGISTRY.filter(p=>p.assignable);
  assert.deepEqual(values,expected.map(p=>p.code).sort(),'Every SQL registry/root/delegation ceiling must match the canonical source');
 }
 for(const guard of ['authority_one_initial_md','authority_active_delegate','authority_active_role_grant','INDEPENDENT_MD_REQUIRED','PERMISSION_CEILING','SECURITY DEFINER','clock_timestamp()','authority_events_immutable','authority_legacy_permission_boundary','authority_user_provision_boundary'])assert(migration.includes(guard));
 assert(migration.includes('r."permissionCodes"<@m.ceiling'));
 assert(!/DROP TABLE|DISABLE TRIGGER|INSERT INTO authority_bootstraps/i.test(migration));
 console.log('PASS exact additive authority Prisma/DDL parity, restrictive foreign keys, protected writer/MD boundaries, immutable history and no bootstrap seed; no database connection');
}finally{rmSync(directory,{recursive:true,force:true});}
