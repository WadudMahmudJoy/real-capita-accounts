import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccountGroupService } from "./account-group.service";
import { CreateAccountGroupDto } from "./dto/create-account-group.dto";
import { UpdateAccountGroupDto } from "./dto/update-account-group.dto";

@Controller("account-groups")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class AccountGroupController {
  constructor(private readonly accountGroupService: AccountGroupService) {}

  @Get()
  findAll() {
    return this.accountGroupService.findAll();
  }

  @Post()
  create(@Body() dto: CreateAccountGroupDto) {
    return this.accountGroupService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAccountGroupDto) {
    return this.accountGroupService.update(id, dto);
  }
}
