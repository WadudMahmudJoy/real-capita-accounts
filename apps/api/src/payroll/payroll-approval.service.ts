import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApprovePayrollRunDto, PayrollApprovalResponseDto } from "./dto/payroll-approve.dto";
import { PayrollApprovalReadinessService } from "./payroll-approval-readiness.service";

@Injectable()
export class PayrollApprovalService {
  constructor(private readonly prisma: PrismaService, private readonly readiness: PayrollApprovalReadinessService) {}

  async approve(runId: string, raw: ApprovePayrollRunDto, user: AuthenticatedUser): Promise<PayrollApprovalResponseDto> {
    if (!user?.id || !Array.isArray(user.roles) || !user.roles.some(r => r.code === ACCOUNTANT_ROLE)) throw new ForbiddenException("Accountant authorization is required.");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadRequestException("Invalid payroll approval input.");
    const input = plainToInstance(ApprovePayrollRunDto, raw);
    if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }).length) throw new BadRequestException("Invalid payroll approval input.");
    try {
      return await this.prisma.$transaction(async tx => {
        const assessment = await this.readiness.assessWithTx({ runId, expectedVersion: input.expectedVersion }, user, tx);
        if (!assessment.readyForApproval || assessment.status !== "READY" || assessment.blockers.length || !assessment.run) {
          const codes = new Set(assessment.blockers.map(b => b.code));
          if (["REVIEWER_NOT_AUTHORIZED_FOR_ASSESSMENT", "REVIEWER_IDENTITY_MISMATCH", "PAYROLL_SELF_APPROVAL_FORBIDDEN"].some(c => codes.has(c))) throw new ForbiddenException("Payroll approval requires a different active authenticated Accountant.");
          if (["PAYROLL_PARENT_MISSING", "PAYROLL_PARENT_INACTIVE"].some(c => codes.has(c))) throw new ServiceUnavailableException("The active payroll parent is unavailable.");
          if (["PAYROLL_RUN_MISSING", "PAYROLL_OWNERSHIP_MISMATCH"].some(c => codes.has(c))) throw new NotFoundException("Payroll Run was not found.");
          if (["PAYROLL_NOT_DRAFT", "PAYROLL_VERSION_CONFLICT", "PAYROLL_VERSION_EXHAUSTED"].some(c => codes.has(c))) throw new ConflictException("Payroll status or version conflicts with this approval request.");
          throw new UnprocessableEntityException({ message: "Payroll approval readiness is blocked.", blockers: assessment.blockers });
        }
        const run = assessment.run;
        const approvedAt = new Date();
        // This is the sole application update of PayrollRun. No line, snapshot,
        // money, payment or accounting mutation is part of approval.
        const update = await tx.payrollRun.updateMany({ where: { id: run.id, companyId: run.companyId, status: "DRAFT",
          version: input.expectedVersion, createdById: { not: user.id } }, data: { status: "APPROVED", approvedById: user.id, approvedAt, version: { increment: 1 } } });
        if (update.count !== 1) throw new ConflictException("Payroll changed concurrently; reassess before retrying.");
        await tx.auditEvent.create({ data: { action: "PAYROLL_RUN_APPROVED", entityType: "PayrollRun", entityId: run.id, userId: user.id,
          metadata: { companyId: run.companyId, createdById: run.createdById, payrollYear: run.year, payrollMonth: run.month, previousVersion: run.version, newVersion: run.version + 1,
            makerChecker: "DISTINCT_AUTHENTICATED_ACCOUNTANTS", policyContract: "HR-3B-002C-2", sourceValidation: "IN_TRANSACTION", lineCount: assessment.employeeCount } } });
        return { id: run.id, companyId: run.companyId, year: run.year, month: run.month, status: "APPROVED", version: run.version + 1,
          approvedById: user.id, approvedAt: approvedAt.toISOString(), lineCount: assessment.employeeCount };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (["P2002", "P2034", "P2003", "P2004"].includes(String(code))) throw new ConflictException("Payroll or its sources changed concurrently; reassess before retrying.");
      throw new InternalServerErrorException("Payroll approval could not be completed.");
    }
  }
}
