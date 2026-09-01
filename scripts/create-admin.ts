/**
 * Creates (or repairs) an administrator account without needing the app UI.
 *
 *   npx tsx scripts/create-admin.ts <username> <password> ["Full Name"]
 *
 * Connection: uses ADMIN_DATABASE_URL if set, else DATABASE_URL. Both a direct
 * `postgres://` string and a Prisma Postgres `prisma+postgres://` string work —
 * the latter travels over HTTPS/443, which is the way in when a network blocks
 * outbound 5432.
 *
 * Re-running for an existing username resets that account's password and
 * restores it to an active administrator, so it doubles as a lockout recovery.
 */
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import bcrypt from "bcryptjs";

const [, , usernameArg, passwordArg, fullNameArg] = process.argv;

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const username = (usernameArg ?? process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
const password = passwordArg ?? process.env.ADMIN_PASSWORD ?? "";
const fullName = (fullNameArg ?? process.env.ADMIN_FULL_NAME ?? "System Administrator").trim();

if (!username || !password) {
  fail('Usage: npx tsx scripts/create-admin.ts <username> <password> ["Full Name"]');
}
if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
  fail("Username must be 3–40 chars: lowercase letters, numbers, dot, underscore, hyphen.");
}
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
  fail("Password needs at least 8 characters, including a letter and a number.");
}

const url = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
if (!url) fail("Set ADMIN_DATABASE_URL or DATABASE_URL.");

const overHttps = url.startsWith("prisma+postgres://") || url.startsWith("prisma://");

const base = new PrismaClient({ datasources: { db: { url } } });
// The Accelerate extension carries queries over HTTPS for `prisma+postgres://`
// URLs and is a no-op passthrough for a direct connection, so it is always
// applied — keeping one client type rather than a union of two.
const prisma = base.$extends(withAccelerate());

async function main() {
  console.log(`\nTransport: ${overHttps ? "HTTPS via Prisma Accelerate" : "direct PostgreSQL"}`);

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true, employeeCode: true, role: true },
  });

  // Ensure the singleton work policy exists so the app has sane defaults.
  await prisma.workPolicy.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      timezone: process.env.APP_TIMEZONE || "Asia/Kolkata",
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    await prisma.user.update({
      where: { username },
      data: {
        passwordHash,
        role: "ADMIN",
        isActive: true,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        // Invalidate any sessions issued under the old password.
        tokenVersion: { increment: 1 },
      },
    });
    console.log(`✓ Reset existing account "${username}" (${existing.employeeCode}) to an active ADMIN.`);
  } else {
    // Pick the next free ADM-nnn code so repeat runs never collide.
    const admins = await prisma.user.findMany({
      where: { employeeCode: { startsWith: "ADM-" } },
      select: { employeeCode: true },
    });
    const highest = admins.reduce((max: number, a: { employeeCode: string }) => {
      const n = Number(a.employeeCode.slice(4));
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    const employeeCode = `ADM-${String(highest + 1).padStart(3, "0")}`;

    await prisma.user.create({
      data: {
        employeeCode,
        username,
        fullName,
        passwordHash,
        department: "Administration",
        designation: "HR Administrator",
        role: "ADMIN",
        mustChangePassword: false,
      },
    });
    console.log(`✓ Created administrator "${username}" (${employeeCode}).`);
  }

  const [adminCount, employeeCount] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
  ]);
  console.log(`  Accounts now: ${adminCount} administrator(s), ${employeeCount} employee(s).`);
  console.log(`\nSign in with username "${username}" and the password you provided.\n`);
}

main()
  .catch((error) => {
    console.error("\n✗ Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => base.$disconnect());
