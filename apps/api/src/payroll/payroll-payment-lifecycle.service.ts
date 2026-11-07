import { payrollPaymentErrorCode } from "./payroll-payment-error";
import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollParentResolver } from "./payroll-parent.resolver";

export type AuthorityProof = { reference: string };
export type NonDisbursementProof = { digest: string; authority: string; verifiedAt: Date };
// No designation registry or trusted evidence adapter exists yet. This production
// provider deliberately fails closed. An input string never constitutes proof.
@Injectable()
export class PayrollPaymentAuthority {
  delegate(_companyId: string, _userId: string, _reviewing: boolean, _tx: Prisma.TransactionClient): Promise<AuthorityProof | null> { void [_companyId, _userId, _reviewing, _tx]; return Promise.resolve(null); }
  nonDisbursement(_request: Prisma.PayrollCancellationRequestGetPayload<{ include: { batch: { include: { lines: true; sourceAuthorization: true } } } }>, _reviewerId: string, _tx: Prisma.TransactionClient): Promise<NonDisbursementProof | null> { void [_request, _reviewerId, _tx]; return Promise.resolve(null); }
}

@Injectable()
export class PayrollPaymentLifecycleService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver, private readonly authority: PayrollPaymentAuthority) {}
  private async actor(tx: Prisma.TransactionClient, user: AuthenticatedUser, companyId: string, reviewing: boolean) {
    if (!user?.id || !user.roles?.some(r => r.code === "ACCOUNTANT")) throw new ForbiddenException("Accountant write identity is required.");
    const actor = await tx.user.findUnique({ where: { id: user.id }, select: { isActive: true, roles: { select: { role: { select: { code: true } } } } } });
    if (!actor?.isActive || !actor.roles.some(r => r.role.code === "ACCOUNTANT")) throw new ForbiddenException("Active Accountant identity is required.");
    const proof = await this.authority.delegate(companyId, user.id, reviewing, tx);
    const rows = await tx.$queryRaw<{ valid: boolean }[]>`SELECT payroll_payment_delegate(${companyId},${user.id},${reviewing}) AS valid`;
    if (!proof?.reference?.trim() || !rows[0]?.valid) throw new ForbiddenException({ code: "FINANCE_DELEGATE_AUTHORITY_UNAVAILABLE", message: "Verified explicit finance delegation is required; Accountant status alone is insufficient." });
    return proof;
  }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (e) {
      if (e instanceof HttpException) throw e;
      const code = payrollPaymentErrorCode(e);
      if (["P2002", "P2004", "P2034", "23514", "23505", "40001", "40P01"].includes(code)) throw new ConflictException("Payment lifecycle state or authority changed; reload before retrying.");
      throw e;
    }
  }
  private key(value: string) { if (typeof value !== "string" || value.length < 8 || value.length > 128) throw new BadRequestException("A valid idempotency key is required."); }
  private async lockParent(tx: Prisma.TransactionClient) {
    const parent = await this.parent.resolve(tx);
    await tx.$queryRaw`SELECT payroll_payment_lock_parent(${parent.id})::text`;
    await this.parent.resolve(tx); return parent;
  }
  async requestGrant(input: { sourceAccountId: string; channel: "BANK" | "CASH"; expiresAt?: string; idempotencyKey: string }, user: AuthenticatedUser) {
    this.key(input.idempotencyKey);
    if (!["BANK", "CASH"].includes(input.channel) || typeof input.sourceAccountId !== "string" || !input.sourceAccountId) throw new BadRequestException("Invalid source grant input.");
    if (input.expiresAt !== undefined && (typeof input.expiresAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.expiresAt))) throw new BadRequestException("Expiry must be a UTC ISO timestamp with millisecond precision.");
    const expiresAt = input.expiresAt === undefined ? null : new Date(input.expiresAt);
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt.toISOString() !== input.expiresAt)) throw new BadRequestException("Invalid expiry.");
    return this.transaction(async tx => {
      const parent = await this.lockParent(tx), proof = await this.actor(tx, user, parent.id, false);
      const replay = await tx.payrollSourceAction.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { grant: true } });
      if (replay) {
        if (replay.kind !== "APPROVE" || replay.initiatedById !== user.id || replay.grant.companyId !== parent.id || replay.grant.sourceAccountId !== input.sourceAccountId || replay.grant.channel !== input.channel || replay.grant.expiresAt?.getTime() !== expiresAt?.getTime()) throw new ConflictException("Idempotency key belongs to another action.");
        return { grantId: replay.grantId, actionId: replay.id, state: "PENDING" as const };
      }
      const rows = await tx.$queryRaw<{ snapshot: Prisma.InputJsonValue; revision: string }[]>`SELECT s AS snapshot,encode(sha256(convert_to(s::text,'UTF8')),'hex') AS revision FROM (SELECT payroll_payment_source_snapshot(${parent.id},${input.sourceAccountId},${input.channel}::"PayrollPaymentChannel") AS s) source`;
      const last = await tx.payrollSourceAuthorization.aggregate({ where: { companyId: parent.id, sourceAccountId: input.sourceAccountId, channel: input.channel }, _max: { generation: true } });
      const grant = await tx.payrollSourceAuthorization.create({ data: { companyId: parent.id, sourceAccountId: input.sourceAccountId, channel: input.channel, generation: (last._max.generation ?? 0) + 1, sourceSnapshot: rows[0].snapshot, sourceRevision: rows[0].revision, grantedById: user.id, expiresAt, auditSnapshot: { actorId: user.id, authorityReference: proof.reference } } });
      const action = await tx.payrollSourceAction.create({ data: { grantId: grant.id, kind: "APPROVE", initiatedById: user.id, idempotencyKey: input.idempotencyKey, auditSnapshot: { actorId: user.id, authorityReference: proof.reference } } });
      await this.audit(tx, user.id, "PAYROLL_SOURCE_GRANT_REQUESTED", grant.id, { actionId: action.id });
      return { grantId: grant.id, actionId: action.id, state: "PENDING" as const };
    });
  }
  async requestRevocation(grantId: string, idempotencyKey: string, user: AuthenticatedUser) {
    this.key(idempotencyKey);
    return this.transaction(async tx => {
      const parent = await this.lockParent(tx), proof = await this.actor(tx, user, parent.id, false);
      const grant = await tx.payrollSourceAuthorization.findUnique({ where: { id: grantId } });
      if (!grant || grant.companyId !== parent.id) throw new NotFoundException("Source authorization not found.");
      const old = await tx.payrollSourceAction.findUnique({ where: { idempotencyKey } });
      if (old) { if (old.grantId !== grantId || old.kind !== "REVOKE" || old.initiatedById !== user.id) throw new ConflictException("Idempotency action mismatch."); return { actionId: old.id, state: "PENDING" as const }; }
      const action = await tx.payrollSourceAction.create({ data: { grantId, kind: "REVOKE", initiatedById: user.id, idempotencyKey, auditSnapshot: { actorId: user.id, authorityReference: proof.reference } } });
      await this.audit(tx, user.id, "PAYROLL_SOURCE_REVOCATION_REQUESTED", grantId, { actionId: action.id });
      return { actionId: action.id, state: "PENDING" as const };
    });
  }
  async reviewSourceAction(actionId: string, user: AuthenticatedUser) {
    return this.transaction(async tx => {
      const parent = await this.lockParent(tx), proof = await this.actor(tx, user, parent.id, true);
      const action = await tx.payrollSourceAction.findUnique({ where: { id: actionId }, include: { grant: true, decision: true } });
      if (!action || action.grant.companyId !== parent.id) throw new NotFoundException("Source action not found.");
      if (action.initiatedById === user.id) throw new ForbiddenException("Independent reviewer is required.");
      await this.actor(tx, { ...user, id: action.initiatedById }, parent.id, false);
      if (action.decision) throw new ConflictException("Source action has already been decided.");
      await tx.payrollSourceDecision.create({ data: { actionId, reviewedById: user.id, authorityReference: proof.reference, auditSnapshot: { actorId: user.id, authorityReference: proof.reference, action: action.kind } } });
      await this.audit(tx, user.id, `PAYROLL_SOURCE_${action.kind === "APPROVE" ? "AUTHORIZED" : "REVOKED"}`, action.grantId, { actionId });
      return { grantId: action.grantId, state: action.kind === "APPROVE" ? "AUTHORIZED" : "REVOKED" };
    });
  }
  async requestCancellation(input: { batchId: string; expectedVersion: number; evidenceReference: string; idempotencyKey: string }, user: AuthenticatedUser) {
    this.key(input.idempotencyKey);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 || typeof input.evidenceReference !== "string" || !input.evidenceReference.trim() || input.evidenceReference.length > 500) throw new BadRequestException("Invalid cancellation request.");
    return this.transaction(async tx => {
      const parent = await this.lockParent(tx), proof = await this.actor(tx, user, parent.id, false);
      const batch = await tx.payrollPaymentBatch.findUnique({ where: { id: input.batchId }, include: { confirmation: true } });
      if (!batch || batch.companyId !== parent.id) throw new NotFoundException("Payment batch not found.");
      if (batch.status !== "PREPARED" || batch.confirmation || batch.version !== input.expectedVersion) throw new ConflictException("Only current unconfirmed PREPARED instructions may be cancelled.");
      const old = await tx.payrollCancellationRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (old) { if (old.batchId !== input.batchId || old.expectedVersion !== input.expectedVersion || old.initiatedById !== user.id || old.evidenceReference !== input.evidenceReference) throw new ConflictException("Idempotency action mismatch."); return { requestId: old.id, state: "PENDING" as const }; }
      const request = await tx.payrollCancellationRequest.create({ data: { ...input, initiatedById: user.id, auditSnapshot: { actorId: user.id, authorityReference: proof.reference } } });
      await this.audit(tx, user.id, "PAYROLL_CANCELLATION_REQUESTED", batch.id, { requestId: request.id });
      return { requestId: request.id, state: "PENDING" as const };
    });
  }
  async reviewCancellation(requestId: string, user: AuthenticatedUser) {
    return this.transaction(async tx => {
      const parent = await this.lockParent(tx), proof = await this.actor(tx, user, parent.id, true);
      const request = await tx.payrollCancellationRequest.findUnique({ where: { id: requestId }, include: { decision: true, batch: { include: { lines: true, sourceAuthorization: true, confirmation: true } } } });
      if (!request || request.batch.companyId !== parent.id) throw new NotFoundException("Cancellation request not found.");
      if ([request.initiatedById, request.batch.createdById].includes(user.id)) throw new ForbiddenException("Independent cancellation reviewer is required.");
      await this.actor(tx, { ...user, id: request.initiatedById }, parent.id, false);
      await tx.$queryRaw`SELECT payroll_payment_source_snapshot(${parent.id},${request.batch.sourceAccountId},${request.batch.channel}::"PayrollPaymentChannel")`;
      await tx.$queryRaw`SELECT id FROM payroll_payment_batches WHERE id=${request.batchId} FOR UPDATE`;
      if (request.decision || request.batch.status !== "PREPARED" || request.batch.confirmation || request.batch.version !== request.expectedVersion) throw new ConflictException("Payment state/version changed.");
      const evidence = await this.authority.nonDisbursement(request, user.id, tx);
      if (!evidence || !/^[a-f0-9]{64}$/.test(evidence.digest) || !evidence.authority.trim() || !Number.isFinite(evidence.verifiedAt.getTime())) throw new UnprocessableEntityException({ code: "NON_DISBURSEMENT_AUTHORITY_UNAVAILABLE", message: "Trusted independently verified non-disbursement evidence is required." });
      await tx.payrollCancellationDecision.create({ data: { requestId, reviewedById: user.id, evidenceDigest: evidence.digest, verificationAuthority: evidence.authority, verifiedAt: evidence.verifiedAt, auditSnapshot: { actorId: user.id, authorityReference: proof.reference } } });
      const updated = await tx.payrollPaymentBatch.updateMany({ where: { id: request.batchId, status: "PREPARED", version: request.expectedVersion }, data: { status: "CANCELLED", version: { increment: 1 } } });
      if (updated.count !== 1) throw new ConflictException("Concurrent payment lifecycle operation.");
      await this.audit(tx, user.id, "PAYROLL_PAYMENT_BATCH_CANCELLED", request.batchId, { requestId, evidenceDigest: evidence.digest, expectedVersion: request.expectedVersion });
      return { batchId: request.batchId, status: "CANCELLED" as const, version: request.expectedVersion + 1 };
    });
  }
  private async audit(tx: Prisma.TransactionClient, userId: string, action: string, entityId: string, metadata: Prisma.InputJsonObject) {
    await tx.auditEvent.create({ data: { userId, action, entityType: "PayrollPaymentLifecycle", entityId, metadata } });
  }
}
