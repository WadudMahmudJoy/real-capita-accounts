import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLedgerAccountDto } from "./dto/create-ledger-account.dto";
import { UpdateLedgerAccountDto } from "./dto/update-ledger-account.dto";

@Injectable()
export class LedgerAccountService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.ledgerAccount.findMany({
      include: {
        accountGroup: {
          include: { accountClass: true },
        },
        cashBankAccounts: true,
      },
      orderBy: { code: "asc" },
    });
  }

  async create(dto: CreateLedgerAccountDto) {
    await this.ensureAccountGroupExists(dto.accountGroupId);

    try {
      return await this.prisma.ledgerAccount.create({
        data: dto,
        include: {
          accountGroup: {
            include: { accountClass: true },
          },
        },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Ledger account code already exists.");
    }
  }

  async update(id: string, dto: UpdateLedgerAccountDto) {
    await this.ensureExists(id);

    if (dto.accountGroupId) {
      await this.ensureAccountGroupExists(dto.accountGroupId);
    }

    if (dto.isCashBank === false) {
      const linkedCashBankAccount = await this.prisma.cashBankAccount.findUnique({
        select: { id: true },
        where: { ledgerAccountId: id },
      });

      if (linkedCashBankAccount) {
        throw new BadRequestException(
          "Cannot unset isCashBank while a cash/bank account is linked.",
        );
      }
    }

    try {
      return await this.prisma.ledgerAccount.update({
        data: dto,
        include: {
          accountGroup: {
            include: { accountClass: true },
          },
          cashBankAccounts: true,
        },
        where: { id },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(error, "Ledger account code already exists.");
    }
  }

  private async ensureExists(id: string) {
    const ledgerAccount = await this.prisma.ledgerAccount.findUnique({
      select: { id: true },
      where: { id },
    });

    if (!ledgerAccount) {
      throw new NotFoundException("Ledger account was not found.");
    }
  }

  private async ensureAccountGroupExists(accountGroupId: string) {
    const accountGroup = await this.prisma.accountGroup.findUnique({
      select: { id: true },
      where: { id: accountGroupId },
    });

    if (!accountGroup) {
      throw new NotFoundException("Account group was not found.");
    }
  }
}
