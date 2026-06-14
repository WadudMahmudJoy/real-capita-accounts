-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('DEBIT', 'CREDIT', 'JOURNAL', 'CONTRA', 'PAYMENT', 'RECEIPT');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('DRAFT', 'POSTED');

-- CreateEnum
CREATE TYPE "VoucherLineSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "voucherType" "VoucherType" NOT NULL,
    "status" "VoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "systemVoucherNo" TEXT NOT NULL,
    "physicalSiNo" TEXT,
    "voucherDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3),
    "narration" TEXT,
    "totalDebit" DECIMAL(18,2) NOT NULL,
    "totalCredit" DECIMAL(18,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_lines" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "side" "VoucherLineSide" NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "projectId" TEXT,
    "costCenterId" TEXT,
    "cashBankAccountId" TEXT,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_number_sequences" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "voucherType" "VoucherType" NOT NULL,
    "prefix" TEXT,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voucher_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vouchers_companyId_idx" ON "vouchers"("companyId");

-- CreateIndex
CREATE INDEX "vouchers_fiscalYearId_idx" ON "vouchers"("fiscalYearId");

-- CreateIndex
CREATE INDEX "vouchers_accountingPeriodId_idx" ON "vouchers"("accountingPeriodId");

-- CreateIndex
CREATE INDEX "vouchers_voucherDate_idx" ON "vouchers"("voucherDate");

-- CreateIndex
CREATE INDEX "vouchers_status_idx" ON "vouchers"("status");

-- CreateIndex
CREATE INDEX "vouchers_voucherType_idx" ON "vouchers"("voucherType");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_companyId_fiscalYearId_systemVoucherNo_key" ON "vouchers"("companyId", "fiscalYearId", "systemVoucherNo");

-- CreateIndex
CREATE INDEX "voucher_lines_ledgerAccountId_idx" ON "voucher_lines"("ledgerAccountId");

-- CreateIndex
CREATE INDEX "voucher_lines_projectId_idx" ON "voucher_lines"("projectId");

-- CreateIndex
CREATE INDEX "voucher_lines_costCenterId_idx" ON "voucher_lines"("costCenterId");

-- CreateIndex
CREATE INDEX "voucher_lines_cashBankAccountId_idx" ON "voucher_lines"("cashBankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_lines_voucherId_lineNo_key" ON "voucher_lines"("voucherId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_number_sequences_companyId_fiscalYearId_voucherType_key" ON "voucher_number_sequences"("companyId", "fiscalYearId", "voucherType");

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_lines" ADD CONSTRAINT "voucher_lines_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_number_sequences" ADD CONSTRAINT "voucher_number_sequences_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_number_sequences" ADD CONSTRAINT "voucher_number_sequences_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
