import { audit } from "@/lib/audit";
import { clientIp, handler, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

export const DELETE = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireApi("ADMIN");
    const { id } = await params;

    await prisma.holiday.delete({ where: { id } });
    await audit({
      actorId: admin.id,
      action: "holiday.deleted",
      entity: "Holiday",
      entityId: id,
      ip: clientIp(request),
    });

    return ok({ deleted: true });
  },
);
