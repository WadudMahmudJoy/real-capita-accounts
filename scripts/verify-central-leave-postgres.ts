import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyCentralLeavePostgres(c:any){
 const {db,apiDb,app,load,actor,office,parent,roster,result}=c;
 const leave=app.get(load('leave/leave.service.js').LeaveService),users=app.get(load('users/users.service.js').UsersService);
 const worker=await db.user.findUniqueOrThrow({where:{id:result.workerId}}),reviewer=await db.user.findUniqueOrThrow({where:{email:'independent-hr@example.invalid'}});
 if(!(await users.access(reviewer.id)).hrAdmin){const u=await users.get(reviewer.id,actor.id);await users.action(reviewer.id,{action:'GRANT_PERMISSION',permission:'HR_ADMIN',expectedVersion:u.adminVersion,reason:'Renew isolated central-ownership test reviewer'},actor.id);}
 let checks=0;const ok=(value:boolean)=>{assert(value);checks++;};
 const input={employeeId:roster[0].id,categoryId:result.categoryId,startDate:'2028-01-01',endDate:'2028-01-01',reason:'Central ownership technical acceptance',idempotencyKey:randomUUID()};
 const initial=await leave.submit(input,worker.id,office.id),stored=await db.leaveRequest.findUniqueOrThrow({where:{id:initial.id}});
 ok(stored.companyId===parent.id);ok(initial.owningCompany.id===parent.id&&initial.officeContext===null);ok(stored.identitySnapshot.owningCompany.marker==='PRIMARY');
 await assert.rejects(()=>leave.submit({...input,companyId:office.id,idempotencyKey:randomUUID()},worker.id),(e:any)=>e.getStatus()===400);checks++;
 const contextual={...input,startDate:'2028-01-03',endDate:'2028-01-03',officeContextCompanyId:office.id,idempotencyKey:randomUUID()};
 const report=await leave.submit(contextual,worker.id,'untrusted-selected-company');ok(report.owningCompany.id===parent.id&&report.officeContext.companyId===office.id&&report.officeContext.reportingOnly&&!report.officeContext.assignmentVerified);
 ok((await leave.submit(contextual,worker.id)).id===report.id);
 await assert.rejects(()=>leave.submit({...contextual,officeContextCompanyId:parent.id},worker.id),(e:any)=>e.getStatus()===409);checks++;
 for(const context of ['nonexistent-context','']){await assert.rejects(()=>leave.submit({...input,officeContextCompanyId:context,idempotencyKey:randomUUID()},worker.id),(e:any)=>e.getStatus()===400);checks++;}
 const inactive=await db.company.create({data:{name:'Inactive technical reporting record',isActive:false}});await assert.rejects(()=>leave.submit({...input,officeContextCompanyId:inactive.id,idempotencyKey:randomUUID()},worker.id),(e:any)=>e.getStatus()===400);checks++;
 const filtered=await leave.reviewQueue({page:1,pageSize:100,officeId:office.id,departmentId:c.department.id},reviewer.id);ok(filtered.items.some((r:any)=>r.id===report.id)&&!filtered.items.some((r:any)=>r.id===initial.id));
 await assert.rejects(()=>leave.get(initial.id,c.denied.id),(e:any)=>e.getStatus()===403||e.getStatus()===404||e.getStatus()===503);checks++;
 // Direct SQL runs under the real restricted runtime. Each failed transaction
 // rolls back, including the before/after events; no app authority is bypassed.
 const countBefore={requests:await db.leaveRequest.count(),events:await db.leaveRequestEvent.count(),audit:await db.auditEvent.count()};
 const probe=async(change:any,expected:string)=>{
  await assert.rejects(()=>apiDb.$transaction(async(tx:any)=>{
   await tx.$queryRaw`SELECT set_config('real_capita.leave_actor',${worker.id},true)`;
   const data={...stored,id:randomUUID(),idempotencyKey:randomUUID(),startDate:new Date('2028-03-01'),endDate:new Date('2028-03-01'),...change};
   await tx.leaveRequest.create({data});
  }),(e:any)=>(JSON.stringify(e)+String(e.message)).includes(expected));checks++;
 };
 await probe({companyId:office.id},'Active PRIMARY leave ownership required');
 await probe({identitySnapshot:{...stored.identitySnapshot,owningCompany:{...stored.identitySnapshot.owningCompany,id:office.id}}},'Verified historical PRIMARY snapshot required');
 await probe({identitySnapshot:{...stored.identitySnapshot,officeContext:{companyId:office.id,name:office.name,reportingOnly:false,assignmentVerified:true}}},'Reporting context is non-authoritative');
 await probe({identitySnapshot:{...stored.identitySnapshot,officeContext:{companyId:'missing',name:'Unknown',reportingOnly:true,assignmentVerified:false}}},'Active configured reporting Company required');
 assert.deepEqual({requests:await db.leaveRequest.count(),events:await db.leaveRequestEvent.count(),audit:await db.auditEvent.count()},countBefore);checks++;
 // Current display changes must not rewrite stored owner/reporting history.
 const originalCompany=await db.company.findUniqueOrThrow({where:{id:parent.id}}),originalOffice=await db.company.findUniqueOrThrow({where:{id:office.id}});
 await db.company.update({where:{id:parent.id},data:{name:'Renamed technical parent'}});await db.company.update({where:{id:office.id},data:{name:'Renamed technical reporting record',isActive:false}});
 try{const historical=await leave.get(report.id,worker.id);ok(historical.owningCompany.name===parent.name&&historical.officeContext.name===office.name);ok((await leave.decide(report.id,{decision:'APPROVED',expectedVersion:1,reason:'Central HR review independent of reporting context'},reviewer.id)).status==='APPROVED');}finally{await db.company.update({where:{id:parent.id},data:{name:originalCompany.name}});await db.company.update({where:{id:office.id},data:{name:originalOffice.name,isActive:originalOffice.isActive}});}
 await leave.withdraw(initial.id,1,worker.id);ok((await db.leaveRequestEvent.count({where:{requestId:initial.id}}))===2);
 const beforeParent=await db.company.findUniqueOrThrow({where:{id:parent.id}});
 await db.company.update({where:{id:parent.id},data:{isActive:false}});try{await assert.rejects(()=>leave.list({page:1,pageSize:20},worker.id),(e:any)=>e.getStatus()===503);checks++;}finally{await db.company.update({where:{id:parent.id},data:{isActive:beforeParent.isActive}});}
 await db.company.update({where:{id:parent.id},data:{singletonKey:null}});try{await assert.rejects(()=>leave.submit({...input,idempotencyKey:randomUUID()},worker.id),(e:any)=>e.getStatus()===503);checks++;}finally{await db.company.update({where:{id:parent.id},data:{singletonKey:'PRIMARY'}});}
 const history=await db.leaveRequestEvent.findMany({where:{requestId:report.id},orderBy:{version:'asc'}});assert.deepEqual(history[1].snapshot.before,history[0].snapshot.after);checks++;
 ok(await db.leaveRequest.count({where:{companyId:{not:parent.id}}})===0);
 console.log(`PASS ${checks} real PostgreSQL central leave ownership assertions: PRIMARY-only, optional reporting isolation/filtering, direct SQL rejection, history, missing/inactive parent, immutable decisions and rollback`);
}
