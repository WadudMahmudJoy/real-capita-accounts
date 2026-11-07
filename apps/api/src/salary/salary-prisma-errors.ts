import {
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";

const APPROVED_RANGE_CONSTRAINTS = [
  "employee_salary_assignments_approved_range_excl",
  "employee_payment_profiles_approved_range_excl",
];

type ErrorMessages = {
  duplicateMessage?: string;
  referenceMessage?: string;
  notFoundMessage?: string;
  overlapMessage?: string;
};

export function normalizeSalaryPrismaError(
  error: unknown,
  messages: ErrorMessages,
): never {
  if (error instanceof HttpException) throw error;

  const code = prismaErrorCode(error);
  if (code === "P2002") {
    throw new ConflictException(
      messages.duplicateMessage ?? "Salary configuration already exists.",
    );
  }
  if (code === "P2003") {
    throw new NotFoundException(
      messages.referenceMessage ?? "Referenced salary configuration was not found.",
    );
  }
  if (code === "P2025") {
    throw new NotFoundException(
      messages.notFoundMessage ?? "Salary configuration was not found.",
    );
  }
  if (code === "P2034") {
    throw new ConflictException(
      "The salary configuration changed concurrently. Retry the operation.",
    );
  }
  if (isInstalledAdapterApprovedRangeViolation(error) ||
      (code === "P2004" && isCompatibleP2004ApprovedRangeViolation(error))) {
    throw new ConflictException(
      messages.overlapMessage ??
        "Approved effective dates overlap an existing record.",
    );
  }

  throw new InternalServerErrorException(
    "The salary configuration operation could not be completed.",
  );
}

function prismaErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
}

function isInstalledAdapterApprovedRangeViolation(error: unknown) {
  const cause = objectProperty(error, "cause");
  if (!cause || cause.kind !== "postgres" || cause.code !== "23P01") {
    return false;
  }

  // Prisma 7.8's PostgreSQL adapter preserves SQLSTATE structurally, but the
  // constraint name only in the original PostgreSQL diagnostic string.
  const diagnostic = cause.originalMessage;
  return typeof diagnostic === "string" && APPROVED_RANGE_CONSTRAINTS.some(
    (constraint) => diagnostic.includes(`"${constraint}"`),
  );
}

function isCompatibleP2004ApprovedRangeViolation(error: unknown) {
  const metadata = objectProperty(error, "meta");
  if (!metadata) return false;
  const constraint = metadata.constraint;
  return typeof constraint === "string" &&
    APPROVED_RANGE_CONSTRAINTS.includes(constraint);
}

function objectProperty(value: unknown, property: string) {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>)[property];
  return candidate && typeof candidate === "object"
    ? candidate as Record<string, unknown>
    : undefined;
}
