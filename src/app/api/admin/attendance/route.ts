import { adminUpsertAttendance } from "@/lib/attendance";
import { audit } from "@/lib/audit";
import { clientIp, handler, notFound, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getPolicyFor } from "@/lib/policy";
import { requireApi } from "@/lib/session";
import { wallTimeToInstant } from "@/lib/time";
import { adminAttendanceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Create or correct one employee-day. Times are company wall-clock "HH:mm". */
export const POST = handler(async (request: Request) => {
  const admin = await requireApi("ADMIN");
  const input = await parseJson(request, adminAttendanceSchema);

  const employee = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, employeeCode: true },
  });
  if (!employee) throw notFound("Employee not found.");

  // Times are entered as the employee's own wall clock, so they must be
  // converted using that employee's effective timezone, not the company's.
  const policy = await getPolicyFor(input.userId);

  const toInstant = (value: string | undefined) =>
    value === undefined ? undefined : value === "" ? null : wallTimeToInstant(input.date, value, policy.timezone);

  const record = await adminUpsertAttendance({
    userId: input.userId,
    dayKey: input.date,
    checkIn: toInstant(input.checkIn),
    checkOut: toInstant(input.checkOut),
    status: input.status,
    note: input.note,
    editorId: admin.id,
  });

  await audit({
    actorId: admin.id,
    action: "attendance.adjusted",
    entity: "Attendance",
    entityId: record.id,
    detail: `${employee.employeeCode} ${input.date} status=${record.status} worked=${record.workedMinutes}m`,
    ip: clientIp(request),
  });

  return ok({
    id: record.id,
    date: input.date,
    status: record.status,
    workedMinutes: record.workedMinutes,
  });
});
