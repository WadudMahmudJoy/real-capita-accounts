import assert from "node:assert/strict";
import type { Prisma } from "../apps/api/src/generated/prisma/client";
import type { AuthenticatedUser } from "../apps/api/src/auth/auth.types";
import { DepartmentService } from "../apps/api/src/department/department.service";
import { EmployeeService } from "../apps/api/src/employee/employee.service";
import { PrismaService } from "../apps/api/src/prisma/prisma.service";
import { SalaryCalculator } from "../apps/api/src/salary/salary-calculator";
import { SalaryService } from "../apps/api/src/salary/salary.service";
import { assertSalaryVerificationDatabase } from "./salary-verification-database-target";

process.loadEnvFile(".env");
assertSalaryVerificationDatabase(process.env.DATABASE_URL);

const prisma = new PrismaService();
const prefix = `PHASE2_VERIFY_${Date.now()}`;
const employeeCodePrefix = `P2V_${Date.now().toString().slice(-10)}`;
let passed = 0;
let failed = 0;
let savepointSequence = 0;

class VerificationRollback extends Error {}

async function check(name: string, assertion: () => Promise<boolean>) {
  try {
    if (!(await assertion())) throw new Error("assertion returned false");
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL ${name}: ${error instanceof Error ? error.message : "assertion failed"}`,
    );
  }
}

async function rejects(
  name: string,
  action: () => Promise<unknown>,
  status: number,
  message: RegExp,
) {
  await check(name, async () => {
    try {
      await action();
      return false;
    } catch (error) {
      if (!error || typeof error !== "object") return false;
      const candidate = error as { getStatus?: () => number; message?: unknown };
      const text = typeof candidate.message === "string" ? candidate.message : "";
      assert.doesNotMatch(
        text,
        /\+8801\d+|@example\.invalid|\b\d{10,17}\b|Prisma|SQL|constraint|postgres/i,
      );
      return candidate.getStatus?.() === status && message.test(text);
    }
  });
}

async function rejectsDatabaseConstraint(
  name: string,
  tx: Prisma.TransactionClient,
  constraintName: string,
  action: () => Promise<unknown>,
) {
  await check(name, async () => {
    const savepoint = `employee_constraint_probe_${++savepointSequence}`;
    await tx.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);
    let diagnostic = "";
    try {
      await action();
    } catch (error) {
      diagnostic = databaseErrorDiagnostic(error);
    } finally {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`);
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
    }

    return diagnostic.includes("23514") && diagnostic.includes(constraintName);
  });
}

function databaseErrorDiagnostic(value: unknown, seen = new Set<object>()): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);

  const strings: string[] = [];
  for (const key of Object.getOwnPropertyNames(value)) {
    try {
      strings.push(databaseErrorDiagnostic((value as Record<string, unknown>)[key], seen));
    } catch {
      // Ignore inaccessible diagnostic properties.
    }
  }
  return strings.join(" ");
}

async function main() {
  await prisma.$connect();
  const before = await baseline();

  try {
    await prisma.$transaction(
      async (tx) => {
        const scoped = transactionFacade(tx);
        const departments = new DepartmentService(scoped);
        const employees = new EmployeeService(scoped);
        const salary = new SalaryService(scoped, new SalaryCalculator());
        const userRow = await tx.user.findFirst({
          where: { isActive: true },
          select: { id: true, email: true, fullName: true },
        });
        if (!userRow) throw new Error("No active verification user exists.");
        const user: AuthenticatedUser = { ...userRow, roles: [] };

        const departmentA = await departments.create(
          {
            code: ` ${prefix}_ops `,
            name: `${prefix} Operations`,
            description: " Fictional verification Department ",
          },
          user,
        );
        await check("Department create normalizes code and description", async () =>
          departmentA.code === `${prefix}_OPS` &&
          departmentA.description === "Fictional verification Department" &&
          departmentA.isActive,
        );

        await rejects(
          "duplicate Department code is controlled",
          () =>
            departments.create(
              { code: `${prefix}_ops`, name: `${prefix} Other` },
              user,
            ),
          409,
          /Department code already exists/,
        );
        await rejects(
          "duplicate normalized Department name is controlled",
          () =>
            departments.create(
              { code: `${prefix}_OTHER`, name: `${prefix.toLowerCase()} operations` },
              user,
            ),
          409,
          /Department name already exists/,
        );

        const departmentB = await departments.create(
          { code: `${prefix}_FIN`, name: `${prefix} Finance` },
          user,
        );
        const departmentUpdated = await departments.update(
          departmentA.id,
          { name: `${prefix} Operations Updated`, description: null },
          user,
        );
        await check("Department update preserves immutable code", async () =>
          departmentUpdated.code === departmentA.code &&
          departmentUpdated.name.endsWith("Updated") &&
          departmentUpdated.description === null,
        );

        const legacyEmployee = await tx.employee.create({
          data: {
            employeeCode: `${employeeCodePrefix}_LEGACY`,
            fullName: `${prefix} Legacy Employee`,
            designation: "Legacy Verification",
            joiningDate: new Date("2024-01-01T00:00:00.000Z"),
          },
        });
        const legacyUpdated = await employees.update(
          legacyEmployee.id,
          { fullName: `${prefix} Legacy Employee Corrected` },
          user,
        );
        await check("legacy Employee can be corrected before Department completion", async () =>
          legacyUpdated.fullName.endsWith("Corrected") &&
          legacyUpdated.departmentId === null &&
          legacyUpdated.mobileNumber === null,
        );

        const employee = await employees.create(
          {
            employeeCode: ` ${employeeCodePrefix}_emp01 `,
            fullName: `${prefix} Fictional Employee`,
            bengaliName: "কাল্পনিক কর্মী",
            dateOfBirth: "1995-01-01",
            nationalId: "99999-0000-0001",
            bloodGroup: "O_POSITIVE",
            mobileNumber: "01710000001",
            alternateMobileNumber: "8801810000002",
            personalEmail: ` ${prefix}.Personal@Example.Invalid `,
            officialEmail: ` ${prefix}.Official@Example.Invalid `,
            presentAddress: "Fictional present address",
            permanentAddress: "Fictional permanent address",
            designation: "Verification Analyst",
            departmentId: departmentA.id,
            joiningDate: "2025-01-01",
            confirmationDate: "2025-07-01",
            emergencyContactName: `${prefix} Contact`,
            emergencyContactRelationship: "Fictional relation",
            emergencyContactMobile: "01910000003",
            emergencyContactAddress: "Fictional contact address",
          },
          user,
        );

        await check("Employee creation normalizes code and mobile", async () =>
          employee.employeeCode === `${employeeCodePrefix}_EMP01` &&
          employee.mobileNumber === "+8801710000001" &&
          employee.alternateMobileNumber === "+8801810000002",
        );
        await check("Employee detail returns masked National ID only", async () =>
          !("nationalId" in employee) &&
          employee.hasNationalId &&
          employee.nationalIdMasked !== "9999900000001",
        );
        await check("Employee email normalization is lowercase", async () =>
          employee.personalEmail === `${prefix.toLowerCase()}.personal@example.invalid` &&
          employee.officialEmail === `${prefix.toLowerCase()}.official@example.invalid`,
        );

        await rejectsDatabaseConstraint(
          "database rejects active deleted Employee",
          tx,
          "employees_deleted_inactive_check",
          () => tx.$executeRaw`UPDATE employees SET "isDeleted" = true WHERE id = ${employee.id}`,
        );
        await rejectsDatabaseConstraint(
          "database rejects partial emergency contact group",
          tx,
          "employees_emergency_contact_group_check",
          () => tx.$executeRaw`UPDATE employees SET "emergencyContactMobile" = NULL WHERE id = ${employee.id}`,
        );
        await rejectsDatabaseConstraint(
          "database rejects separation reason without date",
          tx,
          "employees_separation_date_required_check",
          () => tx.$executeRaw`UPDATE employees SET "separationReason" = 'Fictional verification reason' WHERE id = ${employee.id}`,
        );

        await rejects(
          "duplicate Employee code is controlled",
          () =>
            employees.create(
              {
                employeeCode: `${employeeCodePrefix.toLowerCase()}_emp01`,
                fullName: `${prefix} Duplicate Code`,
                designation: "Verification",
                departmentId: departmentA.id,
                joiningDate: "2025-01-01",
                mobileNumber: "01710000004",
              },
              user,
            ),
          409,
          /Employee code already exists/,
        );
        await rejects(
          "duplicate National ID is controlled without echo",
          () =>
            employees.create(
              {
                employeeCode: `${employeeCodePrefix}_EMP02`,
                fullName: `${prefix} Duplicate NID`,
                designation: "Verification",
                departmentId: departmentA.id,
                joiningDate: "2025-01-01",
                mobileNumber: "01710000004",
                nationalId: "9999900000001",
              },
              user,
            ),
          409,
          /National ID is already assigned/,
        );
        await rejects(
          "duplicate official email is controlled without echo",
          () =>
            employees.create(
              {
                employeeCode: `${employeeCodePrefix}_EMP03`,
                fullName: `${prefix} Duplicate Email`,
                designation: "Verification",
                departmentId: departmentA.id,
                joiningDate: "2025-01-01",
                mobileNumber: "01710000004",
                officialEmail: `${prefix}.official@example.invalid`,
              },
              user,
            ),
          409,
          /Official email is already assigned/,
        );

        const list = await employees.findAll({
          status: "ALL",
          search: `${employeeCodePrefix}_EMP01`,
          departmentId: departmentA.id,
        });
        await check("Employee list search and Department filter find record", async () =>
          list.length === 1 && list[0]?.id === employee.id,
        );
        await check("Employee list is a minimal privacy projection", async () => {
          const row = list[0] as unknown as Record<string, unknown>;
          return (
            row.mobileNumberMasked === "+88017*****001" &&
            !("mobileNumber" in row) &&
            !("nationalId" in row) &&
            !("nationalIdMasked" in row) &&
            !("dateOfBirth" in row) &&
            !("officialEmail" in row) &&
            !("presentAddress" in row)
          );
        });

        const identityUpdated = await employees.update(
          employee.id,
          {
            fullName: `${prefix} Corrected Employee`,
            bengaliName: null,
            dateOfBirth: "1994-12-31",
            nationalId: "99999-0000-0002",
            bloodGroup: "A_POSITIVE",
          },
          user,
        );
        await check("identity fields are editable and National ID replaceable", async () =>
          identityUpdated.fullName.endsWith("Corrected Employee") &&
          identityUpdated.bengaliName === null &&
          identityUpdated.bloodGroup === "A_POSITIVE" &&
          identityUpdated.nationalIdMasked?.endsWith("0002") === true,
        );

        const contactUpdated = await employees.update(
          employee.id,
          {
            mobileNumber: "8801710000011",
            alternateMobileNumber: null,
            personalEmail: null,
            officialEmail: `${prefix}.Changed@Example.Invalid`,
            presentAddress: "Corrected fictional present address",
            permanentAddress: null,
          },
          user,
        );
        await check("contact fields and addresses are editable and clearable", async () =>
          contactUpdated.mobileNumber === "+8801710000011" &&
          contactUpdated.alternateMobileNumber === null &&
          contactUpdated.personalEmail === null &&
          contactUpdated.officialEmail === `${prefix.toLowerCase()}.changed@example.invalid` &&
          contactUpdated.permanentAddress === null,
        );

        const employmentUpdated = await employees.update(
          employee.id,
          {
            designation: "Corrected Verification Analyst",
            departmentId: departmentB.id,
            joiningDate: "2024-12-01",
            confirmationDate: "2025-06-01",
          },
          user,
        );
        await check("employment fields and Department are editable", async () =>
          employmentUpdated.designation.startsWith("Corrected") &&
          employmentUpdated.departmentId === departmentB.id &&
          employmentUpdated.joiningDate.toISOString().startsWith("2024-12-01"),
        );

        const emergencyUpdated = await employees.update(
          employee.id,
          {
            emergencyContactName: `${prefix} Corrected Contact`,
            emergencyContactRelationship: "Corrected relation",
            emergencyContactMobile: "01610000005",
            emergencyContactAddress: null,
          },
          user,
        );
        await check("emergency contact is editable", async () =>
          emergencyUpdated.emergencyContactName?.endsWith("Corrected Contact") === true &&
          emergencyUpdated.emergencyContactMobile === "+8801610000005" &&
          emergencyUpdated.emergencyContactAddress === null,
        );

        const nidCleared = await employees.update(
          employee.id,
          { nationalId: null },
          user,
        );
        await check("National ID is explicitly clearable", async () =>
          !nidCleared.hasNationalId && nidCleared.nationalIdMasked === null,
        );

        await rejects(
          "DOB after changed Joining Date is rejected",
          () => employees.update(employee.id, { dateOfBirth: "2024-12-02", joiningDate: "2024-12-01" }, user),
          400,
          /after Joining Date/,
        );
        await rejects(
          "confirmation before Joining Date is rejected",
          () => employees.update(employee.id, { confirmationDate: "2024-11-30" }, user),
          400,
          /Confirmation Date cannot precede/,
        );
        await rejects(
          "separation before Joining Date is rejected",
          () =>
            employees.update(
              employee.id,
              {
                separationDate: "2024-11-30",
                separationReason: "Fictional reason",
                isActive: false,
              },
              user,
            ),
          400,
          /Separation Date cannot precede/,
        );
        await rejects(
          "separation without reason is rejected",
          () => employees.update(employee.id, { separationDate: "2025-01-01", isActive: false }, user),
          400,
          /Separation Reason is required/,
        );
        await rejects(
          "separation reason without date is rejected",
          () => employees.update(employee.id, { separationReason: "Fictional reason" }, user),
          400,
          /Separation Date is required/,
        );
        await rejects(
          "partial emergency contact is rejected",
          () => employees.update(employee.id, { emergencyContactMobile: null }, user),
          400,
          /required together/,
        );
        await rejects(
          "alternate mobile equal to primary is rejected",
          () => employees.update(employee.id, { alternateMobileNumber: "01710000011" }, user),
          400,
          /must differ/,
        );

        await departments.update(departmentB.id, { isActive: false }, user);
        const historical = await employees.findOne(employee.id);
        await check("inactive Department remains visible historically", async () =>
          historical.department?.id === departmentB.id &&
          historical.department.isActive === false,
        );
        await rejects(
          "inactive Department cannot be newly assigned",
          () => employees.update(employee.id, { departmentId: departmentA.id }, user).then(() => employees.update(employee.id, { departmentId: departmentB.id }, user)),
          409,
          /Inactive Department cannot be assigned/,
        );

        await employees.update(employee.id, { departmentId: departmentA.id }, user);
        const inactive = await employees.update(employee.id, { isActive: false }, user);
        const reactivated = await employees.update(employee.id, { isActive: true }, user);
        await check("administrative inactive and reactivation work without separation", async () =>
          !inactive.isActive && reactivated.isActive,
        );

        const separated = await employees.update(
          employee.id,
          {
            separationDate: "2025-02-01",
            separationReason: "Fictional verification separation",
            isActive: false,
          },
          user,
        );
        await check("formal separation stores inactive lifecycle", async () =>
          !separated.isActive && separated.separationDate !== null,
        );
        await rejects(
          "casual reactivation of separated Employee is rejected",
          () => employees.update(employee.id, { isActive: true }, user),
          400,
          /must be inactive/,
        );
        const correctedSeparation = await employees.update(
          employee.id,
          { separationDate: null, separationReason: null, isActive: true },
          user,
        );
        await check("erroneous separation can be cleared and Employee reactivated", async () =>
          correctedSeparation.separationDate === null && correctedSeparation.isActive,
        );

        const approvedStructure = await tx.salaryStructure.findFirst({
          where: { status: "APPROVED" },
          select: { id: true },
        });
        if (!approvedStructure) throw new Error("No approved Salary Structure exists.");
        const assignment = await salary.createAssignment(
          employee.id,
          {
            salaryStructureId: approvedStructure.id,
            grossSalary: "50000",
            effectiveFrom: "2026-01-01",
          },
          user,
        );
        const payment = await salary.createProfile(
          employee.id,
          {
            selectedBankPercentage: "60",
            bankName: "Fictional Bank",
            accountName: "Fictional Account",
            accountNumber: "MASKED-VERIFY",
            effectiveFrom: "2026-01-01",
          },
          user,
        );
        await check("Salary Assignment relation remains operational", async () =>
          (await salary.listAssignments(employee.id)).some((row) => row.id === assignment.id),
        );
        await check("Payment Profile relation remains operational", async () =>
          (await salary.listProfiles(employee.id)).some((row) => row.id === payment.id),
        );
        const preview = await salary.preview({
          salaryStructureId: approvedStructure.id,
          grossSalary: "50000",
          attendanceDeduction: "0",
          providentFundDeduction: "0",
          loanOrSalaryAdvanceDeduction: "0",
          aitDeduction: "0",
          selectedBankPercentage: "60",
        });
        await check("Salary Preview remains operational", async () =>
          preview.grossSalary === "50000.00" && preview.bankPay === "30000.00",
        );
        await employees.update(employee.id, { isActive: false }, user);
        await rejects(
          "inactive Employee Salary approval rule remains enforced",
          () => salary.approveAssignment(assignment.id, user),
          400,
          /Employee must be active/,
        );

        const audits = await tx.auditEvent.findMany({
          where: {
            OR: [
              { entityType: "Employee", entityId: employee.id },
              { entityType: "Department", entityId: { in: [departmentA.id, departmentB.id] } },
            ],
          },
          select: { action: true, metadata: true },
        });
        await check("required Employee and Department audit actions exist", async () => {
          const actions = new Set(audits.map((event) => event.action));
          return [
            "DEPARTMENT_CREATED",
            "DEPARTMENT_UPDATED",
            "DEPARTMENT_DEACTIVATED",
            "EMPLOYEE_CREATED",
            "EMPLOYEE_IDENTITY_UPDATED",
            "EMPLOYEE_CONTACT_UPDATED",
            "EMPLOYEE_EMPLOYMENT_UPDATED",
            "EMPLOYEE_EMERGENCY_CONTACT_UPDATED",
            "EMPLOYEE_DEACTIVATED",
            "EMPLOYEE_REACTIVATED",
          ].every((action) => actions.has(action));
        });
        await check("audit metadata excludes sensitive values", async () => {
          const metadata = JSON.stringify(audits.map((event) => event.metadata));
          for (const sensitive of [
            "9999900000001",
            "9999900000002",
            "+8801710000001",
            "+8801710000011",
            `${prefix.toLowerCase()}.official@example.invalid`,
            "Fictional present address",
            "Fictional verification separation",
            `${prefix} Corrected Employee`,
            `${prefix} Corrected Contact`,
          ]) {
            assert.equal(metadata.includes(sensitive), false);
          }
          return true;
        });

        const restrictConstraint = await tx.$queryRaw<Array<{ restricted: boolean }>>`
          SELECT (confdeltype = 'r') AS restricted
          FROM pg_constraint
          WHERE conname = 'employees_departmentId_fkey'
        `;
        await check("Department foreign key uses ON DELETE RESTRICT", async () =>
          restrictConstraint[0]?.restricted === true,
        );

        throw new VerificationRollback("Rollback successful verification data.");
      },
      { timeout: 120_000 },
    );
  } catch (error) {
    if (!(error instanceof VerificationRollback)) throw error;
  } finally {
    await prisma.$disconnect();
  }

  const afterClient = new PrismaService();
  await afterClient.$connect();
  try {
    const after = await baseline(afterClient);
    await check("verification transaction leaves baseline counts unchanged", async () =>
      JSON.stringify(after) === JSON.stringify(before),
    );
    await check("verification leaves no Employee or Department artifacts", async () =>
      (await afterClient.employee.count({
        where: { employeeCode: { startsWith: "P2V_" } },
      })) === 0 &&
      (await afterClient.department.count({
        where: { code: { startsWith: "PHASE2_VERIFY_" } },
      })) === 0,
    );
  } finally {
    await afterClient.$disconnect();
  }

  console.log(`Employee records database verification: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

function transactionFacade(tx: Prisma.TransactionClient): PrismaService {
  return new Proxy(tx as unknown as object, {
    get(target, property) {
      if (property === "$transaction") {
        return async (callback: (client: Prisma.TransactionClient) => unknown) =>
          callback(tx);
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as PrismaService;
}

async function baseline(client: PrismaService = prisma) {
  const [employees, departments, assignments, profiles, auditEvents] =
    await Promise.all([
      client.employee.count(),
      client.department.count(),
      client.employeeSalaryAssignment.count(),
      client.employeePaymentProfile.count(),
      client.auditEvent.count(),
    ]);
  return { employees, departments, assignments, profiles, auditEvents };
}

void main();
