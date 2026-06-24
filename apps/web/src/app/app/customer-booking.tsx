"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  ApiError,
  toErrorMessage,
  type BookableItem,
  type BookableItemCategory,
  type BookableItemStatus,
  type BookingAdministrativeStatus,
  type BookingFinancialStatus,
  type Customer,
  type CustomerType,
  type Project,
  type Voucher,
} from "@/lib/api";
import { Notice } from "./_components/ui";

export const CUSTOMER_TYPE_OPTIONS: { value: CustomerType; label: string }[] = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "COMPANY", label: "Business" },
  { value: "OTHER", label: "Other" },
];

export const BOOKABLE_ITEM_CATEGORY_OPTIONS: {
  value: BookableItemCategory;
  label: string;
}[] = [
  { value: "LAND", label: "Land" },
  { value: "PLOT", label: "Plot" },
  { value: "FLAT", label: "Flat" },
  { value: "UNIT", label: "Unit" },
  { value: "SHARE", label: "Share" },
  { value: "OTHER", label: "Other" },
];

export const BOOKABLE_ITEM_STATUS_OPTIONS: {
  value: BookableItemStatus;
  label: string;
}[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "HOLD", label: "Hold" },
  { value: "BOOKED", label: "Booked" },
  { value: "SOLD", label: "Sold" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const BOOKABLE_ITEM_EDITABLE_STATUS_OPTIONS: {
  value: BookableItemStatus;
  label: string;
}[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "HOLD", label: "Hold" },
  { value: "SOLD", label: "Sold" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const BOOKING_ADMIN_STATUS_OPTIONS: {
  value: BookingAdministrativeStatus;
  label: string;
}[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "HOLD", label: "Hold" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

export const BOOKING_CREATE_STATUS_OPTIONS: {
  value: BookingAdministrativeStatus;
  label: string;
}[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "HOLD", label: "Hold" },
];

export function formatMoney(value: string | number | null | undefined): string {
  const numeric =
    typeof value === "number"
      ? value
      : value === null || value === undefined || value === ""
        ? 0
        : Number(value);

  const safe = Number.isFinite(numeric) ? numeric : 0;

  return `BDT ${safe.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
}

export function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function nullableOptionalString(value: string): string | null | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function moneyInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function parseMoneyInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function normalizeDateInput(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export function customerTypeLabel(value: CustomerType | null | undefined): string {
  return (
    CUSTOMER_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    value ??
    "-"
  );
}

export function bookableItemCategoryLabel(
  value: BookableItemCategory | null | undefined,
): string {
  return (
    BOOKABLE_ITEM_CATEGORY_OPTIONS.find((option) => option.value === value)
      ?.label ?? value ?? "-"
  );
}

export function bookableItemStatusLabel(
  value: BookableItemStatus | null | undefined,
): string {
  return (
    BOOKABLE_ITEM_STATUS_OPTIONS.find((option) => option.value === value)?.label ??
    value ??
    "-"
  );
}

export function bookingAdministrativeStatusLabel(
  value: BookingAdministrativeStatus | null | undefined,
): string {
  return (
    BOOKING_ADMIN_STATUS_OPTIONS.find((option) => option.value === value)?.label ??
    value ??
    "-"
  );
}

export function bookingFinancialStatusLabel(
  value: BookingFinancialStatus | null | undefined,
): string {
  switch (value) {
    case "UNPAID":
      return "Unpaid";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "FULLY_PAID":
      return "Fully paid";
    case "OVERDUE":
      return "Overdue";
    default:
      return value ?? "-";
  }
}

export function badgeToneForActive(isActive: boolean) {
  return isActive ? "active" : "inactive";
}

export function badgeToneForBookableStatus(status: BookableItemStatus) {
  if (status === "AVAILABLE") {
    return "active" as const;
  }

  if (status === "BOOKED" || status === "HOLD") {
    return "closed" as const;
  }

  return "inactive" as const;
}

export function badgeToneForBookingAdministrativeStatus(
  status: BookingAdministrativeStatus,
) {
  if (status === "ACTIVE") {
    return "active" as const;
  }

  if (status === "DRAFT" || status === "HOLD") {
    return "closed" as const;
  }

  return "inactive" as const;
}

export function badgeToneForBookingFinancialStatus(status: BookingFinancialStatus) {
  if (status === "FULLY_PAID") {
    return "active" as const;
  }

  if (status === "OVERDUE") {
    return "closed" as const;
  }

  return "neutral" as const;
}

export function badgeToneForVoucherStatus(status: string | null | undefined) {
  if (status === "POSTED") {
    return "active" as const;
  }

  if (status === "DRAFT") {
    return "closed" as const;
  }

  return "neutral" as const;
}

export function projectLabel(project: Project | null | undefined): string {
  if (!project) {
    return "-";
  }

  return `${project.code} - ${project.name}`;
}

export function customerLabel(customer: Customer | null | undefined): string {
  if (!customer) {
    return "-";
  }

  return `${customer.customerCode} - ${customer.name}`;
}

export function bookableItemLabel(item: BookableItem | null | undefined): string {
  if (!item) {
    return "-";
  }

  return `${item.itemCode} - ${item.itemIdentifier}`;
}

export function fieldError(errors: Record<string, string>, key: string): string | null {
  return errors[key] ?? null;
}

export function validateEmail(value: string): boolean {
  if (!value.trim()) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function findVoucherReference(voucher: Voucher | undefined): string {
  return voucher?.systemVoucherNo ?? "-";
}

export function isReceiptVoucher(voucher: Voucher): boolean {
  return voucher.voucherType === "RECEIPT";
}

export function useAuthorizedLoad() {
  const router = useRouter();

  function handleAuthError(error: unknown): string {
    if (error instanceof ApiError && error.isUnauthorized) {
      router.replace("/login");
      return "Authentication required.";
    }

    return toErrorMessage(error);
  }

  return { handleAuthError, router };
}

export function SectionNotice({ children }: { children: ReactNode }) {
  return <Notice tone="info">{children}</Notice>;
}

export function FieldErrorText({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}
