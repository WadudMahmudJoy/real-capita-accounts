import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReportService } from "./report.service";

@Controller("reports")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get("ledger")
  getLedger(@Query() query: ReportQueryDto) {
    return this.reportService.getLedger(query);
  }

  @Get("cash-book")
  getCashBook(@Query() query: ReportQueryDto) {
    return this.reportService.getCashBook(query);
  }

  @Get("bank-book")
  getBankBook(@Query() query: ReportQueryDto) {
    return this.reportService.getBankBook(query);
  }

  @Get("mfs-book")
  getMfsBook(@Query() query: ReportQueryDto) {
    return this.reportService.getMfsBook(query);
  }

  @Get("trial-balance")
  getTrialBalance(@Query() query: ReportQueryDto) {
    return this.reportService.getTrialBalance(query);
  }

  @Get("income-statement")
  getIncomeStatement(@Query() query: ReportQueryDto) {
    return this.reportService.getIncomeStatement(query);
  }

  @Get("balance-sheet")
  getBalanceSheet(@Query() query: ReportQueryDto) {
    return this.reportService.getBalanceSheet(query);
  }

  @Get("project-ledger")
  getProjectLedger(@Query() query: ReportQueryDto) {
    return this.reportService.getProjectLedger(query);
  }

  @Get("project-cost")
  getProjectCost(@Query() query: ReportQueryDto) {
    return this.reportService.getProjectCost(query);
  }

  @Get("cost-center-summary")
  getCostCenterSummary(@Query() query: ReportQueryDto) {
    return this.reportService.getCostCenterSummary(query);
  }

  @Get("project-financial-summary")
  getProjectFinancialSummary(@Query() query: ReportQueryDto) {
    return this.reportService.getProjectFinancialSummary(query);
  }

  @Get("project-fund-movement")
  getProjectFundMovement(@Query() query: ReportQueryDto) {
    return this.reportService.getProjectFundMovement(query);
  }
}
