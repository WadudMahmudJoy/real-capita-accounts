import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, SetMetadata, UseGuards } from "@nestjs/common";
import { ACCOUNTANT_ROLE, READ_ONLY_AUTH_CONTEXT_METADATA_KEY } from "../auth/auth.constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ListPayrollRunsQueryDto, PayrollRunIdParamsDto } from "./dto/payroll-query.dto";
import { PayrollService } from "./payroll.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PayrollDraftService } from "./payroll-draft.service";
import { PayrollReadinessInputDto } from "./dto/payroll-readiness.dto";
import { PayrollPreviewService } from "./payroll-preview.service";
import { PayrollApprovalService } from "./payroll-approval.service";
import { ApprovePayrollRunDto } from "./dto/payroll-approve.dto";
import { PayrollDocumentsService } from "./payroll-documents.service";
import { PayrollPayslipParamsDto } from "./dto/payroll-documents.dto";
import { PayrollPaymentPreparationService } from "./payroll-payment-preparation.service";
import { PayrollPaymentPreparationQueryDto } from "./dto/payroll-payment-preparation.dto";
import { PayrollPaymentBatchService } from "./payroll-payment-batch.service";
import { PreparePayrollPaymentBatchDto } from "./dto/payroll-payment-batch.dto";
import { ConfirmPayrollPaymentDto } from './dto/payroll-payment-confirm.dto';
import { PayrollPaymentConfirmationService } from './payroll-payment-confirmation.service';

@Controller("payroll-runs")
@Roles(ACCOUNTANT_ROLE)
@UseGuards(AuthGuard, RolesGuard)
@SetMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, true)
export class PayrollController {
  @Post('payment-batches/:id/confirm')
  @SetMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, false)
  @Header('Cache-Control', 'no-store')
  confirmPayment(@Param() params: PayrollRunIdParamsDto, @Body() input: ConfirmPayrollPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.confirmations.confirm(params.id,input,user);
  }
  constructor(private readonly confirmations: PayrollPaymentConfirmationService, private readonly payroll: PayrollService, private readonly drafts: PayrollDraftService, private readonly previews: PayrollPreviewService, private readonly approvals: PayrollApprovalService, private readonly documents: PayrollDocumentsService, private readonly payments: PayrollPaymentPreparationService, private readonly batches: PayrollPaymentBatchService) {}

  @Post("payment-batches")
  @SetMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, false)
  @Header("Cache-Control", "no-store")
  prepareBatch(@Body() input: PreparePayrollPaymentBatchDto, @CurrentUser() user: AuthenticatedUser) { return this.batches.prepare(input, user); }

  @Get(":id/payment-preparation")
  @Header("Cache-Control", "no-store")
  preparation(@Param() params: PayrollRunIdParamsDto, @Query() query: PayrollPaymentPreparationQueryDto) { return this.payments.prepare(params.id, query); }

  @Get(":id/payslips/:employeeId")
  @Header("Cache-Control", "no-store")
  payslip(@Param() params: PayrollPayslipParamsDto) { return this.documents.payslip(params.id, params.employeeId); }

  @Get(":id/salary-sheet")
  @Header("Cache-Control", "no-store")
  salarySheet(@Param() params: PayrollRunIdParamsDto) { return this.documents.salarySheet(params.id); }

  @Post(":id/approve")
  @HttpCode(200)
  @SetMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, false)
  @Header("Cache-Control", "no-store")
  approve(@Param() params: PayrollRunIdParamsDto, @Body() input: ApprovePayrollRunDto, @CurrentUser() user: AuthenticatedUser) {
    return this.approvals.approve(params.id, input, user);
  }

  @Post("preview")
  @HttpCode(200)
  @SetMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, false)
  @Header("Cache-Control", "no-store")
  preview(@Body() input: PayrollReadinessInputDto) {
    return this.previews.preview(input);
  }

  @Post()
  @SetMetadata(READ_ONLY_AUTH_CONTEXT_METADATA_KEY, false)
  @Header("Cache-Control", "no-store")
  create(@Body() input: PayrollReadinessInputDto, @CurrentUser() user: AuthenticatedUser) {
    return this.drafts.create(input, user);
  }

  @Get()
  @Header("Cache-Control", "no-store")
  list(@Query() query: ListPayrollRunsQueryDto) {
    return this.payroll.list(query);
  }

  @Get(":id")
  @Header("Cache-Control", "no-store")
  get(@Param() params: PayrollRunIdParamsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payroll.get(params.id, user.id);
  }
}
