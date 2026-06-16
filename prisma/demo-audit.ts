import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/api/src/generated/prisma/client";

// ---------------------------------------------------------------------------
// Audit state
// ---------------------------------------------------------------------------

type Severity = "PASS" | "WARN" | "FAIL";

interface AuditFinding {
  section: string;
  label: string;
  severity: Severity;
  detail?: string;
}

const findings: AuditFinding[] = [];

function record(section: string, label: string, severity: Severity, detail?: string) {
  findings.push({ section, label, severity, detail });
}

function pass(section: string, label: string, detail?: string) {
  record(section, label, "PASS", detail);
}

function warn(section: string, label: string, detail?: string) {
  record(section, label, "WARN", detail);
}

function fail(section: string, label: string, detail?: string) {
  record(section, label, "FAIL", detail);
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

function isLocalDb(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const port = u.port;
    // Include explicit localhost / 127.0.0.1 and the dev port 55432
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

// ---------------------------------------------------------------------------
// Main audit
// ---------------------------------------------------------------------------

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is required to run the audit.");
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // 0. Safety header
  // -----------------------------------------------------------------------
  console.log("================================================================================");
  console.log("  REAL CAPITA ACCOUNTS - DEMO DATA AUDIT");
  console.log("  READ-ONLY AUDIT: no data was modified.");
  console.log("================================================================================");
  console.log();

  console.log("Database URL :", safeUrlDisplay(connectionString));
  const dbHost = parseDbHost(connectionString);
  const dbName = parseDbName(connectionString);
  if (dbHost) console.log("Database host:", dbHost);
  if (dbName) console.log("Database name:", dbName);
  console.log();

  if (!isLocalDb(connectionString)) {
    warn("SAFETY", "DATABASE_URL does not appear to be a local/dev database.", safeUrlDisplay(connectionString));
  } else {
    pass("SAFETY", "DATABASE_URL appears to be a local/dev database.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    // -------------------------------------------------------------------
    // A. Entity counts
    // -------------------------------------------------------------------
    const sectionA = "A. Entity Counts";

    const companyCount = await prisma.company.count();
    console.log(`Companies               : ${companyCount}`);
    pass(sectionA, `Companies: ${companyCount}`, companyCount > 0 ? "At least one company exists." : "No companies found.");

    const fyCount = await prisma.fiscalYear.count();
    console.log(`Fiscal Years            : ${fyCount}`);
    pass(sectionA, `Fiscal Years: ${fyCount}`);

    const periodCount = await prisma.accountingPeriod.count();
    console.log(`Accounting Periods      : ${periodCount}`);
    pass(sectionA, `Accounting Periods: ${periodCount}`);

    const projectCount = await prisma.project.count();
    console.log(`Projects                : ${projectCount}`);
    pass(sectionA, `Projects: ${projectCount}`);

    const ccCount = await prisma.costCenter.count();
    console.log(`Cost Centers            : ${ccCount}`);
    pass(sectionA, `Cost Centers: ${ccCount}`);

    const acClassCount = await prisma.accountClass.count();
    console.log(`Account Classes         : ${acClassCount}`);
    pass(sectionA, `Account Classes: ${acClassCount}`);

    const agCount = await prisma.accountGroup.count();
    console.log(`Account Groups          : ${agCount}`);
    pass(sectionA, `Account Groups: ${agCount}`);

    const ledgerCount = await prisma.ledgerAccount.count();
    console.log(`Ledger Accounts         : ${ledgerCount}`);
    pass(sectionA, `Ledger Accounts: ${ledgerCount}`);

    const cbaCount = await prisma.cashBankAccount.count();
    const cbaByType = await prisma.cashBankAccount.groupBy({
      by: ["accountType"],
      _count: { id: true },
    });
    const cbaTypeMap: Record<string, number> = {};
    for (const g of cbaByType) {
      cbaTypeMap[g.accountType] = g._count.id;
    }
    console.log(`Cash/Bank/MFS Accounts  : ${cbaCount} (CASH=${cbaTypeMap.CASH ?? 0}, BANK=${cbaTypeMap.BANK ?? 0}, MFS=${cbaTypeMap.MFS ?? 0})`);
    pass(sectionA, `Cash/Bank/MFS Accounts: ${cbaCount}`);

    const userCount = await prisma.user.count();
    console.log(`Users                   : ${userCount}`);
    pass(sectionA, `Users: ${userCount}`);

    const roleCount = await prisma.role.count();
    console.log(`Roles                   : ${roleCount}`);
    pass(sectionA, `Roles: ${roleCount}`);

    // Voucher counts
    const voucherTotal = await prisma.voucher.count({ where: { isDeleted: false } });
    const voucherDeleted = await prisma.voucher.count({ where: { isDeleted: true } });
    const voucherByStatus = await prisma.voucher.groupBy({
      by: ["status"],
      where: { isDeleted: false },
      _count: { id: true },
    });
    const statusMap: Record<string, number> = {};
    for (const g of voucherByStatus) {
      statusMap[g.status] = g._count.id;
    }

    const voucherByType = await prisma.voucher.groupBy({
      by: ["voucherType"],
      where: { isDeleted: false },
      _count: { id: true },
    });
    const typeMap: Record<string, number> = {};
    for (const g of voucherByType) {
      typeMap[g.voucherType] = g._count.id;
    }

    console.log(`Vouchers (non-deleted)  : ${voucherTotal}`);
    if (voucherDeleted > 0) {
      console.log(`Vouchers (soft-deleted) : ${voucherDeleted}`);
    }
    console.log(`  By status: DRAFT=${statusMap.DRAFT ?? 0}, POSTED=${statusMap.POSTED ?? 0}`);
    for (const [vt, cnt] of Object.entries(typeMap).sort()) {
      console.log(`  ${vt}: ${cnt}`);
    }

    pass(sectionA, `Vouchers total: ${voucherTotal}`, `DRAFT=${statusMap.DRAFT ?? 0}, POSTED=${statusMap.POSTED ?? 0}, deleted=${voucherDeleted}`);
    if (voucherDeleted > 0) {
      warn(sectionA, `Soft-deleted vouchers: ${voucherDeleted}`, "Soft-deleted vouchers should be cleaned up before a demo reset.");
    } else {
      pass(sectionA, "No soft-deleted vouchers found.");
    }

    const vlCount = await prisma.voucherLine.count({
      where: { voucher: { isDeleted: false } },
    });
    console.log(`Voucher Lines (non-del) : ${vlCount}`);
    pass(sectionA, `Voucher Lines: ${vlCount}`);

    console.log();

    // -------------------------------------------------------------------
    // B. Demo dataset presence
    // -------------------------------------------------------------------
    const sectionB = "B. Demo Dataset Presence";

    const company = await prisma.company.findFirst();
    const demoCompany = company?.name === "Real Capita Group" || company?.legalName === "Real Capita Group Ltd";
    console.log(`Company                 : ${company?.name ?? "(none)"} / ${company?.legalName ?? "(no legal name)"}`);
    if (demoCompany) {
      pass(sectionB, "Company: Real Capita Group / Real Capita Group Ltd");
    } else {
      warn(sectionB, "Company does not match Real Capita Group / Real Capita Group Ltd.", `Found: ${company?.name ?? "(none)"}`);
    }

    const fy2526 = await prisma.fiscalYear.findFirst({
      where: { name: "FY 2025-2026" },
    });
    console.log(`FY 2025-2026            : ${fy2526 ? "found" : "NOT FOUND"}`);
    if (fy2526) {
      pass(sectionB, "FY 2025-2026 exists");
      const jun26 = await prisma.accountingPeriod.findFirst({
        where: { fiscalYearId: fy2526.id, name: "June 2026" },
      });
      console.log(`June 2026               : ${jun26 ? `found (status=${jun26.status})` : "NOT FOUND"}`);
      if (jun26) {
        pass(sectionB, "June 2026 accounting period exists");
      } else {
        warn(sectionB, "June 2026 accounting period not found");
      }
    } else {
      warn(sectionB, "FY 2025-2026 not found");
      warn(sectionB, "June 2026 not found (FY 2025-2026 missing)");
    }

    const sk001 = await prisma.project.findUnique({ where: { code: "SK-001" } });
    console.log(`SK-001 Shanti Kutir     : ${sk001 ? `found (name=${sk001.name}, active=${sk001.isActive})` : "NOT FOUND"}`);
    if (sk001) {
      pass(sectionB, "SK-001 Shanti Kutir project exists");
    } else {
      warn(sectionB, "SK-001 Shanti Kutir project not found");
    }

    const skLd = await prisma.costCenter.findFirst({
      where: { code: "SK-LD" },
      include: { project: true },
    });
    console.log(`SK-LD                   : ${skLd ? `found (name=${skLd.name}, project=${skLd.project.code}, active=${skLd.isActive})` : "NOT FOUND"}`);
    if (skLd) {
      if (skLd.project.code === "SK-001") {
        pass(sectionB, "SK-LD cost center exists and linked to SK-001");
      } else {
        warn(sectionB, `SK-LD cost center linked to wrong project: ${skLd.project.code}`);
      }
    } else {
      warn(sectionB, "SK-LD cost center not found");
    }

    // Ledger checks
    const ledgerCodes = ["1010", "1020", "1030", "5010", "3010"];
    const ledgers = await prisma.ledgerAccount.findMany({
      where: { code: { in: ledgerCodes } },
      include: { accountGroup: { include: { accountClass: true } } },
    });
    const ledgerMap = new Map(ledgers.map((l) => [l.code, l]));

    for (const code of ledgerCodes) {
      const l = ledgerMap.get(code);
      if (l) {
        const flags = [
          l.isActive ? "active" : "inactive",
          l.isCashBank ? "cashBank" : "",
          l.requiresProject ? "project" : "",
          l.requiresCostCenter ? "costCenter" : "",
        ]
          .filter(Boolean)
          .join(", ");
        console.log(`Ledger ${code}           : found (${l.name}, ${flags})`);
        pass(sectionB, `Ledger ${code} exists: ${l.name}`);
      } else {
        console.log(`Ledger ${code}           : NOT FOUND`);
        warn(sectionB, `Ledger ${code} not found`);
      }
    }

    // Cash/Bank/MFS accounts
    const cbaNames = ["Office Cash", "City Bank - Uttara Branch", "bKash Merchant - Real Capita"];
    const cbas = await prisma.cashBankAccount.findMany({
      where: { displayName: { in: cbaNames } },
      include: { ledgerAccount: true },
    });
    const cbaNameMap = new Map(cbas.map((c) => [c.displayName, c]));

    for (const name of cbaNames) {
      const c = cbaNameMap.get(name);
      if (c) {
        console.log(`Cash/Bank/MFS ${name.padEnd(25)}: found (type=${c.accountType}, ledger=${c.ledgerAccount.code})`);
        pass(sectionB, `Cash/Bank/MFS account exists: ${name}`);
      } else {
        console.log(`Cash/Bank/MFS ${name.padEnd(25)}: NOT FOUND`);
        warn(sectionB, `Cash/Bank/MFS account not found: ${name}`);
      }
    }

    // Seed user
    const seedUser = await prisma.user.findUnique({
      where: { email: "accountant@realcapita.local" },
      include: { roles: { include: { role: true } } },
    });
    if (seedUser) {
      const roleNames = seedUser.roles.map((ur) => ur.role.code).join(", ");
      console.log(`Seed user               : found (active=${seedUser.isActive}, roles=${roleNames})`);
      pass(sectionB, "Seed user accountant@realcapita.local exists");
    } else {
      console.log("Seed user               : NOT FOUND");
      warn(sectionB, "Seed user accountant@realcapita.local not found");
    }

    console.log();

    // -------------------------------------------------------------------
    // C. Duplicate detection
    // -------------------------------------------------------------------
    const sectionC = "C. Duplicate Detection";

    // Duplicate fiscal year names
    const dupFyNames = await prisma.$queryRawUnsafe<{ name: string; cnt: bigint }[]>(
      `SELECT name, COUNT(*)::bigint AS cnt FROM fiscal_years GROUP BY name HAVING COUNT(*) > 1`,
    );
    if (dupFyNames.length > 0) {
      for (const d of dupFyNames) {
        fail(sectionC, `Duplicate fiscal year name: "${d.name}" (${d.cnt} occurrences)`);
      }
    } else {
      pass(sectionC, "No duplicate fiscal year names.");
    }

    // Duplicate accounting period names within same FY
    const dupPeriods = await prisma.$queryRawUnsafe<{ fiscalYearId: string; name: string; cnt: bigint }[]>(
      `SELECT "fiscalYearId", name, COUNT(*)::bigint AS cnt FROM accounting_periods GROUP BY "fiscalYearId", name HAVING COUNT(*) > 1`,
    );
    if (dupPeriods.length > 0) {
      for (const d of dupPeriods) {
        fail(sectionC, `Duplicate period name "${d.name}" within fiscal year ${d.fiscalYearId} (${d.cnt} occurrences)`);
      }
    } else {
      pass(sectionC, "No duplicate accounting period names within same FY.");
    }

    // Duplicate project codes
    const dupProjects = await prisma.$queryRawUnsafe<{ code: string; cnt: bigint }[]>(
      `SELECT code, COUNT(*)::bigint AS cnt FROM projects GROUP BY code HAVING COUNT(*) > 1`,
    );
    if (dupProjects.length > 0) {
      for (const d of dupProjects) {
        fail(sectionC, `Duplicate project code: "${d.code}" (${d.cnt} occurrences)`);
      }
    } else {
      pass(sectionC, "No duplicate project codes.");
    }

    // Duplicate cost center codes within same project
    const dupCostCenters = await prisma.$queryRawUnsafe<{ projectId: string; code: string; cnt: bigint }[]>(
      `SELECT "projectId", code, COUNT(*)::bigint AS cnt FROM cost_centers GROUP BY "projectId", code HAVING COUNT(*) > 1`,
    );
    if (dupCostCenters.length > 0) {
      for (const d of dupCostCenters) {
        fail(sectionC, `Duplicate cost center code "${d.code}" within project ${d.projectId} (${d.cnt} occurrences)`);
      }
    } else {
      pass(sectionC, "No duplicate cost center codes within same project.");
    }

    // Duplicate ledger codes
    const dupLedgers = await prisma.$queryRawUnsafe<{ code: string; cnt: bigint }[]>(
      `SELECT code, COUNT(*)::bigint AS cnt FROM ledger_accounts GROUP BY code HAVING COUNT(*) > 1`,
    );
    if (dupLedgers.length > 0) {
      for (const d of dupLedgers) {
        fail(sectionC, `Duplicate ledger code: "${d.code}" (${d.cnt} occurrences)`);
      }
    } else {
      pass(sectionC, "No duplicate ledger codes.");
    }

    // Duplicate cash/bank/MFS account names
    const dupCbaNames = await prisma.$queryRawUnsafe<{ displayName: string; cnt: bigint }[]>(
      `SELECT "displayName", COUNT(*)::bigint AS cnt FROM cash_bank_accounts GROUP BY "displayName" HAVING COUNT(*) > 1`,
    );
    if (dupCbaNames.length > 0) {
      for (const d of dupCbaNames) {
        fail(sectionC, `Duplicate cash/bank/MFS account name: "${d.displayName}" (${d.cnt} occurrences)`);
      }
    } else {
      pass(sectionC, "No duplicate cash/bank/MFS account names.");
    }

    console.log();

    // -------------------------------------------------------------------
    // D. Orphan / consistency checks
    // -------------------------------------------------------------------
    const sectionD = "D. Orphan / Consistency Checks";

    // Cost centers without project (projectId is required in schema, so this cannot happen)
    pass(sectionD, "No cost centers without a project (projectId is required).");

    // Posted voucher lines with projectId but missing/invalid costCenterId where ledger requires cost center
    const postedLinesWithProject = await prisma.voucherLine.findMany({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        projectId: { not: null },
        ledgerAccount: { requiresCostCenter: true },
        costCenterId: null,
      },
      select: { id: true, ledgerAccount: { select: { code: true, name: true } }, projectId: true },
      take: 20,
    });
    if (postedLinesWithProject.length > 0) {
      fail(
        sectionD,
        `Posted voucher lines with project but missing cost center (ledger requires cost center): ${postedLinesWithProject.length}`,
        postedLinesWithProject.map((l) => `line=${l.id} ledger=${l.ledgerAccount.code} project=${l.projectId}`).join("; "),
      );
    } else {
      pass(sectionD, "No posted voucher lines missing cost center when ledger requires it.");
    }

    // Posted voucher lines missing projectId where ledger requires project
    const postedLinesMissingProject = await prisma.voucherLine.findMany({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        projectId: null,
        ledgerAccount: { requiresProject: true },
      },
      select: { id: true, ledgerAccount: { select: { code: true, name: true } } },
      take: 20,
    });
    if (postedLinesMissingProject.length > 0) {
      fail(
        sectionD,
        `Posted voucher lines missing project (ledger requires project): ${postedLinesMissingProject.length}`,
        postedLinesMissingProject.map((l) => `line=${l.id} ledger=${l.ledgerAccount.code}`).join("; "),
      );
    } else {
      pass(sectionD, "No posted voucher lines missing project when ledger requires it.");
    }

    // Cash/bank/MFS voucher lines without cashBankAccountId when ledger is cash/bank
    const cashLinesMissingCba = await prisma.voucherLine.findMany({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        cashBankAccountId: null,
        ledgerAccount: { isCashBank: true },
      },
      select: { id: true, ledgerAccount: { select: { code: true, name: true } } },
      take: 20,
    });
    if (cashLinesMissingCba.length > 0) {
      warn(
        sectionD,
        `Posted voucher lines for cash/bank ledger without cashBankAccountId: ${cashLinesMissingCba.length}`,
        cashLinesMissingCba.map((l) => `line=${l.id} ledger=${l.ledgerAccount.code}`).join("; "),
      );
    } else {
      pass(sectionD, "No posted cash/bank voucher lines missing cashBankAccountId.");
    }

    // Cash/bank/MFS account records whose linked ledger is not cash/bank enabled
    const cbaNonCashBank = await prisma.cashBankAccount.findMany({
      where: { ledgerAccount: { isCashBank: false } },
      include: { ledgerAccount: { select: { code: true, name: true } } },
    });
    if (cbaNonCashBank.length > 0) {
      fail(
        sectionD,
        `Cash/Bank/MFS accounts linked to non-cash-bank ledger: ${cbaNonCashBank.length}`,
        cbaNonCashBank.map((c) => `${c.displayName} -> ledger ${c.ledgerAccount.code}`).join("; "),
      );
    } else {
      pass(sectionD, "All cash/bank/MFS accounts are linked to cash-bank-enabled ledgers.");
    }

    // Voucher debit/credit imbalance by voucher
    const postedVouchers = await prisma.voucher.findMany({
      where: { status: "POSTED", isDeleted: false },
      select: {
        id: true,
        systemVoucherNo: true,
        totalDebit: true,
        totalCredit: true,
      },
      orderBy: { systemVoucherNo: "asc" },
    });
    const imbalancedVouchers = postedVouchers.filter((v) => !v.totalDebit.equals(v.totalCredit));
    if (imbalancedVouchers.length > 0) {
      fail(
        sectionD,
        `Posted vouchers with debit/credit imbalance: ${imbalancedVouchers.length}`,
        imbalancedVouchers.map((v) => `${v.systemVoucherNo} (debit=${v.totalDebit}, credit=${v.totalCredit})`).join("; "),
      );
    } else {
      pass(sectionD, "All posted vouchers are balanced (debit = credit).");
    }

    // Posted vouchers outside active/open fiscal/period range
    const activeOpenFys = await prisma.fiscalYear.findMany({
      where: { isActive: true, isClosed: false },
    });
    const activeFyIds = new Set(activeOpenFys.map((f) => f.id));
    const openPeriods = await prisma.accountingPeriod.findMany({
      where: { status: "OPEN" },
    });
    const openPeriodIds = new Set(openPeriods.map((p) => p.id));

    const postedOutsideRange = postedVouchers.filter(
      (v) => {
        // We need to fetch the full voucher to check dates
        // Instead, we'll query directly
        return false; // placeholder - we'll query below
      },
    );

    // Actually query for posted vouchers with inactive/closed FY or non-open period
    const postedVouchersOutsideFy = await prisma.voucher.findMany({
      where: {
        status: "POSTED",
        isDeleted: false,
        fiscalYear: { OR: [{ isActive: false }, { isClosed: true }] },
      },
      select: { id: true, systemVoucherNo: true, fiscalYear: { select: { name: true } } },
      take: 20,
    });
    if (postedVouchersOutsideFy.length > 0) {
      warn(
        sectionD,
        `Posted vouchers in inactive/closed fiscal years: ${postedVouchersOutsideFy.length}`,
        postedVouchersOutsideFy.map((v) => `${v.systemVoucherNo} (FY=${v.fiscalYear.name})`).join("; "),
      );
    } else {
      pass(sectionD, "No posted vouchers in inactive/closed fiscal years.");
    }

    const postedVouchersOutsidePeriod = await prisma.voucher.findMany({
      where: {
        status: "POSTED",
        isDeleted: false,
        accountingPeriod: { status: { not: "OPEN" } },
      },
      select: { id: true, systemVoucherNo: true, accountingPeriod: { select: { name: true, status: true } } },
      take: 20,
    });
    if (postedVouchersOutsidePeriod.length > 0) {
      warn(
        sectionD,
        `Posted vouchers in non-OPEN accounting periods: ${postedVouchersOutsidePeriod.length}`,
        postedVouchersOutsidePeriod.map((v) => `${v.systemVoucherNo} (period=${v.accountingPeriod.name}, status=${v.accountingPeriod.status})`).join("; "),
      );
    } else {
      pass(sectionD, "No posted vouchers in non-OPEN accounting periods.");
    }

    // Cost center belongs to different project than voucher line projectId
    const ccMismatch = await prisma.voucherLine.findMany({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        projectId: { not: null },
        costCenterId: { not: null },
        costCenter: { projectId: { not: "" } },
      },
      select: {
        id: true,
        projectId: true,
        costCenterId: true,
        costCenter: { select: { projectId: true } },
      },
      take: 100,
    });
    const mismatched = ccMismatch.filter((l) => l.projectId !== l.costCenter?.projectId);
    if (mismatched.length > 0) {
      fail(
        sectionD,
        `Voucher lines where costCenter.projectId != line.projectId: ${mismatched.length}`,
        mismatched.map((l) => `line=${l.id} project=${l.projectId} ccProject=${l.costCenter?.projectId}`).join("; "),
      );
    } else {
      pass(sectionD, "No cost-center-to-project mismatches in posted voucher lines.");
    }

    console.log();

    // -------------------------------------------------------------------
    // E. Report readiness checks
    // -------------------------------------------------------------------
    const sectionE = "E. Report Readiness";

    // Trial Balance readiness: having posted voucher lines
    const postedVlCount = await prisma.voucherLine.count({
      where: { voucher: { status: "POSTED", isDeleted: false } },
    });
    if (postedVlCount > 0) {
      // Compute Trial Balance totals
      const tbRows = await prisma.voucherLine.groupBy({
        by: ["side"],
        where: { voucher: { status: "POSTED", isDeleted: false } },
        _sum: { amount: true },
      });
      let totalDebit = 0;
      let totalCredit = 0;
      for (const r of tbRows) {
        const amt = Number(r._sum.amount ?? 0);
        if (r.side === "DEBIT") totalDebit += amt;
        else totalCredit += amt;
      }
      const tbDiff = Math.abs(totalDebit - totalCredit).toFixed(2);
      const tbBalanced = tbDiff === "0.00";
      console.log(`Trial Balance           : ${tbBalanced ? "balanced" : "NOT BALANCED"} (diff=${tbDiff})`);
      if (tbBalanced) {
        pass(sectionE, "Trial Balance is balanced.");
      } else {
        fail(sectionE, `Trial Balance is NOT balanced. Diff=${tbDiff}`);
      }
    } else {
      console.log("Trial Balance           : no posted voucher lines");
      warn(sectionE, "Trial Balance: no posted voucher lines yet.");
    }

    // Balance Sheet: check if we have ASSET/LIABILITY/EQUITY lines
    const bsRelevant = await prisma.voucherLine.count({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: { in: ["ASSET", "LIABILITY", "EQUITY"] } } } },
      },
    });
    if (bsRelevant > 0) {
      pass(sectionE, "Balance Sheet: posted ASSET/LIABILITY/EQUITY lines exist.");
    } else {
      warn(sectionE, "Balance Sheet: no posted ASSET/LIABILITY/EQUITY lines yet.");
    }

    // Income Statement: check if we have INCOME/EXPENSE lines
    const isRelevant = await prisma.voucherLine.count({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        ledgerAccount: { accountGroup: { accountClass: { code: { in: ["INCOME", "EXPENSE"] } } } },
      },
    });
    if (isRelevant > 0) {
      pass(sectionE, "Income Statement: posted INCOME/EXPENSE lines exist.");
    } else {
      warn(sectionE, "Income Statement: no posted INCOME/EXPENSE lines yet.");
    }

    // Cash Book readiness
    const cashBookRelevant = await prisma.voucherLine.count({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        cashBankAccount: { accountType: "CASH" },
      },
    });
    if (cashBookRelevant > 0) {
      pass(sectionE, "Cash Book: posted CASH voucher lines exist.");
    } else {
      warn(sectionE, "Cash Book: no posted CASH voucher lines yet.");
    }

    // Bank Book readiness
    const bankBookRelevant = await prisma.voucherLine.count({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        cashBankAccount: { accountType: "BANK" },
      },
    });
    if (bankBookRelevant > 0) {
      pass(sectionE, "Bank Book: posted BANK voucher lines exist.");
    } else {
      warn(sectionE, "Bank Book: no posted BANK voucher lines yet.");
    }

    // MFS Book readiness
    const mfsBookRelevant = await prisma.voucherLine.count({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        cashBankAccount: { accountType: "MFS" },
      },
    });
    if (mfsBookRelevant > 0) {
      pass(sectionE, "MFS Book: posted MFS voucher lines exist.");
    } else {
      pass(sectionE, "MFS Book: no posted MFS voucher lines (expected - MFS posting is deferred).");
    }

    // Project Ledger readiness
    const projectLedgerRelevant = await prisma.voucherLine.count({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        projectId: { not: null },
      },
    });
    if (projectLedgerRelevant > 0) {
      pass(sectionE, "Project Ledger: posted project-tagged lines exist.");
    } else {
      warn(sectionE, "Project Ledger: no posted project-tagged lines yet.");
    }

    // Project Cost readiness
    if (projectLedgerRelevant > 0) {
      pass(sectionE, "Project Cost: posted project-tagged lines exist.");
    } else {
      warn(sectionE, "Project Cost: no posted project-tagged lines yet.");
    }

    // Cost Center Summary readiness
    const ccSummaryRelevant = await prisma.voucherLine.count({
      where: {
        voucher: { status: "POSTED", isDeleted: false },
        projectId: { not: null },
      },
    });
    if (ccSummaryRelevant > 0) {
      pass(sectionE, "Cost Center Summary: posted project-tagged lines exist.");
    } else {
      warn(sectionE, "Cost Center Summary: no posted project-tagged lines yet.");
    }

    // Project Financial Summary readiness
    if (projectLedgerRelevant > 0) {
      pass(sectionE, "Project Financial Summary: posted project-tagged lines exist.");
    } else {
      warn(sectionE, "Project Financial Summary: no posted project-tagged lines yet.");
    }

    console.log();

    // -------------------------------------------------------------------
    // F. Expected deterministic report result checks
    // -------------------------------------------------------------------
    const sectionF = "F. Deterministic Demo Checks";
    const allDemoEntities =
      demoCompany && fy2526 && sk001 && skLd &&
      ledgerCodes.every((c) => ledgerMap.has(c)) &&
      cbaNames.every((n) => cbaNameMap.has(n)) &&
      seedUser;

    if (allDemoEntities) {
      console.log("Deterministic demo dataset appears to be present. Running expected-vs-current checks...");
      console.log();

      // Cash Book closing for 1010 (Office Cash)
      const cash1010 = await prisma.ledgerAccount.findUnique({ where: { code: "1010" } });
      const officeCash = await prisma.cashBankAccount.findFirst({ where: { displayName: "Office Cash" } });
      if (cash1010 && officeCash) {
        const cash1010Lines = await prisma.voucherLine.aggregate({
          where: {
            voucher: { status: "POSTED", isDeleted: false },
            ledgerAccountId: cash1010.id,
          },
          _sum: { amount: true },
        });
        const cash1010Debit = await prisma.voucherLine.aggregate({
          where: {
            voucher: { status: "POSTED", isDeleted: false },
            ledgerAccountId: cash1010.id,
            side: "DEBIT",
          },
          _sum: { amount: true },
        });
        const cash1010Credit = await prisma.voucherLine.aggregate({
          where: {
            voucher: { status: "POSTED", isDeleted: false },
            ledgerAccountId: cash1010.id,
            side: "CREDIT",
          },
          _sum: { amount: true },
        });
        const cashDebit = Number(cash1010Debit._sum.amount ?? 0);
        const cashCredit = Number(cash1010Credit._sum.amount ?? 0);
        const cashClosing = cashDebit - cashCredit;
        const expectedCashClosing = 50000;
        console.log(`Cash Book (1010) closing: ${cashClosing.toFixed(2)} Dr (expected ${expectedCashClosing} Dr)`);
        if (Math.abs(cashClosing - expectedCashClosing) < 0.01) {
          pass(sectionF, `Cash Book closing = ${expectedCashClosing} Dr`);
        } else {
          warn(sectionF, `Cash Book closing: ${cashClosing.toFixed(2)} Dr (expected ${expectedCashClosing} Dr)`);
        }
      }

      // Ledger 5010 closing
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
        const expected5010 = 50000;
        console.log(`Ledger 5010 closing     : ${l5010Closing.toFixed(2)} Dr (expected ${expected5010} Dr)`);
        if (Math.abs(l5010Closing - expected5010) < 0.01) {
          pass(sectionF, `Ledger 5010 closing = ${expected5010} Dr`);
        } else {
          warn(sectionF, `Ledger 5010 closing: ${l5010Closing.toFixed(2)} Dr (expected ${expected5010} Dr)`);
        }
      }

      // Trial Balance balanced
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
      const tbDiff = Math.abs(tbTotalDebit - tbTotalCredit).toFixed(2);
      const tbBalanced = tbDiff === "0.00";
      console.log(`Trial Balance           : ${tbBalanced ? "balanced" : "NOT BALANCED"} (diff=${tbDiff})`);
      if (tbBalanced) {
        pass(sectionF, "Trial Balance is balanced.");
      } else {
        fail(sectionF, `Trial Balance NOT balanced. Diff=${tbDiff}`);
      }

      // Income Statement net loss = 50,000
      const isExpenseLines = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          ledgerAccount: { accountGroup: { accountClass: { code: "EXPENSE" } } },
          side: "DEBIT",
        },
        _sum: { amount: true },
      });
      const isIncomeLines = await prisma.voucherLine.aggregate({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          ledgerAccount: { accountGroup: { accountClass: { code: "INCOME" } } },
          side: "CREDIT",
        },
        _sum: { amount: true },
      });
      const totalExpense = Number(isExpenseLines._sum.amount ?? 0);
      const totalIncome = Number(isIncomeLines._sum.amount ?? 0);
      const netLoss = totalExpense - totalIncome;
      const expectedLoss = 50000;
      console.log(`Income Statement        : net loss=${netLoss.toFixed(2)} (expected ${expectedLoss})`);
      if (Math.abs(netLoss - expectedLoss) < 0.01) {
        pass(sectionF, `Income Statement net loss = ${expectedLoss}`);
      } else {
        warn(sectionF, `Income Statement: net loss=${netLoss.toFixed(2)} (expected ${expectedLoss})`);
      }

      // Balance Sheet adjusted - check equity class has movement
      const equityLines = await prisma.voucherLine.count({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          ledgerAccount: { accountGroup: { accountClass: { code: "EQUITY" } } },
        },
      });
      const assetLines = await prisma.voucherLine.count({
        where: {
          voucher: { status: "POSTED", isDeleted: false },
          ledgerAccount: { accountGroup: { accountClass: { code: "ASSET" } } },
        },
      });
      if (equityLines > 0 && assetLines > 0) {
        pass(sectionF, "Balance Sheet: posted ASSET and EQUITY lines exist.");
      } else {
        warn(sectionF, "Balance Sheet: may not have enough data for adjusted balance.");
      }

      // Project Ledger: one 50,000 SK-001/SK-LD expense line
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
        const plCount = plLines.length;
        const plTotalDebit = plLines
          .filter((l) => l.side === "DEBIT")
          .reduce((sum, l) => sum + Number(l.amount), 0);
        console.log(`Project Ledger (SK-001): ${plCount} line(s), debit=${plTotalDebit.toFixed(2)}`);
        const expLine = plLines.find((l) => l.ledgerAccount.code === "5010" && l.costCenter?.code === "SK-LD");
        if (expLine && plCount === 1 && Math.abs(plTotalDebit - 50000) < 0.01) {
          pass(sectionF, "Project Ledger: 1 SK-001/SK-LD expense line, debit 50,000.");
        } else if (plCount === 0) {
          warn(sectionF, "Project Ledger: no project-tagged lines for SK-001.");
        } else {
          warn(sectionF, `Project Ledger: ${plCount} line(s) for SK-001, expected 1 line with 50,000 debit.`);
        }
      }

      // Project Cost: total debit 50,000, no double count
      if (sk001) {
        const pcLines = await prisma.voucherLine.aggregate({
          where: {
            voucher: { status: "POSTED", isDeleted: false },
            projectId: sk001.id,
            side: "DEBIT",
          },
          _sum: { amount: true },
        });
        const pcTotal = Number(pcLines._sum.amount ?? 0);
        console.log(`Project Cost (SK-001)  : total debit=${pcTotal.toFixed(2)}`);
        if (Math.abs(pcTotal - 50000) < 0.01) {
          pass(sectionF, "Project Cost: total debit 50,000.");
        } else {
          warn(sectionF, `Project Cost: total debit=${pcTotal.toFixed(2)} (expected 50,000).`);
        }
      }

      // Cost Center Summary: SK-LD once
      if (skLd) {
        const ccLines = await prisma.voucherLine.count({
          where: {
            voucher: { status: "POSTED", isDeleted: false },
            costCenterId: skLd.id,
          },
        });
        const ccUnassigned = await prisma.voucherLine.count({
          where: {
            voucher: { status: "POSTED", isDeleted: false },
            projectId: sk001.id,
            costCenterId: null,
          },
        });
        console.log(`Cost Center Summary     : SK-LD=${ccLines} line(s), unassigned=${ccUnassigned}`);
        if (ccLines === 1 && ccUnassigned === 0) {
          pass(sectionF, "Cost Center Summary: SK-LD once, 0 unassigned.");
        } else {
          warn(sectionF, `Cost Center Summary: SK-LD=${ccLines} line(s), unassigned=${ccUnassigned} (expected SK-LD=1, unassigned=0).`);
        }
      }

      // Project Financial Summary: expense 50,000, asset 0, income 0
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
        console.log(`Project Fin. Summary    : expense=${expTotal.toFixed(2)}, asset=${assetTotal.toFixed(2)}, income=${incTotal.toFixed(2)}`);
        if (Math.abs(expTotal - 50000) < 0.01 && Math.abs(assetTotal) < 0.01 && Math.abs(incTotal) < 0.01) {
          pass(sectionF, "Project Financial Summary: expense 50,000, asset 0, income 0.");
        } else {
          warn(sectionF, `Project Financial Summary: expense=${expTotal.toFixed(2)}, asset=${assetTotal.toFixed(2)}, income=${incTotal.toFixed(2)} (expected 50000, 0, 0).`);
        }
      }
    } else {
      console.log("Deterministic demo dataset is not fully present. Skipping expected-vs-current checks.");
      warn(sectionF, "Deterministic demo dataset not fully present. Skipping expected-vs-current checks.");
    }

    console.log();
    console.log();

    // -------------------------------------------------------------------
    // G. Final summary
    // -------------------------------------------------------------------
    const totalPass = findings.filter((f) => f.severity === "PASS").length;
    const totalWarn = findings.filter((f) => f.severity === "WARN").length;
    const totalFail = findings.filter((f) => f.severity === "FAIL").length;

    console.log("================================================================================");
    console.log("  AUDIT SUMMARY");
    console.log("================================================================================");
    console.log();
    console.log(`  PASS  : ${totalPass}`);
    console.log(`  WARN  : ${totalWarn}`);
    console.log(`  FAIL  : ${totalFail}`);
    console.log();

    let recommendation: string;
    if (totalFail === 0 && totalWarn === 0) {
      recommendation = "ready for demo";
    } else if (totalFail === 0 && totalWarn > 0) {
      recommendation = "safe to run demo reset after backup (warnings only)";
    } else {
      recommendation = "manual review required (FAIL items present)";
    }
    console.log(`  Recommendation: ${recommendation}`);
    console.log();
    console.log("================================================================================");
    console.log("  READ-ONLY AUDIT: no data was modified.");
    console.log("================================================================================");

    // -------------------------------------------------------------------
    // H. Exit code
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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
