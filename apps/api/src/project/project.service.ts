import { Injectable, NotFoundException } from "@nestjs/common";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      orderBy: { code: "asc" },
    });
  }

  async create(dto: CreateProjectDto) {
    try {
      return await this.prisma.project.create({
        data: dto,
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Project code already exists.");
    }
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.ensureExists(id);

    try {
      return await this.prisma.project.update({
        data: dto,
        where: { id },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Project code already exists.");
    }
  }

  private async ensureExists(id: string) {
    const project = await this.prisma.project.findUnique({
      select: { id: true },
      where: { id },
    });

    if (!project) {
      throw new NotFoundException("Project was not found.");
    }
  }
}
