import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { LogoutButton } from "@/components/LogoutButton";
import { NavLink } from "@/components/NavLink";
import type { CurrentUser } from "@/lib/session";

export type NavItem = { href: string; label: string; icon: ReactNode };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function AppShell({
  user,
  portal,
  nav,
  children,
}: {
  user: CurrentUser;
  portal: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <div className="px-5 py-5">
          <Brand subtitle={portal} />
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <div className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand-soft-fg">
              {initials(user.fullName)}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-medium">{user.fullName}</p>
              <p className="truncate text-xs text-muted">{user.employeeCode}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Mobile header */}
        <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Brand subtitle={portal} />
            <LogoutButton compact />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {nav.map((item) => (
              <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} compact />
            ))}
          </nav>
        </header>

        {user.mustChangePassword ? (
          <div className="no-print border-b border-warn/25 bg-warn-soft px-4 py-2.5 text-sm text-warn sm:px-6">
            Your password was issued by an administrator.{" "}
            <Link
              href={user.role === "ADMIN" ? "/admin/account" : "/employee/account"}
              className="font-semibold underline underline-offset-2"
            >
              Set a new password
            </Link>{" "}
            to keep your account secure.
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="no-print border-t border-line px-4 py-4 text-xs text-subtle sm:px-6 lg:px-8">
          Signed in as {user.username} · {user.role === "ADMIN" ? "Administrator" : "Employee"}
        </footer>
      </div>
    </div>
  );
}
