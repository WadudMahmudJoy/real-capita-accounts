/** Prisma adapter-pg can surface PostgreSQL failures without a Prisma code. */
export function payrollPaymentErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const value = error as { originalCode?: unknown; code?: unknown; cause?: unknown; meta?: { driverAdapterError?: unknown } };
  if (typeof value.originalCode === "string") return value.originalCode;
  if (typeof value.code === "string" && value.code !== "P2010") return value.code;
  const cause = value.cause ?? value.meta?.driverAdapterError;
  if (cause && typeof cause === "object") {
    const driver = cause as { originalCode?: unknown; code?: unknown; cause?: unknown };
    if (typeof driver.originalCode === "string") return driver.originalCode;
    if (typeof driver.code === "string") return driver.code;
    return payrollPaymentErrorCode(driver.cause);
  }
  return typeof value.code === "string" ? value.code : "";
}
