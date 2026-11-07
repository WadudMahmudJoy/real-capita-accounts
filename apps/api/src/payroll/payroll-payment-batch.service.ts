import { payrollPaymentErrorCode } from "./payroll-payment-error";
import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, InternalServerErrorException, ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { Prisma } from "../generated/prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollParentResolver } from "./payroll-parent.resolver";
import { PayrollPaymentPreparationService } from "./payroll-payment-preparation.service";
import { PayrollPaymentBatchResponseDto, PreparePayrollPaymentBatchDto } from "./dto/payroll-payment-batch.dto";
const Decimal = Prisma.Decimal.clone({ precision: 40 });
@Injectable()
export class PayrollPaymentBatchService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver, private readonly preparation: PayrollPaymentPreparationService) {}
  async prepare(raw: PreparePayrollPaymentBatchDto, user: AuthenticatedUser): Promise<PayrollPaymentBatchResponseDto> {
    if (!user?.id || !user.roles?.some(r => r.code === "ACCOUNTANT")) throw new ForbiddenException("Accountant authorization is required.");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Invalid batch input.");
    const input = plainToInstance(PreparePayrollPaymentBatchDto, raw);
    if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length) throw new BadRequestException("Invalid batch input.");
    const employees = [...input.employeeIds].sort();
    const hash = createHash("sha256").update(JSON.stringify({ run: input.payrollRunId, source: input.sourceAccountId, channel: input.channel, employees, creator: user.id })).digest("hex");
    try {
      return await this.prisma.$transaction(async tx => {
        const actor = await tx.user.findUnique({ where: { id: user.id }, select: { isActive: true, roles: { select: { role: { select: { code: true } } } } } });
        if (!actor?.isActive || !actor.roles.some(r => r.role.code === "ACCOUNTANT")) throw new ForbiddenException("Active Accountant identity is required.");
        const parent = await this.parent.resolve(tx);
        await tx.$queryRaw`SELECT id FROM companies WHERE id=${parent.id} FOR UPDATE`;
        const existing = await tx.payrollPaymentBatch.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { lines: true } });
        if (existing) {
          if (existing.requestHash !== hash || existing.companyId !== parent.id || existing.createdById !== user.id) throw new ConflictException("Idempotency key belongs to another request.");
          return response(existing);
        }
        const projection = await this.preparation.prepare(input.payrollRunId, { channel: input.channel, sourceAccountId: input.sourceAccountId }, tx);
        const grants = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM payroll_source_authorizations WHERE "companyId"=${parent.id} AND "sourceAccountId"=${input.sourceAccountId} AND channel=${input.channel}::"PayrollPaymentChannel" AND payroll_payment_grant_valid(id) ORDER BY generation DESC LIMIT 1`;
        const grant = grants[0];
        if (!grant) throw new UnprocessableEntityException({ code: "PAYROLL_SOURCE_NOT_AUTHORIZED", message: "An explicit unexpired PRIMARY source authorization is required." });
        await tx.$queryRaw`WITH locked AS MATERIALIZED (SELECT payroll_payment_lock_obligations(${input.payrollRunId}, ARRAY[${Prisma.join(employees)}]::text[])) SELECT 1 AS locked FROM locked`;
        const rows = await tx.payrollRunLine.findMany({ where: { payrollRunId: input.payrollRunId, employeeId: { in: employees } }, orderBy: { employeeId: "asc" } });
        if (rows.length !== employees.length || new Set(rows.map(r => r.employeeId)).size !== employees.length) throw new UnprocessableEntityException("Selected payroll employees are missing or duplicated.");
        const byId = new Map(projection.rows.map(r => [r.employeeId, r]));
        let total = new Decimal(0);
        const lines = rows.map(line => {
          const candidate = byId.get(line.employeeId), amount = input.channel === "BANK" ? line.bankPay : line.cashPay;
          if (!candidate?.selectable || !amount.greaterThan(0) || candidate.plannedAmount !== amount.toFixed(2)) throw new UnprocessableEntityException("Every selected employee must have a positive full approved allocation.");
          total = total.plus(amount.toString());
          return { payrollRunLineId: line.id, employeeId: line.employeeId, channel: input.channel, amount,
            obligationSnapshot: { employeeSnapshot: line.employeeSnapshot, paymentProfileSnapshot: line.paymentProfileSnapshot, amount: amount.toFixed(2) } };
        });
        if (total.greaterThan("9999999999999999.99")) throw new UnprocessableEntityException("Batch total exceeds DECIMAL(18,2).");
        const batch = await tx.payrollPaymentBatch.create({ data: { companyId: parent.id, payrollRunId: input.payrollRunId, sourceAccountId: input.sourceAccountId,
          sourceAuthorizationId: grant.id, channel: input.channel, createdById: user.id, idempotencyKey: input.idempotencyKey, requestHash: hash, totalAmount: total.toFixed(2),
          creationAudit: { actorId: user.id, action: "PAYROLL_PAYMENT_BATCH_PREPARED", policy: "HR-3B-002E-2-ABCD" }, lines: { create: lines } }, include: { lines: true } });
        await tx.auditEvent.create({ data: { userId: user.id, action: "PAYROLL_PAYMENT_BATCH_PREPARED", entityType: "PayrollPaymentBatch", entityId: batch.id,
          metadata: { companyId: parent.id, payrollRunId: input.payrollRunId, channel: input.channel, sourceAuthorizationId: grant.id, lineCount: lines.length, totalAmount: total.toFixed(2) } } });
        return response(batch);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const code = payrollPaymentErrorCode(e);
      if (code === "P2021") throw new ServiceUnavailableException("Payment persistence schema is pending reviewed deployment.");
      if (["P2002", "P2034", "P2003", "P2004", "23514", "23505", "40001", "40P01"].includes(code)) throw new ConflictException("Payment obligation or request changed concurrently; reload before retrying.");
      throw new InternalServerErrorException("Payment preparation could not be persisted.");
    }
  }
}
function response(batch: Prisma.PayrollPaymentBatchGetPayload<{ include: { lines: true } }>): PayrollPaymentBatchResponseDto {
  return { id: batch.id, payrollRunId: batch.payrollRunId, channel: batch.channel, status: batch.status, createdById: batch.createdById, createdAt: batch.createdAt.toISOString(),
    totalAmount: batch.totalAmount.toFixed(2), employeeCount: batch.lines.length, lines: batch.lines.map(line => ({ employeeId: line.employeeId, amount: line.amount.toFixed(2) })) };
}
