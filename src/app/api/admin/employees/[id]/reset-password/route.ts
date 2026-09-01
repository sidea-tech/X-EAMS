import { generateTempPassword, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp, handler, notFound, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireApi("ADMIN");
    const { id } = await params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { username: true, fullName: true },
    });
    if (!target) throw notFound("Employee not found.");

    const temporaryPassword = generateTempPassword();
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        // Log out every device currently signed in as this user.
        tokenVersion: { increment: 1 },
      },
    });

    await audit({
      actorId: admin.id,
      action: "employee.password_reset",
      entity: "User",
      entityId: id,
      detail: target.username,
      ip: clientIp(request),
    });

    return ok({ temporaryPassword, username: target.username, fullName: target.fullName });
  },
);
