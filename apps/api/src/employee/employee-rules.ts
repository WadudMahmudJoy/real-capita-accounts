import { BadRequestException } from "@nestjs/common";

export const EMPLOYEE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9/_-]{0,31}$/;
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const BANGLADESH_MOBILE_PATTERN = /^\+8801[3-9]\d{8}$/;

export type EmployeeRuleState = {
  joiningDate: Date;
  dateOfBirth: Date | null;
  confirmationDate: Date | null;
  separationDate: Date | null;
  separationReason: string | null;
  mobileNumber: string | null;
  alternateMobileNumber: string | null;
  emergencyContactName: string | null;
  emergencyContactRelationship: string | null;
  emergencyContactMobile: string | null;
  isActive: boolean;
};

export function normalizeBangladeshMobile(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("01")) return `+88${trimmed}`;
  if (trimmed.startsWith("8801")) return `+${trimmed}`;
  return trimmed;
}

export function normalizeOptionalBangladeshMobile(
  value: string | null | undefined,
): string | null {
  if (value == null || value.trim() === "") return null;
  return normalizeBangladeshMobile(value);
}

export function normalizeNationalId(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const normalized = value.trim().replace(/[\s-]+/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function normalizeEmail(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function nullableTrimmed(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseDateOnly(value: string, fieldName: string): Date {
  if (!DATE_ONLY_PATTERN.test(value)) {
    throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return parsed;
}

export function parseOptionalDateOnly(
  value: string | null | undefined,
  fieldName: string,
): Date | null {
  return value == null ? null : parseDateOnly(value, fieldName);
}

export function bangladeshTodayDateOnly(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Dhaka",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
}

export function assertEmployeeRules(state: EmployeeRuleState): void {
  const todayDateOnly = bangladeshTodayDateOnly();

  if (state.dateOfBirth && state.dateOfBirth > todayDateOnly) {
    throw new BadRequestException("Date of Birth cannot be in the future.");
  }
  if (state.dateOfBirth && state.dateOfBirth > state.joiningDate) {
    throw new BadRequestException("Date of Birth cannot be after Joining Date.");
  }
  if (state.confirmationDate && state.confirmationDate < state.joiningDate) {
    throw new BadRequestException("Confirmation Date cannot precede Joining Date.");
  }
  if (state.confirmationDate && state.confirmationDate > todayDateOnly) {
    throw new BadRequestException("Confirmation Date cannot be in the future.");
  }
  if (state.separationDate && state.separationDate < state.joiningDate) {
    throw new BadRequestException("Separation Date cannot precede Joining Date.");
  }
  if (state.separationDate && state.separationDate > todayDateOnly) {
    throw new BadRequestException("Separation Date cannot be in the future.");
  }
  if (state.separationDate && !state.separationReason) {
    throw new BadRequestException(
      "Separation Reason is required when Separation Date is supplied.",
    );
  }
  if (!state.separationDate && state.separationReason) {
    throw new BadRequestException(
      "Separation Date is required when Separation Reason is supplied.",
    );
  }
  if (state.separationDate && state.isActive) {
    throw new BadRequestException("A formally separated employee must be inactive.");
  }
  if (
    state.mobileNumber &&
    state.alternateMobileNumber &&
    state.mobileNumber === state.alternateMobileNumber
  ) {
    throw new BadRequestException(
      "Alternate Mobile Number must differ from Mobile Number.",
    );
  }

  const emergencyRequired = [
    state.emergencyContactName,
    state.emergencyContactRelationship,
    state.emergencyContactMobile,
  ];
  if (emergencyRequired.some(Boolean) && emergencyRequired.some((value) => !value)) {
    throw new BadRequestException(
      "Emergency Contact Name, Relationship, and Mobile are required together.",
    );
  }
}

export function maskMobile(value: string | null): string | null {
  if (!value) return null;
  return `${value.slice(0, 6)}*****${value.slice(-3)}`;
}

export function maskNationalId(value: string | null): string | null {
  if (!value) return null;
  return `${"*".repeat(Math.max(6, value.length - 4))}${value.slice(-4)}`;
}
