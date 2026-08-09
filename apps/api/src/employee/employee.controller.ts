import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CreateEmployeeDto, ListEmployeesQueryDto, UpdateEmployeeDto } from "./dto/employee.dto";
import { EmployeeService } from "./employee.service";

@Controller("employees")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class EmployeeController {
  constructor(private readonly service: EmployeeService) {}
  @Get() findAll(@Query() query: ListEmployeesQueryDto) { return this.service.findAll(query); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateEmployeeDto, @CurrentUser() user: AuthenticatedUser) { return this.service.create(dto, user); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto, @CurrentUser() user: AuthenticatedUser) { return this.service.update(id, dto, user); }
}
