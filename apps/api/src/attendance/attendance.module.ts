import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { WorkScheduleModule } from "../work-schedule/work-schedule.module";
import { AttendanceExpectationService } from "./attendance-expectation.service";
import { AttendancePolicyService } from "./attendance-policy.service";
import { AttendanceCalendarService } from "./attendance-calendar.service";
import { AttendanceDayService } from "./attendance-day.service";
import { AttendanceFinalizationService } from "./attendance-finalization.service";
import { AttendanceCorrectionService } from "./attendance-correction.service";
import { AttendanceController } from "./attendance.controller";
import { AttendancePolicyController } from "./attendance-policy.controller";
import { AttendanceCalendarController } from "./attendance-calendar.controller";

@Module({
  imports: [AuthModule, PrismaModule, WorkScheduleModule],
  controllers: [AttendanceController, AttendancePolicyController, AttendanceCalendarController],
  providers: [
    AttendanceExpectationService,
    AttendancePolicyService,
    AttendanceCalendarService,
    AttendanceDayService,
    AttendanceFinalizationService,
    AttendanceCorrectionService,
  ],
  exports: [
    AttendanceExpectationService,
    AttendancePolicyService,
    AttendanceCalendarService,
    AttendanceDayService,
    AttendanceFinalizationService,
    AttendanceCorrectionService,
  ],
})
export class AttendanceModule {}
