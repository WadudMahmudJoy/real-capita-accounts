import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollParentResolver } from "./payroll-parent.resolver";
import { assertPayrollFinancialIntegrity, type PayrollAmounts } from "./payroll-financial-integrity";
import { PayrollDocumentContextDto, PayrollPayslipDto, PayrollSalarySheetDto } from "./dto/payroll-documents.dto";

const fields = ["grossSalary", "totalEarnings", "attendanceDeduction", "providentFundDeduction", "loanOrSalaryAdvanceDeduction", "aitDeduction",
  "otherDeductionsTotal", "totalDeductions", "netPay", "bankPay", "cashPay"] as const;
const lineSelect = { id: true, employeeId: true, employeeSnapshot: true, salarySnapshot: true, calculationSnapshot: true,
  salaryAssignmentId: true, salaryStructureId: true, grossSalary: true, totalEarnings: true, attendanceDeduction: true, providentFundDeduction: true,
  loanOrSalaryAdvanceDeduction: true, aitDeduction: true, otherDeductionsTotal: true, totalDeductions: true, netPay: true, bankPay: true, cashPay: true } satisfies Prisma.PayrollRunLineSelect;
const runSelect = { id: true, companyId: true, payrollYear: true, payrollMonth: true, status: true, version: true, approvedAt: true,
  approvedById: true, createdById: true, companySnapshot: true, snapshotSchemaVersion: true } satisfies Prisma.PayrollRunSelect;
type Run = Prisma.PayrollRunGetPayload<{ select: typeof runSelect }>;
type Line = Prisma.PayrollRunLineGetPayload<{ select: typeof lineSelect }>;
const HighDecimal = Prisma.Decimal.clone({ precision: 40 });
function invalid(code = "PAYROLL_DOCUMENT_DATA_INVALID"): never { throw new UnprocessableEntityException({ code, message: "Approved payroll document data is missing or inconsistent; review the historical record." }); }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); return value as Record<string, unknown>; }
function text(value: unknown, nullable = false): string | null {
  if (value === null && nullable) return null;
  if (typeof value !== "string" || !value.trim() || value.length > 1000) return invalid(); return value;
}
function money(value: unknown): Prisma.Decimal { if (typeof value !== "string" || !/^\d{1,16}\.\d{2}$/.test(value)) return invalid(); return new Prisma.Decimal(value); }

@Injectable()
export class PayrollDocumentsService {
  constructor(private readonly prisma: PrismaService, private readonly parent: PayrollParentResolver) {}

  async payslip(id: string, employeeId: string): Promise<PayrollPayslipDto> {
    return this.prisma.$transaction(async tx => {
      const run = await this.approvedRun(tx, id), context = this.context(run);
      const line = await tx.payrollRunLine.findFirst({ where: { payrollRunId: run.id, employeeId }, select: lineSelect });
      if (!line) throw new NotFoundException("Payroll employee line was not found.");
      return { ...context, ...this.documentLine(line, run) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async salarySheet(id: string, transaction?: Prisma.TransactionClient): Promise<PayrollSalarySheetDto> {
    const read = async (tx: Prisma.TransactionClient): Promise<PayrollSalarySheetDto> => {
      const run = await this.approvedRun(tx, id), context = this.context(run);
      // Full-sheet response cap, never truncation or partial reconciliation.
      const lines = await tx.payrollRunLine.findMany({ where: { payrollRunId: run.id }, select: lineSelect, orderBy: [{ employeeId: "asc" }, { id: "asc" }], take: 1001 });
      if (lines.length > 1000) return invalid("PAYROLL_SALARY_SHEET_LIMIT_EXCEEDED");
      if (!lines.length || new Set(lines.map(l => l.employeeId)).size !== lines.length) return invalid();
      const rows = lines.map(line => { const d = this.documentLine(line, run); return { employee: d.employee, amounts: d.amounts, plannedAllocation: d.plannedAllocation }; });
      const totals = Object.fromEntries(fields.map(field => {
        let total = new HighDecimal(0); for (const row of rows) total = total.plus(row.amounts[field]); return [field, total.toFixed(2)];
      })) as PayrollAmounts;
      const deductions = new HighDecimal(totals.attendanceDeduction).plus(totals.providentFundDeduction).plus(totals.loanOrSalaryAdvanceDeduction).plus(totals.aitDeduction).plus(totals.otherDeductionsTotal);
      if (!deductions.equals(totals.totalDeductions) || !new HighDecimal(totals.totalEarnings).minus(totals.totalDeductions).equals(totals.netPay) ||
          !new HighDecimal(totals.bankPay).plus(totals.cashPay).equals(totals.netPay)) return invalid();
      return { ...context, employeeCount: rows.length, rows, totals };
    };
    return transaction ? read(transaction) : this.prisma.$transaction(read, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async approvedRun(tx: Prisma.TransactionClient, id: string): Promise<Run> {
    const parent = await this.parent.resolve(tx);
    const run = await tx.payrollRun.findFirst({ where: { id, companyId: parent.id }, select: runSelect });
    if (!run) throw new NotFoundException("Payroll Run was not found.");
    if (run.status !== "APPROVED") throw new ConflictException("Only APPROVED payroll documents are available.");
    if (!run.approvedAt || !Number.isFinite(run.approvedAt.getTime()) || !run.approvedById || run.approvedById === run.createdById ||
        !Number.isInteger(run.version) || run.version < 2 || run.snapshotSchemaVersion !== 1 || !Number.isInteger(run.payrollYear) || run.payrollYear < 1 || run.payrollYear > 9999 ||
        !Number.isInteger(run.payrollMonth) || run.payrollMonth < 1 || run.payrollMonth > 12) return invalid();
    return run;
  }
  private context(run: Run): PayrollDocumentContextDto {
    const company = object(run.companySnapshot);
    if (company.id !== run.companyId || company.singletonKey !== "PRIMARY" || typeof company.currency !== "string" || !/^[A-Z]{3}$/.test(company.currency)) return invalid();
    return { runId: run.id, year: run.payrollYear, month: run.payrollMonth, company: { name: text(company.name)!, legalName: text(company.legalName, true), currency: company.currency },
      approvalStatus: "APPROVED", approvedAt: run.approvedAt!.toISOString(), approvalVersion: run.version,
      paymentNotice: "Salary approval does not confirm payment. Bank and cash amounts are planned allocations." };
  }
  private documentLine(line: Line, run: Run): Pick<PayrollPayslipDto, "employee" | "earnings" | "amounts" | "plannedAllocation"> {
    try {
      const amounts = Object.fromEntries(fields.map(field => [field, line[field].toFixed(2)])) as PayrollAmounts;
      assertPayrollFinancialIntegrity(amounts);
      const employee = object(line.employeeSnapshot), salary = object(line.salarySnapshot), calc = object(line.calculationSnapshot);
      if (salary.assignmentId !== line.salaryAssignmentId || salary.structureId !== line.salaryStructureId || salary.grossSalary !== amounts.grossSalary || amounts.grossSalary !== amounts.totalEarnings ||
          !Array.isArray(salary.components) || !salary.components.length || salary.components.length > 100 || calc.year !== run.payrollYear || calc.month !== run.payrollMonth ||
          calc.snapshotSchemaVersion !== 1 || calc.monthlyPolicyVerified !== true || calc.attendanceCoverage !== "VERIFIED") return invalid();
      let sum = new Prisma.Decimal(0), percentages = new Prisma.Decimal(0); const codes = new Set<string>(), orders = new Set<number>();
      const earnings = salary.components.map(item => {
        const c = object(item), code = text(c.code)!, name = text(c.name)!, amount = money(c.amount);
        if (typeof c.percentage !== "string" || !/^\d{1,3}\.\d{4}$/.test(c.percentage) || !Number.isInteger(c.displayOrder) || (c.displayOrder as number) < 1) return invalid();
        const percentage = new Prisma.Decimal(c.percentage);
        if (percentage.lessThanOrEqualTo(0) || percentage.greaterThan(100) || codes.has(code.trim().toUpperCase()) || orders.has(c.displayOrder as number)) return invalid();
        codes.add(code.trim().toUpperCase()); orders.add(c.displayOrder as number); sum = sum.plus(amount); percentages = percentages.plus(percentage);
        return { code, name, percentage: c.percentage, displayOrder: c.displayOrder as number, amount: amount.toFixed(2) };
      }).sort((a, b) => a.displayOrder - b.displayOrder);
      if (!sum.equals(amounts.totalEarnings) || !percentages.equals(100)) return invalid();
      for (const field of ["attendanceDeduction", "providentFundDeduction", "loanOrSalaryAdvanceDeduction", "aitDeduction"] as const) if (calc[field] !== amounts[field]) return invalid();
      if (!Array.isArray(calc.otherApprovedDeductions)) return invalid();
      let other = new Prisma.Decimal(0); for (const d of calc.otherApprovedDeductions) other = other.plus(money(object(d).amount));
      if (!other.equals(amounts.otherDeductionsTotal)) return invalid();
      return { employee: { employeeId: line.employeeId, employeeCode: text(employee.employeeCode)!, fullName: text(employee.fullName)!, designation: text(employee.designation)!, departmentName: text(employee.departmentName, true) },
        earnings, amounts, plannedAllocation: { kind: "PLANNED", bank: amounts.bankPay, cash: amounts.cashPay } };
    } catch (error) { if (error instanceof UnprocessableEntityException) throw error; return invalid(); }
  }
}
