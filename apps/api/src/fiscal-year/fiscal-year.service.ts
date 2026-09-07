import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { assertEndDateAfterStartDate, parseIsoDate } from "../common/date-rules";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFiscalYearDto } from "./dto/create-fiscal-year.dto";
import { UpdateFiscalYearDto } from "./dto/update-fiscal-year.dto";

@Injectable()
export class FiscalYearService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.fiscalYear.findMany({
      include: { company: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      where: { companyId },
    });
  }

  async create(companyId: string, dto: CreateFiscalYearDto) {
    // Transitional contract: the legacy DTO still carries companyId. It is
    // never the write authority — the trusted session company is. A matching
    // value is accepted for backward compatibility; a mismatch is rejected
    // rather than silently creating the fiscal year under another company.
    if (dto.companyId !== companyId) {
      throw new ConflictException(
        "The selected office does not match the supplied company.",
      );
    }

    const startDate = parseIsoDate(dto.startDate, "startDate");
    const endDate = parseIsoDate(dto.endDate, "endDate");
    assertEndDateAfterStartDate(startDate, endDate);

    return this.prisma.fiscalYear.create({
      data: {
        companyId,
        endDate,
        name: dto.name,
        startDate,
      },
      include: { company: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateFiscalYearDto) {
    const fiscalYear = await this.findExisting(companyId, id);

    const startDate = dto.startDate
      ? parseIsoDate(dto.startDate, "startDate")
      : fiscalYear.startDate;
    const endDate = dto.endDate
      ? parseIsoDate(dto.endDate, "endDate")
      : fiscalYear.endDate;

    assertEndDateAfterStartDate(startDate, endDate);

    // The write itself stays company-scoped: ownership lives in the where
    // filter, not only in the preceding read.
    const updated = await this.prisma.fiscalYear.updateMany({
      data: {
        endDate,
        isActive: dto.isClosed ? false : undefined,
        isClosed: dto.isClosed,
        name: dto.name,
        startDate,
      },
      where: { id, companyId },
    });

    if (updated.count !== 1) {
      throw new NotFoundException("Fiscal year was not found.");
    }

    return this.prisma.fiscalYear.findFirst({
      include: { company: true },
      where: { id, companyId },
    });
  }

  async activate(companyId: string, id: string) {
    const fiscalYear = await this.findExisting(companyId, id);

    if (fiscalYear.isClosed) {
      throw new BadRequestException("Closed fiscal years cannot be activated.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.fiscalYear.updateMany({
        data: { isActive: false },
        where: { companyId: fiscalYear.companyId },
      });

      const activated = await tx.fiscalYear.updateMany({
        data: { isActive: true },
        where: { id, companyId: fiscalYear.companyId },
      });

      if (activated.count !== 1) {
        throw new NotFoundException("Fiscal year was not found.");
      }

      return tx.fiscalYear.findFirst({
        include: { company: true },
        where: { id, companyId: fiscalYear.companyId },
      });
    });
  }

  private async findExisting(companyId: string, id: string) {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id, companyId },
    });

    if (!fiscalYear) {
      throw new NotFoundException("Fiscal year was not found.");
    }

    return fiscalYear;
  }
}
