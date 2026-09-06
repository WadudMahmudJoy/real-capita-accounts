import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Validate } from "class-validator";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AttendanceCalendarService } from "./attendance-calendar.service";
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
  listExceptions(@Query() query: ListCalendarExceptionsQueryDto) {
    return this.calendar.listExceptions(query.from, query.to);
  }

  @Post("exceptions")
  createException(@Body() dto: CreateCalendarExceptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendar.createException(dto, user);
  }

  @Post("historical-corrections")
  historicalCorrect(@Body() dto: HistoricalCalendarCorrectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendar.historicalCorrect(dto, user);
  }

  @Patch("exceptions/:id")
  updateException(@Param("id") id: string, @Body() dto: UpdateCalendarExceptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendar.updateException(id, dto, user);
  }

  @Post("exceptions/:id/cancel")
  cancelException(@Param("id") id: string, @Body() dto: CancelCalendarExceptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendar.cancelException(id, dto, user);
  }
}
