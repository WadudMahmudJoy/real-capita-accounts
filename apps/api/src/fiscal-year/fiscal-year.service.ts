import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { assertEndDateAfterStartDate, parseIsoDate } from "../common/date-rules";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFiscalYearDto } from "./dto/create-fiscal-year.dto";
import { UpdateFiscalYearDto } from "./dto/update-fiscal-year.dto";

@Injectable()
export class FiscalYearService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.fiscalYear.findMany({
      include: { company: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
  }

  async create(dto: CreateFiscalYearDto) {
    await this.ensureCompanyExists(dto.companyId);

    const startDate = parseIsoDate(dto.startDate, "startDate");
    const endDate = parseIsoDate(dto.endDate, "endDate");
    assertEndDateAfterStartDate(startDate, endDate);

    return this.prisma.fiscalYear.create({
      data: {
        companyId: dto.companyId,
        endDate,
        name: dto.name,
        startDate,
      },
      include: { company: true },
    });
  }

  async update(id: string, dto: UpdateFiscalYearDto) {
    const fiscalYear = await this.findExisting(id);
    const startDate = dto.startDate
      ? parseIsoDate(dto.startDate, "startDate")
      : fiscalYear.startDate;
    const endDate = dto.endDate
      ? parseIsoDate(dto.endDate, "endDate")
      : fiscalYear.endDate;

    assertEndDateAfterStartDate(startDate, endDate);

    return this.prisma.fiscalYear.update({
      data: {
        endDate,
        isActive: dto.isClosed ? false : undefined,
        isClosed: dto.isClosed,
        name: dto.name,
        startDate,
      },
      include: { company: true },
      where: { id },
    });
  }

  async activate(id: string) {
    const fiscalYear = await this.findExisting(id);

    if (fiscalYear.isClosed) {
      throw new BadRequestException("Closed fiscal years cannot be activated.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.fiscalYear.updateMany({
        data: { isActive: false },
        where: { companyId: fiscalYear.companyId },
      });

      return tx.fiscalYear.update({
        data: { isActive: true },
        include: { company: true },
        where: { id },
      });
    });
  }

  private async findExisting(id: string) {
    const fiscalYear = await this.prisma.fiscalYear.findUnique({
      where: { id },
    });

    if (!fiscalYear) {
      throw new NotFoundException("Fiscal year was not found.");
    }

    return fiscalYear;
  }

  private async ensureCompanyExists(companyId: string) {
    const company = await this.prisma.company.findUnique({
      select: { id: true },
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException("Company was not found.");
    }
  }
}
