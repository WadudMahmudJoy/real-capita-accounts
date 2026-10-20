import { ConflictException, ForbiddenException, HttpException, Injectable, InternalServerErrorException, UnprocessableEntityException } from "@nestjs/common";
import { ACCOUNTANT_ROLE } from "../auth/auth.constants";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollReadinessInputDto } from "./dto/payroll-readiness.dto";
import { assertPayrollFinancialIntegrity } from "./payroll-financial-integrity";
import { PayrollReadinessService } from "./payroll-readiness.service";

// Snapshots contain exact decimal strings, ISO dates, and nonmonetary metadata.
// JSON serialization detaches them and removes optional undefined properties.
function snapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class PayrollDraftService {
  constructor(private readonly prisma: PrismaService, private readonly readiness: PayrollReadinessService) {}

  async create(input: PayrollReadinessInputDto, user: AuthenticatedUser) {
    if (!user?.id || !user.roles.some(role => role.code === ACCOUNTANT_ROLE)) {
      throw new ForbiddenException("Accountant authorization is required to create payroll drafts.");
    }
    try {
      return await this.prisma.$transaction(async tx => {
        const assessment = await this.readiness.assessWithTx(input, tx);
        if (!assessment.readyForDraft || assessment.status !== "READY" || assessment.exceptions.length || !assessment.parent) {
          if (assessment.exceptions.some(e => ["PAYROLL_ALREADY_APPROVED", "PAYROLL_RUN_ALREADY_EXISTS"].includes(e.code))) {
            throw new ConflictException("Payroll already exists for this month; existing payroll cannot be replaced.");
          }
          throw new UnprocessableEntityException({ message: "Restricted payroll readiness is blocked.", exceptions: assessment.exceptions });
        }
        const lines = assessment.candidateLines;
        if (assessment.employees.some(e => e.attendance.coverage !== "VERIFIED") ||
            lines.some(l => l.calculationSnapshot.monthlyPolicyVerified !== true || l.calculationSnapshot.attendanceCoverage !== "VERIFIED")) {
          throw new UnprocessableEntityException("Authoritatively verified monthly attendance completeness is required.");
        }
        if (!lines.length || lines.length !== assessment.employees.length || new Set(lines.map(l => l.employeeId)).size !== lines.length ||
            assessment.employees.some(e => !lines.some(l => l.employeeId === e.employeeId))) {
          throw new UnprocessableEntityException("A complete, nonempty, globally unique employee collection is required.");
        }
        for (const line of lines) assertPayrollFinancialIntegrity(line);
        const run = await tx.payrollRun.create({
          data: {
            companyId: assessment.parent.id, payrollYear: assessment.period.year, payrollMonth: assessment.period.month,
            status: "DRAFT", version: 1, snapshotSchemaVersion: 1, createdById: user.id,
            companySnapshot: snapshot(assessment.parent),
            lines: { create: lines.map(line => ({
              employeeId: line.employeeId, salaryAssignmentId: line.salaryAssignmentId,
              salaryStructureId: line.salaryStructureId, paymentProfileId: line.paymentProfileId,
              employeeSnapshot: snapshot(line.employeeSnapshot), salarySnapshot: snapshot(line.salarySnapshot),
              paymentProfileSnapshot: snapshot(line.paymentProfileSnapshot), calculationSnapshot: snapshot(line.calculationSnapshot),
              grossSalary: new Prisma.Decimal(line.grossSalary), totalEarnings: new Prisma.Decimal(line.totalEarnings),
              attendanceDeduction: new Prisma.Decimal(line.attendanceDeduction), providentFundDeduction: new Prisma.Decimal(line.providentFundDeduction),
              loanOrSalaryAdvanceDeduction: new Prisma.Decimal(line.loanOrSalaryAdvanceDeduction), aitDeduction: new Prisma.Decimal(line.aitDeduction),
              otherDeductionsTotal: new Prisma.Decimal(line.otherDeductionsTotal), totalDeductions: new Prisma.Decimal(line.totalDeductions),
              netPay: new Prisma.Decimal(line.netPay), bankPay: new Prisma.Decimal(line.bankPay), cashPay: new Prisma.Decimal(line.cashPay),
            })) },
          },
          select: { id: true, companyId: true, payrollYear: true, payrollMonth: true, status: true, version: true, createdAt: true, _count: { select: { lines: true } } },
        });
        await tx.auditEvent.create({ data: { userId: user.id, action: "PAYROLL_RUN_DRAFT_CREATED", entityType: "PayrollRun", entityId: run.id,
          metadata: { companyId: run.companyId, payrollYear: run.payrollYear, payrollMonth: run.payrollMonth,
            lineCount: run._count.lines, policyContract: "HR-3B-002B-3-ABC", sourceValidation: "IN_TRANSACTION" } } });
        return { id: run.id, companyId: run.companyId, year: run.payrollYear, month: run.payrollMonth,
          status: run.status, version: run.version, createdAt: run.createdAt.toISOString(), lineCount: run._count.lines };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "P2002" || code === "P2034" || code === "P2003" || code === "P2004") {
        throw new ConflictException("Payroll or its sources changed concurrently or conflict with integrity constraints. Reassess before retrying.");
      }
      throw new InternalServerErrorException("Payroll draft creation could not be completed.");
    }
  }
}
