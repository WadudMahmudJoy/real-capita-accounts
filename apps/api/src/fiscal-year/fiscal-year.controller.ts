import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateFiscalYearDto } from "./dto/create-fiscal-year.dto";
import { UpdateFiscalYearDto } from "./dto/update-fiscal-year.dto";
import { FiscalYearService } from "./fiscal-year.service";

@Controller("fiscal-years")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class FiscalYearController {
  constructor(private readonly fiscalYearService: FiscalYearService) {}

  @Get()
  findAll() {
    return this.fiscalYearService.findAll();
  }

  @Post()
  create(@Body() dto: CreateFiscalYearDto) {
    return this.fiscalYearService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateFiscalYearDto) {
    return this.fiscalYearService.update(id, dto);
  }

  @Post(":id/activate")
  activate(@Param("id") id: string) {
    return this.fiscalYearService.activate(id);
  }
}
