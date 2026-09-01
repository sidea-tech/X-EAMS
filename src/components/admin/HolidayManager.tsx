"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPlus } from "@/components/icons";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
} from "@/components/ui";

export type HolidayDto = { id: string; date: string; label: string; name: string };

export function HolidayManager({ holidays }: { holidays: HolidayDto[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, name }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Could not add the holiday.");
        return;
      }
      setDate("");
      setName("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(holiday: HolidayDto) {
    if (!window.confirm(`Remove ${holiday.name} on ${holiday.label}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/holidays/${holiday.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Could not remove the holiday.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Company holidays"
        description="Excluded from expected working days in every report."
      />

      <form onSubmit={add} className="grid gap-3 border-b border-line p-5 sm:grid-cols-[auto_1fr_auto]">
        <Field label="Date" required>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="sm:w-44"
          />
        </Field>
        <Field label="Holiday name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            placeholder="Independence Day"
          />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={busy || !date || name.trim().length < 2}>
            <IconPlus />
            Add
          </Button>
        </div>
      </form>

      {error ? (
        <div className="px-5 pt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {holidays.length === 0 ? (
        <EmptyState
          title="No holidays configured"
          description="Add your public holiday calendar so absence counts stay accurate."
        />
      ) : (
        <ul className="divide-y divide-line">
          {holidays.map((holiday) => (
            <li key={holiday.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div>
                <p className="text-sm font-medium">{holiday.name}</p>
                <p className="nums text-xs text-subtle">{holiday.label}</p>
              </div>
              <Button
                size="sm"
                variant="dangerQuiet"
                onClick={() => remove(holiday)}
                disabled={busy}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
