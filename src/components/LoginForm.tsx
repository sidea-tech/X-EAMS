"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";

/** Only same-origin, path-relative redirects are honoured. */
function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function LoginForm({ next }: { next: string | null }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { redirectTo: string };
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Unable to sign in. Please try again.");
        setPending(false);
        return;
      }
      const target = safeNext(next) ?? payload.data?.redirectTo ?? "/";
      // Full navigation so middleware re-runs with the new session cookie.
      window.location.assign(target);
    } catch {
      setError("Network error. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Field label="Username" required>
        <Input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. Shyam"
          disabled={pending}
        />
      </Field>

      <Field label="Password" required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={pending}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-subtle">
        Trouble signing in? Contact your HR administrator to reset your password.
      </p>
    </form>
  );
}
