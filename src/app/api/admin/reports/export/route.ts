import { summarise } from "@/lib/attendance";
import { csvResponse, toCsv } from "@/lib/csv";
import { handler } from "@/lib/http";
import { requireApi } from "@/lib/session";
import { currentMonthKey, monthBounds } from "@/lib/time";
import { monthKeySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  await requireApi("ADMIN");
  const url = new URL(request.url);
  const month = monthKeySchema.parse(url.searchParams.get("month") ?? currentMonthKey());
  const department = url.searchParams.get("department") || undefined;

  const { from, to } = monthBounds(month);
  const rows = await summarise(from, to, { department });

  const csv = toCsv(
    [
      "Employee Code",
      "Employee Name",
      "Department",
      "Working Days",
      "Present",
      "Half Days",
      "Absent",
      "On Leave",
      "Late Arrivals",
      "Total Hours",
      "Average Hours / Present Day",
      "Attendance %",
    ],
    rows.map((r) => {
      const presentDays = r.present + r.halfDay;
      return [
        r.employeeCode,
        r.fullName,
        r.department ?? "",
        r.expectedDays,
        r.present,
        r.halfDay,
        r.absent,
        r.onLeave,
        r.lateCount,
        (r.totalMinutes / 60).toFixed(2),
        presentDays ? (r.totalMinutes / 60 / presentDays).toFixed(2) : "0.00",
        r.attendancePct.toFixed(1),
      ];
    }),
  );

  return csvResponse(`monthly_report_${month}.csv`, csv);
});
