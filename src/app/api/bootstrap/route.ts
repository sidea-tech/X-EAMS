import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ApiError, clientIp, handler, notFound, ok, parseJson, rateLimit } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getPolicy } from "@/lib/policy";
import { passwordSchema, usernameSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * One-time initialisation for environments where the database is only reachable
 * from the deployment itself (so `npm run db:seed` cannot be run locally).
 *
 *   curl -X POST https://<app>/api/bootstrap \
 *     -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" \
 *     -H "content-type: application/json" \
 *     -d '{"username":"admin","password":"...","fullName":"HR Administrator"}'
 *
 * It is inert unless BOOTSTRAP_TOKEN is set, and self-disables the moment an
 * administrator exists. Remove BOOTSTRAP_TOKEN from the environment afterwards.
 */

const bootstrapSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(120).default("System Administrator"),
  employeeCode: z
    .string()
    .trim()
    .min(1)
    .max(24)
    .regex(/^[A-Za-z0-9/-]+$/)
    .default("ADM-001"),
});

export const POST = handler(async (request: Request) => {
  const expected = process.env.BOOTSTRAP_TOKEN;
  // Behave as if the route does not exist when the feature is switched off.
  if (!expected || expected.length < 16) throw notFound();

  const ip = clientIp(request);
  rateLimit(`bootstrap:${ip ?? "unknown"}`, 5, 60_000);

  const supplied = request.headers.get("x-bootstrap-token") ?? "";
  // Length-independent comparison is unnecessary here (single-use, rate-limited),
  // but avoid leaking via early exit on the common prefix.
  if (supplied.length !== expected.length || supplied !== expected) {
    throw new ApiError(401, "Invalid bootstrap token.");
  }

  if ((await prisma.user.count({ where: { role: "ADMIN" } })) > 0) {
    throw new ApiError(
      409,
      "This instance is already initialised. Remove BOOTSTRAP_TOKEN from the environment.",
    );
  }

  const input = await parseJson(request, bootstrapSchema);

  // Creates the singleton work policy if it is missing.
  await getPolicy();

  const admin = await prisma.user.create({
    data: {
      employeeCode: input.employeeCode.toUpperCase(),
      username: input.username,
      fullName: input.fullName,
      passwordHash: await hashPassword(input.password),
      department: "Administration",
      designation: "HR Administrator",
      role: "ADMIN",
      // The caller chose this password, so no forced change.
      mustChangePassword: false,
    },
    select: { id: true, username: true, employeeCode: true },
  });

  await audit({
    actorId: admin.id,
    action: "system.bootstrap",
    entity: "User",
    entityId: admin.id,
    detail: `first administrator "${admin.username}" created`,
    ip,
  });

  return ok({
    administrator: admin,
    message:
      "Administrator created. Sign in at /login, then remove BOOTSTRAP_TOKEN from the environment.",
  });
});
