import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CostCenterController } from "./cost-center.controller";
import { CostCenterService } from "./cost-center.service";

@Module({
  controllers: [CostCenterController],
  imports: [AuthModule, PrismaModule],
  providers: [CostCenterService],
})
export class CostCenterModule {}
