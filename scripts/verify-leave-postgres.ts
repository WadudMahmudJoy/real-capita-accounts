import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function verifyLeavePostgres(c:any){
 const {db,apiDb,app,load,actor,checker,denied,office,roster,category}=c,{LeaveService}=load('leave/leave.service.js'),service=app.get(LeaveService);
 const attendanceBefore=await db.attendanceRecord.count();
 const columns=await db.$queryRawUnsafe("SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('leave_requests','leave_request_events') AND column_name IN ('createdAt','withdrawnAt','reviewedAt')");assert.equal(columns.length,4);assert(columns.every((r:any)=>r.data_type==='timestamp with time zone'));
 const fk=await db.$queryRawUnsafe("SELECT confdeltype::text AS confdeltype FROM pg_constraint WHERE contype='f' AND conrelid IN ('leave_requests'::regclass,'leave_request_events'::regclass)");assert.equal(fk.length,8);assert(fk.every((r:any)=>r.confdeltype==='r'));
 const input={employeeId:roster[0].id,categoryId:category.id,startDate:'2026-11-01',endDate:'2026-11-02',reason:'Isolated concurrent request',idempotencyKey:randomUUID()};
 const results=await Promise.allSettled([service.submit(input,actor.id,office.id),service.submit({...input,idempotencyKey:randomUUID()},actor.id,office.id)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.getStatus(),409);
 const winner=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;assert.equal((await service.submit({...input,idempotencyKey:(await db.leaveRequest.findUniqueOrThrow({where:{id:winner.id}})).idempotencyKey},actor.id,office.id)).id,winner.id);
 const before={requests:await db.leaveRequest.count(),events:await db.leaveRequestEvent.count(),audit:await db.auditEvent.count()};
 await db.$executeRawUnsafe("CREATE FUNCTION rc_leave_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'LEAVE_REQUEST_%' THEN RAISE EXCEPTION 'Isolated audit failure'; END IF; RETURN NEW; END $$");await db.$executeRawUnsafe('CREATE TRIGGER rc_leave_audit_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION rc_leave_audit_fail()');
 try{await assert.rejects(()=>service.submit({...input,startDate:'2026-12-01',endDate:'2026-12-02',idempotencyKey:randomUUID()},actor.id,office.id));}finally{await db.$executeRawUnsafe('DROP TRIGGER rc_leave_audit_fail ON audit_events');await db.$executeRawUnsafe('DROP FUNCTION rc_leave_audit_fail()');}
 assert.deepEqual({requests:await db.leaveRequest.count(),events:await db.leaveRequestEvent.count(),audit:await db.auditEvent.count()},before);
 await assert.rejects(()=>apiDb.$executeRawUnsafe('UPDATE leave_categories SET "isActive"=true'));
 await assert.rejects(()=>db.$executeRawUnsafe('DELETE FROM leave_request_events'));await assert.rejects(()=>db.$executeRawUnsafe('UPDATE leave_request_events SET version=version+1'));await assert.rejects(()=>db.$executeRawUnsafe('DELETE FROM leave_requests'));
 await assert.rejects(()=>db.$executeRawUnsafe("UPDATE leave_requests SET status='WITHDRAWN',version=2 WHERE status='SUBMITTED'"));
 await assert.rejects(()=>db.$transaction(async(tx:any)=>{await tx.leaveRequest.create({data:{employeeId:'nonexistent',companyId:office.id,categoryId:category.id,createdById:actor.id,startDate:new Date('2026-12-01'),endDate:new Date('2026-12-02'),reason:'FK probe',idempotencyKey:randomUUID(),identitySnapshot:{}}});}));
 await assert.rejects(()=>db.$executeRawUnsafe("UPDATE leave_requests SET reason='rewritten'"));
 assert.deepEqual({requests:await db.leaveRequest.count(),events:await db.leaveRequestEvent.count(),audit:await db.auditEvent.count()},before);
 const {LeaveAuthority}=load('leave/leave-authority.js'),normal=new LeaveService(apiDb,new LeaveAuthority());assert.equal((await normal.capabilities(denied.id)).status,'BLOCKED');await assert.rejects(()=>normal.submit({...input,startDate:'2026-12-01',endDate:'2026-12-02',idempotencyKey:randomUUID()},denied.id,office.id),(e:any)=>e.getStatus()===503);
 await assert.rejects(()=>db.$transaction(async(tx:any)=>tx.leaveRequest.create({data:{employeeId:roster[0].id,companyId:office.id,categoryId:category.id,createdById:actor.id,startDate:new Date('2026-12-01'),endDate:new Date('2026-12-02'),reason:'Missing event probe',idempotencyKey:randomUUID(),identitySnapshot:{}}})));
 assert.deepEqual({requests:await db.leaveRequest.count(),events:await db.leaveRequestEvent.count(),audit:await db.auditEvent.count()},before);
 const history=await db.leaveRequestEvent.findMany({where:{action:'WITHDRAWN'}});assert.equal(history.length,1);assert.equal(history[0].snapshot.before.status,'SUBMITTED');assert.equal(history[0].snapshot.after.status,'WITHDRAWN');assert.equal(history[0].snapshot.before.reason,history[0].snapshot.after.reason);

 const decisionInput={expectedVersion:1,decision:'APPROVED',reason:'Isolated explicitly delegated HR review'};
 await assert.rejects(()=>service.decide(winner.id,decisionInput,actor.id),(e:any)=>e.getStatus()===403);
 const base=async(day:string,employeeId=roster[0].id,creator=actor.id)=>service.submit({...input,employeeId,startDate:`2027-01-${day}`,endDate:`2027-01-${day}`,idempotencyKey:randomUUID()},creator,office.id);
 const approve=await base('01');const decided=await service.decide(approve.id,decisionInput,checker.id);assert.equal(decided.status,'APPROVED');assert.equal(decided.version,2);
 const stored=await db.leaveRequest.findUniqueOrThrow({where:{id:approve.id}});assert.equal(stored.reviewedById,checker.id);assert(stored.reviewedAt);assert.equal(typeof stored.reviewAuthoritySnapshot.revision,'string');
 await assert.rejects(()=>service.decide(approve.id,{...decisionInput,expectedVersion:2},checker.id),(e:any)=>e.getStatus()===409);await assert.rejects(()=>service.withdraw(approve.id,2,actor.id),(e:any)=>e.getStatus()===409);
 await assert.rejects(()=>base('01'),(e:any)=>e.getStatus()===409);
 const reject=await base('02');assert.equal((await service.decide(reject.id,{...decisionInput,decision:'REJECTED'},checker.id)).status,'REJECTED');await base('02');
 const self=await base('03',roster[1].id,checker.id);await assert.rejects(()=>service.get(self.id,actor.id),(e:any)=>e.getStatus()===404);await assert.rejects(()=>service.decide(self.id,decisionInput,checker.id),(e:any)=>e.getStatus()===403&&e.getResponse().code==='LEAVE_SELF_APPROVAL_FORBIDDEN');
 await db.user.update({where:{id:checker.id},data:{isActive:false}});try{await assert.rejects(()=>service.decide(winner.id,decisionInput,checker.id),(e:any)=>e.getStatus()===403);}finally{await db.user.update({where:{id:checker.id},data:{isActive:true}});}
 const stale=await base('04');await assert.rejects(()=>service.decide(stale.id,{...decisionInput,expectedVersion:4},checker.id),(e:any)=>e.getStatus()===409);
 const racing=await base('05');const decisions=await Promise.allSettled([service.decide(racing.id,decisionInput,checker.id),service.decide(racing.id,{...decisionInput,decision:'REJECTED'},checker.id)]);assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);assert.equal(await db.leaveRequestEvent.count({where:{requestId:racing.id}}),2);
 const failure=await base('06');const auditBefore=await db.auditEvent.count(),eventBefore=await db.leaveRequestEvent.count();
 await db.$executeRawUnsafe("CREATE FUNCTION rc_leave_decision_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('LEAVE_REQUEST_APPROVED','LEAVE_REQUEST_REJECTED') THEN RAISE EXCEPTION 'Isolated decision audit failure'; END IF; RETURN NEW; END $$");await db.$executeRawUnsafe('CREATE TRIGGER rc_leave_decision_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION rc_leave_decision_fail()');
 try{await assert.rejects(()=>service.decide(failure.id,decisionInput,checker.id));}finally{await db.$executeRawUnsafe('DROP TRIGGER rc_leave_decision_fail ON audit_events');await db.$executeRawUnsafe('DROP FUNCTION rc_leave_decision_fail()');}
 assert.equal((await db.leaveRequest.findUniqueOrThrow({where:{id:failure.id}})).status,'SUBMITTED');assert.equal(await db.auditEvent.count(),auditBefore);assert.equal(await db.leaveRequestEvent.count(),eventBefore);
 await assert.rejects(()=>db.$executeRawUnsafe(`UPDATE leave_requests SET status='APPROVED',version=2 WHERE id='${failure.id}'`));
 await assert.rejects(()=>normal.decide(failure.id,decisionInput,actor.id),(e:any)=>e.getStatus()===403);
 await assert.rejects(()=>service.decide(failure.id,{...decisionInput,reason:'  '},checker.id),(e:any)=>e.getStatus()===400);
 await assert.rejects(()=>service.reviewQueue({page:1,pageSize:20},actor.id),(e:any)=>e.getStatus()===403);
 assert((await service.reviewQueue({page:1,pageSize:20},checker.id)).total>=1);
 const originalHistory=await db.leaveRequestEvent.findMany({where:{requestId:approve.id},orderBy:{version:'asc'}});assert.deepEqual(originalHistory[1].snapshot.before,originalHistory[0].snapshot.after);assert.equal(originalHistory[1].actorId,checker.id);
 console.log('PASS PostgreSQL HR/Admin decision authority, approval/rejection, self-policy block, active overlap, final immutability, stale/duplicate/concurrent decisions and complete audit rollback; synthetic authorization only');
 assert.equal(await db.attendanceRecord.count(),attendanceBefore);
 assert.equal(await db.payrollRun.count(),0);assert.equal(await db.voucher.count(),0);assert.equal(await db.payrollPaymentConfirmation.count(),0);
 console.log('PASS PostgreSQL leave concurrency, idempotency, global overlap, audit rollback, restrictive FK, category privilege, immutable requests/events and preserved before/after history; no attendance/payroll mutations');
}
