// Deterministic service checks only; persisted/authenticated checks use the HR harness.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const req=createRequire(resolve('apps/api/package.json'));
req('reflect-metadata');
async function main(){
 const {UsersService}=await import('../apps/api/src/users/users.service');
 const {validateSync}=req('class-validator'),{plainToInstance}=req('class-transformer');
 const dto=await import('../apps/api/src/users/users.dto');
 let rows:any[]=[],events:any[]=[],audits:any[]=[],failAudit=false,authorized=true;
 const tx:any={
  $queryRaw:async()=>[],
  userPermission:{findFirst:async()=>authorized?{id:'explicit-system-admin'}:null},
  user:{create:async({data}:any)=>{const row={...data,id:'pending-'+(rows.length+1),adminVersion:1,roles:[],hrPermissions:[],employeeBindings:[]};rows.push(row);const {passwordHash,...safe}=row;assert(passwordHash);return safe;},findUnique:async()=>rows[0]},
  userAdminEvent:{create:async({data}:any)=>{events.push(data);return data;},findFirst:async()=>events.find(e=>e.action==='PENDING_CREATED')??null},
  auditEvent:{create:async({data}:any)=>{if(failAudit)throw Error('Synthetic audit failure');audits.push(data);return data;}},
 };
 const db:any={$transaction:async(fn:any)=>{const old=structuredClone({rows,events,audits});try{return await fn(tx);}catch(e){({rows,events,audits}=old);throw e;}}};
 const users:any=new UsersService(db),input={email:'person@example.invalid',fullName:'Pending Person',reason:'Isolated owner-nominated onboarding'};
 assert.equal(typeof users.createPending,'function','Pending provisioning service must exist');
 authorized=false;await assert.rejects(()=>users.createPending(input,'ordinary-accountant'),(e:any)=>e.getStatus()===403);assert.equal(rows.length,0);
 authorized=true;const pending=await users.createPending(input,'verified-administrator');assert.equal(pending.isActive,false);assert.deepEqual(pending.roles,[]);assert.deepEqual(pending.hrPermissions,[]);assert.deepEqual(pending.employeeBindings,[]);
 assert.equal(events[0].actorId,'verified-administrator');assert.equal(events[0].action,'PENDING_CREATED');assert.equal(audits[0].action,'USER_ADMIN_PENDING_CREATED');assert(!JSON.stringify({pending,events,audits}).includes('passwordHash'));assert(!JSON.stringify(pending).includes('password'));
 const firstHash=rows[0].passwordHash;await users.createPending({...input,email:'other@example.invalid'},'verified-administrator');assert.notEqual(rows[1].passwordHash,firstHash);assert(await req('bcryptjs').compare('abc',firstHash)===false);
 for(const action of ['ACTIVATE','SET_ACCOUNTANT','GRANT_PERMISSION','BIND'])await assert.rejects(()=>users.action(pending.id,{action,expectedVersion:1,reason:'Cannot bypass verification'},'verified-administrator'),(e:any)=>e.getStatus()===403);
 failAudit=true;const count=rows.length;await assert.rejects(()=>users.createPending({...input,email:'rollback@example.invalid'},'verified-administrator'));assert.equal(rows.length,count);
 assert.equal(validateSync(plainToInstance(dto.PendingUserDto,input),{whitelist:true,forbidNonWhitelisted:true}).length,0);
 for(const extra of [{password:'claimed-secret'},{isActive:true},{roles:['SYSTEM_ADMIN']},{verified:true},{employeeId:'claimed-id'}])assert(validateSync(plainToInstance(dto.PendingUserDto,{...input,...extra}),{whitelist:true,forbidNonWhitelisted:true}).length>0);
 console.log('PASS pending-user service: explicit administrator only, inactive reservation without issued credentials, no permissions/bindings, unresolved verification gate, audit atomicity and strict DTO; offline doubles, no database writes');
}
main().catch(e=>{console.error(e instanceof assert.AssertionError?e.message:'Pending onboarding verification failed');process.exitCode=1;});
