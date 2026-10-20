import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
export async function runOnboardingBrowser(api:string,email:string,password:string){
 const token=randomBytes(16).toString('hex'),temp=mkdtempSync(join(tmpdir(),'rc-onboarding-browser-')),webRoot=resolve('apps/web'),dist=resolve(webRoot,'.next-hr-test-'+token);
 const tsconfig=resolve(webRoot,'tsconfig.json'),nextEnv=resolve(webRoot,'next-env.d.ts'),beforeTs=readFileSync(tsconfig),beforeEnv=readFileSync(nextEnv);
 const port=await new Promise<number>((done,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>done(p));});});const url='http://127.0.0.1:'+port;
 const req=createRequire(resolve(webRoot,'package.json')),env={...process.env,NEXT_PUBLIC_API_BASE_URL:api,HR_BROWSER_TEST_TOKEN:token};for(const key of Object.keys(env))if(/DATABASE|DB_.*SECRET|JWT_SECRET|PRIVATE_/.test(key))delete (env as Record<string,string|undefined>)[key];
 const child=spawn(process.execPath,[req.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{cwd:webRoot,env,stdio:['ignore','pipe','pipe'],windowsHide:true});child.stdout?.on('data',()=>{});child.stderr?.on('data',()=>{});
 const previousOrigin=process.env.APP_ORIGIN;process.env.APP_ORIGIN=url;
 try{
  let ready=false;for(let n=0;n<180;n++){assert(child.exitCode===null);try{if((await fetch(url+'/login')).ok){ready=true;break;}}catch{/* Task process startup only. */}await new Promise(r=>setTimeout(r,400));}assert(ready,'Isolated frontend startup');
  const resultFile=join(temp,'result.json'),fixture={url,api,email,password};
  writeFileSync(join(temp,'scenario.js'),readFileSync('scripts/onboarding-browser-scenario.js','utf8').replace('__FIXTURE__',JSON.stringify(fixture)),{flag:'wx'});
  console.log('ONBOARDING_BROWSER_SCENARIO '+join(temp,'scenario.js'));console.log('ONBOARDING_BROWSER_RESULT '+resultFile);
  for(let n=0;n<600&&!existsSync(resultFile);n++)await new Promise(r=>setTimeout(r,500));assert(existsSync(resultFile),'Authenticated browser driver did not return');
  const result=JSON.parse(readFileSync(resultFile,'utf8'));assert.equal(result.status,'PASS',result.message);console.log(`PASS ${result.checks} actual authenticated onboarding browser assertions`);return result;
 }finally{
  const stopped=new Promise<void>(done=>{if(child.exitCode!==null)done();else child.once('exit',()=>done());});child.kill();await stopped;
  writeFileSync(tsconfig,beforeTs);writeFileSync(nextEnv,beforeEnv);if(previousOrigin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previousOrigin;
  assert(dist.startsWith(resolve(webRoot,'.next-hr-test-')));if(existsSync(dist))rmSync(dist,{recursive:true,force:true});assert(temp.startsWith(join(tmpdir(),'rc-onboarding-browser-')));rmSync(temp,{recursive:true,force:true});
 }
}
