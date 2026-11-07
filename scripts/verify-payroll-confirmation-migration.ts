import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temp=mkdtempSync(join(tmpdir(),'confirmation-contract-'));
try{
  const schema=readFileSync('prisma/schema.prisma','utf8');
  const before=schema.replace(/^model PayrollCashAcknowledgment \{[\s\S]*?^\}\r?\n/m,'').replace(/^.*cashAcknowledgment.*\r?\n/gm,'').replace(/^.*@@unique\(\[verificationAuthority, evidenceKind, evidenceReference\]\).*\r?\n/gm,'');
  writeFileSync(join(temp,'before.prisma'),before);
  const generated=execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','diff','--from-schema',join(temp,'before.prisma'),'--to-schema','prisma/schema.prisma','--script'],{encoding:'utf8'});
  const sql=readFileSync('prisma/migrations/20261015000000_payroll_confirmation_evidence/migration.sql','utf8');
  const normalize=(s: string)=>s.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();
  assert.equal(normalize(sql.split('-- BEGIN CONFIRMATION INTEGRITY')[0].replace(/-- BEGIN CONFIRMATION PREFLIGHT[\s\S]*?-- END CONFIRMATION PREFLIGHT/,'')),normalize(generated));
  for(const check of ['Serializable transaction required','clock_timestamp()','DEFERRABLE INITIALLY DEFERRED',"r.state<>'HELD'",'REVOKE ALL ON FUNCTION','SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp'])assert(sql.includes(check));
  const digest="encode(sha256(convert_to(proof::text,'UTF8')),'hex')";
  assert(sql.includes(digest));assert(sql.includes('Canonical UTC evidence timestamps required'));
  assert(!sql.includes("proof->>'authorityRecordId',digest,"));
  console.log('PASS additive confirmation schema parity and bounded SQL integrity contracts; no database connection');
}finally{rmSync(temp,{recursive:true,force:true});}
