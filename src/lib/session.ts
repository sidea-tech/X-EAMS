import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbidden, unauthorized } from "@/lib/http";
import {
  SESSION_COOKIE,
  sessionTtlSeconds,
  signSession,
  verifySession,
  type Role,
  type SessionPayload,
} from "@/lib/jwt";

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  employeeCode: string;
  email: string | null;
  department: string | null;
  designation: string | null;
  role: Role;
  mustChangePassword: boolean;
};

/**
 * Resolves the signed-in user. The JWT is only the first gate — we always
 * re-check the database so deactivations and password changes take effect
 * immediately rather than at token expiry.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      fullName: true,
      employeeCode: true,
      email: true,
      department: true,
      designation: true,
      role: true,
      isActive: true,
      tokenVersion: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive || user.tokenVersion !== payload.ver) return null;

  const { isActive: _isActive, tokenVersion: _tokenVersion, ...rest } = user;
  return rest;
});

/** For pages: redirects to /login instead of throwing. */
export async function requirePage(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(user.role === "ADMIN" ? "/admin" : "/employee");
  return user;
}

/** For route handlers: throws ApiError so `handler()` renders the envelope. */
export async function requireApi(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  if (role && user.role !== role) throw forbidden();
  return user;
}

export function sessionPayloadFor(user: {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  tokenVersion: number;
}): SessionPayload {
  return {
    sub: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    ver: user.tokenVersion,
  };
}

export async function attachSessionCookie(
  response: NextResponse,
  payload: SessionPayload,
): Promise<NextResponse> {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: await signSession(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionTtlSeconds(),
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
