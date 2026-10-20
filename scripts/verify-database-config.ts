import assert from 'node:assert/strict';import { runtimeDatabaseUrl,assertRuntimeDatabase } from '../apps/api/src/prisma/database-security';
async function main(){
 const url='postgresql://runtime:synthetic@localhost:1/isolated',base={RUNTIME_DATABASE_URL:url,RUNTIME_DATABASE_NAME:'isolated'};
 assert.equal(runtimeDatabaseUrl(base),url);
 for(const env of [{},{DATABASE_URL:url},{...base,DATABASE_URL:url},{...base,MIGRATION_DATABASE_URL:url},{...base,MIGRATION_SHADOW_DATABASE_URL:url},{...base,FINANCE_PROVISIONING_DATABASE_URL:url},{...base,DATABASE_ADMIN_URL:url},{...base,RUNTIME_DATABASE_NAME:'wrong'}])assert.throws(()=>runtimeDatabaseUrl(env));
 const safe={db:'isolated',rolsuper:false,rolcreaterole:false,rolcreatedb:false,rolbypassrls:false,rolreplication:false,member:false,db_owner:false,object_owner:false,schema_create:false,function_escalation:false,authority_writer:false};
 await assertRuntimeDatabase(async()=>[safe],'isolated');
 for(const key of Object.keys(safe).filter(k=>k!=='db'))await assert.rejects(()=>assertRuntimeDatabase(async()=>[{...safe,[key]:true}],'isolated'));
 await assert.rejects(()=>assertRuntimeDatabase(async()=>[{...safe,db:'wrong'}],'isolated'));
 console.log('PASS 22 offline configuration/role-attestation assertions; no database connection');
}
main().catch(()=>{console.error('FAIL database configuration assertions');process.exitCode=1;});
