import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getPolicy } from "@/lib/policy";
import { requirePage } from "@/lib/session";
import {
  dateFromDayKey,
  dayKey,
  formatDayKey,
  formatDuration,
  formatTime,
  weekdayOfDayKey,
} from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const AUDIT_LABELS: Record<string, string> = {
  "auth.login": "signed in",
  "auth.logout": "signed out",
  "auth.login_failed": "failed sign-in",
  "auth.password_changed": "changed password",
  "attendance.check_in": "checked in",
  "attendance.check_out": "checked out",
  "attendance.adjusted": "adjusted attendance",
  "employee.created": "created an employee",
  "employee.updated": "updated an employee",
  "employee.deleted": "deleted an employee",
  "employee.password_reset": "reset a password",
  "policy.updated": "updated the work policy",
  "holiday.created": "added a holiday",
  "holiday.deleted": "removed a holiday",
};

export default async function AdminDashboard() {
  await requirePage("ADMIN");
  const policy = await getPolicy();
  const todayKey = dayKey(new Date(), policy.timezone);
  const todayDate = dateFromDayKey(todayKey);
  const isWorkingDay = policy.workingDays.includes(weekdayOfDayKey(todayKey));

  const [employees, records, holiday, activity] = await Promise.all([
    prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      select: { id: true, employeeCode: true, fullName: true, department: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.attendance.findMany({
      where: { date: todayDate },
      select: {
        userId: true,
        status: true,
        firstCheckIn: true,
        lastCheckOut: true,
        workedMinutes: true,
        isLate: true,
        sessions: { where: { checkOutAt: null }, select: { id: true } },
      },
    }),
    prisma.holiday.findUnique({ where: { date: todayDate }, select: { name: true } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        action: true,
        detail: true,
        createdAt: true,
        actor: { select: { fullName: true, employeeCode: true } },
      },
    }),
  ]);

  const byUser = new Map(records.map((r) => [r.userId, r]));
  const roster = employees.map((employee) => ({
    ...employee,
    record: byUser.get(employee.id) ?? null,
  }));

  const checkedIn = records.filter((r) => r.sessions.length > 0).length;
  const present = records.filter((r) => r.status === "PRESENT" || r.status === "HALF_DAY").length;
  const onLeave = records.filter((r) => r.status === "ON_LEAVE").length;
  const late = records.filter((r) => r.isLate).length;
  const notRecorded = employees.length - records.length;

  return (
    <>
      <PageHeader
        title="Today at a glance"
        description={`${formatDayKey(todayKey)} · ${policy.timezone}${holiday ? ` · Holiday: ${holiday.name}` : isWorkingDay ? "" : " · non-working day"}`}
        action={
          <Link
            href="/admin/attendance"
            className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg"
          >
            Manage attendance
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Active employees" value={employees.length} tone="brand" />
        <StatCard
          label="Checked in now"
          value={checkedIn}
          sub="currently on the clock"
          tone="success"
        />
        <StatCard label="Attended today" value={present} tone="neutral" />
        <StatCard label="Late arrivals" value={late} tone="warning" />
        <StatCard
          label="No record"
          value={notRecorded < 0 ? 0 : notRecorded}
          sub={onLeave ? `${onLeave} on leave` : undefined}
          tone="danger"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title="Daily roster"
            description="Every active employee and their status for today."
          />
          {roster.length === 0 ? (
            <EmptyState
              title="No employees yet"
              description="Add your first employee to start tracking attendance."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                  <Th>In</Th>
                  <Th>Out</Th>
                  <Th className="text-right">Worked</Th>
                </tr>
              </thead>
              <tbody>
                {roster.map(({ id, employeeCode, fullName, department, record }) => (
                  <tr key={id}>
                    <Td>
                      <p className="font-medium">{fullName}</p>
                      <p className="nums text-xs text-subtle">{employeeCode}</p>
                    </Td>
                    <Td className="text-muted">{department ?? "—"}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={record?.status ?? null} />
                        {record?.sessions.length ? <Badge tone="success">On clock</Badge> : null}
                        {record?.isLate ? <Badge tone="warning">Late</Badge> : null}
                      </div>
                    </Td>
                    <Td className="nums">{formatTime(record?.firstCheckIn, policy.timezone)}</Td>
                    <Td className="nums">{formatTime(record?.lastCheckOut, policy.timezone)}</Td>
                    <Td className="nums text-right">
                      {record ? formatDuration(record.workedMinutes) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader title="Recent activity" description="Audit trail, newest first." />
          {activity.length === 0 ? (
            <EmptyState title="No activity recorded yet" />
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((entry) => (
                <li key={entry.id} className="px-5 py-3 text-sm">
                  <p>
                    <span className="font-medium">{entry.actor?.fullName ?? "System"}</span>{" "}
                    <span className="text-muted">
                      {AUDIT_LABELS[entry.action] ?? entry.action}
                    </span>
                  </p>
                  <p className="nums mt-0.5 text-xs text-subtle">
                    {entry.createdAt.toLocaleString("en-GB", { timeZone: policy.timezone })}
                    {entry.detail ? ` · ${entry.detail}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
