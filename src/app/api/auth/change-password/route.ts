import { NextResponse } from "next/server";
import { changePassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp, handler, parseJson, rateLimit } from "@/lib/http";
import { clearSessionCookie, requireApi } from "@/lib/session";
import { changePasswordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (request: Request) => {
  const user = await requireApi();
  rateLimit(`pwd:${user.id}`, 10, 5 * 60_000);

  const { currentPassword, newPassword } = await parseJson(request, changePasswordSchema);
  await changePassword(user.id, currentPassword, newPassword);
  await audit({ actorId: user.id, action: "auth.password_changed", ip: clientIp(request) });

  // Every existing token is now invalid, including this one — send them back in.
  return clearSessionCookie(
    NextResponse.json({
      ok: true,
      data: { redirectTo: "/login", message: "Password updated. Please sign in again." },
    }),
  );
});
