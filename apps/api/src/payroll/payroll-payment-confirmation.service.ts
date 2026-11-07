import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PayrollPaymentConfirmationReadinessService } from './payroll-payment-confirmation-readiness.service';
import { PayrollPaymentEvidenceProvider } from './payroll-payment-evidence.provider';
import { payrollPaymentErrorCode } from './payroll-payment-error';

// No finance connection/provider is installed in production API configuration.
@Injectable()
export class PayrollPaymentConfirmationWriter {
  transaction<T>(_work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    void _work; return Promise.reject(new ServiceUnavailableException('Trusted confirmation writer unavailable.'));
  }
}
@Injectable()
export class PayrollPaymentConfirmationService {
  constructor(private readonly readiness: PayrollPaymentConfirmationReadinessService,
    private readonly provider: PayrollPaymentEvidenceProvider, private readonly writer: PayrollPaymentConfirmationWriter) {}
  async confirm(batchId: string, input: { expectedVersion: number; evidenceHandle: string; idempotencyKey: string }, user: AuthenticatedUser) {
    if (!input || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion<1 || !input.evidenceHandle?.trim() || input.evidenceHandle.length>256 || !/^[A-Za-z0-9_-]{8,128}$/.test(input.idempotencyKey)) throw new BadRequestException('Invalid confirmation input.');
    if (!this.provider.isConfigured()) throw new ServiceUnavailableException({code:'TRUSTED_EVIDENCE_VERIFIER_UNAVAILABLE',message:'Independent payment verification is not configured.'});
    try {
      return await this.writer.transaction(async tx=>{
        const readiness=await this.readiness.assess(batchId,input.expectedVersion,user,tx);
        if(readiness.status!=='READY_FOR_EVIDENCE_VERIFICATION') {
          if(readiness.blockers.some(b=>['ACCOUNTANT_REQUIRED','CONFIRMER_NOT_AUTHORIZED','MAKER_CHECKER_REQUIRED'].includes(b.code)))throw new ForbiddenException('Independent active Accountant confirmation is required.');
          if(readiness.blockers.some(b=>b.code==='BATCH_NOT_FOUND_OR_FOREIGN'))throw new NotFoundException('Payment batch not found.');
          if(readiness.blockers.some(b=>['STALE_BATCH_VERSION','BATCH_NOT_PREPARED','CONFIRMATION_ALREADY_EXISTS','CANCELLATION_PENDING_OR_DECIDED'].includes(b.code)))throw new ConflictException('Stale or conflicting confirmation.');
          throw new UnprocessableEntityException({code:'CONFIRMATION_BLOCKED',blockers:readiness.blockers});
        }
        const batch=await tx.payrollPaymentBatch.findUniqueOrThrow({where:{id:batchId},include:{payrollRun:true,lines:{orderBy:{employeeId:'asc'}}}});
        const branding=batch.payrollRun.companySnapshot;
        const currency=branding&&typeof branding==='object'&&!Array.isArray(branding)?branding.currency:undefined;
        if(typeof currency!=='string'||!currency.trim())throw new UnprocessableEntityException('Historical currency is unavailable.');
        const expected={batchId,channel:batch.channel,sourceAccountId:batch.sourceAccountId,amount:batch.totalAmount.toFixed(2),currency,beneficiaries:batch.lines.map(l=>({employeeId:l.employeeId,amount:l.amount.toFixed(2)}))};
        const proof=await this.provider.verify(input.evidenceHandle,expected);
        const reject=()=>{throw new UnprocessableEntityException('Independent evidence does not match the complete payment instructions.');};
        if(!proof) return reject();
        if(proof.batchId!==batchId || proof.channel!==batch.channel || proof.sourceAccountId!==batch.sourceAccountId || proof.amount!==expected.amount || proof.currency!==currency || !proof.authority?.trim() || !proof.authorityRecordId?.trim()) reject();
        if(proof.authority!==proof.authority.trim()||proof.authorityRecordId!==proof.authorityRecordId.trim())reject();
        const utc=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
        if(!utc.test(proof.occurredAt)||!utc.test(proof.verifiedAt)||!Array.isArray(proof.beneficiaries)) reject();
        const dates=[proof.occurredAt,proof.verifiedAt].map(Date.parse);
        if(dates.some(d=>!Number.isFinite(d)) || dates[0]<batch.createdAt.getTime() || dates[1]<dates[0] || dates[1]>Date.now()) reject();
        const sorted=(items: {employeeId:string;amount:string}[])=>[...items].sort((a,b)=>a.employeeId.localeCompare(b.employeeId));
        if(JSON.stringify(sorted(proof.beneficiaries))!==JSON.stringify(sorted(expected.beneficiaries))) reject();
        if(batch.channel==='CASH'){
          const a=proof.acknowledgments??[];
          if(!Array.isArray(a)||a.some(r=>!utc.test(r.occurredAt)))reject();
          if(a.some(r=>r.acknowledgmentId!==r.acknowledgmentId.trim()))reject();
          if(a.length!==batch.lines.length || new Set(a.map(r=>r.acknowledgmentId)).size!==a.length || new Set(a.map(r=>r.employeeId)).size!==a.length) reject();
          for(const line of batch.lines){const ack=a.find(r=>r.employeeId===line.employeeId);if(!ack?.acknowledgmentId.trim() || ack.amount!==line.amount.toFixed(2) || !Number.isFinite(Date.parse(ack.occurredAt)) || Date.parse(ack.occurredAt)<batch.createdAt.getTime() || Date.parse(ack.occurredAt)>dates[1]) reject();}
        }
        const rows=await tx.$queryRaw<{id:string;version:number}[]>`SELECT * FROM payroll_payment_confirm(${batchId},${input.expectedVersion},${user.id},${input.idempotencyKey},${randomUUID()},${JSON.stringify(proof)}::jsonb,${''})`;
        if(rows.length!==1) throw new ConflictException('Confirmation conflict.');
        return {id:rows[0].id,batchId,status:'CONFIRMED' as const,version:rows[0].version};
      });
    }catch(error){const code=payrollPaymentErrorCode(error);if(['23505','40001','40P01','P2034'].includes(code??''))throw new ConflictException('Duplicate or concurrent confirmation conflict.');if(code==='23514')throw new UnprocessableEntityException('Confirmation integrity requirements failed.');throw error;}
  }
}
