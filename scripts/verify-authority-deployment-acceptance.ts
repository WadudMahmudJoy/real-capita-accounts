// Reuse the authority suite with the reviewed Sprint 7D retirement contract.
// Original reviewed files remain byte-for-byte intact; all writes are isolated.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
const root=resolve('.'),req=createRequire(join(root,'package.json'));
const prefix='.sprint7e-'+randomBytes(12).toString('hex'),created:string[]=[];
const write=(suffix:string,source:string)=>{const path=resolve('scripts',prefix+suffix+'.ts');writeFileSync(path,source,{flag:'wx'});created.push(path);return path;};
try{
 const authority=readFileSync('scripts/authority-postgres-acceptance.ts','utf8');
 assert(authority.includes("e.message.includes('MD_LEAVE_ROUTING_CONTRACT_REQUIRED')"));
 write('-authority',authority.replace("e.message.includes('MD_LEAVE_ROUTING_CONTRACT_REQUIRED')","e.message.includes('HR_ONLY_FINAL_DECISION_RETIRED')"));
 let fixture=readFileSync('scripts/hr-admin-browser-environment.ts','utf8');
 const legacy="await leave.decide(approved.id,{decision:'APPROVED',expectedVersion:1,reason:'Independent HR review'},sprintFixture.reviewerId);";
 assert(fixture.includes(legacy));
 // Assert the retired call fails, preserving the request for privacy probes.
 fixture=fixture.replace(legacy,"await assert.rejects(()=>leave.decide(approved.id,{decision:'APPROVED',expectedVersion:1,reason:'Retired HR-only path'},sprintFixture.reviewerId),(e:any)=>e.getStatus()===409&&e.message.includes('HR_ONLY_FINAL_DECISION_RETIRED'));");
 fixture=fixture.replaceAll("'./authority-postgres-acceptance'",JSON.stringify('./'+prefix+'-authority'));
 write('-fixture',fixture);
 const acceptance=readFileSync('scripts/verify-payroll-acceptance.ts','utf8').replace("'./hr-admin-browser-environment'",JSON.stringify('./'+prefix+'-fixture'));
 const acceptancePath=write('-acceptance',acceptance);
 const security=readFileSync('scripts/verify-database-role-security.ts','utf8').replace("'scripts/verify-payroll-acceptance.ts'",JSON.stringify(acceptancePath));
 const securityPath=write('-security',security);
 const result=spawnSync(process.execPath,[req.resolve('tsx/cli'),'--tsconfig','apps/api/tsconfig.json',securityPath,'--hr-only-artifact','--hr-admin-sprint4','--hr4-db-only','--authority-sprint7b','--authority-db-only','--authority-fast'],{cwd:root,env:{...process.env},stdio:'inherit'});
 assert.equal(result.status,0,'Isolated authority acceptance failed');
}finally{for(const file of created){assert(file.startsWith(resolve('scripts',prefix)));unlinkSync(file);}}
