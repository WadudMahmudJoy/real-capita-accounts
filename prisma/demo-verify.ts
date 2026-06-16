import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/api/src/generated/prisma/client";

// ---------------------------------------------------------------------------
// Verify state
// ---------------------------------------------------------------------------

interface VerifyAssertion {
  section: string;
  label: string;
  passed: boolean;
  detail?: string;
}

const assertions: VerifyAssertion[] = [];

function pass(section: string, label: string, detail?: string) {
  assertions.push({ section, label, passed: true, detail });
}

function fail(section: string, label: string, detail?: string) {
  assertions.push({ section, label, passed: false, detail });
}

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
// Main verify
// ---------------------------------------------------------------------------

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is required to run the verification.");
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // 0. Safety header
  // -----------------------------------------------------------------------
  console.log("================================================================================");
  console.log("  REAL CAPITA ACCOUNTS - DEMO VERIFICATION");
  console.log("  READ-ONLY VERIFY: no data was modified.");
  console.log("================================================================================");
  console.log();

  console.log("Database URL :", safeUrlDisplay(connectionString));
  const dbHost = parseDbHost(connectionString);
  const dbName = parseDbName(connectionString);
  if (dbHost) console.log("Database host:", dbHost);
  if (dbName) console.log("Database name:", dbName);
  console.log();

  if (!isLocalDb(connectionString)) {
    console.warn("WARNING: DATABASE_URL does not appear to be a local/dev database.");
    console.warn("Verification is read-only, but verify output may not match expected demo values.");
    console.log();
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // -------------------------------------------------------------------
    // SECTION 1: Required Entity Assertions
    // -------------------------------------------------------------------
    const section1 = "1. Entity Assertions";

    // 1a. Company
    const company = await prisma.company.findFirst();
    if (company) {
      const nameOk = company.name === "Real Capita Group";
      const legalOk = company.legalName === "Real Capita Group Ltd";
      const currencyOk = company.currency === "BDT";

      if (nameOk && currencyOk) {
        pass(section1, "Company exists: Real Capita Group, currency BDT");
      } else {
        fail(section1, `Company mismatch: name="${company.name}", currency="${company.currency}" (expected Real Capita Group, BDT)`);
      }

      if (legalOk) {
        pass(section1, "Company legal name: Real Capita Group Ltd");
      } else {
        fail(section1, `Company legal name mismatch: "${company.legalName ?? "(none)"}" (expected Real Capita Group Ltd)`);
      }
    } else {
      fail(section1, "No company found.");
      fail(section1, "Company legal name: no company.");
    }

    // 1b. Exactly one active FY 2025-2026 for the demo company
    const fy2526 = await prisma.fiscalYear.findFirst({
      where: { name: "FY 2025-2026", isActive: true, isClosed: false },
    });
    if (fy2526) {
      const fy2526Count = await prisma.fiscalYear.count({
        where: { name: "FY 2025-2026" },
      });
      if (fy2526Count === 1) {
        pass(section1, "Exactly one FY 2025-2026 exists and is active/open");
      } else {
        fail(section1, `FY 2025-2026 count: ${fy2526Count} (expected exactly 1)`);
      }
    } else {
      fail(section1, "FY 2025-2026 not found or not active/open");
    }

    // 1c. June 2026 period exists and is OPEN
    const jun26Period = fy2526
      ? await prisma.accountingPeriod.findFirst({
          where: { fiscalYearId: fy2526.id, name: "June 2026", status: "OPEN" },
        })
      : null;
    if (jun26Period) {
      pass(section1, "June 2026 period exists and is OPEN");
    } else {
      fail(section1, "June 2026 period not found or not OPEN");
    }

    // 1d. Project SK-001 Shanti Kutir exists and active
    const sk001 = await prisma.project.findUnique({
      where: { code: "SK-001" },
    });
    if (sk001 && sk001.isActive) {
      pass(section1, "Project SK-001 Shanti Kutir exists and active");
    } else if (sk001) {
      fail(section1, "Project SK-001 exists but is not active");
    } else {
      fail(section1, "Project SK-001 Shanti Kutir not found");
    }

    // 1e. Cost center SK-LD exists, active, and linked to SK-001
    const skLd = sk001
      ? await prisma.costCenter.findFirst({
          where: { code: "SK-LD", projectId: sk001.id },
        })
      : null;
    if (skLd && skLd.isActive) {
      pass(section1, "Cost center SK-LD exists, active, and linked to SK-001");
    } else if (skLd) {
      fail(section1, "Cost center SK-LD exists but is not active");
    } else {
      // Check if it exists but linked to wrong project
      const skLdAny = await prisma.costCenter.findFirst({ where: { code: "SK-LD" } });
      if (skLdAny) {
        fail(section1, `Cost center SK-LD exists but not linked to SK-001 (project: ${skLdAny.projectId})`);
      } else {
        fail(section1, "Cost center SK-LD not found");
      }
    }

    // 1f. Account classes exist with correct normal balances
    const expectedClasses = [
      { code: "ASSET", normalBalance: "DEBIT" },
      { code: "LIABILITY", normalBalance: "CREDIT" },
      { code: "EQUITY", normalBalance: "CREDIT" },
      { code: "INCOME", normalBalance: "CREDIT" },
      { code: "EXPENSE", normalBalance: "DEBIT" },
    ];

    const acClasses = await prisma.accountClass.findMany();
    const acClassMap = new Map(acClasses.map((c) => [c.code, c]));

    for (const ec of expectedClasses) {
      const found = acClassMap.get(ec.code);
      if (found && found.normalBalance === ec.normalBalance) {
        pass(section1, `Account class ${ec.code} exists with ${ec.normalBalance} normal balance`);
      } else if (found) {
        fail(section1, `Account class ${ec.code} has wrong normal balance: ${found.normalBalance} (expected ${ec.normalBalance})`);
      } else {
        fail(section1, `Account class ${ec.code} not found`);
      }
    }

    // 1g. Account groups exist
    const expectedGroups = ["AG-100", "AG-300", "AG-500"];
    const ags = await prisma.accountGroup.findMany({
      where: { code: { in: expectedGroups } },
    });
    const agMap = new Map(ags.map((g) => [g.code, g]));

    for (const code of expectedGroups) {
      if (agMap.has(code)) {
        pass(section1, `Account group ${code} exists`);
      } else {
        fail(section1, `Account group ${code} not found`);
      }
    }

    // 1h. Ledgers exist and match expected flags
    const expectedLedgers = [
      { code: "1010", name: "Cash in Hand", isCashBank: true, normalBalance: "DEBIT", requiresProject: false, requiresCostCenter: false },
      { code: "1020", name: "City Bank Account", isCashBank: true, normalBalance: "DEBIT", requiresProject: false, requiresCostCenter: false },
      { code: "1030", name: "bKash Merchant Wallet", isCashBank: true, normalBalance: "DEBIT", requiresProject: false, requiresCostCenter: false },
      { code: "5010", name: "Land Development Expense", isCashBank: false, normalBalance: "DEBIT", requiresProject: true, requiresCostCenter: true },
      { code: "3010", name: "Capital Introduced", isCashBank: false, normalBalance: "CREDIT", requiresProject: false, requiresCostCenter: false },
    ];

    const ledgers = await prisma.ledgerAccount.findMany({
      where: { code: { in: expectedLedgers.map((l) => l.code) } },
      include: { accountGroup: { include: { accountClass: true } } },
    });
    const ledgerMap = new Map(ledgers.map((l) => [l.code, l]));

    for (const el of expectedLedgers) {
      const found = ledgerMap.get(el.code);
      if (!found) {
        fail(section1, `Ledger ${el.code} not found`);
        continue;
      }
      if (!found.isActive) {
        fail(section1, `Ledger ${el.code} exists but is inactive`);
        continue;
      }

      const issues: string[] = [];
      if (found.name !== el.name) issues.push(`name="${found.name}"`);
      if (found.isCashBank !== el.isCashBank) issues.push(`isCashBank=${found.isCashBank}`);
      if (found.normalBalance !== el.normalBalance) issues.push(`normalBalance=${found.normalBalance}`);
      if (found.requiresProject !== el.requiresProject) issues.push(`requiresProject=${found.requiresProject}`);
      if (found.requiresCostCenter !== el.requiresCostCenter) issues.push(`requiresCostCenter=${found.requiresCostCenter}`);

      if (issues.length === 0) {
        pass(section1, `Ledger ${el.code} ${el.name} exists with correct flags`);
      } else {
        fail(section1, `Ledger ${el.code} ${el.name} flag mismatch: ${issues.join(", ")}`);
      }
    }

    // 1i. Cash/Bank/MFS accounts exist
    const expectedCbas = [
      { displayName: "Office Cash", accountType: "CASH", ledgerCode: "1010" },
      { displayName: "City Bank - Uttara Branch", accountType: "BANK", ledgerCode: "1020" },
      { displayName: "bKash Merchant - Real Capita", accountType: "MFS", ledgerCode: "1030" },
    ];

    const cbas = await prisma.cashBankAccount.findMany({
      where: { displayName: { in: expectedCbas.map((c) => c.displayName) } },
      include: { ledgerAccount: true },
    });
    const cbaMap = new Map(cbas.map((c) => [c.displayName, c]));

    for (const ec of expectedCbas) {
      const found = cbaMap.get(ec.displayName);
      if (!found) {
        fail(section1, `Cash/Bank/MFS account "${ec.displayName}" not found`);
        continue;
      }
      if (!found.isActive) {
        fail(section1, `Cash/Bank/MFS account "${ec.displayName}" exists but is inactive`);
        continue;
      }
      if (found.accountType !== ec.accountType) {
        fail(section1, `Cash/Bank/MFS account "${ec.displayName}" has wrong type: ${found.accountType} (expected ${ec.accountType})`);
        continue;
      }
      if (found.ledgerAccount.code !== ec.ledgerCode) {
        fail(section1, `Cash/Bank/MFS account "${ec.displayName}" linked to wrong ledger: ${found.ledgerAccount.code} (expected ${ec.ledgerCode})`);
        continue;
      }

      // Extra checks for MFS
      if (ec.accountType === "MFS") {
        if (found.provider !== "BKASH") {
          fail(section1, `bKash Merchant - Real Capita: provider=${found.provider ?? "null"} (expected BKASH)`);
        } else {
          pass(section1, `Cash/Bank/MFS account "${ec.displayName}" exists, type=${ec.accountType}, linked to ${ec.ledgerCode}, provider=BKASH`);
        }
      } else {
        pass(section1, `Cash/Bank/MFS account "${ec.displayName}" exists, type=${ec.accountType}, linked to ${ec.ledgerCode}`);
      }
    }

    // 1j. Seed user exists
    const seedUser = await prisma.user.findUnique({
      where: { email: "accountant@realcapita.local" },
      include: { roles: { include: { role: true } } },
    });
    if (seedUser) {
      if (!seedUser.isActive) {
        fail(section1, "Seed user accountant@realcapita.local exists but is inactive");
      } else {
        const hasAccountant = seedUser.roles.some((ur) => ur.role.code === "ACCOUNTANT");
        if (hasAccountant) {
          // Check password is not plaintext
          const isPlaintext = seedUser.passwordHash === "ChangeMe123!";
          if (isPlaintext) {
            fail(section1, "Seed user password appears to be plaintext (not hashed)");
          } else {
            pass(section1, "Seed user accountant@realcapita.local exists, active, ACCOUNTANT role, password hashed");
          }
        } else {
          fail(section1, "Seed user exists but does not have ACCOUNTANT role");
        }
      }
    } else {
      fail(section1, "Seed user accountant@realcapita.local not found");
    }

    console.log();

    // -------------------------------------------------------------------
    // SECTION 2: Required Voucher Assertions
    // -------------------------------------------------------------------
    const section2 = "2. Voucher Assertions";

    // 2a. Exactly 2 non-deleted posted vouchers
    const postedVouchers = await prisma.voucher.findMany({
      where: { status: "POSTED", isDeleted: false },
      orderBy: { systemVoucherNo: "asc" },
      include: {
        lines: {
          include: {
            ledgerAccount: true,
            project: true,
            costCenter: true,
            cashBankAccount: true,
          },
          orderBy: { lineNo: "asc" },
        },
        fiscalYear: true,
        accountingPeriod: true,
      },
    });

    const draftVouchers = await prisma.voucher.count({
      where: { status: "DRAFT", isDeleted: false },
    });
    const deletedVouchers = await prisma.voucher.count({
      where: { isDeleted: true },
    });

    if (postedVouchers.length === 2) {
      pass(section2, "Exactly 2 non-deleted posted vouchers exist");
    } else {
      fail(section2, `Posted vouchers count: ${postedVouchers.length} (expected exactly 2)`);
    }

    if (draftVouchers === 0) {
      pass(section2, "No draft vouchers");
    } else {
      fail(section2, `Draft vouchers found: ${draftVouchers} (expected 0)`);
    }

    if (deletedVouchers === 0) {
      pass(section2, "No soft-deleted vouchers");
    } else {
      fail(section2, `Soft-deleted vouchers found: ${deletedVouchers} (expected 0)`);
    }

    // 2b. Voucher 1: JOURNAL capital introduced
    const voucher1 = postedVouchers.find((v) => v.voucherType === "JOURNAL");
    if (voucher1) {
      const v1Date = new Date(voucher1.voucherDate).toISOString().slice(0, 10);
      const v1DateOk = v1Date === "2026-06-01";
      const v1Balanced = voucher1.totalDebit.equals("100000") && voucher1.totalCredit.equals("100000");

      if (v1DateOk && v1StatusOk(voucher1) && v1Balanced) {
        pass(section2, `Voucher 1 (${voucher1.systemVoucherNo}): JOURNAL, 2026-06-01, POSTED, balanced`);
      } else {
        const issues: string[] = [];
        if (!v1DateOk) issues.push(`date=${v1Date}`);
        if (!v1StatusOk(voucher1)) issues.push(`status=${voucher1.status}`);
        if (!v1Balanced) issues.push(`Dr=${voucher1.totalDebit} Cr=${voucher1.totalCredit}`);
        fail(section2, `Voucher 1 (${voucher1.systemVoucherNo}): issues: ${issues.join(", ")}`);
      }

      // Check lines
      const drLine = voucher1.lines.find((l) => l.side === "DEBIT" && l.ledgerAccount.code === "1010");
      const crLine = voucher1.lines.find((l) => l.side === "CREDIT" && l.ledgerAccount.code === "3010");

      if (drLine && drLine.amount.equals("100000")) {
        pass(section2, "Voucher 1: Dr 1010 Cash in Hand 100,000");
      } else {
        fail(section2, "Voucher 1: missing or incorrect Dr 1010 Cash in Hand 100,000 line");
      }

      if (crLine && crLine.amount.equals("100000")) {
        pass(section2, "Voucher 1: Cr 3010 Capital Introduced 100,000");
      } else {
        fail(section2, "Voucher 1: missing or incorrect Cr 3010 Capital Introduced 100,000 line");
      }
    } else {
      fail(section2, "Voucher 1: JOURNAL not found among posted vouchers");
      fail(section2, "Voucher 1: Dr 1010 Cash in Hand 100,000 (voucher missing)");
      fail(section2, "Voucher 1: Cr 3010 Capital Introduced 100,000 (voucher missing)");
    }

    // 2c. Voucher 2: PAYMENT land development expense
    const voucher2 = postedVouchers.find((v) => v.voucherType === "PAYMENT");
    if (voucher2) {
      const v2Date = new Date(voucher2.voucherDate).toISOString().slice(0, 10);
      const v2DateOk = v2Date === "2026-06-10";
      const v2Balanced = voucher2.totalDebit.equals("50000") && voucher2.totalCredit.equals("50000");

      if (v2DateOk && v1StatusOk(voucher2) && v2Balanced) {
        pass(section2, `Voucher 2 (${voucher2.systemVoucherNo}): PAYMENT, 2026-06-10, POSTED, balanced`);
      } else {
        const issues: string[] = [];
        if (!v2DateOk) issues.push(`date=${v2Date}`);
        if (!v1StatusOk(voucher2)) issues.push(`status=${voucher2.status}`);
        if (!v2Balanced) issues.push(`Dr=${voucher2.totalDebit} Cr=${voucher2.totalCredit}`);
        fail(section2, `Voucher 2 (${voucher2.systemVoucherNo}): issues: ${issues.join(", ")}`);
      }

      // Check lines
      const dr5010 = voucher2.lines.find(
        (l) => l.side === "DEBIT" && l.ledgerAccount.code === "5010"
      );
      const cr1010 = voucher2.lines.find(
        (l) => l.side === "CREDIT" && l.ledgerAccount.code === "1010"
      );

      if (dr5010 && dr5010.amount.equals("50000")) {
        const hasProject = dr5010.project?.code === "SK-001";
        const hasCostCenter = dr5010.costCenter?.code === "SK-LD";
        if (hasProject && hasCostCenter) {
          pass(section2, "Voucher 2: Dr 5010 Land Development Expense 50,000 with SK-001/SK-LD");
        } else {
          const missing: string[] = [];
          if (!hasProject) missing.push("project");
          if (!hasCostCenter) missing.push("cost center");
          fail(section2, `Voucher 2: Dr 5010 line missing ${missing.join(", ")}`);
        }
      } else {
        fail(section2, "Voucher 2: missing or incorrect Dr 5010 Land Development Expense 50,000 line");
      }

      if (cr1010 && cr1010.amount.equals("50000")) {
        pass(section2, "Voucher 2: Cr 1010 Cash in Hand 50,000");
      } else {
        fail(section2, "Voucher 2: missing or incorrect Cr 1010 Cash in Hand 50,000 line");
      }
    } else {
      fail(section2, "Voucher 2: PAYMENT not found among posted vouchers");
      fail(section2, "Voucher 2: Dr 5010 Land Development Expense 50,000 (voucher missing)");
      fail(section2, "Voucher 2: Cr 1010 Cash in Hand 50,000 (voucher missing)");
    }

    // 2d. No imbalanced vouchers
    const imbalanced = postedVouchers.filter((v) => !v.totalDebit.equals(v.totalCredit));
    if (imbalanced.length === 0) {
      pass(section2, "All posted vouchers are balanced");
    } else {
      fail(section2, `Imbalanced posted vouchers found: ${imbalanced.length}`);
    }

    // 2e. Voucher line count exactly 4
    const vlCount = await prisma.voucherLine.count({
      where: { voucher: { isDeleted: false } },
    });
    if (vlCount === 4) {
      pass(section2, "Voucher line count: exactly 4");
    } else {
      fail(section2, `Voucher line count: ${vlCount} (expected exactly 4)`);
    }

    // 2f. No MFS posted vouchers
    const mfsPostedLines = await prisma.voucherLine.count({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        cashBankAccount: { accountType: "MFS" },
      },
    });
    if (mfsPostedLines === 0) {
      pass(section2, "No MFS posted voucher lines");
    } else {
      fail(section2, `MFS posted voucher lines found: ${mfsPostedLines} (expected 0)`);
    }

    console.log();

    // -------------------------------------------------------------------
    // SECTION 3: Required Accounting/Report Assertions
    // -------------------------------------------------------------------
    const section3 = "3. Accounting/Report Assertions";

    // 3a. Cash Book closing for 1010 = 50,000 Dr
    const ledger1010 = ledgerMap.get("1010");
    if (ledger1010) {
      const cash1010Debit = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          ledgerAccountId: ledger1010.id,
          side: "DEBIT",
        },
        _sum: { amount: true },
      });
      const cash1010Credit = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          ledgerAccountId: ledger1010.id,
          side: "CREDIT",
        },
        _sum: { amount: true },
      });
      const cashDebit = Number(cash1010Debit._sum.amount ?? 0);
      const cashCredit = Number(cash1010Credit._sum.amount ?? 0);
      const cashClosing = cashDebit - cashCredit;

      if (Math.abs(cashClosing - 50000) < 0.01) {
        pass(section3, "Cash Book closing for 1010 = 50,000 Dr");
      } else {
        fail(section3, `Cash Book closing for 1010: ${cashClosing.toFixed(2)} Dr (expected 50,000 Dr)`);
      }
    } else {
      fail(section3, "Cash Book closing: ledger 1010 not found");
    }

    // 3b. Ledger 5010 closing = 50,000 Dr
    const ledger5010 = ledgerMap.get("5010");
    if (ledger5010) {
      const l5010Debit = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          ledgerAccountId: ledger5010.id,
          side: "DEBIT",
        },
        _sum: { amount: true },
      });
      const l5010Credit = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          ledgerAccountId: ledger5010.id,
          side: "CREDIT",
        },
        _sum: { amount: true },
      });
      const l5010Closing = Number(l5010Debit._sum.amount ?? 0) - Number(l5010Credit._sum.amount ?? 0);

      if (Math.abs(l5010Closing - 50000) < 0.01) {
        pass(section3, "Ledger 5010 closing = 50,000 Dr");
      } else {
        fail(section3, `Ledger 5010 closing: ${l5010Closing.toFixed(2)} Dr (expected 50,000 Dr)`);
      }
    } else {
      fail(section3, "Ledger 5010 closing: ledger 5010 not found");
    }

    // 3c. Trial Balance debit = credit, difference = 0
    const tbDebit = await prisma.voucherLine.aggregate({
      where: { voucher: { status: "POSTED", isDeleted: false }, side: "DEBIT" },
      _sum: { amount: true },
    });
    const tbCredit = await prisma.voucherLine.aggregate({
      where: { voucher: { status: "POSTED", isDeleted: false }, side: "CREDIT" },
      _sum: { amount: true },
    });
    const tbTotalDebit = Number(tbDebit._sum.amount ?? 0);
    const tbTotalCredit = Number(tbCredit._sum.amount ?? 0);
    const tbDiff = Math.abs(tbTotalDebit - tbTotalCredit);

    if (tbDiff < 0.01) {
      pass(section3, "Trial Balance: debit = credit, difference = 0");
    } else {
      fail(section3, `Trial Balance: debit=${tbTotalDebit.toFixed(2)}, credit=${tbTotalCredit.toFixed(2)}, diff=${tbDiff.toFixed(2)}`);
    }

    // 3d. Income Statement net loss = 50,000
    const isExpenseTotal = await prisma.voucherLine.aggregate({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: "EXPENSE" } } },
        side: "DEBIT",
      },
      _sum: { amount: true },
    });
    const isIncomeTotal = await prisma.voucherLine.aggregate({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: "INCOME" } } },
        side: "CREDIT",
      },
      _sum: { amount: true },
    });
    const totalExpense = Number(isExpenseTotal._sum.amount ?? 0);
    const totalIncome = Number(isIncomeTotal._sum.amount ?? 0);
    const netLoss = totalExpense - totalIncome;

    if (Math.abs(netLoss - 50000) < 0.01) {
      pass(section3, "Income Statement: net loss = 50,000");
    } else {
      fail(section3, `Income Statement: net loss=${netLoss.toFixed(2)} (expected 50,000)`);
    }

    // 3e. Balance Sheet adjusted current P/L is balanced
    // We verify: ASSET + LIABILITY + EQUITY + (INCOME - EXPENSE) balances
    const assetDebit = await prisma.voucherLine.aggregate({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: "ASSET" } } },
        side: "DEBIT",
      },
      _sum: { amount: true },
    });
    const assetCredit = await prisma.voucherLine.aggregate({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: "ASSET" } } },
        side: "CREDIT",
      },
      _sum: { amount: true },
    });
    const liabilityDebit = await prisma.voucherLine.aggregate({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: "LIABILITY" } } },
        side: "DEBIT",
      },
      _sum: { amount: true },
    });
    const liabilityCredit = await prisma.voucherLine.aggregate({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: "LIABILITY" } } },
        side: "CREDIT",
      },
      _sum: { amount: true },
    });
    const equityDebit = await prisma.voucherLine.aggregate({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: "EQUITY" } } },
        side: "DEBIT",
      },
      _sum: { amount: true },
    });
    const equityCredit = await prisma.voucherLine.aggregate({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: "EQUITY" } } },
        side: "CREDIT",
      },
      _sum: { amount: true },
    });

    const assetNet = Number(assetDebit._sum.amount ?? 0) - Number(assetCredit._sum.amount ?? 0);
    const liabilityNet = Number(liabilityCredit._sum.amount ?? 0) - Number(liabilityDebit._sum.amount ?? 0);
    const equityNet = Number(equityCredit._sum.amount ?? 0) - Number(equityDebit._sum.amount ?? 0);
    // Adjusted: Include current period P/L (income - expense) under equity
    const adjustedEquity = equityNet + (totalIncome - totalExpense);
    const bsDiff = Math.abs(assetNet - (liabilityNet + adjustedEquity));

    if (bsDiff < 0.01) {
      pass(section3, "Balance Sheet adjusted: balanced (assets = liabilities + equity + P/L)");
    } else {
      fail(section3, `Balance Sheet adjusted: diff=${bsDiff.toFixed(2)} (assets=${assetNet.toFixed(2)}, liabilities+equity+PL=${(liabilityNet + adjustedEquity).toFixed(2)})`);
    }

    // 3f. Project Ledger for SK-001 shows exactly one 50,000 SK-LD Land Development Expense line
    if (sk001) {
      const plLines = await prisma.voucherLine.findMany({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          projectId: sk001.id,
        },
        include: {
          ledgerAccount: { select: { code: true, name: true } },
          costCenter: { select: { code: true } },
        },
      });

      const plDebit = plLines
        .filter((l) => l.side === "DEBIT")
        .reduce((sum, l) => sum + Number(l.amount), 0);

      const exp5010Line = plLines.find(
        (l) => l.ledgerAccount.code === "5010" && l.costCenter?.code === "SK-LD"
      );

      if (plLines.length === 1 && exp5010Line && Math.abs(plDebit - 50000) < 0.01) {
        pass(section3, "Project Ledger (SK-001): 1 line, SK-LD, 50,000, Land Development Expense");
      } else {
        const details = `lines=${plLines.length}, debit=${plDebit.toFixed(2)}, has5010=${!!exp5010Line}`;
        fail(section3, `Project Ledger (SK-001): ${details} (expected 1 line, 50,000)`);
      }
    } else {
      fail(section3, "Project Ledger: SK-001 not found");
    }

    // 3g. Project Cost for SK-001 total debit = 50,000
    if (sk001) {
      const pcTotal = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          projectId: sk001.id,
          side: "DEBIT",
        },
        _sum: { amount: true },
      });
      const pcTotalVal = Number(pcTotal._sum.amount ?? 0);

      if (Math.abs(pcTotalVal - 50000) < 0.01) {
        pass(section3, "Project Cost (SK-001): total debit = 50,000");
      } else {
        fail(section3, `Project Cost (SK-001): total debit=${pcTotalVal.toFixed(2)} (expected 50,000)`);
      }

      // 3h. Project Cost does not double-count to 100,000
      if (pcTotalVal < 100000) {
        pass(section3, "Project Cost (SK-001): no double-count (total < 100,000)");
      } else {
        fail(section3, `Project Cost (SK-001): total=${pcTotalVal.toFixed(2)} appears double-counted`);
      }
    } else {
      fail(section3, "Project Cost: SK-001 not found");
      fail(section3, "Project Cost: double-count check skipped (SK-001 missing)");
    }

    // 3i. Cost Center Summary for SK-001 has SK-LD once, one line, unassigned = 0
    if (skLd) {
      const ccSkLdLines = await prisma.voucherLine.count({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          costCenterId: skLd.id,
        },
      });
      const ccUnassigned = await prisma.voucherLine.count({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          projectId: sk001?.id ?? "",
          costCenterId: null,
        },
      });

      if (ccSkLdLines === 1 && ccUnassigned === 0) {
        pass(section3, "Cost Center Summary (SK-001): SK-LD once, 1 line, unassigned = 0");
      } else {
        fail(section3, `Cost Center Summary (SK-001): SK-LD=${ccSkLdLines} lines, unassigned=${ccUnassigned} (expected SK-LD=1, unassigned=0)`);
      }
    } else {
      fail(section3, "Cost Center Summary: SK-LD not found");
    }

    // 3j. Project Financial Summary
    if (sk001) {
      const pfsExpense = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          projectId: sk001.id,
          ledgerAccount: { accountGroup: { accountClass: { code: "EXPENSE" } } },
        },
        _sum: { amount: true },
      });
      const pfsAsset = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          projectId: sk001.id,
          ledgerAccount: { accountGroup: { accountClass: { code: "ASSET" } } },
        },
        _sum: { amount: true },
      });
      const pfsIncome = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          projectId: sk001.id,
          ledgerAccount: { accountGroup: { accountClass: { code: "INCOME" } } },
        },
        _sum: { amount: true },
      });
      const expTotal = Number(pfsExpense._sum.amount ?? 0);
      const assetTotal = Number(pfsAsset._sum.amount ?? 0);
      const incTotal = Number(pfsIncome._sum.amount ?? 0);

      if (Math.abs(expTotal - 50000) < 0.01 && Math.abs(assetTotal) < 0.01 && Math.abs(incTotal) < 0.01) {
        pass(section3, "Project Financial Summary: projectExpenseTotal=50,000, projectAssetCostTotal=0, projectIncomeTotal=0");
      } else {
        fail(section3, `Project Financial Summary: expense=${expTotal.toFixed(2)}, asset=${assetTotal.toFixed(2)}, income=${incTotal.toFixed(2)} (expected 50000, 0, 0)`);
      }

      // SK-LD appears once in cost-center breakdown
      if (skLd) {
        const pfsSkLdCount = await prisma.voucherLine.count({
          where: {
            voucher: { status: "POSTED", isDeleted: false },
            projectId: sk001.id,
            costCenterId: skLd.id,
          },
        });
        if (pfsSkLdCount === 1) {
          pass(section3, "Project Financial Summary: SK-LD appears once in cost-center breakdown");
        } else {
          fail(section3, `Project Financial Summary: SK-LD appears ${pfsSkLdCount} times (expected 1)`);
        }
      }

      // Land Development Expense appears once in top ledger movement
      const pfs5010Count = await prisma.voucherLine.count({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          projectId: sk001.id,
          ledgerAccount: { code: "5010" },
        },
      });
      if (pfs5010Count === 1) {
        pass(section3, "Project Financial Summary: Land Development Expense appears once in top ledger movement");
      } else {
        fail(section3, `Project Financial Summary: 5010 appears ${pfs5010Count} times (expected 1)`);
      }
    } else {
      fail(section3, "Project Financial Summary: SK-001 not found");
      fail(section3, "Project Financial Summary: SK-LD breakdown (SK-001 missing)");
      fail(section3, "Project Financial Summary: 5010 ledger movement (SK-001 missing)");
    }

    console.log();
    console.log();

    // -------------------------------------------------------------------
    // Final summary
    // -------------------------------------------------------------------
    const totalPass = assertions.filter((a) => a.passed).length;
    const totalFail = assertions.filter((a) => !a.passed).length;

    console.log("================================================================================");
    console.log("  VERIFICATION SUMMARY");
    console.log("================================================================================");
    console.log();

    // Print all assertions
    for (const a of assertions) {
      const status = a.passed ? "PASS" : "FAIL";
      const icon = a.passed ? "[PASS]" : "[FAIL]";
      console.log(`  ${icon} [${a.section}] ${a.label}`);
      if (a.detail) {
        console.log(`        ${a.detail}`);
      }
    }

    console.log();
    console.log(`  TOTAL PASS : ${totalPass}`);
    console.log(`  TOTAL FAIL : ${totalFail}`);
    console.log();

    if (totalFail === 0) {
      console.log("  DEMO VERIFY PASSED");
    } else {
      console.log("  DEMO VERIFY FAILED");
    }
    console.log();
    console.log("================================================================================");
    console.log("  READ-ONLY VERIFY: no data was modified.");
    console.log("================================================================================");

    // -------------------------------------------------------------------
    // Exit code
    // -------------------------------------------------------------------
    if (totalFail > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function v1StatusOk(v: { status: string }): boolean {
  return v.status === "POSTED";
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
