"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import {
  ScheduleDialog,
  type OverrideDto,
  type PolicyDefaults,
} from "@/components/admin/ScheduleDialog";
import { IconClock, IconEdit, IconPlus, IconSearch } from "@/components/icons";
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
  TableWrap,
  Td,
  Th,
} from "@/components/ui";

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  username: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  role: "EMPLOYEE" | "ADMIN";
  isActive: boolean;
  attendanceCount: number;
  /** Null when this employee follows the company default schedule. */
  schedule: OverrideDto | null;
  /** Human-readable list of the fields this employee overrides. */
  scheduleSummary: string[];
};

type FormState = {
  employeeCode: string;
  fullName: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  role: "EMPLOYEE" | "ADMIN";
};

const EMPTY_FORM: FormState = {
  employeeCode: "",
  fullName: "",
  username: "",
  password: "",
  email: "",
  phone: "",
  department: "",
  designation: "",
  role: "EMPLOYEE",
};

async function callApi(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    data?: Record<string, unknown>;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "The request failed. Please try again.");
  }
  return payload.data ?? {};
}

export function EmployeeManager({
  employees,
  departments,
  currentAdminId,
  policyDefaults,
}: {
  employees: EmployeeRow[];
  departments: string[];
  currentAdminId: string;
  policyDefaults: PolicyDefaults;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const [mode, setMode] = useState<null | { kind: "create" } | { kind: "edit"; row: EmployeeRow }>(
    null,
  );
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [credential, setCredential] = useState<{ username: string; password: string } | null>(null);
  const [scheduleFor, setScheduleFor] = useState<EmployeeRow | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (!showInactive && !e.isActive) return false;
      if (!needle) return true;
      return [e.fullName, e.employeeCode, e.username, e.department, e.designation, e.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [employees, query, showInactive]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setMode({ kind: "create" });
  }

  function openEdit(row: EmployeeRow) {
    setForm({
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      username: row.username,
      password: "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      department: row.department ?? "",
      designation: row.designation ?? "",
      role: row.role,
    });
    setFormError(null);
    setMode({ kind: "edit", row });
  }

  function set<K extends keyof FormState>(key: K) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value as FormState[K] }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!mode) return;
    setBusy(true);
    setFormError(null);
    try {
      if (mode.kind === "create") {
        const data = (await callApi("/api/admin/employees", "POST", {
          employeeCode: form.employeeCode,
          fullName: form.fullName,
          username: form.username,
          password: form.password || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          department: form.department || undefined,
          designation: form.designation || undefined,
          role: form.role,
        })) as { temporaryPassword?: string | null };

        setBanner({ tone: "success", text: `${form.fullName} has been added.` });
        if (data.temporaryPassword) {
          setCredential({ username: form.username, password: data.temporaryPassword });
        }
      } else {
        await callApi(`/api/admin/employees/${mode.row.id}`, "PATCH", {
          fullName: form.fullName,
          email: form.email || undefined,
          phone: form.phone || undefined,
          department: form.department || undefined,
          designation: form.designation || undefined,
          role: form.role,
        });
        setBanner({ tone: "success", text: `${form.fullName} has been updated.` });
      }
      setMode(null);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unexpected error.");
    } finally {
      setBusy(false);
    }
  }

  async function rowAction(row: EmployeeRow, action: "toggle" | "reset" | "delete") {
    const prompts: Record<typeof action, string> = {
      toggle: row.isActive
        ? `Deactivate ${row.fullName}? They will be signed out and unable to log in.`
        : `Reactivate ${row.fullName}?`,
      reset: `Reset the password for ${row.fullName}? A new one-time password will be issued and all their sessions ended.`,
      delete: `Permanently delete ${row.fullName}? This is only possible while they have no attendance history.`,
    };
    if (!window.confirm(prompts[action])) return;

    setBusy(true);
    setBanner(null);
    try {
      if (action === "toggle") {
        await callApi(`/api/admin/employees/${row.id}`, "PATCH", { isActive: !row.isActive });
        setBanner({
          tone: "success",
          text: `${row.fullName} is now ${row.isActive ? "inactive" : "active"}.`,
        });
      } else if (action === "reset") {
        const data = (await callApi(
          `/api/admin/employees/${row.id}/reset-password`,
          "POST",
        )) as { temporaryPassword?: string };
        setCredential({ username: row.username, password: data.temporaryPassword! });
        setBanner({ tone: "success", text: `Password reset for ${row.fullName}.` });
      } else {
        await callApi(`/api/admin/employees/${row.id}`, "DELETE");
        setBanner({ tone: "success", text: `${row.fullName} has been deleted.` });
      }
      router.refresh();
    } catch (error) {
      setBanner({
        tone: "error",
        text: error instanceof Error ? error.message : "Unexpected error.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {banner ? (
        <Alert tone={banner.tone === "success" ? "success" : "error"} className="mb-4">
          {banner.text}
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Employee directory"
          description={`${filtered.length} of ${employees.length} account(s) shown.`}
          action={
            <Button onClick={openCreate} disabled={busy}>
              <IconPlus />
              Add employee
            </Button>
          }
        />

        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <div className="relative min-w-56 flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle">
              <IconSearch />
            </span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, code, username or department"
              className="pl-9"
              aria-label="Search employees"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="size-4 accent-[var(--brand)]"
            />
            Include inactive
          </label>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No matching employees"
            description="Adjust your search, or add a new employee account."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Username</Th>
                <Th>Department</Th>
                <Th>Role</Th>
                <Th>Schedule</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={row.isActive ? undefined : "opacity-60"}>
                  <Td>
                    <p className="font-medium">{row.fullName}</p>
                    <p className="nums text-xs text-subtle">
                      {row.employeeCode}
                      {row.designation ? ` · ${row.designation}` : ""}
                    </p>
                  </Td>
                  <Td className="nums text-muted">{row.username}</Td>
                  <Td className="text-muted">{row.department ?? "—"}</Td>
                  <Td>
                    <Badge tone={row.role === "ADMIN" ? "brand" : "neutral"}>
                      {row.role === "ADMIN" ? "Administrator" : "Employee"}
                    </Badge>
                  </Td>
                  <Td>
                    {row.schedule ? (
                      <span className="flex flex-col gap-0.5">
                        <Badge tone="brand">Custom</Badge>
                        <span className="text-xs text-subtle">
                          {row.scheduleSummary.join(" · ") || "custom"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-subtle">Company default</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={row.isActive ? "success" : "danger"}>
                      {row.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(row)} disabled={busy}>
                        <IconEdit />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setScheduleFor(row)}
                        disabled={busy}
                        title="Set this employee's shift and working days"
                      >
                        <IconClock />
                        Schedule
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rowAction(row, "reset")}
                        disabled={busy}
                      >
                        Reset password
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rowAction(row, "toggle")}
                        disabled={busy || row.id === currentAdminId}
                        title={
                          row.id === currentAdminId
                            ? "You cannot deactivate your own account"
                            : undefined
                        }
                      >
                        {row.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                      {row.attendanceCount === 0 && row.id !== currentAdminId ? (
                        <Button
                          size="sm"
                          variant="dangerQuiet"
                          onClick={() => rowAction(row, "delete")}
                          disabled={busy}
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {/* Create / edit */}
      <Modal
        open={mode !== null}
        title={mode?.kind === "edit" ? `Edit ${mode.row.fullName}` : "Add employee"}
        description={
          mode?.kind === "edit"
            ? "Employee code and username cannot be changed once issued."
            : "Leave the password blank to generate a one-time password."
        }
        onClose={() => setMode(null)}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form="employee-form" disabled={busy}>
              {busy ? "Saving…" : mode?.kind === "edit" ? "Save changes" : "Create employee"}
            </Button>
          </>
        }
      >
        <form id="employee-form" onSubmit={submit} className="space-y-4" noValidate>
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee code" required>
              <Input
                value={form.employeeCode}
                onChange={set("employeeCode")}
                required
                disabled={mode?.kind === "edit"}
                placeholder="EMP-014"
              />
            </Field>
            <Field label="Full name" required>
              <Input value={form.fullName} onChange={set("fullName")} required placeholder="Riya Sharma" />
            </Field>
            <Field label="Username" required hint="Lowercase letters, numbers, dot, underscore, hyphen.">
              <Input
                value={form.username}
                onChange={set("username")}
                required
                disabled={mode?.kind === "edit"}
                autoCapitalize="none"
                placeholder="r.sharma"
              />
            </Field>
            {mode?.kind === "create" ? (
              <Field
                label="Initial password"
                hint="Blank generates a one-time password shown after saving."
              >
                <Input
                  value={form.password}
                  onChange={set("password")}
                  type="text"
                  autoComplete="off"
                  placeholder="Auto-generate"
                />
              </Field>
            ) : null}
            <Field label="Email">
              <Input value={form.email} onChange={set("email")} type="email" placeholder="riya@company.com" />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Department">
              <Input
                value={form.department}
                onChange={set("department")}
                list="department-options"
                placeholder="Engineering"
              />
              <datalist id="department-options">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            <Field label="Designation">
              <Input value={form.designation} onChange={set("designation")} placeholder="Software Engineer" />
            </Field>
            <Field label="Role" hint="Administrators manage employees and attendance.">
              <Select value={form.role} onChange={set("role")}>
                <option value="EMPLOYEE">Employee</option>
                <option value="ADMIN">Administrator</option>
              </Select>
            </Field>
          </div>
        </form>
      </Modal>

      {/* Per-employee schedule */}
      {scheduleFor ? (
        <ScheduleDialog
          // Keyed so switching rows remounts the form with that row's values.
          key={scheduleFor.id}
          employee={scheduleFor}
          defaults={policyDefaults}
          override={scheduleFor.schedule}
          onClose={() => setScheduleFor(null)}
          onSaved={(message) => {
            setScheduleFor(null);
            setBanner({ tone: "success", text: message });
            router.refresh();
          }}
        />
      ) : null}

      {/* One-time credential hand-off */}
      <Modal
        open={credential !== null}
        title="One-time password"
        description="Share this with the employee now — it cannot be retrieved again."
        onClose={() => setCredential(null)}
        footer={
          <Button onClick={() => setCredential(null)}>Done</Button>
        }
      >
        <div className="space-y-3">
          <Alert tone="warning">
            The employee must change this password at their next sign-in.
          </Alert>
          <dl className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted">Username</dt>
              <dd className="nums font-mono text-sm font-medium">{credential?.username}</dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted">Password</dt>
              <dd className="nums font-mono text-base font-semibold select-all">
                {credential?.password}
              </dd>
            </div>
          </dl>
        </div>
      </Modal>
    </>
  );
}
