/**
 * Idempotent bootstrap. Creates the work policy and the first administrator,
 * and optionally a demo team with backdated attendance.
 *
 *   npm run db:seed
 *
 * Controlled by SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD and SEED_DEMO_DATA.
 */
import { AttendanceStatus, PrismaClient, PunchSource, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";
const ADMIN_USERNAME = (process.env.SEED_ADMIN_USERNAME || "admin").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
const WITH_DEMO = (process.env.SEED_DEMO_DATA || "false").toLowerCase() === "true";

const POLICY = {
  workStart: "09:30",
  workEnd: "18:30",
  graceMinutes: 15,
  fullDayMinutes: 480,
  halfDayMinutes: 240,
  workingDays: [1, 2, 3, 4, 5],
  timezone: TZ,
};

/* ------------------------------------------------------------- time helpers */

function zonedParts(instant: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(instant)) out[p.type] = p.value;
  return out;
}

function todayKey(): string {
  const p = zonedParts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

function dateFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function shiftKey(key: string, days: number): string {
  const d = dateFromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function tzOffsetMinutes(instant: Date): number {
  const p = zonedParts(instant);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** Company wall-clock minutes-since-midnight on `key` → UTC instant. */
function instantAt(key: string, minutes: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let ts = naive;
  for (let i = 0; i < 2; i++) ts = naive - tzOffsetMinutes(new Date(ts)) * 60_000;
  return new Date(ts);
}

/* --------------------------------------------------------- deterministic RNG */

/** Seeded so repeated seeding produces the same demo history. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/* ---------------------------------------------------------------------- data */

const DEMO_EMPLOYEES = [
  { code: "EMP-001", name: "Riya Sharma", username: "r.sharma", dept: "Engineering", role: "Senior Software Engineer" },
  { code: "EMP-002", name: "Arjun Mehta", username: "a.mehta", dept: "Engineering", role: "Software Engineer" },
  { code: "EMP-003", name: "Neha Kulkarni", username: "n.kulkarni", dept: "Engineering", role: "QA Engineer" },
  { code: "EMP-004", name: "Vikram Iyer", username: "v.iyer", dept: "Finance", role: "Accounts Manager" },
  { code: "EMP-005", name: "Fatima Khan", username: "f.khan", dept: "Human Resources", role: "HR Executive" },
  { code: "EMP-006", name: "Rahul Verma", username: "r.verma", dept: "Sales", role: "Regional Sales Lead" },
  { code: "EMP-007", name: "Ananya Das", username: "a.das", dept: "Sales", role: "Sales Associate" },
  { code: "EMP-008", name: "Joseph Fernandes", username: "j.fernandes", dept: "Operations", role: "Operations Analyst" },
];

const DEMO_HOLIDAYS = [
  { offsetFromToday: -12, name: "Founders' Day" },
  { offsetFromToday: -33, name: "Regional Public Holiday" },
];

async function main() {
  const today = todayKey();
  console.log(`Seeding X-EAMS · timezone ${TZ} · today ${today}`);

  await prisma.workPolicy.upsert({
    where: { id: "default" },
    update: { timezone: TZ },
    create: { id: "default", ...POLICY },
  });
  console.log("  ✓ work policy");

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: { role: Role.ADMIN, isActive: true },
    create: {
      employeeCode: "ADM-001",
      username: ADMIN_USERNAME,
      fullName: "System Administrator",
      passwordHash: adminHash,
      email: null,
      department: "Administration",
      designation: "HR Administrator",
      role: Role.ADMIN,
      // Forces a password change on first sign-in.
      mustChangePassword: true,
    },
  });
  console.log(`  ✓ administrator "${admin.username}"`);

  if (!WITH_DEMO) {
    console.log("\nDone. Set SEED_DEMO_DATA=true to also create demo employees.");
    console.log(`Sign in as "${ADMIN_USERNAME}" with the password from SEED_ADMIN_PASSWORD.`);
    return;
  }

  for (const holiday of DEMO_HOLIDAYS) {
    const key = shiftKey(today, holiday.offsetFromToday);
    await prisma.holiday.upsert({
      where: { date: dateFromKey(key) },
      update: { name: holiday.name },
      create: { date: dateFromKey(key), name: holiday.name },
    });
  }
  console.log(`  ✓ ${DEMO_HOLIDAYS.length} holidays`);

  const holidayKeys = new Set(
    (await prisma.holiday.findMany({ select: { date: true } })).map((h) =>
      h.date.toISOString().slice(0, 10),
    ),
  );

  const demoHash = await bcrypt.hash("Welcome@123", 12);
  const employees = [];
  for (const person of DEMO_EMPLOYEES) {
    employees.push(
      await prisma.user.upsert({
        where: { username: person.username },
        update: { isActive: true },
        create: {
          employeeCode: person.code,
          username: person.username,
          fullName: person.name,
          passwordHash: demoHash,
          email: `${person.username.replace(".", "")}@example.com`,
          department: person.dept,
          designation: person.role,
          role: Role.EMPLOYEE,
          joinedAt: dateFromKey(shiftKey(today, -400)),
          mustChangePassword: true,
        },
      }),
    );
  }
  console.log(`  ✓ ${employees.length} demo employees (password "Welcome@123")`);

  const DAYS_BACK = 45;
  let created = 0;

  for (const [index, employee] of employees.entries()) {
    const random = makeRandom(1000 + index * 77);

    for (let back = DAYS_BACK; back >= 0; back--) {
      const key = shiftKey(today, -back);
      const weekday = dateFromKey(key).getUTCDay();

      if (!POLICY.workingDays.includes(weekday)) continue;
      if (holidayKeys.has(key)) {
        await prisma.attendance.upsert({
          where: { userId_date: { userId: employee.id, date: dateFromKey(key) } },
          update: {},
          create: {
            userId: employee.id,
            date: dateFromKey(key),
            status: AttendanceStatus.HOLIDAY,
            workedMinutes: 0,
          },
        });
        continue;
      }

      const roll = random();

      // ~4% unexplained absence, ~4% approved leave.
      if (roll < 0.04) continue;
      if (roll < 0.08) {
        await prisma.attendance.upsert({
          where: { userId_date: { userId: employee.id, date: dateFromKey(key) } },
          update: {},
          create: {
            userId: employee.id,
            date: dateFromKey(key),
            status: AttendanceStatus.ON_LEAVE,
            workedMinutes: 0,
            note: "Approved leave",
          },
        });
        continue;
      }

      // Arrive 09:05–10:05, work 6h15m–9h30m, with a lunch break most days.
      const inMinutes = 545 + Math.floor(random() * 60);
      const totalSpan = 375 + Math.floor(random() * 195);
      const takesBreak = random() > 0.25;
      const isToday = back === 0;
      // Today's last session is left open so the live timer has something to show.
      const openToday = isToday && random() > 0.4;

      const segments: [number, number | null][] = [];
      if (takesBreak) {
        const beforeBreak = Math.floor(totalSpan * (0.45 + random() * 0.15));
        const breakLength = 30 + Math.floor(random() * 30);
        segments.push([inMinutes, inMinutes + beforeBreak]);
        const resume = inMinutes + beforeBreak + breakLength;
        segments.push([resume, openToday ? null : resume + (totalSpan - beforeBreak)]);
      } else {
        segments.push([inMinutes, openToday ? null : inMinutes + totalSpan]);
      }

      // Don't invent punches in the future.
      const nowMinutes = (() => {
        const p = zonedParts(new Date());
        return Number(p.hour) * 60 + Number(p.minute);
      })();
      const usable = segments
        .filter(([start]) => !isToday || start <= nowMinutes)
        .map(([start, end]): [number, number | null] =>
          isToday && end !== null && end > nowMinutes ? [start, null] : [start, end],
        );
      if (usable.length === 0) continue;

      const workedMinutes = usable.reduce(
        (sum, [start, end]) => sum + (end === null ? 0 : end - start),
        0,
      );
      const firstCheckIn = instantAt(key, usable[0]![0]);
      const closed = usable.filter(([, end]) => end !== null);
      const lastCheckOut = closed.length
        ? instantAt(key, closed[closed.length - 1]![1]!)
        : null;

      const status =
        workedMinutes >= POLICY.fullDayMinutes
          ? AttendanceStatus.PRESENT
          : AttendanceStatus.HALF_DAY;

      const attendance = await prisma.attendance.upsert({
        where: { userId_date: { userId: employee.id, date: dateFromKey(key) } },
        update: {},
        create: {
          userId: employee.id,
          date: dateFromKey(key),
          firstCheckIn,
          lastCheckOut,
          workedMinutes,
          status,
          isLate: usable[0]![0] > 570 + POLICY.graceMinutes,
          isEarlyOut: lastCheckOut !== null && closed[closed.length - 1]![1]! < 1110,
        },
      });

      const existing = await prisma.punchSession.count({
        where: { attendanceId: attendance.id },
      });
      if (existing === 0) {
        await prisma.punchSession.createMany({
          data: usable.map(([start, end]) => ({
            attendanceId: attendance.id,
            checkInAt: instantAt(key, start),
            checkOutAt: end === null ? null : instantAt(key, end),
            source: PunchSource.WEB,
            checkInIp: "203.0.113.10",
          })),
        });
        created += usable.length;
      }
    }
  }

  console.log(`  ✓ ${created} punch sessions across ${DAYS_BACK} days`);
  console.log("\nDone.");
  console.log(`  Admin    → ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  console.log("  Employee → r.sharma / Welcome@123");
}

main()
  .catch((error) => {
    console.error("\nSeeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
