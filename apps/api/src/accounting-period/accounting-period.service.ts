import { Injectable, NotFoundException } from "@nestjs/common";
import {
  assertDateRangeInsideParentRange,
  assertEndDateAfterStartDate,
  parseIsoDate,
} from "../common/date-rules";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountingPeriodDto } from "./dto/create-accounting-period.dto";
import { UpdateAccountingPeriodDto } from "./dto/update-accounting-period.dto";

@Injectable()
export class AccountingPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.accountingPeriod.findMany({
      include: { fiscalYear: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
  }

  async create(dto: CreateAccountingPeriodDto) {
    const fiscalYear = await this.findFiscalYear(dto.fiscalYearId);
    const startDate = parseIsoDate(dto.startDate, "startDate");
    const endDate = parseIsoDate(dto.endDate, "endDate");

    assertEndDateAfterStartDate(startDate, endDate);
    assertDateRangeInsideParentRange(
      startDate,
      endDate,
      fiscalYear.startDate,
      fiscalYear.endDate,
    );

    return this.prisma.accountingPeriod.create({
      data: {
        endDate,
        fiscalYearId: dto.fiscalYearId,
        name: dto.name,
        startDate,
        status: dto.status,
      },
      include: { fiscalYear: true },
    });
  }

  async update(id: string, dto: UpdateAccountingPeriodDto) {
    const existing = await this.prisma.accountingPeriod.findUnique({
      include: { fiscalYear: true },
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("Accounting period was not found.");
    }

    const fiscalYear = dto.fiscalYearId
      ? await this.findFiscalYear(dto.fiscalYearId)
      : existing.fiscalYear;
    const startDate = dto.startDate
      ? parseIsoDate(dto.startDate, "startDate")
      : existing.startDate;
    const endDate = dto.endDate
      ? parseIsoDate(dto.endDate, "endDate")
      : existing.endDate;

    assertEndDateAfterStartDate(startDate, endDate);
    assertDateRangeInsideParentRange(
      startDate,
      endDate,
      fiscalYear.startDate,
      fiscalYear.endDate,
    );

    return this.prisma.accountingPeriod.update({
      data: {
        endDate,
        fiscalYearId: fiscalYear.id,
        name: dto.name,
        startDate,
        status: dto.status,
      },
      include: { fiscalYear: true },
      where: { id },
    });
  }

  private async findFiscalYear(id: string) {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id },
    });

    if (!fiscalYear) {
      throw new NotFoundException("Fiscal year was not found.");
    }

    return fiscalYear;
  }
}
