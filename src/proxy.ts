import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, homePathFor, verifySession } from "@/lib/jwt";

/**
 * Edge gate: cheap JWT + role routing so unauthenticated traffic never reaches
 * a page or handler. Pages and API routes still re-verify against the database
 * (see `getCurrentUser`) — this layer is defence in depth, not the only check.
 *
 * Lives in `proxy.ts`: Next.js 16 renamed the `middleware` file convention.
 */

const PUBLIC_PAGES = new Set(["/login"]);
const PUBLIC_APIS = new Set(["/api/auth/login", "/api/health", "/api/bootstrap"]);

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (PUBLIC_APIS.has(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (PUBLIC_PAGES.has(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL(homePathFor(session.role), request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: "Your session has expired. Please sign in again." },
        { status: 401 },
      );
    }
    const login = new URL("/login", request.url);
    // Only same-site relative targets are echoed back, to avoid open redirects.
    if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(homePathFor(session.role), request.url));
  }

  const wantsAdmin = pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/");
  if (wantsAdmin && session.role !== "ADMIN") {
    if (isApi) {
      return NextResponse.json(
        { ok: false, error: "Administrator access is required." },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL(homePathFor(session.role), request.url));
  }

  const wantsEmployee = pathname === "/employee" || pathname.startsWith("/employee/");
  if (wantsEmployee && session.role !== "EMPLOYEE") {
    return NextResponse.redirect(new URL(homePathFor(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
