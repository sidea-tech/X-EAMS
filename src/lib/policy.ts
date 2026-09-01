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
