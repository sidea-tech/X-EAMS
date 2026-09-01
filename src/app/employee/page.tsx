import type { Metadata } from "next";
import Link from "next/link";
import { PunchPanel } from "@/components/PunchPanel";
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
import { getTodayState, summarise } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { WEEKDAY_SHORT, getPolicy, getPolicyFor } from "@/lib/policy";
import { requirePage } from "@/lib/session";
import {
  currentMonthKey,
  dateFromDayKey,
  dayKey,
  dayKeyFromDate,
  formatDayKey,
  formatDuration,
  formatTime,
  monthBounds,
} from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function EmployeeDashboard() {
  const user = await requirePage("EMPLOYEE");
  const [policy, companyPolicy] = await Promise.all([getPolicyFor(user.id), getPolicy()]);
  // Only worth calling out the schedule as "individual" when it truly differs.
  const isCustomSchedule =
    policy.workStart !== companyPolicy.workStart ||
    policy.workEnd !== companyPolicy.workEnd ||
    policy.fullDayMinutes !== companyPolicy.fullDayMinutes ||
    policy.halfDayMinutes !== companyPolicy.halfDayMinutes ||
    policy.graceMinutes !== companyPolicy.graceMinutes ||
    policy.timezone !== companyPolicy.timezone ||
    policy.workingDays.join() !== companyPolicy.workingDays.join();
  const month = currentMonthKey(policy.timezone);
  const { from, to, label } = monthBounds(month);
  const today = dayKey(new Date(), policy.timezone);

  const [state, summary, recent] = await Promise.all([
    getTodayState(user.id),
    summarise(from, to, { userId: user.id }),
    prisma.attendance.findMany({
      where: { userId: user.id, date: { lte: dateFromDayKey(today) } },
      orderBy: { date: "desc" },
      take: 7,
      select: {
        id: true,
        date: true,
        status: true,
        firstCheckIn: true,
        lastCheckOut: true,
        workedMinutes: true,
        isLate: true,
      },
    }),
  ]);

  const stats = summary[0];
  const presentDays = (stats?.present ?? 0) + (stats?.halfDay ?? 0);
  const avgMinutes = presentDays ? Math.round((stats?.totalMinutes ?? 0) / presentDays) : 0;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.fullName.split(" ")[0]}`}
        description={`${user.designation ?? "Employee"}${user.department ? ` · ${user.department}` : ""} · ${formatDayKey(today)}`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <PunchPanel
          initial={{
            dayKey: state.dayKey,
            isCheckedIn: state.isCheckedIn,
            openSince: state.openSince?.toISOString() ?? null,
            firstCheckIn: state.firstCheckIn?.toISOString() ?? null,
            lastCheckOut: state.lastCheckOut?.toISOString() ?? null,
            workedMinutes: state.workedMinutes,
            status: state.status,
            isLate: state.isLate,
            sessions: state.sessions.map((s) => ({
              id: s.id,
              checkInAt: s.checkInAt.toISOString(),
              checkOutAt: s.checkOutAt?.toISOString() ?? null,
            })),
          }}
          timezone={policy.timezone}
          fullDayMinutes={policy.fullDayMinutes}
          workStart={policy.workStart}
        />

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Present"
              value={stats?.present ?? 0}
              sub={`of ${stats?.expectedDays ?? 0} working days`}
              tone="success"
            />
            <StatCard label="Half days" value={stats?.halfDay ?? 0} tone="warning" />
            <StatCard label="Absent" value={stats?.absent ?? 0} tone="danger" />
            <StatCard
              label="Attendance"
              value={`${(stats?.attendancePct ?? 0).toFixed(1)}%`}
              sub={label}
              tone="brand"
            />
          </div>

          <Card>
            <CardHeader
              title="Your schedule"
              description={
                isCustomSchedule
                  ? "An individual schedule set by your administrator."
                  : "The company default schedule."
              }
              action={isCustomSchedule ? <Badge tone="brand">Individual</Badge> : null}
            />
            <dl className="divide-y divide-line text-sm">
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted">Shift</dt>
                <dd className="nums font-medium">
                  {policy.workStart} – {policy.workEnd}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted">Working days</dt>
                <dd className="font-medium">
                  {policy.workingDays.map((d) => WEEKDAY_SHORT[d]).join(", ")}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted">Full day / half day</dt>
                <dd className="nums font-medium">
                  {formatDuration(policy.fullDayMinutes)} / {formatDuration(policy.halfDayMinutes)}
                </dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted">Late after</dt>
                <dd className="nums font-medium">
                  {policy.workStart} + {policy.graceMinutes} min
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title={`${label} at a glance`} />
            <dl className="divide-y divide-line text-sm">
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted">Total hours worked</dt>
                <dd className="nums font-medium">{formatDuration(stats?.totalMinutes ?? 0)}</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted">Average per present day</dt>
                <dd className="nums font-medium">{formatDuration(avgMinutes)}</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted">Late arrivals</dt>
                <dd className="nums font-medium">{stats?.lateCount ?? 0}</dd>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <dt className="text-muted">Approved leave</dt>
                <dd className="nums font-medium">{stats?.onLeave ?? 0}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent activity"
          description="Your last seven recorded days."
          action={
            <Link
              href="/employee/attendance"
              className="text-sm font-medium text-brand hover:underline"
            >
              View full history
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            title="No attendance recorded yet"
            description="Use the Check IN button above to record your first punch."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>In</Th>
                <Th>Out</Th>
                <Th className="text-right">Worked</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap">{formatDayKey(dayKeyFromDate(row.date))}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={row.status} />
                      {row.isLate ? <span className="text-xs text-warn">late</span> : null}
                    </div>
                  </Td>
                  <Td className="nums">{formatTime(row.firstCheckIn, policy.timezone)}</Td>
                  <Td className="nums">{formatTime(row.lastCheckOut, policy.timezone)}</Td>
                  <Td className="nums text-right">{formatDuration(row.workedMinutes)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
