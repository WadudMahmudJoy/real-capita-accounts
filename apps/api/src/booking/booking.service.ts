import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  BookingAdministrativeStatus,
  BookableItemStatus,
  Prisma,
  VoucherStatus,
  VoucherType,
} from "../generated/prisma/client";
import { parseIsoDate } from "../common/date-rules";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBookingDto, type BookingInstallmentDto } from "./dto/create-booking.dto";
import { CreateReceiptAllocationDto } from "./dto/create-receipt-allocation.dto";
import { ListBookingsQueryDto } from "./dto/list-bookings-query.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";

const BOOKING_NUMBER_PAD_WIDTH = 5;
const ITEM_RELEASE_STATUSES: BookingAdministrativeStatus[] = [
  BookingAdministrativeStatus.CANCELLED,
  BookingAdministrativeStatus.REFUNDED,
];

type BookingSummary = {
  totalReceivable: string;
  totalCollected: string;
  totalDue: string;
  overdueAmount: string;
  overdueInstallmentCount: number;
  nextInstallmentDate: Date | null;
  financialStatus: "UNPAID" | "PARTIALLY_PAID" | "FULLY_PAID" | "OVERDUE";
};

type ReceiptAllocationForNetting = {
  amount: Prisma.Decimal;
  voucher: {
    status: VoucherStatus;
    reversalOfVoucherId: string | null;
    reversedBy?: { status: VoucherStatus; isDeleted: boolean } | null;
  };
};

@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListBookingsQueryDto) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        ...(query.includeDeleted ? {} : { isDeleted: false }),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.bookableItemId ? { bookableItemId: query.bookableItemId } : {}),
        ...(query.administrativeStatus
          ? { administrativeStatus: query.administrativeStatus }
          : {}),
        ...(query.search
          ? {
              OR: [
                { bookingNumber: { contains: query.search, mode: "insensitive" } },
                { customer: { name: { contains: query.search, mode: "insensitive" } } },
                { customer: { customerCode: { contains: query.search, mode: "insensitive" } } },
                { bookableItem: { itemCode: { contains: query.search, mode: "insensitive" } } },
                { bookableItem: { itemIdentifier: { contains: query.search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: this.bookingInclude(),
      orderBy: [{ bookingDate: "desc" }, { bookingNumber: "desc" }],
    });

    return Promise.all(bookings.map((booking) => this.withSummary(booking)));
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, isDeleted: false },
      include: this.bookingInclude(),
    });

    if (!booking) {
      throw new NotFoundException("Booking was not found.");
    }

    return this.withSummary(booking);
  }

  async create(dto: CreateBookingDto) {
    const bookingDate = parseIsoDate(dto.bookingDate, "bookingDate");
    const totalAgreedPrice = new Prisma.Decimal(dto.totalAgreedPrice);
    const discountAmount = new Prisma.Decimal(dto.discountAmount ?? 0);
    const bookingMoney =
      dto.bookingMoney === undefined ? null : new Prisma.Decimal(dto.bookingMoney);
    const netBookingValue = this.calculateNetBookingValue(
      totalAgreedPrice,
      discountAmount,
    );

    await this.validateBookingReferences({
      bookableItemId: dto.bookableItemId,
      customerId: dto.customerId,
      projectId: dto.projectId,
    });
    await this.validateBookableItemAvailable(dto.bookableItemId);
    this.validateBookingAmounts({ bookingMoney, discountAmount, netBookingValue, totalAgreedPrice });
    this.validateInstallments(dto.installments, netBookingValue);

    try {
      const createdId = await this.prisma.$transaction(async (tx) => {
        const bookingNumber = await this.reserveBookingNumber(tx);
        const booking = await tx.booking.create({
          data: {
            bookingNumber,
            customerId: dto.customerId,
            projectId: dto.projectId,
            bookableItemId: dto.bookableItemId,
            bookingDate,
            totalAgreedPrice,
            discountAmount,
            netBookingValue,
            bookingMoney,
            remarks: cleanOptionalText(dto.remarks),
            installments: dto.installments
              ? { create: this.buildInstallmentData(dto.installments) }
              : undefined,
          },
        });

        await tx.bookableItem.update({
          data: { status: BookableItemStatus.BOOKED },
          where: { id: dto.bookableItemId },
        });

        return booking.id;
      });

      return this.findOne(createdId);
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Booking number or installment number already exists.",
      );
    }
  }

  async update(id: string, dto: UpdateBookingDto) {
    const existing = await this.ensureBookingExists(id);
    const targetCustomerId = dto.customerId ?? existing.customerId;
    const targetProjectId = dto.projectId ?? existing.projectId;
    const targetBookableItemId = dto.bookableItemId ?? existing.bookableItemId;
    const totalAgreedPrice =
      dto.totalAgreedPrice === undefined
        ? existing.totalAgreedPrice
        : new Prisma.Decimal(dto.totalAgreedPrice);
    const discountAmount =
      dto.discountAmount === undefined
        ? existing.discountAmount
        : new Prisma.Decimal(dto.discountAmount);
    const bookingMoney =
      dto.bookingMoney === undefined
        ? existing.bookingMoney
        : dto.bookingMoney === null
          ? null
          : new Prisma.Decimal(dto.bookingMoney);
    const netBookingValue = this.calculateNetBookingValue(
      totalAgreedPrice,
      discountAmount,
    );

    if (dto.customerId || dto.projectId || dto.bookableItemId) {
      await this.validateBookingReferences({
        bookableItemId: targetBookableItemId,
        customerId: targetCustomerId,
        projectId: targetProjectId,
      });
    }

    if (dto.bookableItemId && dto.bookableItemId !== existing.bookableItemId) {
      await this.validateBookableItemAvailable(dto.bookableItemId);
    }

    if (dto.administrativeStatus) {
      this.validateBookingStatusTransition(existing, dto.administrativeStatus);
    }

    await this.validateBookingUpdateAllowedWithAllocations(existing, dto);

    this.validateBookingAmounts({ bookingMoney, discountAmount, netBookingValue, totalAgreedPrice });
    this.validateInstallments(dto.installments, netBookingValue);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.booking.update({
          data: {
            ...(dto.customerId === undefined ? {} : { customerId: targetCustomerId }),
            ...(dto.projectId === undefined ? {} : { projectId: targetProjectId }),
            ...(dto.bookableItemId === undefined
              ? {}
              : { bookableItemId: targetBookableItemId }),
            ...(dto.bookingDate === undefined
              ? {}
              : { bookingDate: parseIsoDate(dto.bookingDate, "bookingDate") }),
            ...(dto.totalAgreedPrice === undefined
              ? {}
              : { totalAgreedPrice }),
            ...(dto.discountAmount === undefined ? {} : { discountAmount }),
            netBookingValue,
            ...(dto.bookingMoney === undefined ? {} : { bookingMoney }),
            ...(dto.administrativeStatus === undefined
              ? {}
              : { administrativeStatus: dto.administrativeStatus }),
            ...(dto.remarks === undefined
              ? {}
              : { remarks: cleanOptionalText(dto.remarks) }),
          },
          where: { id },
        });

        if (dto.installments) {
          await tx.bookingInstallment.deleteMany({ where: { bookingId: id } });
          await tx.bookingInstallment.createMany({
            data: this.buildInstallmentData(dto.installments).map((installment) => ({
              ...installment,
              bookingId: id,
            })),
          });
        }

        if (
          dto.administrativeStatus &&
          ITEM_RELEASE_STATUSES.includes(dto.administrativeStatus)
        ) {
          await this.releaseBookableItemIfNoOpenBooking(tx, existing.bookableItemId, id);
        }
      });

      return this.findOne(id);
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Booking number or installment number already exists.",
      );
    }
  }

  async findReceiptAllocations(bookingId: string) {
    await this.ensureBookingExists(bookingId);

    return this.prisma.bookingReceiptAllocation.findMany({
      where: { bookingId },
      include: {
        voucher: {
          select: {
            id: true,
            systemVoucherNo: true,
            voucherType: true,
            status: true,
            voucherDate: true,
            postingDate: true,
            reversalOfVoucherId: true,
            reversedBy: {
              select: {
                id: true,
                systemVoucherNo: true,
                status: true,
                isDeleted: true,
              },
            },
          },
        },
      },
      orderBy: [{ allocationDate: "asc" }, { createdAt: "asc" }],
    });
  }

  async createReceiptAllocation(bookingId: string, dto: CreateReceiptAllocationDto) {
    const booking = await this.ensureBookingExists(bookingId);
    const voucher = await this.prisma.voucher.findFirst({
      select: {
        id: true,
        isDeleted: true,
        reversalOfVoucherId: true,
        reversedBy: { select: { status: true, isDeleted: true } },
        status: true,
        voucherType: true,
      },
      where: { id: dto.voucherId, isDeleted: false },
    });

    if (!voucher) {
      throw new NotFoundException("Receipt voucher was not found.");
    }

    if (voucher.voucherType !== VoucherType.RECEIPT) {
      throw new BadRequestException("Only RECEIPT vouchers can be allocated to bookings.");
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.greaterThan(booking.netBookingValue)) {
      throw new BadRequestException(
        "Allocation amount cannot exceed the booking net value.",
      );
    }

    await this.validateAllocationTotalDoesNotExceedNetValue(bookingId, amount, voucher);

    return this.prisma.bookingReceiptAllocation.create({
      data: {
        bookingId,
        voucherId: dto.voucherId,
        amount,
        allocationDate: parseIsoDate(dto.allocationDate, "allocationDate"),
        allocationReference: cleanOptionalText(dto.allocationReference),
        notes: cleanOptionalText(dto.notes),
      },
      include: { booking: true, voucher: true },
    });
  }

  async deleteReceiptAllocation(bookingId: string, allocationId: string) {
    await this.ensureBookingExists(bookingId);
    const allocation = await this.prisma.bookingReceiptAllocation.findFirst({
      where: { id: allocationId, bookingId },
      include: { voucher: true },
    });

    if (!allocation) {
      throw new NotFoundException("Booking receipt allocation was not found.");
    }

    if (allocation.voucher.status === VoucherStatus.POSTED) {
      throw new BadRequestException(
        "Posted receipt allocations cannot be unlinked from bookings.",
      );
    }

    await this.prisma.bookingReceiptAllocation.delete({ where: { id: allocationId } });

    return { id: allocationId, deleted: true };
  }

  private bookingInclude() {
    return {
      bookableItem: { include: { project: true } },
      customer: true,
      installments: { orderBy: { installmentNo: "asc" as const } },
      project: true,
      receiptAllocations: {
        include: {
          voucher: {
            select: {
              id: true,
              systemVoucherNo: true,
              voucherType: true,
              status: true,
              voucherDate: true,
              postingDate: true,
              reversalOfVoucherId: true,
              reversedBy: {
                select: {
                  id: true,
                  systemVoucherNo: true,
                  status: true,
                  isDeleted: true,
                },
              },
            },
          },
        },
        orderBy: { allocationDate: "asc" as const },
      },
    };
  }

  private async withSummary<T extends { id: string }>(booking: T): Promise<T & { summary: BookingSummary }> {
    const summary = await this.calculateSummary(booking.id);
    return { ...booking, summary };
  }

  private async calculateSummary(bookingId: string): Promise<BookingSummary> {
    const booking = await this.prisma.booking.findUnique({
      include: {
        installments: { orderBy: { dueDate: "asc" } },
      receiptAllocations: {
        include: {
          voucher: {
            include: {
              reversedBy: true,
            },
          },
        },
      },
      },
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException("Booking was not found.");
    }

    const totalReceivable =
      booking.administrativeStatus === BookingAdministrativeStatus.ACTIVE
        ? booking.netBookingValue
        : new Prisma.Decimal(0);
    const totalCollected = this.calculateEffectiveAllocatedTotal(booking.receiptAllocations);

    const totalDue = Prisma.Decimal.max(totalReceivable.minus(totalCollected), new Prisma.Decimal(0));
    const today = startOfDay(new Date());
    const paidForSchedule = totalCollected;
    let remainingPaid = paidForSchedule;
    let overdueAmount = new Prisma.Decimal(0);
    let overdueInstallmentCount = 0;
    let nextInstallmentDate: Date | null = null;

    for (const installment of booking.installments) {
      const paidToInstallment = Prisma.Decimal.min(remainingPaid, installment.amount);
      const installmentDue = installment.amount.minus(paidToInstallment);
      remainingPaid = Prisma.Decimal.max(remainingPaid.minus(installment.amount), new Prisma.Decimal(0));

      if (installmentDue.greaterThan(0)) {
        if (!nextInstallmentDate) {
          nextInstallmentDate = installment.dueDate;
        }

        if (startOfDay(installment.dueDate) < today) {
          overdueAmount = overdueAmount.plus(installmentDue);
          overdueInstallmentCount += 1;
        }
      }
    }

    let financialStatus: BookingSummary["financialStatus"] = "UNPAID";
    if (overdueAmount.greaterThan(0)) {
      financialStatus = "OVERDUE";
    } else if (totalCollected.greaterThanOrEqualTo(totalReceivable) && totalReceivable.greaterThan(0)) {
      financialStatus = "FULLY_PAID";
    } else if (totalCollected.greaterThan(0)) {
      financialStatus = "PARTIALLY_PAID";
    }

    return {
      totalReceivable: totalReceivable.toFixed(2),
      totalCollected: totalCollected.toFixed(2),
      totalDue: totalDue.toFixed(2),
      overdueAmount: overdueAmount.toFixed(2),
      overdueInstallmentCount,
      nextInstallmentDate,
      financialStatus,
    };
  }

  private async ensureBookingExists(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, isDeleted: false },
    });

    if (!booking) {
      throw new NotFoundException("Booking was not found.");
    }

    return booking;
  }

  private async validateAllocationTotalDoesNotExceedNetValue(
    bookingId: string,
    nextAmount: Prisma.Decimal,
    nextVoucher: {
      status: VoucherStatus;
      reversalOfVoucherId: string | null;
      reversedBy?: { status: VoucherStatus; isDeleted: boolean } | null;
    },
  ) {
    const booking = await this.prisma.booking.findUnique({
      select: {
        netBookingValue: true,
        receiptAllocations: {
          select: {
            amount: true,
            voucher: {
              select: {
                status: true,
                reversalOfVoucherId: true,
                reversedBy: { select: { status: true, isDeleted: true } },
              },
            },
          },
        },
      },
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException("Booking was not found.");
    }

    const existingTotal = this.calculateEffectiveAllocatedTotal(booking.receiptAllocations);
    const nextEffectiveAmount = this.getEffectiveAllocationAmount({
      amount: nextAmount,
      voucher: nextVoucher,
    });

    if (existingTotal.plus(nextEffectiveAmount).greaterThan(booking.netBookingValue)) {
      throw new BadRequestException(
        "Total effective posted receipt allocations cannot exceed the booking net value.",
      );
    }
  }

  private calculateEffectiveAllocatedTotal(
    allocations: ReceiptAllocationForNetting[],
  ): Prisma.Decimal {
    return allocations.reduce(
      (total, allocation) => total.plus(this.getEffectiveAllocationAmount(allocation)),
      new Prisma.Decimal(0),
    );
  }

  private getEffectiveAllocationAmount(allocation: ReceiptAllocationForNetting): Prisma.Decimal {
    if (allocation.voucher.status !== VoucherStatus.POSTED) {
      return new Prisma.Decimal(0);
    }

    if (allocation.voucher.reversalOfVoucherId) {
      return allocation.amount.negated();
    }

    if (
      allocation.voucher.reversedBy?.status === VoucherStatus.POSTED &&
      !allocation.voucher.reversedBy.isDeleted
    ) {
      return new Prisma.Decimal(0);
    }

    return allocation.amount;
  }

  private async validateBookingUpdateAllowedWithAllocations(
    existing: {
      id: string;
      customerId: string;
      projectId: string;
      bookableItemId: string;
      bookingDate: Date;
      totalAgreedPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      bookingMoney: Prisma.Decimal | null;
    },
    dto: UpdateBookingDto,
  ) {
    const allocations = await this.prisma.bookingReceiptAllocation.findMany({
      select: { voucher: { select: { status: true } } },
      where: { bookingId: existing.id },
    });

    if (!allocations.length) return;

    const materialChanges = [
      dto.customerId !== undefined && dto.customerId !== existing.customerId,
      dto.projectId !== undefined && dto.projectId !== existing.projectId,
      dto.bookableItemId !== undefined && dto.bookableItemId !== existing.bookableItemId,
      dto.bookingDate !== undefined &&
        parseIsoDate(dto.bookingDate, "bookingDate").getTime() !== existing.bookingDate.getTime(),
      dto.totalAgreedPrice !== undefined &&
        !new Prisma.Decimal(dto.totalAgreedPrice).equals(existing.totalAgreedPrice),
      dto.discountAmount !== undefined &&
        !new Prisma.Decimal(dto.discountAmount).equals(existing.discountAmount),
      dto.bookingMoney !== undefined &&
        !decimalNullableEquals(
          dto.bookingMoney === null ? null : new Prisma.Decimal(dto.bookingMoney),
          existing.bookingMoney,
        ),
      dto.installments !== undefined,
    ];

    if (materialChanges.some(Boolean)) {
      throw new BadRequestException(
        "Booking has receipt allocations. Customer, project, item, date, value, booking money, and installment schedule cannot be changed.",
      );
    }

    const hasPostedAllocation = allocations.some(
      (allocation) => allocation.voucher.status === VoucherStatus.POSTED,
    );

    if (
      hasPostedAllocation &&
      dto.administrativeStatus &&
      ITEM_RELEASE_STATUSES.includes(dto.administrativeStatus)
    ) {
      throw new BadRequestException(
        "Booking with posted receipt allocations cannot be cancelled or refunded in Phase 2M-2.",
      );
    }
  }

  private async releaseBookableItemIfNoOpenBooking(
    tx: Prisma.TransactionClient,
    bookableItemId: string,
    currentBookingId: string,
  ) {
    const openBooking = await tx.booking.findFirst({
      select: { id: true },
      where: {
        id: { not: currentBookingId },
        bookableItemId,
        isDeleted: false,
        administrativeStatus: {
          in: [
            BookingAdministrativeStatus.DRAFT,
            BookingAdministrativeStatus.ACTIVE,
            BookingAdministrativeStatus.HOLD,
          ],
        },
      },
    });

    if (openBooking) return;

    await tx.bookableItem.update({
      data: { status: BookableItemStatus.AVAILABLE },
      where: { id: bookableItemId },
    });
  }

  private async validateBookingReferences(input: {
    bookableItemId: string;
    customerId: string;
    projectId: string;
  }) {
    const [customer, project, item] = await Promise.all([
      this.prisma.customer.findFirst({
        select: { id: true, isActive: true },
        where: { id: input.customerId, isDeleted: false },
      }),
      this.prisma.project.findUnique({
        select: { id: true, isActive: true },
        where: { id: input.projectId },
      }),
      this.prisma.bookableItem.findFirst({
        select: { id: true, projectId: true, status: true },
        where: { id: input.bookableItemId, isDeleted: false },
      }),
    ]);

    if (!customer) {
      throw new NotFoundException("Customer was not found.");
    }

    if (!customer.isActive) {
      throw new BadRequestException("Customer must be active before creating bookings.");
    }

    if (!project) {
      throw new NotFoundException("Project was not found.");
    }

    if (!project.isActive) {
      throw new BadRequestException("Project must be active before creating bookings.");
    }

    if (!item) {
      throw new NotFoundException("Bookable item was not found.");
    }

    if (item.projectId !== input.projectId) {
      throw new BadRequestException("Bookable item must belong to the selected project.");
    }
  }

  private async validateBookableItemAvailable(bookableItemId: string) {
    const item = await this.prisma.bookableItem.findFirst({
      select: { id: true, status: true },
      where: { id: bookableItemId, isDeleted: false },
    });

    if (!item) {
      throw new NotFoundException("Bookable item was not found.");
    }

    const bookableStatuses: BookableItemStatus[] = [
      BookableItemStatus.AVAILABLE,
      BookableItemStatus.HOLD,
    ];

    if (!bookableStatuses.includes(item.status)) {
      throw new BadRequestException(
        "Only available or held bookable items can be booked.",
      );
    }

    const activeBooking = await this.prisma.booking.findFirst({
      select: { id: true },
      where: {
        bookableItemId,
        isDeleted: false,
        administrativeStatus: { in: ["DRAFT", "ACTIVE", "HOLD"] },
      },
    });

    if (activeBooking) {
      throw new BadRequestException(
        "This bookable item already has an active, held, or draft booking.",
      );
    }
  }

  private validateBookingStatusTransition(
    existing: { administrativeStatus: BookingAdministrativeStatus },
    target: BookingAdministrativeStatus,
  ) {
    if (existing.administrativeStatus === target) return;

    const allowed: Record<BookingAdministrativeStatus, BookingAdministrativeStatus[]> = {
      DRAFT: ["ACTIVE", "HOLD", "CANCELLED"],
      ACTIVE: ["HOLD", "CANCELLED", "REFUNDED"],
      HOLD: ["ACTIVE", "CANCELLED"],
      CANCELLED: ["REFUNDED"],
      REFUNDED: [],
    };

    if (!allowed[existing.administrativeStatus].includes(target)) {
      throw new BadRequestException(
        `Booking status cannot change from ${existing.administrativeStatus} to ${target}.`,
      );
    }
  }

  private validateBookingAmounts(input: {
    bookingMoney: Prisma.Decimal | null;
    discountAmount: Prisma.Decimal;
    netBookingValue: Prisma.Decimal;
    totalAgreedPrice: Prisma.Decimal;
  }) {
    if (input.discountAmount.greaterThan(input.totalAgreedPrice)) {
      throw new BadRequestException("Discount cannot exceed total agreed price.");
    }

    if (input.netBookingValue.lessThanOrEqualTo(0)) {
      throw new BadRequestException("Net booking value must be greater than zero.");
    }

    if (input.bookingMoney && input.bookingMoney.greaterThan(input.netBookingValue)) {
      throw new BadRequestException("Booking money cannot exceed net booking value.");
    }
  }

  private validateInstallments(
    installments: BookingInstallmentDto[] | undefined,
    netBookingValue: Prisma.Decimal,
  ) {
    if (!installments?.length) return;

    const installmentNumbers = new Set<number>();
    let total = new Prisma.Decimal(0);

    for (const installment of installments) {
      if (installmentNumbers.has(installment.installmentNo)) {
        throw new BadRequestException("Installment numbers must be unique per booking.");
      }
      installmentNumbers.add(installment.installmentNo);
      total = total.plus(installment.amount);
    }

    if (total.greaterThan(netBookingValue)) {
      throw new BadRequestException(
        "Total installment amount cannot exceed net booking value.",
      );
    }
  }

  private calculateNetBookingValue(
    totalAgreedPrice: Prisma.Decimal,
    discountAmount: Prisma.Decimal,
  ) {
    return totalAgreedPrice.minus(discountAmount);
  }

  private buildInstallmentData(installments: BookingInstallmentDto[]) {
    return installments.map((installment) => ({
      installmentNo: installment.installmentNo,
      dueDate: parseIsoDate(installment.dueDate, "installment dueDate"),
      amount: new Prisma.Decimal(installment.amount),
      description: cleanOptionalText(installment.description),
    }));
  }

  private async reserveBookingNumber(tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.booking.findFirst({
      orderBy: { bookingNumber: "desc" },
      select: { bookingNumber: true },
      where: { bookingNumber: { startsWith: "BOOK-" } },
    });

    const nextNumber = latest
      ? Number(latest.bookingNumber.replace("BOOK-", "")) + 1
      : 1;

    return `BOOK-${String(nextNumber).padStart(BOOKING_NUMBER_PAD_WIDTH, "0")}`;
  }
}

function cleanOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function decimalNullableEquals(
  left: Prisma.Decimal | null,
  right: Prisma.Decimal | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.equals(right);
}
