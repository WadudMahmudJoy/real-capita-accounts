import { Body, Controller, ConflictException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { ActiveCompanyContext } from "../auth/auth.types";
import { ActiveCompany } from "../auth/decorators/active-company.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateFiscalYearDto } from "./dto/create-fiscal-year.dto";
import { UpdateFiscalYearDto } from "./dto/update-fiscal-year.dto";
import { FiscalYearService } from "./fiscal-year.service";

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

@Controller("fiscal-years")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class FiscalYearController {
  constructor(private readonly fiscalYearService: FiscalYearService) {}

  @Get()
  findAll(@ActiveCompany() company: ActiveCompanyContext | null) {
    return this.fiscalYearService.findAll(requireActiveCompanyId(company));
  }

  @Post()
  create(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: CreateFiscalYearDto,
  ) {
    return this.fiscalYearService.create(
      requireActiveCompanyId(company),
      dto,
    );
  }

  @Patch(":id")
  update(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: UpdateFiscalYearDto,
  ) {
    return this.fiscalYearService.update(
      requireActiveCompanyId(company),
      id,
      dto,
    );
  }

  @Post(":id/activate")
  activate(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
  ) {
    return this.fiscalYearService.activate(
      requireActiveCompanyId(company),
      id,
    );
  }
}
