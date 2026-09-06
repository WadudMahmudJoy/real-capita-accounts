import { ConflictException } from "@nestjs/common";
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

export async function currentCompanyId(
  prisma: Pick<Prisma.TransactionClient, "company">,
): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { singletonKey: "PRIMARY" },
    select: { id: true },
  });
  if (!company) {
    throw new ConflictException("Current company context is not configured.");
  }
  return company.id;
}
