"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";
import { IconIn, IconOut } from "@/components/icons";
import { Alert, Badge, Button, StatusBadge } from "@/components/ui";

export type TodayDto = {
  dayKey: string;
  isCheckedIn: boolean;
  openSince: string | null;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  workedMinutes: number;
  status: string | null;
  isLate: boolean;
  sessions: { id: string; checkInAt: string; checkOutAt: string | null }[];
};

function useTimeFormatter(timezone: string) {
  return useCallback(
    (iso: string | null) =>
      iso
        ? new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }).format(new Date(iso))
        : "—",
    [timezone],
  );
}

/**
 * A once-per-second clock as an external store. `getServerSnapshot` returns null
 * so server render and hydration agree, and no setState happens in an effect.
 */
function subscribeToSeconds(onChange: () => void): () => void {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

const secondSnapshot = () => Math.floor(Date.now() / 1000) * 1000;
const noServerClock = () => null;

function useNow(): number | null {
  return useSyncExternalStore(subscribeToSeconds, secondSnapshot, noServerClock);
}

function hhmmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

export function PunchPanel({
  initial,
  timezone,
  fullDayMinutes,
  workStart,
}: {
  initial: TodayDto;
  timezone: string;
  fullDayMinutes: number;
  workStart: string;
}) {
  const router = useRouter();
  const [today, setToday] = useState<TodayDto>(initial);
  const [pending, setPending] = useState<null | "IN" | "OUT">(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const fmt = useTimeFormatter(timezone);
  /** null on the server and during hydration, then ticks every second. */
  const now = useNow();

  const openSeconds =
    today.openSince && now ? (now - new Date(today.openSince).getTime()) / 1000 : 0;
  const totalSeconds = today.workedMinutes * 60 + openSeconds;
  const progress = Math.min(100, (totalSeconds / 60 / fullDayMinutes) * 100);

  async function act(action: "IN" | "OUT") {
    setPending(action);
    setMessage(null);
    try {
      const response = await fetch("/api/attendance/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { message: string };
      };
      if (!response.ok || !payload.ok) {
        setMessage({ tone: "error", text: payload.error ?? "Could not record your punch." });
      } else {
        setMessage({ tone: "success", text: payload.data?.message ?? "Recorded." });
      }

      const refreshed = await fetch("/api/attendance/today", { cache: "no-store" });
      const state = (await refreshed.json()) as { ok: boolean; data?: TodayDto };
      if (state.ok && state.data) setToday(state.data);
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Network error. Please try again." });
    } finally {
      setPending(null);
    }
  }

  const clock =
    now === null
      ? "--:--:--"
      : new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date(now));

  return (
    <section className="rounded-xl border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {today.isCheckedIn ? (
              <span className="live-dot inline-block size-2 rounded-full bg-ok" aria-hidden />
            ) : null}
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              {today.isCheckedIn ? "Currently checked in" : "Not checked in"}
            </p>
          </div>
          <p className="nums mt-1 text-4xl font-semibold tracking-tight">{clock}</p>
          <p className="mt-1 text-xs text-subtle">
            {timezone.replace("_", " ")} · shift starts {workStart}
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <StatusBadge status={today.status} />
            {today.isLate ? <Badge tone="warning">Late arrival</Badge> : null}
          </div>
          <p className="nums text-2xl font-semibold tracking-tight">
            {now === null ? "00:00:00" : hhmmss(totalSeconds)}
          </p>
          <p className="text-xs text-subtle">worked today</p>
        </div>
      </div>

      <div className="px-5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-subtle">
          {Math.round(progress)}% of a {(fullDayMinutes / 60).toFixed(1)}-hour day
        </p>
      </div>

      <div className="space-y-3 p-5">
        {message ? (
          <Alert tone={message.tone === "success" ? "success" : "error"}>{message.text}</Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="success"
            size="lg"
            onClick={() => act("IN")}
            disabled={pending !== null || today.isCheckedIn}
          >
            <IconIn />
            {pending === "IN" ? "Checking in…" : "Check IN"}
          </Button>
          <Button
            variant="danger"
            size="lg"
            onClick={() => act("OUT")}
            disabled={pending !== null || !today.isCheckedIn}
          >
            <IconOut />
            {pending === "OUT" ? "Checking out…" : "Check OUT"}
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-3 pt-1">
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <dt className="text-xs text-muted">First check-in</dt>
            <dd className="nums text-sm font-medium">{fmt(today.firstCheckIn)}</dd>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <dt className="text-xs text-muted">Last check-out</dt>
            <dd className="nums text-sm font-medium">{fmt(today.lastCheckOut)}</dd>
          </div>
        </dl>

        {today.sessions.length ? (
          <div className="pt-1">
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
              Today&apos;s sessions
            </p>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
              {today.sessions.map((s, index) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-muted">Session {index + 1}</span>
                  <span className="nums">
                    {fmt(s.checkInAt)} → {s.checkOutAt ? fmt(s.checkOutAt) : "in progress"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
