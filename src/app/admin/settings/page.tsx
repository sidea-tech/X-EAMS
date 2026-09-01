import type { Metadata } from "next";
import Link from "next/link";
import { HolidayManager, type HolidayDto } from "@/components/admin/HolidayManager";
import { PolicyForm } from "@/components/admin/PolicyForm";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getPolicy, overrideSummary } from "@/lib/policy";
import { requirePage } from "@/lib/session";
import { dayKeyFromDate, formatDayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePage("ADMIN");
  const [policy, holidayRows, customSchedules] = await Promise.all([
    getPolicy(),
    prisma.holiday.findMany({ orderBy: { date: "desc" }, take: 200 }),
    prisma.employeeSchedule.findMany({
      include: { user: { select: { id: true, fullName: true, employeeCode: true } } },
      orderBy: { user: { employeeCode: "asc" } },
    }),
  ]);

  const holidays: HolidayDto[] = holidayRows.map((h) => {
    const key = dayKeyFromDate(h.date);
    return { id: h.id, date: key, label: formatDayKey(key), name: h.name };
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="The default attendance rules, plus any individual exceptions."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <PolicyForm policy={policy} />
        <HolidayManager holidays={holidays} />

        <Card className="xl:col-span-2">
          <CardHeader
            title="Individual schedules"
            description="Employees whose shift, thresholds, working week or timezone differ from the default."
            action={
              <Link
                href="/admin/employees"
                className="text-sm font-medium text-brand hover:underline"
              >
                Manage in Employees
              </Link>
            }
          />
          {customSchedules.length === 0 ? (
            <EmptyState
              title="Everyone follows the default policy"
              description="Open Employees → Schedule to give an individual a different shift, working week or timezone."
            />
          ) : (
            <ul className="divide-y divide-line">
              {customSchedules.map((row) => {
                const parts = overrideSummary(
                  { ...row, workingDays: [...row.workingDays].sort((a, b) => a - b) },
                  policy,
                );
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {row.user.fullName}{" "}
                        <span className="nums text-xs text-subtle">{row.user.employeeCode}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {parts.join(" · ") || "no effective change"}
                        {row.note ? ` — ${row.note}` : ""}
                      </p>
                    </div>
                    <Badge tone="brand">Custom</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
