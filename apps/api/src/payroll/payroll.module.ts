import { PayrollPaymentConfirmationService, PayrollPaymentConfirmationWriter } from './payroll-payment-confirmation.service';
import { PayrollPaymentEvidenceProvider } from './payroll-payment-evidence.provider';
import { PayrollPaymentConfirmationReadinessService } from './payroll-payment-confirmation-readiness.service';
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SalaryModule } from "../salary/salary.module";
import { MonthlyPayrollCalculationService } from "./monthly-payroll-calculation.service";
import { PayrollController } from "./payroll.controller";
import { PayrollParentResolver } from "./payroll-parent.resolver";
import { PayrollService } from "./payroll.service";
import { PayrollReadinessService } from "./payroll-readiness.service";
import { PayrollDraftService } from "./payroll-draft.service";
import { PayrollAttendanceCompletenessService } from "./payroll-attendance-completeness.service";
import { PayrollPreviewService } from "./payroll-preview.service";
import { PayrollApprovalReadinessService } from "./payroll-approval-readiness.service";
import { PayrollApprovalService } from "./payroll-approval.service";
import { PayrollCorrectionPreflightService } from "./payroll-correction-preflight.service";
import { PayrollDocumentsService } from "./payroll-documents.service";
import { PayrollPaymentPreparationService } from "./payroll-payment-preparation.service";

import { PayrollPaymentAuthority, PayrollPaymentLifecycleService } from "./payroll-payment-lifecycle.service";
import { PayrollPaymentBatchService } from "./payroll-payment-batch.service";

@Module({
  imports: [AuthModule, PrismaModule, SalaryModule],
  controllers: [PayrollController],
  providers: [PayrollPaymentConfirmationService, PayrollPaymentConfirmationWriter, PayrollPaymentEvidenceProvider, PayrollPaymentConfirmationReadinessService, PayrollPaymentAuthority, PayrollPaymentLifecycleService, PayrollPaymentBatchService, PayrollPaymentPreparationService, PayrollParentResolver, PayrollService, MonthlyPayrollCalculationService, PayrollReadinessService, PayrollDraftService, PayrollAttendanceCompletenessService, PayrollPreviewService, PayrollApprovalReadinessService, PayrollApprovalService, PayrollCorrectionPreflightService, PayrollDocumentsService],
  exports: [PayrollPaymentConfirmationReadinessService, PayrollPaymentLifecycleService, PayrollPaymentBatchService, PayrollParentResolver, MonthlyPayrollCalculationService, PayrollReadinessService, PayrollAttendanceCompletenessService, PayrollApprovalReadinessService, PayrollCorrectionPreflightService],
})
export class PayrollModule {}
