import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import {
  CashBankAccountType,
  MfsProvider,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCashBankAccountDto } from "./dto/create-cash-bank-account.dto";
import { UpdateCashBankAccountDto } from "./dto/update-cash-bank-account.dto";

type ExistingCashBankAccount = {
  id: string;
  ledgerAccountId: string;
  displayName: string;
  accountType: CashBankAccountType;
  bankName: string | null;
  branch: string | null;
  accountNumber: string | null;
  provider: MfsProvider | null;
  providerOtherName: string | null;
  walletNumber: string | null;
  accountHolderName: string | null;
  isActive: boolean;
};

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
    await this.ensureCashBankLedgerAccount(dto.ledgerAccountId, dto.accountType);
    const data = this.buildCreateData(dto);

    try {
      return await this.prisma.cashBankAccount.create({
        data,
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
    const existing = await this.ensureExists(id);
    const targetAccountType = dto.accountType ?? existing.accountType;
    const targetLedgerAccountId = dto.ledgerAccountId ?? existing.ledgerAccountId;

    if (
      dto.ledgerAccountId ||
      (targetAccountType === CashBankAccountType.MFS &&
        existing.accountType !== CashBankAccountType.MFS)
    ) {
      await this.ensureCashBankLedgerAccount(
        targetLedgerAccountId,
        targetAccountType,
      );
    }

    const data = this.buildUpdateData(existing, dto, targetAccountType);

    try {
      return await this.prisma.cashBankAccount.update({
        data,
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

  private async ensureExists(id: string): Promise<ExistingCashBankAccount> {
    const cashBankAccount = await this.prisma.cashBankAccount.findUnique({
      select: {
        accountHolderName: true,
        accountNumber: true,
        accountType: true,
        bankName: true,
        branch: true,
        displayName: true,
        id: true,
        isActive: true,
        ledgerAccountId: true,
        provider: true,
        providerOtherName: true,
        walletNumber: true,
      },
      where: { id },
    });

    if (!cashBankAccount) {
      throw new NotFoundException("Cash/bank account was not found.");
    }

    return cashBankAccount;
  }

  private buildCreateData(dto: CreateCashBankAccountDto) {
    const metadata = this.normalizeMetadata({
      accountHolderName: dto.accountHolderName,
      accountNumber: dto.accountNumber,
      accountType: dto.accountType,
      bankName: dto.bankName,
      branch: dto.branch,
      provider: dto.provider ?? null,
      providerOtherName: dto.providerOtherName,
      walletNumber: dto.walletNumber,
    });

    return {
      accountType: dto.accountType,
      displayName: dto.displayName,
      isActive: dto.isActive,
      ledgerAccountId: dto.ledgerAccountId,
      ...metadata,
    };
  }

  private buildUpdateData(
    existing: ExistingCashBankAccount,
    dto: UpdateCashBankAccountDto,
    accountType: CashBankAccountType,
  ) {
    const metadata = this.normalizeMetadata({
      accountHolderName: this.getEffectiveTextValue(
        dto,
        "accountHolderName",
        existing.accountHolderName,
      ),
      accountNumber: this.getEffectiveTextValue(
        dto,
        "accountNumber",
        existing.accountNumber,
      ),
      accountType,
      bankName: this.getEffectiveTextValue(dto, "bankName", existing.bankName),
      branch: this.getEffectiveTextValue(dto, "branch", existing.branch),
      provider: this.hasDefinedField(dto, "provider")
        ? dto.provider ?? null
        : existing.provider,
      providerOtherName: this.getEffectiveTextValue(
        dto,
        "providerOtherName",
        existing.providerOtherName,
      ),
      walletNumber: this.getEffectiveTextValue(
        dto,
        "walletNumber",
        existing.walletNumber,
      ),
    });

    return {
      accountType,
      displayName: dto.displayName ?? existing.displayName,
      isActive: dto.isActive ?? existing.isActive,
      ledgerAccountId: dto.ledgerAccountId ?? existing.ledgerAccountId,
      ...metadata,
    };
  }

  private normalizeMetadata(input: {
    accountHolderName: string | null | undefined;
    accountNumber: string | null | undefined;
    accountType: CashBankAccountType;
    bankName: string | null | undefined;
    branch: string | null | undefined;
    provider: MfsProvider | null;
    providerOtherName: string | null | undefined;
    walletNumber: string | null | undefined;
  }) {
    if (input.accountType === CashBankAccountType.MFS) {
      const walletNumber = this.cleanOptionalText(input.walletNumber);
      const providerOtherName = this.cleanOptionalText(input.providerOtherName);

      if (!input.provider) {
        throw new BadRequestException("MFS provider is required.");
      }

      if (!walletNumber) {
        throw new BadRequestException("MFS wallet number is required.");
      }

      if (input.provider === MfsProvider.OTHER && !providerOtherName) {
        throw new BadRequestException(
          "MFS providerOtherName is required when provider is OTHER.",
        );
      }

      return {
        accountHolderName: this.cleanOptionalText(input.accountHolderName),
        accountNumber: null,
        bankName: null,
        branch: null,
        provider: input.provider,
        providerOtherName:
          input.provider === MfsProvider.OTHER ? providerOtherName : null,
        walletNumber,
      };
    }

    // CASH and BANK remain valid without MFS metadata; stale MFS-only fields are cleared.
    return {
      accountHolderName: null,
      accountNumber: this.cleanOptionalText(input.accountNumber),
      bankName: this.cleanOptionalText(input.bankName),
      branch: this.cleanOptionalText(input.branch),
      provider: null,
      providerOtherName: null,
      walletNumber: null,
    };
  }

  private getEffectiveTextValue(
    dto: UpdateCashBankAccountDto,
    field:
      | "accountHolderName"
      | "accountNumber"
      | "bankName"
      | "branch"
      | "providerOtherName"
      | "walletNumber",
    existingValue: string | null,
  ): string | null | undefined {
    return this.hasDefinedField(dto, field) ? dto[field] : existingValue;
  }

  private cleanOptionalText(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private hasDefinedField(object: object, field: string): boolean {
    return (object as Record<string, unknown>)[field] !== undefined;
  }

  private async ensureCashBankLedgerAccount(
    ledgerAccountId: string,
    accountType: CashBankAccountType,
  ) {
    const ledgerAccount = await this.prisma.ledgerAccount.findUnique({
      select: { id: true, isActive: true, isCashBank: true },
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

    if (accountType === CashBankAccountType.MFS && !ledgerAccount.isActive) {
      throw new BadRequestException(
        "MFS accounts must be linked to an active cash/bank ledger account.",
      );
    }
  }
}
