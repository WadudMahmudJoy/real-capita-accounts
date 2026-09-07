import {
  ConflictException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { ActiveCompanyContext } from "../auth/auth.types";
import { ActiveCompany } from "../auth/decorators/active-company.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ReportQueryDto } from "./dto/report-query.dto";
import { ReportService } from "./report.service";

/**
 * Every report is owned by its required Fiscal Year, and that Fiscal Year
 * must belong to the authenticated session's active Company. The trusted
 * activeCompany.id from the D4 AuthGuard is the only Company authority —
 * query parameters never carry Company identity.
 */
function requireActiveCompanyId(
  activeCompany: ActiveCompanyContext | null,
): string {
  if (activeCompany === null) {
    throw new ConflictException(
      "No active company is selected for this session.",
    );
  }

  if (!activeCompany.isActive) {
    throw new ConflictException(
      "The active company is inactive and cannot run reports.",
    );
  }

  return activeCompany.id;
}

@Controller("reports")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get("ledger")
  getLedger(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getLedger(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("cash-book")
  getCashBook(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getCashBook(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("bank-book")
  getBankBook(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getBankBook(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("mfs-book")
  getMfsBook(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getMfsBook(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("trial-balance")
  getTrialBalance(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getTrialBalance(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("income-statement")
  getIncomeStatement(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getIncomeStatement(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("balance-sheet")
  getBalanceSheet(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getBalanceSheet(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("project-ledger")
  getProjectLedger(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getProjectLedger(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("project-cost")
  getProjectCost(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getProjectCost(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("cost-center-summary")
  getCostCenterSummary(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getCostCenterSummary(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("project-financial-summary")
  getProjectFinancialSummary(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getProjectFinancialSummary(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }

  @Get("project-fund-movement")
  getProjectFundMovement(
    @ActiveCompany() activeCompany: ActiveCompanyContext | null,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportService.getProjectFundMovement(
      requireActiveCompanyId(activeCompany),
      query,
    );
  }
}
