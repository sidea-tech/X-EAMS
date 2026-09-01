import type { Metadata } from "next";
import { MonthCalendar, type CalendarDay } from "@/components/MonthCalendar";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  StatCard,
  StatusBadge,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { summarise } from "@/lib/attendance";
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
  formatTime,
  monthBounds,
} from "@/lib/time";
import { monthKeySchema } from "@/lib/validation";

export const metadata: Metadata = { title: "My attendance" };
export const dynamic = "force-dynamic";

export default async function MyAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requirePage("EMPLOYEE");
  const policy = await getPolicy();
  const params = await searchParams;

  const parsed = monthKeySchema.safeParse(params.month);
  const month = parsed.success ? parsed.data : currentMonthKey(policy.timezone);
  const { from, to, label } = monthBounds(month);
  const todayKey = dayKey(new Date(), policy.timezone);

  const [records, summary] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        userId: user.id,
        date: { gte: dateFromDayKey(from), lte: dateFromDayKey(to) },
      },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        status: true,
        firstCheckIn: true,
        lastCheckOut: true,
        workedMinutes: true,
        isLate: true,
        isEarlyOut: true,
        note: true,
        sessions: { select: { id: true } },
      },
    }),
    summarise(from, to, { userId: user.id }),
  ]);

  const stats = summary[0];
  const calendarDays: Record<string, CalendarDay> = {};
  for (const r of records) {
    calendarDays[dayKeyFromDate(r.date)] = {
      status: r.status,
      workedMinutes: r.workedMinutes,
      isLate: r.isLate,
    };
  }

  return (
    <>
      <PageHeader
        title="My attendance"
        description={`Timesheet for ${label}, in ${policy.timezone}.`}
        action={
          <form className="flex items-end gap-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">Month</span>
              <Input type="month" name="month" defaultValue={month} className="w-[11rem]" />
            </label>
            <Button type="submit" variant="secondary">
              Show
            </Button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Present"
          value={stats?.present ?? 0}
          sub={`of ${stats?.expectedDays ?? 0} working days`}
          tone="success"
        />
        <StatCard label="Half days" value={stats?.halfDay ?? 0} tone="warning" />
        <StatCard label="Absent" value={stats?.absent ?? 0} tone="danger" />
        <StatCard
          label="Hours"
          value={formatDuration(stats?.totalMinutes ?? 0)}
          sub={`${stats?.lateCount ?? 0} late arrival(s)`}
          tone="brand"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={label} description="Colour indicates the recorded status." />
          <MonthCalendar
            from={from}
            to={to}
            days={calendarDays}
            workingDays={policy.workingDays}
            todayKey={todayKey}
          />
        </Card>

        <Card>
          <CardHeader title="Daily records" description={`${records.length} day(s) recorded.`} />
          {records.length === 0 ? (
            <EmptyState
              title="Nothing recorded this month"
              description="Days you check in on will appear here."
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
                  <Th>Notes</Th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id}>
                    <Td className="whitespace-nowrap">{formatDayKey(dayKeyFromDate(row.date))}</Td>
                    <Td>
                      <StatusBadge status={row.status} />
                    </Td>
                    <Td className="nums">{formatTime(row.firstCheckIn, policy.timezone)}</Td>
                    <Td className="nums">{formatTime(row.lastCheckOut, policy.timezone)}</Td>
                    <Td className="nums text-right">{formatDuration(row.workedMinutes)}</Td>
                    <Td className="text-xs text-muted">
                      {[
                        row.isLate ? "Late" : null,
                        row.isEarlyOut ? "Early out" : null,
                        row.sessions.length > 1 ? `${row.sessions.length} sessions` : null,
                        row.note,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </>
  );
}
