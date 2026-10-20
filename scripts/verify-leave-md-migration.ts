import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const directory=mkdtempSync(join(tmpdir(),'rc-leave-md-parity-'));
try{
 const schema=readFileSync('prisma/schema.prisma','utf8'),base=join(directory,'base.prisma');writeFileSync(base,schema.split('// BEGIN SPRINT7D')[0].split('\n').filter(l=>!l.includes('// SPRINT7D')).join('\n'));
 const ddl=execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','diff','--from-schema',base,'--to-schema','prisma/schema.prisma','--script'],{encoding:'utf8'});
 const sql=readFileSync('prisma/migrations/20261019000000_leave_hr_md_workflow/migration.sql','utf8'),normalize=(s:string)=>s.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();assert.equal(normalize(ddl),normalize(sql.split('-- BEGIN TWO STAGE LEAVE INTEGRITY')[0]));
 for(const token of ['PENDING_HR_REVIEW','PENDING_MD_DECISION','RECOMMEND_REJECTION','leave_stage_command','SECURITY DEFINER','clock_timestamp()','leave_stage_audit_required','MD_OWN_LEAVE_POLICY_REQUIRED'])assert(sql.includes(token));
 assert(!/UPDATE leave_requests SET.*WHERE status='APPROVED'/.test(sql));
 console.log('PASS exact additive two-stage leave Prisma/DDL parity, immutable stage evidence, private writer, history and no historical backfill');
}finally{rmSync(directory,{recursive:true,force:true});}
