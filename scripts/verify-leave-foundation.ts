import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const temp=mkdtempSync(join(tmpdir(),'rc-leave-parity-'));
try{
 const schema=readFileSync('prisma/schema.prisma','utf8').split('// BEGIN SPRINT7B')[0].split('\n').filter(l=>!l.includes('// SPRINT7B')&&!l.includes('// SPRINT7D')).join('\n').split('// BEGIN SPRINT4')[0].split('\n').filter(l=>!l.includes('// HR4')).join('\n'),before=schema.replace(/\nenum LeaveRequestStatus[\s\S]*$/,'').replace(/^.*(?:leaveRequests LeaveRequest|withdrawnLeaveRequests LeaveRequest|reviewedLeaveRequests LeaveRequest|leaveEvents LeaveRequestEvent).*\r?\n/gm,'');writeFileSync(join(temp,'before.prisma'),before);
 writeFileSync(join(temp,'leave.prisma'),schema);
 const sql=readFileSync('prisma/migrations/20261016000000_leave_request_foundation/migration.sql','utf8'),generated=execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','diff','--from-schema',join(temp,'before.prisma'),'--to-schema',join(temp,'leave.prisma'),'--script'],{encoding:'utf8'});
 const normalize=(s:string)=>s.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();assert.equal(normalize(sql.split('-- BEGIN LEAVE INTEGRITY')[0]),normalize(generated));
 for(const term of ['EXCLUDE USING gist','daterange("startDate","endDate",\'[]\')','WHERE (status IN (\'SUBMITTED\',\'APPROVED\'))','DEFERRABLE INITIALLY DEFERRED','Only durable pending request decisions','Leave audit history is immutable','IS NOT NULL'])assert(sql.includes(term));
 assert.equal((sql.match(/TIMESTAMPTZ\(3\)/g)||[]).length,4);assert(!sql.includes('ALTER TABLE "employees"'));assert(!sql.includes('DROP TABLE'));console.log('PASS additive leave Prisma/migration parity, inclusive global overlap, immutable history, atomic events, restrictive references and timezone-aware new timestamps; no DB connection');
 for(const term of ['leave_parent_context_guard','NEW."companyId" IS DISTINCT FROM parent.id',"WHERE \"singletonKey\"='PRIMARY' FOR SHARE","context->'reportingOnly' IS DISTINCT FROM 'true'::jsonb","context->'assignmentVerified' IS DISTINCT FROM 'false'::jsonb",'Verified historical PRIMARY snapshot required'])assert(sql.includes(term));
 console.log('PASS central PRIMARY SQL owner and independent optional reporting snapshot guard contract; no new Prisma columns');
}finally{rmSync(temp,{recursive:true,force:true});}
