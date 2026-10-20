import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {ProofConfiguration,ProofVerifier} from './proof';
import {ResendInvitationDelivery} from './delivery';
import {Connection,OnboardingPrivateExecutor} from './executor';
import {startOnboardingBroker} from './broker';
import {IndependentEvidenceCollector} from './collector';
import {assertSafePrivateNodeEnvironment} from './runtime';
interface HostConfiguration {repository:string;apiSid:string;executorSid:string;databaseRole:string;port:number;audience:string;from:string;claimUrl:string;serverKeyFile:string;serverCertFile:string;clientCaFile:string;clientFingerprints:string[];proofIssuers:ProofConfiguration['issuers'];collector?:{endpoint:string;allowedOrigins:string[];keyFile:string;certFile:string;caFile:string};}
async function main(){
 if(process.platform!=='win32'||!process.env.PRIVATE_ONBOARDING_CONFIGURATION||!process.env.PRIVATE_ONBOARDING_SECRET)throw new Error();
 const config=JSON.parse(readFileSync(process.env.PRIVATE_ONBOARDING_CONFIGURATION,'utf8')) as HostConfiguration;
 assertSafePrivateNodeEnvironment(process.env);if(!process.env.SystemRoot)throw new Error();
 const sid=execFileSync(join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-Command','[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],{encoding:'utf8'}).trim();if(sid!==config.executorSid||sid===config.apiSid)throw new Error();
 const secret=JSON.parse(process.env.PRIVATE_ONBOARDING_SECRET) as {databaseUrl:string;resendApiKey:string};delete process.env.PRIVATE_ONBOARDING_SECRET;
 const url=new URL(secret.databaseUrl);if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='localhost'||url.port!=='55532'||url.pathname!=='/real_capita_accounts_salary_dev'||decodeURIComponent(url.username)!==config.databaseRole)throw new Error();
 const req=createRequire(resolve(config.repository,'package.json'));const {Pool}=createRequire(req.resolve('@prisma/adapter-pg'))('pg') as {Pool:new(options:object)=>{connect:()=>Promise<Connection>;end:()=>Promise<void>}};
 const pool=new Pool({connectionString:secret.databaseUrl,max:4,connectionTimeoutMillis:5000});
 const executor=new OnboardingPrivateExecutor(pool,'real_capita_accounts_salary_dev',config.databaseRole,new ProofVerifier({audience:config.audience,issuers:config.proofIssuers}),new ResendInvitationDelivery({apiKey:secret.resendApiKey,from:config.from,claimUrl:config.claimUrl}));
 const tls={key:readFileSync(config.serverKeyFile),cert:readFileSync(config.serverCertFile),ca:readFileSync(config.clientCaFile)};
 const c=config.collector;const collector=c?new IndependentEvidenceCollector(c.endpoint,config.audience,c.allowedOrigins,{key:readFileSync(c.keyFile),cert:readFileSync(c.certFile),ca:readFileSync(c.caFile)}):undefined;
 const server=await startOnboardingBroker(executor,tls,config.clientFingerprints,config.port,collector);
 const stop=()=>{server.close(()=>{void pool.end().finally(()=>process.exit(0));});};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 console.log('Private onboarding broker listening on loopback with mTLS; credentials and capabilities suppressed.');
}
main().catch(()=>{console.error('Private onboarding startup refused: identity, configuration, provider, schema or privilege gate failed.');process.exitCode=1;});
