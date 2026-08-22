import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SalaryCalculator } from "./salary-calculator";
import { SalaryController } from "./salary.controller";
import { SalaryService } from "./salary.service";

@Module({
  controllers: [SalaryController],
  imports: [AuthModule, PrismaModule],
  providers: [SalaryCalculator, SalaryService],
})
export class SalaryModule {}
