import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const req=createRequire(resolve('package.json'));
try {
const action=process.argv[2];
if(!['dev','deploy','status'].includes(action)||!process.env.MIGRATION_DATABASE_URL)throw new Error('Explicit MIGRATION_DATABASE_URL and an authorized migration action are required. No runtime/legacy fallback.');
const u=new URL(process.env.MIGRATION_DATABASE_URL);
if(!['postgres:','postgresql:'].includes(u.protocol)||!u.pathname.slice(1))throw new Error('Invalid migration target.');
if(action==='dev') {
  const value=process.env.MIGRATION_SHADOW_DATABASE_URL;
  if(!value)throw new Error('Restricted migrate dev requires an explicitly provisioned isolated MIGRATION_SHADOW_DATABASE_URL; no automatic shadow creation.');
  const shadow=new URL(value);
  if(!/^real_capita_shadow_[a-f0-9]{16,32}$/.test(decodeURIComponent(shadow.pathname.slice(1))) || (shadow.host===u.host&&shadow.pathname===u.pathname))throw new Error('Shadow database must be separately authorized, isolated and distinct from application data.');
}
// CLI-only; API startup never calls this. Secrets stay in environment/memory.
execFileSync(process.execPath,[req.resolve('prisma/build/index.js'),'migrate',action,...process.argv.slice(3)],{stdio:'inherit',env:{...process.env,DATABASE_URL:undefined}});

} catch {
  console.error("Authorized migration CLI refused/failed; verify private credentials, target and shadow configuration. Connection secrets suppressed.");
  process.exitCode=1;
}
