import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { ActiveCompanyContext, AuthenticatedUser } from "../auth/auth.types";
import { ActiveCompany } from "../auth/decorators/active-company.decorator";
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
import { WorkScheduleService, requireActiveCompanyId } from "./work-schedule.service";

@Controller("work-schedules")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class WorkScheduleController {
  constructor(private readonly service: WorkScheduleService) {}

  @Get()
  listSchedules(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Query() query: ListWorkSchedulesQueryDto,
  ) {
    return this.service.listSchedules(
      requireActiveCompanyId(company),
      query.includeInactive ?? false,
    );
  }

  @Get("effective")
  @Header("Cache-Control", "no-store")
  resolveWorkSchedule(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Query() query: EffectiveWorkScheduleQueryDto,
  ) {
    return this.service.resolveWorkSchedule(
      requireActiveCompanyId(company),
      query.employeeId,
      query.businessDate,
    );
  }

  @Get("assignments")
  @Header("Cache-Control", "no-store")
  listAssignments(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Query() query: ListWorkScheduleAssignmentsQueryDto,
  ) {
    return this.service.listAssignments(
      requireActiveCompanyId(company),
      query.employeeId,
    );
  }

  @Post()
  createSchedule(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: CreateWorkScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createSchedule(requireActiveCompanyId(company), dto, user);
  }

  @Post("assignments")
  createAssignment(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: CreateWorkScheduleAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createAssignment(requireActiveCompanyId(company), dto, user);
  }

  @Post("assignments/:id/replace")
  replaceAssignment(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: ReplaceWorkScheduleAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.replaceAssignment(requireActiveCompanyId(company), id, dto, user);
  }

  @Post("assignments/:id/end")
  endAssignment(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: EndWorkScheduleAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.endAssignment(requireActiveCompanyId(company), id, dto, user);
  }

  @Post("assignments/:id/cancel")
  cancelAssignment(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: CancelWorkScheduleAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancelAssignment(requireActiveCompanyId(company), id, dto, user);
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  getSchedule(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
  ) {
    return this.service.getSchedule(requireActiveCompanyId(company), id);
  }

  @Patch(":id")
  updateSchedule(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: UpdateWorkScheduleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateSchedule(requireActiveCompanyId(company), id, dto, user);
  }
}
