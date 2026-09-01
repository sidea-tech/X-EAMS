import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requirePage } from "@/lib/session";
import { getPolicy } from "@/lib/policy";

export const metadata: Metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const admin = await requirePage("ADMIN");
  const policy = await getPolicy();

  const [profile, adminCount, recentLogins] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: admin.id },
      select: { employeeCode: true, username: true, email: true, lastLoginAt: true },
    }),
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
    prisma.auditLog.findMany({
      where: { actorId: admin.id, action: { in: ["auth.login", "auth.password_changed"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, ip: true, createdAt: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="My account" description="Your administrator profile and security." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Administrator" />
          <dl className="divide-y divide-line text-sm">
            {(
              [
                ["Name", admin.fullName],
                ["Username", profile.username],
                ["Employee code", profile.employeeCode],
                ["Email", profile.email ?? "—"],
                ["Active administrators", String(adminCount)],
                [
                  "Last sign-in",
                  profile.lastLoginAt
                    ? profile.lastLoginAt.toLocaleString("en-GB", { timeZone: policy.timezone })
                    : "First session",
                ],
              ] as [string, string][]
            ).map(([label, value]) => (
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
            {admin.mustChangePassword ? (
              <Alert tone="warning" className="mb-4">
                You are still using the password issued during setup. Please change it now.
              </Alert>
            ) : null}
            <ChangePasswordForm />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent security events" description="Your own sign-ins and password changes." />
          {recentLogins.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No events recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recentLogins.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span>
                    {entry.action === "auth.login" ? "Signed in" : "Changed password"}
                    {entry.ip ? <span className="nums text-subtle"> · {entry.ip}</span> : null}
                  </span>
                  <span className="nums text-xs text-subtle">
                    {entry.createdAt.toLocaleString("en-GB", { timeZone: policy.timezone })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
