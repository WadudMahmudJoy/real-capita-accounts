-- CreateEnum
CREATE TYPE "SalaryConfigurationStatus" AS ENUM ('DRAFT', 'APPROVED', 'INACTIVE');

-- Enable equality support for text columns in GiST exclusion constraints.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "joiningDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "SalaryConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structure_components" (
    "id" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DECIMAL(7,4) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structure_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_salary_assignments" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "grossSalary" DECIMAL(18,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "SalaryConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "changeReason" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_salary_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_payment_profiles" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "selectedBankPercentage" DECIMAL(9,6) NOT NULL DEFAULT 60,
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "branchName" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "SalaryConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "changeReason" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_payment_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeCode_key" ON "employees"("employeeCode");

-- CreateIndex
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");

-- CreateIndex
CREATE INDEX "employees_isDeleted_idx" ON "employees"("isDeleted");

-- CreateIndex
CREATE INDEX "salary_structures_status_idx" ON "salary_structures"("status");

-- CreateIndex
CREATE INDEX "salary_structures_effectiveFrom_effectiveTo_idx" ON "salary_structures"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_code_version_key" ON "salary_structures"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structure_components_salaryStructureId_code_key" ON "salary_structure_components"("salaryStructureId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structure_components_salaryStructureId_displayOrder_key" ON "salary_structure_components"("salaryStructureId", "displayOrder");

-- CreateIndex
CREATE INDEX "employee_salary_assignments_employeeId_effectiveFrom_idx" ON "employee_salary_assignments"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "employee_salary_assignments_employeeId_status_idx" ON "employee_salary_assignments"("employeeId", "status");

-- CreateIndex
CREATE INDEX "employee_salary_assignments_salaryStructureId_idx" ON "employee_salary_assignments"("salaryStructureId");

-- CreateIndex
CREATE INDEX "employee_payment_profiles_employeeId_effectiveFrom_idx" ON "employee_payment_profiles"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "employee_payment_profiles_employeeId_status_idx" ON "employee_payment_profiles"("employeeId", "status");

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "salary_structures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "salary_structures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payment_profiles" ADD CONSTRAINT "employee_payment_profiles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payment_profiles" ADD CONSTRAINT "employee_payment_profiles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_payment_profiles" ADD CONSTRAINT "employee_payment_profiles_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_version_check" CHECK ("version" > 0);
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_effective_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_percentage_check" CHECK ("percentage" > 0 AND "percentage" <= 100);
ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_display_order_check" CHECK ("displayOrder" > 0);
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_gross_salary_check" CHECK ("grossSalary" > 0);
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_effective_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");
ALTER TABLE "employee_payment_profiles" ADD CONSTRAINT "employee_payment_profiles_bank_percentage_check" CHECK ("selectedBankPercentage" >= 0 AND "selectedBankPercentage" <= 100);
ALTER TABLE "employee_payment_profiles" ADD CONSTRAINT "employee_payment_profiles_effective_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom");

-- Prevent concurrent approvals from creating overlapping half-open effective ranges.
ALTER TABLE "employee_salary_assignments" ADD CONSTRAINT "employee_salary_assignments_approved_range_excl"
EXCLUDE USING gist (
    "employeeId" WITH =,
    tsrange("effectiveFrom", "effectiveTo", '[)') WITH &&
) WHERE ("status" = 'APPROVED'::"SalaryConfigurationStatus");

ALTER TABLE "employee_payment_profiles" ADD CONSTRAINT "employee_payment_profiles_approved_range_excl"
EXCLUDE USING gist (
    "employeeId" WITH =,
    tsrange("effectiveFrom", "effectiveTo", '[)') WITH &&
) WHERE ("status" = 'APPROVED'::"SalaryConfigurationStatus");
