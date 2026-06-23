import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

const CUSTOMER_CODE_PAD_WIDTH = 5;

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListCustomersQueryDto) {
    return this.prisma.customer.findMany({
      where: {
        isDeleted: false,
        ...(query.customerType ? { customerType: query.customerType } : {}),
        ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
        ...(query.search
          ? {
              OR: [
                { customerCode: { contains: query.search, mode: "insensitive" } },
                { name: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } },
                { nidOrPassport: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ customerCode: "asc" }],
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, isDeleted: false },
      include: {
        _count: { select: { bookings: true } },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }

    return customer;
  }

  async create(dto: CreateCustomerDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const customerCode = await this.reserveCustomerCode(tx);

        return tx.customer.create({
          data: {
            customerCode,
            customerType: dto.customerType,
            name: dto.name,
            phone: dto.phone,
            email: cleanOptionalText(dto.email),
            nidOrPassport: cleanOptionalText(dto.nidOrPassport),
            address: dto.address,
            professionOrBusiness: cleanOptionalText(dto.professionOrBusiness),
            nomineeOrReference: cleanOptionalText(dto.nomineeOrReference),
            notes: cleanOptionalText(dto.notes),
            isActive: dto.isActive,
          },
        });
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Customer code or NID/passport already exists.",
      );
    }
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.ensureExists(id);

    try {
      return await this.prisma.customer.update({
        data: {
          ...(dto.customerType === undefined ? {} : { customerType: dto.customerType }),
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.phone === undefined ? {} : { phone: dto.phone }),
          ...(dto.email === undefined ? {} : { email: cleanOptionalText(dto.email) }),
          ...(dto.nidOrPassport === undefined
            ? {}
            : { nidOrPassport: cleanOptionalText(dto.nidOrPassport) }),
          ...(dto.address === undefined
            ? {}
            : { address: dto.address }),
          ...(dto.professionOrBusiness === undefined
            ? {}
            : { professionOrBusiness: cleanOptionalText(dto.professionOrBusiness) }),
          ...(dto.nomineeOrReference === undefined
            ? {}
            : { nomineeOrReference: cleanOptionalText(dto.nomineeOrReference) }),
          ...(dto.notes === undefined ? {} : { notes: cleanOptionalText(dto.notes) }),
          ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
        },
        where: { id },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Customer code or NID/passport already exists.",
      );
    }
  }

  private async ensureExists(id: string) {
    const customer = await this.prisma.customer.findFirst({
      select: { id: true },
      where: { id, isDeleted: false },
    });

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }
  }

  private async reserveCustomerCode(tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.customer.findFirst({
      orderBy: { customerCode: "desc" },
      select: { customerCode: true },
      where: { customerCode: { startsWith: "CUST-" } },
    });

    const nextNumber = latest
      ? Number(latest.customerCode.replace("CUST-", "")) + 1
      : 1;

    return `CUST-${String(nextNumber).padStart(CUSTOMER_CODE_PAD_WIDTH, "0")}`;
  }
}

function cleanOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
