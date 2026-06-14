import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AccountingPeriodController } from "./accounting-period.controller";
import { AccountingPeriodService } from "./accounting-period.service";

@Module({
  controllers: [AccountingPeriodController],
  imports: [AuthModule, PrismaModule],
  providers: [AccountingPeriodService],
})
export class AccountingPeriodModule {}
