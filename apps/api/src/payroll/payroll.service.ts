import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListPayrollRunsQueryDto } from "./dto/payroll-query.dto";
import { PayrollEmployeeIdentityDto, PayrollRunDetailDto, PayrollRunLineDto, PayrollRunListDto, PayrollRunSummaryDto } from "./dto/payroll-response.dto";
import { PayrollParentResolver } from "./payroll-parent.resolver";

const runSelect = {
  id: true, companyId: true, payrollYear: true, payrollMonth: true,
  status: true, version: true, approvedAt: true, createdAt: true, updatedAt: true,
  _count: { select: { lines: true } },
} satisfies Prisma.PayrollRunSelect;

const lineSelect = {
  id: true, employeeId: true, employeeSnapshot: true,
  grossSalary: true, totalEarnings: true, attendanceDeduction: true,
  providentFundDeduction: true, loanOrSalaryAdvanceDeduction: true, aitDeduction: true,
  otherDeductionsTotal: true, totalDeductions: true, netPay: true, bankPay: true, cashPay: true,
} satisfies Prisma.PayrollRunLineSelect;

type RunRow = Prisma.PayrollRunGetPayload<{ select: typeof runSelect }>;
type LineRow = Prisma.PayrollRunLineGetPayload<{ select: typeof lineSelect }>;

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver) {}

  async list(query: ListPayrollRunsQueryDto): Promise<PayrollRunListDto> {
    return this.prisma.$transaction(async tx => {
      const parent = await this.parent.resolve(tx);
      const where: Prisma.PayrollRunWhereInput = {
        companyId: parent.id,
        ...(query.year === undefined ? {} : { payrollYear: query.year }),
        ...(query.month === undefined ? {} : { payrollMonth: query.month }),
        ...(query.status === undefined ? {} : { status: query.status }),
      };
      const [runs, total] = await Promise.all([
        tx.payrollRun.findMany({ where, select: runSelect,
          orderBy: [{ payrollYear: "desc" }, { payrollMonth: "desc" }, { id: "asc" }],
          skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
        tx.payrollRun.count({ where }),
      ]);
      return { items: runs.map(summary), page: query.page, pageSize: query.pageSize, total };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async get(id: string, viewerId?: string): Promise<PayrollRunDetailDto> {
    return this.prisma.$transaction(async tx => {
      const parent = await this.parent.resolve(tx);
      const run = await tx.payrollRun.findFirst({
        where: { id, companyId: parent.id },
        select: { ...runSelect, createdById: true, lines: { select: lineSelect, orderBy: [{ employeeId: "asc" }, { id: "asc" }] } },
      });
      if (!run) throw new NotFoundException("Payroll Run was not found.");
      return { ...summary(run), isCreator: viewerId !== undefined && run.createdById === viewerId, lines: run.lines.map(lineResponse) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}

function summary(run: RunRow): PayrollRunSummaryDto {
  return { id: run.id, companyId: run.companyId, year: run.payrollYear, month: run.payrollMonth,
    status: run.status, version: run.version, approvedAt: run.approvedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(), updatedAt: run.updatedAt.toISOString(), lineCount: run._count.lines };
}

function employeeIdentity(snapshot: Prisma.JsonValue): PayrollEmployeeIdentityDto {
  const object = snapshot !== null && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {};
  const text = (key: string): string | null => typeof object[key] === "string" ? object[key] : null;
  return { employeeCode: text("employeeCode"), fullName: text("fullName"),
    designation: text("designation"), departmentName: text("departmentName") };
}

function lineResponse(line: LineRow): PayrollRunLineDto {
  return { id: line.id, employeeId: line.employeeId, employee: employeeIdentity(line.employeeSnapshot),
    grossSalary: line.grossSalary.toFixed(2), totalEarnings: line.totalEarnings.toFixed(2),
    attendanceDeduction: line.attendanceDeduction.toFixed(2), providentFundDeduction: line.providentFundDeduction.toFixed(2),
    loanOrSalaryAdvanceDeduction: line.loanOrSalaryAdvanceDeduction.toFixed(2), aitDeduction: line.aitDeduction.toFixed(2),
    otherDeductionsTotal: line.otherDeductionsTotal.toFixed(2), totalDeductions: line.totalDeductions.toFixed(2),
    netPay: line.netPay.toFixed(2), bankPay: line.bankPay.toFixed(2), cashPay: line.cashPay.toFixed(2) };
}
