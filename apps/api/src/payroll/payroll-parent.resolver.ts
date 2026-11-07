import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PayrollParentResolver {
  constructor(private readonly prisma: PrismaService) {}

  // Accept the caller's transaction to keep ownership and payroll reads in one
  // consistent snapshot. Never accept active-office context or a client ID.
  async resolve(database: Pick<Prisma.TransactionClient, "company"> = this.prisma) {
    const parent = await database.company.findUnique({
      where: { singletonKey: "PRIMARY" },
      select: { id: true, isActive: true },
    });
    if (!parent) {
      throw new ServiceUnavailableException("The payroll parent company is not configured.");
    }
    if (!parent.isActive) {
      throw new ServiceUnavailableException("The payroll parent company is inactive.");
    }
    return { id: parent.id };
  }
}
