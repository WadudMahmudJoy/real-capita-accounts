import { Injectable, ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PayrollDocumentsService } from "./payroll-documents.service";
import { PayrollPaymentPreparationDto, PayrollPaymentPreparationQueryDto } from "./dto/payroll-payment-preparation.dto";

const Decimal = Prisma.Decimal.clone({ precision: 40 });
const authority = { code: "PAYROLL_SOURCE_AUTHORIZATION_REQUIRED", message: "Select a source account with an explicit unexpired PRIMARY authorization. Global registry visibility does not establish permission." };
const accountSelect = { id: true, displayName: true, accountType: true, isActive: true,
  ledgerAccount: { select: { id: true, code: true, isActive: true, isCashBank: true } } } satisfies Prisma.CashBankAccountSelect;

@Injectable()
export class PayrollPaymentPreparationService {
  constructor(private readonly prisma: PrismaService, private readonly documents: PayrollDocumentsService) {}
  async prepare(id: string, query: PayrollPaymentPreparationQueryDto, transaction?: Prisma.TransactionClient): Promise<PayrollPaymentPreparationDto> {
    if (!["BANK", "CASH"].includes(query.channel)) throw new UnprocessableEntityException({ code: "PAYROLL_PAYMENT_CHANNEL_INVALID", message: "Select BANK or CASH." });
    const read = async (tx: Prisma.TransactionClient): Promise<PayrollPaymentPreparationDto> => {
      // Reuse approved snapshot validation in the SAME consistent read view.
      const sheet = await this.documents.salarySheet(id, tx);
      const profiles = await tx.payrollRunLine.findMany({ where: { payrollRunId: id }, take: 1001,
        select: { employeeId: true, paymentProfileId: true, paymentProfileSnapshot: true } });
      const byEmployee = new Map(profiles.map(line => [line.employeeId, line]));
      const invalidSnapshot = () => { throw new UnprocessableEntityException({ code: "PAYROLL_PAYMENT_SNAPSHOT_INVALID", message: "Historical payment-profile evidence is missing or inconsistent." }); };
      if (profiles.length !== sheet.employeeCount || byEmployee.size !== sheet.employeeCount) invalidSnapshot();
      for (const row of sheet.rows) {
        const line = byEmployee.get(row.employee.employeeId), value = line?.paymentProfileSnapshot;
        if (!line || !value || typeof value !== "object" || Array.isArray(value)) invalidSnapshot();
        const profile = value as Record<string, unknown>;
        if (profile.profileId !== line!.paymentProfileId || typeof profile.selectedBankPercentage !== "string" || !/^\d{1,3}\.\d{6}$/.test(profile.selectedBankPercentage)) invalidSnapshot();
        for (const key of ["approvedAt", "sourceUpdatedAt"]) if (typeof profile[key] !== "string" || !Number.isFinite(Date.parse(profile[key])) || Date.parse(profile[key]) > Date.parse(sheet.approvedAt)) invalidSnapshot();
        const percentage = new Decimal(profile.selectedBankPercentage as string);
        // Integrity check against the frozen rule; never replace stored money.
        if (percentage.lessThan(0) || percentage.greaterThan(100) || !new Decimal(row.amounts.grossSalary).times(percentage).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).equals(row.amounts.bankPay)) invalidSnapshot();
        if (new Decimal(row.amounts.bankPay).greaterThan(0)) for (const field of ["bankName", "accountName", "accountNumber"]) if (typeof profile[field] !== "string" || !profile[field].trim()) invalidSnapshot();
      }
      if (query.sourceAccountId !== undefined) {
        const account = await tx.cashBankAccount.findUnique({ where: { id: query.sourceAccountId }, select: accountSelect });
        if (!account || account.accountType !== query.channel || !account.isActive || !account.ledgerAccount.isActive || !account.ledgerAccount.isCashBank) {
          throw new UnprocessableEntityException({ code: "PAYROLL_SOURCE_ACCOUNT_INVALID", message: "Source account must exist, match the channel and have an active cash/bank ledger." });
        }
        const parent = await tx.payrollRun.findUnique({ where: { id }, select: { companyId: true } });
        const grants = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM payroll_source_authorizations WHERE "companyId"=${parent!.companyId} AND "sourceAccountId"=${account.id} AND channel=${query.channel}::"PayrollPaymentChannel" AND payroll_payment_grant_valid(id) ORDER BY generation DESC LIMIT 1`.catch((e: unknown) => {
          if (e && typeof e === "object" && "code" in e && ["P2021", "P2010"].includes(String(e.code))) throw new ServiceUnavailableException("Payment source authorization schema is pending reviewed deployment.");
          throw e;
        });
        const grant = grants[0];
        if (!grant) throw new UnprocessableEntityException({ code: "PAYROLL_SOURCE_NOT_AUTHORIZED", message: "An explicit unexpired PRIMARY source authorization is required." });
      }
      const accounts = await tx.cashBankAccount.findMany({ where: { accountType: query.channel, isActive: true, ledgerAccount: { isActive: true, isCashBank: true } }, select: accountSelect,
        orderBy: [{ displayName: "asc" }, { id: "asc" }], take: 201 });
      if (accounts.length > 200) throw new UnprocessableEntityException({ code: "PAYROLL_SOURCE_ACCOUNT_LIST_LIMIT", message: "Source account options exceed the preparation limit of 200." });
      const rows = sheet.rows.map(row => ({ employeeId: row.employee.employeeId, employeeCode: row.employee.employeeCode, fullName: row.employee.fullName,
        plannedAmount: query.channel === "BANK" ? row.amounts.bankPay : row.amounts.cashPay,
        selectable: new Decimal(query.channel === "BANK" ? row.amounts.bankPay : row.amounts.cashPay).greaterThan(0) }));
      const total = rows.reduce((sum, row) => sum.plus(row.plannedAmount), new Decimal(0));
      if (!total.equals(query.channel === "BANK" ? sheet.totals.bankPay : sheet.totals.cashPay) || !new Decimal(sheet.totals.bankPay).plus(sheet.totals.cashPay).equals(sheet.totals.netPay)) {
        throw new UnprocessableEntityException({ code: "PAYROLL_PREPARATION_RECONCILIATION_FAILED", message: "Historical allocations do not reconcile." });
      }
      return { runId: sheet.runId, year: sheet.year, month: sheet.month, company: sheet.company, channel: query.channel,
        status: "PREPARATION_NOT_DISBURSED", canDisburse: false, sourceAuthorizationVerified: Boolean(query.sourceAccountId), employeeCount: rows.length, rows, totalPlanned: total.toFixed(2),
        bankTotal: sheet.totals.bankPay, cashTotal: sheet.totals.cashPay, payrollNetTotal: sheet.totals.netPay,
        sourceAccounts: accounts.map(account => ({ id: account.id, displayName: account.displayName, ledgerCode: account.ledgerAccount.code, registryScope: "GLOBAL_UNVERIFIED" })),
        blockers: query.sourceAccountId ? [] : [authority], notice: "Preparation / Not Disbursed. Amounts are planned allocations; no payment history or outstanding balance is verified." };
    };
    return transaction ? read(transaction) : this.prisma.$transaction(read, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
