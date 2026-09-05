import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import {
  CancelWorkScheduleAssignmentDto,
  CreateWorkScheduleAssignmentDto,
  CreateWorkScheduleDto,
  EffectiveWorkScheduleQueryDto,
  EndWorkScheduleAssignmentDto,
  ListWorkScheduleAssignmentsQueryDto,
  ListWorkSchedulesQueryDto,
  ReplaceWorkScheduleAssignmentDto,
  UpdateWorkScheduleDto,
} from "./dto/work-schedule.dto";
import { WorkScheduleService } from "./work-schedule.service";

@Controller("work-schedules")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class WorkScheduleController {
  constructor(private readonly service: WorkScheduleService) {}

  @Get()
  listSchedules(@Query() query: ListWorkSchedulesQueryDto) {
    return this.service.listSchedules(query.includeInactive ?? false);
  }

  @Get("effective")
  @Header("Cache-Control", "no-store")
  resolveWorkSchedule(@Query() query: EffectiveWorkScheduleQueryDto) {
    return this.service.resolveWorkSchedule(query.employeeId, query.businessDate);
  }

  @Get("assignments")
  @Header("Cache-Control", "no-store")
  listAssignments(@Query() query: ListWorkScheduleAssignmentsQueryDto) {
    return this.service.listAssignments(query.employeeId);
  }

  @Post()
  createSchedule(
    @Body() dto: CreateWorkScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createSchedule(dto, user);
  }

  @Post("assignments")
  createAssignment(
    @Body() dto: CreateWorkScheduleAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createAssignment(dto, user);
  }

  @Post("assignments/:id/replace")
  replaceAssignment(
    @Param("id") id: string,
    @Body() dto: ReplaceWorkScheduleAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.replaceAssignment(id, dto, user);
  }

  @Post("assignments/:id/end")
  endAssignment(
    @Param("id") id: string,
    @Body() dto: EndWorkScheduleAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.endAssignment(id, dto, user);
  }

  @Post("assignments/:id/cancel")
  cancelAssignment(
    @Param("id") id: string,
    @Body() dto: CancelWorkScheduleAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancelAssignment(id, dto, user);
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  getSchedule(@Param("id") id: string) {
    return this.service.getSchedule(id);
  }

  @Patch(":id")
  updateSchedule(
    @Param("id") id: string,
    @Body() dto: UpdateWorkScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateSchedule(id, dto, user);
  }
}
