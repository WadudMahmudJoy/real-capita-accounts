import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  BookableItemStatus,
  Prisma,
} from "../generated/prisma/client";
import { throwConflictOnUniqueConstraint } from "../common/prisma-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBookableItemDto } from "./dto/create-bookable-item.dto";
import { ListBookableItemsQueryDto } from "./dto/list-bookable-items-query.dto";
import { UpdateBookableItemDto } from "./dto/update-bookable-item.dto";

const ITEM_CODE_PAD_WIDTH = 5;

@Injectable()
export class BookableItemService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ListBookableItemsQueryDto) {
    return this.prisma.bookableItem.findMany({
      where: {
        ...(query.includeDeleted ? {} : { isDeleted: false }),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { itemCode: { contains: query.search, mode: "insensitive" } },
                { itemIdentifier: { contains: query.search, mode: "insensitive" } },
                { block: { contains: query.search, mode: "insensitive" } },
                { zone: { contains: query.search, mode: "insensitive" } },
                { phase: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { project: true, _count: { select: { bookings: true } } },
      orderBy: [{ project: { code: "asc" } }, { itemCode: "asc" }],
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.bookableItem.findFirst({
      where: { id, isDeleted: false },
      include: { project: true, bookings: true },
    });

    if (!item) {
      throw new NotFoundException("Bookable item was not found.");
    }

    return item;
  }

  async create(dto: CreateBookableItemDto) {
    await this.ensureActiveProject(dto.projectId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const itemCode = await this.reserveItemCode(tx);

        return tx.bookableItem.create({
          data: {
            itemCode,
            projectId: dto.projectId,
            category: dto.category,
            itemIdentifier: dto.itemIdentifier,
            block: cleanOptionalText(dto.block),
            zone: cleanOptionalText(dto.zone),
            phase: cleanOptionalText(dto.phase),
            sizeOrArea: cleanOptionalText(dto.sizeOrArea),
            shareQuantity:
              dto.shareQuantity === undefined
                ? null
                : new Prisma.Decimal(dto.shareQuantity),
            basePrice: new Prisma.Decimal(dto.basePrice),
            status: dto.status ?? BookableItemStatus.AVAILABLE,
            notes: cleanOptionalText(dto.notes),
          },
          include: { project: true },
        });
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Bookable item code or project/category/item identifier already exists.",
      );
    }
  }

  async update(id: string, dto: UpdateBookableItemDto) {
    const existing = await this.ensureExists(id);
    const targetProjectId = dto.projectId ?? existing.projectId;

    if (dto.projectId) {
      await this.ensureActiveProject(dto.projectId);
    }

    if (dto.status && dto.status !== existing.status) {
      await this.validateStatusChange(id, dto.status);
    }

    try {
      return await this.prisma.bookableItem.update({
        data: {
          ...(dto.projectId === undefined ? {} : { projectId: targetProjectId }),
          ...(dto.category === undefined ? {} : { category: dto.category }),
          ...(dto.itemIdentifier === undefined
            ? {}
            : { itemIdentifier: dto.itemIdentifier }),
          ...(dto.block === undefined ? {} : { block: cleanOptionalText(dto.block) }),
          ...(dto.zone === undefined ? {} : { zone: cleanOptionalText(dto.zone) }),
          ...(dto.phase === undefined ? {} : { phase: cleanOptionalText(dto.phase) }),
          ...(dto.sizeOrArea === undefined
            ? {}
            : { sizeOrArea: cleanOptionalText(dto.sizeOrArea) }),
          ...(dto.shareQuantity === undefined
            ? {}
            : {
                shareQuantity:
                  dto.shareQuantity === null
                    ? null
                    : new Prisma.Decimal(dto.shareQuantity),
              }),
          ...(dto.basePrice === undefined
            ? {}
            : { basePrice: new Prisma.Decimal(dto.basePrice) }),
          ...(dto.status === undefined ? {} : { status: dto.status }),
          ...(dto.notes === undefined ? {} : { notes: cleanOptionalText(dto.notes) }),
        },
        include: { project: true },
        where: { id },
      });
    } catch (error) {
      throwConflictOnUniqueConstraint(
        error,
        "Bookable item code or project/category/item identifier already exists.",
      );
    }
  }

  private async ensureExists(id: string) {
    const item = await this.prisma.bookableItem.findFirst({
      where: { id, isDeleted: false },
    });

    if (!item) {
      throw new NotFoundException("Bookable item was not found.");
    }

    return item;
  }

  private async ensureActiveProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      select: { id: true, isActive: true },
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException("Project was not found.");
    }

    if (!project.isActive) {
      throw new BadRequestException("Project must be active for bookable items.");
    }
  }

  private async validateStatusChange(id: string, status: BookableItemStatus) {
    if (status === BookableItemStatus.AVAILABLE) return;

    if (status === BookableItemStatus.CANCELLED) {
      const activeBooking = await this.prisma.booking.findFirst({
        select: { id: true },
        where: {
          bookableItemId: id,
          isDeleted: false,
          administrativeStatus: { in: ["ACTIVE", "HOLD"] },
        },
      });

      if (activeBooking) {
        throw new BadRequestException(
          "Bookable item with active or held bookings cannot be cancelled.",
        );
      }
    }
  }

  private async reserveItemCode(tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.bookableItem.findFirst({
      orderBy: { itemCode: "desc" },
      select: { itemCode: true },
      where: { itemCode: { startsWith: "ITEM-" } },
    });

    const nextNumber = latest ? Number(latest.itemCode.replace("ITEM-", "")) + 1 : 1;

    return `ITEM-${String(nextNumber).padStart(ITEM_CODE_PAD_WIDTH, "0")}`;
  }
}

function cleanOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}
