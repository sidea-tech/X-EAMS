import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requirePage } from "@/lib/session";
import { formatDayKey } from "@/lib/time";

export const metadata: Metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function EmployeeAccountPage() {
  const user = await requirePage("EMPLOYEE");
  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      employeeCode: true,
      fullName: true,
      username: true,
      email: true,
      phone: true,
      department: true,
      designation: true,
      joinedAt: true,
      lastLoginAt: true,
    },
  });

  const rows: [string, string][] = [
    ["Employee code", profile.employeeCode],
    ["Full name", profile.fullName],
    ["Username", profile.username],
    ["Email", profile.email ?? "—"],
    ["Phone", profile.phone ?? "—"],
    ["Department", profile.department ?? "—"],
    ["Designation", profile.designation ?? "—"],
    ["Joined", formatDayKey(profile.joinedAt.toISOString().slice(0, 10))],
    [
      "Last sign-in",
      profile.lastLoginAt ? profile.lastLoginAt.toLocaleString("en-GB") : "First session",
    ],
  ];

  return (
    <>
      <PageHeader
        title="My account"
        description="Your profile details and password. Contact HR to correct profile information."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" description="Maintained by your administrator." />
          <dl className="divide-y divide-line text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Change password"
            description="You will be signed out of all devices afterwards."
          />
          <div className="p-5">
            {user.mustChangePassword ? (
              <Alert tone="warning" className="mb-4">
                Your current password was issued by an administrator. Please set your own password
                now.
              </Alert>
            ) : null}
            <ChangePasswordForm />
          </div>
        </Card>
      </div>
    </>
  );
}
