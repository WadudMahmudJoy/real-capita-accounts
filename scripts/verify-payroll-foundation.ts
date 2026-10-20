// Offline contract verification only: never instantiate a client or connect to a database.
// Before migration execution, independently verify that the existing PRIMARY company
// is the Real Capita Group parent. Future services must resolve this unique marker,
// fail closed if missing/inactive, and never use active office/name/hardcoded IDs.
// Database FKs do NOT enforce PRIMARY ownership, source effective-date validity,
// snapshot contents, optimistic locking, or approved-record immutability.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { withoutPaymentFoundation } from "./payroll-payment-schema";

const baseline = "20cdc5a94e2f24df781e313ab3850a456d913c1c";
const migration = "prisma/migrations/20261013000000_hr_3b_payroll_foundation/migration.sql";
const root = resolve(__dirname, "..");
const requireFromRoot = createRequire(join(root, "package.json"));
const directory = mkdtempSync(join(tmpdir(), "real-capita-payroll-offline-"));
try {
  const before = join(directory, "before.prisma");
  const foundation = join(directory, "foundation.prisma");
  writeFileSync(foundation, withoutPaymentFoundation(readFileSync(join(root, "prisma/schema.prisma"), "utf8")));
  writeFileSync(before, execFileSync("git", ["show", `${baseline}:prisma/schema.prisma`], { cwd: root }));
  const sql = execFileSync(process.execPath, [join(dirname(requireFromRoot.resolve("prisma/package.json")), "build/index.js"),
    "migrate", "diff", "--from-schema", before,
    "--to-schema", foundation, "--script"], {
    cwd: root, encoding: "utf8", env: { ...process.env,
      DATABASE_URL: "postgresql://offline:offline@127.0.0.1:1/offline_do_not_connect" },
  });
  const statements = (value: string) => value.replace(/--[^\n]*/g, "")
    .split(";").map(part => part.replace(/\s+/g, " ").trim()).filter(Boolean);
  const generated = statements(sql);
  assert(generated.some(s => s.startsWith('CREATE TABLE "payroll_runs"')), "PayrollRun persistence is missing");
  assert(generated.some(s => s.startsWith('CREATE TABLE "payroll_run_lines"')), "PayrollRunLine persistence is missing");
  assert(generated.some(s => s.includes('ON "payroll_runs"("payrollYear", "payrollMonth")') && s.startsWith("CREATE UNIQUE INDEX")), "Regular monthly uniqueness must be global");
  assert(generated.some(s => s.includes('ON "payroll_run_lines"("payrollRunId", "employeeId")') && s.startsWith("CREATE UNIQUE INDEX")), "Employee/run uniqueness is missing");
  for (const statement of generated) {
    assert(!/^(DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/.test(statement), "Foundation must be additive");
    if (statement.startsWith("ALTER TABLE")) {
      assert(statement.startsWith('ALTER TABLE "payroll_'), "Existing tables must not change");
      assert(statement.includes("ON DELETE RESTRICT"), "Payroll references must restrict deletion");
    }
  }
  const lineTable = generated.find(s => s.startsWith('CREATE TABLE "payroll_run_lines"'))!;
  for (const field of ["grossSalary", "totalEarnings", "attendanceDeduction", "providentFundDeduction", "loanOrSalaryAdvanceDeduction", "aitDeduction", "otherDeductionsTotal", "totalDeductions", "netPay", "bankPay", "cashPay"]) {
    assert(lineTable.includes(`"${field}" DECIMAL(18,2) NOT NULL`), `${field} must use exact currency storage`);
  }
  for (const field of ["employeeSnapshot", "salarySnapshot", "paymentProfileSnapshot", "calculationSnapshot"]) {
    assert(lineTable.includes(`"${field}" JSONB NOT NULL`), `${field} is required`);
  }
  const reviewed = statements(readFileSync(join(root, migration), "utf8"));
  const extraChecks = reviewed.filter(s => s.includes(" ADD CONSTRAINT ") && s.includes(" CHECK "));
  const financialChecks = [
    'ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_gross_salary_positive_check" CHECK ("grossSalary" > 0)',
    'ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_total_earnings_positive_check" CHECK ("totalEarnings" > 0)',
    'ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_amounts_non_negative_check" CHECK ("attendanceDeduction" >= 0 AND "providentFundDeduction" >= 0 AND "loanOrSalaryAdvanceDeduction" >= 0 AND "aitDeduction" >= 0 AND "otherDeductionsTotal" >= 0 AND "totalDeductions" >= 0 AND "netPay" >= 0 AND "bankPay" >= 0 AND "cashPay" >= 0)',
    'ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_deductions_reconcile_check" CHECK ("totalDeductions" = "attendanceDeduction" + "providentFundDeduction" + "loanOrSalaryAdvanceDeduction" + "aitDeduction" + "otherDeductionsTotal")',
    'ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_net_pay_reconcile_check" CHECK ("netPay" = "totalEarnings" - "totalDeductions")',
    'ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payments_reconcile_check" CHECK ("bankPay" + "cashPay" = "netPay")',
  ];
  const expectedChecks = [
    'ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_month_check" CHECK ("payrollMonth" BETWEEN 1 AND 12)',
    'ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_year_check" CHECK ("payrollYear" BETWEEN 1 AND 9999)',
    'ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_version_check" CHECK ("version" >= 1 AND "snapshotSchemaVersion" >= 1)',
    `ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approval_metadata_check" CHECK (("status" = 'DRAFT' AND "approvedById" IS NULL AND "approvedAt" IS NULL) OR ("status" = 'APPROVED' AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL))`,
    ...financialChecks,
  ];
  const verifyAdditionalChecks = (checks: string[]) => assert.deepEqual(checks, expectedChecks,
    "Full run metadata and financial CHECK expressions must match the reviewed contract");
  verifyAdditionalChecks(extraChecks);
  // Exercise the same verifier against missing checks and weakened expressions.
  // Names remain intact in the altered cases: name-only validation cannot pass.
  for (const check of financialChecks) {
    assert.throws(() => verifyAdditionalChecks(extraChecks.filter(s => s !== check)), assert.AssertionError);
    assert.throws(() => verifyAdditionalChecks(extraChecks.map(s => s === check
      ? s.replace(/CHECK \(.*\)$/, "CHECK (TRUE)") : s)), assert.AssertionError);
  }
  assert.deepEqual(reviewed.filter(s => !extraChecks.includes(s)), generated, "Reviewed migration must match the complete additive Prisma schema delta");
  console.log("PASS offline payroll foundation: additive schema/migration parity, uniqueness, precision, snapshots, restrictive references, financial CHECK contract");
  console.log("PASS financial verifier mutations: six missing and six weakened constraints rejected");
  console.log("NOT VERIFIED: database identity, applied constraints, lifecycle/concurrency enforcement, snapshot payload validation");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
