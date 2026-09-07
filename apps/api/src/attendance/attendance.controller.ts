import { Body, Controller, Get, Header, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { ActiveCompanyContext, AuthenticatedUser } from "../auth/auth.types";
import { ActiveCompany } from "../auth/decorators/active-company.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { parseDateOnly } from "../common/business-date";
import { AttendanceDayService } from "./attendance-day.service";
import { AttendanceFinalizationService } from "./attendance-finalization.service";
import { AttendanceCorrectionService } from "./attendance-correction.service";
import { requireActiveCompanyId } from "./attendance-lock";
import {
  AttendanceDayQueryDto,
  BulkAttendanceSaveDto,
  DiscardAttendanceEntryDto,
  FinalizeAttendanceDayDto,
  ListAttendanceHistoryQueryDto,
} from "./dto/attendance-day.dto";
import { CorrectAttendanceDto, MarkNotApplicableDto } from "./dto/attendance-correction.dto";

@Controller("attendance")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly days: AttendanceDayService,
    private readonly finalization: AttendanceFinalizationService,
    private readonly corrections: AttendanceCorrectionService,
  ) {}

  @Get("day")
  @Header("Cache-Control", "no-store")
  getDay(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Query() query: AttendanceDayQueryDto,
  ) {
    return this.days.getDay(requireActiveCompanyId(company), query.businessDate, {
      departmentId: query.departmentId,
      search: query.search,
    });
  }

  @Put("entries")
  saveEntries(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: BulkAttendanceSaveDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.days.saveEntries(
      requireActiveCompanyId(company),
      { businessDate: dto.businessDate, entries: dto.entries },
      user,
    );
  }

  @Post("entries/discard")
  discardEntry(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: DiscardAttendanceEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.days.discardEntry(
      requireActiveCompanyId(company),
      {
        businessDate: dto.businessDate,
        employeeId: dto.employeeId,
        expectedUpdatedAt: dto.expectedUpdatedAt,
      },
      user,
    );
  }

  @Post("finalize")
  finalizeDay(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: FinalizeAttendanceDayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.finalization.finalizeDay(
      requireActiveCompanyId(company),
      { businessDate: dto.businessDate },
      user,
    );
  }

  @Get("history")
  @Header("Cache-Control", "no-store")
  listHistory(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Query() query: ListAttendanceHistoryQueryDto,
  ) {
    return this.days.listHistory(requireActiveCompanyId(company), query);
  }

  @Get("history/:employeeId/:businessDate")
  @Header("Cache-Control", "no-store")
  getHistoryDetail(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("employeeId") employeeId: string,
    @Param("businessDate") businessDate: string,
  ) {
    parseDateOnly(businessDate, "businessDate");
    return this.days.getHistoryDetail(
      requireActiveCompanyId(company),
      employeeId,
      businessDate,
    );
  }

  @Post("history/:employeeId/:businessDate/corrections")
  correctAttendance(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("employeeId") employeeId: string,
    @Param("businessDate") businessDate: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    parseDateOnly(businessDate, "businessDate");
    return this.corrections.correctAttendance(
      requireActiveCompanyId(company),
      employeeId,
      businessDate,
      dto,
      user,
    );
  }

  @Post("history/:employeeId/:businessDate/not-applicable")
  markNotApplicable(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("employeeId") employeeId: string,
    @Param("businessDate") businessDate: string,
    @Body() dto: MarkNotApplicableDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    parseDateOnly(businessDate, "businessDate");
    return this.corrections.markNotApplicable(
      requireActiveCompanyId(company),
      employeeId,
      businessDate,
      dto,
      user,
    );
  }
}
