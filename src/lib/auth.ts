import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, unauthorized } from "@/lib/http";

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** Deliberately vague so login cannot be used to enumerate usernames. */
const INVALID_CREDENTIALS = "Incorrect username or password.";

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export const PASSWORD_RULES = "At least 8 characters, including a letter and a number.";

export function passwordProblem(value: string): string | null {
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 100) return "Password must be 100 characters or fewer.";
  if (!/[A-Za-z]/.test(value)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(value)) return "Password must contain at least one number.";
  return null;
}

function lockoutMessage(until: Date): string {
  const mins = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000));
  return `Too many failed attempts. This account is locked for ${mins} more minute${mins === 1 ? "" : "s"}.`;
}

/**
 * Validates credentials and applies per-account lockout. Returns the user on
 * success; throws an ApiError with a non-enumerating message otherwise.
 */
export async function authenticate(username: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
  });

  if (!user) {
    // Constant-ish work factor so a missing user is not measurably faster.
    await bcrypt.compare(password, "$2a$12$ZZZZZZZZZZZZZZZZZZZZZeZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ");
    throw unauthorized(INVALID_CREDENTIALS);
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(429, lockoutMessage(user.lockedUntil));
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    if (lock) {
      throw new ApiError(
        429,
        `Too many failed attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.`,
      );
    }
    const left = MAX_FAILED_ATTEMPTS - attempts;
    throw unauthorized(`${INVALID_CREDENTIALS} ${left} attempt${left === 1 ? "" : "s"} remaining.`);
  }

  // Checked only after the password is proven, so a disabled account still
  // cannot be distinguished from a wrong password by an attacker.
  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated. Contact your administrator.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return user;
}

/** Changes a password and revokes every existing session for that user. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized();

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ApiError(400, "Your current password is incorrect.");
  }
  const problem = passwordProblem(newPassword);
  if (problem) throw new ApiError(400, problem);
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new ApiError(400, "Your new password must be different from the current one.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });
}

/** Readable one-time password for admin-created accounts and resets. */
export function generateTempPassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const pick = (set: string, i: number) => set[bytes[i]! % set.length]!;
  return [
    pick(letters, 0),
    pick(lower, 1),
    pick(lower, 2),
    pick(lower, 3),
    pick(lower, 4),
    "@",
    pick(digits, 5),
    pick(digits, 6),
    pick(digits, 7),
    pick(digits, 8),
  ].join("");
}
