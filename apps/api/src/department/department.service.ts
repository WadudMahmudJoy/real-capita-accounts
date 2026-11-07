import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDepartmentDto, UpdateDepartmentDto } from "./dto/department.dto";

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.department.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });
  }

  async create(dto: CreateDepartmentDto, user: AuthenticatedUser) {
    const code = dto.code.trim().toUpperCase();
    const name = dto.name.trim();
    const description = clean(dto.description);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertUnique(tx, code, name);
        const department = await tx.department.create({
          data: { code, name, description },
          include: { _count: { select: { employees: true } } },
        });
        await audit(
          tx,
          user.id,
          "DEPARTMENT_CREATED",
          "Department",
          department.id,
        );
        return department;
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Department code or name already exists.",
      );
    }
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
    user: AuthenticatedUser,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one Department field is required.");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.department.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException("Department was not found.");

        const name = dto.name === undefined ? existing.name : dto.name.trim();
        if (name.toLocaleLowerCase() !== existing.name.toLocaleLowerCase()) {
          await this.assertUnique(tx, existing.code, name, id);
        }

        const changedFields = [
          ...(dto.name !== undefined && name !== existing.name ? ["name"] : []),
          ...(dto.description !== undefined && clean(dto.description) !== existing.description
            ? ["description"]
            : []),
          ...(dto.isActive !== undefined && dto.isActive !== existing.isActive
            ? ["isActive"]
            : []),
        ];

        const department = await tx.department.update({
          where: { id },
          data: {
            ...(dto.name === undefined ? {} : { name }),
            ...(dto.description === undefined
              ? {}
              : { description: clean(dto.description) }),
            ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
          },
          include: { _count: { select: { employees: true } } },
        });

        if (changedFields.length > 0) {
          const action =
            existing.isActive && department.isActive === false
              ? "DEPARTMENT_DEACTIVATED"
              : "DEPARTMENT_UPDATED";
          await audit(tx, user.id, action, "Department", id, { changedFields });
        }
        return department;
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Department code or name already exists.",
      );
    }
  }

  private async assertUnique(
    tx: Prisma.TransactionClient,
    code: string,
    name: string,
    excludeId?: string,
  ) {
    const duplicateCode = await tx.department.findFirst({
      where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (duplicateCode) {
      throw new ConflictException("Department code already exists.");
    }

    const duplicateName = await tx.department.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicateName) {
      throw new ConflictException("Department name already exists.");
    }
  }
}

function clean(value: string | null | undefined) {
  const result = value?.trim();
  return result ? result : null;
}

async function audit(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonObject,
) {
  await tx.auditEvent.create({
    data: { userId, action, entityType, entityId, metadata },
  });
}
