import { generateTempPassword, hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { badRequest, clientIp, handler, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireApi } from "@/lib/session";
import { dateFromDayKey } from "@/lib/time";
import { createEmployeeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  await requireApi("ADMIN");
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  const employees = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { employeeCode: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { department: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      username: true,
      email: true,
      department: true,
      designation: true,
      role: true,
      isActive: true,
    },
    orderBy: [{ isActive: "desc" }, { employeeCode: "asc" }],
    take: 500,
  });

  return ok({ employees });
});

export const POST = handler(async (request: Request) => {
  const admin = await requireApi("ADMIN");
  const input = await parseJson(request, createEmployeeSchema);

  // An omitted password means "issue a one-time password I can hand over".
  const generated = input.password ? null : generateTempPassword();
  const plain = input.password ?? generated!;

  const created = await prisma.user.create({
    data: {
      employeeCode: input.employeeCode.toUpperCase(),
      fullName: input.fullName,
      username: input.username,
      passwordHash: await hashPassword(plain),
      email: input.email,
      phone: input.phone,
      department: input.department,
      designation: input.designation,
      role: input.role,
      joinedAt: input.joinedAt ? dateFromDayKey(input.joinedAt) : new Date(),
      mustChangePassword: true,
    },
    select: { id: true, employeeCode: true, fullName: true, username: true, role: true },
  });

  await audit({
    actorId: admin.id,
    action: "employee.created",
    entity: "User",
    entityId: created.id,
    detail: `${created.employeeCode} ${created.username} role=${created.role}`,
    ip: clientIp(request),
  });

  return ok({
    employee: created,
    // Shown once in the UI; never stored or logged in plain text.
    temporaryPassword: generated,
  });
});

export const PUT = handler(async () => {
  throw badRequest("Use PATCH /api/admin/employees/{id} to update an employee.");
});
