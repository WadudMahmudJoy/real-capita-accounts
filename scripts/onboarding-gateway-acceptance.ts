// Task-owned PostgreSQL + real HTTPS/mTLS transport. No external provider traffic.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID,X509Certificate} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer,request,Server} from 'node:https';
import type {ServerResponse} from 'node:http';
import {createServer as portProbe} from 'node:net';
import {OnboardingGateway} from '../apps/api/src/onboarding/onboarding.gateway';
import {OnboardingPrivateExecutor} from '../apps/api/src/onboarding/private/executor';
import {ResendInvitationDelivery,INVITATION_PROVIDER_TIMEOUT_MS} from '../apps/api/src/onboarding/private/delivery';
import {startOnboardingBroker} from '../apps/api/src/onboarding/private/broker';
import {IndependentEvidenceCollector} from '../apps/api/src/onboarding/private/collector';
const wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}
export async function verifyOnboardingGateway(c:any){
 const {db,owner,pool,database,writer,verifier,envelope,md,agm,base,gateway:httpGateway}=c;
 const directory=mkdtempSync(join(tmpdir(),'rc-gateway-mtls-')),oldEnv={...process.env};
 let broker:Server|undefined,provider:Server|undefined,checks=0,calls=0,commands=0;
 let mode='drop-ack',providerDelay=0,sqlDelay=0,lastCapability='',lastInvitationId='',providerStartedAt=0,lastAmbiguousAt=0;
 let currentResponse:ServerResponse|undefined,workerDone=deferred();
 const ok=(value:unknown,label:string)=>{assert(value,label);checks++;};
 const keys:string[]=[],capabilities:string[]=[];
 try{
  const ssl=(args:string[])=>execFileSync('openssl',args,{cwd:directory,stdio:'ignore'});
  writeFileSync(join(directory,'openssl.cnf'),'[req]\ndistinguished_name=dn\n[dn]\nCN=fixture\n');
  ssl(['req','-config','openssl.cnf','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.crt','-days','1','-subj','/CN=Synthetic Gateway CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
  for(const name of ['server','client']){
   ssl(['req','-config','openssl.cnf','-newkey','rsa:2048','-nodes','-keyout',name+'.key','-out',name+'.csr','-subj','/CN='+name]);
   writeFileSync(join(directory,name+'.ext'),name==='server'?'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n':'extendedKeyUsage=clientAuth\n');
   ssl(['x509','-req','-in',name+'.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out',name+'.crt','-days','1','-extfile',name+'.ext']);
  }
  const read=(name:string)=>readFileSync(join(directory,name));
  provider=createServer({key:read('server.key'),cert:read('server.crt')},(req,res)=>{
   void (async()=>{
    let text='';for await(const part of req)text+=String(part);const message=JSON.parse(text);
    lastCapability=String(message.text).match(/#capability=([A-Za-z0-9_-]{43})/)![1];assert(lastCapability);capabilities.push(lastCapability);
    const key=String(req.headers['idempotency-key']);keys.push(key);lastInvitationId=key.slice('invitation-'.length);calls++;providerStartedAt=Date.now();
    const invitation=await owner.onboardingInvitation.findUniqueOrThrow({where:{id:lastInvitationId}});
    ok(invitation.status==='ISSUED','Provider observes committed issued invitation');
    ok(invitation.tokenHash===createHash('sha256').update(lastCapability).digest('hex'),'Provider capability matches committed hash');
    if(mode==='interrupt')currentResponse?.destroy();
    await wait(providerDelay);
    if(!res.destroyed)res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({id:'synthetic-accepted'}));
   })().catch(()=>{res.destroy();});
  });
  await new Promise<void>(resolve=>provider!.listen(0,'127.0.0.1',resolve));const providerPort=(provider.address() as {port:number}).port;
  const fakeFetch:typeof fetch=async(url,init)=>{
   assert.equal(url,'https://api.resend.com/emails');
   // Only Resend's transport is redirected to a local HTTPS fake; gateway.send is untouched.
   return new Promise<Response>((resolve,reject)=>{
    const req=request({hostname:'127.0.0.1',port:providerPort,path:'/emails',method:'POST',ca:read('ca.crt'),rejectUnauthorized:true,agent:false,headers:init!.headers as Record<string,string>,signal:init!.signal!},res=>{
     let body='';res.on('data',(part:Buffer)=>body+=part.toString());res.on('end',()=>resolve(new Response(body,{status:res.statusCode!})));res.on('error',reject);
    });req.on('error',reject);req.end(init!.body as string);
   });
  };
  const observedPool={connect:async()=>{const client=await pool.connect();return {release:()=>client.release(),query:async(sql:string,values?:unknown[])=>{const r=await client.query(sql,values);if(sql.startsWith('SELECT onboarding_command')&&sqlDelay)await wait(sqlDelay);return r;}};}};
  const executor=new OnboardingPrivateExecutor(observedPool,database,writer,verifier,new ResendInvitationDelivery({apiKey:'synthetic-only',from:'fixture@example.invalid',claimUrl:'https://claim.example.invalid/claim'},fakeFetch));
  const observed=new Proxy(executor,{get(target,key){if(key==='execute')return async(input:any)=>{commands++;try{const result=await target.execute(input);if(mode==='drop-ack')currentResponse?.destroy();if(mode==='truncate'){currentResponse?.writeHead(200,{'Content-Type':'application/json'});currentResponse?.write('{"status":');currentResponse?.destroy();}return result;}finally{workerDone.resolve();}};return Reflect.get(target,key,target);}});
  const probe=portProbe();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=(probe.address() as {port:number}).port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
  const collector=new IndependentEvidenceCollector('https://127.0.0.1:'+port+'/fixture-evidence','synthetic-onboarding',['https://evidence.example.invalid'],{key:read('client.key'),cert:read('client.crt'),ca:read('ca.crt')});
  broker=await startOnboardingBroker(observed,{key:read('server.key'),cert:read('server.crt'),ca:read('ca.crt')},[new X509Certificate(read('client.crt')).fingerprint256],port,collector);
  broker.prependListener('request',(req,res)=>{if(req.url==='/commands')currentResponse=res;});
  process.env.ONBOARDING_PRIVATE_GATEWAY_URL='https://127.0.0.1:'+port+'/';
  process.env.ONBOARDING_PRIVATE_GATEWAY_CERT_FILE=join(directory,'client.crt');process.env.ONBOARDING_PRIVATE_GATEWAY_KEY_FILE=join(directory,'client.key');process.env.ONBOARDING_PRIVATE_GATEWAY_CA_FILE=join(directory,'ca.crt');
  const gateway=new OnboardingGateway();ok(await gateway.ready(),'Production gateway verifies actual mTLS readiness');
  const invite=(suffix:string)=>envelope(md.session,'INVITE',{email:'gateway-'+suffix+'@example.invalid',name:'Synthetic Gateway Recovery',reason:'Isolated gateway ambiguity acceptance'});
  const unknown=async(fn:()=>Promise<unknown>,signed?:any)=>{
   const before=commands;let caught:any;try{await fn();}catch(error){caught=error;}
   ok(caught?.getStatus?.()===503,'Ambiguous transport result returns controlled503');lastAmbiguousAt=Date.now();const result=caught.getResponse();
   ok(result.status==='OUTCOME_UNKNOWN'&&result.retryable===false,'Ambiguity never claims no change; automatic retry forbidden');
   ok(result.recovery==='AUTHORIZED_READ_ONLY_RECONCILIATION_REQUIRED','Ambiguity directs authorized read-only reconciliation');
   ok(!JSON.stringify(result).includes(lastCapability)&&!JSON.stringify(result).includes('No authority was granted'),'Error contains no capability or false no-authority assertion');
   if(signed)ok(result.reconciliationId===createHash('sha256').update(signed.proof.claims.nonce).digest('hex'),'Nonce digest correlates committed audit without exposing proof');
   await workerDone.promise;ok(commands===before+1,'Gateway never automatically resubmits mutation');return result;
  };
  // Red regression: committed delivery is accepted, but the broker response is lost.
  let signed=invite('lost-ack');workerDone=deferred();await unknown(()=>gateway.execute(signed),signed);
  let invitation=await owner.onboardingInvitation.findUniqueOrThrow({where:{id:lastInvitationId}});
  ok(invitation.status==='ISSUED','Successful delivery with lost gateway acknowledgment stays claimable');
  ok(await owner.onboardingEvent.count({where:{recordId:invitation.id,action:'DELIVERY_ACCEPTED'}})===1,'Committed delivery outcome survives response loss');
  // Outer authenticated API also receives ambiguity from the actual TLS gateway.
  const originalExecute=httpGateway.execute;httpGateway.execute=(input:any)=>gateway.execute(input);
  try{
   signed=invite('http-lost-ack');workerDone=deferred();const before=commands;
   const response=await fetch(base+'/onboarding/commands',{method:'POST',headers:{Cookie:md.session.cookie,Origin:process.env.APP_ORIGIN!,'Content-Type':'application/json'},body:JSON.stringify({command:signed.command,payload:signed.payload,proof:signed.proof})});
   const result=await response.json();await workerDone.promise;
   ok(response.status===503&&result.status==='OUTCOME_UNKNOWN'&&result.retryable===false,'Authenticated HTTP API preserves actual gateway ambiguous status');
   ok(result.reconciliationId===createHash('sha256').update(signed.proof.claims.nonce).digest('hex'),'HTTP API returns safe reconciliation digest');
   ok(commands===before+1&&!JSON.stringify(result).includes(lastCapability),'HTTP API performs no retry and exposes no capability');
   ok((await owner.onboardingInvitation.findUniqueOrThrow({where:{id:lastInvitationId}})).status==='ISSUED','API503 after lost response preserves committed issuance');
  }finally{httpGateway.execute=originalExecute;}
  mode='normal';invitation=await owner.onboardingInvitation.findUniqueOrThrow({where:{id:lastInvitationId}});const beforeDuplicate=calls;await assert.rejects(()=>gateway.execute(signed),(error:any)=>error.getStatus()===409);checks++;
  await assert.rejects(()=>gateway.execute(invite('http-lost-ack')),(error:any)=>error.getStatus()===409);checks++;
  ok(calls===beforeDuplicate,'Same-proof replay and fresh duplicate INVITE cause no second provider call');
  await gateway.claim({capability:lastCapability,password:randomBytes(24).toString('base64url')});
  ok(!(await owner.user.findUniqueOrThrow({where:{id:invitation.userId}})).isActive,'Claim through actual gateway consumes link without activation');
  mode='normal';sqlDelay=1200;providerDelay=9200;signed=invite('delayed');workerDone=deferred();const started=Date.now();
  const delayed=await gateway.execute(signed);await workerDone.promise;ok(Date.now()-started>10000,'Real composed DB/provider response exceeds old gateway budget');
  ok(delayed.status==='ISSUED'&&delayed.deliveryStatus==='ACCEPTED','Delayed real HTTPS provider response reaches gateway successfully');sqlDelay=0;providerDelay=0;
  for(const fault of ['interrupt','truncate']){
   mode=fault;providerDelay=fault==='interrupt'?250:0;signed=invite(fault);workerDone=deferred();await unknown(()=>gateway.execute(signed),signed);
   invitation=await owner.onboardingInvitation.findUniqueOrThrow({where:{id:lastInvitationId}});ok(invitation.status==='ISSUED','Connection interruption never cancels committed invitation');
  }
  // Shorten only the test client's deadline; its real send/TLS/parser stay intact.
  class DeadlineGateway extends OnboardingGateway{protected requestDeadlineMs(path:string){return path==='/commands'?2000:super.requestDeadlineMs(path);}}
  mode='normal';providerDelay=3000;signed=invite('deadline');workerDone=deferred();providerStartedAt=0;
  await unknown(()=>new DeadlineGateway().execute(signed),signed);
  ok(providerStartedAt>0&&providerStartedAt<lastAmbiguousAt,'Gateway deadline expires after commit/provider request, while worker continues');
  invitation=await owner.onboardingInvitation.findUniqueOrThrow({where:{id:lastInvitationId}});ok(invitation.status==='ISSUED','Client deadline never rolls back durable invitation');
  ok(await owner.onboardingEvent.count({where:{recordId:invitation.id,action:'DELIVERY_ACCEPTED'}})===1,'Worker records acceptance even after gateway deadline');
  // Provider timeout is inside the larger production gateway deadline.
  providerDelay=INVITATION_PROVIDER_TIMEOUT_MS+500;signed=invite('provider-deadline');workerDone=deferred();
  const providerUnknown=await gateway.execute(signed);await workerDone.promise;
  ok(providerUnknown.status==='ISSUED'&&providerUnknown.deliveryStatus==='UNKNOWN','Provider abort returns durable ISSUED/UNKNOWN through production gateway');
  await gateway.claim({capability:lastCapability,password:randomBytes(24).toString('base64url')});
  ok((await owner.onboardingInvitation.findUniqueOrThrow({where:{id:lastInvitationId}})).status==='CONSUMED','Provider timeout with possible acceptance leaves claim usable');
  mode='drop-ack';providerDelay=0;
  const key=randomUUID(),authority=envelope(agm.session,'AUTHORITY_REQUEST',{operation:'ROLE_CREATE',payload:{code:'GATEWAY_ACK_LOST',name:'Synthetic Gateway Role',permissions:['employees.view']},expectedVersion:0,idempotencyKey:key,reason:'Isolated authority acknowledgment loss',expiresAt:new Date(Date.now()+3600000).toISOString()});
  workerDone=deferred();await unknown(()=>gateway.execute(authority),authority);
  ok(await owner.role.count({where:{code:'GATEWAY_ACK_LOST'}})===1,'Other privileged authority command committed despite lost acknowledgment');
  const durable=await owner.authorityRequest.findFirstOrThrow({where:{actorId:agm.id,idempotencyKey:key}});ok(durable.status==='APPLIED','Read-only authority request reconciliation finds applied result');
  await db.query('BEGIN READ ONLY');try{
   ok((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only==='on','Reconciliation transaction enforces read-only mode');
   const receipt=(await db.query('SELECT command,"actorId","sessionId","payloadHash" FROM onboarding_nonces WHERE "nonceHash"=$1',[createHash('sha256').update(authority.proof.claims.nonce).digest('hex')])).rows;
   ok(receipt.length===1&&receipt[0].command==='AUTHORITY_REQUEST'&&receipt[0].actorId===agm.id&&receipt[0].sessionId===authority.sessionId&&receipt[0].payloadHash===authority.proof.claims.payloadHash,'Authorized read-only nonce reconciliation matches committed command/session/payload');
  }finally{await db.query('ROLLBACK');}
  mode='normal';await assert.rejects(()=>gateway.execute(authority),(error:any)=>error.getStatus()===409);checks++;
  ok(await owner.role.count({where:{code:'GATEWAY_ACK_LOST'}})===1,'Lost authority acknowledgment never creates duplicate role');
  for(const cap of capabilities){const rows=await owner.onboardingInvitation.findMany({where:{email:{startsWith:'gateway-'}}});ok(!JSON.stringify(rows).includes(cap),'Only capability hashes persisted after transport failures');}
  ok(new Set(keys).size===keys.length,'Stable per-invitation idempotency has no duplicate sends');
  console.log(`PASS ${checks} real HTTPS/mTLS gateway/PostgreSQL assertions: delayed provider, post-COMMIT acknowledgment loss, interruption/truncation, duplicate denial, claim preservation and other authority mutations`);
  return checks;
 }finally{
  for(const server of [broker,provider])if(server){server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  for(const name of Object.keys(process.env))if(!(name in oldEnv))delete process.env[name];Object.assign(process.env,oldEnv);
  assert(directory.startsWith(join(tmpdir(),'rc-gateway-mtls-')));rmSync(directory,{recursive:true,force:true});
 }
}
