import { Body, Controller, Get, Header, Param, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AttendancePolicyService } from "./attendance-policy.service";
import {
  CancelFutureAttendancePolicyDto,
  CreateInitialAttendancePolicyDto,
  ReplaceAttendancePolicyDto,
} from "./dto/attendance-policy.dto";

@Controller("attendance/policies")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class AttendancePolicyController {
  constructor(private readonly policies: AttendancePolicyService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  listPolicies() {
    return this.policies.listPolicies();
  }

  @Post()
  createInitialPolicy(@Body() dto: CreateInitialAttendancePolicyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.policies.createInitialPolicy(dto, user);
  }

  @Post(":id/replace")
  replacePolicy(@Param("id") id: string, @Body() dto: ReplaceAttendancePolicyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.policies.replacePolicy(id, dto, user);
  }

  @Post(":id/cancel-future")
  cancelFuturePolicy(@Param("id") id: string, @Body() dto: CancelFutureAttendancePolicyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.policies.cancelFuturePolicy(id, dto, user);
  }
}
