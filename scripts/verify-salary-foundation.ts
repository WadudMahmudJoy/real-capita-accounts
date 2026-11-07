import assert from "node:assert/strict";
import { Prisma } from "../apps/api/src/generated/prisma/client";
import { SalaryCalculator } from "../apps/api/src/salary/salary-calculator";
import { assertSalaryVerificationDatabase } from "./salary-verification-database-target";
import { normalizeSalaryPrismaError } from "../apps/api/src/salary/salary-prisma-errors";
import { parseBooleanQueryValue } from "../apps/api/src/common/dto-transforms";
import { BadRequestException } from "@nestjs/common";

const calculator = new SalaryCalculator();
const TestDecimal = Prisma.Decimal.clone({ precision: 80 });
const components = [
  { code: "BASIC", name: "Basic", percentage: new Prisma.Decimal("60"), displayOrder: 1 },
  { code: "HOUSE_RENT", name: "House Rent", percentage: new Prisma.Decimal("30"), displayOrder: 2 },
  { code: "CONVEYANCE", name: "Conveyance", percentage: new Prisma.Decimal("10"), displayOrder: 3 },
];

let passed = 0;
function check(name: string, assertion: () => void) {
  assertion(); passed += 1; console.log(`PASS ${name}`);
}

function calculate(grossSalary: string, selectedBankPercentage: string, deductions: Partial<Record<"attendance" | "pf" | "loan" | "ait", string>> = {}, otherApprovedDeductions: Array<{amount:string;description:string;approvalReference?:string}> = []) {
  return calculator.calculate({
    grossSalary,
    components,
    attendanceDeduction: deductions.attendance ?? "0",
    providentFundDeduction: deductions.pf ?? "0",
    loanOrSalaryAdvanceDeduction: deductions.loan ?? "0",
    aitDeduction: deductions.ait ?? "0",
    otherApprovedDeductions,
    selectedBankPercentage,
  });
}

const noDeductions = calculate("100000", "60");
check("gross 100000 no deductions bank 60",()=>assert.deepEqual([noDeductions.basic,noDeductions.houseRent,noDeductions.conveyance,noDeductions.netPay,noDeductions.bankPay,noDeductions.cashPay],["60000.00","30000.00","10000.00","100000.00","60000.00","40000.00"]));
check("earnings total",()=>assert.equal(noDeductions.earningComponents.reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0)).toFixed(2), "100000.00"));

const deductions = calculate("100000", "60", { attendance: "15000" });
check("deductions 15000",()=>assert.deepEqual([deductions.netPay,deductions.bankPay,deductions.cashPay],["85000.00","60000.00","25000.00"]));
check("deductions 40000",()=>assert.equal(calculate("100000","60",{attendance:"40000"}).cashPay,"0.00"));
check("bank allocation above net rejected",()=>assert.throws(() => calculate("100000", "60", { attendance: "40000.01" }), /Bank allocation exceeds net pay/));
check("negative deduction rejected",()=>assert.throws(() => calculate("100000", "60", { attendance: "-1" }), /non-negative/));
check("deductions above earnings rejected",()=>assert.throws(() => calculate("100000","0",{attendance:"100000.01"}),/must not exceed/));
check("other deduction description required",()=>assert.throws(()=>calculate("100000","0",{},[{amount:"1",description:" "}]),/description/));
check("all cash",()=>assert.deepEqual([calculate("100000","0",{attendance:"15000"}).bankPay,calculate("100000","0",{attendance:"15000"}).cashPay],["0.00","85000.00"]));
check("high precision bank percentage",()=>assert.equal(calculate("100000","42.123456").selectedBankPercentage,"42.123456"));

const residual = calculate("100000.05", "42.5");
check("rounding residual",()=>assert.equal(residual.totalEarnings,"100000.05"));
check("bank cash reconciliation",()=>assert.equal(new Prisma.Decimal(residual.bankPay).plus(residual.cashPay).toFixed(2), residual.netPay));

const allBank = calculator.calculateAllNetByBank({ grossSalary: "100000", netPay: "85000" });
check("all net by bank",()=>assert.deepEqual([allBank.selectedBankPercentage,allBank.bankPay,allBank.cashPay],["85.0000000000000000000000000000000000000000","85000.00","0.00"]));

const quarters = [1, 2, 3, 4].map((displayOrder) => ({
  code: `C${displayOrder}`,
  name: `Component ${displayOrder}`,
  percentage: new Prisma.Decimal("25"),
  displayOrder,
}));
check("negative final earning residual rejected", () => assert.throws(() => calculator.calculate({
  grossSalary: "0.02", components: quarters, attendanceDeduction: "0",
  providentFundDeduction: "0", loanOrSalaryAdvanceDeduction: "0",
  aitDeduction: "0", otherApprovedDeductions: [], selectedBankPercentage: "0",
}), /too small.*currency precision/i));
check("four quarter components allocate one cent each", () => assert.deepEqual(
  calculator.calculate({ grossSalary: "0.04", components: quarters, attendanceDeduction: "0", providentFundDeduction: "0", loanOrSalaryAdvanceDeduction: "0", aitDeduction: "0", otherApprovedDeductions: [], selectedBankPercentage: "0" }).earningComponents.map((item) => item.amount),
  ["0.01", "0.01", "0.01", "0.01"],
));

for (const [grossSalary, netPay] of [
  ["3.00", "1.00"],
  ["100000.01", "83333.37"],
  ["0.01", "0.01"],
  ["10000000.00", "3333333.35"],
  ["9999999999999999.99", "3333333333333333.33"],
  ["7.00", "2.00"],
] as const) {
  check(`all-net percentage safely replays for ${grossSalary}/${netPay}`, () => {
    const helper = calculator.calculateAllNetByBank({ grossSalary, netPay });
    assert.equal(typeof helper.selectedBankPercentage, "string");
    assert.ok(helper.selectedBankPercentage.split(".")[1]!.length >= 18);
    const replay = calculator.calculate({
      grossSalary, components, attendanceDeduction: new Prisma.Decimal(grossSalary).minus(netPay).toFixed(2),
      providentFundDeduction: "0", loanOrSalaryAdvanceDeduction: "0", aitDeduction: "0",
      otherApprovedDeductions: [], selectedBankPercentage: helper.selectedBankPercentage,
    });
    assert.deepEqual([replay.bankPay, replay.cashPay], [netPay, "0.00"]);
    assert.ok(new TestDecimal(replay.maximumAllowedBankPercentage).lessThanOrEqualTo(new TestDecimal(netPay).times(100).div(grossSalary)));
  });
}

check("verification database target guard", () => {
  assert.equal(assertSalaryVerificationDatabase("postgresql://user:secret@localhost:55432/real_capita_accounts_salary_dev?schema=public"), "real_capita_accounts_salary_dev");
  assert.equal(assertSalaryVerificationDatabase("postgresql://user:secret@localhost:55432/real_capita_accounts_salary%5Fdev"), "real_capita_accounts_salary_dev");
  assert.throws(() => assertSalaryVerificationDatabase("postgresql://user:secret@localhost:55432/real_capita_accounts"), /detected database "real_capita_accounts".*required safe target/i);
  assert.throws(() => assertSalaryVerificationDatabase("postgresql://user:secret@localhost:55432/real_capita_accounts_salary_dev_copy"), /detected database "real_capita_accounts_salary_dev_copy".*required safe target/i);
  assert.throws(() => assertSalaryVerificationDatabase(undefined), /database URL is missing/i);
  assert.throws(() => assertSalaryVerificationDatabase("not a database URL"), /database URL is malformed/i);
});
check("salary Prisma errors are normalized accurately", () => {
  const adapterError = (code: string | undefined, constraint: string) => ({
    cause: {
      kind: "postgres",
      ...(code === undefined ? {} : { code, originalCode: code }),
      originalMessage: `conflicting key violates exclusion constraint \"${constraint}\"`,
    },
  });
  const assertStatus = (action: () => never, status: number, message: RegExp) => {
    assert.throws(action, (error: unknown) => {
      if (!error || typeof error !== "object") return false;
      const candidate = error as { getStatus?: () => number; message?: unknown };
      const text = typeof candidate.message === "string" ? candidate.message : "";
      assert.doesNotMatch(text, /23P01|approved_range_excl|SQL|postgres|driver|secret|localhost/i);
      return candidate.getStatus?.() === status && message.test(text);
    });
  };
  assertStatus(() => normalizeSalaryPrismaError(adapterError("23P01", "employee_salary_assignments_approved_range_excl"), { overlapMessage: "Assignment overlap." }), 409, /^Assignment overlap\.$/);
  assertStatus(() => normalizeSalaryPrismaError(adapterError("23P01", "employee_payment_profiles_approved_range_excl"), { overlapMessage: "Profile overlap." }), 409, /^Profile overlap\.$/);
  assertStatus(() => normalizeSalaryPrismaError(adapterError("23P01", "unrelated_approved_range_excl"), {}), 500, /could not be completed/i);
  assertStatus(() => normalizeSalaryPrismaError(adapterError("23505", "employee_salary_assignments_approved_range_excl"), {}), 500, /could not be completed/i);
  assertStatus(() => normalizeSalaryPrismaError(adapterError(undefined, "employee_salary_assignments_approved_range_excl"), {}), 500, /could not be completed/i);
  assert.throws(() => normalizeSalaryPrismaError({ code: "P2034" }, {}), (error: unknown) => error instanceof Error && /changed concurrently.*retry/i.test(error.message) && (error as { getStatus(): number }).getStatus() === 409);
  assert.throws(() => normalizeSalaryPrismaError({ code: "P2004", meta: { constraint: "employee_salary_assignments_approved_range_excl" } }, { overlapMessage: "Assignment overlap." }), (error: unknown) => error instanceof Error && error.message === "Assignment overlap." && (error as { getStatus(): number }).getStatus() === 409);
  assertStatus(() => normalizeSalaryPrismaError({ code: "P2004", meta: { constraint: "employee_salary_assignments_approved_range_excl_extra" } }, {}), 500, /could not be completed/i);
  assert.throws(() => normalizeSalaryPrismaError({ code: "P2002" }, { duplicateMessage: "Duplicate configuration." }), (error: unknown) => error instanceof Error && error.message === "Duplicate configuration." && (error as { getStatus(): number }).getStatus() === 409);
  assert.throws(() => normalizeSalaryPrismaError({ code: "P2025" }, { notFoundMessage: "Configuration not found." }), (error: unknown) => error instanceof Error && error.message === "Configuration not found." && (error as { getStatus(): number }).getStatus() === 404);
  assert.throws(() => normalizeSalaryPrismaError({ code: "P2003" }, { referenceMessage: "Referenced structure not found." }), (error: unknown) => error instanceof Error && error.message === "Referenced structure not found." && (error as { getStatus(): number }).getStatus() === 404);
  assertStatus(() => normalizeSalaryPrismaError({ code: "P9999", message: "secret SQL at localhost" }, {}), 500, /could not be completed/i);
  const existing = new BadRequestException("Existing validation error.");
  assert.throws(() => normalizeSalaryPrismaError(existing, {}), (error: unknown) => error === existing);
});
check("employee boolean query parsing is strict", () => {
  assert.equal(parseBooleanQueryValue(undefined), undefined);
  assert.equal(parseBooleanQueryValue("true"), true);
  assert.equal(parseBooleanQueryValue("false"), false);
  for (const value of ["invalid", "1", "yes", ""]) assert.equal(parseBooleanQueryValue(value), value);
});

console.log(`Salary foundation verification: ${passed} PASS, 0 FAIL`);
