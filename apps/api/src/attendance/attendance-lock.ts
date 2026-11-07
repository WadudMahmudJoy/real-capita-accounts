import { ConflictException } from "@nestjs/common";
import type { ActiveCompanyContext } from "../auth/auth.types";
import type { Prisma } from "../generated/prisma/client";

export function attendanceDateLockKey(companyId: string, businessDate: string): string {
  return `attendance|${companyId}|${businessDate}`;
}

export async function acquireAttendanceDateLock(
  tx: Prisma.TransactionClient,
  companyId: string,
  businessDate: string,
): Promise<void> {
  await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${attendanceDateLockKey(companyId, businessDate)}, 0))) AS lock_taken`;
}

export function requireActiveCompanyId(activeCompany: ActiveCompanyContext | null): string {
  if (activeCompany === null) {
    throw new ConflictException("No office is selected for this session. Select an office first.");
  }
  if (!activeCompany.isActive) {
    throw new ConflictException("The selected office is inactive. Switch to an active office to continue.");
  }
  return activeCompany.id;
}
