import { Injectable, NotFoundException } from "@nestjs/common";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCostCenterDto } from "./dto/create-cost-center.dto";
import { UpdateCostCenterDto } from "./dto/update-cost-center.dto";

@Injectable()
export class CostCenterService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.costCenter.findMany({
      include: { project: true },
      orderBy: [{ projectId: "asc" }, { code: "asc" }],
    });
  }

  async create(dto: CreateCostCenterDto) {
    await this.ensureProjectExists(dto.projectId);

    try {
      return await this.prisma.costCenter.create({
        data: dto,
        include: { project: true },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Cost center code already exists for this project.",
      );
    }
  }

  async update(id: string, dto: UpdateCostCenterDto) {
    await this.ensureExists(id);

    if (dto.projectId) {
      await this.ensureProjectExists(dto.projectId);
    }

    try {
      return await this.prisma.costCenter.update({
        data: dto,
        include: { project: true },
        where: { id },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Cost center code already exists for this project.",
      );
    }
  }

  private async ensureExists(id: string) {
    const costCenter = await this.prisma.costCenter.findUnique({
      select: { id: true },
      where: { id },
    });

    if (!costCenter) {
      throw new NotFoundException("Cost center was not found.");
    }
  }

  private async ensureProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      select: { id: true },
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException("Project was not found.");
    }
  }
}
