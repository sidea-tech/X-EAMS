import { AppShell, type NavItem } from "@/components/AppShell";
import {
  IconCalendar,
  IconDashboard,
  IconReport,
  IconSettings,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { requirePage } from "@/lib/session";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <IconDashboard /> },
  { href: "/admin/employees", label: "Employees", icon: <IconUsers /> },
  { href: "/admin/attendance", label: "Attendance", icon: <IconCalendar /> },
  { href: "/admin/reports", label: "Reports", icon: <IconReport /> },
  { href: "/admin/settings", label: "Settings", icon: <IconSettings /> },
  { href: "/admin/account", label: "My account", icon: <IconUser /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage("ADMIN");
  return (
    <AppShell user={user} portal="Admin portal" nav={NAV}>
      {children}
    </AppShell>
  );
}
