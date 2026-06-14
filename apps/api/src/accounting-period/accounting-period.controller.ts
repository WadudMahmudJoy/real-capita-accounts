import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccountingPeriodService } from "./accounting-period.service";
import { CreateAccountingPeriodDto } from "./dto/create-accounting-period.dto";
import { UpdateAccountingPeriodDto } from "./dto/update-accounting-period.dto";

@Controller("accounting-periods")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class AccountingPeriodController {
  constructor(
    private readonly accountingPeriodService: AccountingPeriodService,
  ) {}

  @Get()
  findAll() {
    return this.accountingPeriodService.findAll();
  }

  @Post()
  create(@Body() dto: CreateAccountingPeriodDto) {
    return this.accountingPeriodService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateAccountingPeriodDto) {
    return this.accountingPeriodService.update(id, dto);
  }
}
