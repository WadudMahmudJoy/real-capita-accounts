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
}
