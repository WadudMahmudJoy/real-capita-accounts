import { Module } from "@nestjs/common";
import { AccountingPeriodModule } from "./accounting-period/accounting-period.module";
import { AccountingModule } from "./accounting/accounting.module";
import { AuthModule } from "./auth/auth.module";
import { BookableItemModule } from "./bookable-item/bookable-item.module";
import { BookingModule } from "./booking/booking.module";
import { CashBankModule } from "./cash-bank/cash-bank.module";
import { CompanyModule } from "./company/company.module";
import { CostCenterModule } from "./cost-center/cost-center.module";
import { CustomerModule } from "./customer/customer.module";
import { DepartmentModule } from "./department/department.module";
import { FiscalYearModule } from "./fiscal-year/fiscal-year.module";
import { EmployeeModule } from "./employee/employee.module";
import { HealthController } from "./health.controller";
import { ProjectModule } from "./project/project.module";
import { ReportModule } from "./report/report.module";
import { VoucherModule } from "./voucher/voucher.module";
import { SalaryModule } from "./salary/salary.module";
import { WorkScheduleModule } from "./work-schedule/work-schedule.module";

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
    ReportModule,
    CustomerModule,
    DepartmentModule,
    BookableItemModule,
    BookingModule,
    EmployeeModule,
    SalaryModule,
    WorkScheduleModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
