import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
export async function authorityWebSmoke(api:string){
 const token=randomBytes(16).toString('hex'),webRoot=resolve('apps/web');
 const generated=resolve(webRoot,'.next-hr-test-'+token),nextEnv=resolve(webRoot,'next-env.d.ts'),original=readFileSync(nextEnv);
 const port=await new Promise<number>((done,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>done(p));});});
 const env={...process.env,NEXT_PUBLIC_API_BASE_URL:api,HR_BROWSER_TEST_TOKEN:token};for(const key of Object.keys(env))if(/DATABASE|DB_.*SECRET|JWT_SECRET|SALARY_PRIVATE/.test(key))delete (env as Record<string,string|undefined>)[key];
 const webReq=createRequire(resolve(webRoot,'package.json'));
 const child=spawn(process.execPath,[webReq.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:webRoot,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 child.stdout?.on('data',()=>{});child.stderr?.on('data',()=>{});
 try{
  let ready=false;for(let n=0;n<120;n++){assert(child.exitCode===null);try{if((await fetch(`http://127.0.0.1:${port}/login`)).ok){ready=true;break;}}catch{/* Only the task-owned web process. */}await new Promise(r=>setTimeout(r,500));}assert(ready,'Task web startup timed out');
  const routes=['/login','/app','/app/employees','/app/employees/attendance','/app/payroll-runs','/app/users','/app/roles','/app/leave-apply','/app/leave-requests','/app/projects','/app/accounts/ledger'];
  for(const path of routes){const response=await fetch(`http://127.0.0.1:${port}`+path);assert.equal(response.status,200,path);assert((await response.text()).includes('<html'));}
  return {status:'PASS',renderedRoutes:routes,scope:'Unauthenticated route rendering and sign-in shell only; genuine authenticated acceptance remains pending'};
 }finally{
  const stopped=new Promise<void>(done=>{if(child.exitCode!==null)done();else child.once('exit',()=>done());});child.kill();await stopped;
  writeFileSync(nextEnv,original);const configPath=resolve(webRoot,'tsconfig.json'),config=JSON.parse(readFileSync(configPath,'utf8'));config.include=config.include.filter((v:string)=>!v.startsWith('.next-hr-test-'+token+'/'));writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');assert(generated.startsWith(resolve(webRoot,'.next-hr-test-')));if(existsSync(generated))rmSync(generated,{recursive:true,force:true});
 }
}
