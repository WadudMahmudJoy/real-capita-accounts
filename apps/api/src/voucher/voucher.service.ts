import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  VoucherStatus,
  type VoucherType,
} from "../generated/prisma/client";
import { parseIsoDate } from "../common/date-rules";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVoucherDto } from "./dto/create-voucher.dto";
import { ListVouchersQueryDto } from "./dto/list-vouchers-query.dto";
import { UpdateVoucherDto } from "./dto/update-voucher.dto";
import { VoucherLineDto } from "./dto/voucher-line.dto";

// Width used when formatting the sequential portion of a systemVoucherNo.
// Numbers larger than the padding simply grow; the value never wraps or repeats.
const VOUCHER_NUMBER_PAD_WIDTH = 5;

export type VoucherActionContext = {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

// Shape of a validated set of lines plus the server-computed totals. The client
// never controls totals; they are always derived here from the line amounts.
type ValidatedLines = {
  lines: VoucherLineDto[];
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
};

const createdBySelect = {
  select: { id: true, fullName: true, email: true },
} as const;

const postedBySelect = {
  select: { id: true, fullName: true, email: true },
} as const;

@Injectable()
export class VoucherService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListVouchersQueryDto) {
    return this.prisma.voucher.findMany({
      where: {
        isDeleted: false,
        ...(query.voucherType ? { voucherType: query.voucherType } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.fiscalYearId ? { fiscalYearId: query.fiscalYearId } : {}),
        ...(query.accountingPeriodId
          ? { accountingPeriodId: query.accountingPeriodId }
          : {}),
      },
      include: {
        fiscalYear: true,
        accountingPeriod: true,
        createdBy: createdBySelect,
        postedBy: postedBySelect,
        _count: { select: { lines: true } },
      },
      orderBy: [{ voucherDate: "desc" }, { createdAt: "desc" }],
    });
  }

  async findOne(id: string) {
    const voucher = await this.prisma.voucher.findFirst({
      where: { id, isDeleted: false },
      include: {
        fiscalYear: true,
        accountingPeriod: true,
        createdBy: createdBySelect,
        postedBy: postedBySelect,
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            ledgerAccount: true,
            project: true,
            costCenter: true,
            cashBankAccount: true,
          },
        },
      },
    });

    if (!voucher) {
      throw new NotFoundException("Voucher was not found.");
    }

    return voucher;
  }

  async create(dto: CreateVoucherDto, context: VoucherActionContext) {
    const voucherDate = parseIsoDate(dto.voucherDate, "voucherDate");

    // companyId is always derived from the fiscal year; it is never accepted
    // from the client. This keeps the company scope authoritative.
    const { companyId } = await this.resolveDateContext(
      dto.fiscalYearId,
      dto.accountingPeriodId,
      voucherDate,
    );

    const validated = await this.validateLines(dto.lines);

    return this.prisma.$transaction(async (tx) => {
      const systemVoucherNo = await this.reserveVoucherNumber(
        tx,
        companyId,
        dto.fiscalYearId,
        dto.voucherType,
      );

      const created = await tx.voucher.create({
        data: {
          companyId,
          fiscalYearId: dto.fiscalYearId,
          accountingPeriodId: dto.accountingPeriodId,
          voucherType: dto.voucherType,
          status: VoucherStatus.DRAFT,
          systemVoucherNo,
          physicalSiNo: dto.physicalSiNo ?? null,
          voucherDate,
          narration: dto.narration,
          totalDebit: validated.totalDebit,
          totalCredit: validated.totalCredit,
          createdById: context.userId,
          lines: {
            create: validated.lines.map((line, index) => ({
              lineNo: index + 1,
              side: line.side,
              ledgerAccountId: line.ledgerAccountId,
              projectId: line.projectId ?? null,
              costCenterId: line.costCenterId ?? null,
              cashBankAccountId: line.cashBankAccountId ?? null,
              description: line.description ?? null,
              amount: new Prisma.Decimal(line.amount),
            })),
          },
        },
      });

      await this.recordAudit(tx, "VOUCHER_CREATED", created.id, context, {
        systemVoucherNo: created.systemVoucherNo,
        voucherType: created.voucherType,
        totalDebit: created.totalDebit.toString(),
        totalCredit: created.totalCredit.toString(),
      });

      return created;
    });
  }

  async update(
    id: string,
    dto: UpdateVoucherDto,
    context: VoucherActionContext,
  ) {
    const existing = await this.prisma.voucher.findFirst({
      where: { id, isDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException("Voucher was not found.");
    }

    if (existing.status !== VoucherStatus.DRAFT) {
      throw new BadRequestException(
        "Only draft vouchers can be updated. Posted vouchers are immutable.",
      );
    }

    const fiscalYearId = dto.fiscalYearId ?? existing.fiscalYearId;
    const accountingPeriodId =
      dto.accountingPeriodId ?? existing.accountingPeriodId;
    const voucherType: VoucherType = dto.voucherType ?? existing.voucherType;
    const voucherDate = dto.voucherDate
      ? parseIsoDate(dto.voucherDate, "voucherDate")
      : existing.voucherDate;
    const narration = dto.narration ?? existing.narration;

    if (narration === null || narration.trim().length === 0) {
      throw new BadRequestException("Narration is required.");
    }

    // Re-validate the (fiscal year, accounting period, date) relationship for
    // the effective combination, even when only some fields changed.
    const { companyId } = await this.resolveDateContext(
      fiscalYearId,
      accountingPeriodId,
      voucherDate,
    );

    const validated = dto.lines
      ? await this.validateLines(dto.lines)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.voucher.update({
        where: { id },
        data: {
          companyId,
          fiscalYearId,
          accountingPeriodId,
          voucherType,
          voucherDate,
          narration,
          physicalSiNo:
            dto.physicalSiNo === undefined
              ? existing.physicalSiNo
              : (dto.physicalSiNo ?? null),
          ...(validated
            ? {
                totalDebit: validated.totalDebit,
                totalCredit: validated.totalCredit,
              }
            : {}),
        },
      });

      // When lines are supplied, the draft's lines are fully replaced and the
      // totals recalculated. The systemVoucherNo is never changed.
      if (validated) {
        await tx.voucherLine.deleteMany({ where: { voucherId: id } });
        await tx.voucherLine.createMany({
          data: validated.lines.map((line, index) => ({
            voucherId: id,
            lineNo: index + 1,
            side: line.side,
            ledgerAccountId: line.ledgerAccountId,
            projectId: line.projectId ?? null,
            costCenterId: line.costCenterId ?? null,
            cashBankAccountId: line.cashBankAccountId ?? null,
            description: line.description ?? null,
            amount: new Prisma.Decimal(line.amount),
          })),
        });
      }

      await this.recordAudit(tx, "VOUCHER_EDITED", id, context, {
        systemVoucherNo: existing.systemVoucherNo,
        voucherType,
        linesReplaced: validated !== undefined,
      });
    });

    return this.findOne(id);
  }

  async softDelete(id: string, context: VoucherActionContext) {
    const existing = await this.prisma.voucher.findFirst({
      where: { id, isDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException("Voucher was not found.");
    }

    if (existing.status !== VoucherStatus.DRAFT) {
      throw new BadRequestException(
        "Only draft vouchers can be deleted. Posted vouchers cannot be deleted.",
      );
    }

    // Soft-delete only. The consumed systemVoucherNo is never reused, so the
    // VoucherNumberSequence is intentionally left untouched.
    await this.prisma.$transaction(async (tx) => {
      await tx.voucher.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() },
      });

      await this.recordAudit(tx, "VOUCHER_DELETED", id, context, {
        systemVoucherNo: existing.systemVoucherNo,
        voucherType: existing.voucherType,
      });
    });

    return {
      id: existing.id,
      status: existing.status,
      isDeleted: true,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  // Validates the fiscal year, accounting period, and that the voucher date
  // falls inside both ranges. Returns the authoritative companyId from the
  // fiscal year. The "period must be OPEN" rule is deferred to Chunk 2C-3.
  private async resolveDateContext(
    fiscalYearId: string,
    accountingPeriodId: string,
    voucherDate: Date,
  ): Promise<{ companyId: string }> {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id: fiscalYearId },
    });

    if (!fiscalYear) {
      throw new NotFoundException("Fiscal year was not found.");
    }

    const accountingPeriod = await this.prisma.accountingPeriod.findUnique({
      where: { id: accountingPeriodId },
    });

    if (!accountingPeriod) {
      throw new NotFoundException("Accounting period was not found.");
    }

    if (accountingPeriod.fiscalYearId !== fiscalYear.id) {
      throw new BadRequestException(
        "Accounting period does not belong to the selected fiscal year.",
      );
    }

    if (
      voucherDate < fiscalYear.startDate ||
      voucherDate > fiscalYear.endDate
    ) {
      throw new BadRequestException(
        "Voucher date must fall inside the fiscal year date range.",
      );
    }

    if (
      voucherDate < accountingPeriod.startDate ||
      voucherDate > accountingPeriod.endDate
    ) {
      throw new BadRequestException(
        "Voucher date must fall inside the accounting period date range.",
      );
    }

    return { companyId: fiscalYear.companyId };
  }

  // Validates every line reference and computes server-side debit/credit
  // totals. Draft vouchers may be unbalanced in this chunk; the totals are
  // still calculated and returned. Posting-time rules are deferred to 2C-3.
  private async validateLines(lines: VoucherLineDto[]): Promise<ValidatedLines> {
    const ledgerAccountIds = unique(lines.map((line) => line.ledgerAccountId));
    const projectIds = unique(
      lines.map((line) => line.projectId).filter(isDefined),
    );
    const costCenterIds = unique(
      lines.map((line) => line.costCenterId).filter(isDefined),
    );
    const cashBankAccountIds = unique(
      lines.map((line) => line.cashBankAccountId).filter(isDefined),
    );

    const [ledgerAccounts, projects, costCenters, cashBankAccounts] =
      await Promise.all([
        this.prisma.ledgerAccount.findMany({
          where: { id: { in: ledgerAccountIds } },
          select: { id: true, isActive: true },
        }),
        projectIds.length
          ? this.prisma.project.findMany({
              where: { id: { in: projectIds } },
              select: { id: true },
            })
          : Promise.resolve([]),
        costCenterIds.length
          ? this.prisma.costCenter.findMany({
              where: { id: { in: costCenterIds } },
              select: { id: true },
            })
          : Promise.resolve([]),
        cashBankAccountIds.length
          ? this.prisma.cashBankAccount.findMany({
              where: { id: { in: cashBankAccountIds } },
              select: { id: true },
            })
          : Promise.resolve([]),
      ]);

    const ledgerById = new Map(ledgerAccounts.map((row) => [row.id, row]));
    const projectIdSet = new Set(projects.map((row) => row.id));
    const costCenterIdSet = new Set(costCenters.map((row) => row.id));
    const cashBankIdSet = new Set(cashBankAccounts.map((row) => row.id));

    for (const id of ledgerAccountIds) {
      const ledgerAccount = ledgerById.get(id);

      if (!ledgerAccount) {
        throw new NotFoundException(`Ledger account ${id} was not found.`);
      }

      if (!ledgerAccount.isActive) {
        throw new BadRequestException(
          `Ledger account ${id} is not active and cannot be used.`,
        );
      }
    }

    for (const id of projectIds) {
      if (!projectIdSet.has(id)) {
        throw new NotFoundException(`Project ${id} was not found.`);
      }
    }

    for (const id of costCenterIds) {
      if (!costCenterIdSet.has(id)) {
        throw new NotFoundException(`Cost center ${id} was not found.`);
      }
    }

    for (const id of cashBankAccountIds) {
      if (!cashBankIdSet.has(id)) {
        throw new NotFoundException(`Cash/bank account ${id} was not found.`);
      }
    }

    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);

    for (const line of lines) {
      const amount = new Prisma.Decimal(line.amount);

      if (amount.lessThanOrEqualTo(0)) {
        throw new BadRequestException("Line amount must be greater than zero.");
      }

      if (line.side === "DEBIT") {
        totalDebit = totalDebit.plus(amount);
      } else {
        totalCredit = totalCredit.plus(amount);
      }
    }

    return { lines, totalDebit, totalCredit };
  }

  // Atomically reserves the next sequential number for the
  // company + fiscal year + voucher type scope inside the active transaction.
  // The UPDATE ... increment takes a row lock so concurrent creates each
  // receive a distinct number; consumed numbers are never reused.
  private async reserveVoucherNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    fiscalYearId: string,
    voucherType: VoucherType,
  ): Promise<string> {
    const where = {
      companyId_fiscalYearId_voucherType: {
        companyId,
        fiscalYearId,
        voucherType,
      },
    };

    await tx.voucherNumberSequence.upsert({
      where,
      create: {
        companyId,
        fiscalYearId,
        voucherType,
        prefix: voucherType,
        nextNumber: 1,
      },
      update: {},
    });

    const reserved = await tx.voucherNumberSequence.update({
      where,
      data: { nextNumber: { increment: 1 } },
    });

    const assignedNumber = reserved.nextNumber - 1;
    const prefix = reserved.prefix ?? voucherType;

    return `${prefix}-${String(assignedNumber).padStart(
      VOUCHER_NUMBER_PAD_WIDTH,
      "0",
    )}`;
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    action: string,
    voucherId: string,
    context: VoucherActionContext,
    metadata: Prisma.InputJsonValue,
  ): Promise<void> {
    await tx.auditEvent.create({
      data: {
        action,
        entityType: "Voucher",
        entityId: voucherId,
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata,
      },
    });
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isDefined(value: string | null | undefined): value is string {
  return typeof value === "string";
}
