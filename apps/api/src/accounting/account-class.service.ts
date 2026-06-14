import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AccountClassService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.accountClass.findMany({
      orderBy: { code: "asc" },
    });
  }

  async findOne(id: string) {
    const accountClass = await this.prisma.accountClass.findUnique({
      where: { id },
    });

    if (!accountClass) {
      throw new NotFoundException("Account class was not found.");
    }

    return accountClass;
  }
}
