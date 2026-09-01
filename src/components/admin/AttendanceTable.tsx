"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { IconEdit, IconPlus } from "@/components/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  StatusBadge,
  TableWrap,
  Td,
  Textarea,
  Th,
} from "@/components/ui";

export type AttendanceRowDto = {
  id: string;
  dayKey: string;
  dayLabel: string;
  userId: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  workedLabel: string;
  workedMinutes: number;
  isLate: boolean;
  isEarlyOut: boolean;
  note: string | null;
  sessionCount: number;
  editedBy: string | null;
};

export type EmployeeOption = { id: string; label: string };

const STATUS_OPTIONS: [string, string][] = [
  ["PRESENT", "Present"],
  ["HALF_DAY", "Half day"],
  ["ABSENT", "Absent"],
  ["ON_LEAVE", "On leave"],
  ["HOLIDAY", "Holiday"],
  ["WEEK_OFF", "Week off"],
];

type Draft = {
  userId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  note: string;
  locked: boolean;
};

export function AttendanceTable({
  rows,
  employees,
  defaultDate,
  timezone,
}: {
  rows: AttendanceRowDto[];
  employees: EmployeeOption[];
  defaultDate: string;
  timezone: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  function openNew() {
    setError(null);
    setDraft({
      userId: employees[0]?.id ?? "",
      date: defaultDate,
      checkIn: "",
      checkOut: "",
      status: "PRESENT",
      note: "",
      locked: false,
    });
  }

  function openEdit(row: AttendanceRowDto) {
    setError(null);
    setDraft({
      userId: row.userId,
      date: row.dayKey,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      status: row.status,
      note: row.note ?? "",
      locked: true,
    });
  }

  function set<K extends keyof Draft>(key: K) {
    return (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => setDraft((prev) => (prev ? { ...prev, [key]: event.target.value as Draft[K] } : prev));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: draft.userId,
          date: draft.date,
          checkIn: draft.checkIn,
          checkOut: draft.checkOut,
          status: draft.status,
          note: draft.note || undefined,
        }),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Could not save this record.");
        return;
      }
      setBanner(`Attendance for ${draft.date} saved.`);
      setDraft(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {banner ? (
        <Alert tone="success" className="mb-4">
          {banner}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Attendance records"
          description={`${rows.length} record(s) matched. Times shown in ${timezone}.`}
          action={
            <Button onClick={openNew} disabled={busy || employees.length === 0}>
              <IconPlus />
              Add / correct record
            </Button>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            title="No records for these filters"
            description="Widen the date range, or add a record manually."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Employee</Th>
                <Th>Status</Th>
                <Th>In</Th>
                <Th>Out</Th>
                <Th className="text-right">Worked</Th>
                <Th>Flags</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td className="whitespace-nowrap">{row.dayLabel}</Td>
                  <Td>
                    <p className="font-medium">{row.fullName}</p>
                    <p className="nums text-xs text-subtle">
                      {row.employeeCode}
                      {row.department ? ` · ${row.department}` : ""}
                    </p>
                  </Td>
                  <Td>
                    <StatusBadge status={row.status} />
                  </Td>
                  <Td className="nums">{row.checkIn || "—"}</Td>
                  <Td className="nums">{row.checkOut || "—"}</Td>
                  <Td className="nums text-right">{row.workedLabel}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {row.isLate ? <Badge tone="warning">Late</Badge> : null}
                      {row.isEarlyOut ? <Badge tone="info">Early out</Badge> : null}
                      {row.sessionCount > 1 ? (
                        <Badge tone="neutral">{row.sessionCount} sessions</Badge>
                      ) : null}
                      {row.editedBy ? <Badge tone="brand">Edited</Badge> : null}
                    </div>
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(row)} disabled={busy}>
                      <IconEdit />
                      Adjust
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Modal
        open={draft !== null}
        title={draft?.locked ? "Adjust attendance" : "Add attendance record"}
        description="Saving replaces the day's punch sessions with the times entered here."
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="attendance-form" disabled={busy}>
              {busy ? "Saving…" : "Save record"}
            </Button>
          </>
        }
      >
        <form id="attendance-form" onSubmit={save} className="space-y-4" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee" required>
              <Select value={draft?.userId ?? ""} onChange={set("userId")} disabled={draft?.locked} required>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" required>
              <Input type="date" value={draft?.date ?? ""} onChange={set("date")} disabled={draft?.locked} required />
            </Field>
            <Field label="Check-in" hint={`24-hour time in ${timezone}. Blank clears the day.`}>
              <Input type="time" value={draft?.checkIn ?? ""} onChange={set("checkIn")} />
            </Field>
            <Field label="Check-out" hint="Leave blank for an open session.">
              <Input type="time" value={draft?.checkOut ?? ""} onChange={set("checkOut")} />
            </Field>
            <Field label="Status" hint="Overrides the automatically derived status.">
              <Select value={draft?.status ?? "PRESENT"} onChange={set("status")}>
                {STATUS_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Reason / note" hint="Recorded in the audit trail alongside your name.">
            <Textarea
              value={draft?.note ?? ""}
              onChange={set("note")}
              maxLength={300}
              placeholder="e.g. Forgot to check out — confirmed with manager."
            />
          </Field>
        </form>
      </Modal>
    </>
  );
}
