// Focused offline behavioral tests. Real PostgreSQL assertions run separately.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {LeaveService} from '../apps/api/src/leave/leave.service';
import {SubmitLeaveDto} from '../apps/api/src/leave/leave.dto';
const apiRequire=createRequire(resolve('apps/api/package.json'));
const {plainToInstance}=apiRequire('class-transformer'),{validate}=apiRequire('class-validator');
async function main(){
 const base={employeeId:'employee',categoryId:'category',startDate:'2027-01-01',endDate:'2027-01-02',reason:'Private request',idempotencyKey:'central-request-001'};
 const errors:{property:string}[]=await validate(plainToInstance(SubmitLeaveDto,{...base,companyId:'other-company'}),{whitelist:true,forbidNonWhitelisted:true});
 assert(errors.some(e=>e.property==='companyId'),'Ownership injection must be rejected, not accepted as office context');
 console.log('PASS submission DTO rejects authoritative ownership injection');
 const parent={id:'parent',name:'Real Capita Group',legalName:'Real Capita Group Ltd',singletonKey:'PRIMARY',isActive:true};let selected:string|null=null,stored:any;
 const tx:any={
  $queryRaw:async()=>[],user:{findFirst:async()=>({id:'actor'})},
  company:{findUnique:async()=>parent,findFirst:async({where}:any)=>where.id==='reporting-company'?{id:where.id,name:'Configured reporting context',isActive:true}:null},
  employee:{findFirst:async()=>({id:'employee',employeeCode:'GLOBAL',fullName:'Synthetic Employee',joiningDate:new Date('2020-01-01'),separationDate:null,isActive:true,updatedAt:new Date('2026-01-01'),departmentId:null,department:null})},
  leaveCategory:{findFirst:async()=>({id:'category',name:'Configured category'})},
  leaveRequest:{findUnique:async()=>null,create:async({data}:any)=>{stored={...data,id:'request',status:'SUBMITTED',version:1,reviewAuthoritySnapshot:null,reviewedAt:null,reviewedById:null};selected=data.companyId;return stored;}},
  leaveRequestEvent:{create:async()=>({})},auditEvent:{create:async()=>({})}
 };
 const authority:any={subject:async()=>({employeeId:'employee',revision:'verified-binding'}),hr:async()=>null,categorySupported:async()=>true};
 const service=new LeaveService({$transaction:async(fn:any)=>fn(tx)} as any,authority);
 const request=await service.submit(base,'actor','unrelated-selected-office');
 assert.equal(selected,'parent');assert.equal(request.owningCompany.id,'parent');assert.equal(request.officeContext,null);
 const reported=await service.submit({...base,officeContextCompanyId:'reporting-company'} as SubmitLeaveDto,'actor');
 assert.equal(selected,'parent');assert.equal(reported.officeContext?.companyId,'reporting-company');assert.equal(reported.officeContext?.assignmentVerified,false);assert.equal(reported.officeContext?.reportingOnly,true);
 assert.equal(stored.identitySnapshot.owningCompany.id,'parent');
 await assert.rejects(()=>service.submit({...base,companyId:'injected'} as SubmitLeaveDto,'actor'),(e:any)=>e.getStatus()===400);
 await assert.rejects(()=>service.submit({...base,officeContextCompanyId:'unknown'} as SubmitLeaveDto,'actor'),(e:any)=>e.getStatus()===400);
 parent.isActive=false;await assert.rejects(()=>service.submit(base,'actor'),(e:any)=>e.getStatus()===503);parent.isActive=true;
 tx.company.findUnique=async()=>null;await assert.rejects(()=>service.submit(base,'actor'),(e:any)=>e.getStatus()===503);
 console.log('PASS active PRIMARY ownership, selected-office independence, optional validated reporting snapshot, override rejection, missing/inactive parent fail-closed; offline doubles only');
}
main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:e);process.exitCode=1;});
