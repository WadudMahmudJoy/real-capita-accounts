import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from "../apps/api/src/employee/dto/employee.dto";
import { UpdateDepartmentDto } from "../apps/api/src/department/dto/department.dto";
import {
  assertEmployeeRules,
  bangladeshTodayDateOnly,
  maskMobile,
  maskNationalId,
  normalizeBangladeshMobile,
  normalizeEmail,
  normalizeNationalId,
  parseDateOnly,
} from "../apps/api/src/employee/employee-rules";

async function main() {
let passed = 0;
let failed = 0;

function check(name: string, assertion: () => void) {
  try {
    assertion();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL ${name}: ${error instanceof Error ? error.message : "assertion failed"}`,
    );
  }
}

async function checkAsync(name: string, assertion: () => Promise<void>) {
  try {
    await assertion();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(
      `FAIL ${name}: ${error instanceof Error ? error.message : "assertion failed"}`,
    );
  }
}

const validCreate = {
  employeeCode: " phase2_verify_01 ",
  fullName: " Fictional Employee ",
  designation: " Test Analyst ",
  departmentId: "department-id",
  joiningDate: "2025-01-01",
  mobileNumber: "01712345678",
};

check("01 mobile normalizes", () =>
  assert.equal(normalizeBangladeshMobile("01712345678"), "+8801712345678"),
);
check("8801 mobile normalizes", () =>
  assert.equal(normalizeBangladeshMobile("8801712345678"), "+8801712345678"),
);
check("+8801 mobile remains canonical", () =>
  assert.equal(normalizeBangladeshMobile("+8801712345678"), "+8801712345678"),
);
check("National ID removes spaces and hyphens", () =>
  assert.equal(normalizeNationalId(" 1234-567 890 "), "1234567890"),
);
check("email normalizes lowercase", () =>
  assert.equal(normalizeEmail(" Verify.Employee@Example.COM "), "verify.employee@example.com"),
);
check("mobile mask excludes full mobile", () => {
  const full = "+8801712345678";
  const masked = maskMobile(full);
  assert.equal(masked, "+88017*****678");
  assert.notEqual(masked, full);
});
check("National ID mask excludes full National ID", () => {
  const full = "1234567890123";
  const masked = maskNationalId(full);
  assert.equal(masked?.endsWith("0123"), true);
  assert.notEqual(masked, full);
});
check("date-only parser keeps UTC calendar date", () =>
  assert.equal(parseDateOnly("2025-01-31", "date").toISOString(), "2025-01-31T00:00:00.000Z"),
);
check("Bangladesh business date handles the UTC midnight boundary", () =>
  assert.equal(
    bangladeshTodayDateOnly(new Date("2026-08-22T20:00:00.000Z")).toISOString(),
    "2026-08-23T00:00:00.000Z",
  ),
);
check("impossible date-only value rejected", () =>
  assert.throws(() => parseDateOnly("2025-02-30", "date"), BadRequestException),
);

const baseRules = {
  joiningDate: parseDateOnly("2025-01-01", "joiningDate"),
  dateOfBirth: parseDateOnly("1995-01-01", "dateOfBirth"),
  confirmationDate: null,
  separationDate: null,
  separationReason: null,
  mobileNumber: "+8801712345678",
  alternateMobileNumber: null,
  emergencyContactName: null,
  emergencyContactRelationship: null,
  emergencyContactMobile: null,
  isActive: true,
};

check("DOB after joining rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        dateOfBirth: parseDateOnly("2025-01-02", "dateOfBirth"),
      }),
    /after Joining Date/,
  ),
);
check("future DOB rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        joiningDate: parseDateOnly("2099-02-01", "joiningDate"),
        dateOfBirth: parseDateOnly("2099-01-01", "dateOfBirth"),
      }),
    /future/,
  ),
);
check("confirmation before joining rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        confirmationDate: parseDateOnly("2024-12-31", "confirmationDate"),
      }),
    /Confirmation Date cannot precede/,
  ),
);
check("future confirmation rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        confirmationDate: parseDateOnly("2099-01-01", "confirmationDate"),
      }),
    /Confirmation Date cannot be in the future/,
  ),
);
check("separation before joining rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        separationDate: parseDateOnly("2024-12-31", "separationDate"),
        separationReason: "Fictional verification",
        isActive: false,
      }),
    /Separation Date cannot precede/,
  ),
);
check("date without separation reason rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        separationDate: parseDateOnly("2025-02-01", "separationDate"),
        isActive: false,
      }),
    /Separation Reason is required/,
  ),
);
check("separation reason without date rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        separationReason: "Fictional verification",
      }),
    /Separation Date is required/,
  ),
);
check("separation date and reason both absent accepted", () =>
  assert.doesNotThrow(() => assertEmployeeRules(baseRules)),
);
check("separation date and reason both supplied accepted", () =>
  assert.doesNotThrow(() =>
    assertEmployeeRules({
      ...baseRules,
      separationDate: parseDateOnly("2025-02-01", "separationDate"),
      separationReason: "Fictional verification",
      isActive: false,
    }),
  ),
);
check("separated active Employee rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        separationDate: parseDateOnly("2025-02-01", "separationDate"),
        separationReason: "Fictional verification",
      }),
    /must be inactive/,
  ),
);
check("partial emergency contact rejected", () =>
  assert.throws(
    () => assertEmployeeRules({ ...baseRules, emergencyContactName: "Fictional Contact" }),
    /required together/,
  ),
);
check("alternate mobile equal to primary rejected", () =>
  assert.throws(
    () =>
      assertEmployeeRules({
        ...baseRules,
        alternateMobileNumber: baseRules.mobileNumber,
      }),
    /must differ/,
  ),
);

await checkAsync("create DTO requires Phase 2 fields", async () => {
  const errors = await validate(plainToInstance(CreateEmployeeDto, {}));
  const properties = new Set(errors.map((error) => error.property));
  for (const required of [
    "employeeCode",
    "fullName",
    "designation",
    "departmentId",
    "joiningDate",
    "mobileNumber",
  ]) {
    assert.equal(properties.has(required), true, `${required} was not required`);
  }
});
await checkAsync("create DTO normalizes code, mobile, email, and National ID", async () => {
  const instance = plainToInstance(CreateEmployeeDto, {
    ...validCreate,
    officialEmail: " PHASE2.Verify@Example.COM ",
    nationalId: "1234-567-890",
  });
  assert.equal((await validate(instance)).length, 0);
  assert.equal(instance.employeeCode, "PHASE2_VERIFY_01");
  assert.equal(instance.mobileNumber, "+8801712345678");
  assert.equal(instance.officialEmail, "phase2.verify@example.com");
  assert.equal(instance.nationalId, "1234567890");
});
await checkAsync("invalid Bangladesh mobile rejected", async () => {
  const instance = plainToInstance(CreateEmployeeDto, {
    ...validCreate,
    mobileNumber: "01212345678",
  });
  assert.equal((await validate(instance)).some((error) => error.property === "mobileNumber"), true);
});
await checkAsync("Employee Code is non-writable in update DTO", async () => {
  const instance = plainToInstance(UpdateEmployeeDto, { employeeCode: "MUTATED" });
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  assert.equal(errors.some((error) => error.property === "employeeCode"), true);
});
await checkAsync("system Employee fields are non-writable", async () => {
  const instance = plainToInstance(UpdateEmployeeDto, {
    id: "replacement",
    isDeleted: true,
    deletedAt: "2025-01-01",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  });
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  assert.deepEqual(
    new Set(errors.map((error) => error.property)),
    new Set(["id", "isDeleted", "deletedAt", "createdAt", "updatedAt"]),
  );
});
await checkAsync("required mutable Employee fields reject explicit null", async () => {
  const instance = plainToInstance(UpdateEmployeeDto, {
    fullName: null,
    designation: null,
    departmentId: null,
    joiningDate: null,
    mobileNumber: null,
  });
  const errors = await validate(instance);
  assert.deepEqual(
    new Set(errors.map((error) => error.property)),
    new Set(["fullName", "designation", "departmentId", "joiningDate", "mobileNumber"]),
  );
});
await checkAsync("Department Code is non-writable in update DTO", async () => {
  const instance = plainToInstance(UpdateDepartmentDto, { code: "MUTATED" });
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  assert.equal(errors.some((error) => error.property === "code"), true);
});
await checkAsync("required mutable Department name rejects explicit null", async () => {
  const instance = plainToInstance(UpdateDepartmentDto, { name: null });
  const errors = await validate(instance);
  assert.equal(errors.some((error) => error.property === "name"), true);
});

check("Employee list projection excludes sensitive fields in source", () => {
  const source = readFileSync(
    "apps/api/src/employee/employee.service.ts",
    "utf8",
  );
  const listBlock = source.slice(source.indexOf("async findAll"), source.indexOf("async findOne"));
  assert.doesNotMatch(listBlock, /nationalId:/);
  assert.doesNotMatch(listBlock, /dateOfBirth:/);
  assert.match(listBlock, /mobileNumberMasked/);
});
check("detail projection strips full National ID", () => {
  const source = readFileSync(
    "apps/api/src/employee/employee.service.ts",
    "utf8",
  );
  assert.match(source, /const \{ nationalId, \.\.\.detail \} = row/);
  assert.match(source, /nationalIdMasked: maskNationalId\(nationalId\)/);
});
check("detail endpoint declares no-store", () => {
  const source = readFileSync(
    "apps/api/src/employee/employee.controller.ts",
    "utf8",
  );
  assert.match(source, /@Header\("Cache-Control", "no-store"\)/);
});
check("audit implementation records field names, not Employee values", () => {
  const source = readFileSync(
    "apps/api/src/employee/employee.service.ts",
    "utf8",
  );
  const auditStart = source.indexOf("if (identityChanged");
  const auditSection = source.slice(
    auditStart,
    source.indexOf("return safeDetail(employee)", auditStart),
  );
  assert.match(auditSection, /changedFields/);
  assert.doesNotMatch(auditSection, /nationalId:|mobileNumber:|officialEmail:|fullName:/);
});

console.log(`Employee records pure verification: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) process.exitCode = 1;
}

void main();
