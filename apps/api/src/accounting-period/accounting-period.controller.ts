import { Body, Controller, ConflictException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { ActiveCompanyContext } from "../auth/auth.types";
import { ActiveCompany } from "../auth/decorators/active-company.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AccountingPeriodService } from "./accounting-period.service";
import { CreateAccountingPeriodDto } from "./dto/create-accounting-period.dto";
import { UpdateAccountingPeriodDto } from "./dto/update-accounting-period.dto";

export function requireActiveCompanyId(
  activeCompany: ActiveCompanyContext | null,
): string {
  if (activeCompany === null) {
    throw new ConflictException(
      "No office is selected for this session. Select an office first.",
    );
  }
  if (!activeCompany.isActive) {
    throw new ConflictException(
      "The selected office is inactive. Switch to an active office to continue.",
    );
  }
  return activeCompany.id;
}

@Controller("accounting-periods")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class AccountingPeriodController {
  constructor(
    private readonly accountingPeriodService: AccountingPeriodService,
  ) {}

  @Get()
  findAll(@ActiveCompany() company: ActiveCompanyContext | null) {
    return this.accountingPeriodService.findAll(
      requireActiveCompanyId(company),
    );
  }

  @Post()
  create(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: CreateAccountingPeriodDto,
  ) {
    return this.accountingPeriodService.create(
      requireActiveCompanyId(company),
      dto,
    );
  }

  @Patch(":id")
  update(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: UpdateAccountingPeriodDto,
  ) {
    return this.accountingPeriodService.update(
      requireActiveCompanyId(company),
      id,
      dto,
    );
  }
}
