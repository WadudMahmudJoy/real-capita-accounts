import { Body, Controller, Get, Header, Param, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { ActiveCompanyContext, AuthenticatedUser } from "../auth/auth.types";
import { ActiveCompany } from "../auth/decorators/active-company.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AttendancePolicyService } from "./attendance-policy.service";
import { requireActiveCompanyId } from "./attendance-lock";
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
  listPolicies(@ActiveCompany() company: ActiveCompanyContext | null) {
    return this.policies.listPolicies(requireActiveCompanyId(company));
  }

  @Post()
  createInitialPolicy(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: CreateInitialAttendancePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.policies.createInitialPolicy(
      requireActiveCompanyId(company),
      dto,
      user,
    );
  }

  @Post(":id/replace")
  replacePolicy(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: ReplaceAttendancePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.policies.replacePolicy(requireActiveCompanyId(company), id, dto, user);
  }

  @Post(":id/cancel-future")
  cancelFuturePolicy(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: CancelFutureAttendancePolicyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.policies.cancelFuturePolicy(
      requireActiveCompanyId(company),
      id,
      dto,
      user,
    );
  }
}
