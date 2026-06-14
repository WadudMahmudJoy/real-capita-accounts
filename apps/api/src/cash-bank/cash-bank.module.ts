import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CashBankController } from "./cash-bank.controller";
import { CashBankService } from "./cash-bank.service";

@Module({
  controllers: [CashBankController],
  imports: [AuthModule, PrismaModule],
  providers: [CashBankService],
})
export class CashBankModule {}
