import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (m: string) => new ApiError(400, m);
export const unauthorized = (m = "Please sign in to continue.") => new ApiError(401, m);
export const forbidden = (m = "You do not have access to this resource.") => new ApiError(403, m);
export const notFound = (m = "Not found.") => new ApiError(404, m);
export const conflict = (m: string) => new ApiError(409, m);
export const tooMany = (m: string) => new ApiError(429, m);

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

/** Turns thrown ApiError/ZodError into a stable JSON error envelope. */
export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const path = first?.path.join(".");
    return NextResponse.json(
      {
        ok: false,
        error: path ? `${path}: ${first?.message}` : (first?.message ?? "Invalid input."),
        issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 400 },
    );
  }
  // Prisma unique-constraint violations surface as friendly conflicts.
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2002") {
    const target = (error as { meta?: { target?: string[] } }).meta?.target?.join(", ");
    return NextResponse.json(
      { ok: false, error: `${target ?? "That value"} is already in use.` },
      { status: 409 },
    );
  }
  if (code === "P2025") {
    return NextResponse.json({ ok: false, error: "Record not found." }, { status: 404 });
  }
  console.error("[api] unhandled error", error);
  return NextResponse.json(
    { ok: false, error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

/** Wraps a route handler so every failure returns the JSON envelope. */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

export function clientIp(request: Request): string | null {
  const h = request.headers;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? null;
}

/**
 * Small fixed-window limiter. Process-local, so on serverless it throttles per
 * warm instance only — a useful speed bump layered under the per-account
 * lockout in `auth.ts`, which is the real brute-force defence.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  existing.count += 1;
  if (existing.count > limit) {
    const secs = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw tooMany(`Too many requests. Please try again in ${secs}s.`);
  }
}
