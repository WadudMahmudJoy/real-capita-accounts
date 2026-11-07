import type { Prisma } from "../generated/prisma/client";

export async function audit(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonValue,
): Promise<void> {
  await tx.auditEvent.create({
    data: { userId, action, entityType, entityId, metadata },
  });
}
