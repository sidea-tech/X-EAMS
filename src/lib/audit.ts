import { prisma } from "@/lib/prisma";

/** Best-effort audit trail: never let logging break the request it describes. */
export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: string;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        detail: entry.detail,
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record", entry.action, error);
  }
}
