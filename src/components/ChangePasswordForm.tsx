"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

export function ChangePasswordForm() {
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  function set(key: keyof typeof values) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setValues((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (values.newPassword !== values.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Could not update your password.");
        setPending(false);
        return;
      }
      setDone(true);
      // The change revoked every token including this one, so a soft navigation
      // would render against a dead session. Reload the document instead.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      setTimeout(() => window.location.assign("/login"), 1600);
    } catch {
      setError("Network error. Please try again.");
      setPending(false);
    }
  }

  if (done) {
    return (
      <Alert tone="success">
        Password updated. For security you have been signed out — redirecting to sign in…
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Field label="Current password" required>
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={values.currentPassword}
          onChange={set("currentPassword")}
          disabled={pending}
        />
      </Field>

      <Field
        label="New password"
        required
        hint="At least 8 characters, including a letter and a number."
      >
        <Input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={values.newPassword}
          onChange={set("newPassword")}
          disabled={pending}
        />
      </Field>

      <Field label="Confirm new password" required>
        <Input
          type="password"
          autoComplete="new-password"
          required
          value={values.confirmPassword}
          onChange={set("confirmPassword")}
          disabled={pending}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
