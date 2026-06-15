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
    currency: string;
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

type ReportType =
  | "LEDGER"
  | "CASH_BOOK"
  | "BANK_BOOK"
  | "MFS_BOOK"
  | "TRIAL_BALANCE"
  | "INCOME_STATEMENT"
  | "BALANCE_SHEET";

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getLedger(query: ReportQueryDto) {
    if (!query.ledgerAccountId) {
      throw new BadRequestException(
        "ledgerAccountId is required for the ledger report.",
      );
    }

    const context = await this.resolveReportContext(query);
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

  getCashBook(query: ReportQueryDto) {
    return this.getCashBankBook(
      query,
      CashBankAccountType.CASH,
      "CASH_BOOK",
    );
  }

  getBankBook(query: ReportQueryDto) {
    return this.getCashBankBook(
      query,
      CashBankAccountType.BANK,
      "BANK_BOOK",
    );
  }

  getMfsBook(query: ReportQueryDto) {
    return this.getCashBankBook(
      query,
      CashBankAccountType.MFS,
      "MFS_BOOK",
    );
  }

  async getTrialBalance(query: ReportQueryDto) {
    if (query.ledgerAccountId || query.cashBankAccountId) {
      throw new BadRequestException(
        "ledgerAccountId and cashBankAccountId are not supported for the trial balance report.",
      );
    }

    const context = await this.resolveReportContext(query);
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

  async getIncomeStatement(query: ReportQueryDto) {
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

    const context = await this.resolveReportContext(query);
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

  async getBalanceSheet(query: ReportQueryDto) {
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

    const context = await this.resolveBalanceSheetContext(query);
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
    };
  }

  private async getCashBankBook(
    query: ReportQueryDto,
    accountType: CashBankAccountType,
    reportType: Extract<ReportType, "CASH_BOOK" | "BANK_BOOK" | "MFS_BOOK">,
  ) {
    const context = await this.resolveReportContext(query);
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
    query: ReportQueryDto,
  ): Promise<ReportContext> {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      include: { company: true },
      where: { id: query.fiscalYearId },
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
    query: ReportQueryDto,
  ): Promise<BalanceSheetContext> {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      include: { company: true },
      where: { id: query.fiscalYearId },
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
