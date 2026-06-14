import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateLedgerAccountDto } from "./dto/create-ledger-account.dto";
import { UpdateLedgerAccountDto } from "./dto/update-ledger-account.dto";
import { LedgerAccountService } from "./ledger-account.service";

@Controller("ledger-accounts")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class LedgerAccountController {
  constructor(private readonly ledgerAccountService: LedgerAccountService) {}

  @Get()
  findAll() {
    return this.ledgerAccountService.findAll();
  }

  @Post()
  create(@Body() dto: CreateLedgerAccountDto) {
    return this.ledgerAccountService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateLedgerAccountDto) {
    return this.ledgerAccountService.update(id, dto);
  }
}
