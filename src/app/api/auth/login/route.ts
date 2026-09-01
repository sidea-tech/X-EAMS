import { NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp, handler, parseJson, rateLimit } from "@/lib/http";
import { homePathFor } from "@/lib/jwt";
import { attachSessionCookie, sessionPayloadFor } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (request: Request) => {
  const ip = clientIp(request);
  const { username, password } = await parseJson(request, loginSchema);

  rateLimit(`login:${ip ?? "unknown"}`, 20, 60_000);
  rateLimit(`login:user:${username.toLowerCase()}`, 10, 60_000);

  try {
    const user = await authenticate(username, password);

    const response = NextResponse.json({
      ok: true,
      data: {
        redirectTo: homePathFor(user.role),
        mustChangePassword: user.mustChangePassword,
        user: { id: user.id, fullName: user.fullName, role: user.role },
      },
    });

    await attachSessionCookie(response, sessionPayloadFor(user));
    await audit({ actorId: user.id, action: "auth.login", ip, detail: `role=${user.role}` });
    return response;
  } catch (error) {
    await audit({ action: "auth.login_failed", ip, detail: `username=${username}` });
    throw error;
  }
});
