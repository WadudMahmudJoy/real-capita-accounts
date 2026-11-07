import {
  Body,
  Controller,
  ConflictException,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import type { ActiveCompanyContext, AuthenticatedRequest } from "../auth/auth.types";
import { ActiveCompany } from "../auth/decorators/active-company.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateReversalDto } from "./dto/create-reversal.dto";
import { CreateVoucherDto } from "./dto/create-voucher.dto";
import { ListVouchersQueryDto } from "./dto/list-vouchers-query.dto";
import { UpdateVoucherDto } from "./dto/update-voucher.dto";
import { VoucherService, type VoucherActionContext } from "./voucher.service";

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

@Controller("vouchers")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Get()
  findAll(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Query() query: ListVouchersQueryDto,
  ) {
    return this.voucherService.findAll(requireActiveCompanyId(company), query);
  }

  @Get(":id")
  findOne(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
  ) {
    return this.voucherService.findOne(requireActiveCompanyId(company), id);
  }

  @Post(":id/post")
  postVoucher(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.voucherService.postVoucher(
      requireActiveCompanyId(company),
      id,
      buildContext(request),
    );
  }

  @Post(":id/reversal")
  createReversal(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: CreateReversalDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.voucherService.createReversal(
      requireActiveCompanyId(company),
      id,
      dto,
      buildContext(request),
    );
  }

  @Post()
  create(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Body() dto: CreateVoucherDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.voucherService.create(
      requireActiveCompanyId(company),
      dto,
      buildContext(request),
    );
  }

  @Patch(":id")
  update(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Body() dto: UpdateVoucherDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.voucherService.update(
      requireActiveCompanyId(company),
      id,
      dto,
      buildContext(request),
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  remove(
    @ActiveCompany() company: ActiveCompanyContext | null,
    @Param("id") id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.voucherService.softDelete(
      requireActiveCompanyId(company),
      id,
      buildContext(request),
    );
  }
}

function buildContext(request: AuthenticatedRequest): VoucherActionContext {
  return {
    userId: request.user.id,
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}
