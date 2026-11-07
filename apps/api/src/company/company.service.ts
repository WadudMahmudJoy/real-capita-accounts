import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

type SessionContext = {
  id: string;
  activeCompanyId: string | null;
};

type CompanyReader = Pick<PrismaService, "company">;

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  // Resolves the office selected by the caller's session. Never falls back
  // to another company: a missing selection or a missing row is a 404, and an
  // inactive selected office is returned so the user can switch away.
  async findSelectedCompany(activeCompanyId: string | null) {
    if (activeCompanyId === null) {
      throw new NotFoundException("Company profile has not been created yet.");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: activeCompanyId },
    });

    if (!company) {
      throw new NotFoundException("Company profile was not found.");
    }

    return company;
  }

  async listCompanies(activeCompanyId: string | null) {
    const companies = await this.prisma.company.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return { activeCompanyId, companies };
  }

  async create(dto: CreateCompanyDto, session: SessionContext) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureNameAvailable(tx, dto.name);

      const company = await tx.company.create({
        data: {
          address: dto.address,
          currency: dto.currency ?? "BDT",
          email: dto.email,
          legalName: dto.legalName,
          name: dto.name,
          phone: dto.phone,
        },
      });

      // First-company binding: only a session without an active company is
      // bound to the new office. Existing selections are never switched
      // implicitly by creating another office.
      if (session.activeCompanyId === null) {
        await tx.authSession.update({
          data: { activeCompanyId: company.id },
          where: { id: session.id },
        });
      }

      return company;
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.ensureExists(id);

    if (dto.name !== undefined) {
      await this.ensureNameAvailable(this.prisma, dto.name, id);
    }

    return this.prisma.company.update({
      data: dto,
      where: { id },
    });
  }

  async switchCompany(id: string, session: SessionContext) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException("Company was not found.");
    }

    if (!company.isActive) {
      throw new ConflictException(
        "This office is inactive and cannot be selected.",
      );
    }

    // Session-scoped switch: only the caller's exact AuthSession is updated.
    // Switching to the already-selected company is an idempotent success.
    await this.prisma.authSession.update({
      data: { activeCompanyId: company.id },
      where: { id: session.id },
    });

    return {
      status: "ok" as const,
      activeCompanyId: company.id,
      company,
    };
  }

  private async ensureNameAvailable(
    db: CompanyReader,
    name: string,
    excludeId?: string,
  ) {
    const existing = await db.company.findFirst({
      select: { id: true },
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        "A company with this name already exists.",
      );
    }
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
