import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { PayrollParentResolver } from './payroll-parent.resolver';
import { PayrollPaymentPreparationService } from './payroll-payment-preparation.service';
import { PayrollPaymentEvidenceProvider } from './payroll-payment-evidence.provider';
export interface PaymentConfirmationReadiness {
  batchId: string; expectedVersion: number; currentVersion: number | null;
  status: 'BLOCKED' | 'READY_FOR_EVIDENCE_VERIFICATION'; settlementVerified: false;
  confirmationRequiresTransactionalRevalidation: true; lineCount: number; totalAmount: string | null;
  blockers: { code: string }[];
}
@Injectable()
export class PayrollPaymentConfirmationReadinessService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver,
    private readonly preparation: PayrollPaymentPreparationService, private readonly evidence: PayrollPaymentEvidenceProvider) {}
  async assess(batchId: string, expectedVersion: number, user: AuthenticatedUser, transaction?: Prisma.TransactionClient): Promise<PaymentConfirmationReadiness> {
    if (!batchId || batchId.length > 128 || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new BadRequestException('Invalid batch/version.');
    const inspect = async (tx: Prisma.TransactionClient): Promise<PaymentConfirmationReadiness> => {
      const codes = new Set<string>();
      const result: PaymentConfirmationReadiness = { batchId, expectedVersion, currentVersion: null, status: 'BLOCKED', settlementVerified: false,
        confirmationRequiresTransactionalRevalidation: true, lineCount: 0, totalAmount: null, blockers: [] };
      const finish = () => { result.blockers = [...codes].sort().map(code => ({ code })); result.status = codes.size ? 'BLOCKED' : 'READY_FOR_EVIDENCE_VERIFICATION'; return result; };
      if (!user?.id || !user.roles?.some(r => r.code === 'ACCOUNTANT')) { codes.add('ACCOUNTANT_REQUIRED'); return finish(); }
      const actor = await tx.user.findUnique({ where: { id: user.id }, select: { isActive: true, roles: { select: { role: { select: { code: true } } } } } });
      if (!actor?.isActive || !actor.roles.some(r => r.role.code === 'ACCOUNTANT')) { codes.add('CONFIRMER_NOT_AUTHORIZED'); return finish(); }
      let parentId: string;
      try { parentId = (await this.parent.resolve(tx)).id; } catch { codes.add('ACTIVE_PRIMARY_UNAVAILABLE'); return finish(); }
      const batch = await tx.payrollPaymentBatch.findUnique({ where: { id: batchId }, include: { payrollRun: true, confirmation: true,
        sourceAuthorization: true, cancellationRequests: { select: { id: true } }, lines: { take: 1001, include: { payrollRunLine: true, reservation: true } } } });
      if (!batch || batch.companyId !== parentId || batch.payrollRun.companyId !== parentId) { codes.add('BATCH_NOT_FOUND_OR_FOREIGN'); return finish(); }
      result.currentVersion = batch.version;
      if (batch.version !== expectedVersion) codes.add('STALE_BATCH_VERSION');
      if (batch.status !== 'PREPARED') codes.add('BATCH_NOT_PREPARED');
      if (batch.confirmation) codes.add('CONFIRMATION_ALREADY_EXISTS');
      if (batch.cancellationRequests.length) codes.add('CANCELLATION_PENDING_OR_DECIDED');
      if (batch.createdById === user.id) codes.add('MAKER_CHECKER_REQUIRED');
      if (batch.payrollRun.status !== 'APPROVED') codes.add('PAYROLL_NOT_APPROVED');
      if (!batch.lines.length || batch.lines.length > 1000) codes.add('INVALID_LINE_COVERAGE');
      if (!this.evidence.isConfigured()) codes.add('TRUSTED_EVIDENCE_VERIFIER_UNAVAILABLE');
      const Decimal = Prisma.Decimal.clone({ precision: 40 }); let total = new Decimal(0); const employees = new Set<string>();
      for (const line of batch.lines) {
        const obligation = line.payrollRunLine, reservation = line.reservation;
        if (employees.has(line.employeeId)) codes.add('DUPLICATE_EMPLOYEE'); employees.add(line.employeeId);
        if (line.channel !== batch.channel || obligation.payrollRunId !== batch.payrollRunId || obligation.employeeId !== line.employeeId) codes.add('OBLIGATION_LINK_MISMATCH');
        if (!reservation || reservation.state !== 'HELD' || reservation.lineId !== line.id || reservation.payrollRunLineId !== line.payrollRunLineId || reservation.channel !== batch.channel) codes.add('RESERVATION_NOT_HELD');
        const expected = batch.channel === 'BANK' ? obligation.bankPay : obligation.cashPay;
        if (!line.amount.greaterThan(0) || !line.amount.equals(expected)) codes.add('FULL_ALLOCATION_MISMATCH'); total = total.plus(line.amount.toString());
      }
      if (!total.greaterThan(0) || !total.equals(batch.totalAmount)) codes.add('BATCH_TOTAL_MISMATCH');
      result.lineCount = batch.lines.length; result.totalAmount = batch.totalAmount.toFixed(2);
      const grant = batch.sourceAuthorization;
      if (grant.companyId !== parentId || grant.sourceAccountId !== batch.sourceAccountId || grant.channel !== batch.channel) codes.add('SOURCE_AUTHORIZATION_LINK_MISMATCH');
      // Installed bounded read/lock RPC evaluates UTC wall-clock expiry,
      // independent decisions and source revisions. It performs no writes.
      const source = await tx.cashBankAccount.findUnique({ where: { id: batch.sourceAccountId }, select: { isActive: true, accountType: true, ledgerAccount: { select: { isActive: true, isCashBank: true } } } });
      if (!source?.isActive || source.accountType !== batch.channel || !source.ledgerAccount.isActive || !source.ledgerAccount.isCashBank) codes.add('SOURCE_ACCOUNT_INVALID');
      else {
        const valid = await tx.$queryRaw<{ valid: boolean }[]>`SELECT payroll_payment_grant_valid(${grant.id}) AS valid`;
        if (!valid[0]?.valid) codes.add('SOURCE_AUTHORIZATION_EXPIRED_REVOKED_OR_STALE');
      }
      try {
        const projection = await this.preparation.prepare(batch.payrollRunId, { channel: batch.channel, sourceAccountId: batch.sourceAccountId }, tx);
        const amounts = new Map(projection.rows.map(r => [r.employeeId, r.plannedAmount]));
        if (batch.lines.some(l => amounts.get(l.employeeId) !== l.amount.toFixed(2))) codes.add('HISTORICAL_ALLOCATION_INVALID');
      } catch (error) {
        if (error instanceof Error && 'getStatus' in error) codes.add('SOURCE_OR_HISTORICAL_EVIDENCE_INVALID'); else throw error;
      }
      return finish();
    };
    return transaction ? inspect(transaction) : this.prisma.$transaction(inspect, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
