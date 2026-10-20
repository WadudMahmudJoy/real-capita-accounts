import 'reflect-metadata';
import assert from 'node:assert/strict';
import {effectiveAccountant,specializedPermissionAllowed,verifiedOnboardingClaim} from '../apps/api/src/auth/onboarding-access';
import {permission} from '../apps/api/src/auth/hr-access';
import type {Prisma} from '../apps/api/src/generated/prisma/client';
import {AuthService} from '../apps/api/src/auth/auth.service';
import {hash} from 'bcryptjs';
import type {PrismaService} from '../apps/api/src/prisma/prisma.service';
import type {JwtService} from '@nestjs/jwt';
import type {Request} from 'express';
import {AuthGuard} from '../apps/api/src/auth/guards/auth.guard';
import {AUTH_COOKIE_DEFAULT_NAME} from '../apps/api/src/auth/auth.constants';
import type {AuthenticatedRequest} from '../apps/api/src/auth/auth.types';
import type {ExecutionContext} from '@nestjs/common';
async function main(){
 let passed=0;
 const fake=(rows:unknown[][])=>({$queryRaw:async()=>rows.shift()??[]}) as unknown as Prisma.TransactionClient;
 // A small SELECT adapter evaluates the governed projection over request-state
 // fixtures. PostgreSQL acceptance separately executes these SQL predicates.
 const historyDb=(states:string[])=>({
  $queryRaw:async(parts:TemplateStringsArray)=>{
   const sql=parts.join('?');if(sql.includes('to_regclass'))return [{installed:true}];
   const governedProjection=sql.split(') governed,')[0];
   const filter=/\bstate\s+IN\s*\(([^)]*)\)/i.exec(governedProjection);
   const allowed=filter?[...filter[1].matchAll(/'([^']+)'/g)].map(match=>match[1]):null;
   return [{governed:states.some(state=>allowed===null||allowed.includes(state)),effective:false}];
  },
  userPermission:{findFirst:async()=>({id:'legacy-stored-permission'})},
 }) as unknown as Prisma.TransactionClient;
 for(const state of ['PENDING','REJECTED']){
  assert.equal(await effectiveAccountant(historyDb([state]),'synthetic',true),true,`${state} must preserve legacy ACCOUNTANT`);passed++;
  for(const code of ['SYSTEM_ADMIN','HR_ADMIN'] as const){assert.equal((await permission(historyDb([state]),'synthetic',code))?.id,'legacy-stored-permission',`${state} must preserve legacy ${code}`);passed++;}
 }
 for(const history of [['APPROVED'],['REVOKED'],['APPROVED','PENDING'],['REVOKED','REJECTED']]){
  assert.equal(await effectiveAccountant(historyDb(history),'synthetic',true),false,'Expired/revoked governance cannot fall back to legacy ACCOUNTANT');passed++;
  for(const code of ['SYSTEM_ADMIN','HR_ADMIN'] as const){assert.equal(await permission(historyDb(history),'synthetic',code),null,'Expired/revoked governance cannot fall back to legacy specialized permission');passed++;}
 }
 for(const [label,db,hasRole,expected]of [
  ['legacy unchanged',fake([[{installed:false}]]),true,true],
  ['no stored role',fake([]),false,false],
  ['history absent',fake([[{installed:true}],[{governed:false,effective:false}]]),true,true],
  ['approved live bounded',fake([[{installed:true}],[{governed:true,effective:true}]]),true,true],
  ['expired approval',fake([[{installed:true}],[{governed:true,effective:false}]]),true,false],
  ['revoked approval',fake([[{installed:true}],[{governed:true,effective:false}]]),true,false],
 ]as const){assert.equal(await effectiveAccountant(db,'synthetic',hasRole),expected,label);passed++;}
 assert.equal(await verifiedOnboardingClaim(fake([[{installed:false}]]),'synthetic'),false);passed++;
 assert.equal(await verifiedOnboardingClaim(fake([[{installed:true}],[{verified:false}]]),'synthetic'),false);passed++;
 assert.equal(await verifiedOnboardingClaim(fake([[{installed:true}],[{verified:true}]]),'synthetic'),true);passed++;
 await assert.rejects(()=>effectiveAccountant({$queryRaw:async()=>{throw new Error('database unavailable');}} as unknown as Prisma.TransactionClient,'synthetic',true));passed++;
 for(const code of ['SYSTEM_ADMIN','HR_ADMIN'] as const){
  for(const [rows,expected]of [
   [[[{installed:false}]],true],
   [[[{installed:true}],[{governed:false,effective:false}]],true],
   [[[{installed:true}],[{governed:true,effective:true}]],true],
   [[[{installed:true}],[{governed:true,effective:false}]],false],
  ]as const){assert.equal(await specializedPermissionAllowed(fake(rows.map(r=>[...r])),'synthetic',code),expected);passed++;}
  const denied=fake([[{installed:true}],[{governed:true,effective:false}]]);Object.assign(denied,{userPermission:{findFirst:async()=>({id:'synthetic-grant'})}});
  assert.equal(await permission(denied,'synthetic',code),null);passed++;
 }
 const password='Synthetic password only 123!';const passwordHash=await hash(password,4);let createdSessions=0;
 const user={id:'synthetic',email:'person@example.test',fullName:'Synthetic',isActive:true,passwordHash,roles:[{role:{code:'ACCOUNTANT',name:'Accountant'}}]};
 const authDb=(bound:boolean)=>({
  user:{findUnique:async()=>user,update:async()=>user},
  $queryRaw:async(parts:TemplateStringsArray)=>parts.join('').includes('to_regclass')?[{installed:true}]:[{governed:true,effective:false}],
  $transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn({userPermission:{findFirst:async()=>null},employeeAccountBinding:{findFirst:async()=>bound?{id:'binding'}:null}}),
  company:{findFirst:async()=>({id:'primary'})},authSession:{create:async()=>{createdSessions++;return {id:'synthetic-session'};}},auditEvent:{create:async()=>({})},
 }) as unknown as PrismaService;
 const oldSecret=process.env.JWT_SECRET;process.env.JWT_SECRET='synthetic-verification-only';
 try{
  const request={ip:'127.0.0.1',get:()=>undefined} as unknown as Request;
  const jwt={signAsync:async()=> 'synthetic-session-credential'} as unknown as JwtService;
  await assert.rejects(()=>new AuthService(jwt,authDb(false)).login(user.email,password,request));assert.equal(createdSessions,0);passed++;
  const result=await new AuthService(jwt,authDb(true)).login(user.email,password,request);assert.equal(createdSessions,1);assert.deepEqual(result.user.roles,[]);passed++;
  const guardedRequest={cookies:{[AUTH_COOKIE_DEFAULT_NAME]:'synthetic-cookie'},method:'GET'} as unknown as AuthenticatedRequest;
  class SyntheticController{}const handler=()=>undefined;Reflect.defineMetadata('path','onboarding',SyntheticController);Reflect.defineMetadata('path','status',handler);
  const db=authDb(true);Object.assign(db,{authSession:{findUnique:async()=>({id:'session',tokenId:'token',userId:user.id,user,revokedAt:null,expiresAt:new Date(Date.now()+60000),activeCompanyId:'primary',activeCompany:null})}});
  const guard=new AuthGuard({verifyAsync:async()=>({sid:'session',jti:'token',sub:user.id})} as unknown as JwtService,db);
  await guard.canActivate({switchToHttp:()=>({getRequest:()=>guardedRequest}),getClass:()=>SyntheticController,getHandler:()=>handler} as unknown as ExecutionContext);
  assert.deepEqual(guardedRequest.user.roles,[]);assert.equal(guardedRequest.authSession.id,'session');passed++;
 }finally{if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;}
 console.log(`Onboarding effective access: ${passed} PASS`);
}
main().catch(()=>{console.error('Onboarding effective access verification failed.');process.exitCode=1;});
