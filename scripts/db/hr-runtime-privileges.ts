// Reviewed HR-only subset of role-profile.ts. Never changes identities or finance ACLs.
import assert from 'node:assert/strict';
export const hrTables=['leave_categories','leave_requests','leave_request_events','user_permissions','employee_account_bindings','user_admin_events'];
export async function applyHrRuntimePrivileges(db:any,runtime:string,owner:string){
 assert(/^[a-z_][a-z0-9_]+$/.test(runtime)&&/^[a-z_][a-z0-9_]+$/.test(owner));
 const role=(await db.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolreplication FROM pg_roles WHERE rolname=$1',[runtime])).rows[0];assert(role&&Object.values(role).every(v=>v===false));
 assert.equal((await db.query('SELECT count(*)::int AS n FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=$1)',[runtime])).rows[0].n,0);
 const tables=(await db.query("SELECT relname,pg_get_userbyid(relowner) AS owner FROM pg_class WHERE relnamespace='public'::regnamespace AND relname=ANY($1::text[])",[hrTables])).rows;assert.equal(tables.length,6);assert(tables.every((t:any)=>t.owner===owner));
 await db.query('BEGIN');try{
  await db.query(`REVOKE ALL ON ${hrTables.map(t=>'public.'+t).join(',')} FROM PUBLIC`);
  await db.query(`GRANT SELECT,INSERT ON ${hrTables.map(t=>'public.'+t).join(',')} TO "${runtime}"`);
  await db.query(`GRANT INSERT ON users,user_roles TO "${runtime}"`);
  await db.query(`GRANT DELETE ON user_roles TO "${runtime}"`);
  await db.query(`GRANT UPDATE (email,"fullName","isActive","adminVersion") ON users TO "${runtime}"`);
  await db.query(`GRANT UPDATE (status,version,"withdrawnById","withdrawnAt","reviewedById","reviewedAt","decisionReason","reviewAuthoritySnapshot") ON leave_requests TO "${runtime}"`);
  await db.query(`GRANT UPDATE ("revokedAt","revokedById") ON user_permissions TO "${runtime}"`);
  await db.query(`GRANT UPDATE ("unboundAt","unboundById") ON employee_account_bindings TO "${runtime}"`);
  await db.query(`GRANT UPDATE (code,name,description,"isActive",version) ON leave_categories TO "${runtime}"`);
  // New CUID models have no sequences. Existing sequence/function/schema ACLs stay intact.
  assert.equal((await db.query("SELECT has_column_privilege($1,'users','passwordHash','UPDATE') AS allowed",[runtime])).rows[0].allowed,false);
  for(const table of hrTables)for(const permission of ['DELETE','TRUNCATE','TRIGGER','REFERENCES'])assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[runtime,table,permission])).rows[0].allowed,false);
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}
}
