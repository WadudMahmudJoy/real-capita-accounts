// Extend the existing read-only smoke without modifying reviewed application code.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,unlinkSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
const root=resolve('.'),req=createRequire(join(root,'package.json'));
const build=mkdtempSync(resolve('apps/api/.hr-deploy-')),fixture=resolve('scripts/db',build.split(/[\\/]/).at(-1)+'-smoke.ts');
try{
 const compile=spawnSync(process.execPath,[req.resolve('typescript/bin/tsc'),'-p','apps/api/tsconfig.json','--outDir',build,'--incremental','false','--declaration','false','--sourceMap','false'],{stdio:['ignore','pipe','pipe']});assert.equal(compile.status,0,'API smoke build failed');
 let source=readFileSync('scripts/db/hr-runtime-smoke.ts','utf8');source="import {authorityWebSmoke} from './authority-web-smoke';\n"+source;
 source=source.replace("'/leave-requests/categories'];","'/leave-requests/categories','/authority/access','/authority/roles','/authority/requests','/leave-requests/md-queue','/projects'];");
 source=source.replace("const approved=await prisma.payrollRun.count",`console.log('SMOKE legacy reads passed');const authority=app.get(load('authority/authority.service.js').AuthorityService);
  if(actor){const access=await authority.access(actor.id);assert.equal(access.status,'AVAILABLE');assert.equal(access.activated,false);assert(!access.permissions.includes('authority.review'));await assert.rejects(()=>authority.roles({page:1,pageSize:20},actor.id),(e:any)=>e.getStatus()===403);await assert.rejects(()=>authority.claim('unverified-smoke-reference',actor.id),(e:any)=>e.getStatus()===503);await assert.rejects(()=>app.get(load('authority/authority-writer.js').AuthorityWriter).execute(actor.id,'REQUEST',{}),(e:any)=>e.getStatus()===503);const leave=app.get(load('leave/leave.service.js').LeaveService);await assert.rejects(()=>leave.reviewQueue({page:1,pageSize:20,status:'PENDING_MD_DECISION'},actor.id,true),(e:any)=>e.getStatus()===403);}
  for(const model of ['authorityMandate','authorityRoleGrant','authorityRequest','authorityEvent','leaveWorkflow','leaveStageDecision'])assert.equal(await prisma[model].count(),0);
  console.log('SMOKE authority absence and default providers passed');const frontend=await authorityWebSmoke(base);
  const approved=await prisma.payrollRun.count`);
 source=source.replace("status:'PASS',runtimeStartup:true","status:'PASS',frontend,mdAbsentFailClosed:true,defaultClaimAndWriter503:true,runtimeStartup:true");
 source=source.replace("main().catch(()=>{","main().catch((e:any)=>{console.error(JSON.stringify({name:e?.name,code:e?.code,assertion:e instanceof assert.AssertionError?e.message:undefined,locations:e?.stack?.split('\\n').filter((s:string)=>s.trim().startsWith('at ')).slice(0,4)}));");
 writeFileSync(fixture,source,{flag:'wx'});
 const env={...process.env,HR_SMOKE_BUILD:build};for(const key of Object.keys(env))if(/DATABASE|DB_.*SECRET|SALARY_PRIVATE/.test(key))delete (env as Record<string,string|undefined>)[key];
 const result=spawnSync(process.execPath,[req.resolve('tsx/cli'),'--tsconfig','apps/api/tsconfig.json',fixture],{env,stdio:'inherit'});assert.equal(result.status,0,'Authority runtime smoke failed');
}finally{
 try{unlinkSync(fixture);}catch{/* Fixture may not have been created after a compiler failure. */}
 assert(build.startsWith(resolve('apps/api/.hr-deploy-')));rmSync(build,{recursive:true,force:true});
}
