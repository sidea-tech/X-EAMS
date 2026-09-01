import { AttendanceStatus, type Prisma, PunchSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { conflict } from "@/lib/http";
import { getPoliciesFor, getPolicyFor, type Policy } from "@/lib/policy";
import {
  dateFromDayKey,
  dayKey,
  dayKeyFromDate,
  dayKeyRange,
  minutesOfDay,
  parseHhMm,
  weekdayOfDayKey,
} from "@/lib/time";

/** Statuses an admin sets explicitly; punching must not silently overwrite them. */
const MANUAL_STATUSES: AttendanceStatus[] = [
  AttendanceStatus.ON_LEAVE,
  AttendanceStatus.HOLIDAY,
  AttendanceStatus.WEEK_OFF,
];

export function deriveStatus(workedMinutes: number, policy: Policy): AttendanceStatus {
  if (workedMinutes >= policy.fullDayMinutes) return AttendanceStatus.PRESENT;
  if (workedMinutes >= policy.halfDayMinutes) return AttendanceStatus.HALF_DAY;
  // Anything under a half day still counts as attendance on the record; an
  // admin can downgrade it to ABSENT if the shortfall was unapproved.
  return AttendanceStatus.HALF_DAY;
}

type TxClient = Prisma.TransactionClient;

/**
 * Recomputes the roll-up fields on an attendance row from its punch sessions.
 * Sessions are the source of truth; everything else is cached aggregate.
 */
async function recompute(tx: TxClient, attendanceId: string, policy: Policy) {
  const record = await tx.attendance.findUniqueOrThrow({
    where: { id: attendanceId },
    include: { sessions: { orderBy: { checkInAt: "asc" } } },
  });

  const closed = record.sessions.filter((s) => s.checkOutAt !== null);
  const workedMinutes = closed.reduce((total, s) => {
    const ms = s.checkOutAt!.getTime() - s.checkInAt.getTime();
    return total + Math.max(0, Math.round(ms / 60_000));
  }, 0);

  const firstCheckIn = record.sessions[0]?.checkInAt ?? null;
  const lastCheckOut = closed.length
    ? closed.reduce((a, b) => (a.checkOutAt! > b.checkOutAt! ? a : b)).checkOutAt
    : null;

  const isLate = firstCheckIn
    ? minutesOfDay(firstCheckIn, policy.timezone) >
      parseHhMm(policy.workStart) + policy.graceMinutes
    : false;

  const isEarlyOut = lastCheckOut
    ? minutesOfDay(lastCheckOut, policy.timezone) < parseHhMm(policy.workEnd)
    : false;

  const keepStatus = MANUAL_STATUSES.includes(record.status);

  return tx.attendance.update({
    where: { id: attendanceId },
    data: {
      workedMinutes,
      firstCheckIn,
      lastCheckOut,
      isLate,
      isEarlyOut,
      status: keepStatus ? record.status : deriveStatus(workedMinutes, policy),
    },
  });
}

export type PunchAction = "IN" | "OUT";

export type PunchResult = {
  action: PunchAction;
  at: Date;
  dayKey: string;
  workedMinutes: number;
  isLate: boolean;
  status: AttendanceStatus;
};

/** Records a check-in or check-out for `userId` at "now". */
export async function punch(
  userId: string,
  action: PunchAction,
  ip: string | null,
  source: PunchSource = PunchSource.WEB,
): Promise<PunchResult> {
  // The employee's own schedule decides their day boundary, shift and thresholds.
  const policy = await getPolicyFor(userId);
  const now = new Date();
  const key = dayKey(now, policy.timezone);
  const date = dateFromDayKey(key);

  const result = await prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date, status: AttendanceStatus.HALF_DAY },
    });

    const open = await tx.punchSession.findFirst({
      where: { attendanceId: attendance.id, checkOutAt: null },
      orderBy: { checkInAt: "desc" },
    });

    if (action === "IN") {
      if (open) {
        throw conflict("You are already checked in. Check out before checking in again.");
      }
      await tx.punchSession.create({
        data: { attendanceId: attendance.id, checkInAt: now, checkInIp: ip, source },
      });
    } else {
      if (!open) {
        throw conflict("You are not checked in right now, so there is nothing to check out of.");
      }
      if (now.getTime() <= open.checkInAt.getTime()) {
        throw conflict("Check-out time must be after check-in time.");
      }
      await tx.punchSession.update({
        where: { id: open.id },
        data: { checkOutAt: now, checkOutIp: ip },
      });
    }

    return recompute(tx, attendance.id, policy);
  });

  return {
    action,
    at: now,
    dayKey: key,
    workedMinutes: result.workedMinutes,
    isLate: result.isLate,
    status: result.status,
  };
}

export type TodayState = {
  dayKey: string;
  isCheckedIn: boolean;
  openSince: Date | null;
  firstCheckIn: Date | null;
  lastCheckOut: Date | null;
  /** Minutes from completed sessions only. */
  workedMinutes: number;
  /** Completed minutes plus the currently running session. */
  liveMinutes: number;
  status: AttendanceStatus | null;
  isLate: boolean;
  sessions: { id: string; checkInAt: Date; checkOutAt: Date | null }[];
};

export async function getTodayState(userId: string): Promise<TodayState> {
  const policy = await getPolicyFor(userId);
  const key = dayKey(new Date(), policy.timezone);
  const record = await prisma.attendance.findUnique({
    where: { userId_date: { userId, date: dateFromDayKey(key) } },
    include: { sessions: { orderBy: { checkInAt: "asc" } } },
  });

  if (!record) {
    return {
      dayKey: key,
      isCheckedIn: false,
      openSince: null,
      firstCheckIn: null,
      lastCheckOut: null,
      workedMinutes: 0,
      liveMinutes: 0,
      status: null,
      isLate: false,
      sessions: [],
    };
  }

  const open = record.sessions.find((s) => s.checkOutAt === null) ?? null;
  const running = open ? Math.max(0, Math.round((Date.now() - open.checkInAt.getTime()) / 60_000)) : 0;

  return {
    dayKey: key,
    isCheckedIn: Boolean(open),
    openSince: open?.checkInAt ?? null,
    firstCheckIn: record.firstCheckIn,
    lastCheckOut: record.lastCheckOut,
    workedMinutes: record.workedMinutes,
    liveMinutes: record.workedMinutes + running,
    status: record.status,
    isLate: record.isLate,
    sessions: record.sessions.map((s) => ({
      id: s.id,
      checkInAt: s.checkInAt,
      checkOutAt: s.checkOutAt,
    })),
  };
}

/** Applies an admin correction to one employee-day, creating the row if needed. */
export async function adminUpsertAttendance(input: {
  userId: string;
  dayKey: string;
  checkIn?: Date | null;
  checkOut?: Date | null;
  status?: AttendanceStatus;
  note?: string | null;
  editorId: string;
}) {
  const policy = await getPolicyFor(input.userId);
  const date = dateFromDayKey(input.dayKey);

  return prisma.$transaction(async (tx) => {
    const attendance = await tx.attendance.upsert({
      where: { userId_date: { userId: input.userId, date } },
      update: {},
      create: { userId: input.userId, date, status: input.status ?? AttendanceStatus.PRESENT },
      include: { sessions: { orderBy: { checkInAt: "asc" } } },
    });

    // A supplied time window replaces the day's sessions with one admin entry;
    // this keeps sessions authoritative instead of letting aggregates drift.
    if (input.checkIn !== undefined || input.checkOut !== undefined) {
      const checkIn = input.checkIn ?? attendance.firstCheckIn;
      const checkOut = input.checkOut ?? null;
      if (checkIn && checkOut && checkOut <= checkIn) {
        throw conflict("Check-out time must be after check-in time.");
      }
      await tx.punchSession.deleteMany({ where: { attendanceId: attendance.id } });
      if (checkIn) {
        await tx.punchSession.create({
          data: {
            attendanceId: attendance.id,
            checkInAt: checkIn,
            checkOutAt: checkOut,
            source: PunchSource.ADMIN,
            note: "Adjusted by administrator",
          },
        });
      }
    }

    if (input.status !== undefined) {
      await tx.attendance.update({
        where: { id: attendance.id },
        data: { status: input.status },
      });
    }

    const recomputed = await recompute(tx, attendance.id, policy);

    // An explicit status choice always wins over the derived one.
    return tx.attendance.update({
      where: { id: recomputed.id },
      data: {
        status: input.status ?? recomputed.status,
        note: input.note === undefined ? recomputed.note : input.note,
        editedById: input.editorId,
        editedAt: new Date(),
      },
    });
  });
}

export type SummaryRow = {
  userId: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  present: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  holiday: number;
  weekOff: number;
  lateCount: number;
  totalMinutes: number;
  expectedDays: number;
  attendancePct: number;
};

/**
 * Working days in [from, to] per policy, excluding holidays and never counting
 * days that have not happened yet.
 */
export function expectedWorkingDays(
  from: string,
  to: string,
  policy: Policy,
  holidayKeys: Set<string>,
  todayKey: string,
): string[] {
  return dayKeyRange(from, to).filter(
    (key) =>
      key <= todayKey &&
      policy.workingDays.includes(weekdayOfDayKey(key)) &&
      !holidayKeys.has(key),
  );
}

/** Per-employee roll-up for a date range, used by the admin reports page. */
export async function summarise(
  from: string,
  to: string,
  filter: { userId?: string; department?: string } = {},
): Promise<SummaryRow[]> {
  const [users, records, holidays] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "EMPLOYEE",
        ...(filter.userId ? { id: filter.userId } : {}),
        ...(filter.department ? { department: filter.department } : {}),
      },
      select: { id: true, employeeCode: true, fullName: true, department: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        date: { gte: dateFromDayKey(from), lte: dateFromDayKey(to) },
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.department ? { user: { department: filter.department } } : {}),
      },
      select: {
        userId: true,
        date: true,
        status: true,
        isLate: true,
        workedMinutes: true,
      },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: dateFromDayKey(from), lte: dateFromDayKey(to) } },
      select: { date: true },
    }),
  ]);

  const holidayKeys = new Set(holidays.map((h) => dayKeyFromDate(h.date)));

  // Expected working days are now per-employee: two people can differ on both
  // their working weekdays and their timezone, so "today" differs too.
  const { base, byUser: policies } = await getPoliciesFor(users.map((u) => u.id));
  const now = new Date();

  const byUser = new Map<string, typeof records>();
  for (const r of records) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }

  return users.map((user) => {
    const policy = policies.get(user.id) ?? base;
    const expected = expectedWorkingDays(
      from,
      to,
      policy,
      holidayKeys,
      dayKey(now, policy.timezone),
    );
    const expectedSet = new Set(expected);

    const rows = byUser.get(user.id) ?? [];
    const row: SummaryRow = {
      userId: user.id,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      department: user.department,
      present: 0,
      halfDay: 0,
      absent: 0,
      onLeave: 0,
      holiday: 0,
      weekOff: 0,
      lateCount: 0,
      totalMinutes: 0,
      expectedDays: expected.length,
      attendancePct: 0,
    };

    const coveredWorkingDays = new Set<string>();
    for (const r of rows) {
      const key = dayKeyFromDate(r.date);
      row.totalMinutes += r.workedMinutes;
      if (r.isLate) row.lateCount += 1;
      if (expectedSet.has(key)) coveredWorkingDays.add(key);
      switch (r.status) {
        case AttendanceStatus.PRESENT:
          row.present += 1;
          break;
        case AttendanceStatus.HALF_DAY:
          row.halfDay += 1;
          break;
        case AttendanceStatus.ABSENT:
          row.absent += 1;
          break;
        case AttendanceStatus.ON_LEAVE:
          row.onLeave += 1;
          break;
        case AttendanceStatus.HOLIDAY:
          row.holiday += 1;
          break;
        case AttendanceStatus.WEEK_OFF:
          row.weekOff += 1;
          break;
      }
    }

    // Working days with no record at all are unexplained absences.
    row.absent += expected.filter((k) => !coveredWorkingDays.has(k)).length;

    const credited = row.present + row.halfDay * 0.5;
    row.attendancePct = expected.length
      ? Math.round((credited / expected.length) * 1000) / 10
      : 0;

    return row;
  });
}
