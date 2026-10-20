-- HR-3B Task 001: additive centralized regular payroll persistence only.
-- ACCEPTANCE GATE before execution: independently verify the existing company
-- with singletonKey = 'PRIMARY' is the Real Capita Group payroll parent.
-- This migration does not resolve, create, or update any company record.
-- Company FK guarantees existence, not PRIMARY ownership. Future backend code
-- must resolve the unique marker, fail closed if missing/inactive, and ignore
-- active office, company names and hardcoded company IDs.
-- Global month uniqueness + run/employee uniqueness prevent duplicate regular
-- employee/month inclusion, even if an incorrect company bypasses the backend.
-- Required snapshots preserve stored values; backend must validate JSON decimal
-- strings/source consistency and freeze approved rows. No immutability trigger
-- or optimistic-locking operation is implemented by this persistence task.

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "payrollYear" INTEGER NOT NULL,
    "payrollMonth" INTEGER NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "companySnapshot" JSONB NOT NULL,
    "snapshotSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_lines" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salaryAssignmentId" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "paymentProfileId" TEXT NOT NULL,
    "employeeSnapshot" JSONB NOT NULL,
    "salarySnapshot" JSONB NOT NULL,
    "paymentProfileSnapshot" JSONB NOT NULL,
    "calculationSnapshot" JSONB NOT NULL,
    "grossSalary" DECIMAL(18,2) NOT NULL,
    "totalEarnings" DECIMAL(18,2) NOT NULL,
    "attendanceDeduction" DECIMAL(18,2) NOT NULL,
    "providentFundDeduction" DECIMAL(18,2) NOT NULL,
    "loanOrSalaryAdvanceDeduction" DECIMAL(18,2) NOT NULL,
    "aitDeduction" DECIMAL(18,2) NOT NULL,
    "otherDeductionsTotal" DECIMAL(18,2) NOT NULL,
    "totalDeductions" DECIMAL(18,2) NOT NULL,
    "netPay" DECIMAL(18,2) NOT NULL,
    "bankPay" DECIMAL(18,2) NOT NULL,
    "cashPay" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_run_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_runs_companyId_status_idx" ON "payroll_runs"("companyId", "status");

-- CreateIndex
CREATE INDEX "payroll_runs_createdById_idx" ON "payroll_runs"("createdById");

-- CreateIndex
CREATE INDEX "payroll_runs_approvedById_idx" ON "payroll_runs"("approvedById");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_payrollYear_payrollMonth_key" ON "payroll_runs"("payrollYear", "payrollMonth");

-- CreateIndex
CREATE INDEX "payroll_run_lines_employeeId_idx" ON "payroll_run_lines"("employeeId");

-- CreateIndex
CREATE INDEX "payroll_run_lines_salaryAssignmentId_idx" ON "payroll_run_lines"("salaryAssignmentId");

-- CreateIndex
CREATE INDEX "payroll_run_lines_salaryStructureId_idx" ON "payroll_run_lines"("salaryStructureId");

-- CreateIndex
CREATE INDEX "payroll_run_lines_paymentProfileId_idx" ON "payroll_run_lines"("paymentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_lines_payrollRunId_employeeId_key" ON "payroll_run_lines"("payrollRunId", "employeeId");

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "payroll_runs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_salaryAssignmentId_fkey" FOREIGN KEY ("salaryAssignmentId") REFERENCES "employee_salary_assignments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "salary_structures"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_paymentProfileId_fkey" FOREIGN KEY ("paymentProfileId") REFERENCES "employee_payment_profiles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- Persistence integrity only; these checks introduce no salary formulas.
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_month_check" CHECK ("payrollMonth" BETWEEN 1 AND 12);
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_year_check" CHECK ("payrollYear" BETWEEN 1 AND 9999);
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_version_check" CHECK ("version" >= 1 AND "snapshotSchemaVersion" >= 1);
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approval_metadata_check" CHECK (("status" = 'DRAFT' AND "approvedById" IS NULL AND "approvedAt" IS NULL) OR ("status" = 'APPROVED' AND "approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL));

-- Basic monetary integrity only; no percentage or attendance policy.
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_gross_salary_positive_check" CHECK ("grossSalary" > 0);
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_total_earnings_positive_check" CHECK ("totalEarnings" > 0);
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_amounts_non_negative_check" CHECK ("attendanceDeduction" >= 0 AND "providentFundDeduction" >= 0 AND "loanOrSalaryAdvanceDeduction" >= 0 AND "aitDeduction" >= 0 AND "otherDeductionsTotal" >= 0 AND "totalDeductions" >= 0 AND "netPay" >= 0 AND "bankPay" >= 0 AND "cashPay" >= 0);
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_deductions_reconcile_check" CHECK ("totalDeductions" = "attendanceDeduction" + "providentFundDeduction" + "loanOrSalaryAdvanceDeduction" + "aitDeduction" + "otherDeductionsTotal");
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_net_pay_reconcile_check" CHECK ("netPay" = "totalEarnings" - "totalDeductions");
ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_payments_reconcile_check" CHECK ("bankPay" + "cashPay" = "netPay");
