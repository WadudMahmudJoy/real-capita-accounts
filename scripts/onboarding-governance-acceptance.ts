import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {hash} from 'bcryptjs';
import type {PrismaClient} from '../apps/api/src/generated/prisma/client';
import {effectiveAccountant,specializedPermissionAllowed} from '../apps/api/src/auth/onboarding-access';
import {permission} from '../apps/api/src/auth/hr-access';

// Fixture construction uses the acceptance owner's transaction only. These are
// deliberately historical database fixtures, not claims of signed onboarding.
// Everything rolls back before the genuine synthetic ceremony suite proceeds.
export async function verifyOnboardingGovernance(owner:PrismaClient,companyId:string,accountantRoleId:string,registrarId:string):Promise<number>{
 const [identity]=await owner.$queryRaw<{database:string;version:number}[]>`SELECT current_database() database,current_setting('server_version_num')::int version`;
 assert(identity&&/^real_capita_payroll_accept_[a-f0-9]{32}$/.test(identity.database),'Governance fixtures require a disposable acceptance database.');
 assert(identity.version>=170000&&identity.version<180000,'Governance fixtures require PostgreSQL 17.');
 const counts=async()=>({users:await owner.user.count(),roles:await owner.userRole.count(),permissions:await owner.userPermission.count(),authorizations:await owner.onboardingAuthorization.count()});
 const baseline=await counts(),rollback=new Error('SYNTHETIC_GOVERNANCE_FIXTURE_ROLLBACK');let checks=0;
 const passwordHash=await hash(randomBytes(32).toString('base64url'),4),suffix=randomBytes(8).toString('hex');
 try{
  await owner.$transaction(async tx=>{
   const cases=[
    {name:'NO_HISTORY',states:[],allowed:true},
    {name:'PENDING',states:['PENDING'],allowed:true},
    {name:'REJECTED',states:['REJECTED'],allowed:true},
    {name:'PENDING_REJECTED',states:['PENDING','REJECTED'],allowed:true},
    {name:'EXPIRED_APPROVED',states:['APPROVED'],allowed:false},
    {name:'REVOKED',states:['REVOKED'],allowed:false},
    {name:'EXPIRED_APPROVED_PENDING',states:['APPROVED','PENDING'],allowed:false},
    {name:'REVOKED_REJECTED',states:['REVOKED','REJECTED'],allowed:false},
   ];
   for(const fixture of cases){
    const user=await tx.user.create({data:{email:`governance-${fixture.name.toLowerCase()}-${suffix}@example.invalid`,fullName:`Synthetic Governance ${fixture.name}`,passwordHash,isActive:true,roles:{create:{roleId:accountantRoleId}}}});
    // These pre-existing specialized grants intentionally have no expiry. A
    // pending/rejected proposal must not alter their original effectiveness.
    for(const code of ['SYSTEM_ADMIN','HR_ADMIN'] as const)await tx.userPermission.create({data:{userId:user.id,code,grantedById:registrarId,reason:'Synthetic legacy governance regression fixture'}});
    for(const scope of ['ACCOUNTANT','SYSTEM_ADMIN','HR_ADMIN']){
     for(const state of fixture.states){
      const now=Date.now();await tx.onboardingAuthorization.create({data:{companyId,actorId:registrarId,targetUserId:user.id,reviewerId:state==='PENDING'?null:registrarId,kind:'SPECIALIZED',scope,state,reason:'Synthetic request-history regression fixture',createdAt:new Date(now-172800000),expiresAt:new Date(now+(state==='APPROVED'?-3600000:86400000)),revokedAt:state==='REVOKED'?new Date(now-3600000):null}});
     }
    }
    assert.equal(await tx.userRole.count({where:{userId:user.id,roleId:accountantRoleId}}),1,`${fixture.name}: concrete ACCOUNTANT role remains stored`);checks++;
    assert.equal(await effectiveAccountant(tx,user.id,true),fixture.allowed,`${fixture.name}: real SQL ACCOUNTANT effectiveness`);checks++;
    for(const code of ['SYSTEM_ADMIN','HR_ADMIN'] as const){
     assert.equal(await tx.userPermission.count({where:{userId:user.id,code,revokedAt:null}}),1,`${fixture.name}: ${code} remains stored`);checks++;
     assert.equal(await specializedPermissionAllowed(tx,user.id,code),fixture.allowed,`${fixture.name}: real SQL ${code} governance`);checks++;
     assert.equal(Boolean(await permission(tx,user.id,code)),fixture.allowed,`${fixture.name}: public ${code} permission gate`);checks++;
    }
   }
   throw rollback;
  },{isolationLevel:'Serializable',timeout:60000});
 }catch(error){if(error!==rollback)throw error;}
 assert.deepEqual(await counts(),baseline,'Governance transaction restored all synthetic fixture counts.');checks++;
 console.log(`PASS ${checks} actual PostgreSQL legacy/pending/rejected/expired/revoked governance assertions; synthetic fixtures rolled back`);
 return checks;
}
