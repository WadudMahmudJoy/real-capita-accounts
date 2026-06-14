import { ConflictException } from "@nestjs/common";

export function throwConflictOnUniqueConstraint(
  error: unknown,
  message: string,
): never {
  if (isPrismaErrorCode(error, "P2002")) {
    throw new ConflictException(message);
  }

  throw error;
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}
