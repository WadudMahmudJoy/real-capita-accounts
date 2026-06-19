-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "reversalOfVoucherId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_reversalOfVoucherId_key" ON "vouchers"("reversalOfVoucherId");

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_reversalOfVoucherId_fkey" FOREIGN KEY ("reversalOfVoucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
