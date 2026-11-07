import 'reflect-metadata';
import assert from 'node:assert/strict';
import { validateCommand, validateClaim, assertSameOrigin, OnboardingRateLimit } from '../apps/api/src/onboarding/onboarding.dto';
import { OnboardingGateway } from '../apps/api/src/onboarding/onboarding.gateway';
import { OnboardingService } from '../apps/api/src/onboarding/onboarding.service';
import type { PrismaService } from '../apps/api/src/prisma/prisma.service';
import type { AuthenticatedRequest } from '../apps/api/src/auth/auth.types';

async function main(){
 let passed=0;
 const check=(fn:()=>void)=>{fn();passed++;};
 check(()=>assert.throws(()=>validateCommand({command:'SQL',payload:{sql:'select 1'},proof:'x'})));
 check(()=>assert.throws(()=>validateCommand({command:'INVITE',payload:{email:'a@b.test',name:'Synthetic',reason:'test',admin:true},proof:'x'})));
 check(()=>assert.throws(()=>validateCommand({command:'REQUEST_SPECIALIZED',payload:{targetUserId:'u',permission:'MD',reason:'x',expectedVersion:1,expiresAt:new Date().toISOString()},proof:'x'})));
 check(()=>assert.equal(validateCommand({command:'INVITE',payload:{email:'person@example.test',name:'Synthetic',reason:'test'},proof:{claims:{},signature:'signed'}}).command,'INVITE'));
 check(()=>assert.throws(()=>validateCommand({command:'CLAIM',payload:{tokenHash:'x',passwordHash:'x'},proof:'x'})));
 check(()=>assert.throws(()=>validateClaim({capability:'short',password:'short'})));
 check(()=>assert.throws(()=>validateClaim({capability:'a'.repeat(43),password:'x'.repeat(24),email:'intruder@example.test'})));
 check(()=>assert.equal(validateClaim({capability:'a'.repeat(43),password:'Strong password synthetic 1!'}).capability.length,43));
 check(()=>assert.throws(()=>assertSameOrigin(undefined,'https://erp.example.test')));
 check(()=>assert.throws(()=>assertSameOrigin('https://evil.example.test','https://erp.example.test')));
 check(()=>assert.doesNotThrow(()=>assertSameOrigin('https://erp.example.test','https://erp.example.test')));
 const rate=new OnboardingRateLimit();
 check(()=>{for(let i=0;i<5;i++)rate.consume('synthetic');assert.throws(()=>rate.consume('synthetic'));});
 const gateway=new OnboardingGateway();
 await assert.rejects(()=>gateway.claim({capability:'a'.repeat(43),password:'Synthetic password 123!'}));passed++;
 assert.equal(await gateway.ready(),false);passed++;
 const pending=new OnboardingService({$queryRaw:async()=>[{installed:false}]} as unknown as PrismaService,gateway);
 const safe=await pending.status('synthetic');
 check(()=>{assert(Array.isArray(safe.items));assert.deepEqual([safe.installed,safe.configured,safe.canManage,safe.items.length],[false,false,false,0]);});
 await assert.rejects(async()=>pending.execute({user:{id:'synthetic'}} as AuthenticatedRequest,{command:'INVITE',payload:{email:'person@example.test',name:'Synthetic',reason:'test'},proof:{}}));passed++;
 let received:Record<string,unknown>|undefined;
 const capturing={execute:async(value:Record<string,unknown>)=>{received=value;return {status:'ACCEPTED'};}} as unknown as OnboardingGateway;
 const sessionBound=new OnboardingService({} as PrismaService,capturing);
 await sessionBound.execute({user:{id:'synthetic'},authSession:{id:'actual-session',tokenId:'actual-token'}} as AuthenticatedRequest,{command:'INVITE',payload:{email:'person@example.test',name:'Synthetic',reason:'test'},proof:{claims:{actorId:'spoofed'}}});
 check(()=>assert.deepEqual([received?.actorId,received?.sessionId,received?.tokenId],['synthetic','actual-session','actual-token']));
 check(()=>assert.throws(()=>validateCommand({command:'AUTHORITY_REQUEST',payload:{operation:'ROLE_CREATE',payload:{code:'SYNTHETIC',name:'Synthetic',sql:'bad'},reason:'test',expectedVersion:0,idempotencyKey:'synthetic-idempotency',expiresAt:new Date(Date.now()+60000).toISOString()},proof:{}})));
 check(()=>assert.throws(()=>validateClaim({capability:'a'.repeat(43),password:'😃'.repeat(20)})));
 check(()=>assert.throws(()=>assertSameOrigin('https://erp.example.test/path','https://erp.example.test')));
 const replacement={command:'REPLACE_ACCOUNT',payload:{oldUserId:'synthetic-old',targetUserId:'synthetic-new',employeeId:'synthetic-employee',employeeCode:'SYNTHETIC-001',evidenceDigest:'a'.repeat(64),reason:'Independently verified synthetic replacement'},proof:{claims:{},signature:'synthetic'}};
 check(()=>assert.equal(validateCommand(replacement).command,'REPLACE_ACCOUNT'));
 check(()=>assert.throws(()=>validateCommand({...replacement,payload:{...replacement.payload,privateDocument:'forbidden'}})));
 check(()=>assert.throws(()=>validateCommand({...replacement,payload:{...replacement.payload,evidenceDigest:'artifact://private-document'}})));
 check(()=>assert.throws(()=>validateCommand({...replacement,payload:{...replacement.payload,reason:''}})));
 // Exercise the production gateway allowlist, including accepted mail whose
 // bookkeeping failed. Mock only its private transport, never its result mapper.
 const classified=new OnboardingGateway();classified.ready=async()=>true;
 let privateResult:Record<string,unknown>={};
 (classified as unknown as {send:()=>Promise<Record<string,unknown>>}).send=async()=>privateResult;
 for(const deliveryStatus of ['ACCEPTED','UNKNOWN'])for(const deliveryRecorded of [true,false]){
  privateResult={status:'ISSUED',invitationId:'synthetic-invitation',userId:'synthetic-user',email:'internal@example.invalid',capability:'synthetic-secret',deliveryStatus,deliveryRecorded,unreviewed:'internal'};
  const result=await classified.execute({command:'INVITE'});
  check(()=>assert.deepEqual(result,{status:'ISSUED',deliveryStatus,deliveryRecorded,...(deliveryStatus==='UNKNOWN'||!deliveryRecorded?{recovery:'RECONCILE_OR_EXPLICIT_CANCEL_AND_REISSUE'}:{}),invitationId:'synthetic-invitation',userId:'synthetic-user'}));
 }
 privateResult={status:'DELIVERED',deliveryStatus:'ACCEPTED',deliveryRecorded:true};await assert.rejects(()=>classified.execute({command:'INVITE'}),(error:{getResponse:()=>unknown})=>{const result=error.getResponse() as {status:string;retryable:boolean};return result.status==='OUTCOME_UNKNOWN'&&result.retryable===false;});passed++;
 privateResult={status:'ISSUED',deliveryStatus:'DELIVERED',deliveryRecorded:true};await assert.rejects(()=>classified.execute({command:'INVITE'}),(error:{getResponse:()=>unknown})=>{const result=error.getResponse() as {status:string;retryable:boolean};return result.status==='OUTCOME_UNKNOWN'&&result.retryable===false;});passed++;
 console.log(`Onboarding API boundary: ${passed} PASS`);
}
main().catch(()=>{console.error('Onboarding API boundary verification failed.');process.exitCode=1;});
