import type { Metadata } from "next";
import { IconDownload } from "@/components/icons";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";
import { summarise } from "@/lib/attendance";
import { prisma } from "@/lib/prisma";
import { getPolicy } from "@/lib/policy";
import { requirePage } from "@/lib/session";
import { currentMonthKey, formatDuration, monthBounds } from "@/lib/time";
import { monthKeySchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function pctTone(pct: number): "success" | "warning" | "danger" {
  if (pct >= 90) return "success";
  if (pct >= 75) return "warning";
  return "danger";
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; department?: string }>;
}) {
  await requirePage("ADMIN");
  const policy = await getPolicy();
  const params = await searchParams;

  const parsed = monthKeySchema.safeParse(params.month);
  const month = parsed.success ? parsed.data : currentMonthKey(policy.timezone);
  const department = params.department || "";
  const { from, to, label } = monthBounds(month);

  const [rows, departmentRows] = await Promise.all([
    summarise(from, to, { department: department || undefined }),
    prisma.user.findMany({
      where: { department: { not: null } },
      select: { department: true },
      distinct: ["department"],
    }),
  ]);

  const departments = departmentRows
    .map((d) => d.department!)
    .filter(Boolean)
    .sort();

  const totals = rows.reduce(
    (acc, r) => ({
      present: acc.present + r.present,
      halfDay: acc.halfDay + r.halfDay,
      absent: acc.absent + r.absent,
      late: acc.late + r.lateCount,
      minutes: acc.minutes + r.totalMinutes,
    }),
    { present: 0, halfDay: 0, absent: 0, late: 0, minutes: 0 },
  );

  const avgPct = rows.length
    ? rows.reduce((sum, r) => sum + r.attendancePct, 0) / rows.length
    : 0;

  const exportQuery = new URLSearchParams({ month });
  if (department) exportQuery.set("department", department);

  return (
    <>
      <PageHeader
        title="Monthly report"
        description={`Per-employee attendance summary for ${label}.`}
        action={
          <a
            href={`/api/admin/reports/export?${exportQuery.toString()}`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"
          >
            <IconDownload />
            Export CSV
          </a>
        }
      />

      <Card className="mb-6">
        <form className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Month">
            <Input type="month" name="month" defaultValue={month} />
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
          <div className="flex items-end">
            <Button type="submit">Generate</Button>
          </div>
        </form>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Employees" value={rows.length} tone="brand" />
        <StatCard label="Present days" value={totals.present} tone="success" />
        <StatCard label="Half days" value={totals.halfDay} tone="warning" />
        <StatCard label="Absences" value={totals.absent} tone="danger" />
        <StatCard
          label="Avg attendance"
          value={`${avgPct.toFixed(1)}%`}
          sub={formatDuration(totals.minutes) + " logged"}
        />
      </div>

      <Card>
        <CardHeader
          title={label}
          description="Absences include working days with no record at all."
        />
        {rows.length === 0 ? (
          <EmptyState
            title="No employees to report on"
            description="Add employees, or clear the department filter."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th className="text-right">Working days</Th>
                <Th className="text-right">Present</Th>
                <Th className="text-right">Half</Th>
                <Th className="text-right">Absent</Th>
                <Th className="text-right">Leave</Th>
                <Th className="text-right">Late</Th>
                <Th className="text-right">Hours</Th>
                <Th className="text-right">Attendance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <Td>
                    <p className="font-medium">{r.fullName}</p>
                    <p className="nums text-xs text-subtle">{r.employeeCode}</p>
                  </Td>
                  <Td className="text-muted">{r.department ?? "—"}</Td>
                  <Td className="nums text-right">{r.expectedDays}</Td>
                  <Td className="nums text-right">{r.present}</Td>
                  <Td className="nums text-right">{r.halfDay}</Td>
                  <Td className="nums text-right">{r.absent}</Td>
                  <Td className="nums text-right">{r.onLeave}</Td>
                  <Td className="nums text-right">{r.lateCount}</Td>
                  <Td className="nums text-right">{formatDuration(r.totalMinutes)}</Td>
                  <Td className="text-right">
                    <span
                      className={
                        pctTone(r.attendancePct) === "success"
                          ? "nums font-semibold text-ok"
                          : pctTone(r.attendancePct) === "warning"
                            ? "nums font-semibold text-warn"
                            : "nums font-semibold text-danger"
                      }
                    >
                      {r.attendancePct.toFixed(1)}%
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
