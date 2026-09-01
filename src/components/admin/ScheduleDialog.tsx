"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/policy";

export type PolicyDefaults = {
  workStart: string;
  workEnd: string;
  graceMinutes: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  workingDays: number[];
  timezone: string;
};

export type OverrideDto = {
  workStart: string | null;
  workEnd: string | null;
  graceMinutes: number | null;
  fullDayMinutes: number | null;
  halfDayMinutes: number | null;
  workingDays: number[];
  timezone: string | null;
  note: string | null;
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

/** Form state keeps everything as strings so "" can mean "inherit". */
type FormState = {
  workStart: string;
  workEnd: string;
  graceMinutes: string;
  fullDayMinutes: string;
  halfDayMinutes: string;
  timezone: string;
  followCompanyDays: boolean;
  workingDays: number[];
  note: string;
};

function toForm(o: OverrideDto | null, defaults: PolicyDefaults): FormState {
  return {
    workStart: o?.workStart ?? "",
    workEnd: o?.workEnd ?? "",
    graceMinutes: o?.graceMinutes?.toString() ?? "",
    fullDayMinutes: o?.fullDayMinutes?.toString() ?? "",
    halfDayMinutes: o?.halfDayMinutes?.toString() ?? "",
    timezone: o?.timezone ?? "",
    followCompanyDays: !o?.workingDays.length,
    workingDays: o?.workingDays.length ? o.workingDays : defaults.workingDays,
    note: o?.note ?? "",
  };
}

export function ScheduleDialog({
  employee,
  defaults,
  override,
  onClose,
  onSaved,
}: {
  employee: { id: string; fullName: string; employeeCode: string } | null;
  defaults: PolicyDefaults;
  override: OverrideDto | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(override, defaults));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: number) {
    setForm((prev) => ({
      ...prev,
      workingDays: prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b),
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!employee) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/employees/${employee.id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workStart: form.workStart,
          workEnd: form.workEnd,
          graceMinutes: form.graceMinutes,
          fullDayMinutes: form.fullDayMinutes,
          halfDayMinutes: form.halfDayMinutes,
          timezone: form.timezone,
          // An empty array tells the server to inherit the company working week.
          workingDays: form.followCompanyDays ? [] : form.workingDays,
          note: form.note,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { customised: boolean };
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Could not save this schedule.");
        return;
      }
      onSaved(
        payload.data?.customised
          ? `${employee.fullName} now has a custom schedule.`
          : `${employee.fullName} follows the company default schedule.`,
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function resetToDefault() {
    setForm({
      workStart: "",
      workEnd: "",
      graceMinutes: "",
      fullDayMinutes: "",
      halfDayMinutes: "",
      timezone: "",
      followCompanyDays: true,
      workingDays: defaults.workingDays,
      note: "",
    });
  }

  const hours = (m: number) => `${(m / 60).toFixed(1)}h`;

  return (
    <Modal
      open={employee !== null}
      title={employee ? `Schedule — ${employee.fullName}` : "Schedule"}
      description="Leave a field blank to follow the company default shown beneath it."
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={resetToDefault} disabled={busy}>
            Follow company default
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="schedule-form"
            disabled={busy || (!form.followCompanyDays && form.workingDays.length === 0)}
          >
            {busy ? "Saving…" : "Save schedule"}
          </Button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={submit} className="space-y-5" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Alert tone="info">
          This changes how {employee?.employeeCode}&apos;s days are classified — late arrivals,
          half days, and which weekdays count as expected working days in reports.
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Shift start" hint={`Company default: ${defaults.workStart}`}>
            <Input
              type="time"
              value={form.workStart}
              onChange={(e) => set("workStart", e.target.value)}
            />
          </Field>
          <Field label="Shift end" hint={`Company default: ${defaults.workEnd}`}>
            <Input
              type="time"
              value={form.workEnd}
              onChange={(e) => set("workEnd", e.target.value)}
            />
          </Field>
          <Field label="Late grace (minutes)" hint={`Company default: ${defaults.graceMinutes} min`}>
            <Input
              type="number"
              min={0}
              max={240}
              placeholder={String(defaults.graceMinutes)}
              value={form.graceMinutes}
              onChange={(e) => set("graceMinutes", e.target.value)}
            />
          </Field>
          <Field label="Timezone" hint={`Company default: ${defaults.timezone}`}>
            <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
              <option value="">Inherit ({defaults.timezone})</option>
              {[...new Set([...(form.timezone ? [form.timezone] : []), ...TIMEZONES])].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Full day (minutes)"
            hint={`Company default: ${defaults.fullDayMinutes} (${hours(defaults.fullDayMinutes)})`}
          >
            <Input
              type="number"
              min={60}
              max={1440}
              placeholder={String(defaults.fullDayMinutes)}
              value={form.fullDayMinutes}
              onChange={(e) => set("fullDayMinutes", e.target.value)}
            />
          </Field>
          <Field
            label="Half day (minutes)"
            hint={`Company default: ${defaults.halfDayMinutes} (${hours(defaults.halfDayMinutes)})`}
          >
            <Input
              type="number"
              min={30}
              max={1440}
              placeholder={String(defaults.halfDayMinutes)}
              value={form.halfDayMinutes}
              onChange={(e) => set("halfDayMinutes", e.target.value)}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted">Working days</legend>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.followCompanyDays}
              onChange={(e) => set("followCompanyDays", e.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Follow the company working week
            <Badge tone="neutral">
              {defaults.workingDays.map((d) => WEEKDAY_SHORT[d]).join(" ")}
            </Badge>
          </label>

          {form.followCompanyDays ? null : (
            <>
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
              {form.workingDays.length === 0 ? (
                <p className="mt-1.5 text-xs text-danger">Select at least one working day.</p>
              ) : null}
            </>
          )}
        </fieldset>

        <Field label="Reason / note" hint="Why this employee differs. Visible to administrators.">
          <Textarea
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
            maxLength={300}
            placeholder="e.g. Night shift, contracted 6 hours per day."
          />
        </Field>
      </form>
    </Modal>
  );
}
