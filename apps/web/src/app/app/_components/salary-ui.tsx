"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ApiError, type SalaryConfigurationStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button, StatusBadge } from "./ui";

export function formatSalaryDate(value: string | null | undefined): string {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year}` : value.slice(0, 10);
}

export function formatEffectivePeriod(
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
): string {
  const from = formatSalaryDate(effectiveFrom);
  return effectiveTo
    ? `${from} to before ${formatSalaryDate(effectiveTo)}`
    : `${from} onward`;
}

export function dateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export function formatBdt(value: string | null | undefined): string {
  if (!value) return "BDT 0.00";
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return `BDT ${value}`;
  const [, sign, integer, fraction = ""] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `BDT ${sign}${grouped}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

export function formatPercentage(
  value: string | null | undefined,
  preservePrecision = false,
): string {
  if (!value) return "0%";
  if (preservePrecision) return `${value}%`;
  const trimmed = value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  return `${trimmed}%`;
}

export function percentageToFourPlaces(value: string): string {
  const match = value.trim().match(/^(\d+)(?:\.(\d*))?$/);
  if (!match) return value;
  return `${match[1]}.${(match[2] ?? "").padEnd(4, "0").slice(0, 4)}`;
}

export function policyCashShare(bankPercentage: string): string {
  const parsed = parseUnsignedDecimal(bankPercentage);
  if (!parsed) return "-";
  const hundred = BigInt(100) * BigInt(10) ** BigInt(parsed.scale);
  if (parsed.value > hundred) return "-";
  return formatScaledDecimal(hundred - parsed.value, parsed.scale);
}

export function componentPercentageTotal(values: string[]): string {
  const scale = 4;
  const total = values.reduce((sum, value) => {
    const parsed = parseUnsignedDecimal(value);
    if (!parsed || parsed.scale > scale) return sum;
    return sum + parsed.value * BigInt(10) ** BigInt(scale - parsed.scale);
  }, BigInt(0));
  return formatScaledDecimal(total, scale);
}

export function isDecimalInput(
  value: string,
  maximumFractionDigits: number,
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return new RegExp(`^\\d+(?:\\.\\d{0,${maximumFractionDigits}})?$`).test(
    trimmed,
  );
}

export function isPositiveDecimal(
  value: string,
  maximumFractionDigits: number,
): boolean {
  if (!isDecimalInput(value, maximumFractionDigits)) return false;
  const parsed = parseUnsignedDecimal(value);
  return Boolean(parsed && parsed.value > BigInt(0));
}

export function isPercentage(value: string, maximumFractionDigits = 6): boolean {
  if (!isDecimalInput(value, maximumFractionDigits)) return false;
  const parsed = parseUnsignedDecimal(value);
  if (!parsed) return false;
  return parsed.value <= BigInt(100) * BigInt(10) ** BigInt(parsed.scale);
}

export function isZeroDecimal(value: string): boolean {
  return parseUnsignedDecimal(value)?.value === BigInt(0);
}

export function isStandardBankPercentage(value: string): boolean {
  const parsed = parseUnsignedDecimal(value);
  if (!parsed) return false;
  return parsed.value === BigInt(60) * BigInt(10) ** BigInt(parsed.scale);
}

export function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function maskAccountNumber(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "-";
  const visible = trimmed.slice(-4);
  return `${"*".repeat(Math.max(4, Math.min(8, trimmed.length - visible.length)))}${visible}`;
}

export function salaryStatusBadge(status: SalaryConfigurationStatus) {
  const tone =
    status === "APPROVED"
      ? "active"
      : status === "DRAFT"
        ? "closed"
        : "inactive";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

export function salaryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please sign in again.";
    if (error.status === 403) return "Your account does not have access to Salary configuration.";
    if (error.status >= 500) return "The server could not complete the request. Please try again.";
    return error.message;
  }
  return "The request could not be completed. Please try again.";
}

export function fieldErrorProps(controlId: string, message?: string | null) {
  return message
    ? ({
        "aria-describedby": `${controlId}-error`,
        "aria-invalid": true,
      } as const)
    : {};
}

export function FieldError({
  controlId,
  message,
}: {
  controlId?: string;
  message?: string | null;
}) {
  return message ? (
    <p
      className="text-xs leading-5 text-destructive"
      id={controlId ? `${controlId}-error` : undefined}
      role="alert"
    >
      {message}
    </p>
  ) : null;
}

export function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  children,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (open) return;
    function rememberFocusedElement(event: FocusEvent) {
      if (
        event.target instanceof HTMLElement &&
        !event.target.closest('[role="alertdialog"]')
      ) {
        returnFocusRef.current = event.target;
      }
    }
    document.addEventListener("focusin", rememberFocusedElement);
    return () => document.removeEventListener("focusin", rememberFocusedElement);
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const returnTarget = returnFocusRef.current;
    queueMicrotask(() => {
      if (
        returnTarget?.isConnected &&
        !returnTarget.hasAttribute("disabled") &&
        returnTarget.tabIndex >= 0
      ) {
        returnTarget.focus();
      }
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open, pending]);

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl"
        ref={dialogRef}
        role="alertdialog"
      >
        <h2 className="text-lg font-semibold text-foreground" id={titleId}>
          {title}
        </h2>
        <p
          className="mt-2 text-sm leading-6 text-muted-foreground"
          id={descriptionId}
        >
          {description}
        </p>
        {children ? <div className="mt-5">{children}</div> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button disabled={pending} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button autoFocus disabled={pending} onClick={onConfirm}>
            {pending ? "Working..." : confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

function parseUnsignedDecimal(value: string) {
  const match = value.trim().match(/^(\d+)(?:\.(\d*))?$/);
  if (!match) return null;
  const fraction = match[2] ?? "";
  return {
    scale: fraction.length,
    value: BigInt(`${match[1]}${fraction}`),
  };
}

function formatScaledDecimal(value: bigint, scale: number): string {
  if (scale === 0) return value.toString();
  const digits = value.toString().padStart(scale + 1, "0");
  const integer = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}
