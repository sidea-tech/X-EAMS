import { csvResponse, toCsv } from "@/lib/csv";
import { handler } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getPolicy } from "@/lib/policy";
import { requireApi } from "@/lib/session";
import { dateFromDayKey, dayKey, dayKeyFromDate, formatMinutesOfDay, minutesOfDay } from "@/lib/time";
import { dayKeySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  await requireApi("ADMIN");
  const url = new URL(request.url);
  const policy = await getPolicy();
  const today = dayKey(new Date(), policy.timezone);

  const from = dayKeySchema.parse(url.searchParams.get("from") ?? today.slice(0, 8) + "01");
  const to = dayKeySchema.parse(url.searchParams.get("to") ?? today);
  const userId = url.searchParams.get("userId") || undefined;
  const department = url.searchParams.get("department") || undefined;
  const status = url.searchParams.get("status") || undefined;

  const rows = await prisma.attendance.findMany({
    where: {
      date: { gte: dateFromDayKey(from), lte: dateFromDayKey(to) },
      ...(userId ? { userId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(department ? { user: { department } } : {}),
    },
    include: {
      user: { select: { employeeCode: true, fullName: true, department: true, designation: true } },
    },
    orderBy: [{ date: "desc" }, { user: { employeeCode: "asc" } }],
    take: 20_000,
  });

  const tz = policy.timezone;
  const csv = toCsv(
    [
      "Date",
      "Employee Code",
      "Employee Name",
      "Department",
      "Designation",
      "Status",
      "First Check-In",
      "Last Check-Out",
      "Worked Hours",
      "Worked Minutes",
      "Late",
      "Early Out",
      "Note",
    ],
    rows.map((r) => [
      dayKeyFromDate(r.date),
      r.user.employeeCode,
      r.user.fullName,
      r.user.department ?? "",
      r.user.designation ?? "",
      r.status,
      r.firstCheckIn ? formatMinutesOfDay(minutesOfDay(r.firstCheckIn, tz)) : "",
      r.lastCheckOut ? formatMinutesOfDay(minutesOfDay(r.lastCheckOut, tz)) : "",
      (r.workedMinutes / 60).toFixed(2),
      r.workedMinutes,
      r.isLate ? "Yes" : "No",
      r.isEarlyOut ? "Yes" : "No",
      r.note ?? "",
    ]),
  );

  return csvResponse(`attendance_${from}_to_${to}.csv`, csv);
});
