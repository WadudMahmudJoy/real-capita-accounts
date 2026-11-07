// Source-only provisioning contract. Never invoked against salary-dev in Sprint 7B.
import assert from 'node:assert/strict';
export async function authorityReadPrivileges(db:any,runtime:string){
 assert(/^[a-z_][a-z0-9_]*$/.test(runtime));
 if(!(await db.query("SELECT to_regclass('public.authority_mandates') present")).rows[0].present)return;
 await db.query(`GRANT SELECT ON authority_mandates,authority_role_grants,authority_requests,authority_events TO "${runtime}"`);
 await db.query(`GRANT EXECUTE ON FUNCTION authority_effective(text),authority_live_mandate(authority_mandates) TO "${runtime}"`);
 if((await db.query("SELECT to_regclass('public.leave_workflows') present")).rows[0].present){await db.query(`GRANT SELECT ON leave_workflows,leave_stage_decisions TO "${runtime}"`);assert.equal((await db.query("SELECT has_function_privilege($1,'leave_stage_command(text,text,jsonb)','EXECUTE') allowed",[runtime])).rows[0].allowed,false);}
 assert.equal((await db.query("SELECT has_function_privilege($1,'authority_command(text,text,jsonb)','EXECUTE') allowed",[runtime])).rows[0].allowed,false);
}
export async function authorityPrivateWriterPrivileges(db:any,writer:string){
 assert(/^[a-z_][a-z0-9_]*$/.test(writer));
 const role=(await db.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=$1',[writer])).rows[0];
 assert(role&&Object.values(role).every(v=>v===false));
 assert.equal((await db.query('SELECT count(*)::int n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)',[writer])).rows[0].n,0);
 await db.query(`GRANT USAGE ON SCHEMA public TO "${writer}"`);
 await db.query(`GRANT EXECUTE ON FUNCTION authority_command(text,text,jsonb) TO "${writer}"`);
 if((await db.query("SELECT to_regprocedure('public.leave_stage_command(text,text,jsonb)') present")).rows[0].present)await db.query(`GRANT EXECUTE ON FUNCTION leave_stage_command(text,text,jsonb) TO "${writer}"`);
 for(const table of ['users','roles','authority_bootstraps','authority_mandates','authority_role_grants','authority_events'])assert.equal((await db.query('SELECT has_table_privilege($1,$2,\'INSERT\') OR has_table_privilege($1,$2,\'UPDATE\') allowed',[writer,table])).rows[0].allowed,false);
}
