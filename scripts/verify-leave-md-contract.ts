import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const req=createRequire(resolve('apps/api/package.json'));req('reflect-metadata');
async function main(){
 const {ValidationPipe}=req('@nestjs/common'),{RecommendLeaveDto,MdDecideLeaveDto}=await import('../apps/api/src/leave/leave.dto');
 const {LeaveService}=await import('../apps/api/src/leave/leave.service'),{LeaveWorkflowService}=await import('../apps/api/src/leave/leave-workflow.service'),{AuthorityWriter}=await import('../apps/api/src/authority/authority-writer');
 const {validatePermissionSelection}=await import('../apps/api/src/authority/permission-registry');
 let checks=0;const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}),valid={expectedVersion:1,decision:'RECOMMEND_APPROVAL',reason:'Independent review',idempotencyKey:'offline-key-123'};
 const transform=(input:unknown,dto:unknown)=>pipe.transform(input,{type:'body',metatype:dto});
 await transform(valid,RecommendLeaveDto);checks++;await transform({...valid,expectedVersion:2,decision:'REJECTED'},MdDecideLeaveDto);checks++;
 for(const input of [{...valid,decision:'APPROVED'},{...valid,actorId:'claimed'},{...valid,expectedVersion:0},{...valid,reason:'   '},{...valid,idempotencyKey:''},{...valid,companyId:'office'}]){await assert.rejects(()=>transform(input,RecommendLeaveDto));checks++;}
 await assert.rejects(()=>transform(valid,MdDecideLeaveDto));checks++;
 for(const code of ['leave.finalize','leave.md.view']){assert.throws(()=>validatePermissionSelection([code]));checks++;}
 const legacy=new LeaveService({$transaction:()=>{throw Error('No legacy writes allowed');}} as any,{} as any);await assert.rejects(()=>legacy.decide('request',{expectedVersion:1,decision:'APPROVED',reason:'Old HR bypass'},'claimed'),(e:any)=>e.getStatus()===409);checks++;
 const writer=new AuthorityWriter();await assert.rejects(()=>writer.execute('actor','LEAVE_MD',{}),(e:any)=>e.getStatus()===503);checks++;
 const service=new LeaveWorkflowService({$queryRaw:async()=>[{present:null}]} as any,writer);await assert.rejects(()=>service.command('r','MD',{expectedVersion:2,decision:'APPROVED',reason:'test',idempotencyKey:'offline-key'},'actor'),(e:any)=>e.getStatus()===503);checks++;
 const historic=await service.decorate({id:'r',employeeId:'e',status:'APPROVED',version:2}) as any;assert.equal(historic.finalDecisionAuthority,'LEGACY_HISTORICAL');assert(!historic.mdDecision);checks++;
 const decorated=new LeaveWorkflowService({$queryRaw:async()=>[{present:'leave_workflows'}],leaveWorkflow:{findUnique:async()=>({version:2,stage:'PENDING_MD_DECISION'})},leaveStageDecision:{findMany:async()=>[{id:'decision',stage:'HR',actorId:'hr',decision:'RECOMMEND_APPROVAL',reason:'Private review comments',createdAt:new Date(),requestVersion:1,authoritySnapshot:{actorName:'Reviewer',private:'Never expose'}}]}} as any,writer);
 const summary=await decorated.decorate({id:'r',employeeId:'e',status:'SUBMITTED',version:2}) as any;assert.equal(summary.status,'PENDING_MD_DECISION');assert(!JSON.stringify(summary).includes('Private review comments'));assert(!JSON.stringify(summary).includes('Never expose'));assert.equal(summary.hrRecommendation.actorId,undefined);checks++;
 const detail=await decorated.history({id:'r',employeeId:'e',status:'SUBMITTED',version:2,history:[]}) as any;assert.equal(detail.hrRecommendation.reason,'Private review comments');assert.equal(detail.hrRecommendation.actorName,'Reviewer');assert(!JSON.stringify(detail).includes('Never expose'));checks++;
 await assert.rejects(()=>decorated.history({id:'r',employeeId:'e'}),(e:any)=>e.getStatus()===403);checks++;
 const {SqlAuthorityExecutor}=await import('../apps/api/src/authority/sql-authority-executor');
 const dangerous=new SqlAuthorityExecutor({connect:async()=>({query:async()=>({rows:[{db:'real_capita_payroll_accept_'+'a'.repeat(32),role:'private_writer',login:'private_writer',elevated:false,database_owner:true,memberships:0,owned:0}]}),release:()=>undefined})},'real_capita_payroll_accept_'+'a'.repeat(32),'private_writer');
 await assert.rejects(()=>dangerous.execute('actor','LEAVE_MD',{}),(e:any)=>e.getStatus()===503);checks++;
 console.log(`PASS ${checks} offline HR/MD DTO, protected permission, legacy bypass, historical labeling, missing migration/writer and database-owner denial assertions; no database connection`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
