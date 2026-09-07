import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AccountClassCode,
  CashBankAccountType,
  NormalBalanceSide,
  Prisma,
  VoucherLineSide,
  VoucherStatus,
  VoucherType,
} from "../generated/prisma/client";
import { parseIsoDate } from "../common/date-rules";
import { PrismaService } from "../prisma/prisma.service";
import { ReportQueryDto } from "./dto/report-query.dto";

type FiscalYearSummary = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  company: {
    id: string;
    name: string;
    legalName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    currency: string;
    printLogoPath: string | null;
    printHeaderName: string | null;
    printFooterText: string | null;
    updatedAt: Date;
  };
};

type AccountingPeriodSummary = {
  id: string;
  fiscalYearId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type ProjectSummary = {
  id: string;
  code: string;
  name: string;
};

type CostCenterSummary = {
  id: string;
  projectId: string;
  code: string;
  name: string;
  project: ProjectSummary;
};

type ReportContext = {
  fiscalYear: FiscalYearSummary;
  accountingPeriod: AccountingPeriodSummary | null;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  project: ProjectSummary | null;
  costCenter: CostCenterSummary | null;
};

type BalanceSheetContext = {
  fiscalYear: FiscalYearSummary;
  accountingPeriod: AccountingPeriodSummary | null;
  asOfDate: Date;
  project: ProjectSummary | null;
  costCenter: CostCenterSummary | null;
};

type FinancialStatementRow = {
  accountClass: {
    id: string;
    code: string;
    name: string;
    normalBalance: NormalBalanceSide;
  };
  accountGroup: {
    id: string;
    code: string;
    name: string;
  };
  amount: string;
  creditMovement: string;
  debitMovement: string;
  ledgerAccount: {
    id: string;
    code: string;
    name: string;
  };
  signedAmount: Prisma.Decimal;
};

type BalanceSheetRow = {
  accountClass: {
    id: string;
    code: string;
    name: string;
    normalBalance: NormalBalanceSide;
  };
  accountGroup: {
    id: string;
    code: string;
    name: string;
  };
  amount: string;
  balanceCredit: string;
  balanceDebit: string;
  creditMovement: string;
  debitMovement: string;
  ledgerAccount: {
    id: string;
    code: string;
    name: string;
  };
  normalBalance: NormalBalanceSide;
  signedAmount: Prisma.Decimal;
};

type BalanceSummary = {
  debit: string;
  credit: string;
  signedAmount: string;
  balanceSide: NormalBalanceSide;
};

type DebitCreditTotals = {
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};

type ProjectCostRow = {
  accountClass: {
    code: string;
    id: string;
    name: string;
    normalBalance: NormalBalanceSide;
  };
  accountGroup: {
    code: string;
    id: string;
    name: string;
  };
  costCenterId: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  creditTotal: Prisma.Decimal;
  debitTotal: Prisma.Decimal;
  ledgerAccount: {
    code: string;
    id: string;
    name: string;
  };
};

type ReportType =
  | "LEDGER"
  | "CASH_BOOK"
  | "BANK_BOOK"
  | "MFS_BOOK"
  | "TRIAL_BALANCE"
  | "INCOME_STATEMENT"
  | "BALANCE_SHEET"
  | "PROJECT_LEDGER"
  | "PROJECT_COST";

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getLedger(companyId: string, query: ReportQueryDto) {
    if (!query.ledgerAccountId) {
      throw new BadRequestException(
        "ledgerAccountId is required for the ledger report.",
      );
    }

    const context = await this.resolveReportContext(companyId, query);
    const ledgerAccount = await this.findLedgerAccount(query.ledgerAccountId);
    const baseWhere = this.buildLineFilter(query, {
      ledgerAccountId: ledgerAccount.id,
    });
    const openingTotals = await this.sumDebitCredit(
      baseWhere,
      this.buildVoucherDateFilter(context, "opening"),
    );
    const periodTotals = await this.sumDebitCredit(
      baseWhere,
      this.buildVoucherDateFilter(context, "period"),
    );
    const openingSigned = this.signedBalance(
      openingTotals.debit,
      openingTotals.credit,
      ledgerAccount.normalBalance,
    );
    const periodSigned = this.signedBalance(
      periodTotals.debit,
      periodTotals.credit,
      ledgerAccount.normalBalance,
    );
    const closingSigned = openingSigned.plus(periodSigned);
    const lines = await this.findReportLines(
      baseWhere,
      this.buildVoucherDateFilter(context, "period"),
    );
    let runningBalance = openingSigned;

    return {
      reportType: "LEDGER" satisfies ReportType,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      ledgerAccount: {
        id: ledgerAccount.id,
        code: ledgerAccount.code,
        name: ledgerAccount.name,
        normalBalance: ledgerAccount.normalBalance,
        isActive: ledgerAccount.isActive,
        accountGroup: {
          id: ledgerAccount.accountGroup.id,
          code: ledgerAccount.accountGroup.code,
          name: ledgerAccount.accountGroup.name,
          accountClass: {
            id: ledgerAccount.accountGroup.accountClass.id,
            code: ledgerAccount.accountGroup.accountClass.code,
            name: ledgerAccount.accountGroup.accountClass.name,
            normalBalance: ledgerAccount.accountGroup.accountClass.normalBalance,
          },
        },
      },
      filters: this.summarizeFilters(context),
      openingBalance: this.formatBalance(
        openingSigned,
        ledgerAccount.normalBalance,
      ),
      periodDebit: this.toMoney(periodTotals.debit),
      periodCredit: this.toMoney(periodTotals.credit),
      closingBalance: this.formatBalance(
        closingSigned,
        ledgerAccount.normalBalance,
      ),
      lines: lines.map((line) => {
        runningBalance = runningBalance.plus(
          this.signedLineMovement(
            line.side,
            line.amount,
            ledgerAccount.normalBalance,
          ),
        );

        return {
          id: line.id,
          voucherDate: this.formatDate(line.voucher.voucherDate),
          systemVoucherNo: line.voucher.systemVoucherNo,
          voucherType: line.voucher.voucherType,
          narration: line.voucher.narration,
          lineNo: line.lineNo,
          lineDescription: line.description,
          debit: this.toMoney(
            line.side === VoucherLineSide.DEBIT ? line.amount : ZERO,
          ),
          credit: this.toMoney(
            line.side === VoucherLineSide.CREDIT ? line.amount : ZERO,
          ),
          runningBalance: this.formatBalance(
            runningBalance,
            ledgerAccount.normalBalance,
          ),
          project: line.project ? this.summarizeProject(line.project) : null,
          costCenter: line.costCenter
            ? this.summarizeLineCostCenter(line.costCenter)
            : null,
          cashBankAccount: line.cashBankAccount
            ? this.summarizeCashBankAccount(line.cashBankAccount)
            : null,
        };
      }),
    };
  }

  async getProjectLedger(companyId: string, query: ReportQueryDto) {
    if (!query.projectId) {
      throw new BadRequestException(
        "projectId is required for the project ledger report.",
      );
    }

    const context = await this.resolveReportContext(companyId, query);
    const project = context.project!;

    const baseWhere = this.buildProjectLedgerLineFilter(query);
    const openingTotals = await this.sumDebitCredit(
      baseWhere,
      this.buildVoucherDateFilter(context, "opening"),
    );
    const periodTotals = await this.sumDebitCredit(
      baseWhere,
      this.buildVoucherDateFilter(context, "period"),
    );
    const openingSigned = openingTotals.debit.minus(openingTotals.credit);
    const lines = await this.findProjectLedgerLines(
      baseWhere,
      this.buildVoucherDateFilter(context, "period"),
    );
    let runningBalance = openingSigned;

    return {
      reportType: "PROJECT_LEDGER" satisfies string,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
      },
      costCenter: context.costCenter
        ? {
            id: context.costCenter.id,
            code: context.costCenter.code,
            name: context.costCenter.name,
          }
        : null,
      filters: this.summarizeProjectLedgerFilters(context, query),
      totals: {
        debitTotal: this.toMoney(periodTotals.debit),
        creditTotal: this.toMoney(periodTotals.credit),
        netMovement: this.toMoney(
          periodTotals.debit.minus(periodTotals.credit),
        ),
      },
      openingBalance: this.toMoney(openingSigned),
      lineCount: lines.length,
      lines: lines.map((line) => {
        const lineMovement =
          line.side === VoucherLineSide.DEBIT
            ? line.amount
            : line.amount.negated();
        runningBalance = runningBalance.plus(lineMovement);

        return {
          id: line.id,
          voucherId: line.voucher.id,
          date: this.formatDate(line.voucher.voucherDate),
          systemVoucherNo: line.voucher.systemVoucherNo,
          voucherType: line.voucher.voucherType,
          ledgerAccountId: line.ledgerAccount.id,
          ledgerCode: line.ledgerAccount.code,
          ledgerName: line.ledgerAccount.name,
          accountClass: {
            code: line.ledgerAccount.accountGroup.accountClass.code,
            name: line.ledgerAccount.accountGroup.accountClass.name,
          },
          accountGroup: {
            code: line.ledgerAccount.accountGroup.code,
            name: line.ledgerAccount.accountGroup.name,
          },
          costCenterId: line.costCenter?.id ?? null,
          costCenterCode: line.costCenter?.code ?? null,
          costCenterName: line.costCenter?.name ?? null,
          narration: line.voucher.narration,
          lineDescription: line.description,
          debit: this.toMoney(
            line.side === VoucherLineSide.DEBIT ? line.amount : ZERO,
          ),
          credit: this.toMoney(
            line.side === VoucherLineSide.CREDIT ? line.amount : ZERO,
          ),
          runningBalance: this.toMoney(runningBalance),
        };
      }),
    };
  }

  getCashBook(companyId: string, query: ReportQueryDto) {
    return this.getCashBankBook(
      companyId,
      query,
      CashBankAccountType.CASH,
      "CASH_BOOK",
    );
  }

  getBankBook(companyId: string, query: ReportQueryDto) {
    return this.getCashBankBook(
      companyId,
      query,
      CashBankAccountType.BANK,
      "BANK_BOOK",
    );
  }

  getMfsBook(companyId: string, query: ReportQueryDto) {
    return this.getCashBankBook(
      companyId,
      query,
      CashBankAccountType.MFS,
      "MFS_BOOK",
    );
  }

  async getProjectFundMovement(companyId: string, query: ReportQueryDto) {
    if (!query.projectId) {
      throw new BadRequestException(
        "projectId is required for the project fund movement report.",
      );
    }

    // Map dateFrom/dateTo to startDate/endDate if they are provided
    if (query.dateFrom) {
      query.startDate = query.dateFrom;
    }
    if (query.dateTo) {
      query.endDate = query.dateTo;
    }

    const context = await this.resolveReportContext(companyId, query);
    const project = context.project!;

    // Build the query where inputs
    const projectFilter: Prisma.VoucherLineWhereInput["projectId"] = query.projectId;

    const lineFilterOptions: Prisma.VoucherLineWhereInput = {
      projectId: projectFilter,
      ledgerAccount: {
        isCashBank: true,
      },
      ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
      ...(query.cashBankAccountId ? { cashBankAccountId: query.cashBankAccountId } : {}),
      ...(query.accountType && query.accountType !== "ALL"
        ? {
            cashBankAccount: {
              accountType: query.accountType as CashBankAccountType,
            },
          }
        : {}),
    };

    const periodVoucherFilter: Prisma.VoucherWhereInput = {
      ...this.buildVoucherDateFilter(context, "period"),
      ...(query.voucherType && query.voucherType !== "ALL"
        ? { voucherType: query.voucherType as VoucherType }
        : {}),
    };

    const openingVoucherFilter: Prisma.VoucherWhereInput = {
      ...this.buildVoucherDateFilter(context, "opening"),
      ...(query.voucherType && query.voucherType !== "ALL"
        ? { voucherType: query.voucherType as VoucherType }
        : {}),
    };

    // Calculate opening balances
    const [openingDebitSum, openingCreditSum] = await Promise.all([
      this.prisma.voucherLine.aggregate({
        _sum: { amount: true },
        where: {
          ...lineFilterOptions,
          side: VoucherLineSide.DEBIT,
          voucher: openingVoucherFilter,
        },
      }),
      this.prisma.voucherLine.aggregate({
        _sum: { amount: true },
        where: {
          ...lineFilterOptions,
          side: VoucherLineSide.CREDIT,
          voucher: openingVoucherFilter,
        },
      }),
    ]);

    const openingDebit = openingDebitSum._sum.amount ? new Prisma.Decimal(openingDebitSum._sum.amount.toString()) : ZERO;
    const openingCredit = openingCreditSum._sum.amount ? new Prisma.Decimal(openingCreditSum._sum.amount.toString()) : ZERO;
    const openingSigned = openingDebit.minus(openingCredit);

    // Calculate period totals
    const [periodDebitSum, periodCreditSum] = await Promise.all([
      this.prisma.voucherLine.aggregate({
        _sum: { amount: true },
        where: {
          ...lineFilterOptions,
          side: VoucherLineSide.DEBIT,
          voucher: periodVoucherFilter,
        },
      }),
      this.prisma.voucherLine.aggregate({
        _sum: { amount: true },
        where: {
          ...lineFilterOptions,
          side: VoucherLineSide.CREDIT,
          voucher: periodVoucherFilter,
        },
      }),
    ]);

    const periodDebit = periodDebitSum._sum.amount ? new Prisma.Decimal(periodDebitSum._sum.amount.toString()) : ZERO;
    const periodCredit = periodCreditSum._sum.amount ? new Prisma.Decimal(periodCreditSum._sum.amount.toString()) : ZERO;
    const closingSigned = openingSigned.plus(periodDebit).minus(periodCredit);

    // Find period report lines
    const lines = await this.prisma.voucherLine.findMany({
      include: {
        cashBankAccount: {
          include: {
            ledgerAccount: {
              include: {
                accountGroup: {
                  include: { accountClass: true },
                },
              },
            },
          },
        },
        costCenter: {
          include: {
            project: { select: { code: true, id: true, name: true } },
          },
        },
        ledgerAccount: {
          include: {
            accountGroup: {
              include: { accountClass: true },
            },
          },
        },
        project: true,
        voucher: {
          include: {
            lines: {
              include: {
                ledgerAccount: {
                  include: {
                    accountGroup: {
                      include: { accountClass: true },
                    },
                  },
                },
              },
              orderBy: [{ lineNo: "asc" }, { id: "asc" }],
            },
          },
        },
      },
      where: {
        ...lineFilterOptions,
        voucher: periodVoucherFilter,
      },
    });

    // Sort lines chronologically
    lines.sort((left, right) => {
      const byDate =
        left.voucher.voucherDate.getTime() - right.voucher.voucherDate.getTime();

      if (byDate !== 0) {
        return byDate;
      }

      const byVoucherNo = left.voucher.systemVoucherNo.localeCompare(
        right.voucher.systemVoucherNo,
      );

      if (byVoucherNo !== 0) {
        return byVoucherNo;
      }

      if (left.lineNo !== right.lineNo) {
        return left.lineNo - right.lineNo;
      }

      return left.id.localeCompare(right.id);
    });

    let runningBalance = openingSigned;

    return {
      reportType: "PROJECT_FUND_MOVEMENT" satisfies string,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      project: this.summarizeProject(project),
      costCenter: context.costCenter
        ? this.summarizeCostCenter(context.costCenter)
        : null,
      filters: {
        ...this.summarizeFilters(context),
        accountType: query.accountType ?? "ALL",
        voucherType: query.voucherType ?? "ALL",
        cashBankAccountId: query.cashBankAccountId ?? null,
      },
      totals: {
        periodDebit: this.toMoney(periodDebit),
        periodCredit: this.toMoney(periodCredit),
        netMovement: this.toMoney(periodDebit.minus(periodCredit)),
      },
      openingBalance: this.formatBalance(
        openingSigned,
        NormalBalanceSide.DEBIT,
      ),
      periodDebit: this.toMoney(periodDebit),
      periodCredit: this.toMoney(periodCredit),
      closingBalance: this.formatBalance(
        closingSigned,
        NormalBalanceSide.DEBIT,
      ),
      lineCount: lines.length,
      lines: lines.map((line) => {
        runningBalance = runningBalance.plus(
          line.side === VoucherLineSide.DEBIT
            ? line.amount
            : line.amount.negated(),
        );

        return {
          id: line.id,
          date: this.formatDate(line.voucher.voucherDate),
          voucherId: line.voucher.id,
          voucherNo: line.voucher.systemVoucherNo,
          voucherNumber: line.voucher.systemVoucherNo,
          voucherType: line.voucher.voucherType,
          ledgerAccount: this.summarizeLedgerAccount(line.ledgerAccount),
          ledgerCode: line.ledgerAccount.code,
          ledgerName: line.ledgerAccount.name,
          cashBankAccount: line.cashBankAccount
            ? this.summarizeCashBankAccount(line.cashBankAccount)
            : null,
          cashBankAccountName: line.cashBankAccount?.displayName ?? null,
          cashBankAccountType: line.cashBankAccount?.accountType ?? null,
          project: this.summarizeProject(line.project!),
          projectCode: line.project?.code ?? null,
          projectName: line.project?.name ?? null,
          costCenter: line.costCenter
            ? this.summarizeLineCostCenter(line.costCenter)
            : null,
          costCenterCode: line.costCenter?.code ?? null,
          costCenterName: line.costCenter?.name ?? null,
          narration: line.voucher.narration,
          description: line.description,
          particular: line.description || line.voucher.narration || "",
          debit: this.toMoney(
            line.side === VoucherLineSide.DEBIT ? line.amount : ZERO,
          ),
          credit: this.toMoney(
            line.side === VoucherLineSide.CREDIT ? line.amount : ZERO,
          ),
          inflow: this.toMoney(
            line.side === VoucherLineSide.DEBIT ? line.amount : ZERO,
          ),
          outflow: this.toMoney(
            line.side === VoucherLineSide.CREDIT ? line.amount : ZERO,
          ),
          runningBalance: this.formatBalance(
            runningBalance,
            NormalBalanceSide.DEBIT,
          ),
          runningBalanceAmount: this.toMoney(runningBalance),
        };
      }),
    };
  }

  async getProjectCost(companyId: string, query: ReportQueryDto) {
    if (!query.projectId) {
      throw new BadRequestException(
        "projectId is required for the project cost report.",
      );
    }

    const context = await this.resolveReportContext(companyId, query);
    const project = context.project!;

    const lineWhere = this.buildProjectCostLineFilter(query);
    const voucherWhere = this.buildVoucherDateFilter(context, "period");

    type LedgerWithGroup = Prisma.LedgerAccountGetPayload<{
      include: {
        accountGroup: {
          include: { accountClass: true };
        };
      };
    }>;

    // Aggregate only lines where costCenterId IS NULL, grouped by ledgerAccountId.
    // Lines with a costCenterId are handled separately below so each VoucherLine
    // contributes to exactly one grouped row.
    const nullCcGroupRows = await this.prisma.voucherLine.groupBy({
      _sum: { amount: true },
      by: ["ledgerAccountId", "side"],
      where: {
        ...lineWhere,
        costCenterId: null,
        voucher: voucherWhere,
      },
    });

    const nullCcLedgerIds = new Set(
      nullCcGroupRows.map((r) => r.ledgerAccountId),
    );
    const nullCcLedgerMap = new Map<string, LedgerWithGroup>();

    if (nullCcLedgerIds.size > 0) {
      const ledgers = await this.prisma.ledgerAccount.findMany({
        include: {
          accountGroup: { include: { accountClass: true } },
        },
        where: { id: { in: [...nullCcLedgerIds] } },
      });

      for (const la of ledgers) {
        nullCcLedgerMap.set(la.id, la);
      }
    }

    const nullCcAgg = new Map<
      string,
      { debit: Prisma.Decimal; credit: Prisma.Decimal }
    >();

    for (const row of nullCcGroupRows) {
      const cur = nullCcAgg.get(row.ledgerAccountId) ?? {
        credit: ZERO,
        debit: ZERO,
      };
      const amount = row._sum.amount ?? ZERO;

      nullCcAgg.set(row.ledgerAccountId, {
        credit:
          row.side === VoucherLineSide.CREDIT
            ? cur.credit.plus(amount)
            : cur.credit,
        debit:
          row.side === VoucherLineSide.DEBIT
            ? cur.debit.plus(amount)
            : cur.debit,
      });
    }

    const rows: ProjectCostRow[] = [];

    for (const [ledgerId, totals] of nullCcAgg) {
      const ledger = nullCcLedgerMap.get(ledgerId);

      if (
        !ledger ||
        (totals.debit.equals(ZERO) && totals.credit.equals(ZERO))
      ) {
        continue;
      }

      const accountClass = ledger.accountGroup.accountClass;

      rows.push({
        accountClass: {
          code: accountClass.code,
          id: accountClass.id,
          name: accountClass.name,
          normalBalance: accountClass.normalBalance,
        },
        accountGroup: {
          code: ledger.accountGroup.code,
          id: ledger.accountGroup.id,
          name: ledger.accountGroup.name,
        },
        costCenterId: null,
        costCenterCode: null,
        costCenterName: null,
        creditTotal: totals.credit,
        debitTotal: totals.debit,
        ledgerAccount: {
          code: ledger.code,
          id: ledger.id,
          name: ledger.name,
        },
      });
    }

    // Fetch cost-center-grouped rows for lines that have a costCenterId
    const costCenterRows = await this.prisma.voucherLine.groupBy({
      _sum: { amount: true },
      by: ["costCenterId", "ledgerAccountId", "side"],
      where: {
        ...lineWhere,
        costCenterId: { not: null },
        voucher: voucherWhere,
      },
    });

    const ccLedgerIds = new Set(
      costCenterRows.map((r) => r.ledgerAccountId),
    );
    const ccLedgerMap = new Map<string, LedgerWithGroup>();

    if (ccLedgerIds.size > 0) {
      const ccs = await this.prisma.ledgerAccount.findMany({
        include: {
          accountGroup: { include: { accountClass: true } },
        },
        where: { id: { in: [...ccLedgerIds] } },
      });

      for (const la of ccs) {
        ccLedgerMap.set(la.id, la);
      }
    }

    const ccMap = new Map<string, { id: string; code: string; name: string }>();
    const allCcIds = new Set(
      costCenterRows
        .map((r) => r.costCenterId)
        .filter((id): id is string => id !== null),
    );

    if (allCcIds.size > 0) {
      const costCenters = await this.prisma.costCenter.findMany({
        where: { id: { in: [...allCcIds] } },
      });

      for (const cc of costCenters) {
        ccMap.set(cc.id, { code: cc.code, id: cc.id, name: cc.name });
      }
    }

    // Aggregate by (costCenterId, ledgerAccountId)
    const ccAgg = new Map<string, { debit: Prisma.Decimal; credit: Prisma.Decimal }>();

    for (const row of costCenterRows) {
      const key = `${row.costCenterId}::${row.ledgerAccountId}`;
      const cur = ccAgg.get(key) ?? { credit: ZERO, debit: ZERO };
      const amount = row._sum.amount ?? ZERO;

      ccAgg.set(key, {
        credit:
          row.side === VoucherLineSide.CREDIT
            ? cur.credit.plus(amount)
            : cur.credit,
        debit:
          row.side === VoucherLineSide.DEBIT
            ? cur.debit.plus(amount)
            : cur.debit,
      });
    }

    // Add cost-center-specific rows
    for (const [key, totals] of ccAgg) {
      const [ccId, ledgerId] = key.split("::");
      const ledger = ccLedgerMap.get(ledgerId);

      if (!ledger || (totals.debit.equals(ZERO) && totals.credit.equals(ZERO))) {
        continue;
      }

      const cc = ccMap.get(ccId);
      const accountClass = ledger.accountGroup.accountClass;

      rows.push({
        accountClass: {
          code: accountClass.code,
          id: accountClass.id,
          name: accountClass.name,
          normalBalance: accountClass.normalBalance,
        },
        accountGroup: {
          code: ledger.accountGroup.code,
          id: ledger.accountGroup.id,
          name: ledger.accountGroup.name,
        },
        costCenterId: ccId,
        costCenterCode: cc?.code ?? null,
        costCenterName: cc?.name ?? null,
        creditTotal: totals.credit,
        debitTotal: totals.debit,
        ledgerAccount: {
          code: ledger.code,
          id: ledger.id,
          name: ledger.name,
        },
      });
    }

    // Sort rows by cost center, then class sort key, then group code/name, then ledger code/name
    rows.sort((left, right) => {
      const ccLeft = left.costCenterCode ?? "";
      const ccRight = right.costCenterCode ?? "";

      if (ccLeft !== ccRight) {
        return ccLeft.localeCompare(ccRight);
      }

      const classOrder =
        this.accountClassSortKey(left.accountClass.code) -
        this.accountClassSortKey(right.accountClass.code);

      if (classOrder !== 0) {
        return classOrder;
      }

      const groupCode = left.accountGroup.code.localeCompare(
        right.accountGroup.code,
      );

      if (groupCode !== 0) {
        return groupCode;
      }

      const groupName = left.accountGroup.name.localeCompare(
        right.accountGroup.name,
      );

      if (groupName !== 0) {
        return groupName;
      }

      const ledgerCode = left.ledgerAccount.code.localeCompare(
        right.ledgerAccount.code,
      );

      if (ledgerCode !== 0) {
        return ledgerCode;
      }

      return left.ledgerAccount.name.localeCompare(right.ledgerAccount.name);
    });

    // Compute totals
    let debitTotal = ZERO;
    let creditTotal = ZERO;
    let expenseTotal = ZERO;
    let assetTotal = ZERO;
    let incomeTotal = ZERO;
    let liabilityTotal = ZERO;
    let equityTotal = ZERO;

    for (const row of rows) {
      const net = row.debitTotal.minus(row.creditTotal);
      debitTotal = debitTotal.plus(row.debitTotal);
      creditTotal = creditTotal.plus(row.creditTotal);

      const code = row.accountClass.code;

      if (code === AccountClassCode.EXPENSE) {
        expenseTotal = expenseTotal.plus(net);
      } else if (code === AccountClassCode.ASSET) {
        assetTotal = assetTotal.plus(net);
      } else if (code === AccountClassCode.INCOME) {
        incomeTotal = incomeTotal.plus(net);
      } else if (code === AccountClassCode.LIABILITY) {
        liabilityTotal = liabilityTotal.plus(net);
      } else if (code === AccountClassCode.EQUITY) {
        equityTotal = equityTotal.plus(net);
      }
    }

    const netMovement = debitTotal.minus(creditTotal);

    // Scan for last transaction date per ledger per cost center
    const lastDateMap = new Map<string, Date>();
    const dateRows = await this.prisma.voucherLine.findMany({
      select: {
        costCenterId: true,
        ledgerAccountId: true,
        voucher: { select: { voucherDate: true } },
      },
      where: {
        ...lineWhere,
        voucher: voucherWhere,
      },
    });

    for (const dr of dateRows) {
      const key = `${dr.costCenterId ?? "__NONE__"}::${dr.ledgerAccountId}`;
      const cur = lastDateMap.get(key);

      if (!cur || dr.voucher.voucherDate > cur) {
        lastDateMap.set(key, dr.voucher.voucherDate);
      }
    }

    const lineCount = dateRows.length;

    return {
      reportType: "PROJECT_COST" satisfies string,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
      },
      costCenter: context.costCenter
        ? {
            code: context.costCenter.code,
            id: context.costCenter.id,
            name: context.costCenter.name,
          }
        : null,
      filters: {
        costCenter: context.costCenter
          ? {
              code: context.costCenter.code,
              id: context.costCenter.id,
              name: context.costCenter.name,
            }
          : null,
        expenseOnly: query.expenseOnly ?? false,
        ledgerAccount: query.ledgerAccountId ?? null,
        accountClass: query.accountClassCode ?? null,
        accountGroup: query.accountGroupId ?? null,
      },
      totals: {
        assetProjectCostTotal: this.toMoney(assetTotal),
        creditTotal: this.toMoney(creditTotal),
        debitTotal: this.toMoney(debitTotal),
        equityTotal: this.toMoney(equityTotal),
        expenseTotal: this.toMoney(expenseTotal),
        incomeTotal: this.toMoney(incomeTotal),
        liabilityTotal: this.toMoney(liabilityTotal),
        netMovement: this.toMoney(netMovement),
      },
      lineCount,
      groupedRowCount: rows.length,
      rows: rows.map((row) => {
        const net = row.debitTotal.minus(row.creditTotal);
        const key = `${row.costCenterId ?? "__NONE__"}::${row.ledgerAccount.id}`;
        const lastDate = lastDateMap.get(key);

        return {
          accountClass: {
            code: row.accountClass.code,
            name: row.accountClass.name,
          },
          accountGroup: {
            code: row.accountGroup.code,
            name: row.accountGroup.name,
          },
          costCenterCode: row.costCenterCode,
          costCenterId: row.costCenterId,
          costCenterName: row.costCenterName,
          creditTotal: this.toMoney(row.creditTotal),
          debitTotal: this.toMoney(row.debitTotal),
          lastTransactionDate: lastDate
            ? this.formatDate(lastDate)
            : null,
          ledgerAccount: {
            code: row.ledgerAccount.code,
            id: row.ledgerAccount.id,
            name: row.ledgerAccount.name,
          },
          netAmount: this.toMoney(net),
        };
      }),
    };
  }

  async getCostCenterSummary(companyId: string, query: ReportQueryDto) {
    if (!query.projectId) {
      throw new BadRequestException(
        "projectId is required for the cost center summary report.",
      );
    }

    const context = await this.resolveReportContext(companyId, query);
    const project = context.project!;

    const lineWhere = this.buildProjectCostLineFilter(query);
    const voucherWhere = this.buildVoucherDateFilter(context, "period");

    const lines = await this.prisma.voucherLine.findMany({
      select: {
        amount: true,
        costCenterId: true,
        ledgerAccountId: true,
        side: true,
        voucher: {
          select: {
            voucherDate: true,
          },
        },
        ledgerAccount: {
          select: {
            accountGroup: {
              select: {
                accountClass: {
                  select: { code: true },
                },
              },
            },
          },
        },
      },
      where: {
        ...lineWhere,
        voucher: voucherWhere,
      },
    });

    type CostCenterTotals = {
      costCenterId: string | null;
      debitTotal: Prisma.Decimal;
      creditTotal: Prisma.Decimal;
      expenseTotal: Prisma.Decimal;
      assetTotal: Prisma.Decimal;
      incomeTotal: Prisma.Decimal;
      liabilityTotal: Prisma.Decimal;
      equityTotal: Prisma.Decimal;
      lineCount: number;
      lastTransactionDate: Date | null;
    };

    const ccMap = new Map<string, CostCenterTotals>();

    for (const line of lines) {
      const ccId = line.costCenterId ?? "__UNASSIGNED__";
      let cur = ccMap.get(ccId);

      if (!cur) {
        cur = {
          assetTotal: ZERO,
          costCenterId: line.costCenterId,
          creditTotal: ZERO,
          debitTotal: ZERO,
          equityTotal: ZERO,
          expenseTotal: ZERO,
          incomeTotal: ZERO,
          lastTransactionDate: null,
          liabilityTotal: ZERO,
          lineCount: 0,
        };
        ccMap.set(ccId, cur);
      }

      cur.lineCount += 1;

      if (line.side === VoucherLineSide.DEBIT) {
        cur.debitTotal = cur.debitTotal.plus(line.amount);
      } else {
        cur.creditTotal = cur.creditTotal.plus(line.amount);
      }

      const net = line.side === VoucherLineSide.DEBIT
        ? line.amount
        : line.amount.negated();

      const classCode = line.ledgerAccount.accountGroup.accountClass.code;

      if (classCode === AccountClassCode.EXPENSE) {
        cur.expenseTotal = cur.expenseTotal.plus(net);
      } else if (classCode === AccountClassCode.ASSET) {
        cur.assetTotal = cur.assetTotal.plus(net);
      } else if (classCode === AccountClassCode.INCOME) {
        cur.incomeTotal = cur.incomeTotal.plus(net);
      } else if (classCode === AccountClassCode.LIABILITY) {
        cur.liabilityTotal = cur.liabilityTotal.plus(net);
      } else if (classCode === AccountClassCode.EQUITY) {
        cur.equityTotal = cur.equityTotal.plus(net);
      }

      const voucherDate = line.voucher.voucherDate;

      if (!cur.lastTransactionDate || voucherDate > cur.lastTransactionDate) {
        cur.lastTransactionDate = voucherDate;
      }
    }

    const ccIds = [...ccMap.keys()]
      .filter((id) => id !== "__UNASSIGNED__");

    const ccDetails = ccIds.length > 0
      ? await this.prisma.costCenter.findMany({
          where: { id: { in: ccIds } },
          select: { code: true, id: true, name: true },
        })
      : [];

    const ccDetailMap = new Map(
      ccDetails.map((cc) => [cc.id, cc]),
    );

    const rows = [...ccMap.entries()]
      .sort(([a], [b]) => {
        const aIsUnassigned = a === "__UNASSIGNED__";
        const bIsUnassigned = b === "__UNASSIGNED__";

        if (aIsUnassigned && !bIsUnassigned) {
          return 1;
        }
        if (!aIsUnassigned && bIsUnassigned) {
          return -1;
        }
        if (aIsUnassigned && bIsUnassigned) {
          return 0;
        }

        const aDetail = ccDetailMap.get(a);
        const bDetail = ccDetailMap.get(b);

        const aCode = aDetail?.code ?? "";
        const bCode = bDetail?.code ?? "";

        return aCode.localeCompare(bCode);
      })
      .map(([ccId, totals]) => {
        const detail = ccId !== "__UNASSIGNED__"
          ? ccDetailMap.get(ccId)
          : null;

        return {
          assetProjectCostTotal: this.toMoney(totals.assetTotal),
          costCenterCode: detail?.code ?? null,
          costCenterId: totals.costCenterId,
          costCenterName: detail?.name ?? null,
          creditTotal: this.toMoney(totals.creditTotal),
          debitTotal: this.toMoney(totals.debitTotal),
          equityTotal: this.toMoney(totals.equityTotal),
          expenseTotal: this.toMoney(totals.expenseTotal),
          incomeTotal: this.toMoney(totals.incomeTotal),
          lastTransactionDate: totals.lastTransactionDate
            ? this.formatDate(totals.lastTransactionDate)
            : null,
          liabilityTotal: this.toMoney(totals.liabilityTotal),
          lineCount: totals.lineCount,
          netMovement: this.toMoney(
            totals.debitTotal.minus(totals.creditTotal),
          ),
        };
      });

    let debitTotal = ZERO;
    let creditTotal = ZERO;
    let expenseTotal = ZERO;
    let assetTotal = ZERO;
    let incomeTotal = ZERO;
    let liabilityTotal = ZERO;
    let equityTotal = ZERO;
    let lineCount = 0;
    let unassignedLineCount = 0;

    for (const [ccId, totals] of ccMap) {
      debitTotal = debitTotal.plus(totals.debitTotal);
      creditTotal = creditTotal.plus(totals.creditTotal);
      expenseTotal = expenseTotal.plus(totals.expenseTotal);
      assetTotal = assetTotal.plus(totals.assetTotal);
      incomeTotal = incomeTotal.plus(totals.incomeTotal);
      liabilityTotal = liabilityTotal.plus(totals.liabilityTotal);
      equityTotal = equityTotal.plus(totals.equityTotal);
      lineCount += totals.lineCount;

      if (ccId === "__UNASSIGNED__") {
        unassignedLineCount = totals.lineCount;
      }
    }

    const netMovement = debitTotal.minus(creditTotal);

    return {
      reportType: "COST_CENTER_SUMMARY" satisfies string,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
      },
      costCenter: context.costCenter
        ? {
            code: context.costCenter.code,
            id: context.costCenter.id,
            name: context.costCenter.name,
          }
        : null,
      filters: {
        costCenter: context.costCenter
          ? {
              code: context.costCenter.code,
              id: context.costCenter.id,
              name: context.costCenter.name,
            }
          : null,
        ledgerAccount: query.ledgerAccountId ?? null,
        accountClass: query.accountClassCode ?? null,
        accountGroup: query.accountGroupId ?? null,
      },
      totals: {
        assetProjectCostTotal: this.toMoney(assetTotal),
        costCenterCount: [...ccMap.keys()].filter(
          (id) => id !== "__UNASSIGNED__",
        ).length,
        creditTotal: this.toMoney(creditTotal),
        debitTotal: this.toMoney(debitTotal),
        equityTotal: this.toMoney(equityTotal),
        expenseTotal: this.toMoney(expenseTotal),
        incomeTotal: this.toMoney(incomeTotal),
        liabilityTotal: this.toMoney(liabilityTotal),
        lineCount,
        netMovement: this.toMoney(netMovement),
        unassignedLineCount,
      },
      rows,
    };
  }

  async getProjectFinancialSummary(companyId: string, query: ReportQueryDto) {
    if (!query.projectId) {
      throw new BadRequestException(
        "projectId is required for the project financial summary report.",
      );
    }

    const context = await this.resolveReportContext(companyId, query);
    const project = context.project!;

    const lineWhere = this.buildProjectCostLineFilter(query);
    const voucherWhere = this.buildVoucherDateFilter(context, "period");

    const lines = await this.prisma.voucherLine.findMany({
      select: {
        amount: true,
        costCenterId: true,
        ledgerAccountId: true,
        side: true,
        voucher: {
          select: {
            id: true,
            voucherDate: true,
          },
        },
        ledgerAccount: {
          select: {
            code: true,
            id: true,
            name: true,
            accountGroup: {
              select: {
                code: true,
                id: true,
                name: true,
                accountClass: {
                  select: {
                    code: true,
                    id: true,
                    name: true,
                    normalBalance: true,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        ...lineWhere,
        voucher: voucherWhere,
      },
    });

    // --- B. Top-level totals ---
    let totalDebit = ZERO;
    let totalCredit = ZERO;
    let firstDate: Date | null = null;
    let lastDate: Date | null = null;
    const voucherIds = new Set<string>();

    for (const line of lines) {
      if (line.side === VoucherLineSide.DEBIT) {
        totalDebit = totalDebit.plus(line.amount);
      } else {
        totalCredit = totalCredit.plus(line.amount);
      }

      voucherIds.add(line.voucher.id);

      const vDate = line.voucher.voucherDate;

      if (!firstDate || vDate < firstDate) {
        firstDate = vDate;
      }
      if (!lastDate || vDate > lastDate) {
        lastDate = vDate;
      }
    }

    const netMovement = totalDebit.minus(totalCredit);
    const lineCount = lines.length;
    const voucherCount = voucherIds.size;

    // --- C. Account-class breakdown ---
    type ClassBreakdown = {
      debitTotal: Prisma.Decimal;
      creditTotal: Prisma.Decimal;
      lineCount: number;
    };

    const classMap = new Map<string, ClassBreakdown>();

    for (const line of lines) {
      const classCode = line.ledgerAccount.accountGroup.accountClass.code;
      let cur = classMap.get(classCode);

      if (!cur) {
        cur = { creditTotal: ZERO, debitTotal: ZERO, lineCount: 0 };
        classMap.set(classCode, cur);
      }

      cur.lineCount += 1;

      if (line.side === VoucherLineSide.DEBIT) {
        cur.debitTotal = cur.debitTotal.plus(line.amount);
      } else {
        cur.creditTotal = cur.creditTotal.plus(line.amount);
      }
    }

    const classOrder = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

    const classBreakdown = classOrder
      .filter((code) => classMap.has(code))
      .map((code) => {
        const totals = classMap.get(code)!;
        const net = totals.debitTotal.minus(totals.creditTotal);

        return {
          accountClass: {
            code,
            name: this.classLabel(code),
          },
          creditTotal: this.toMoney(totals.creditTotal),
          debitTotal: this.toMoney(totals.debitTotal),
          lineCount: totals.lineCount,
          netMovement: this.toMoney(net),
          percentageOfTotalDebit: totalDebit.greaterThan(ZERO)
            ? this.toMoney(
                totals.debitTotal.times(100).dividedBy(totalDebit),
              )
            : "0.00",
          percentageOfTotalCredit: totalCredit.greaterThan(ZERO)
            ? this.toMoney(
                totals.creditTotal.times(100).dividedBy(totalCredit),
              )
            : "0.00",
        };
      });

    // --- D. Key management totals ---
    const classTotals = new Map<string, Prisma.Decimal>();

    for (const [code, totals] of classMap) {
      const net = totals.debitTotal.minus(totals.creditTotal);
      classTotals.set(code, net);
    }

    const projectExpenseTotal = classTotals.get("EXPENSE") ?? ZERO;
    const projectAssetCostTotal = classTotals.get("ASSET") ?? ZERO;
    const projectIncomeTotal = classTotals.get("INCOME") ?? ZERO;
    const projectLiabilityTotal = classTotals.get("LIABILITY") ?? ZERO;
    const projectEquityTotal = classTotals.get("EQUITY") ?? ZERO;
    const projectCostTotal = projectExpenseTotal.plus(projectAssetCostTotal);

    // --- E. Cost center breakdown ---
    type CcBreakdown = {
      debitTotal: Prisma.Decimal;
      creditTotal: Prisma.Decimal;
      expenseTotal: Prisma.Decimal;
      assetTotal: Prisma.Decimal;
      incomeTotal: Prisma.Decimal;
      liabilityTotal: Prisma.Decimal;
      equityTotal: Prisma.Decimal;
      lineCount: number;
      lastTransactionDate: Date | null;
    };

    const ccMap = new Map<string, CcBreakdown>();

    for (const line of lines) {
      const ccId = line.costCenterId ?? "__UNASSIGNED__";
      let cur = ccMap.get(ccId);

      if (!cur) {
        cur = {
          assetTotal: ZERO,
          creditTotal: ZERO,
          debitTotal: ZERO,
          equityTotal: ZERO,
          expenseTotal: ZERO,
          incomeTotal: ZERO,
          lastTransactionDate: null,
          liabilityTotal: ZERO,
          lineCount: 0,
        };
        ccMap.set(ccId, cur);
      }

      cur.lineCount += 1;

      if (line.side === VoucherLineSide.DEBIT) {
        cur.debitTotal = cur.debitTotal.plus(line.amount);
      } else {
        cur.creditTotal = cur.creditTotal.plus(line.amount);
      }

      const net = line.side === VoucherLineSide.DEBIT
        ? line.amount
        : line.amount.negated();

      const classCode = line.ledgerAccount.accountGroup.accountClass.code;

      if (classCode === AccountClassCode.EXPENSE) {
        cur.expenseTotal = cur.expenseTotal.plus(net);
      } else if (classCode === AccountClassCode.ASSET) {
        cur.assetTotal = cur.assetTotal.plus(net);
      } else if (classCode === AccountClassCode.INCOME) {
        cur.incomeTotal = cur.incomeTotal.plus(net);
      } else if (classCode === AccountClassCode.LIABILITY) {
        cur.liabilityTotal = cur.liabilityTotal.plus(net);
      } else if (classCode === AccountClassCode.EQUITY) {
        cur.equityTotal = cur.equityTotal.plus(net);
      }

      const vDate = line.voucher.voucherDate;

      if (!cur.lastTransactionDate || vDate > cur.lastTransactionDate) {
        cur.lastTransactionDate = vDate;
      }
    }

    const ccIds = [...ccMap.keys()].filter((id) => id !== "__UNASSIGNED__");
    const ccDetails = ccIds.length > 0
      ? await this.prisma.costCenter.findMany({
          where: { id: { in: ccIds } },
          select: { code: true, id: true, name: true },
        })
      : [];

    const ccDetailMap = new Map(ccDetails.map((cc) => [cc.id, cc]));

    const costCenterBreakdown = [...ccMap.entries()]
      .sort(([a], [b]) => {
        const aIsUnassigned = a === "__UNASSIGNED__";
        const bIsUnassigned = b === "__UNASSIGNED__";

        if (aIsUnassigned && !bIsUnassigned) return 1;
        if (!aIsUnassigned && bIsUnassigned) return -1;
        if (aIsUnassigned && bIsUnassigned) return 0;

        const aDetail = ccDetailMap.get(a);
        const bDetail = ccDetailMap.get(b);
        return (aDetail?.code ?? "").localeCompare(bDetail?.code ?? "");
      })
      .map(([ccId, totals]) => {
        const detail = ccId !== "__UNASSIGNED__"
          ? ccDetailMap.get(ccId)
          : null;

        const net = totals.debitTotal.minus(totals.creditTotal);

        return {
          assetProjectCostTotal: this.toMoney(totals.assetTotal),
          costCenterCode: detail?.code ?? null,
          costCenterId: ccId === "__UNASSIGNED__" ? null : ccId,
          costCenterName: detail?.name ?? null,
          creditTotal: this.toMoney(totals.creditTotal),
          debitTotal: this.toMoney(totals.debitTotal),
          expenseTotal: this.toMoney(totals.expenseTotal),
          lastTransactionDate: totals.lastTransactionDate
            ? this.formatDate(totals.lastTransactionDate)
            : null,
          lineCount: totals.lineCount,
          netMovement: this.toMoney(net),
        };
      });

    // --- F. Top ledger breakdown ---
    type LedgerBreakdown = {
      debitTotal: Prisma.Decimal;
      creditTotal: Prisma.Decimal;
      lineCount: number;
    };

    const ledgerMap = new Map<string, LedgerBreakdown>();

    for (const line of lines) {
      const laId = line.ledgerAccountId;
      let cur = ledgerMap.get(laId);

      if (!cur) {
        cur = { creditTotal: ZERO, debitTotal: ZERO, lineCount: 0 };
        ledgerMap.set(laId, cur);
      }

      cur.lineCount += 1;

      if (line.side === VoucherLineSide.DEBIT) {
        cur.debitTotal = cur.debitTotal.plus(line.amount);
      } else {
        cur.creditTotal = cur.creditTotal.plus(line.amount);
      }
    }

    const ledgerEntries = [...ledgerMap.entries()]
      .map(([laId, totals]) => {
        const net = totals.debitTotal.minus(totals.creditTotal);
        return { laId, totals, netAbs: net.abs() };
      })
      .sort((a, b) => b.netAbs.comparedTo(a.netAbs))
      .slice(0, 10);

    const topLedgerIds = ledgerEntries.map((e) => e.laId);
    const topLedgerDetails = topLedgerIds.length > 0
      ? await this.prisma.ledgerAccount.findMany({
          where: { id: { in: topLedgerIds } },
          select: {
            code: true,
            id: true,
            name: true,
            accountGroup: {
              select: {
                accountClass: {
                  select: { code: true, name: true },
                },
              },
            },
          },
        })
      : [];

    const topLedgerDetailMap = new Map(
      topLedgerDetails.map((la) => [la.id, la]),
    );

    const topLedgerBreakdown = ledgerEntries.map((entry) => {
      const detail = topLedgerDetailMap.get(entry.laId);
      const net = entry.totals.debitTotal.minus(entry.totals.creditTotal);

      return {
        accountClassCode: detail?.accountGroup.accountClass.code ?? null,
        accountClassName: detail?.accountGroup.accountClass.name ?? null,
        creditTotal: this.toMoney(entry.totals.creditTotal),
        debitTotal: this.toMoney(entry.totals.debitTotal),
        ledgerAccountId: entry.laId,
        ledgerCode: detail?.code ?? null,
        ledgerName: detail?.name ?? null,
        lineCount: entry.totals.lineCount,
        netMovement: this.toMoney(net),
      };
    });

    return {
      reportType: "PROJECT_FINANCIAL_SUMMARY" satisfies string,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
      },
      filters: {
        costCenter: context.costCenter
          ? {
              code: context.costCenter.code,
              id: context.costCenter.id,
              name: context.costCenter.name,
            }
          : null,
        ledgerAccount: query.ledgerAccountId ?? null,
        accountClass: query.accountClassCode ?? null,
        accountGroup: query.accountGroupId ?? null,
      },
      totals: {
        debitTotal: this.toMoney(totalDebit),
        creditTotal: this.toMoney(totalCredit),
        netMovement: this.toMoney(netMovement),
        lineCount,
        voucherCount,
        firstTransactionDate: firstDate ? this.formatDate(firstDate) : null,
        lastTransactionDate: lastDate ? this.formatDate(lastDate) : null,
      },
      classBreakdown,
      managementTotals: {
        projectAssetCostTotal: this.toMoney(projectAssetCostTotal),
        projectCostTotal: this.toMoney(projectCostTotal),
        projectEquityTotal: this.toMoney(projectEquityTotal),
        projectExpenseTotal: this.toMoney(projectExpenseTotal),
        projectIncomeTotal: this.toMoney(projectIncomeTotal),
        projectLiabilityTotal: this.toMoney(projectLiabilityTotal),
      },
      costCenterBreakdown,
      topLedgerBreakdown,
    };
  }

  async getTrialBalance(companyId: string, query: ReportQueryDto) {
    if (query.ledgerAccountId || query.cashBankAccountId) {
      throw new BadRequestException(
        "ledgerAccountId and cashBankAccountId are not supported for the trial balance report.",
      );
    }

    const context = await this.resolveReportContext(companyId, query);
    const baseWhere = this.buildLineFilter(query, {});
    const [openingByLedger, periodByLedger] = await Promise.all([
      this.sumDebitCreditByLedger(
        baseWhere,
        this.buildVoucherDateFilter(context, "opening"),
      ),
      this.sumDebitCreditByLedger(
        baseWhere,
        this.buildVoucherDateFilter(context, "period"),
      ),
    ]);
    const ledgerAccountIds = [
      ...new Set([...openingByLedger.keys(), ...periodByLedger.keys()]),
    ];
    const ledgerAccounts = ledgerAccountIds.length
      ? await this.prisma.ledgerAccount.findMany({
          include: {
            accountGroup: {
              include: { accountClass: true },
            },
          },
          where: { id: { in: ledgerAccountIds } },
        })
      : [];
    const rows = ledgerAccounts
      .map((ledgerAccount) => {
        const openingTotals = this.getDebitCreditForLedger(
          openingByLedger,
          ledgerAccount.id,
        );
        const periodTotals = this.getDebitCreditForLedger(
          periodByLedger,
          ledgerAccount.id,
        );
        const openingSigned = this.signedBalance(
          openingTotals.debit,
          openingTotals.credit,
          ledgerAccount.normalBalance,
        );
        const periodSigned = this.signedBalance(
          periodTotals.debit,
          periodTotals.credit,
          ledgerAccount.normalBalance,
        );
        const closingSigned = openingSigned.plus(periodSigned);
        const openingBalance = this.balanceAmounts(
          openingSigned,
          ledgerAccount.normalBalance,
        );
        const closingBalance = this.balanceAmounts(
          closingSigned,
          ledgerAccount.normalBalance,
        );

        return {
          closingCredit: closingBalance.credit,
          closingDebit: closingBalance.debit,
          closingSigned,
          ledgerAccount,
          openingCredit: openingBalance.credit,
          openingDebit: openingBalance.debit,
          openingSigned,
          periodCredit: periodTotals.credit,
          periodDebit: periodTotals.debit,
        };
      })
      .filter(
        (row) =>
          !row.openingSigned.equals(ZERO) ||
          !row.periodDebit.equals(ZERO) ||
          !row.periodCredit.equals(ZERO) ||
          !row.closingSigned.equals(ZERO),
      )
      .sort((left, right) =>
        this.compareTrialBalanceLedgerAccounts(
          left.ledgerAccount,
          right.ledgerAccount,
        ),
      );

    let openingDebit = ZERO;
    let openingCredit = ZERO;
    let periodDebit = ZERO;
    let periodCredit = ZERO;
    let closingDebit = ZERO;
    let closingCredit = ZERO;

    for (const row of rows) {
      openingDebit = openingDebit.plus(row.openingDebit);
      openingCredit = openingCredit.plus(row.openingCredit);
      periodDebit = periodDebit.plus(row.periodDebit);
      periodCredit = periodCredit.plus(row.periodCredit);
      closingDebit = closingDebit.plus(row.closingDebit);
      closingCredit = closingCredit.plus(row.closingCredit);
    }

    const difference = closingDebit.minus(closingCredit);

    return {
      reportType: "TRIAL_BALANCE" satisfies ReportType,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      filters: this.summarizeFilters(context),
      totals: {
        closingCredit: this.toMoney(closingCredit),
        closingDebit: this.toMoney(closingDebit),
        difference: this.toMoney(difference),
        isBalanced: difference.equals(ZERO),
        openingCredit: this.toMoney(openingCredit),
        openingDebit: this.toMoney(openingDebit),
        periodCredit: this.toMoney(periodCredit),
        periodDebit: this.toMoney(periodDebit),
      },
      rows: rows.map((row) => ({
        closingCredit: this.toMoney(row.closingCredit),
        closingDebit: this.toMoney(row.closingDebit),
        ledgerAccount: {
          id: row.ledgerAccount.id,
          code: row.ledgerAccount.code,
          name: row.ledgerAccount.name,
          normalBalance: row.ledgerAccount.normalBalance,
          isActive: row.ledgerAccount.isActive,
          accountGroup: {
            id: row.ledgerAccount.accountGroup.id,
            code: row.ledgerAccount.accountGroup.code,
            name: row.ledgerAccount.accountGroup.name,
            accountClass: {
              id: row.ledgerAccount.accountGroup.accountClass.id,
              code: row.ledgerAccount.accountGroup.accountClass.code,
              name: row.ledgerAccount.accountGroup.accountClass.name,
              normalBalance:
                row.ledgerAccount.accountGroup.accountClass.normalBalance,
            },
          },
        },
        openingCredit: this.toMoney(row.openingCredit),
        openingDebit: this.toMoney(row.openingDebit),
        periodCredit: this.toMoney(row.periodCredit),
        periodDebit: this.toMoney(row.periodDebit),
      })),
    };
  }

  async getIncomeStatement(companyId: string, query: ReportQueryDto) {
    if (query.ledgerAccountId || query.cashBankAccountId) {
      throw new BadRequestException(
        "ledgerAccountId and cashBankAccountId are not supported for the income statement report.",
      );
    }

    if (query.asOfDate) {
      throw new BadRequestException(
        "asOfDate is not supported for the income statement report. Use startDate/endDate or accountingPeriodId instead.",
      );
    }

    const context = await this.resolveReportContext(companyId, query);
    const baseWhere = this.buildLineFilter(query, {});
    const periodByLedger = await this.sumDebitCreditByLedger(
      baseWhere,
      this.buildVoucherDateFilter(context, "period"),
    );

    const ledgerAccounts = await this.prisma.ledgerAccount.findMany({
      include: {
        accountGroup: {
          include: { accountClass: true },
        },
      },
      where: {
        accountGroup: {
          accountClass: {
            code: {
              in: [AccountClassCode.INCOME, AccountClassCode.EXPENSE],
            },
          },
        },
      },
    });

    const incomeRows: FinancialStatementRow[] = [];
    const expenseRows: FinancialStatementRow[] = [];

    for (const ledgerAccount of ledgerAccounts) {
      const periodTotals = this.getDebitCreditForLedger(
        periodByLedger,
        ledgerAccount.id,
      );
      const accountClassCode = ledgerAccount.accountGroup.accountClass.code;

      // Income: credit increases, debit decreases → signedAmount = credit - debit
      // Expense: debit increases, credit decreases → signedAmount = debit - credit
      const signedAmount =
        accountClassCode === AccountClassCode.INCOME
          ? periodTotals.credit.minus(periodTotals.debit)
          : periodTotals.debit.minus(periodTotals.credit);

      if (signedAmount.equals(ZERO)) {
        continue;
      }

      const row: FinancialStatementRow = {
        accountClass: this.summarizeAccountClass(
          ledgerAccount.accountGroup.accountClass,
        ),
        accountGroup: {
          code: ledgerAccount.accountGroup.code,
          id: ledgerAccount.accountGroup.id,
          name: ledgerAccount.accountGroup.name,
        },
        amount: this.toMoney(signedAmount.abs()),
        creditMovement: this.toMoney(periodTotals.credit),
        debitMovement: this.toMoney(periodTotals.debit),
        ledgerAccount: {
          code: ledgerAccount.code,
          id: ledgerAccount.id,
          name: ledgerAccount.name,
        },
        signedAmount,
      };

      if (accountClassCode === AccountClassCode.INCOME) {
        incomeRows.push(row);
      } else {
        expenseRows.push(row);
      }
    }

    const sortRows = (rows: FinancialStatementRow[]) =>
      rows.sort((left, right) => {
        const byGroupCode = left.accountGroup.code.localeCompare(
          right.accountGroup.code,
        );

        if (byGroupCode !== 0) {
          return byGroupCode;
        }

        const byGroupName = left.accountGroup.name.localeCompare(
          right.accountGroup.name,
        );

        if (byGroupName !== 0) {
          return byGroupName;
        }

        const byCode = left.ledgerAccount.code.localeCompare(
          right.ledgerAccount.code,
        );

        if (byCode !== 0) {
          return byCode;
        }

        return left.ledgerAccount.name.localeCompare(
          right.ledgerAccount.name,
        );
      });

    sortRows(incomeRows);
    sortRows(expenseRows);

    const totalIncome = incomeRows.reduce(
      (sum, row) => sum.plus(row.signedAmount),
      ZERO,
    );
    const totalExpense = expenseRows.reduce(
      (sum, row) => sum.plus(row.signedAmount),
      ZERO,
    );
    const netIncome = totalIncome.minus(totalExpense);

    return {
      reportType: "INCOME_STATEMENT" satisfies ReportType,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      filters: this.summarizeFilters(context),
      income: this.buildClassSection(incomeRows, totalIncome),
      expenses: this.buildClassSection(expenseRows, totalExpense),
      netIncome: this.toMoney(netIncome),
      isProfit: netIncome.greaterThanOrEqualTo(ZERO),
    };
  }

  async getBalanceSheet(companyId: string, query: ReportQueryDto) {
    if (query.ledgerAccountId || query.cashBankAccountId) {
      throw new BadRequestException(
        "ledgerAccountId and cashBankAccountId are not supported for the balance sheet report.",
      );
    }

    if (query.startDate || query.endDate) {
      throw new BadRequestException(
        "startDate and endDate are not supported for the balance sheet report. Use asOfDate instead.",
      );
    }

    const context = await this.resolveBalanceSheetContext(companyId, query);
    const baseWhere = this.buildLineFilter(query, {});
    const allMovements = await this.sumDebitCreditByLedger(
      baseWhere,
      this.buildBalanceSheetVoucherFilter(context),
    );

    const ledgerAccounts = await this.prisma.ledgerAccount.findMany({
      include: {
        accountGroup: {
          include: { accountClass: true },
        },
      },
      where: {
        accountGroup: {
          accountClass: {
            code: {
              in: [
                AccountClassCode.ASSET,
                AccountClassCode.LIABILITY,
                AccountClassCode.EQUITY,
              ],
            },
          },
        },
      },
    });

    const assetRows: BalanceSheetRow[] = [];
    const liabilityRows: BalanceSheetRow[] = [];
    const equityRows: BalanceSheetRow[] = [];

    for (const ledgerAccount of ledgerAccounts) {
      const totals = this.getDebitCreditForLedger(
        allMovements,
        ledgerAccount.id,
      );
      const accountClassCode = ledgerAccount.accountGroup.accountClass.code;

      // Asset: debit increases, credit decreases → amount = debit - credit
      // Liability: credit increases, debit decreases → amount = credit - debit
      // Equity: credit increases, debit decreases → amount = credit - debit
      let signedAmount: Prisma.Decimal;

      if (accountClassCode === AccountClassCode.ASSET) {
        signedAmount = totals.debit.minus(totals.credit);
      } else {
        signedAmount = totals.credit.minus(totals.debit);
      }

      if (signedAmount.equals(ZERO)) {
        continue;
      }

      const balanceSide =
        accountClassCode === AccountClassCode.ASSET
          ? NormalBalanceSide.DEBIT
          : NormalBalanceSide.CREDIT;

      const balance = this.balanceAmounts(signedAmount, balanceSide);

      const row: BalanceSheetRow = {
        accountClass: this.summarizeAccountClass(
          ledgerAccount.accountGroup.accountClass,
        ),
        accountGroup: {
          code: ledgerAccount.accountGroup.code,
          id: ledgerAccount.accountGroup.id,
          name: ledgerAccount.accountGroup.name,
        },
        amount: this.toMoney(signedAmount.abs()),
        balanceCredit: this.toMoney(balance.credit),
        balanceDebit: this.toMoney(balance.debit),
        creditMovement: this.toMoney(totals.credit),
        debitMovement: this.toMoney(totals.debit),
        ledgerAccount: {
          code: ledgerAccount.code,
          id: ledgerAccount.id,
          name: ledgerAccount.name,
        },
        normalBalance:
          accountClassCode === AccountClassCode.ASSET
            ? NormalBalanceSide.DEBIT
            : NormalBalanceSide.CREDIT,
        signedAmount,
      };

      if (accountClassCode === AccountClassCode.ASSET) {
        assetRows.push(row);
      } else if (accountClassCode === AccountClassCode.LIABILITY) {
        liabilityRows.push(row);
      } else {
        equityRows.push(row);
      }
    }

    const sortBalanceSheetRows = (rows: BalanceSheetRow[]) =>
      rows.sort((left, right) => {
        const byGroupCode = left.accountGroup.code.localeCompare(
          right.accountGroup.code,
        );

        if (byGroupCode !== 0) {
          return byGroupCode;
        }

        const byGroupName = left.accountGroup.name.localeCompare(
          right.accountGroup.name,
        );

        if (byGroupName !== 0) {
          return byGroupName;
        }

        const byCode = left.ledgerAccount.code.localeCompare(
          right.ledgerAccount.code,
        );

        if (byCode !== 0) {
          return byCode;
        }

        return left.ledgerAccount.name.localeCompare(
          right.ledgerAccount.name,
        );
      });

    sortBalanceSheetRows(assetRows);
    sortBalanceSheetRows(liabilityRows);
    sortBalanceSheetRows(equityRows);

    const totalAssets = assetRows.reduce(
      (sum, row) => sum.plus(row.signedAmount),
      ZERO,
    );
    const totalLiabilities = liabilityRows.reduce(
      (sum, row) => sum.plus(row.signedAmount),
      ZERO,
    );
    const totalEquity = equityRows.reduce(
      (sum, row) => sum.plus(row.signedAmount),
      ZERO,
    );
    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
    const difference = totalAssets.minus(totalLiabilitiesAndEquity);

    // Compute current period profit/loss from INCOME and EXPENSE movements
    // within the same date range and filter scope as the balance sheet.
    const currentPeriodPL = await this.computeCurrentPeriodPL(
      context,
      baseWhere,
      this.buildBalanceSheetVoucherFilter(context),
    );

    const adjustedTotalEquity = totalEquity.plus(currentPeriodPL.netIncome);
    const adjustedTotalLiabilitiesAndEquity = totalLiabilities.plus(
      adjustedTotalEquity,
    );
    const adjustedDifference = totalAssets.minus(
      adjustedTotalLiabilitiesAndEquity,
    );

    return {
      reportType: "BALANCE_SHEET" satisfies ReportType,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      asOfDate: this.formatDate(context.asOfDate),
      filters: this.summarizeFilters(context),
      assets: this.buildBalanceSheetSection(assetRows, totalAssets),
      liabilities: this.buildBalanceSheetSection(liabilityRows, totalLiabilities),
      equity: this.buildBalanceSheetSection(equityRows, totalEquity),
      totalLiabilitiesAndEquity: this.toMoney(totalLiabilitiesAndEquity),
      difference: this.toMoney(difference),
      isBalanced: difference.equals(ZERO),
      currentPeriodProfitLoss: this.toMoney(currentPeriodPL.netIncome),
      currentPeriodPLLabel: currentPeriodPL.label,
      currentPeriodPLIsProfit: currentPeriodPL.isProfit,
      adjustedTotalEquity: this.toMoney(adjustedTotalEquity),
      adjustedTotalLiabilitiesAndEquity: this.toMoney(
        adjustedTotalLiabilitiesAndEquity,
      ),
      adjustedDifference: this.toMoney(adjustedDifference),
      isBalancedAdjusted: adjustedDifference.equals(ZERO),
    };
  }

  private async getCashBankBook(
    companyId: string,
    query: ReportQueryDto,
    accountType: CashBankAccountType,
    reportType: Extract<ReportType, "CASH_BOOK" | "BANK_BOOK" | "MFS_BOOK">,
  ) {
    const context = await this.resolveReportContext(companyId, query);
    const { cashBankAccount, ledgerAccount } =
      await this.validateCashBankBookFilters(query, accountType);
    const baseWhere = this.buildLineFilter(query, {
      cashBankAccountId: cashBankAccount?.id,
      cashBankAccountType: accountType,
      ledgerAccountId: ledgerAccount?.id,
      requireCashBankLedger: true,
    });
    const openingTotals = await this.sumDebitCredit(
      baseWhere,
      this.buildVoucherDateFilter(context, "opening"),
    );
    const periodTotals = await this.sumDebitCredit(
      baseWhere,
      this.buildVoucherDateFilter(context, "period"),
    );
    const openingSigned = openingTotals.debit.minus(openingTotals.credit);
    const closingSigned = openingSigned
      .plus(periodTotals.debit)
      .minus(periodTotals.credit);
    const lines = await this.findReportLines(
      baseWhere,
      this.buildVoucherDateFilter(context, "period"),
    );
    let runningBalance = openingSigned;

    return {
      reportType,
      fiscalYear: this.summarizeFiscalYear(context.fiscalYear),
      accountingPeriod: context.accountingPeriod
        ? this.summarizeAccountingPeriod(context.accountingPeriod)
        : null,
      dateRange: this.summarizeDateRange(context.dateRange),
      accountType,
      cashBankAccount: cashBankAccount
        ? this.summarizeCashBankAccount(cashBankAccount)
        : null,
      filters: {
        ...this.summarizeFilters(context),
        ledgerAccount: ledgerAccount
          ? this.summarizeLedgerAccount(ledgerAccount)
          : null,
      },
      openingBalance: this.formatBalance(
        openingSigned,
        NormalBalanceSide.DEBIT,
      ),
      periodDebit: this.toMoney(periodTotals.debit),
      periodCredit: this.toMoney(periodTotals.credit),
      closingBalance: this.formatBalance(
        closingSigned,
        NormalBalanceSide.DEBIT,
      ),
      lines: lines.map((line) => {
        runningBalance = runningBalance.plus(
          line.side === VoucherLineSide.DEBIT
            ? line.amount
            : line.amount.negated(),
        );

        return {
          id: line.id,
          voucherDate: this.formatDate(line.voucher.voucherDate),
          systemVoucherNo: line.voucher.systemVoucherNo,
          voucherType: line.voucher.voucherType,
          narration: line.voucher.narration,
          cashBankAccount: line.cashBankAccount
            ? this.summarizeCashBankAccount(line.cashBankAccount)
            : null,
          ledgerAccount: this.summarizeLedgerAccount(line.ledgerAccount),
          oppositeAccounts: line.voucher.lines
            .filter((voucherLine) => voucherLine.id !== line.id)
            .map((voucherLine) => ({
              id: voucherLine.id,
              ledgerAccount: this.summarizeLedgerAccount(
                voucherLine.ledgerAccount,
              ),
              side: voucherLine.side,
              amount: this.toMoney(voucherLine.amount),
            })),
          description: line.description,
          debit: this.toMoney(
            line.side === VoucherLineSide.DEBIT ? line.amount : ZERO,
          ),
          credit: this.toMoney(
            line.side === VoucherLineSide.CREDIT ? line.amount : ZERO,
          ),
          runningBalance: this.formatBalance(
            runningBalance,
            NormalBalanceSide.DEBIT,
          ),
          project: line.project ? this.summarizeProject(line.project) : null,
          costCenter: line.costCenter
            ? this.summarizeLineCostCenter(line.costCenter)
            : null,
        };
      }),
    };
  }

  private async resolveReportContext(
    companyId: string,
    query: ReportQueryDto,
  ): Promise<ReportContext> {
    // Ownership lives inside the query itself: the fiscal year must exist
    // AND belong to the trusted active Company. A foreign company's fiscal
    // year is indistinguishable from a missing one (NotFound anti-leak).
    // The company relation is narrowed to the document-branding fields the
    // report payload needs.
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      include: {
        company: {
          select: {
            id: true,
            name: true,
            legalName: true,
            address: true,
            phone: true,
            email: true,
            currency: true,
            printLogoPath: true,
            printHeaderName: true,
            printFooterText: true,
            updatedAt: true,
          },
        },
      },
      where: {
        companyId,
        id: query.fiscalYearId,
      },
    });

    if (!fiscalYear) {
      throw new NotFoundException("Fiscal year was not found.");
    }

    const accountingPeriod = query.accountingPeriodId
      ? await this.prisma.accountingPeriod.findUnique({
          where: { id: query.accountingPeriodId },
        })
      : null;

    if (query.accountingPeriodId && !accountingPeriod) {
      throw new NotFoundException("Accounting period was not found.");
    }

    if (accountingPeriod && accountingPeriod.fiscalYearId !== fiscalYear.id) {
      throw new BadRequestException(
        "Accounting period does not belong to the selected fiscal year.",
      );
    }

    const hasStartDate = query.startDate !== undefined;
    const hasEndDate = query.endDate !== undefined;

    if (hasStartDate !== hasEndDate) {
      throw new BadRequestException(
        "Both startDate and endDate are required for a custom report date range.",
      );
    }

    const dateRange =
      hasStartDate && hasEndDate
        ? {
            startDate: parseIsoDate(query.startDate!, "startDate"),
            endDate: parseIsoDate(query.endDate!, "endDate"),
          }
        : accountingPeriod
          ? {
              startDate: accountingPeriod.startDate,
              endDate: accountingPeriod.endDate,
            }
          : {
              startDate: fiscalYear.startDate,
              endDate: fiscalYear.endDate,
            };

    if (dateRange.startDate > dateRange.endDate) {
      throw new BadRequestException("startDate must be on or before endDate.");
    }

    if (
      dateRange.startDate < fiscalYear.startDate ||
      dateRange.endDate > fiscalYear.endDate
    ) {
      throw new BadRequestException(
        "Report date range must fall inside the fiscal year date range.",
      );
    }

    if (
      accountingPeriod &&
      (dateRange.startDate < accountingPeriod.startDate ||
        dateRange.endDate > accountingPeriod.endDate)
    ) {
      throw new BadRequestException(
        "Report date range must fall inside the selected accounting period date range.",
      );
    }

    const project = query.projectId
      ? await this.prisma.project.findUnique({
          select: { code: true, id: true, name: true },
          where: { id: query.projectId },
        })
      : null;

    if (query.projectId && !project) {
      throw new NotFoundException("Project was not found.");
    }

    const costCenter = query.costCenterId
      ? await this.prisma.costCenter.findUnique({
          include: {
            project: { select: { code: true, id: true, name: true } },
          },
          where: { id: query.costCenterId },
        })
      : null;

    if (query.costCenterId && !costCenter) {
      throw new NotFoundException("Cost center was not found.");
    }

    if (project && costCenter && costCenter.projectId !== project.id) {
      throw new BadRequestException(
        "Cost center must belong to the selected project.",
      );
    }

    return {
      accountingPeriod,
      costCenter,
      dateRange,
      fiscalYear,
      project,
    };
  }

  private async resolveBalanceSheetContext(
    companyId: string,
    query: ReportQueryDto,
  ): Promise<BalanceSheetContext> {
    // Same trusted ownership rule as resolveReportContext: the fiscal year
    // must belong to the active Company or it does not resolve. The company
    // relation carries the same document-branding field selection.
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      include: {
        company: {
          select: {
            id: true,
            name: true,
            legalName: true,
            address: true,
            phone: true,
            email: true,
            currency: true,
            printLogoPath: true,
            printHeaderName: true,
            printFooterText: true,
            updatedAt: true,
          },
        },
      },
      where: {
        companyId,
        id: query.fiscalYearId,
      },
    });

    if (!fiscalYear) {
      throw new NotFoundException("Fiscal year was not found.");
    }

    const accountingPeriod = query.accountingPeriodId
      ? await this.prisma.accountingPeriod.findUnique({
          where: { id: query.accountingPeriodId },
        })
      : null;

    if (query.accountingPeriodId && !accountingPeriod) {
      throw new NotFoundException("Accounting period was not found.");
    }

    if (accountingPeriod && accountingPeriod.fiscalYearId !== fiscalYear.id) {
      throw new BadRequestException(
        "Accounting period does not belong to the selected fiscal year.",
      );
    }

    let asOfDate: Date;

    if (query.asOfDate) {
      asOfDate = parseIsoDate(query.asOfDate, "asOfDate");
      // If accountingPeriodId is also supplied and asOfDate doesn't fall inside
      // the period's date range, reject the request.
      if (
        accountingPeriod &&
        (asOfDate < accountingPeriod.startDate ||
          asOfDate > accountingPeriod.endDate)
      ) {
        throw new BadRequestException(
          "asOfDate must fall inside the selected accounting period date range.",
        );
      }
    } else if (accountingPeriod) {
      asOfDate = accountingPeriod.endDate;
    } else {
      asOfDate = fiscalYear.endDate;
    }

    if (asOfDate < fiscalYear.startDate || asOfDate > fiscalYear.endDate) {
      throw new BadRequestException(
        "asOfDate must fall inside the fiscal year date range.",
      );
    }

    const project = query.projectId
      ? await this.prisma.project.findUnique({
          select: { code: true, id: true, name: true },
          where: { id: query.projectId },
        })
      : null;

    if (query.projectId && !project) {
      throw new NotFoundException("Project was not found.");
    }

    const costCenter = query.costCenterId
      ? await this.prisma.costCenter.findUnique({
          include: {
            project: { select: { code: true, id: true, name: true } },
          },
          where: { id: query.costCenterId },
        })
      : null;

    if (query.costCenterId && !costCenter) {
      throw new NotFoundException("Cost center was not found.");
    }

    if (project && costCenter && costCenter.projectId !== project.id) {
      throw new BadRequestException(
        "Cost center must belong to the selected project.",
      );
    }

    return {
      accountingPeriod,
      asOfDate,
      costCenter,
      fiscalYear,
      project,
    };
  }

  private async findLedgerAccount(id: string) {
    const ledgerAccount = await this.prisma.ledgerAccount.findUnique({
      include: {
        accountGroup: {
          include: { accountClass: true },
        },
      },
      where: { id },
    });

    if (!ledgerAccount) {
      throw new NotFoundException("Ledger account was not found.");
    }

    return ledgerAccount;
  }

  private async validateCashBankBookFilters(
    query: ReportQueryDto,
    expectedType: CashBankAccountType,
  ) {
    const [cashBankAccount, ledgerAccount] = await Promise.all([
      query.cashBankAccountId
        ? this.prisma.cashBankAccount.findUnique({
            include: {
              ledgerAccount: {
                include: {
                  accountGroup: {
                    include: { accountClass: true },
                  },
                },
              },
            },
            where: { id: query.cashBankAccountId },
          })
        : Promise.resolve(null),
      query.ledgerAccountId
        ? this.prisma.ledgerAccount.findUnique({
            include: {
              accountGroup: {
                include: { accountClass: true },
              },
              cashBankAccounts: true,
            },
            where: { id: query.ledgerAccountId },
          })
        : Promise.resolve(null),
    ]);

    if (query.cashBankAccountId && !cashBankAccount) {
      throw new NotFoundException("Cash/bank account was not found.");
    }

    if (query.ledgerAccountId && !ledgerAccount) {
      throw new NotFoundException("Ledger account was not found.");
    }

    if (cashBankAccount && cashBankAccount.accountType !== expectedType) {
      throw new BadRequestException(
        `Cash/bank account must be ${expectedType} type for this report.`,
      );
    }

    if (ledgerAccount) {
      if (!ledgerAccount.isCashBank) {
        throw new BadRequestException(
          "Ledger account must be marked as cash/bank for this report.",
        );
      }

      if (
        !ledgerAccount.cashBankAccounts.some(
          (account) => account.accountType === expectedType,
        )
      ) {
        throw new BadRequestException(
          `Ledger account is not linked to a ${expectedType} cash/bank account.`,
        );
      }
    }

    if (
      cashBankAccount &&
      ledgerAccount &&
      cashBankAccount.ledgerAccountId !== ledgerAccount.id
    ) {
      throw new BadRequestException(
        "cashBankAccountId must belong to the selected ledgerAccountId.",
      );
    }

    return { cashBankAccount, ledgerAccount };
  }

  private buildLineFilter(
    query: ReportQueryDto,
    options: {
      cashBankAccountId?: string;
      cashBankAccountType?: CashBankAccountType;
      ledgerAccountId?: string;
      requireCashBankLedger?: boolean;
    },
  ): Prisma.VoucherLineWhereInput {
    return {
      ...(options.ledgerAccountId
        ? { ledgerAccountId: options.ledgerAccountId }
        : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.costCenterId ? { costCenterId: query.costCenterId } : {}),
      ...(options.cashBankAccountId
        ? { cashBankAccountId: options.cashBankAccountId }
        : {}),
      ...(options.cashBankAccountType
        ? {
            cashBankAccount: {
              is: { accountType: options.cashBankAccountType },
            },
          }
        : {}),
      ...(options.requireCashBankLedger
        ? {
            ledgerAccount: {
              is: { isCashBank: true },
            },
          }
        : {}),
    };
  }

  private buildProjectLedgerLineFilter(
    query: ReportQueryDto,
  ): Prisma.VoucherLineWhereInput {
    const where: Prisma.VoucherLineWhereInput = {
      projectId: query.projectId!,
    };

    if (query.costCenterId) {
      where.costCenterId = query.costCenterId;
    }

    if (query.ledgerAccountId) {
      where.ledgerAccountId = query.ledgerAccountId;
    }

    if (query.voucherType) {
      where.voucher = {
        is: { voucherType: query.voucherType as VoucherType },
      };
    }

    return where;
  }

  private buildProjectCostLineFilter(
    query: ReportQueryDto,
  ): Prisma.VoucherLineWhereInput {
    const where: Prisma.VoucherLineWhereInput = {
      projectId: query.projectId!,
    };

    if (query.costCenterId) {
      where.costCenterId = query.costCenterId;
    }

    if (query.ledgerAccountId) {
      where.ledgerAccountId = query.ledgerAccountId;
    }

    const laWhere: Record<string, unknown> = {};

    if (query.accountGroupId) {
      laWhere.accountGroupId = query.accountGroupId;
    }

    if (query.accountClassCode) {
      laWhere.accountGroup = {
        accountClass: {
          code: query.accountClassCode as AccountClassCode,
        },
      };
    }

    if (query.expenseOnly) {
      const existingGroup =
        laWhere.accountGroup as Record<string, unknown> | undefined;
      laWhere.accountGroup = {
        ...(existingGroup ?? {}),
        accountClass: {
          code: { in: [AccountClassCode.EXPENSE, AccountClassCode.ASSET] },
        },
      };
    }

    if (Object.keys(laWhere).length > 0) {
      where.ledgerAccount = laWhere;
    }

    return where;
  }

  private async findProjectLedgerLines(
    lineWhere: Prisma.VoucherLineWhereInput,
    voucherWhere: Prisma.VoucherWhereInput,
  ) {
    const lines = await this.prisma.voucherLine.findMany({
      include: {
        costCenter: true,
        ledgerAccount: {
          include: {
            accountGroup: {
              include: { accountClass: true },
            },
          },
        },
        voucher: true,
      },
      where: {
        ...lineWhere,
        voucher: voucherWhere,
      },
    });

    return lines.sort((left, right) => {
      const byDate =
        left.voucher.voucherDate.getTime() -
        right.voucher.voucherDate.getTime();

      if (byDate !== 0) {
        return byDate;
      }

      const byVoucherNo = left.voucher.systemVoucherNo.localeCompare(
        right.voucher.systemVoucherNo,
      );

      if (byVoucherNo !== 0) {
        return byVoucherNo;
      }

      if (left.lineNo !== right.lineNo) {
        return left.lineNo - right.lineNo;
      }

      return left.id.localeCompare(right.id);
    });
  }

  private summarizeProjectLedgerFilters(
    context: ReportContext,
    query: ReportQueryDto,
  ) {
    return {
      costCenter: context.costCenter
        ? {
            code: context.costCenter.code,
            id: context.costCenter.id,
            name: context.costCenter.name,
          }
        : null,
      ledgerAccount: query.ledgerAccountId ? query.ledgerAccountId : null,
      voucherType: query.voucherType ?? null,
    };
  }

  private buildVoucherDateFilter(
    context: ReportContext,
    mode: "opening" | "period",
  ): Prisma.VoucherWhereInput {
    return {
      fiscalYearId: context.fiscalYear.id,
      isDeleted: false,
      status: VoucherStatus.POSTED,
      voucherDate:
        mode === "opening"
          ? {
              gte: context.fiscalYear.startDate,
              lt: context.dateRange.startDate,
            }
          : {
              gte: context.dateRange.startDate,
              lte: context.dateRange.endDate,
            },
      ...(mode === "period" && context.accountingPeriod
        ? { accountingPeriodId: context.accountingPeriod.id }
        : {}),
    };
  }

  private buildBalanceSheetVoucherFilter(
    context: BalanceSheetContext,
  ): Prisma.VoucherWhereInput {
    return {
      fiscalYearId: context.fiscalYear.id,
      isDeleted: false,
      status: VoucherStatus.POSTED,
      voucherDate: {
        gte: context.fiscalYear.startDate,
        lte: context.asOfDate,
      },
    };
  }

  // Compute current period profit/loss from posted INCOME and EXPENSE voucher
  // lines, scoped to the same fiscal year, as-of-date, project, and cost
  // center filters used by the balance sheet. This is a report-side
  // computation only; no ledger accounts, voucher lines, or closing entries
  // are created or modified.
  private async computeCurrentPeriodPL(
    context: BalanceSheetContext,
    lineWhere: Prisma.VoucherLineWhereInput,
    voucherWhere: Prisma.VoucherWhereInput,
  ) {
    const incomeExpenseLedgers = await this.prisma.ledgerAccount.findMany({
      include: {
        accountGroup: {
          include: { accountClass: true },
        },
      },
      where: {
        accountGroup: {
          accountClass: {
            code: {
              in: [AccountClassCode.INCOME, AccountClassCode.EXPENSE],
            },
          },
        },
      },
    });

    const movements = await this.sumDebitCreditByLedger(
      lineWhere,
      voucherWhere,
    );

    let totalIncome = ZERO;
    let totalExpense = ZERO;

    for (const ledger of incomeExpenseLedgers) {
      const totals = this.getDebitCreditForLedger(movements, ledger.id);
      const accountClassCode = ledger.accountGroup.accountClass.code;

      // Income: credit increases, debit decreases → amount = credit - debit
      // Expense: debit increases, credit decreases → amount = debit - credit
      if (accountClassCode === AccountClassCode.INCOME) {
        totalIncome = totalIncome.plus(
          totals.credit.minus(totals.debit),
        );
      } else {
        totalExpense = totalExpense.plus(
          totals.debit.minus(totals.credit),
        );
      }
    }

    const netIncome = totalIncome.minus(totalExpense);
    const isProfit = netIncome.greaterThanOrEqualTo(ZERO);
    const label = isProfit
      ? "Current Period Net Profit"
      : "Current Period Net Loss";

    return { netIncome, isProfit, label };
  }

  private async sumDebitCredit(
    lineWhere: Prisma.VoucherLineWhereInput,
    voucherWhere: Prisma.VoucherWhereInput,
  ) {
    const [debit, credit] = await Promise.all([
      this.sumAmount({
        ...lineWhere,
        side: VoucherLineSide.DEBIT,
        voucher: voucherWhere,
      }),
      this.sumAmount({
        ...lineWhere,
        side: VoucherLineSide.CREDIT,
        voucher: voucherWhere,
      }),
    ]);

    return { credit, debit };
  }

  private async sumDebitCreditByLedger(
    lineWhere: Prisma.VoucherLineWhereInput,
    voucherWhere: Prisma.VoucherWhereInput,
  ): Promise<Map<string, DebitCreditTotals>> {
    const rows = await this.prisma.voucherLine.groupBy({
      _sum: { amount: true },
      by: ["ledgerAccountId", "side"],
      where: {
        ...lineWhere,
        voucher: voucherWhere,
      },
    });
    const totalsByLedger = new Map<string, DebitCreditTotals>();

    for (const row of rows) {
      const current = this.getDebitCreditForLedger(
        totalsByLedger,
        row.ledgerAccountId,
      );
      const amount = row._sum.amount ?? ZERO;

      totalsByLedger.set(row.ledgerAccountId, {
        credit:
          row.side === VoucherLineSide.CREDIT
            ? current.credit.plus(amount)
            : current.credit,
        debit:
          row.side === VoucherLineSide.DEBIT
            ? current.debit.plus(amount)
            : current.debit,
      });
    }

    return totalsByLedger;
  }

  private async sumAmount(where: Prisma.VoucherLineWhereInput) {
    const result = await this.prisma.voucherLine.aggregate({
      _sum: { amount: true },
      where,
    });

    return result._sum.amount ?? ZERO;
  }

  private async findReportLines(
    lineWhere: Prisma.VoucherLineWhereInput,
    voucherWhere: Prisma.VoucherWhereInput,
  ) {
    const lines = await this.prisma.voucherLine.findMany({
      include: {
        cashBankAccount: {
          include: {
            ledgerAccount: {
              include: {
                accountGroup: {
                  include: { accountClass: true },
                },
              },
            },
          },
        },
        costCenter: {
          include: {
            project: { select: { code: true, id: true, name: true } },
          },
        },
        ledgerAccount: {
          include: {
            accountGroup: {
              include: { accountClass: true },
            },
          },
        },
        project: true,
        voucher: {
          include: {
            lines: {
              include: {
                ledgerAccount: {
                  include: {
                    accountGroup: {
                      include: { accountClass: true },
                    },
                  },
                },
              },
              orderBy: [{ lineNo: "asc" }, { id: "asc" }],
            },
          },
        },
      },
      where: {
        ...lineWhere,
        voucher: voucherWhere,
      },
    });

    return lines.sort((left, right) => {
      const byDate =
        left.voucher.voucherDate.getTime() - right.voucher.voucherDate.getTime();

      if (byDate !== 0) {
        return byDate;
      }

      const byVoucherNo = left.voucher.systemVoucherNo.localeCompare(
        right.voucher.systemVoucherNo,
      );

      if (byVoucherNo !== 0) {
        return byVoucherNo;
      }

      if (left.lineNo !== right.lineNo) {
        return left.lineNo - right.lineNo;
      }

      return left.id.localeCompare(right.id);
    });
  }

  private signedLineMovement(
    side: VoucherLineSide,
    amount: Prisma.Decimal,
    normalBalance: NormalBalanceSide,
  ) {
    if (normalBalance === NormalBalanceSide.DEBIT) {
      return side === VoucherLineSide.DEBIT ? amount : amount.negated();
    }

    return side === VoucherLineSide.CREDIT ? amount : amount.negated();
  }

  private signedBalance(
    debit: Prisma.Decimal,
    credit: Prisma.Decimal,
    normalBalance: NormalBalanceSide,
  ) {
    return normalBalance === NormalBalanceSide.DEBIT
      ? debit.minus(credit)
      : credit.minus(debit);
  }

  private formatBalance(
    signedAmount: Prisma.Decimal,
    normalBalance: NormalBalanceSide,
  ): BalanceSummary {
    const balance = this.balanceAmounts(signedAmount, normalBalance);

    return {
      balanceSide: balance.balanceSide,
      credit: this.toMoney(balance.credit),
      debit: this.toMoney(balance.debit),
      signedAmount: this.toMoney(signedAmount),
    };
  }

  private balanceAmounts(
    signedAmount: Prisma.Decimal,
    normalBalance: NormalBalanceSide,
  ) {
    const balanceSide = signedAmount.isNegative()
      ? this.oppositeBalanceSide(normalBalance)
      : normalBalance;
    const amount = signedAmount.abs();

    return {
      balanceSide,
      credit: balanceSide === NormalBalanceSide.CREDIT ? amount : ZERO,
      debit: balanceSide === NormalBalanceSide.DEBIT ? amount : ZERO,
    };
  }

  private getDebitCreditForLedger(
    totalsByLedger: Map<string, DebitCreditTotals>,
    ledgerAccountId: string,
  ): DebitCreditTotals {
    return totalsByLedger.get(ledgerAccountId) ?? { credit: ZERO, debit: ZERO };
  }

  private oppositeBalanceSide(normalBalance: NormalBalanceSide) {
    return normalBalance === NormalBalanceSide.DEBIT
      ? NormalBalanceSide.CREDIT
      : NormalBalanceSide.DEBIT;
  }

  private compareTrialBalanceLedgerAccounts(
    left: {
      code: string;
      name: string;
      accountGroup: {
        code: string;
        name: string;
        accountClass: { code: string };
      };
    },
    right: {
      code: string;
      name: string;
      accountGroup: {
        code: string;
        name: string;
        accountClass: { code: string };
      };
    },
  ) {
    const byClass =
      this.accountClassSortKey(left.accountGroup.accountClass.code) -
      this.accountClassSortKey(right.accountGroup.accountClass.code);

    if (byClass !== 0) {
      return byClass;
    }

    const byGroupCode = left.accountGroup.code.localeCompare(
      right.accountGroup.code,
    );

    if (byGroupCode !== 0) {
      return byGroupCode;
    }

    const byGroupName = left.accountGroup.name.localeCompare(
      right.accountGroup.name,
    );

    if (byGroupName !== 0) {
      return byGroupName;
    }

    const byCode = left.code.localeCompare(right.code);

    if (byCode !== 0) {
      return byCode;
    }

    return left.name.localeCompare(right.name);
  }

  private classLabel(code: string) {
    const labels: Record<string, string> = {
      ASSET: "Project Asset / Capitalized Project Cost",
      EQUITY: "Project Equity",
      EXPENSE: "Project Expense",
      INCOME: "Project Income",
      LIABILITY: "Project Liability",
    };

    return labels[code] ?? code;
  }

  private accountClassSortKey(code: string) {
    const order: Record<string, number> = {
      ASSET: 1,
      LIABILITY: 2,
      EQUITY: 3,
      INCOME: 4,
      EXPENSE: 5,
    };

    return order[code] ?? Number.MAX_SAFE_INTEGER;
  }

  private buildClassSection(
    rows: FinancialStatementRow[],
    total: Prisma.Decimal,
  ) {
    const groups = this.groupFinancialStatementRows(rows);

    return {
      groups,
      rows: rows.map((row) => ({
        accountClass: row.accountClass,
        accountGroup: row.accountGroup,
        amount: row.amount,
        creditMovement: row.creditMovement,
        debitMovement: row.debitMovement,
        ledgerAccount: {
          code: row.ledgerAccount.code,
          id: row.ledgerAccount.id,
          name: row.ledgerAccount.name,
        },
      })),
      total: this.toMoney(total),
    };
  }

  private buildBalanceSheetSection(
    rows: BalanceSheetRow[],
    total: Prisma.Decimal,
  ) {
    const groups = this.groupBalanceSheetRows(rows);

    return {
      groups,
      rows: rows.map((row) => ({
        accountClass: row.accountClass,
        accountGroup: row.accountGroup,
        amount: row.amount,
        balanceCredit: row.balanceCredit,
        balanceDebit: row.balanceDebit,
        creditMovement: row.creditMovement,
        debitMovement: row.debitMovement,
        ledgerAccount: {
          code: row.ledgerAccount.code,
          id: row.ledgerAccount.id,
          name: row.ledgerAccount.name,
        },
        normalBalance: row.normalBalance,
      })),
      total: this.toMoney(total),
    };
  }

  private groupFinancialStatementRows(rows: FinancialStatementRow[]) {
    const groupsMap = new Map<
      string,
      { group: { id: string; code: string; name: string }; total: Prisma.Decimal }
    >();

    for (const row of rows) {
      const key = row.accountGroup.id;
      const current = groupsMap.get(key);

      if (current) {
        current.total = current.total.plus(row.signedAmount.abs());
      } else {
        groupsMap.set(key, {
          group: { ...row.accountGroup },
          total: row.signedAmount.abs(),
        });
      }
    }

    return [...groupsMap.values()]
      .sort((left, right) => {
        const byCode = left.group.code.localeCompare(right.group.code);
        if (byCode !== 0) return byCode;
        return left.group.name.localeCompare(right.group.name);
      })
      .map((entry) => ({
        ...entry.group,
        total: this.toMoney(entry.total),
      }));
  }

  private groupBalanceSheetRows(rows: BalanceSheetRow[]) {
    const groupsMap = new Map<
      string,
      { group: { id: string; code: string; name: string }; total: Prisma.Decimal }
    >();

    for (const row of rows) {
      const key = row.accountGroup.id;
      const current = groupsMap.get(key);

      if (current) {
        current.total = current.total.plus(row.signedAmount.abs());
      } else {
        groupsMap.set(key, {
          group: { ...row.accountGroup },
          total: row.signedAmount.abs(),
        });
      }
    }

    return [...groupsMap.values()]
      .sort((left, right) => {
        const byCode = left.group.code.localeCompare(right.group.code);
        if (byCode !== 0) return byCode;
        return left.group.name.localeCompare(right.group.name);
      })
      .map((entry) => ({
        ...entry.group,
        total: this.toMoney(entry.total),
      }));
  }

  private summarizeAccountClass(accountClass: {
    id: string;
    code: string;
    name: string;
    normalBalance: NormalBalanceSide;
  }) {
    return {
      code: accountClass.code,
      id: accountClass.id,
      name: accountClass.name,
      normalBalance: accountClass.normalBalance,
    };
  }

  private summarizeFilters(context: ReportContext | BalanceSheetContext) {
    return {
      costCenter: context.costCenter
        ? this.summarizeCostCenter(context.costCenter)
        : null,
      project: context.project ? this.summarizeProject(context.project) : null,
    };
  }

  private summarizeFiscalYear(fiscalYear: FiscalYearSummary) {
    return {
      company: fiscalYear.company,
      endDate: this.formatDate(fiscalYear.endDate),
      id: fiscalYear.id,
      name: fiscalYear.name,
      startDate: this.formatDate(fiscalYear.startDate),
    };
  }

  private summarizeAccountingPeriod(period: AccountingPeriodSummary) {
    return {
      endDate: this.formatDate(period.endDate),
      id: period.id,
      name: period.name,
      startDate: this.formatDate(period.startDate),
      status: period.status,
    };
  }

  private summarizeDateRange(dateRange: ReportContext["dateRange"]) {
    return {
      endDate: this.formatDate(dateRange.endDate),
      startDate: this.formatDate(dateRange.startDate),
    };
  }

  private summarizeProject(project: ProjectSummary) {
    return {
      code: project.code,
      id: project.id,
      name: project.name,
    };
  }

  private summarizeCostCenter(costCenter: CostCenterSummary) {
    return {
      code: costCenter.code,
      id: costCenter.id,
      name: costCenter.name,
      project: this.summarizeProject(costCenter.project),
    };
  }

  private summarizeLineCostCenter(
    costCenter: CostCenterSummary | (CostCenterSummary & { project: ProjectSummary }),
  ) {
    return this.summarizeCostCenter(costCenter);
  }

  private summarizeLedgerAccount(ledgerAccount: {
    id: string;
    code: string;
    name: string;
    normalBalance: NormalBalanceSide;
    isActive: boolean;
  }) {
    return {
      code: ledgerAccount.code,
      id: ledgerAccount.id,
      isActive: ledgerAccount.isActive,
      name: ledgerAccount.name,
      normalBalance: ledgerAccount.normalBalance,
    };
  }

  private summarizeCashBankAccount(cashBankAccount: {
    id: string;
    displayName: string;
    accountType: CashBankAccountType;
    ledgerAccountId: string;
    bankName: string | null;
    branch: string | null;
    accountNumber: string | null;
    isActive: boolean;
    provider?: string | null;
    providerOtherName?: string | null;
    walletNumber?: string | null;
    accountHolderName?: string | null;
  }) {
    return {
      accountHolderName: cashBankAccount.accountHolderName ?? null,
      accountNumber: cashBankAccount.accountNumber,
      accountType: cashBankAccount.accountType,
      bankName: cashBankAccount.bankName,
      branch: cashBankAccount.branch,
      displayName: cashBankAccount.displayName,
      id: cashBankAccount.id,
      isActive: cashBankAccount.isActive,
      ledgerAccountId: cashBankAccount.ledgerAccountId,
      provider: cashBankAccount.provider ?? null,
      providerOtherName: cashBankAccount.providerOtherName ?? null,
      walletNumber: cashBankAccount.walletNumber ?? null,
    };
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private toMoney(value: Prisma.Decimal | number | string) {
    return new Prisma.Decimal(value).toFixed(2);
  }
}
