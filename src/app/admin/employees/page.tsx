import type { Metadata } from "next";
import { EmployeeManager, type EmployeeRow } from "@/components/admin/EmployeeManager";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { getPolicy, overrideSummary } from "@/lib/policy";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function AdminEmployeesPage() {
  const admin = await requirePage("ADMIN");

  const policyDefaults = await getPolicy();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      username: true,
      email: true,
      phone: true,
      department: true,
      designation: true,
      role: true,
      isActive: true,
      _count: { select: { attendances: true } },
      schedule: {
        select: {
          workStart: true,
          workEnd: true,
          graceMinutes: true,
          fullDayMinutes: true,
          halfDayMinutes: true,
          workingDays: true,
          timezone: true,
          note: true,
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { employeeCode: "asc" }],
  });

  const employees: EmployeeRow[] = users.map(({ _count, schedule, ...rest }) => {
    const override = schedule
      ? { ...schedule, workingDays: [...schedule.workingDays].sort((a, b) => a - b) }
      : null;
    return {
      ...rest,
      attendanceCount: _count.attendances,
      schedule: override,
      scheduleSummary: override ? overrideSummary(override, policyDefaults) : [],
    };
  });

  const departments = [...new Set(users.map((u) => u.department).filter(Boolean) as string[])].sort();

  return (
    <>
      <PageHeader
        title="Employees"
        description="Create accounts, manage access, set individual schedules and issue password resets."
      />
      <EmployeeManager
        employees={employees}
        departments={departments}
        currentAdminId={admin.id}
        policyDefaults={policyDefaults}
      />
    </>
  );
}
