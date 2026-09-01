/**
 * Edge-safe session token helpers. Imported by middleware, so this module must
 * not pull in Prisma, bcrypt, or anything Node-specific.
 */
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "eams_session";

export type Role = "EMPLOYEE" | "ADMIN";

export type SessionPayload = {
  sub: string;
  username: string;
  fullName: string;
  role: Role;
  /** Must match User.tokenVersion, otherwise the token has been revoked. */
  ver: number;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (need >= 32 chars). Set it in your environment.",
    );
  }
  return new TextEncoder().encode(value);
}

export function sessionTtlSeconds(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? 9);
  return (Number.isFinite(hours) && hours > 0 ? hours : 9) * 3600;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + sessionTtlSeconds())
    .setIssuer("x-eams")
    .setAudience("x-eams")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "x-eams",
      audience: "x-eams",
      algorithms: ["HS256"],
    });
    const { sub, username, fullName, role, ver } = payload as Record<string, unknown>;
    if (
      typeof sub !== "string" ||
      typeof username !== "string" ||
      typeof fullName !== "string" ||
      (role !== "EMPLOYEE" && role !== "ADMIN") ||
      typeof ver !== "number"
    ) {
      return null;
    }
    return { sub, username, fullName, role, ver };
  } catch {
    return null;
  }
}

export function homePathFor(role: Role): string {
  return role === "ADMIN" ? "/admin" : "/employee";
}
