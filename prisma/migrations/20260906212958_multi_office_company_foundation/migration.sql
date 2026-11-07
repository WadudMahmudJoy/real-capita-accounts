-- CreateEnum
CREATE TYPE "CompanyBackgroundMode" AS ENUM ('DEFAULT_PREMIUM', 'CUSTOM');

-- AlterTable
ALTER TABLE "auth_sessions" ADD COLUMN     "activeCompanyId" TEXT;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "backgroundMode" "CompanyBackgroundMode" NOT NULL DEFAULT 'DEFAULT_PREMIUM',
ADD COLUMN     "brandAccentColor" TEXT,
ADD COLUMN     "customBackgroundPath" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "officeLogoPath" TEXT,
ADD COLUMN     "printFooterText" TEXT,
ADD COLUMN     "printHeaderName" TEXT,
ADD COLUMN     "printLogoPath" TEXT,
ALTER COLUMN "singletonKey" DROP NOT NULL,
ALTER COLUMN "singletonKey" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "auth_sessions_activeCompanyId_idx" ON "auth_sessions"("activeCompanyId");

-- RenameForeignKey
ALTER TABLE "company_calendar_exceptions" RENAME CONSTRAINT "company_calendar_exceptions_replacesExceptionId_companyId_busin" TO "company_calendar_exceptions_replacesExceptionId_companyId__fkey";

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_activeCompanyId_fkey" FOREIGN KEY ("activeCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
