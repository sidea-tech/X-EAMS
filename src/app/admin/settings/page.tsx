import type { Metadata } from "next";
import { HolidayManager, type HolidayDto } from "@/components/admin/HolidayManager";
import { PolicyForm } from "@/components/admin/PolicyForm";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getPolicy } from "@/lib/policy";
import { requirePage } from "@/lib/session";
import { dayKeyFromDate, formatDayKey } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePage("ADMIN");
  const [policy, holidayRows] = await Promise.all([
    getPolicy(),
    prisma.holiday.findMany({ orderBy: { date: "desc" }, take: 200 }),
  ]);

  const holidays: HolidayDto[] = holidayRows.map((h) => {
    const key = dayKeyFromDate(h.date);
    return { id: h.id, date: key, label: formatDayKey(key), name: h.name };
  });

  return (
    <>
      <PageHeader
        title="Settings"
        description="Attendance rules that apply across the organisation."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <PolicyForm policy={policy} />
        <HolidayManager holidays={holidays} />
      </div>
    </>
  );
}
