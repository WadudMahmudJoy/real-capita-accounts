import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import { SalaryCalculator } from "../apps/api/src/salary/salary-calculator";
import { SalaryService } from "../apps/api/src/salary/salary.service";
import { EmployeeService } from "../apps/api/src/employee/employee.service";
import type { AuthenticatedUser } from "../apps/api/src/auth/auth.types";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { AuthGuard } from "../apps/api/src/auth/guards/auth.guard";
import { RolesGuard } from "../apps/api/src/auth/guards/roles.guard";
import { assertSalaryVerificationDatabase } from "./salary-verification-database-target";
import { normalizeSalaryPrismaError } from "../apps/api/src/salary/salary-prisma-errors";

process.loadEnvFile(".env");
assertSalaryVerificationDatabase(process.env.DATABASE_URL);

const prisma = new PrismaService();
const salary = new SalaryService(prisma, new SalaryCalculator());
const employees = new EmployeeService(prisma);
const prefix = `SALARY_PHASE1_VERIFY_${Date.now()}`;
let passed = 0;
let failed = 0;
const entityIds: string[] = [];

function sanitizedAdapterShape(error: unknown) {
  const knownConstraints = [
    "employee_salary_assignments_approved_range_excl",
    "employee_payment_profiles_approved_range_excl",
  ];
  const rows: Array<Record<string, unknown>> = [];
  let current = error;
  for (const path of ["error", "error.cause", "error.cause.cause"]) {
    if (!current || typeof current !== "object") break;
    const value = current as Record<string, unknown>;
    rows.push({
      path,
      constructor: (value.constructor as { name?: string } | undefined)?.name,
      properties: Object.getOwnPropertyNames(value),
      code: value.code,
      kind: value.kind,
      constraint: value.constraint,
      originalCode: value.originalCode,
      exactConstraintFieldMatches: Object.fromEntries(
        ["message", "detail", "originalMessage"].map((field) => [
          field,
          knownConstraints.filter((constraint) =>
            typeof value[field] === "string" && value[field].includes(`\"${constraint}\"`),
          ),
        ]),
      ),
    });
    current = value.cause;
  }
  return rows;
}

function isSafeOverlapConflict(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { getStatus?: () => number; message?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";
  return candidate.getStatus?.() === 409 &&
    /Approved effective dates overlap an existing record\./i.test(message) &&
    !/23P01|employee_.*_approved_range_excl|SQL|postgres|driver/i.test(message);
}

async function check(name: string, test: () => Promise<boolean>) {
  try {
    if (!(await test())) throw new Error("assertion returned false");
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function rejects(name: string, action: () => Promise<unknown>, message: RegExp) {
  await check(name, async () => {
    try {
      await action();
      return false;
    } catch (error) {
      return error instanceof Error && message.test(error.message);
    }
  });
}

async function main() {
  await prisma.$connect();
  const actorRow = await prisma.user.findFirst({ where: { isActive: true }, include: { roles: { include: { role: true } } } });
  if (!actorRow) throw new Error("No active verification actor exists.");
  const actor: AuthenticatedUser = { id: actorRow.id, email: actorRow.email, fullName: actorRow.fullName, roles: actorRow.roles.map(({ role }) => ({ code: role.code as "ACCOUNTANT", name: role.name })) };

  const request = { cookies: {}, user: actor };
  const context = { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => main, getClass: () => SalaryService } as unknown as ExecutionContext;
  await rejects("unauthenticated guard returns 401", () => new AuthGuard({} as never, prisma).canActivate(context), /Authentication required/i);
  const requiredRoleReflector = { getAllAndOverride: () => ["ACCOUNTANT"] } as unknown as Reflector;
  const rolesGuard = new RolesGuard(requiredRoleReflector);
  await check("ACCOUNTANT role is authorized", async () => rolesGuard.canActivate(context));
  await rejects("unauthorized role returns 403", async () => { request.user = { ...actor, roles: [] }; return rolesGuard.canActivate(context); }, /access to this resource/i);
  request.user = actor;

  let employeeId: string | undefined;
  let approvedStructureId: string | undefined;
  try {
    const employee = await employees.create({ employeeCode: `${prefix}_E1`, fullName: "Fictional Verification Employee", designation: "Verification Analyst", joiningDate: "2026-01-01" }, actor);
    employeeId = employee.id;
    entityIds.push(employee.id);
    await check("employee create and default active list", async () => (await employees.findAll({})).some((row) => row.id === employee.id));
    await check("invalid referenced Salary Structure returns controlled 404", async () => {
      try {
        await salary.createAssignment(employee.id, { salaryStructureId: `${prefix}_MISSING`, grossSalary: "100000.00", effectiveFrom: "2026-01-01" }, actor);
        return false;
      } catch (error) {
        return error instanceof Error && /Salary Structure was not found/i.test(error.message) && (error as { getStatus?: () => number }).getStatus?.() === 404;
      }
    });

    const components = [
      { code: "BASIC", name: "Basic", percentage: "60.0000", displayOrder: 1 },
      { code: "HOUSE_RENT", name: "House Rent", percentage: "30.0000", displayOrder: 2 },
      { code: "CONVEYANCE", name: "Conveyance", percentage: "10.0000", displayOrder: 3 },
    ];
    await rejects("structure total below 100", () => salary.createStructure({ code: `${prefix}_LOW`, name: "Low", effectiveFrom: "2026-01-01", components: [{ ...components[0], percentage: "99.0000" }] }, actor), /total exactly 100/i);
    await rejects("structure total above 100", () => salary.createStructure({ code: `${prefix}_HIGH`, name: "High", effectiveFrom: "2026-01-01", components: [{ ...components[0], percentage: "100.0000" }, { ...components[1], percentage: "1.0000" }] }, actor), /total exactly 100/i);
    await rejects("duplicate component code", () => salary.createStructure({ code: `${prefix}_DC`, name: "Duplicate code", effectiveFrom: "2026-01-01", components: [components[0], { ...components[1], code: "basic" }, components[2]] }, actor), /codes must be unique/i);
    await rejects("duplicate component order", () => salary.createStructure({ code: `${prefix}_DO`, name: "Duplicate order", effectiveFrom: "2026-01-01", components: [components[0], { ...components[1], displayOrder: 1 }, components[2]] }, actor), /displayOrder values must be unique/i);

    const structure = await salary.createStructure({ code: `${prefix}_STANDARD`, name: "Fictional Standard", effectiveFrom: "2026-01-01", components }, actor);
    approvedStructureId = structure.id;
    entityIds.push(structure.id);
    await check("valid structure total and approval", async () => (await salary.approveStructure(structure.id, actor)).status === "APPROVED");
    await rejects("approved structure immutable", () => salary.updateStructure(structure.id, { name: "Changed" }, actor), /immutable/i);
    await rejects("duplicate code version database constraint", () => prisma.salaryStructure.create({ data: { code: structure.code, version: structure.version, name: "Duplicate", effectiveFrom: new Date("2026-01-01"), createdById: actor.id } }), /unique constraint/i);

    const exclusionEmployee = await employees.create({ employeeCode: `${prefix}_23P01`, fullName: "Fictional Exclusion Verification", designation: "Verification Analyst", joiningDate: "2026-01-01" }, actor);
    entityIds.push(exclusionEmployee.id);
    const assignmentDrafts = await Promise.all([
      prisma.employeeSalaryAssignment.create({ data: { employeeId: exclusionEmployee.id, salaryStructureId: structure.id, grossSalary: "1.00", effectiveFrom: new Date("2026-01-01"), status: "DRAFT", createdById: actor.id } }),
      prisma.employeeSalaryAssignment.create({ data: { employeeId: exclusionEmployee.id, salaryStructureId: structure.id, grossSalary: "1.00", effectiveFrom: new Date("2026-01-02"), status: "DRAFT", createdById: actor.id } }),
    ]);
    entityIds.push(...assignmentDrafts.map(({ id }) => id));
    let assignmentExclusionError: unknown;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.employeeSalaryAssignment.update({ where: { id: assignmentDrafts[0].id }, data: { status: "APPROVED" } });
        await tx.employeeSalaryAssignment.update({ where: { id: assignmentDrafts[1].id }, data: { status: "APPROVED" } });
      });
    } catch (error) {
      assignmentExclusionError = error;
    }
    console.log(`SANITIZED assignment exclusion shape ${JSON.stringify(sanitizedAdapterShape(assignmentExclusionError))}`);
    await check("actual assignment exclusion normalizes to overlap 409", async () => {
      try {
        normalizeSalaryPrismaError(assignmentExclusionError, {});
      } catch (error) {
        return isSafeOverlapConflict(error);
      }
    });
    await check("failed assignment exclusion transaction rolls back", async () =>
      (await prisma.employeeSalaryAssignment.count({ where: { id: { in: assignmentDrafts.map(({ id }) => id) }, status: "DRAFT" } })) === 2,
    );

    const profileDrafts = await Promise.all([
      prisma.employeePaymentProfile.create({ data: { employeeId: exclusionEmployee.id, selectedBankPercentage: "0", effectiveFrom: new Date("2026-01-01"), status: "DRAFT", createdById: actor.id } }),
      prisma.employeePaymentProfile.create({ data: { employeeId: exclusionEmployee.id, selectedBankPercentage: "0", effectiveFrom: new Date("2026-01-02"), status: "DRAFT", createdById: actor.id } }),
    ]);
    entityIds.push(...profileDrafts.map(({ id }) => id));
    let profileExclusionError: unknown;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.employeePaymentProfile.update({ where: { id: profileDrafts[0].id }, data: { status: "APPROVED" } });
        await tx.employeePaymentProfile.update({ where: { id: profileDrafts[1].id }, data: { status: "APPROVED" } });
      });
    } catch (error) {
      profileExclusionError = error;
    }
    console.log(`SANITIZED profile exclusion shape ${JSON.stringify(sanitizedAdapterShape(profileExclusionError))}`);
    await check("actual payment profile exclusion normalizes to overlap 409", async () => {
      try {
        normalizeSalaryPrismaError(profileExclusionError, {});
      } catch (error) {
        return isSafeOverlapConflict(error);
      }
    });
    await check("failed payment-profile exclusion transaction rolls back", async () =>
      (await prisma.employeePaymentProfile.count({ where: { id: { in: profileDrafts.map(({ id }) => id) }, status: "DRAFT" } })) === 2,
    );

    const draftStructure = await salary.createStructure({ code: `${prefix}_DRAFT`, name: "Draft", effectiveFrom: "2026-01-01", components }, actor);
    entityIds.push(draftStructure.id);
    const draftAssignment = await salary.createAssignment(employee.id, { salaryStructureId: draftStructure.id, grossSalary: "100000.00", effectiveFrom: "2025-01-01" }, actor);
    entityIds.push(draftAssignment.id);
    await rejects("unapproved structure cannot approve assignment", () => salary.approveAssignment(draftAssignment.id, actor), /must be APPROVED/i);

    const assignment1 = await salary.createAssignment(employee.id, { salaryStructureId: structure.id, grossSalary: "100000.00", effectiveFrom: "2026-01-01" }, actor);
    entityIds.push(assignment1.id);
    const precreatedAssignment = await salary.createAssignment(employee.id, { salaryStructureId: structure.id, grossSalary: "110000.00", effectiveFrom: "2026-02-01" }, actor);
    entityIds.push(precreatedAssignment.id);
    await salary.approveAssignment(assignment1.id, actor);
    await rejects("pre-created assignment revision reason enforced at approval", () => salary.approveAssignment(precreatedAssignment.id, actor), /changeReason is required/i);
    await salary.updateAssignment(precreatedAssignment.id, { changeReason: "Fictional revision" });
    await check("pre-created assignment approves after reason", async () => (await salary.approveAssignment(precreatedAssignment.id, actor)).status === "APPROVED");
    await rejects("approved assignment immutable", () => salary.updateAssignment(assignment1.id, { grossSalary: "100001.00" }), /immutable/i);
    await rejects("assignment revision reason required", () => salary.createAssignment(employee.id, { salaryStructureId: structure.id, grossSalary: "110000.00", effectiveFrom: "2026-02-01" }, actor), /changeReason is required/i);
    await check("adjacent ranges and history retained", async () => { const rows = await salary.listAssignments(employee.id); const first = rows.find((row) => row.id === assignment1.id); return rows.length >= 3 && first?.effectiveTo?.toISOString() === new Date("2026-02-01").toISOString(); });
    const overlap = await salary.createAssignment(employee.id, { salaryStructureId: structure.id, grossSalary: "105000.00", effectiveFrom: "2026-01-15", effectiveTo: "2026-01-20", changeReason: "Fictional overlap" }, actor);
    entityIds.push(overlap.id);
    await rejects("assignment overlap rejected", () => salary.approveAssignment(overlap.id, actor), /overlap/i);

    await rejects("positive bank percentage requires details", () => salary.createProfile(employee.id, { selectedBankPercentage: "60.000000", effectiveFrom: "2026-01-01" }, actor), /Bank name/i);
    await rejects("non-standard bank percentage requires reason", () => salary.createProfile(employee.id, { selectedBankPercentage: "42.500000", bankName: "Fictional Bank", accountName: "Fictional Account", accountNumber: "VERIFY-ONLY", effectiveFrom: "2026-01-01" }, actor), /changeReason is required/i);
    await rejects("bank percentage below zero", () => salary.createProfile(employee.id, { selectedBankPercentage: "-0.000001", effectiveFrom: "2026-01-01", changeReason: "Invalid verification" }, actor), /between 0 and 100/i);
    await rejects("bank percentage above 100", () => salary.createProfile(employee.id, { selectedBankPercentage: "100.000001", bankName: "Fictional Bank", accountName: "Fictional Account", accountNumber: "VERIFY-ONLY", effectiveFrom: "2026-01-01", changeReason: "Invalid verification" }, actor), /between 0 and 100/i);
    const allCash = await salary.createProfile(employee.id, { selectedBankPercentage: "0.000000", effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31", changeReason: "Fictional all-cash verification" }, actor);
    entityIds.push(allCash.id);
    await check("zero bank permits no bank details", async () => allCash.policyCashShare === "100.000000");
    const profile1 = await salary.createProfile(employee.id, { bankName: "Fictional Bank", accountName: "Fictional Account", accountNumber: "VERIFY-ONLY", effectiveFrom: "2026-01-01" }, actor);
    entityIds.push(profile1.id);
    const precreatedProfile = await salary.createProfile(employee.id, { bankName: "Fictional Bank", accountName: "Fictional Account", accountNumber: "VERIFY-ONLY-PRECREATED", effectiveFrom: "2026-02-01" }, actor);
    entityIds.push(precreatedProfile.id);
    await salary.approveProfile(profile1.id, actor);
    await rejects("pre-created payment-profile revision reason enforced at approval", () => salary.approveProfile(precreatedProfile.id, actor), /changeReason is required/i);
    await salary.updateProfile(precreatedProfile.id, { changeReason: "Fictional payment revision" });
    await check("pre-created payment profile approves after reason", async () => (await salary.approveProfile(precreatedProfile.id, actor)).status === "APPROVED");
    await rejects("approved payment profile immutable", () => salary.updateProfile(profile1.id, { branchName: "Changed" }), /immutable/i);
    const profile2 = await salary.createProfile(employee.id, { selectedBankPercentage: "42.500001", bankName: "Fictional Bank", accountName: "Fictional Account", accountNumber: "VERIFY-ONLY-2", effectiveFrom: "2026-03-01", changeReason: "Fictional allocation revision" }, actor);
    entityIds.push(profile2.id);
    await salary.approveProfile(profile2.id, actor);
    await check("arbitrary precision profile and history retained", async () => { const rows = await salary.listProfiles(employee.id); return rows.some((row) => row.id === profile2.id && row.policyCashShare === "57.499999") && rows.some((row) => row.id === profile1.id && row.effectiveTo?.toISOString() === new Date("2026-02-01").toISOString()); });
    const profileOverlap = await salary.createProfile(employee.id, { selectedBankPercentage: "60.000000", bankName: "Fictional Bank", accountName: "Fictional Account", accountNumber: "VERIFY-ONLY-3", effectiveFrom: "2026-01-15", effectiveTo: "2026-01-20", changeReason: "Fictional overlap" }, actor);
    entityIds.push(profileOverlap.id);
    await rejects("payment profile overlap rejected", () => salary.approveProfile(profileOverlap.id, actor), /overlap/i);

    const voucherBefore = await prisma.voucher.count();
    const lineBefore = await prisma.voucherLine.count();
    const preview = await salary.preview({ grossSalary: "100000.00", salaryStructureId: structure.id, selectedBankPercentage: "60.000000", attendanceDeduction: "15000.00" });
    await check("preview totals", async () => preview.netPay === "85000.00" && preview.bankPay === "60000.00" && preview.cashPay === "25000.00");
    await check("preview has no voucher side effect", async () => voucherBefore === await prisma.voucher.count() && lineBefore === await prisma.voucherLine.count());
  } finally {
    const verificationEmployees = await prisma.employee.findMany({ where: { employeeCode: { startsWith: prefix } }, select: { id: true } });
    const verificationEmployeeIds = verificationEmployees.map(({ id }) => id);
    if (verificationEmployeeIds.length) {
      await prisma.employeePaymentProfile.deleteMany({ where: { employeeId: { in: verificationEmployeeIds } } });
      await prisma.employeeSalaryAssignment.deleteMany({ where: { employeeId: { in: verificationEmployeeIds } } });
    }
    if (employeeId) {
      await prisma.employeePaymentProfile.deleteMany({ where: { employeeId } });
      await prisma.employeeSalaryAssignment.deleteMany({ where: { employeeId } });
    }
    if (approvedStructureId) await prisma.salaryStructureComponent.deleteMany({ where: { salaryStructure: { code: { startsWith: prefix } } } });
    await prisma.salaryStructure.deleteMany({ where: { code: { startsWith: prefix } } });
    await prisma.employee.deleteMany({ where: { employeeCode: { startsWith: prefix } } });
    await prisma.auditEvent.deleteMany({ where: { OR: [{ entityId: { in: entityIds } }, { metadata: { path: ["employeeId"], equals: employeeId } }] } });
  }
  console.log(`Salary database verification: ${passed} PASS, ${failed} FAIL`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
