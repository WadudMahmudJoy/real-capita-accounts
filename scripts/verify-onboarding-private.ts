import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,X509Certificate} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {request} from 'node:https';
import {createServer} from 'node:net';
import {startOnboardingBroker} from '../apps/api/src/onboarding/private/broker';
import {requiredAssurance} from '../apps/api/src/onboarding/private/assurance';
import {assertSafePrivateNodeEnvironment} from '../apps/api/src/onboarding/private/runtime';
import {canonicalJson,payloadHash,ProofVerifier} from '../apps/api/src/onboarding/private/proof';
import {ResendInvitationDelivery} from '../apps/api/src/onboarding/private/delivery';
import {OnboardingPrivateExecutor,PrivateOperationError} from '../apps/api/src/onboarding/private/executor';
async function main(){
 assert.doesNotThrow(()=>assertSafePrivateNodeEnvironment({}));assert.throws(()=>assertSafePrivateNodeEnvironment({NODE_OPTIONS:'--require unrelated.js'}));assert.throws(()=>assertSafePrivateNodeEnvironment({NODE_PATH:'C:/untrusted/modules'}));
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');const now=Date.now();const verifier=new ProofVerifier({audience:'rc-private',issuers:{registrar:{publicKey,commands:{INVITE:['INITIAL_REGISTRAR']}}}},()=>now);
 const payload={email:'synthetic@example.invalid',name:'Synthetic'};
 const claims={actorId:'registrar-1',sessionId:'offline',tokenId:'approval-1',command:'INVITE',payloadHash:payloadHash(payload),nonce:'0123456789abcdef0123456789abcdef',issuedAt:now-1,expiresAt:now+60000,assurance:'INITIAL_REGISTRAR',issuer:'registrar',audience:'rc-private'};
 const proof=(c=claims)=>({claims:c,signature:sign(null,Buffer.from(canonicalJson(c)),privateKey).toString('base64url')});
 assert.equal(verifier.verify({...claims,payload,proof:proof()}).nonce,claims.nonce);
 for(const alteration of [{payload:{...payload,name:'Other'}},{actorId:'other'},{sessionId:'other'},{tokenId:'other'},{command:'ACTIVATE_MD'}])assert.throws(()=>verifier.verify({...claims,payload,proof:proof(),...alteration}));
 for(const c of [{...claims,expiresAt:now},{...claims,expiresAt:now+121000},{...claims,issuedAt:now+1},{...claims,assurance:'email-only'},{...claims,audience:'other'}])assert.throws(()=>verifier.verify({...claims,payload,proof:proof(c)}));
 assert.throws(()=>new ProofVerifier({audience:'rc-private',issuers:{}}));assert.throws(()=>canonicalJson({bad:undefined}));
 let called=0;const delivery=new ResendInvitationDelivery({apiKey:'synthetic-key',from:'ERP <erp@example.invalid>',claimUrl:'https://erp.example.invalid/claim'},async(url,init)=>{called++;assert.equal(url,'https://api.resend.com/emails');assert.equal((init?.headers as Record<string,string>)['Idempotency-Key'],'invitation-synthetic');const message=JSON.parse(init!.body as string);assert.deepEqual(message.to,['synthetic@example.invalid']);assert(String(message.text).includes('#capability='));return new Response(JSON.stringify({id:'provider-synthetic'}),{status:200});});
 assert.equal(await delivery.send('synthetic@example.invalid','x'.repeat(43),'synthetic'),'provider-synthetic');assert.equal(called,1);
 await assert.rejects(()=>new ResendInvitationDelivery({apiKey:'synthetic',from:'erp@example.invalid',claimUrl:'https://erp.example.invalid/claim'},async()=>new Response('{}',{status:500})).send('synthetic@example.invalid','x'.repeat(43),'synthetic'));
 assert.throws(()=>new ResendInvitationDelivery({apiKey:'',from:'erp@example.invalid',claimUrl:'https://erp.example.invalid/claim'}));
 const queries:string[]=[];let sqlPayload:Record<string,unknown>|undefined,sqlContext:Record<string,unknown>|undefined;let identityBad=false,budgetExecutable=true,unexpectedDefiner=false,budgetAllowed=true,budgetCount=0,sqlCode='';
 const pool={connect:async()=>({release:()=>{queries.push('release');},query:async(sql:string,args?:unknown[])=>{queries.push(sql);if(sql.startsWith('SELECT current_database()'))return {rows:[{db:'real_capita_payroll_accept_'+'a'.repeat(32),role:'onboarding_fixture',login:'onboarding_fixture',database_owner:false,elevated:identityBad,memberships:false,owned:false,functions_owned:false,schema_create:false,temp:false,installed:true,executable:true,budget_executable:budgetExecutable,unexpected_definer:unexpectedDefiner,writable:false}]};if(sql==='SELECT onboarding_claim_budget() allowed'){budgetCount++;return {rows:[{allowed:budgetAllowed}]};}if(sql.startsWith('SELECT onboarding_command')){sqlPayload=JSON.parse(args![2] as string);sqlContext=JSON.parse(args![3] as string);if(sqlCode)throw Object.assign(new Error('private SQL details'),{code:sqlCode});return {rows:[{value:{invitationId:'synthetic',email:'synthetic@example.invalid'}}]};}return {rows:[]};}})};
 const executor=new OnboardingPrivateExecutor(pool,'real_capita_payroll_accept_'+'a'.repeat(32),'onboarding_fixture',verifier,delivery);
 await executor.execute({...claims,payload,proof:proof()});assert(queries.includes('COMMIT'));assert.equal(typeof sqlPayload?.tokenHash,'string');assert(!JSON.stringify(sqlPayload).includes('synthetic-key'));assert.equal(typeof sqlPayload?.passwordHash,'string');
 queries.length=0;await assert.rejects(()=>executor.execute({...claims,command:'ARBITRARY_SQL',payload,proof:proof()}));assert.equal(queries.length,0);
 identityBad=true;await assert.rejects(()=>executor.execute({...claims,payload,proof:proof()}));assert(!queries.includes('BEGIN ISOLATION LEVEL SERIALIZABLE'));identityBad=false;
 budgetExecutable=false;await assert.rejects(()=>executor.attest());budgetExecutable=true;unexpectedDefiner=true;await assert.rejects(()=>executor.attest());unexpectedDefiner=false;
 queries.length=0;const failing=new OnboardingPrivateExecutor(pool,'real_capita_payroll_accept_'+'a'.repeat(32),'onboarding_fixture',verifier,new ResendInvitationDelivery({apiKey:'synthetic',from:'erp@example.invalid',claimUrl:'https://erp.example.invalid/claim'},async()=>new Response('{}',{status:503})));
 await assert.rejects(()=>failing.execute({...claims,payload,proof:proof()}));assert(queries.includes('ROLLBACK'));assert(!queries.includes('COMMIT'));
 await assert.rejects(()=>executor.claim('invalid','not-a-real-password'));await assert.rejects(()=>executor.claim('x'.repeat(43),'é'.repeat(37)));
 queries.length=0;budgetAllowed=false;await assert.rejects(()=>executor.claim('x'.repeat(43),'synthetic-password-123'),error=>error instanceof PrivateOperationError&&error.status===429);assert.equal(budgetCount,1);assert(!queries.includes('BEGIN ISOLATION LEVEL SERIALIZABLE'));
 budgetAllowed=true;queries.length=0;sqlCode='42501';await assert.rejects(()=>executor.claim('x'.repeat(43),'synthetic-password-123'),error=>error instanceof PrivateOperationError&&error.status===403);assert.equal(budgetCount,2);assert(queries.indexOf('SELECT onboarding_claim_budget() allowed')<queries.indexOf('BEGIN ISOLATION LEVEL SERIALIZABLE'));assert(queries.includes('ROLLBACK'));assert.equal(sqlContext?.payloadHash,payloadHash(sqlPayload));assert.equal(sqlContext?.command,'CLAIM');assert.equal(sqlContext?.actorId,'');sqlCode='40001';
 await assert.rejects(()=>executor.execute({...claims,payload,proof:proof()}),error=>error instanceof PrivateOperationError&&error.status===409);sqlCode='';
 const offline={...claims,actorId:'',sessionId:'',tokenId:''};assert.throws(()=>verifier.verify({...offline,payload,proof:proof(offline)}));
 assert.equal(requiredAssurance('REPLACE_ACCOUNT'),'ACCOUNT_RECOVERY');assert.equal(requiredAssurance('AUTHORIZE_MD_RECOVERY'),'RECOVERY_AUTHORIZER');
 const mixedPayload={...payload,email:'  Synthetic@Example.Invalid '};const mixedClaims={...claims,payloadHash:payloadHash(mixedPayload)};await executor.execute({...mixedClaims,payload:mixedPayload,proof:proof(mixedClaims)});assert.equal(sqlPayload?.email,'synthetic@example.invalid');
 const replacementClaims={...claims,command:'REPLACE_ACCOUNT',assurance:'ACCOUNT_RECOVERY'};const replacementVerifier=new ProofVerifier({audience:'rc-private',issuers:{registrar:{publicKey,commands:{REPLACE_ACCOUNT:['ACCOUNT_RECOVERY']}}}},()=>now);const replacementExecutor=new OnboardingPrivateExecutor(pool,'real_capita_payroll_accept_'+'a'.repeat(32),'onboarding_fixture',replacementVerifier,delivery);await replacementExecutor.execute({...replacementClaims,payload,proof:proof(replacementClaims)});assert.equal(sqlContext?.command,'REPLACE_ACCOUNT');
 await verifyMtls(executor);
 console.log('PASS onboarding private crypto: exact command/actor/session/token/payload, issuer assurance, expiry/TTL; configured delivery and failure sanitization');
}
async function verifyMtls(executor:OnboardingPrivateExecutor){
 const directory=mkdtempSync(join(tmpdir(),'real-capita-onboarding-mtls-'));let broker:Awaited<ReturnType<typeof startOnboardingBroker>>|undefined;
 try{
  const ssl=(args:string[])=>execFileSync('openssl',args,{cwd:directory,stdio:'ignore'});
  writeFileSync(join(directory,'openssl.cnf'),'[req]\ndistinguished_name=dn\n[dn]\nCN=fixture\n');
  ssl(['req','-config','openssl.cnf','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.crt','-days','1','-subj','/CN=Synthetic Fixture CA','-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign']);
  for(const name of ['server','client','unapproved']){
   ssl(['req','-config','openssl.cnf','-newkey','rsa:2048','-nodes','-keyout',name+'.key','-out',name+'.csr','-subj','/CN='+name]);
   writeFileSync(join(directory,name+'.ext'),name==='server'?'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n':'extendedKeyUsage=clientAuth\n');
   ssl(['x509','-req','-in',name+'.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out',name+'.crt','-days','1','-extfile',name+'.ext']);
  }
  const read=(name:string)=>readFileSync(join(directory,name));
  const probe=createServer();await new Promise<void>(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=(probe.address() as {port:number}).port;await new Promise<void>(resolve=>probe.close(()=>resolve()));
  broker=await startOnboardingBroker(executor,{key:read('server.key'),cert:read('server.crt'),ca:read('ca.crt')},[new X509Certificate(read('client.crt')).fingerprint256],port);
  let lastBody='';const get=(identity:string|undefined,path='/readiness',method='GET')=>new Promise<number>((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path,method,ca:read('ca.crt'),...(identity?{key:read(identity+'.key'),cert:read(identity+'.crt')}:{}),rejectUnauthorized:true,minVersion:'TLSv1.3',agent:false,timeout:5000,headers:{'Content-Type':'application/json'}},res=>{let body='';res.on('data',(chunk:Buffer)=>body+=chunk.toString());res.once('end',()=>{lastBody=body;resolve(res.statusCode!);});});req.once('error',reject);req.once('timeout',()=>req.destroy(new Error('fixture timeout')));req.end(method==='POST'?'{}':undefined);});
  assert.equal(await get('client'),200);assert.deepEqual(JSON.parse(lastBody),{ready:false,providerReady:false,executorReady:true});assert.equal(await get('unapproved'),403);await assert.rejects(()=>get(undefined));assert.equal(await get('client','/commands','POST'),503);assert.equal(await get('client','/prepare','POST'),503);
  console.log('PASS actual loopback TLS1.3 mTLS broker: CA/pinned client, missing/unapproved certificate denial, readiness, unsigned command and absent collector denial');
 }finally{if(broker){broker.closeAllConnections();await new Promise<void>(resolve=>broker!.close(()=>resolve()));}rmSync(directory,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
