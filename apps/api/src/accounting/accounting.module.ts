import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AccountClassController } from "./account-class.controller";
import { AccountClassService } from "./account-class.service";
import { AccountGroupController } from "./account-group.controller";
import { AccountGroupService } from "./account-group.service";
import { LedgerAccountController } from "./ledger-account.controller";
import { LedgerAccountService } from "./ledger-account.service";

@Module({
  controllers: [
    AccountClassController,
    AccountGroupController,
    LedgerAccountController,
  ],
  imports: [AuthModule, PrismaModule],
  providers: [AccountClassService, AccountGroupService, LedgerAccountService],
})
export class AccountingModule {}
