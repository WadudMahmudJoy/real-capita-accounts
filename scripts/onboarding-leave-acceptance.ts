// Existing HR -> MD policy through authenticated HTTP and the signed dispatcher.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyOnboardedLeave(c:any){
 const {owner,app,load,base,exec,authorityRequest,md,agm,hr,worker}=c;
 let checks=0;const ok=(v:unknown)=>{assert(v);checks++;};
 const denied=async(fn:()=>Promise<unknown>)=>{await assert.rejects(fn);checks++;};
 const approve=async(id:string)=>exec(md.session,'AUTHORITY_APPROVE',{requestId:id,expectedVersion:1,reason:'Independent MD synthetic leave delegation'});
 const perms=['leave.view','leave.create','leave.review','leave.recommend','leave.history.view','leave.categories.manage'];
 const delegation=await authorityRequest(hr.session,'DELEGATE',{targetUserId:hr.id,permissions:perms,expiresAt:new Date(Date.now()+3600000).toISOString()});await approve(delegation.id);
 const leave=app.get(load('leave/leave.service.js').LeaveService);
 const category=await leave.category(null,{code:'SYNTHETIC',name:'Synthetic approved category',isActive:true,expectedVersion:0},hr.id);
 const submit=async(day:number,person=worker)=>{
  const response=await fetch(base+'/leave-requests',{method:'POST',headers:{'Content-Type':'application/json',Cookie:person.session.cookie},body:JSON.stringify({employeeId:person.employee.id,categoryId:category.id,startDate:`2027-08-${String(day).padStart(2,'0')}`,endDate:`2027-08-${String(day).padStart(2,'0')}`,reason:'Isolated private employee request',idempotencyKey:randomUUID()})});assert.equal(response.status,201);checks++;return response.json();
 };
 const action=(requestId:string,decision:string,expectedVersion:number)=>({requestId,decision,expectedVersion,reason:'Independent synthetic review',idempotencyKey:randomUUID()});
 const before={payroll:await owner.payrollRun.count(),attendance:await owner.attendanceRecord.count(),vouchers:await owner.voucher.count()};
 for(const [day,recommendation,decision] of [[1,'RECOMMEND_APPROVAL','APPROVED'],[2,'RECOMMEND_APPROVAL','REJECTED'],[3,'RECOMMEND_REJECTION','APPROVED'],[4,'RECOMMEND_REJECTION','REJECTED']] as const){
  const request=await submit(day);ok(request.status==='PENDING_HR_REVIEW'&&request.version===1);
  await denied(()=>exec(worker.session,'LEAVE_HR',action(request.id,recommendation,1)));
  await exec(hr.session,'LEAVE_HR',action(request.id,recommendation,1));ok((await owner.leaveWorkflow.findUniqueOrThrow({where:{requestId:request.id}})).stage==='PENDING_MD_DECISION');
  await denied(()=>exec(hr.session,'LEAVE_MD',action(request.id,decision,2)));
  await exec(md.session,'LEAVE_MD',action(request.id,decision,2));ok((await owner.leaveRequest.findUniqueOrThrow({where:{id:request.id}})).status===decision);
  const status=await fetch(base+'/leave-requests/'+request.id,{headers:{Cookie:worker.session.cookie}});ok(status.status===200&&(await status.json()).status===decision);
  const privateRead=await fetch(base+'/leave-requests/'+request.id,{headers:{Cookie:agm.session.cookie}});ok(privateRead.status===403||privateRead.status===404);
 }
 const own=await submit(5,hr);await denied(()=>exec(hr.session,'LEAVE_HR',action(own.id,'RECOMMEND_APPROVAL',1)));
 const mdOwn=await fetch(base+'/leave-requests',{method:'POST',headers:{'Content-Type':'application/json',Cookie:md.session.cookie},body:JSON.stringify({employeeId:md.employee.id,categoryId:category.id,startDate:'2027-08-06',endDate:'2027-08-06',reason:'MD own unresolved policy',idempotencyKey:randomUUID()})});ok(mdOwn.status===403);
 const pending=await submit(7);await exec(hr.session,'LEAVE_HR',action(pending.id,'RECOMMEND_APPROVAL',1));
 const oldMandate=await owner.authorityMandate.findFirstOrThrow({where:{userId:hr.id,kind:'DELEGATE',revokedAt:null}});
 const revoke=await authorityRequest(agm.session,'DELEGATE_REVOKE',{mandateId:oldMandate.id},oldMandate.version);await approve(revoke.id);
 await denied(()=>exec(hr.session,'LEAVE_HR',action(own.id,'RECOMMEND_APPROVAL',1)));
 await denied(()=>exec(md.session,'LEAVE_MD',action(pending.id,'APPROVED',2)));
 ok((await owner.leaveRequest.findUniqueOrThrow({where:{id:pending.id}})).version===2);
 // Equivalent newly delegated permissions cannot silently validate the old HR proof.
 const again=await authorityRequest(hr.session,'DELEGATE',{targetUserId:hr.id,permissions:perms,expiresAt:new Date(Date.now()+3600000).toISOString()});await approve(again.id);
 await denied(()=>exec(md.session,'LEAVE_MD',action(pending.id,'APPROVED',2)));
 const race=await submit(8);const races=await Promise.allSettled([exec(hr.session,'LEAVE_HR',action(race.id,'RECOMMEND_APPROVAL',1)),exec(hr.session,'LEAVE_HR',action(race.id,'RECOMMEND_REJECTION',1))]);ok(races.filter(r=>r.status==='fulfilled').length===1);
 const decisions=await owner.leaveStageDecision.count({where:{requestId:race.id,stage:'HR'}});ok(decisions===1);
 assert.deepEqual({payroll:await owner.payrollRun.count(),attendance:await owner.attendanceRecord.count(),vouchers:await owner.voucher.count()},before);checks++;
 console.log(`PASS ${checks} onboarded HR-to-MD PostgreSQL/authenticated HTTP assertions: four outcomes, self/privacy/revocation/stale/concurrency and no financial/attendance effects`);
 return checks;
}
