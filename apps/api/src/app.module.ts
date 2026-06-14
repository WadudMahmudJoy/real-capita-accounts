import { Module } from "@nestjs/common";
import { AccountingPeriodModule } from "./accounting-period/accounting-period.module";
import { AccountingModule } from "./accounting/accounting.module";
import { AuthModule } from "./auth/auth.module";
import { CashBankModule } from "./cash-bank/cash-bank.module";
import { CompanyModule } from "./company/company.module";
import { CostCenterModule } from "./cost-center/cost-center.module";
import { FiscalYearModule } from "./fiscal-year/fiscal-year.module";
import { HealthController } from "./health.controller";
import { ProjectModule } from "./project/project.module";
import { VoucherModule } from "./voucher/voucher.module";

@Module({
  imports: [
    AuthModule,
    CompanyModule,
    FiscalYearModule,
    AccountingPeriodModule,
    ProjectModule,
    CostCenterModule,
    AccountingModule,
    CashBankModule,
    VoucherModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
