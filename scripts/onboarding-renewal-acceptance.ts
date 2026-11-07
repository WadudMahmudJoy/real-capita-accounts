import assert from 'node:assert/strict';
import {effectiveAccountant,specializedPermissionAllowed} from '../apps/api/src/auth/onboarding-access';

// Called after synthetic MD bootstrap, before other lifecycle grants. Only the
// disposable harness owner constructs history; approvals use its signed executor.
export async function verifyOnboardingRenewal(c:any):Promise<number>{
 const {owner,exec,md,worker,role,company,login}=c;
 const [identity]=await owner.$queryRaw`SELECT current_database() database,current_setting('server_version_num')::int version`;
 assert(/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(identity.database));
 assert(identity.version>=170000&&identity.version<180000);
 let checks=2;const ok=(value:unknown,label:string)=>{assert(value,label);checks++;};
 const active=async(scope:string)=>scope==='ACCOUNTANT'?effectiveAccountant(owner,worker.id,true):specializedPermissionAllowed(owner,worker.id,scope as any);
 const refresh=async()=>{worker.session=await login(worker.id,worker.email,worker.password);};
 const request=async(scope:string)=>{
  await refresh();const version=(await owner.user.findUniqueOrThrow({where:{id:worker.id}})).adminVersion;
  return exec(worker.session,'REQUEST_SPECIALIZED',{targetUserId:worker.id,permission:scope,reason:'Synthetic independently reviewed renewal',expectedVersion:version,expiresAt:new Date(Date.now()+3600000).toISOString()});
 };
 const approve=async(id:string)=>exec(md.session,'DECIDE_SPECIALIZED',{requestId:id,decision:'APPROVE',reason:'Independent synthetic MD renewed bounded responsibility'});
 const revoke=async(id:string)=>exec(md.session,'REVOKE_SPECIALIZED',{requestId:id,reason:'Synthetic renewal cleanup through guarded revocation'});
 for(const fixture of [{scope:'ACCOUNTANT',legacy:true},{scope:'ACCOUNTANT',legacy:false},{scope:'HR_ADMIN',legacy:false},{scope:'SYSTEM_ADMIN',legacy:false}]){
  const {scope,legacy}=fixture,now=Date.now(),past=new Date(now-86400000),expired=new Date(now-60000);
  let prior:any;let stored:any;
  if(scope==='ACCOUNTANT')stored=await owner.userRole.create({data:{userId:worker.id,roleId:role.id}});
  else stored=await owner.userPermission.create({data:{userId:worker.id,code:scope,grantedById:md.id,reason:'Synthetic expired permission retained as immutable history',grantedAt:past,expiresAt:expired}});
  if(!legacy)prior=await owner.onboardingAuthorization.create({data:{companyId:company.id,actorId:worker.id,targetUserId:worker.id,reviewerId:md.id,kind:'SPECIALIZED',scope,state:'APPROVED',reason:'Synthetic expired historical approval',createdAt:past,expiresAt:expired}});
  ok(await active(scope)===legacy,scope+': historical effectiveness');
  const fresh=await request(scope),before=(await owner.user.findUniqueOrThrow({where:{id:worker.id}})).adminVersion;
  await approve(String(fresh.requestId));
  const approved=await owner.onboardingAuthorization.findUniqueOrThrow({where:{id:String(fresh.requestId)}});
  ok(approved.state==='APPROVED'&&approved.reviewerId===md.id&&approved.version===2,scope+': independent versioned approval');
  ok(await active(scope),scope+': renewal effective');
  ok((await owner.user.findUniqueOrThrow({where:{id:worker.id}})).adminVersion===before+1,scope+': account version advances once');
  ok(await owner.authSession.count({where:{userId:worker.id,revokedAt:null}})===0,scope+': approval revokes sessions');
  const adminAudit=await owner.userAdminEvent.findFirstOrThrow({where:{targetUserId:worker.id,action:'DECIDE_SPECIALIZED'},orderBy:{createdAt:'desc'}});
  ok(adminAudit.snapshot.after.adminVersion===before+1,scope+': matching administration revision audited');
  ok(await owner.onboardingEvent.count({where:{recordId:approved.id,action:'DECIDE_SPECIALIZED'}})===1,scope+': onboarding audit exists');
  if(scope==='ACCOUNTANT')ok((await owner.userRole.findUniqueOrThrow({where:{id:stored.id}})).roleId===role.id,'Existing ACCOUNTANT membership retained');
  else{
   const retained=await owner.userPermission.findUniqueOrThrow({where:{id:stored.id}});
   ok(!!retained.revokedAt&&retained.revokedById===md.id&&retained.expiresAt.getTime()===expired.getTime(),scope+': expired grant preserved with one-way revocation');
   ok(await owner.userPermission.count({where:{userId:worker.id,code:scope,revokedAt:null}})===1,scope+': exactly one replacement grant');
   const current=await owner.userPermission.findFirstOrThrow({where:{userId:worker.id,code:scope,revokedAt:null}});
   ok(current.grantedById===md.id&&current.expiresAt.getTime()===approved.expiresAt.getTime(),scope+': replacement grant uses approved reviewer and expiry');
  }
  if(prior){
   const history=await owner.onboardingAuthorization.findUniqueOrThrow({where:{id:prior.id}});
   ok(history.state==='REVOKED'&&history.version===2&&history.expiresAt.getTime()===expired.getTime(),scope+': prior instruction finalized without rewriting expiry');
   ok(await owner.onboardingEvent.count({where:{recordId:prior.id,action:'SPECIALIZED_SUPERSEDED'}})===1,scope+': supersession audited');
   await assert.rejects(()=>revoke(prior.id),(error:any)=>error.status===409);checks++;
   ok(await active(scope),scope+': old-request revocation cannot revoke renewal');
  }
  await revoke(approved.id);ok(!await active(scope),scope+': current-request revocation denies access');
 }
 await refresh();
 console.log(`PASS ${checks} actual PostgreSQL legacy ACCOUNTANT adoption and expired specialized renewal assertions`);
 return checks;
}
