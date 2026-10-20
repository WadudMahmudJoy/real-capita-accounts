import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PayrollReadinessInputDto } from "./dto/payroll-readiness.dto";
import { PayrollReadinessService } from "./payroll-readiness.service";

const monetaryFields = ["grossSalary", "totalEarnings", "attendanceDeduction", "providentFundDeduction",
  "loanOrSalaryAdvanceDeduction", "aitDeduction", "otherDeductionsTotal", "totalDeductions", "netPay", "bankPay", "cashPay"] as const;
type Money = Record<typeof monetaryFields[number], string>;

// Explicit response contract: source snapshots, approval claims, attendance
// punches and payment credentials never cross this boundary.
export interface PayrollPreviewResponseDto {
  period: { year: number; month: number; timeZone: string; startDate: string; endDateExclusive: string };
  parent: { id: string; singletonKey: string } | null;
  status: "READY" | "BLOCKED";
  readyForDraft: boolean;
  creationRequiresRevalidation: true;
  exceptions: { code: string; message: string; employeeId?: string; category?: string }[];
  employees: { employeeId: string; employeeCode: string; fullName: string; sourceStatus: string;
    deductionProvenance: { category: string; amount: string; status: string; code?: string }[];
    attendance: { coverage: string; recordedDateCount: number };
    designation: string | null; departmentName: string | null; earnings: {code:string; name:string; percentage:string; amount:string}[];
    financial: { status: string; code?: string; amounts: Money | null } }[];
  financialTotals: { status: "PASS" | "UNAVAILABLE"; amounts: Money | null };
}

@Injectable()
export class PayrollPreviewService {
  constructor(private readonly readiness: PayrollReadinessService) {}

  async preview(input: PayrollReadinessInputDto): Promise<PayrollPreviewResponseDto> {
    const result = await this.readiness.assess(input);
    const money = (line: (typeof result.candidateLines)[number]): Money =>
      Object.fromEntries(monetaryFields.map(field => [field, new Prisma.Decimal(line[field]).toFixed(2)])) as Money;
    const totals = Object.fromEntries(monetaryFields.map(field => {
      let sum = new Prisma.Decimal(0);
      for (const line of result.candidateLines) sum = sum.plus(line[field]);
      return [field, sum.toFixed(2)];
    })) as Money;
    return {
      period: { year: result.period.year, month: result.period.month, timeZone: result.period.timeZone,
        startDate: result.period.startDate, endDateExclusive: result.period.endDateExclusive },
      parent: result.parent ? { id: result.parent.id, singletonKey: result.parent.singletonKey } : null,
      status: result.status, readyForDraft: result.readyForDraft, creationRequiresRevalidation: true,
      exceptions: result.exceptions.map(e => ({ code: e.code, message: e.message,
        ...("employeeId" in e ? { employeeId: e.employeeId } : {}), ...("category" in e ? { category: e.category } : {}) })),
      employees: result.employees.map(e => {
        const line = result.candidateLines.find(l => l.employeeId === e.employeeId);
        return { employeeId: e.employeeId, employeeCode: e.employeeCode, fullName: e.fullName, sourceStatus: e.sourceStatus,
          deductionProvenance: e.deductionProvenance.map(p => ({ category: p.category, amount: p.amount, status: p.status, ...(p.code ? { code: p.code } : {}) })),
          attendance: { coverage: e.attendance.coverage, recordedDateCount: e.attendance.records.length },
          designation: line?.employeeSnapshot.designation ?? null, departmentName: line?.employeeSnapshot.departmentName ?? null,
          earnings: line ? line.salarySnapshot.components.map(c => ({code:c.code,name:c.name,percentage:c.percentage,amount:c.amount})) : [],
          financial: { status: e.financial.status, ...(e.financial.code ? { code: e.financial.code } : {}), amounts: line ? money(line) : null } };
      }),
      // Blocked assessments intentionally release no payable totals; partial
      // roster arithmetic must not be mistaken for a complete monthly payroll.
      financialTotals: { status: result.readyForDraft ? "PASS" : "UNAVAILABLE", amounts: result.readyForDraft
        ? totals : null },
    };
  }
}
