import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { withoutPaymentFoundation } from "./payroll-payment-schema";
const root = resolve(__dirname, ".."), req = createRequire(join(root, "package.json")), temp = mkdtempSync(join(tmpdir(), "payroll-payment-contract-"));
try {
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8"), before = join(temp, "before.prisma"), after=join(temp,'after.prisma'); writeFileSync(before, withoutPaymentFoundation(schema));
  writeFileSync(after,schema.replace(/^model PayrollCashAcknowledgment \{[\s\S]*?^\}\r?\n/m,'').replace(/^.*cashAcknowledgment.*\r?\n/gm,'').replace(/^.*@@unique\(\[verificationAuthority, evidenceKind, evidenceReference\]\).*\r?\n/gm,''));
  const generated = execFileSync(process.execPath, [req.resolve("prisma/build/index.js"), "migrate", "diff", "--from-schema", before, "--to-schema", after, "--script"], { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgresql://offline:offline@localhost:1/offline" } });
  const sql = readFileSync(join(root, "prisma/migrations/20261014000000_payroll_payment_foundation/migration.sql"), "utf8");
  const [base, manual] = sql.split("-- BEGIN PAYMENT INTEGRITY");
  const normalize = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
  assert.equal(normalize(base), normalize(generated)); assert(!/\bDROP TABLE|\bDROP COLUMN|\bALTER COLUMN/.test(base));
  for (const expression of ["NEW.amount<>expected", 'p."employeeId"<>NEW."employeeId"', 'g."sourceAccountId"<>NEW."sourceAccountId"', 'g.channel<>NEW.channel', "total IS DISTINCT FROM b.\"totalAmount\"", "NEW.\"confirmedById\"", "DEFERRABLE INITIALLY DEFERRED", "ON DELETE RESTRICT ON UPDATE RESTRICT"]) assert(sql.includes(expression), expression);
  const check = 'CHECK (amount>0 AND jsonb_typeof("obligationSnapshot")=\'object\')'; assert(manual.includes(check));
  const verify = (text: string) => { assert(text.includes(check)); assert(text.includes('NEW.amount<>expected')); assert(text.includes('total IS DISTINCT FROM b."totalAmount"')); };
  assert.throws(() => verify(manual.replace(check, 'CHECK (TRUE)'))); assert.throws(() => verify(manual.replace('NEW.amount<>expected', 'NEW.amount>expected')));
  console.log("PASS payment schema/migration parity, restrictive FKs, full allocation/total contract and weakened-constraint mutations; no database connection");
} finally { rmSync(temp, { recursive: true, force: true }); }
