-- CreateEnum
CREATE TYPE "MfsProvider" AS ENUM ('BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'OTHER');

-- AlterEnum
ALTER TYPE "CashBankAccountType" ADD VALUE 'MFS';

-- AlterTable
ALTER TABLE "cash_bank_accounts" ADD COLUMN     "accountHolderName" TEXT,
ADD COLUMN     "provider" "MfsProvider",
ADD COLUMN     "providerOtherName" TEXT,
ADD COLUMN     "walletNumber" TEXT;
