import type { Metadata } from "next";
import { EmployeeManager, type EmployeeRow } from "@/components/admin/EmployeeManager";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requirePage } from "@/lib/session";

export const metadata: Metadata = { title: "Employees" };
export const dynamic = "force-dynamic";

export default async function AdminEmployeesPage() {
  const admin = await requirePage("ADMIN");

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
    },
    orderBy: [{ isActive: "desc" }, { employeeCode: "asc" }],
  });

  const employees: EmployeeRow[] = users.map(({ _count, ...rest }) => ({
    ...rest,
    attendanceCount: _count.attendances,
  }));

  const departments = [...new Set(users.map((u) => u.department).filter(Boolean) as string[])].sort();

  return (
    <>
      <PageHeader
        title="Employees"
        description="Create accounts, manage access and issue password resets."
      />
      <EmployeeManager
        employees={employees}
        departments={departments}
        currentAdminId={admin.id}
      />
    </>
  );
}
