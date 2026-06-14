import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { VoucherController } from "./voucher.controller";
import { VoucherService } from "./voucher.service";

@Module({
  controllers: [VoucherController],
  imports: [AuthModule, PrismaModule],
  providers: [VoucherService],
})
export class VoucherModule {}
