import { AppShell, type NavItem } from "@/components/AppShell";
import { IconCalendar, IconDashboard, IconUser } from "@/components/icons";
import { requirePage } from "@/lib/session";

const NAV: NavItem[] = [
  { href: "/employee", label: "Dashboard", icon: <IconDashboard /> },
  { href: "/employee/attendance", label: "My attendance", icon: <IconCalendar /> },
  { href: "/employee/account", label: "My account", icon: <IconUser /> },
];

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage("EMPLOYEE");
  return (
    <AppShell user={user} portal="Employee portal" nav={NAV}>
      {children}
    </AppShell>
  );
}
