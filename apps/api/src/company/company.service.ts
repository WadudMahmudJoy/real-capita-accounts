import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async findSingleton() {
    const company = await this.prisma.company.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!company) {
      throw new NotFoundException("Company profile has not been created yet.");
    }

    return company;
  }

  async create(dto: CreateCompanyDto) {
    const existingCompany = await this.prisma.company.findFirst({
      select: { id: true },
    });

    if (existingCompany) {
      throw new ConflictException("Company profile already exists.");
    }

    try {
      return await this.prisma.company.create({
        data: {
          address: dto.address,
          currency: dto.currency ?? "BDT",
          email: dto.email,
          legalName: dto.legalName,
          name: dto.name,
          phone: dto.phone,
        },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Company profile already exists.");
    }
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.ensureExists(id);

    return this.prisma.company.update({
      data: dto,
      where: { id },
    });
  }

  private async ensureExists(id: string) {
    const company = await this.prisma.company.findUnique({
      select: { id: true },
      where: { id },
    });

    if (!company) {
      throw new NotFoundException("Company profile was not found.");
    }
  }
}
