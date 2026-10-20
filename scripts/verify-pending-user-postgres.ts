import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Invoked only by the existing disposable HR acceptance harness.
export async function verifyPendingUserPostgres(c:any){
 const {db,apiDb,app,load,actor,denied}=c;
 const users=app.get(load('users/users.service.js').UsersService);
 const auth=app.get(load('auth/auth.service.js').AuthService);
 let checks=0;const ok=(value:boolean)=>{assert(value);checks++;};
 const input={email:'pending-service@example.invalid',fullName:'Pending Technical Identity',reason:'Synthetic pending onboarding; no business designation'};
 const initial=await db.user.count();
 await assert.rejects(()=>users.createPending(input,denied.id),(e:any)=>e.getStatus()===403);checks++;ok(await db.user.count()===initial);
 const pending=await users.createPending(input,actor.id);ok(!pending.isActive);ok(pending.roles.length===0&&pending.hrPermissions.length===0&&pending.employeeBindings.length===0);ok(!JSON.stringify(pending).includes('password'));
 ok((await users.get(pending.id,actor.id)).onboardingPending===true);
 const event=await db.userAdminEvent.findFirstOrThrow({where:{targetUserId:pending.id,action:'PENDING_CREATED'}});
 ok(event.actorId===actor.id&&event.snapshot.after.isActive===false);ok(!JSON.stringify(event.snapshot).includes('passwordHash'));
 ok(await db.auditEvent.count({where:{entityId:pending.id,action:'USER_ADMIN_PENDING_CREATED',userId:actor.id}})===1);
 for(const action of ['ACTIVATE','SET_ACCOUNTANT','GRANT_PERMISSION','BIND']){await assert.rejects(()=>users.action(pending.id,{action,expectedVersion:1,reason:'Unverified identity must not gain access',permission:'HR_ADMIN',employeeId:c.roster[0].id,verificationReference:'Text alone is not verification'},actor.id),(e:any)=>e.getStatus()===403);checks++;}
 await assert.rejects(()=>users.create({...input,password:randomUUID()},actor.id),(e:any)=>e.getStatus()===409);checks++;
 await assert.rejects(()=>auth.login(input.email,'not-an-issued-password',{ip:'127.0.0.1',get:()=> 'isolated acceptance'}),(e:any)=>e.getStatus()===401);checks++;ok(await db.authSession.count({where:{userId:pending.id}})===0);
 const edited=await users.action(pending.id,{action:'EDIT',expectedVersion:1,reason:'Safe pending profile correction',email:'pending-renamed@example.invalid',fullName:'Pending Renamed'},actor.id);ok(edited.adminVersion===2&&!edited.isActive);ok((await users.get(pending.id,actor.id)).onboardingPending);
 await assert.rejects(()=>users.action(pending.id,{action:'ACTIVATE',expectedVersion:1,reason:'Stale pending activation'},actor.id),(e:any)=>e.getStatus()===409);checks++;
 const raced=await Promise.allSettled([users.createPending({...input,email:'pending-race@example.invalid'},actor.id),users.createPending({...input,email:'pending-race@example.invalid'},actor.id)]);
 ok(raced.filter(r=>r.status==='fulfilled').length===1);ok((raced.find(r=>r.status==='rejected') as PromiseRejectedResult).reason.getStatus()===409);
 const before={users:await db.user.count(),events:await db.userAdminEvent.count(),audits:await db.auditEvent.count()};
 await db.$executeRawUnsafe("CREATE FUNCTION pending_onboarding_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='USER_ADMIN_PENDING_CREATED' THEN RAISE EXCEPTION 'Synthetic pending audit failure'; END IF;RETURN NEW;END $$");
 await db.$executeRawUnsafe('CREATE TRIGGER pending_onboarding_audit_fail BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION pending_onboarding_audit_fail()');
 try{await assert.rejects(()=>users.createPending({...input,email:'pending-rollback@example.invalid'},actor.id));checks++;}finally{await db.$executeRawUnsafe('DROP TRIGGER pending_onboarding_audit_fail ON audit_events');await db.$executeRawUnsafe('DROP FUNCTION pending_onboarding_audit_fail()');}
 assert.deepEqual({users:await db.user.count(),events:await db.userAdminEvent.count(),audits:await db.auditEvent.count()},before);checks++;
 await assert.rejects(()=>apiDb.user.create({data:{email:'pending-bypass@example.invalid',fullName:'Unauthorized',passwordHash:'unused synthetic fixture',isActive:false}}));checks++;
 ok((await db.user.findUniqueOrThrow({where:{id:pending.id}})).isActive===false);ok(await db.userPermission.count({where:{userId:pending.id}})===0&&await db.employeeAccountBinding.count({where:{userId:pending.id}})===0);
 // Unsupported legacy labels are technical negative fixtures, not permission grants.
 const legacyCodes=['company_admin','company_accountant','company_hr','company_payroll','company_sales','company_member'];
 const legacyPassword=randomUUID(),legacy=await users.create({email:'legacy-labels@example.invalid',fullName:'Synthetic Legacy Labels',password:legacyPassword,reason:'Isolated negative role-compatibility fixture'},actor.id);
 for(const code of legacyCodes){const role=await db.role.create({data:{code,name:code}});await db.userRole.create({data:{userId:legacy.id,roleId:role.id}});}
 const displayed=await users.get(legacy.id,actor.id);assert.deepEqual(displayed.roles.map((r:any)=>r.role.code).sort(),[...legacyCodes].sort());checks++;
 assert.deepEqual(await users.access(legacy.id),{systemAdmin:false,hrAdmin:false,employee:false});checks++;
 await assert.rejects(()=>auth.login(legacy.email,legacyPassword,{ip:'127.0.0.1',get:()=> 'isolated role compatibility'}),(e:any)=>e.getStatus()===401);checks++;
 await users.action(legacy.id,{action:'SET_ACCOUNTANT',expectedVersion:1,reason:'Separate explicit accounting authorization in synthetic fixture'},actor.id);
 const login=await auth.login(legacy.email,legacyPassword,{ip:'127.0.0.1',get:()=> 'isolated explicit accounting access'});
 assert.deepEqual(login.user.roles.map((r:any)=>r.code),['ACCOUNTANT']);checks++;
 assert.deepEqual(await users.access(legacy.id),{systemAdmin:false,hrAdmin:false,employee:false});checks++;
 console.log(`PASS ${checks} real PostgreSQL pending-user/role-compatibility assertions: restricted runtime, no implicit legacy-label authority, explicit accounting access, login denial, duplicate/concurrent requests, immutable pending history, stale versions and audit rollback; isolated synthetic identities only`);
}
