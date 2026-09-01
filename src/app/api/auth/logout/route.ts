import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { clientIp, handler } from "@/lib/http";
import { clearSessionCookie, getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = handler(async (request: Request) => {
  const user = await getCurrentUser();
  if (user) {
    await audit({ actorId: user.id, action: "auth.logout", ip: clientIp(request) });
  }
  return clearSessionCookie(NextResponse.json({ ok: true, data: { redirectTo: "/login" } }));
});
