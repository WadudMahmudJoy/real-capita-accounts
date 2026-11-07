// Disposable PostgreSQL fixture only; every provider request is intercepted in memory.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {OnboardingPrivateExecutor} from '../apps/api/src/onboarding/private/executor';
import {ResendInvitationDelivery} from '../apps/api/src/onboarding/private/delivery';
export async function verifyOnboardingDelivery(c:any){
 const {db,owner,pool,database,writer,verifier,envelope,md,exec,base,gateway}=c;
 let checks=0,calls=0,committed=false,released=false,mode='accepted',lastCapability='',lastId='';
 const capabilities:string[]=[],requestKeys:string[]=[];
 const ok=(value:unknown,label:string)=>{assert(value,label);checks++;};
 const delivery=new ResendInvitationDelivery({apiKey:'synthetic-key',from:'fixture@example.invalid',claimUrl:'https://claims.example.invalid/claim'},async(_url,init)=>{
  ok(committed&&released,'Provider runs after successful COMMIT and connection release');calls++;
  const body=JSON.parse(init!.body as string);lastCapability=String(body.text).match(/#capability=([A-Za-z0-9_-]{43})/)![1];capabilities.push(lastCapability);
  const key=(init!.headers as Record<string,string>)['Idempotency-Key'];ok(key.startsWith('invitation-'),'Stable per-invitation idempotency');requestKeys.push(key);lastId=key.slice('invitation-'.length);
  if(mode==='timeout')throw new Error(lastCapability+' synthetic response lost after provider acceptance');
  return new Response(JSON.stringify({id:'synthetic-provider-id'}),{status:mode==='500'?500:200});
 });
 let crashAfterCommit=false;
 const instrumented={connect:async()=>{const client=await pool.connect();let invitationTransaction=false;return {
  query:async(sql:string,args?:unknown[])=>{if(sql.startsWith('BEGIN')){committed=false;released=false;invitationTransaction=true;}const result=await client.query(sql,args);if(sql==='COMMIT')committed=true;return result;},
  release:()=>{client.release();if(invitationTransaction){released=true;if(crashAfterCommit&&committed)throw new Error('synthetic process stop before delivery');}}
 };}};
 const executor=new OnboardingPrivateExecutor(instrumented,database,writer,verifier,delivery);
 const payload=(suffix:string)=>({email:'delivery-'+suffix+'@example.invalid',name:'Synthetic Delivery Recovery',reason:'Isolated authorized delivery regression'});
 const invite=(suffix:string)=>executor.execute(envelope(md.session,'INVITE',payload(suffix)));
 const cancel=(id:unknown)=>exec(md.session,'CANCEL',{invitationId:id});
 const claim=(cap:string)=>executor.claim(cap,randomBytes(24).toString('base64url'));
 const issued=async(email:string)=>owner.onboardingInvitation.findFirstOrThrow({where:{email,status:'ISSUED'}});
 // A real deferred PostgreSQL error occurs at COMMIT, after command SQL returns.
 await db.query(`CREATE FUNCTION delivery_commit_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.email='delivery-commit@example.invalid' THEN RAISE EXCEPTION 'synthetic deferred commit failure';END IF;RETURN NEW;END $$`);
 await db.query('CREATE CONSTRAINT TRIGGER delivery_commit_fixture AFTER INSERT ON onboarding_invitations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION delivery_commit_fixture()');
 try{const before=calls,events=await owner.onboardingEvent.count();await assert.rejects(()=>invite('commit'));ok(calls===before,'Failed COMMIT prevents external delivery');ok(await owner.user.count({where:{email:payload('commit').email}})===0,'Failed COMMIT rolls back invitation and account');ok(await owner.onboardingEvent.count()===events,'Failed COMMIT leaves no INVITE or delivery event');}finally{await db.query('DROP TRIGGER delivery_commit_fixture ON onboarding_invitations');await db.query('DROP FUNCTION delivery_commit_fixture()');}
 for(const outcome of ['500','timeout']){
  mode=outcome;const result=await invite(outcome),cap=lastCapability;
  ok(!JSON.stringify(result).includes(cap),'Provider capability/error details never reach response');
  ok(result.status==='ISSUED'&&result.deliveryStatus==='UNKNOWN'&&result.deliveryRecorded,'Provider error returns durable issued/unknown, never delivered');
  ok((await issued(payload(outcome).email)).id===result.invitationId,'Unknown delivery remains durable and claimable');
  const attempts=calls;await assert.rejects(()=>invite(outcome));ok(calls===attempts,'Repeat unknown INVITE cannot send or supersede');
  if(outcome==='timeout'){await claim(cap);ok(!(await owner.user.findUniqueOrThrow({where:{id:String(result.userId)}})).isActive,'Lost response link claim never activates');}
  else{await cancel(result.invitationId);await assert.rejects(()=>claim(cap));ok(true,'Explicit cancellation invalidates old capability');mode='accepted';const reissued=await invite(outcome);ok(lastCapability!==cap&&reissued.invitationId!==result.invitationId,'Explicit reissue creates a new capability and provider key');await assert.rejects(()=>claim(cap));await claim(lastCapability);ok(true,'Cancelled capability rejected and replacement accepted');}
 }
 mode='accepted';
 await db.query(`CREATE FUNCTION delivery_record_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='DELIVERY_ACCEPTED' THEN RAISE EXCEPTION 'synthetic delivery bookkeeping failure';END IF;RETURN NEW;END $$`);
 await db.query('CREATE TRIGGER delivery_record_fixture BEFORE INSERT ON onboarding_events FOR EACH ROW EXECUTE FUNCTION delivery_record_fixture()');
 try{const result=await invite('bookkeeping'),cap=lastCapability;ok(result.deliveryStatus==='ACCEPTED'&&!result.deliveryRecorded,'Accepted email with failed bookkeeping is classified honestly');ok(await owner.onboardingEvent.count({where:{recordId:String(result.invitationId),action:'INVITE'}})===1,'Durable INVITE anchors reconciliation');ok(await owner.onboardingEvent.count({where:{recordId:String(result.invitationId),action:'DELIVERY_ACCEPTED'}})===0,'Failed bookkeeping fabricates no delivery event');await claim(cap);ok(!(await owner.user.findUniqueOrThrow({where:{id:String(result.userId)}})).isActive,'Claim survives delivery recording failure without activation');}finally{await db.query('DROP TRIGGER delivery_record_fixture ON onboarding_events');await db.query('DROP FUNCTION delivery_record_fixture()');}
 crashAfterCommit=true;const beforeCrash=calls;try{await assert.rejects(()=>invite('crash'));}finally{crashAfterCommit=false;}
 const stale=await issued(payload('crash').email);ok(calls===beforeCrash,'Process stop after release attempts no provider request');ok(await owner.onboardingEvent.count({where:{recordId:stale.id,action:{startsWith:'DELIVERY_'}}})===0,'Stale issued invitation has no fabricated outcome');await assert.rejects(()=>invite('crash'));await cancel(stale.id);const recovered=await invite('crash');ok(recovered.invitationId!==stale.id,'Stale issued recovery requires explicit cancellation and new issuance');await claim(lastCapability);
 const beforeRace=calls;const race=await Promise.allSettled([invite('race'),invite('race')]);ok(race.filter(r=>r.status==='fulfilled').length===1&&calls===beforeRace+1,'Concurrent distinct INVITE proofs create/send exactly one invitation');const live=await issued(payload('race').email);ok(live.id===lastId,'Provider key refers to committed winning invitation');const raceCap=lastCapability;
 await assert.rejects(()=>owner.onboardingInvitation.create({data:{userId:live.userId,email:live.email,tokenHash:createHash('sha256').update(randomBytes(32)).digest('hex'),expiresAt:new Date(Date.now()+60000)}}));ok(true,'Partial unique index independently blocks second active invitation');
 await assert.rejects(()=>owner.onboardingInvitation.create({data:{userId:stale.userId,email:stale.email,tokenHash:live.tokenHash,expiresAt:new Date(Date.now()+60000)}}));ok(true,'Unique token hash independently enforced');
 await cancel(live.id);await assert.rejects(()=>claim(raceCap));const reissue=await invite('race');ok(reissue.invitationId!==live.id&&lastCapability!==raceCap,'Audited authorized reissue has new identity and capability');
 ok(await owner.onboardingEvent.count({where:{recordId:live.id,action:'CANCEL'}})===1,'Explicit cancellation is audited');ok(await owner.onboardingEvent.count({where:{recordId:String(reissue.invitationId),action:'INVITE'}})===1,'Reissue is audited');
 const originalSend=gateway.send;gateway.send=async(path:string,e:any)=>{assert.equal(path,'/commands');return executor.execute(e);};
 try{for(const outcome of ['500','accepted']){
  mode=outcome;const signed=envelope(md.session,'INVITE',payload('http-'+outcome));
  const response=await fetch(base+'/onboarding/commands',{method:'POST',headers:{Cookie:md.session.cookie,Origin:process.env.APP_ORIGIN!,'Content-Type':'application/json'},body:JSON.stringify({command:signed.command,payload:signed.payload,proof:signed.proof})});
  ok(response.status===201,'Authenticated invitation HTTP request succeeds as issued');const result=await response.json();
  ok(result.status==='ISSUED'&&result.deliveryStatus===(outcome==='500'?'UNKNOWN':'ACCEPTED')&&result.deliveryRecorded,'API preserves delivery classification');
  ok(!JSON.stringify(result).includes(lastCapability)&&!('email' in result),'Gateway exposes no capability or internal routing fields');
  if(outcome==='500')ok(result.recovery==='RECONCILE_OR_EXPLICIT_CANCEL_AND_REISSUE','HTTP unknown explicitly requests controlled recovery');
 }}finally{gateway.send=originalSend;}
 const snapshot=(await db.query(`SELECT jsonb_build_object('invitations',(SELECT jsonb_agg(v) FROM onboarding_invitations v),'events',(SELECT jsonb_agg(e) FROM onboarding_events e),'audit',(SELECT jsonb_agg(a) FROM audit_events a),'nonces',(SELECT jsonb_agg(n) FROM onboarding_nonces n),'users',(SELECT jsonb_agg(u) FROM users u))::text value`)).rows[0].value;
 for(const cap of capabilities)ok(!snapshot.includes(cap),'No plaintext capability persisted in database or audit');
 ok(new Set(requestKeys).size===requestKeys.length,'Each authorized issuance uses its own stable provider key');
 console.log(`PASS ${checks} PostgreSQL delivery recovery assertions: deferred COMMIT failure, provider 500/lost response, bookkeeping failure, stale issuance, explicit cancellation/reissue, concurrent uniqueness and hash-only persistence`);
 return checks;
}
