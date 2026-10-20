import {BadRequestException,ConflictException,ForbiddenException,ServiceUnavailableException} from '@nestjs/common';
type Connection={query:(sql:string,values?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>;release:()=>void};
// Private-broker building block ONLY. Not registered in the public API module.
// No environment fallback or maintenance credentials; the broker must separately
// authenticate the server-side actor envelope before calling this executor.
export class SqlAuthorityExecutor {
 constructor(private readonly pool:{connect:()=>Promise<Connection>},private readonly database:string,private readonly role:string){if(!/^(real_capita_accounts_salary_dev|real_capita_payroll_accept_[a-f0-9]{32})$/.test(database)||!/^[a-z_][a-z0-9_]*$/.test(role))throw new ServiceUnavailableException('PRIVATE_WRITER_TARGET_REJECTED');}
 async execute(actor:string,command:string,payload:Record<string,unknown>):Promise<Record<string,unknown>>{
  const db=await this.pool.connect();try{
   const identity=(await db.query("SELECT current_database() db,current_user role,session_user login,(SELECT datdba=current_user::regrole FROM pg_database WHERE datname=current_database()) database_owner,(SELECT rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls FROM pg_roles WHERE rolname=current_user) elevated,(SELECT count(*)::int FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user)) memberships,(SELECT count(*)::int FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) owned")).rows[0];
   if(this.database==='real_capita_accounts'||identity.db!==this.database||identity.role!==this.role||identity.login!==this.role||identity.elevated||identity.database_owner!==false||identity.memberships!==0||identity.owned!==0)throw new ServiceUnavailableException('PRIVATE_WRITER_IDENTITY_REJECTED');
   await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');await db.query("SET LOCAL TIME ZONE 'UTC'");
   const leaveStage=command==='LEAVE_HR'?'HR':command==='LEAVE_MD'?'MD':null;
   const result=leaveStage?await db.query('SELECT leave_stage_command($1,$2,$3::jsonb) value',[actor,leaveStage,JSON.stringify(payload)]):await db.query('SELECT authority_command($1,$2,$3::jsonb) value',[actor,command,JSON.stringify(payload)]);
   await db.query('COMMIT');return result.rows[0].value as Record<string,unknown>;
  }catch(error){await db.query('ROLLBACK').catch(()=>undefined);const code=(error as {code?:string}).code;if(['23505','40001','40P01'].includes(code??''))throw new ConflictException('Duplicate, stale or concurrently changed authority request.');if(code==='42501')throw new ForbiddenException('Authority, independent review or verified identity required.');if(['23514','22P02','23502','22023','22007','22008'].includes(code??''))throw new BadRequestException('Invalid authority state, scope, expiry or transition.');throw error;}finally{db.release();}
 }
}
