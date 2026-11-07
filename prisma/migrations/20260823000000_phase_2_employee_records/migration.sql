-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM (
    'A_POSITIVE',
    'A_NEGATIVE',
    'B_POSITIVE',
    'B_NEGATIVE',
    'AB_POSITIVE',
    'AB_NEGATIVE',
    'O_POSITIVE',
    'O_NEGATIVE'
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "employees"
    ADD COLUMN "bengaliName" TEXT,
    ADD COLUMN "dateOfBirth" TIMESTAMP(3),
    ADD COLUMN "nationalId" TEXT,
    ADD COLUMN "bloodGroup" "BloodGroup",
    ADD COLUMN "mobileNumber" TEXT,
    ADD COLUMN "alternateMobileNumber" TEXT,
    ADD COLUMN "personalEmail" TEXT,
    ADD COLUMN "officialEmail" TEXT,
    ADD COLUMN "presentAddress" TEXT,
    ADD COLUMN "permanentAddress" TEXT,
    ADD COLUMN "departmentId" TEXT,
    ADD COLUMN "confirmationDate" TIMESTAMP(3),
    ADD COLUMN "separationDate" TIMESTAMP(3),
    ADD COLUMN "separationReason" TEXT,
    ADD COLUMN "emergencyContactName" TEXT,
    ADD COLUMN "emergencyContactRelationship" TEXT,
    ADD COLUMN "emergencyContactMobile" TEXT,
    ADD COLUMN "emergencyContactAddress" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");
CREATE UNIQUE INDEX "departments_name_ci_key" ON "departments" (lower(btrim("name")));
CREATE INDEX "departments_isActive_idx" ON "departments"("isActive");
CREATE UNIQUE INDEX "employees_nationalId_key" ON "employees"("nationalId");
CREATE UNIQUE INDEX "employees_officialEmail_key" ON "employees"("officialEmail");
CREATE INDEX "employees_departmentId_idx" ON "employees"("departmentId");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "employees" ADD CONSTRAINT "employees_dob_joining_check"
    CHECK ("dateOfBirth" IS NULL OR "dateOfBirth" <= "joiningDate");
ALTER TABLE "employees" ADD CONSTRAINT "employees_confirmation_joining_check"
    CHECK ("confirmationDate" IS NULL OR "confirmationDate" >= "joiningDate");
ALTER TABLE "employees" ADD CONSTRAINT "employees_separation_joining_check"
    CHECK ("separationDate" IS NULL OR "separationDate" >= "joiningDate");
ALTER TABLE "employees" ADD CONSTRAINT "employees_separation_reason_check"
    CHECK ("separationDate" IS NULL OR ("separationReason" IS NOT NULL AND btrim("separationReason") <> ''));
ALTER TABLE "employees" ADD CONSTRAINT "employees_separation_inactive_check"
    CHECK ("separationDate" IS NULL OR "isActive" = false);
