"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

export function NavLink({
  href,
  label,
  icon,
  compact = false,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  compact?: boolean;
}) {
  const pathname = usePathname();
  // Exact match for portal roots so /admin is not "active" on every subpage.
  const depth = href.split("/").filter(Boolean).length;
  const active = depth <= 1 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors",
        compact ? "shrink-0 px-3 py-2" : "px-3 py-2.5",
        active
          ? "bg-brand-soft text-brand-soft-fg"
          : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span className={active ? "text-brand" : "text-subtle"}>{icon}</span>
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}
