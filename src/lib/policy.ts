import type { WorkPolicy } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appTimezone } from "@/lib/time";

export const POLICY_ID = "default";

export type Policy = {
  workStart: string;
  workEnd: string;
  graceMinutes: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  workingDays: number[];
  timezone: string;
};

export const DEFAULT_POLICY: Policy = {
  workStart: "09:30",
  workEnd: "18:30",
  graceMinutes: 15,
  fullDayMinutes: 480,
  halfDayMinutes: 240,
  workingDays: [1, 2, 3, 4, 5],
  timezone: appTimezone(),
};

function toPolicy(row: WorkPolicy): Policy {
  return {
    workStart: row.workStart,
    workEnd: row.workEnd,
    graceMinutes: row.graceMinutes,
    fullDayMinutes: row.fullDayMinutes,
    halfDayMinutes: row.halfDayMinutes,
    workingDays: [...row.workingDays].sort((a, b) => a - b),
    timezone: row.timezone,
  };
}

/** Reads the singleton policy, creating it with defaults on first use. */
export async function getPolicy(): Promise<Policy> {
  const row = await prisma.workPolicy.findUnique({ where: { id: POLICY_ID } });
  if (row) return toPolicy(row);
  const created = await prisma.workPolicy.upsert({
    where: { id: POLICY_ID },
    update: {},
    create: { id: POLICY_ID, ...DEFAULT_POLICY },
  });
  return toPolicy(created);
}

export async function savePolicy(next: Policy): Promise<Policy> {
  const row = await prisma.workPolicy.upsert({
    where: { id: POLICY_ID },
    update: next,
    create: { id: POLICY_ID, ...next },
  });
  return toPolicy(row);
}

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* -------------------------------------------------- per-employee schedules */

/**
 * An employee's overrides. `null` on a field — or an empty `workingDays` —
 * means "inherit the company default", so someone on a different shift but the
 * same working week only needs to set the two time fields.
 */
export type ScheduleOverride = {
  workStart: string | null;
  workEnd: string | null;
  graceMinutes: number | null;
  fullDayMinutes: number | null;
  halfDayMinutes: number | null;
  workingDays: number[];
  timezone: string | null;
  note: string | null;
};

export const EMPTY_OVERRIDE: ScheduleOverride = {
  workStart: null,
  workEnd: null,
  graceMinutes: null,
  fullDayMinutes: null,
  halfDayMinutes: null,
  workingDays: [],
  timezone: null,
  note: null,
};

/** True when the override actually changes anything. */
export function hasOverrides(o: ScheduleOverride | null | undefined): boolean {
  if (!o) return false;
  return (
    o.workStart !== null ||
    o.workEnd !== null ||
    o.graceMinutes !== null ||
    o.fullDayMinutes !== null ||
    o.halfDayMinutes !== null ||
    o.timezone !== null ||
    o.workingDays.length > 0
  );
}

/** Lists the field names an override changes, for display. */
export function overrideSummary(o: ScheduleOverride, base: Policy): string[] {
  const parts: string[] = [];
  if (o.workStart || o.workEnd) {
    parts.push(`shift ${o.workStart ?? base.workStart}–${o.workEnd ?? base.workEnd}`);
  }
  if (o.graceMinutes !== null) parts.push(`${o.graceMinutes} min grace`);
  if (o.fullDayMinutes !== null) parts.push(`${(o.fullDayMinutes / 60).toFixed(1)}h full day`);
  if (o.halfDayMinutes !== null) parts.push(`${(o.halfDayMinutes / 60).toFixed(1)}h half day`);
  if (o.workingDays.length) {
    parts.push(o.workingDays.map((d) => WEEKDAY_SHORT[d]).join(" "));
  }
  if (o.timezone) parts.push(o.timezone);
  return parts;
}

function merge(base: Policy, o: ScheduleOverride | null): Policy {
  if (!o) return base;
  return {
    workStart: o.workStart ?? base.workStart,
    workEnd: o.workEnd ?? base.workEnd,
    graceMinutes: o.graceMinutes ?? base.graceMinutes,
    fullDayMinutes: o.fullDayMinutes ?? base.fullDayMinutes,
    halfDayMinutes: o.halfDayMinutes ?? base.halfDayMinutes,
    workingDays: o.workingDays.length
      ? [...o.workingDays].sort((a, b) => a - b)
      : base.workingDays,
    timezone: o.timezone ?? base.timezone,
  };
}

function toOverride(row: {
  workStart: string | null;
  workEnd: string | null;
  graceMinutes: number | null;
  fullDayMinutes: number | null;
  halfDayMinutes: number | null;
  workingDays: number[];
  timezone: string | null;
  note: string | null;
}): ScheduleOverride {
  return {
    workStart: row.workStart,
    workEnd: row.workEnd,
    graceMinutes: row.graceMinutes,
    fullDayMinutes: row.fullDayMinutes,
    halfDayMinutes: row.halfDayMinutes,
    workingDays: [...row.workingDays].sort((a, b) => a - b),
    timezone: row.timezone,
    note: row.note,
  };
}

/** The rules that actually apply to one employee. */
export async function getPolicyFor(userId: string): Promise<Policy> {
  const [base, row] = await Promise.all([
    getPolicy(),
    prisma.employeeSchedule.findUnique({ where: { userId } }),
  ]);
  return merge(base, row ? toOverride(row) : null);
}

/**
 * Batch form for reports — one query for every employee rather than N.
 * Employees with no row simply get the company default.
 */
export async function getPoliciesFor(
  userIds: string[],
): Promise<{ base: Policy; byUser: Map<string, Policy> }> {
  const base = await getPolicy();
  const byUser = new Map<string, Policy>();
  if (userIds.length === 0) return { base, byUser };

  const rows = await prisma.employeeSchedule.findMany({
    where: { userId: { in: userIds } },
  });
  const overrides = new Map(rows.map((r) => [r.userId, toOverride(r)]));
  for (const id of userIds) {
    byUser.set(id, merge(base, overrides.get(id) ?? null));
  }
  return { base, byUser };
}

export async function getOverrideFor(userId: string): Promise<ScheduleOverride | null> {
  const row = await prisma.employeeSchedule.findUnique({ where: { userId } });
  return row ? toOverride(row) : null;
}

export async function saveOverride(
  userId: string,
  next: ScheduleOverride,
  editorId: string,
): Promise<ScheduleOverride | null> {
  // An override that changes nothing is deleted, so "inherit everything" does
  // not leave a dead row behind.
  if (!hasOverrides(next) && !next.note) {
    await prisma.employeeSchedule.deleteMany({ where: { userId } });
    return null;
  }
  const row = await prisma.employeeSchedule.upsert({
    where: { userId },
    update: { ...next, updatedById: editorId },
    create: { userId, ...next, updatedById: editorId },
  });
  return toOverride(row);
}
