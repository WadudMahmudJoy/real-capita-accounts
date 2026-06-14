import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { FiscalYearController } from "./fiscal-year.controller";
import { FiscalYearService } from "./fiscal-year.service";

@Module({
  controllers: [FiscalYearController],
  imports: [AuthModule, PrismaModule],
  providers: [FiscalYearService],
})
export class FiscalYearModule {}
