import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CostCenterService } from "./cost-center.service";
import { CreateCostCenterDto } from "./dto/create-cost-center.dto";
import { UpdateCostCenterDto } from "./dto/update-cost-center.dto";

@Controller("cost-centers")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class CostCenterController {
  constructor(private readonly costCenterService: CostCenterService) {}

  @Get()
  findAll() {
    return this.costCenterService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCostCenterDto) {
    return this.costCenterService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCostCenterDto) {
    return this.costCenterService.update(id, dto);
  }
}
