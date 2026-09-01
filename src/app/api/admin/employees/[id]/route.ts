import { audit } from "@/lib/audit";
import { clientIp, conflict, handler, notFound, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireApi } from "@/lib/session";
import { dateFromDayKey } from "@/lib/time";
import { updateEmployeeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Refuses changes that would leave the system with no way in. */
async function assertNotLastAdmin(userId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  if (target?.role !== "ADMIN" || !target.isActive) return;
  const others = await prisma.user.count({
    where: { role: "ADMIN", isActive: true, id: { not: userId } },
  });
  if (others === 0) {
    throw conflict("This is the only active administrator. Promote another admin first.");
  }
}

export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const admin = await requireApi("ADMIN");
  const { id } = await params;
  const input = await parseJson(request, updateEmployeeSchema);

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Employee not found.");

  const demoting = input.role === "EMPLOYEE";
  const deactivating = input.isActive === false;

  if (id === admin.id && (demoting || deactivating)) {
    throw conflict("You cannot remove your own administrator access.");
  }
  if (demoting || deactivating) await assertNotLastAdmin(id);

  // Changing role or disabling an account must invalidate live sessions.
  const revoke = demoting || deactivating || input.role === "ADMIN";

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.department !== undefined ? { department: input.department } : {}),
      ...(input.designation !== undefined ? { designation: input.designation } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.joinedAt ? { joinedAt: dateFromDayKey(input.joinedAt) } : {}),
      ...(revoke ? { tokenVersion: { increment: 1 } } : {}),
      ...(deactivating ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
    },
    select: { id: true, employeeCode: true, fullName: true, role: true, isActive: true },
  });

  await audit({
    actorId: admin.id,
    action: "employee.updated",
    entity: "User",
    entityId: id,
    detail: Object.keys(input).join(","),
    ip: clientIp(request),
  });

  return ok({ employee: updated });
});

/** Removes an account only when it holds no attendance history. */
export const DELETE = handler(async (request: Request, { params }: Ctx) => {
  const admin = await requireApi("ADMIN");
  const { id } = await params;

  if (id === admin.id) throw conflict("You cannot delete your own account.");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { employeeCode: true, username: true, _count: { select: { attendances: true } } },
  });
  if (!target) throw notFound("Employee not found.");

  if (target._count.attendances > 0) {
    throw conflict(
      `This employee has ${target._count.attendances} attendance record(s). Deactivate the account instead so history is preserved.`,
    );
  }
  await assertNotLastAdmin(id);

  await prisma.user.delete({ where: { id } });
  await audit({
    actorId: admin.id,
    action: "employee.deleted",
    entity: "User",
    entityId: id,
    detail: `${target.employeeCode} ${target.username}`,
    ip: clientIp(request),
  });

  return ok({ deleted: true });
});
