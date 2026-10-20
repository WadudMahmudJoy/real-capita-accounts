import "reflect-metadata";
import assert from "node:assert/strict";
import { documentFixture } from "./verify-payroll-documents";
import { PayrollPaymentPreparationService } from "../apps/api/src/payroll/payroll-payment-preparation.service";
export async function preparationFixture() {
  const f = await documentFixture();
  f.prisma.payrollRun.findUnique = async () => f.run;
  f.prisma.$queryRaw = async () => [];
  const readLines = f.prisma.payrollRunLine.findMany;
  f.prisma.payrollRunLine.findMany = async (args: any) => args.select.paymentProfileSnapshot ? f.run.lines : readLines(args);
  const account: any = { id: "source", displayName: "Test Bank", accountType: "BANK", isActive: true, accountNumber: "PRIVATE_SENTINEL", ledgerAccount: { id: "ledger", code: "BANK", name: "Test Ledger", isActive: true, isCashBank: true } };
  f.prisma.cashBankAccount = { findUnique: async () => account, findMany: async () => account?.isActive && account?.ledgerAccount.isActive && account.accountType === "BANK" ? [account] : [] };
  const service = new PayrollPaymentPreparationService(f.prisma, f.service);
  return { ...f, account, preparation: service };
}
const fixture = preparationFixture;
let passed = 0;
async function check(name: string, work: () => Promise<void>) { await work(); passed++; console.log(`PASS ${name}`); }
const error = (code: string) => (e: any) => e.getResponse?.().code === code;
async function main() {
  await check("historical bank/cash amounts reconcile; projections never grant disbursement authority", async () => {
    const f = await fixture(); f.run.lines.push({ ...f.line, employeeId: "second", id: "second" });
    const bank = await f.preparation.prepare("run", { channel: "BANK" }); const cash = await f.preparation.prepare("run", { channel: "CASH" });
    assert.equal(bank.totalPlanned, "120.02"); assert.equal(cash.totalPlanned, "80.00"); assert.equal(bank.payrollNetTotal, "200.02");
    assert.equal(bank.rows.length, 2); assert.equal(bank.status, "PREPARATION_NOT_DISBURSED"); assert.equal(bank.canDisburse, false);
    assert(bank.blockers.some(b => b.code === "PAYROLL_SOURCE_AUTHORIZATION_REQUIRED"));
    assert(!/PRIVATE_SENTINEL|accountNumber|Snapshot/.test(JSON.stringify(bank))); assert.equal(f.counts().writes, 0);
  });
  await check("DRAFT, foreign or missing/inactive parent rejected", async () => {
    for (const kind of ["DRAFT", "foreign", "missing", "inactive"]) { const f = await fixture();
      if (kind === "DRAFT") f.run.status = "DRAFT"; if (kind === "foreign") f.run.companyId = "office";
      if (kind === "missing") f.store.parentMissing = true; if (kind === "inactive") f.store.parentActive = false;
      await assert.rejects(() => f.preparation.prepare("run", { channel: "BANK" })); assert.equal(f.counts().writes, 0);
    }
  });
  await check("invalid source structure rejected; valid global source still lacks parent authority", async () => {
    for (const kind of ["inactive", "type", "ledger", "cashFlag", "authority"]) { const f = await fixture();
      if (kind === "inactive") f.account.isActive = false; if (kind === "type") f.account.accountType = "CASH";
      if (kind === "ledger") f.account.ledgerAccount.isActive = false; if (kind === "cashFlag") f.account.ledgerAccount.isCashBank = false;
      await assert.rejects(() => f.preparation.prepare("run", { channel: "BANK", sourceAccountId: "source" }), error(kind === "authority" ? "PAYROLL_SOURCE_NOT_AUTHORIZED" : "PAYROLL_SOURCE_ACCOUNT_INVALID"));
    }
  });
  await check("duplicate/inconsistent snapshots rejected and live changes never recalculate history", async () => {
    const f = await fixture(), first = await f.preparation.prepare("run", { channel: "BANK" });
    f.employee.fullName = "Changed"; f.structure.status = "INACTIVE";
    assert.deepEqual(await f.preparation.prepare("run", { channel: "BANK" }), first);
    f.run.lines.push({ ...f.line, id: "duplicate" }); await assert.rejects(() => f.preparation.prepare("run", { channel: "BANK" }));
    assert.equal(f.counts().writes, 0);
  });
  await check("missing or altered historical payment profile blocks without exposing credentials", async () => {
    for (const kind of ["missing", "percentage", "identity", "approval", "credentials"]) { const f = await fixture();
      if (kind === "missing") f.line.paymentProfileSnapshot = null;
      if (kind === "percentage") f.line.paymentProfileSnapshot.selectedBankPercentage = "50.000000";
      if (kind === "identity") f.line.paymentProfileSnapshot.profileId = "other";
      if (kind === "approval") f.line.paymentProfileSnapshot.approvedAt = null;
      if (kind === "credentials") f.line.paymentProfileSnapshot.accountNumber = "";
      await assert.rejects(() => f.preparation.prepare("run", { channel: "BANK" }), error("PAYROLL_PAYMENT_SNAPSHOT_INVALID")); assert.equal(f.counts().writes, 0);
    }
  });
  await check("zero allocations remain explicit and missing accounts fail closed", async () => {
    const f = await fixture(); f.line.paymentProfileSnapshot.selectedBankPercentage = "0.000000";
    f.line.bankPay = f.line.bankPay.times(0); f.line.cashPay = f.line.netPay;
    const result = await f.preparation.prepare("run", { channel: "BANK" });
    assert.equal(result.employeeCount, 1); assert.equal(result.rows[0].plannedAmount, "0.00"); assert.equal(result.rows[0].selectable, false);
    f.prisma.cashBankAccount.findUnique = async () => null;
    await assert.rejects(() => f.preparation.prepare("run", { channel: "BANK", sourceAccountId: "missing" }), error("PAYROLL_SOURCE_ACCOUNT_INVALID"));
  });
  await check("persisted explicit grant permits source preparation; pending schema fails closed", async () => {
    const f = await fixture();
    f.prisma.$queryRaw = async () => [{ id: "grant" }];
    const r = await f.preparation.prepare("run", { channel: "BANK", sourceAccountId: "source" });
    assert.equal(r.sourceAuthorizationVerified, true); assert.equal(r.blockers.length, 0); assert.equal(r.canDisburse, false);
    f.prisma.$queryRaw = async () => { throw { code: "P2021" }; };
    await assert.rejects(() => f.preparation.prepare("run", { channel: "BANK", sourceAccountId: "source" }), (e: any) => e.getStatus() === 503);
  });
  console.log(`${passed} payment preparation checks passed; no database connections or writes`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
