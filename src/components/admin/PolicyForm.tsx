"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
} from "@/components/ui";
import { WEEKDAY_LABELS } from "@/lib/policy";

export type PolicyDto = {
  workStart: string;
  workEnd: string;
  graceMinutes: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  workingDays: number[];
  timezone: string;
};

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

export function PolicyForm({ policy }: { policy: PolicyDto }) {
  const router = useRouter();
  const [form, setForm] = useState<PolicyDto>(policy);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b),
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setResult({ tone: "error", text: payload.error ?? "Could not save the policy." });
        return;
      }
      setResult({ tone: "success", text: "Work policy updated." });
      router.refresh();
    } catch {
      setResult({ tone: "error", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Work policy"
        description="Drives late-arrival detection, day classification and reporting."
      />
      <form onSubmit={save} className="space-y-5 p-5">
        {result ? (
          <Alert tone={result.tone === "success" ? "success" : "error"}>{result.text}</Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shift start" required hint="24-hour company time.">
            <Input
              type="time"
              value={form.workStart}
              onChange={(e) => setForm({ ...form, workStart: e.target.value })}
              required
            />
          </Field>
          <Field label="Shift end" required hint="Check-outs before this flag an early exit.">
            <Input
              type="time"
              value={form.workEnd}
              onChange={(e) => setForm({ ...form, workEnd: e.target.value })}
              required
            />
          </Field>
          <Field label="Late grace (minutes)" hint="Arrivals within this window are not late.">
            <Input
              type="number"
              min={0}
              max={240}
              value={form.graceMinutes}
              onChange={(e) => setForm({ ...form, graceMinutes: Number(e.target.value) })}
            />
          </Field>
          <Field label="Timezone" required hint="All day boundaries are computed in this zone.">
            <Select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {[...new Set([form.timezone, ...TIMEZONES])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Full day (minutes)" required hint="480 = 8 hours.">
            <Input
              type="number"
              min={60}
              max={1440}
              value={form.fullDayMinutes}
              onChange={(e) => setForm({ ...form, fullDayMinutes: Number(e.target.value) })}
              required
            />
          </Field>
          <Field label="Half day (minutes)" required hint="Minimum to be credited a half day.">
            <Input
              type="number"
              min={30}
              max={1440}
              value={form.halfDayMinutes}
              onChange={(e) => setForm({ ...form, halfDayMinutes: Number(e.target.value) })}
              required
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Working days</legend>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((label, day) => {
              const active = form.workingDays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={active}
                  className={
                    active
                      ? "rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg"
                      : "rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-surface-2"
                  }
                >
                  {label.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-subtle">
            Non-working days are excluded from expected days and absence counts.
          </p>
        </fieldset>

        <Button type="submit" disabled={busy || form.workingDays.length === 0}>
          {busy ? "Saving…" : "Save policy"}
        </Button>
      </form>
    </Card>
  );
}
