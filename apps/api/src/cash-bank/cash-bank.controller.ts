import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CashBankService } from "./cash-bank.service";
import { CreateCashBankAccountDto } from "./dto/create-cash-bank-account.dto";
import { UpdateCashBankAccountDto } from "./dto/update-cash-bank-account.dto";

@Controller("cash-bank-accounts")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class CashBankController {
  constructor(private readonly cashBankService: CashBankService) {}

  @Get()
  findAll() {
    return this.cashBankService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCashBankAccountDto) {
    return this.cashBankService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCashBankAccountDto) {
    return this.cashBankService.update(id, dto);
  }
}
