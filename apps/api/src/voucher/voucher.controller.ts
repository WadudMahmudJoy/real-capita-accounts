import {
  Body,
  Controller,
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
import type { AuthenticatedRequest } from "../auth/auth.types";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateReversalDto } from "./dto/create-reversal.dto";
import { CreateVoucherDto } from "./dto/create-voucher.dto";
import { ListVouchersQueryDto } from "./dto/list-vouchers-query.dto";
import { UpdateVoucherDto } from "./dto/update-voucher.dto";
import { VoucherService, type VoucherActionContext } from "./voucher.service";

@Controller("vouchers")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  @Get()
  findAll(@Query() query: ListVouchersQueryDto) {
    return this.voucherService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.voucherService.findOne(id);
  }

  @Post(":id/post")
  postVoucher(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.voucherService.postVoucher(id, buildContext(request));
  }

  @Post(":id/reversal")
  createReversal(
    @Param("id") id: string,
    @Body() dto: CreateReversalDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.voucherService.createReversal(id, dto, buildContext(request));
  }

  @Post()
  create(
    @Body() dto: CreateVoucherDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.voucherService.create(dto, buildContext(request));
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateVoucherDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.voucherService.update(id, dto, buildContext(request));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  remove(@Param("id") id: string, @Req() request: AuthenticatedRequest) {
    return this.voucherService.softDelete(id, buildContext(request));
  }
}

function buildContext(request: AuthenticatedRequest): VoucherActionContext {
  return {
    userId: request.user.id,
    ipAddress: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null,
  };
}
