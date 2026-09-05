import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkScheduleController } from "./work-schedule.controller";
import { WorkScheduleService } from "./work-schedule.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [WorkScheduleController],
  providers: [WorkScheduleService],
  exports: [WorkScheduleService],
})
export class WorkScheduleModule {}
