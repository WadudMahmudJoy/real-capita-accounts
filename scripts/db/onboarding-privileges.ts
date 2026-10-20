// Reviewed additive profile only. Never invoked against salary-dev by Sprint 7F.
import assert from 'node:assert/strict';
export const onboardingTables=['onboarding_identities','onboarding_invitations','onboarding_authorizations','onboarding_events','onboarding_nonces','onboarding_rates'];
export async function onboardingReadPrivileges(db:any,runtime:string){
 assert(/^[a-z_][a-z0-9_]*$/.test(runtime));
 if(!(await db.query("SELECT to_regclass('public.onboarding_identities') present")).rows[0].present)return;
 await db.query(`GRANT SELECT ON onboarding_identities,onboarding_authorizations,onboarding_events TO "${runtime}"`);
 await db.query(`GRANT SELECT (id,"userId",email,status,"createdById","createdAt","expiresAt","consumedAt","cancelledAt") ON onboarding_invitations TO "${runtime}"`);
 for(const t of onboardingTables)assert.equal((await db.query("SELECT has_table_privilege($1,$2,'INSERT,UPDATE,DELETE,TRUNCATE') allowed",[runtime,t])).rows[0].allowed,false);
 assert.equal((await db.query("SELECT has_function_privilege($1,'onboarding_command(text,text,jsonb,jsonb)','EXECUTE') allowed",[runtime])).rows[0].allowed,false);
}
export async function onboardingPrivatePrivileges(db:any,writer:string){
 assert(/^[a-z_][a-z0-9_]*$/.test(writer));
 const role=(await db.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=$1',[writer])).rows[0];assert(role&&Object.values(role).every(v=>v===false));
 assert.equal((await db.query('SELECT count(*)::int n FROM pg_auth_members WHERE member=$1::regrole',[writer])).rows[0].n,0);
 await db.query(`GRANT USAGE ON SCHEMA public TO "${writer}"`);
 await db.query(`GRANT EXECUTE ON FUNCTION onboarding_command(text,text,jsonb,jsonb),onboarding_claim_budget() TO "${writer}"`);
 for(const t of [...onboardingTables,'users','roles','user_permissions','user_roles','employee_account_bindings'])assert.equal((await db.query("SELECT has_table_privilege($1,$2,'INSERT,UPDATE,DELETE,TRUNCATE') allowed",[writer,t])).rows[0].allowed,false);
}
