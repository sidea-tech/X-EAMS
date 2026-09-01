"use client";

import { useState } from "react";
import { IconLogout } from "@/components/icons";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // Full document load on purpose: it discards the client router cache,
      // which still holds RSC payloads rendered for the signed-in user.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      title="Sign out"
      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-60"
    >
      <IconLogout />
      {compact ? null : <span>{pending ? "Signing out…" : "Sign out"}</span>}
    </button>
  );
}
