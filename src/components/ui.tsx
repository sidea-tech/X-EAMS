import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- surfaces */

export function Card({
  className,
  children,
  ...rest
}: ComponentProps<"section">) {
  return (
    <section
      {...rest}
      className={cx(
        "rounded-xl border border-line bg-surface shadow-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="no-print">{action}</div> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- buttons */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const BUTTON_VARIANTS = {
  primary: "bg-brand text-brand-fg hover:opacity-90 active:opacity-100",
  secondary: "border border-line bg-surface text-fg hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-fg",
  success: "bg-ok text-white hover:opacity-90",
  danger: "bg-danger text-white hover:opacity-90",
  dangerQuiet: "border border-line text-danger hover:bg-danger-soft",
} as const;

const BUTTON_SIZES = {
  sm: "h-8 px-3",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-base",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}) {
  return (
    <button
      {...rest}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
    />
  );
}

/* ------------------------------------------------------------------ fields */

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-subtle disabled:bg-surface-2 disabled:text-muted";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input {...rest} className={cx(FIELD, "h-10", className)} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select {...rest} className={cx(FIELD, "h-10 pr-8", className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea {...rest} className={cx(FIELD, "min-h-20 py-2", className)} />;
}

/* ------------------------------------------------------------------ status */

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-info-soft text-info border-info/25",
    success: "bg-ok-soft text-ok border-ok/25",
    warning: "bg-warn-soft text-warn border-warn/25",
    error: "bg-danger-soft text-danger border-danger/25",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("rounded-lg border px-3 py-2 text-sm", tones[tone], className)}
    >
      {children}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-surface-3 text-muted",
  brand: "bg-brand-soft text-brand-soft-fg",
  success: "bg-ok-soft text-ok",
  warning: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof BADGE_TONES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, { tone: keyof typeof BADGE_TONES; label: string }> = {
  PRESENT: { tone: "success", label: "Present" },
  HALF_DAY: { tone: "warning", label: "Half day" },
  ABSENT: { tone: "danger", label: "Absent" },
  ON_LEAVE: { tone: "info", label: "On leave" },
  HOLIDAY: { tone: "brand", label: "Holiday" },
  WEEK_OFF: { tone: "neutral", label: "Week off" },
};

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge tone="neutral">No record</Badge>;
  const meta = STATUS_TONES[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof BADGE_TONES;
}) {
  const accents = {
    neutral: "text-fg",
    brand: "text-brand",
    success: "text-ok",
    warning: "text-warn",
    danger: "text-danger",
    info: "text-info",
  } as const;
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={cx("nums mt-1.5 text-2xl font-semibold tracking-tight", accents[tone])}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-subtle">{sub}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ tables */

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, children, ...rest }: ComponentProps<"th">) {
  return (
    <th
      {...rest}
      className={cx(
        "border-b border-line bg-surface-2 px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-muted uppercase whitespace-nowrap",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...rest }: ComponentProps<"td">) {
  return (
    <td {...rest} className={cx("border-b border-line px-4 py-2.5 align-middle", className)}>
      {children}
    </td>
  );
}
