import { createRequire } from 'node:module';import { resolve } from 'node:path';import { provisionDatabaseRoles } from './role-profile';
async function main(){
  if(!process.argv.includes('--apply')){console.log('Review-only: --apply requires separately authorized DATABASE_ADMIN_URL, DB_TARGET_NAME, DB_MIGRATION_ROLE, DB_RUNTIME_ROLE, DB_FINANCE_ROLE and private per-role secrets. No connection made.');return;}
  const env=process.env,value=env.DATABASE_ADMIN_URL;
  if(!value||!env.DB_TARGET_NAME||!env.DB_MIGRATION_ROLE||!env.DB_RUNTIME_ROLE||!env.DB_FINANCE_ROLE)throw Error('Missing explicit provisioning configuration');
  const url=new URL(value);if(decodeURIComponent(url.pathname.slice(1))!==env.DB_TARGET_NAME||env.DB_TARGET_NAME==='real_capita_accounts')throw Error('Provisioning target is missing, mismatched or protected');
  const req=createRequire(resolve('package.json')),{Client}=createRequire(req.resolve('@prisma/adapter-pg'))('pg'),admin=new Client({connectionString:value});
  try{await admin.connect();await provisionDatabaseRoles(admin,{database:env.DB_TARGET_NAME,migration:env.DB_MIGRATION_ROLE,runtime:env.DB_RUNTIME_ROLE,finance:env.DB_FINANCE_ROLE,executor:env.DB_CONFIRMATION_ROLE,passwords:{[env.DB_MIGRATION_ROLE]:env.DB_MIGRATION_SECRET??'',[env.DB_RUNTIME_ROLE]:env.DB_RUNTIME_SECRET??'',[env.DB_FINANCE_ROLE]:env.DB_FINANCE_SECRET??'',...(env.DB_CONFIRMATION_ROLE?{[env.DB_CONFIRMATION_ROLE]:env.DB_CONFIRMATION_SECRET??''}:{})}});console.log('PASS explicitly authorized database role/ACL profile provisioned; passwords were not printed or rotated');}finally{await admin.end();}
}
main().catch(()=>{console.error('Provisioning refused/failed; target, role, ownership or privilege assertions require review (connection secrets suppressed)');process.exitCode=1;});
