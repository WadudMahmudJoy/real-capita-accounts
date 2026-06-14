import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCashBankAccountDto } from "./dto/create-cash-bank-account.dto";
import { UpdateCashBankAccountDto } from "./dto/update-cash-bank-account.dto";

@Injectable()
export class CashBankService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.cashBankAccount.findMany({
      include: {
        ledgerAccount: {
          include: {
            accountGroup: {
              include: { accountClass: true },
            },
          },
        },
      },
      orderBy: { displayName: "asc" },
    });
  }

  async create(dto: CreateCashBankAccountDto) {
    await this.ensureCashBankLedgerAccount(dto.ledgerAccountId);

    try {
      return await this.prisma.cashBankAccount.create({
        data: dto,
        include: {
          ledgerAccount: {
            include: {
              accountGroup: {
                include: { accountClass: true },
              },
            },
          },
        },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Cash/bank account already exists for this ledger account.",
      );
    }
  }

  async update(id: string, dto: UpdateCashBankAccountDto) {
    await this.ensureExists(id);

    if (dto.ledgerAccountId) {
      await this.ensureCashBankLedgerAccount(dto.ledgerAccountId);
    }

    try {
      return await this.prisma.cashBankAccount.update({
        data: dto,
        include: {
          ledgerAccount: {
            include: {
              accountGroup: {
                include: { accountClass: true },
              },
            },
          },
        },
        where: { id },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Cash/bank account already exists for this ledger account.",
      );
    }
  }

  private async ensureExists(id: string) {
    const cashBankAccount = await this.prisma.cashBankAccount.findUnique({
      select: { id: true },
      where: { id },
    });

    if (!cashBankAccount) {
      throw new NotFoundException("Cash/bank account was not found.");
    }
  }

  private async ensureCashBankLedgerAccount(ledgerAccountId: string) {
    const ledgerAccount = await this.prisma.ledgerAccount.findUnique({
      select: { id: true, isCashBank: true },
      where: { id: ledgerAccountId },
    });

    if (!ledgerAccount) {
      throw new NotFoundException("Ledger account was not found.");
    }

    if (!ledgerAccount.isCashBank) {
      throw new BadRequestException(
        "Linked ledger account must be marked as cash/bank.",
      );
    }
  }
}
