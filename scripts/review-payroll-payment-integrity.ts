// Offline SQL contract and isolated PostgreSQL catalog review; no external proof
// is inferred from persisted metadata. Mutations test meaningful expressions.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
export function reviewPaymentIntegrity(sql: string, testMutations = true) {
  const bodies = new Map([...sql.matchAll(/CREATE FUNCTION (\w+)\([^)]*\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)].map(m => [m[1], m[2]]));
  const body = (n: string) => { const b = bodies.get(n); assert(b, n); return b; };
  assert.equal((sql.match(/DECIMAL\(18,2\)/g) ?? []).length, 2);
  for (const expression of ['NEW.amount<>expected','FOR UPDATE','FOR SHARE',"clock_timestamp() AT TIME ZONE 'UTC'",'g."sourceSnapshot"=snap','newer.generation>g.generation',"a.kind='REVOKE'",'NEW."reviewedById"=a."initiatedById"',"OLD.state<>'CONSUMED'","OLD.state='RELEASED'", "b.status='CANCELLED'",'NEW.version=OLD.version+1','BEFORE TRUNCATE','DEFERRABLE INITIALLY DEFERRED']) assert(sql.includes(expression), expression);
  assert(!/clock_timestamp\(\)::timestamp/.test(sql));
  for (const expression of ['NEW."reviewedAt"<a."createdAt"','NEW."reviewedAt"<q."createdAt"','NEW."confirmedAt"<b."createdAt"','NEW."authorizedAt"<NEW."requestedAt"',"payroll_finance_delegate_revocations",'NEW."initiatedById"=NEW."reviewedById"']) assert(sql.includes(expression),expression);
  assert(!body('payroll_payment_grant_valid').includes('CURRENT_TIMESTAMP'));
  assert(body('payroll_payment_line_guard').includes('FOR UPDATE'));
  assert(body('payroll_payment_totals_guard').includes('total IS DISTINCT FROM b."totalAmount"'));
  assert(sql.includes('ON "payroll_payment_reservations"("payrollRunLineId", "channel")'));
  assert(sql.includes('ON "payroll_source_authorizations"("companyId", "sourceAccountId", "channel", "generation")'));
  for (const [old, weakened] of [['NEW.amount<>expected','NEW.amount>expected'],["OLD.state<>'CONSUMED'","TRUE"],['newer.generation>g.generation','FALSE'],['g."sourceSnapshot"=snap','TRUE']]) {
    if (testMutations) assert.throws(() => reviewPaymentIntegrity(sql.replace(old, weakened), false), () => true, old);
  }
  return bodies;
}
export async function reviewPaymentDatabase(db: any, sql: string) {
  const bodies = reviewPaymentIntegrity(sql);
  const functions = await db.$queryRawUnsafe(`SELECT proname,prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname LIKE 'payroll_payment_%'`);
  const normalize = (s: string) => s.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();
  for (const [name, expected] of bodies) assert.equal(normalize(functions.find((r: any) => r.proname === name)?.prosrc ?? ''), normalize(expected), name);
  const fks = await db.$queryRawUnsafe(`SELECT conname,convalidated,confdeltype::text AS deletion,confupdtype::text AS updating,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint WHERE contype='f' AND conrelid IN (SELECT oid FROM pg_class WHERE relname LIKE 'payroll_%')`);
  for (const [, name, table, column] of sql.matchAll(/ADD CONSTRAINT "([^"]+)" FOREIGN KEY \("[^"]+"\) REFERENCES "([^"]+)"\("([^"]+)"\)/g)) {
    const fk=fks.find((r: any)=>r.conname===name); assert(fk?.convalidated && fk.deletion==='r' && fk.updating==='r',name); assert(fk.definition.includes(`REFERENCES ${table}(${column})`));
  }
  const indexes=await db.$queryRawUnsafe(`SELECT c.relname,i.indisunique,i.indisvalid,pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid IN (SELECT oid FROM pg_class WHERE relname LIKE 'payroll_%')`);
  for (const [,name,,keys] of sql.matchAll(/CREATE UNIQUE INDEX "([^"]+)" ON "([^"]+)"\(([^;]+)\);/g)) {
    const i=indexes.find((r: any)=>r.relname===name); assert(i?.indisunique && i.indisvalid,name); assert(i.definition.replace(/[\s"]/g,'').includes(`(${keys.replace(/[\s"]/g,'')})`),name);
  }
  const triggers=await db.$queryRawUnsafe(`SELECT tgname,tgenabled::text AS enabled FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'payment_%'`);
  assert(triggers.length>=38); assert(triggers.every((t: any)=>t.enabled==='O'));
  const columns=await db.$queryRawUnsafe(`SELECT numeric_precision,numeric_scale FROM information_schema.columns WHERE table_name IN ('payroll_payment_batches','payroll_payment_lines') AND data_type='numeric'`);
  assert.equal(columns.length,2); assert(columns.every((c: any)=>c.numeric_precision===18&&c.numeric_scale===2));
  console.log('PASS PostgreSQL payment functions, restrictive FK targets, uniqueness, lifecycle triggers and exact currency match migration');
}
if (require.main===module) { reviewPaymentIntegrity(readFileSync(resolve('prisma/migrations/20261014000000_payroll_payment_foundation/migration.sql'),'utf8')); console.log('PASS revised payment integrity review contracts; no database connection'); }
