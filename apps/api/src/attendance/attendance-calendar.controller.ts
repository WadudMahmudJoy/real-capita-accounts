import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Validate } from "class-validator";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { ActiveCompanyContext, AuthenticatedUser } from "../auth/auth.types";
import { ActiveCompany } from "../auth/decorators/active-company.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AttendanceCalendarService } from "./attendance-calendar.service";
import { requireActiveCompanyId } from "./attendance-lock";
import { AttendanceBusinessDateConstraint } from "./dto/attendance-day.dto";
import {
  CancelCalendarExceptionDto,
  CreateCalendarExceptionDto,
  HistoricalCalendarCorrectionDto,
  UpdateCalendarExceptionDto,
} from "./dto/attendance-calendar.dto";

class ListCalendarExceptionsQueryDto {
  @Validate(AttendanceBusinessDateConstraint)
  from!: string;
  @Validate(AttendanceBusinessDateConstraint)
  to!: string;
}

@Controller("attendance/calendar")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class AttendanceCalendarController {
  constructor(private readonly calendar: AttendanceCalendarService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  listExceptions(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Query() query: ListCalendarExceptionsQueryDto,
  ) {
    return this.calendar.listExceptions(
      requireActiveCompanyId(company),
      query.from,
      query.to,
    );
  }

  @Post("exceptions")
  createException(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: CreateCalendarExceptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendar.createException(
      requireActiveCompanyId(company),
      dto,
      user,
    );
  }

  @Post("historical-corrections")
  historicalCorrect(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: HistoricalCalendarCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendar.historicalCorrect(
      requireActiveCompanyId(company),
      dto,
      user,
    );
  }

  @Patch("exceptions/:id")
  updateException(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: UpdateCalendarExceptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendar.updateException(
      requireActiveCompanyId(company),
      id,
      dto,
      user,
    );
  }

  @Post("exceptions/:id/cancel")
  cancelException(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: CancelCalendarExceptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendar.cancelException(
      requireActiveCompanyId(company),
      id,
      dto,
      user,
    );
  }
}
