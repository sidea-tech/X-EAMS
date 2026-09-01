/**
 * All attendance is bucketed by the *company* calendar day, not the server's.
 * A day key is "YYYY-MM-DD" in APP_TIMEZONE; it is persisted as UTC midnight of
 * that key so the stored `@db.Date` round-trips regardless of server locale.
 */

export function appTimezone(): string {
  return process.env.APP_TIMEZONE || "Asia/Kolkata";
}

/** Parts of `instant` as observed in `tz`. */
function zonedParts(instant: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(instant)) out[p.type] = p.value;
  return out;
}

/** "YYYY-MM-DD" for `instant` in the company timezone. */
export function dayKey(instant: Date = new Date(), tz = appTimezone()): string {
  const p = zonedParts(instant, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Minutes since midnight for `instant` in the company timezone. */
export function minutesOfDay(instant: Date, tz = appTimezone()): number {
  const p = zonedParts(instant, tz);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** 0 = Sunday … 6 = Saturday, in the company timezone. */
export function weekday(instant: Date, tz = appTimezone()): number {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const idx = names.indexOf(zonedParts(instant, tz).weekday ?? "");
  return idx >= 0 ? idx : new Date(instant).getUTCDay();
}

/** Day key ("YYYY-MM-DD") → the Date value stored in `Attendance.date`. */
export function dateFromDayKey(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`Invalid day key: ${key}`);
  return new Date(`${key}T00:00:00.000Z`);
}

/** Inverse of `dateFromDayKey`, safe for values read back from Postgres. */
export function dayKeyFromDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function weekdayOfDayKey(key: string): number {
  return dateFromDayKey(key).getUTCDay();
}

/** Inclusive list of day keys between two keys. */
export function dayKeyRange(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const end = dateFromDayKey(toKey).getTime();
  const cursor = dateFromDayKey(fromKey);
  // Hard stop keeps a bad range from spinning forever.
  for (let i = 0; cursor.getTime() <= end && i < 3660; i++) {
    out.push(dayKeyFromDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** First and last day key of the month containing `key` (or "YYYY-MM"). */
export function monthBounds(monthOrDayKey: string): { from: string; to: string; label: string } {
  const month = monthOrDayKey.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Invalid month: ${monthOrDayKey}`);
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}`, label };
}

export function currentMonthKey(tz = appTimezone()): string {
  return dayKey(new Date(), tz).slice(0, 7);
}

/** "HH:mm" → minutes since midnight. */
export function parseHhMm(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) throw new Error(`Invalid time: ${value}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Invalid time: ${value}`);
  return h * 60 + min;
}

export function formatMinutesOfDay(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 495 → "8h 15m" */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "0h 00m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Wall-clock time of `instant` in the company timezone, e.g. "09:42 AM". */
export function formatTime(instant: Date | null | undefined, tz = appTimezone()): string {
  if (!instant) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(instant);
}

/** "2026-09-01" → "Tue, 01 Sep 2026" */
export function formatDayKey(key: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dateFromDayKey(key));
}

/** Offset of `tz` from UTC, in minutes, at the given instant (DST-aware). */
function tzOffsetMinutes(instant: Date, tz: string): number {
  const p = zonedParts(instant, tz);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  const whole = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / 60_000);
}

/**
 * Company wall-clock time ("2026-09-01", "09:30") → the exact UTC instant.
 * Iterates once to settle offsets that change across a DST boundary.
 */
export function wallTimeToInstant(key: string, hhmm: string, tz = appTimezone()): Date {
  const [y, mo, d] = key.split("-").map(Number);
  const minutes = parseHhMm(hhmm);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const naive = Date.UTC(y, mo - 1, d, h, m);
  let ts = naive;
  for (let i = 0; i < 2; i++) {
    ts = naive - tzOffsetMinutes(new Date(ts), tz) * 60_000;
  }
  return new Date(ts);
}

/** Wall-clock "HH:mm" of `instant` in the company timezone, for form inputs. */
export function toHhMmInput(instant: Date | null | undefined, tz = appTimezone()): string {
  if (!instant) return "";
  return formatMinutesOfDay(minutesOfDay(instant, tz));
}
