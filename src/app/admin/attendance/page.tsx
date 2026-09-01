import type { Metadata } from "next";
import {
  AttendanceTable,
  type AttendanceRowDto,
  type EmployeeOption,
} from "@/components/admin/AttendanceTable";
import { IconDownload } from "@/components/icons";
import { Button, Card, Field, Input, PageHeader, Select, StatCard } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getPolicy } from "@/lib/policy";
import { requirePage } from "@/lib/session";
import {
  currentMonthKey,
  dateFromDayKey,
  dayKey,
  dayKeyFromDate,
  formatDayKey,
  formatDuration,
  monthBounds,
  toHhMmInput,
} from "@/lib/time";
import { dayKeySchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS: [string, string][] = [
  ["", "All statuses"],
  ["PRESENT", "Present"],
  ["HALF_DAY", "Half day"],
  ["ABSENT", "Absent"],
  ["ON_LEAVE", "On leave"],
  ["HOLIDAY", "Holiday"],
  ["WEEK_OFF", "Week off"],
];

type Search = {
  from?: string;
  to?: string;
  userId?: string;
  department?: string;
  status?: string;
};

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requirePage("ADMIN");
  const policy = await getPolicy();
  const params = await searchParams;

  const today = dayKey(new Date(), policy.timezone);
  const monthStart = monthBounds(currentMonthKey(policy.timezone)).from;

  const from = dayKeySchema.safeParse(params.from).success ? params.from! : monthStart;
  const to = dayKeySchema.safeParse(params.to).success ? params.to! : today;
  const userId = params.userId || "";
  const department = params.department || "";
  const status = STATUS_FILTERS.some(([value]) => value === params.status) ? params.status! : "";

  const [users, records] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, employeeCode: true, fullName: true, department: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        date: { gte: dateFromDayKey(from), lte: dateFromDayKey(to) },
        ...(userId ? { userId } : {}),
        ...(status ? { status: status as never } : {}),
        ...(department ? { user: { department } } : {}),
      },
      include: {
        user: { select: { employeeCode: true, fullName: true, department: true } },
        editedBy: { select: { fullName: true } },
        sessions: { select: { id: true } },
      },
      orderBy: [{ date: "desc" }, { user: { employeeCode: "asc" } }],
      take: 1000,
    }),
  ]);

  const rows: AttendanceRowDto[] = records.map((r) => {
    const key = dayKeyFromDate(r.date);
    return {
      id: r.id,
      dayKey: key,
      dayLabel: formatDayKey(key),
      userId: r.userId,
      employeeCode: r.user.employeeCode,
      fullName: r.user.fullName,
      department: r.user.department,
      status: r.status,
      checkIn: toHhMmInput(r.firstCheckIn, policy.timezone),
      checkOut: toHhMmInput(r.lastCheckOut, policy.timezone),
      workedLabel: formatDuration(r.workedMinutes),
      workedMinutes: r.workedMinutes,
      isLate: r.isLate,
      isEarlyOut: r.isEarlyOut,
      note: r.note,
      sessionCount: r.sessions.length,
      editedBy: r.editedBy?.fullName ?? null,
    };
  });

  const employees: EmployeeOption[] = users.map((u) => ({
    id: u.id,
    label: `${u.employeeCode} — ${u.fullName}`,
  }));
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean) as string[])].sort();

  const totalMinutes = rows.reduce((sum, r) => sum + r.workedMinutes, 0);
  const exportQuery = new URLSearchParams({ from, to });
  if (userId) exportQuery.set("userId", userId);
  if (department) exportQuery.set("department", department);
  if (status) exportQuery.set("status", status);

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Review, correct and export attendance records."
        action={
          <a
            href={`/api/admin/attendance/export?${exportQuery.toString()}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"
          >
            <IconDownload />
            Export CSV
          </a>
        }
      />

      <Card className="mb-6">
        <form className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="From">
            <Input type="date" name="from" defaultValue={from} />
          </Field>
          <Field label="To">
            <Input type="date" name="to" defaultValue={to} />
          </Field>
          <Field label="Employee">
            <Select name="userId" defaultValue={userId}>
              <option value="">All employees</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department">
            <Select name="department" defaultValue={department}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={status}>
              {STATUS_FILTERS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1">
              Apply
            </Button>
            <a
              href="/admin/attendance"
              className="inline-flex h-10 items-center rounded-lg border border-line px-3 text-sm text-muted hover:bg-surface-2"
            >
              Reset
            </a>
          </div>
        </form>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Records" value={rows.length} tone="brand" />
        <StatCard label="Total hours" value={formatDuration(totalMinutes)} />
        <StatCard label="Late arrivals" value={rows.filter((r) => r.isLate).length} tone="warning" />
        <StatCard
          label="Absences"
          value={rows.filter((r) => r.status === "ABSENT").length}
          tone="danger"
        />
      </div>

      <AttendanceTable
        rows={rows}
        employees={employees}
        defaultDate={today}
        timezone={policy.timezone}
      />
    </>
  );
}
