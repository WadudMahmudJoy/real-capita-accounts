import "dotenv/config";

import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../apps/api/src/generated/prisma/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNTANT_ROLE_CODE = "ACCOUNTANT";
const ACCOUNTANT_EMAIL = "accountant@realcapita.local";
const DEVELOPMENT_PASSWORD = "ChangeMe123!";
const BCRYPT_ROUNDS = 12;
const VOUCHER_NUMBER_PAD_WIDTH = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeUrlDisplay(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return url.replace(/\/\/[^@]+@/, "//***:***@");
  }
}

function isLocalDb(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const port = u.port;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      port === "55432"
    );
  } catch {
    return false;
  }
}

function parseDbHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return null;
  }
}

function parseDbName(url: string): string | null {
  try {
    const u = new URL(url);
    return (u.pathname ?? "").replace(/^\//, "");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is required to run the demo reset.");
    process.exit(1);
  }

  const isDryRun = process.env.DEMO_RESET_DRY_RUN === "YES";
  const isConfirmed = process.env.CONFIRM_DEMO_RESET === "YES";

  // -------------------------------------------------------------------------
  // Safety header
  // -------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("  REAL CAPITA ACCOUNTS - SAFE DEMO RESET");
  if (isDryRun) {
    console.log("  DRY RUN MODE: no data will be modified.");
  }
  console.log("================================================================================");
  console.log();

  console.log("Database URL :", safeUrlDisplay(connectionString));
  const dbHost = parseDbHost(connectionString);
  const dbName = parseDbName(connectionString);
  if (dbHost) console.log("Database host:", dbHost);
  if (dbName) console.log("Database name:", dbName);
  console.log();

  // -------------------------------------------------------------------------
  // Safety guard 1: Production refusal
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV === "production") {
    console.error("SAFETY REFUSAL: NODE_ENV is 'production'.");
    console.error("Demo reset must never run in production.");
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Safety guard 2: Local DB only
  // -------------------------------------------------------------------------
  if (!isLocalDb(connectionString)) {
    console.error("SAFETY REFUSAL: DATABASE_URL does not appear to be a local/dev database.");
    console.error("Demo reset may only run on localhost, 127.0.0.1, ::1, or port 55432.");
    console.error(`Detected: ${safeUrlDisplay(connectionString)}`);
    process.exit(1);
  }
  console.log("Local DB check: PASSED (host/port appears local).");

  // -------------------------------------------------------------------------
  // Safety guard 3: Explicit confirmation
  // -------------------------------------------------------------------------
  if (!isConfirmed) {
    console.error("SAFETY REFUSAL: CONFIRM_DEMO_RESET is not set to 'YES'.");
    console.error("Set the environment variable CONFIRM_DEMO_RESET=YES to confirm you want to reset demo data.");
    console.error("Example: $env:CONFIRM_DEMO_RESET='YES'; pnpm demo:reset");
    process.exit(1);
  }

  console.log("Confirmation check: CONFIRM_DEMO_RESET=YES (confirmed).");
  console.log();

  // -------------------------------------------------------------------------
  // Backup instruction
  // -------------------------------------------------------------------------
  console.log("------------------------------------------------------------------------");
  console.log("  MANDATORY BACKUP INSTRUCTION");
  console.log("------------------------------------------------------------------------");
  console.log("  Before proceeding, consider running a backup:");
  console.log();
  console.log("  pg_dump -h localhost -p 55432 -U real_capita -d real_capita_accounts -Fc -f demo_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump");
  console.log();
  console.log("  By setting CONFIRM_DEMO_RESET=YES, you acknowledge that you have");
  console.log("  considered a backup and are prepared to reset the demo database.");
  console.log("------------------------------------------------------------------------");
  console.log();

  if (isDryRun) {
    console.log("DRY RUN: The following operations would be performed (no writes will occur):");
    console.log();
  }

  // -------------------------------------------------------------------------
  // Dry-run: print planned operations
  // -------------------------------------------------------------------------
  if (isDryRun) {
    console.log("=== DRY RUN: DATA THAT WOULD BE DELETED ===");
    console.log("  - All AuditEvent rows");
    console.log("  - All AuthSession rows");
    console.log("  - All UserRole rows");
    console.log("  - All BookingReceiptAllocation rows");
    console.log("  - All BookingInstallment rows");
    console.log("  - All Booking rows");
    console.log("  - All BookableItem rows");
    console.log("  - All Customer rows");
    console.log("  - All VoucherLine rows (via Voucher cascade)");
    console.log("  - All Voucher rows");
    console.log("  - All VoucherNumberSequence rows");
    console.log("  - All CashBankAccount rows");
    console.log("  - All LedgerAccount rows");
    console.log("  - All AccountGroup rows");
    console.log("  - All AccountClass rows");
    console.log("  - All CostCenter rows");
    console.log("  - All Project rows");
    console.log("  - All AccountingPeriod rows");
    console.log("  - All FiscalYear rows");
    console.log("  - All Company rows");
    console.log("  - All UserRole rows (recreated below)");
    console.log("  - All User rows except the ACCOUNTANT seed user");
    console.log("  - All Role rows except ACCOUNTANT");

    console.log();
    console.log("=== DRY RUN: DATA THAT WOULD BE RECREATED ===");
    console.log("  - Role: ACCOUNTANT (Accountant)");
    console.log("  - User: accountant@realcapita.local (Accountant User)");
    console.log("  - UserRole: accountant@realcapita.local -> ACCOUNTANT");
    console.log("  - Company: Real Capita Group / Real Capita Group Ltd (BDT)");
    console.log("  - Fiscal Year: FY 2025-2026 (2025-07-01 to 2026-06-30, active)");
    console.log("  - Accounting Period: June 2026 (2026-06-01 to 2026-06-30, OPEN)");
    console.log("  - Project: SK-001 Shanti Kutir (Gazipur, active)");
    console.log("  - Cost Center: SK-LD Shanti Kutir - Land Development (linked to SK-001)");
    console.log("  - 5 Account Classes: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE");
    console.log("  - 3 Account Groups: AG-100 Current Assets, AG-300 Capital & Reserves, AG-500 Operating Expenses");
    console.log("  - 5 Ledger Accounts: 1010, 1020, 1030, 5010, 3010");
    console.log("  - 3 Cash/Bank/MFS Accounts: Office Cash (CASH), City Bank - Uttara Branch (BANK), bKash Merchant - Real Capita (MFS/BKASH)");
    console.log("  - 2 Posted Vouchers:");
    console.log("    - JOURNAL-00001: Capital introduced (100,000 Dr Cash in Hand, 100,000 Cr Capital Introduced)");
    console.log("    - PAYMENT-00001: Land development expense (50,000 Dr Land Development, 50,000 Cr Cash in Hand)");

    console.log();
    console.log("DRY RUN COMPLETE: No data was modified.");
    console.log("================================================================================");
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // Actual reset
  // -------------------------------------------------------------------------
  console.log("Proceeding with demo reset on local/dev database...");
  console.log();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await prisma.$transaction(
      async (tx) => {
        console.log("-- Step 1: Clearing existing data...");

        // Audit events (no FK dependencies on tables we're deleting)
        console.log("  Clearing audit events...");
        await tx.auditEvent.deleteMany();

        // Auth sessions (FK to User)
        console.log("  Clearing auth sessions...");
        await tx.authSession.deleteMany();

        // User roles (FK to User and Role)
        console.log("  Clearing user roles...");
        await tx.userRole.deleteMany();

        // Phase 2M customer booking tables must be cleared before vouchers/projects.
        console.log("  Clearing booking receipt allocations...");
        await tx.bookingReceiptAllocation.deleteMany();

        console.log("  Clearing booking installments...");
        await tx.bookingInstallment.deleteMany();

        console.log("  Clearing bookings...");
        await tx.booking.deleteMany();

        console.log("  Clearing bookable items...");
        await tx.bookableItem.deleteMany();

        console.log("  Clearing customers...");
        await tx.customer.deleteMany();

        // Voucher lines cascade from Voucher, but delete explicitly for clarity
        console.log("  Clearing voucher lines...");
        await tx.voucherLine.deleteMany();

        // Vouchers (FK to Company, FiscalYear, AccountingPeriod, User)
        console.log("  Clearing vouchers...");
        await tx.voucher.deleteMany();

        // Voucher number sequences
        console.log("  Clearing voucher number sequences...");
        await tx.voucherNumberSequence.deleteMany();

        // Cash/bank/MFS accounts (FK to LedgerAccount)
        console.log("  Clearing cash/bank/MFS accounts...");
        await tx.cashBankAccount.deleteMany();

        // Ledger accounts (FK to AccountGroup)
        console.log("  Clearing ledger accounts...");
        await tx.ledgerAccount.deleteMany();

        // Account groups (FK to AccountClass)
        console.log("  Clearing account groups...");
        await tx.accountGroup.deleteMany();

        // Account classes
        console.log("  Clearing account classes...");
        await tx.accountClass.deleteMany();

        // Cost centers (FK to Project)
        console.log("  Clearing cost centers...");
        await tx.costCenter.deleteMany();

        // Projects
        console.log("  Clearing projects...");
        await tx.project.deleteMany();

        // Accounting periods (FK to FiscalYear)
        console.log("  Clearing accounting periods...");
        await tx.accountingPeriod.deleteMany();

        // Fiscal years (FK to Company)
        console.log("  Clearing fiscal years...");
        await tx.fiscalYear.deleteMany();

        // Companies
        console.log("  Clearing companies...");
        await tx.company.deleteMany();

        // Users (except the deterministic seed user)
        console.log("  Clearing non-seed users...");
        await tx.user.deleteMany({
          where: { email: { not: ACCOUNTANT_EMAIL } },
        });

        // Roles (except ACCOUNTANT)
        console.log("  Clearing non-ACCOUNTANT roles...");
        await tx.role.deleteMany({
          where: { code: { not: ACCOUNTANT_ROLE_CODE } },
        });

        console.log("  Data cleared successfully.");
        console.log();

        // -----------------------------------------------------------------
        // Step 2: Recreate deterministic dataset
        // -----------------------------------------------------------------
        console.log("-- Step 2: Recreating deterministic demo dataset...");

        // 2a. Role
        console.log("  Creating ACCOUNTANT role...");
        const role = await tx.role.upsert({
          create: {
            code: ACCOUNTANT_ROLE_CODE,
            name: "Accountant",
            description: "Development-only Accountant role for the confirmed Phase 1A operator.",
          },
          update: {
            name: "Accountant",
            description: "Development-only Accountant role for the confirmed Phase 1A operator.",
          },
          where: { code: ACCOUNTANT_ROLE_CODE },
        });

        // 2b. User
        console.log("  Creating seed user...");
        const passwordHash = await hash(DEVELOPMENT_PASSWORD, BCRYPT_ROUNDS);
        const user = await tx.user.upsert({
          create: {
            email: ACCOUNTANT_EMAIL,
            fullName: "Accountant User",
            passwordHash,
            isActive: true,
          },
          update: {
            fullName: "Accountant User",
            passwordHash,
            isActive: true,
          },
          where: { email: ACCOUNTANT_EMAIL },
        });

        await tx.userRole.upsert({
          create: { userId: user.id, roleId: role.id },
          update: {},
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
        });

        // 2c. Company
        console.log("  Creating company...");
        const company = await tx.company.upsert({
          create: {
            name: "Real Capita Group",
            legalName: "Real Capita Group Ltd",
            currency: "BDT",
          },
          update: {
            name: "Real Capita Group",
            legalName: "Real Capita Group Ltd",
            currency: "BDT",
          },
          where: { singletonKey: "PRIMARY" },
        });

        // 2d. Fiscal Year FY 2025-2026
        console.log("  Creating fiscal year FY 2025-2026...");
        const fy = await tx.fiscalYear.create({
          data: {
            companyId: company.id,
            name: "FY 2025-2026",
            startDate: new Date("2025-07-01T00:00:00.000Z"),
            endDate: new Date("2026-06-30T23:59:59.999Z"),
            isActive: true,
            isClosed: false,
          },
        });

        // 2e. Accounting Period June 2026
        console.log("  Creating accounting period June 2026...");
        const period = await tx.accountingPeriod.create({
          data: {
            fiscalYearId: fy.id,
            name: "June 2026",
            startDate: new Date("2026-06-01T00:00:00.000Z"),
            endDate: new Date("2026-06-30T23:59:59.999Z"),
            status: "OPEN",
          },
        });

        // 2f. Project SK-001
        console.log("  Creating project SK-001 Shanti Kutir...");
        const project = await tx.project.create({
          data: {
            code: "SK-001",
            name: "Shanti Kutir",
            location: "Gazipur",
            isActive: true,
          },
        });

        // 2g. Cost Center SK-LD
        console.log("  Creating cost center SK-LD...");
        const costCenter = await tx.costCenter.create({
          data: {
            projectId: project.id,
            code: "SK-LD",
            name: "Shanti Kutir - Land Development",
            isActive: true,
          },
        });

        // 2h. Account Classes
        console.log("  Creating account classes...");
        const assetClass = await tx.accountClass.create({
          data: { code: "ASSET", name: "Asset", normalBalance: "DEBIT" },
        });
        const liabilityClass = await tx.accountClass.create({
          data: { code: "LIABILITY", name: "Liability", normalBalance: "CREDIT" },
        });
        const equityClass = await tx.accountClass.create({
          data: { code: "EQUITY", name: "Equity", normalBalance: "CREDIT" },
        });
        const incomeClass = await tx.accountClass.create({
          data: { code: "INCOME", name: "Income", normalBalance: "CREDIT" },
        });
        const expenseClass = await tx.accountClass.create({
          data: { code: "EXPENSE", name: "Expense", normalBalance: "DEBIT" },
        });

        // 2i. Account Groups
        console.log("  Creating account groups...");
        const ag100 = await tx.accountGroup.create({
          data: {
            accountClassId: assetClass.id,
            code: "AG-100",
            name: "Current Assets",
            isActive: true,
          },
        });
        const ag300 = await tx.accountGroup.create({
          data: {
            accountClassId: equityClass.id,
            code: "AG-300",
            name: "Capital & Reserves",
            isActive: true,
          },
        });
        const ag500 = await tx.accountGroup.create({
          data: {
            accountClassId: expenseClass.id,
            code: "AG-500",
            name: "Operating Expenses",
            isActive: true,
          },
        });

        // 2j. Ledger Accounts
        console.log("  Creating ledger accounts...");
        const ledger1010 = await tx.ledgerAccount.create({
          data: {
            accountGroupId: ag100.id,
            code: "1010",
            name: "Cash in Hand",
            normalBalance: "DEBIT",
            requiresProject: false,
            requiresCostCenter: false,
            isCashBank: true,
            isActive: true,
          },
        });
        const ledger1020 = await tx.ledgerAccount.create({
          data: {
            accountGroupId: ag100.id,
            code: "1020",
            name: "City Bank Account",
            normalBalance: "DEBIT",
            requiresProject: false,
            requiresCostCenter: false,
            isCashBank: true,
            isActive: true,
          },
        });
        const ledger1030 = await tx.ledgerAccount.create({
          data: {
            accountGroupId: ag100.id,
            code: "1030",
            name: "bKash Merchant Wallet",
            normalBalance: "DEBIT",
            requiresProject: false,
            requiresCostCenter: false,
            isCashBank: true,
            isActive: true,
          },
        });
        const ledger5010 = await tx.ledgerAccount.create({
          data: {
            accountGroupId: ag500.id,
            code: "5010",
            name: "Land Development Expense",
            normalBalance: "DEBIT",
            requiresProject: true,
            requiresCostCenter: true,
            isCashBank: false,
            isActive: true,
          },
        });
        const ledger3010 = await tx.ledgerAccount.create({
          data: {
            accountGroupId: ag300.id,
            code: "3010",
            name: "Capital Introduced",
            normalBalance: "CREDIT",
            requiresProject: false,
            requiresCostCenter: false,
            isCashBank: false,
            isActive: true,
          },
        });

        // 2k. Cash/Bank/MFS Accounts
        console.log("  Creating cash/bank/MFS accounts...");
        const officeCash = await tx.cashBankAccount.create({
          data: {
            ledgerAccountId: ledger1010.id,
            displayName: "Office Cash",
            accountType: "CASH",
            isActive: true,
          },
        });
        const cityBank = await tx.cashBankAccount.create({
          data: {
            ledgerAccountId: ledger1020.id,
            displayName: "City Bank - Uttara Branch",
            accountType: "BANK",
            bankName: "City Bank",
            branch: "Uttara",
            isActive: true,
          },
        });
        const bKashMerchant = await tx.cashBankAccount.create({
          data: {
            ledgerAccountId: ledger1030.id,
            displayName: "bKash Merchant - Real Capita",
            accountType: "MFS",
            provider: "BKASH",
            walletNumber: "017XXXXXXX",
            isActive: true,
          },
        });

        // 2l. Voucher 1: Capital Introduced (JOURNAL)
        console.log("  Creating Voucher 1: Capital Introduced (JOURNAL)...");
        const voucher1No = await reserveVoucherNumber(
          tx,
          company.id,
          fy.id,
          "JOURNAL",
        );
        const voucher1Date = new Date("2026-06-01T00:00:00.000Z");
        const postingDate = new Date();

        const voucher1 = await tx.voucher.create({
          data: {
            companyId: company.id,
            fiscalYearId: fy.id,
            accountingPeriodId: period.id,
            voucherType: "JOURNAL",
            status: "POSTED",
            systemVoucherNo: voucher1No,
            voucherDate: voucher1Date,
            postingDate,
            narration: "Capital introduced by the proprietor",
            totalDebit: new Prisma.Decimal("100000.00"),
            totalCredit: new Prisma.Decimal("100000.00"),
            createdById: user.id,
            postedById: user.id,
            lines: {
              create: [
                {
                  lineNo: 1,
                  side: "DEBIT",
                  ledgerAccountId: ledger1010.id,
                  cashBankAccountId: officeCash.id,
                  amount: new Prisma.Decimal("100000.00"),
                },
                {
                  lineNo: 2,
                  side: "CREDIT",
                  ledgerAccountId: ledger3010.id,
                  amount: new Prisma.Decimal("100000.00"),
                },
              ],
            },
          },
        });

        // 2m. Voucher 2: Project Land Development Expense (PAYMENT)
        console.log("  Creating Voucher 2: Land Development Expense (PAYMENT)...");
        const voucher2No = await reserveVoucherNumber(
          tx,
          company.id,
          fy.id,
          "PAYMENT",
        );
        const voucher2Date = new Date("2026-06-10T00:00:00.000Z");

        const voucher2 = await tx.voucher.create({
          data: {
            companyId: company.id,
            fiscalYearId: fy.id,
            accountingPeriodId: period.id,
            voucherType: "PAYMENT",
            status: "POSTED",
            systemVoucherNo: voucher2No,
            voucherDate: voucher2Date,
            postingDate,
            narration: "Land development expense for Shanti Kutir project",
            totalDebit: new Prisma.Decimal("50000.00"),
            totalCredit: new Prisma.Decimal("50000.00"),
            createdById: user.id,
            postedById: user.id,
            lines: {
              create: [
                {
                  lineNo: 1,
                  side: "DEBIT",
                  ledgerAccountId: ledger5010.id,
                  projectId: project.id,
                  costCenterId: costCenter.id,
                  amount: new Prisma.Decimal("50000.00"),
                },
                {
                  lineNo: 2,
                  side: "CREDIT",
                  ledgerAccountId: ledger1010.id,
                  cashBankAccountId: officeCash.id,
                  amount: new Prisma.Decimal("50000.00"),
                },
              ],
            },
          },
        });

        console.log();
        console.log("  Deterministic dataset created successfully.");
        console.log(`  Voucher 1: ${voucher1.systemVoucherNo} (JOURNAL, capital introduced, 100,000)`);
        console.log(`  Voucher 2: ${voucher2.systemVoucherNo} (PAYMENT, land development expense, 50,000)`);
      },
      {
        timeout: 30000,
      },
    );

    console.log();
    console.log("================================================================================");
    console.log("  DEMO RESET COMPLETE");
    console.log("================================================================================");
    console.log();
    console.log("  Deterministic dataset created:");
    console.log("  - 1 Company: Real Capita Group (BDT)");
    console.log("  - 1 Fiscal Year: FY 2025-2026");
    console.log("  - 1 Accounting Period: June 2026 (OPEN)");
    console.log("  - 1 Project: SK-001 Shanti Kutir");
    console.log("  - 1 Cost Center: SK-LD");
    console.log("  - 5 Account Classes, 3 Account Groups, 5 Ledger Accounts");
    console.log("  - 3 Cash/Bank/MFS Accounts");
    console.log("  - 2 Posted Vouchers");
    console.log("  - 1 Seed User: accountant@realcapita.local");
    console.log();
    console.log("  Expected report results:");
    console.log("  - Cash Book closing: 50,000 Dr");
    console.log("  - Ledger 5010 closing: 50,000 Dr");
    console.log("  - Trial Balance: balanced");
    console.log("  - Income Statement: net loss 50,000");
    console.log("  - Project Ledger: 1 SK-001/SK-LD expense line (50,000)");
    console.log();
    console.log("  Run 'pnpm demo:audit' to verify the dataset.");
    console.log("================================================================================");
  } finally {
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Voucher number reservation (mirrors VoucherService.reserveVoucherNumber)
// ---------------------------------------------------------------------------

async function reserveVoucherNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  fiscalYearId: string,
  voucherType: string,
): Promise<string> {
  const where = {
    companyId_fiscalYearId_voucherType: {
      companyId,
      fiscalYearId,
      voucherType: voucherType as any,
    },
  };

  await tx.voucherNumberSequence.upsert({
    where,
    create: {
      companyId,
      fiscalYearId,
      voucherType: voucherType as any,
      prefix: voucherType,
      nextNumber: 1,
    },
    update: {},
  });

  const reserved = await tx.voucherNumberSequence.update({
    where,
    data: { nextNumber: { increment: 1 } },
  });

  const assignedNumber = reserved.nextNumber - 1;
  const prefix = reserved.prefix ?? voucherType;

  return `${prefix}-${String(assignedNumber).padStart(VOUCHER_NUMBER_PAD_WIDTH, "0")}`;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
