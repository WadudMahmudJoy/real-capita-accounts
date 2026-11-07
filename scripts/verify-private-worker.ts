import assert from 'node:assert/strict';
import { execFileSync,spawnSync } from 'node:child_process';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runtimeDatabaseUrl } from '../apps/api/src/prisma/database-security';
const ps=(args: string[])=>spawnSync('powershell.exe',['-NoProfile','-NonInteractive',...args],{encoding:'utf8'});
for(const path of ['scripts/db/private-worker.ps1','scripts/db/register-private-worker.ps1']){
  const r=ps(['-Command',`$e=$null;$t=$null;[Management.Automation.Language.Parser]::ParseFile('${resolve(path).replace(/'/g,"''")}',[ref]$t,[ref]$e)|Out-Null;if($e.Count){exit 1}`]);assert.equal(r.status,0);
}
const temp=mkdtempSync(join(tmpdir(),'rc-worker-negative-'));
try{
  const sid=execFileSync('powershell.exe',['-NoProfile','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8'}).trim();
  const base={purpose:'confirmation',apiSid:sid,provisioningSid:'S-1-5-21-1-2-3-9001',confirmationSid:'S-1-5-21-1-2-3-9002',repository:resolve('.'),credentialFile:join(temp,'absent.clixml'),databaseRole:'rc_test_confirm',database:'real_capita_accounts_salary_dev',hostName:'localhost',port:55532};
  for(const input of [base,{...base,confirmationSid:sid},{...base,apiSid:base.provisioningSid,confirmationSid:sid,credentialFile:resolve('forbidden.clixml')}]){
    const config=join(temp,'config.json');writeFileSync(config,JSON.stringify(input));
    const result=ps(['-File',resolve('scripts/db/private-worker.ps1'),'-Configuration',config,'-AttestOnly']);assert.equal(result.status,1);assert(!result.stdout.includes('PASS'));assert(!result.stderr.includes('postgresql://'));
  }
  for(const key of ['CONFIRMATION_DATABASE_URL','PRIVATE_WORKER_DATABASE_URL','PRIVATE_WORKER_CREDENTIAL_FILE','DB_CONFIRMATION_SECRET','DB_FINANCE_SECRET','DB_MIGRATION_SECRET'])assert.throws(()=>runtimeDatabaseUrl({RUNTIME_DATABASE_URL:'postgresql://runtime@localhost/test',RUNTIME_DATABASE_NAME:'test',[key]:'forbidden'}));
  console.log('PASS Windows PowerShell parser checks, three wrong-identity/shared-identity/repository-secret refusals and six API private-credential refusals; no database/OS provisioning');
}finally{rmSync(temp,{recursive:true,force:true});}
