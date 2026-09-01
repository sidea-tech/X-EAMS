import type { Metadata } from "next";
import Image from "next/image";
import { BrandMark } from "@/components/Brand";
import { LoginForm } from "@/components/LoginForm";
import { Alert } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/lib/appConfig";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

async function needsSetup(): Promise<boolean> {
  try {
    return (await prisma.user.count({ where: { role: "ADMIN" } })) === 0;
  } catch {
    // A database that is unreachable should not block the login screen.
    return false;
  }
}

const HIGHLIGHTS = [
  ["One-tap IN / OUT", "Employees punch in and out from any device, with breaks tracked as separate sessions."],
  ["Accurate day totals", "Worked hours, late arrivals and early exits are calculated against your company policy."],
  ["Admin oversight", "Live daily roster, corrections with an audit trail, and CSV exports for payroll."],
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const setup = await needsSetup();

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-brand px-12 py-12 text-brand-fg lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 12%, rgba(255,255,255,.55), transparent 42%), radial-gradient(circle at 82% 78%, rgba(255,255,255,.35), transparent 46%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <Image
            src="/Xicon.png"
            alt=""
            width={40}
            height={40}
            priority
            className="rounded-full ring-1 ring-white/20"
          />
          <div className="leading-tight">
            <p className="font-semibold">{APP_NAME}</p>
            <p className="text-xs text-white/75">{APP_TAGLINE}</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Attendance that reconciles itself.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            A single record of truth for every working day — from the first check-in to the payroll
            export.
          </p>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-white/20">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs leading-relaxed text-white/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          Authorised personnel only. Activity on this system is logged.
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <BrandMark size={44} />
            <p className="mt-3 font-semibold">{APP_NAME}</p>
            <p className="text-xs text-muted">{APP_TAGLINE}</p>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">Sign in to your account</h2>
          <p className="mt-1 mb-6 text-sm text-muted">
            Employees and administrators use the same sign-in.
          </p>

          {setup ? (
            <Alert tone="warning" className="mb-4">
              No administrator account exists yet. Run <code className="font-mono">npm run db:seed</code>{" "}
              to create the first administrator.
            </Alert>
          ) : null}

          <LoginForm next={next ?? null} />
        </div>
      </section>
    </main>
  );
}
