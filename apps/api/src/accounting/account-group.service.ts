import { Injectable, NotFoundException } from "@nestjs/common";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccountGroupDto } from "./dto/create-account-group.dto";
import { UpdateAccountGroupDto } from "./dto/update-account-group.dto";

@Injectable()
export class AccountGroupService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.accountGroup.findMany({
      include: { accountClass: true },
      orderBy: { code: "asc" },
    });
  }

  async create(dto: CreateAccountGroupDto) {
    await this.ensureAccountClassExists(dto.accountClassId);

    try {
      return await this.prisma.accountGroup.create({
        data: dto,
        include: { accountClass: true },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Account group code already exists.");
    }
  }

  async update(id: string, dto: UpdateAccountGroupDto) {
    await this.ensureExists(id);

    if (dto.accountClassId) {
      await this.ensureAccountClassExists(dto.accountClassId);
    }

    try {
      return await this.prisma.accountGroup.update({
        data: dto,
        include: { accountClass: true },
        where: { id },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Account group code already exists.");
    }
  }

  private async ensureExists(id: string) {
    const accountGroup = await this.prisma.accountGroup.findUnique({
      select: { id: true },
      where: { id },
    });

    if (!accountGroup) {
      throw new NotFoundException("Account group was not found.");
    }
  }

  private async ensureAccountClassExists(accountClassId: string) {
    const accountClass = await this.prisma.accountClass.findUnique({
      select: { id: true },
      where: { id: accountClassId },
    });

    if (!accountClass) {
      throw new NotFoundException("Account class was not found.");
    }
  }
}
