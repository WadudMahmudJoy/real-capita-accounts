import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccountClassService } from "./account-class.service";

@Controller("account-classes")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class AccountClassController {
  constructor(private readonly accountClassService: AccountClassService) {}

  @Get()
  findAll() {
    return this.accountClassService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.accountClassService.findOne(id);
  }
}
