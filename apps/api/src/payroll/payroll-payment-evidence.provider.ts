import { Injectable } from '@nestjs/common';
export interface PaymentEvidenceExpectation {
  batchId: string; channel: 'BANK' | 'CASH'; sourceAccountId: string; amount: string; currency: string;
  beneficiaries: { employeeId: string; amount: string }[];
}
export interface VerifiedPaymentEvidence extends PaymentEvidenceExpectation {
  authority: string; authorityRecordId: string; occurredAt: string; verifiedAt: string;
  acknowledgments?: { employeeId: string; acknowledgmentId: string; amount: string; occurredAt: string }[];
}
// A handle locates evidence; it is never proof. Only an approved server-side
// adapter may independently authenticate records and validate all bindings.
@Injectable()
export class PayrollPaymentEvidenceProvider {
  isConfigured(): boolean { return false; }
  verify(_handle: string, _expected: PaymentEvidenceExpectation): Promise<VerifiedPaymentEvidence | null> {
    void [_handle, _expected]; return Promise.resolve(null);
  }
}
