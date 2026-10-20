import {createHash,randomBytes} from 'node:crypto';
import {hash} from 'bcryptjs';
import {CommandEnvelope,ProofVerifier,payloadHash} from './proof';
import {ResendInvitationDelivery} from './delivery';
export type Connection={query:(sql:string,values?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>;release:()=>void};
const COMMANDS=new Set(['INVITE','VERIFY_IDENTITY','AUTHORIZE_INITIAL_MD','AUTHORIZE_MD_RECOVERY','ATTEST_MD','ACTIVATE_MD','REQUEST_SPECIALIZED','DECIDE_SPECIALIZED','REVOKE_SPECIALIZED','SUSPEND','CANCEL','REVOKE_MD','REPLACE_ACCOUNT','AUTHORITY_REQUEST','AUTHORITY_APPROVE','AUTHORITY_REJECT','AUTHORITY_CANCEL','AUTHORITY_EXPIRE','LEAVE_HR','LEAVE_MD']);
export class PrivateOperationError extends Error {constructor(public readonly status:number,message:string){super(message);}}
export class OnboardingPrivateExecutor {
 private claimWindow={startedAt:0,count:0};
 constructor(private readonly pool:{connect:()=>Promise<Connection>},private readonly database:string,private readonly role:string,private readonly verifier:ProofVerifier,private readonly delivery:ResendInvitationDelivery){if(!/^(real_capita_accounts_salary_dev|real_capita_payroll_accept_[a-f0-9]{32})$/.test(database)||!/^[a-z_][a-z0-9_]{2,62}$/.test(role))throw new Error('PRIVATE_TARGET_REJECTED');}
 async attest():Promise<void>{const db=await this.pool.connect();try{await this.identity(db);}finally{db.release();}}
 private async identity(db:Connection){
  const i=(await db.query(`SELECT current_database() db,current_user role,session_user login,
   (SELECT datdba=current_user::regrole FROM pg_database WHERE datname=current_database()) database_owner,
   (SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication FROM pg_roles WHERE rolname=current_user) elevated,
   EXISTS(SELECT 1 FROM pg_auth_members WHERE member=current_user::regrole) memberships,
   EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=current_user::regrole) owned,
   EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proowner=current_user::regrole) functions_owned,
   has_schema_privilege(current_user,'public','CREATE') schema_create,has_database_privilege(current_database(),'TEMP') temp,
   to_regprocedure('public.onboarding_command(text,text,jsonb,jsonb)') IS NOT NULL installed,
   has_function_privilege(current_user,'public.onboarding_command(text,text,jsonb,jsonb)','EXECUTE') executable,
   has_function_privilege(current_user,'public.onboarding_claim_budget()','EXECUTE') budget_executable,
   EXISTS(SELECT 1 FROM pg_proc p WHERE p.prosecdef AND has_function_privilege(current_user,p.oid,'EXECUTE') AND p.oid NOT IN ('public.onboarding_command(text,text,jsonb,jsonb)'::regprocedure,'public.onboarding_claim_budget()'::regprocedure)) unexpected_definer,
   EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (has_table_privilege(c.oid,'INSERT,UPDATE,DELETE,TRUNCATE'))) writable`)).rows[0];
  if(i.db!==this.database||i.role!==this.role||i.login!==this.role||i.database_owner!==false||i.elevated!==false||i.memberships!==false||i.owned!==false||i.functions_owned!==false||i.schema_create!==false||i.temp!==false||i.installed!==true||i.executable!==true||i.budget_executable!==true||i.unexpected_definer!==false||i.writable!==false)throw new Error('PRIVATE_IDENTITY_OR_PRIVILEGES_REJECTED');
 }
 async execute(envelope:CommandEnvelope){if(!COMMANDS.has(envelope.command))throw new Error('PRIVATE_COMMAND_REJECTED');const context=this.verifier.verify(envelope);let payload={...envelope.payload};let capability:string|undefined;
  if(envelope.command==='INVITE'){if(typeof payload.email!=='string')throw new PrivateOperationError(400,'INVITATION_EMAIL_INVALID');capability=randomBytes(32).toString('base64url');payload={...payload,email:payload.email.trim().toLowerCase(),tokenHash:createHash('sha256').update(capability).digest('hex'),passwordHash:await hash(randomBytes(48).toString('base64url'),12),expiresAt:new Date(Date.now()+15*60000).toISOString()};}
  return this.transaction(envelope.actorId,envelope.command,payload,context,capability);
 }
 async claim(capability:unknown,password:unknown){if(typeof capability!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(capability)||typeof password!=='string'||password.length<14||Buffer.byteLength(password)>72)throw new PrivateOperationError(400,'CLAIM_INVALID');
  const now=Date.now();if(now-this.claimWindow.startedAt>=60000)this.claimWindow={startedAt:now,count:0};if(++this.claimWindow.count>20)throw new Error('CLAIM_RATE_LIMITED');
  const payload={tokenHash:createHash('sha256').update(capability).digest('hex'),passwordHash:await hash(password,12)};
  return this.transaction('','CLAIM',payload,{actorId:'',sessionId:'',tokenId:'',command:'CLAIM',payloadHash:payloadHash(payload),nonce:randomBytes(32).toString('base64url'),assurance:'EMAIL_CAPABILITY',issuedAt:Date.now(),expiresAt:Date.now()+120000});}
 private async transaction(actor:string,command:string,payload:Record<string,unknown>,context:object,capability?:string){const db=await this.pool.connect();let begun=false;try{await this.identity(db);
  // Separate autocommit write: an invalid capability must not roll back the durable abuse budget.
  if(command==='CLAIM'&&(await db.query('SELECT onboarding_claim_budget() allowed')).rows[0]?.allowed!==true)throw new PrivateOperationError(429,'CLAIM_RATE_LIMITED');
  await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');begun=true;await db.query("SET LOCAL TIME ZONE 'UTC'");await db.query("SET LOCAL statement_timeout='15s'");const result=(await db.query('SELECT onboarding_command($1,$2,$3::jsonb,$4::jsonb) value',[actor,command,JSON.stringify(payload),JSON.stringify(context)])).rows[0].value as Record<string,unknown>;if(command==='INVITE'){if(typeof result.invitationId!=='string'||typeof result.email!=='string'||!capability)throw new Error('INVITATION_RESULT_INVALID');await this.delivery.send(result.email,capability,result.invitationId);}await db.query('COMMIT');return result;}catch(error){if(begun)await db.query('ROLLBACK').catch(()=>undefined);if(error instanceof PrivateOperationError)throw error;const code=(error as {code?:unknown}).code;if(code==='42501')throw new PrivateOperationError(403,'PRIVATE_AUTHORITY_DENIED');if(['23505','40001','40P01'].includes(String(code)))throw new PrivateOperationError(409,'PRIVATE_CONCURRENT_OR_STALE');if(['23514','22P02','23502','22023','22007','22008'].includes(String(code)))throw new PrivateOperationError(400,'PRIVATE_STATE_INVALID');throw new PrivateOperationError(503,'PRIVATE_COMMAND_UNAVAILABLE_OR_DENIED');}finally{db.release();}}
}
