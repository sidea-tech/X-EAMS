/** Fails fast at boot with an actionable message instead of a blank 500. */
export function assertServerConfig(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    missing.push("AUTH_SECRET (min 32 characters)");
  }
  if (missing.length) {
    throw new Error(
      `Missing or invalid environment variables: ${missing.join(", ")}. ` +
        "Set them in .env for local development, or in the Vercel project settings.",
    );
  }
}

export const APP_NAME = process.env.APP_NAME || "X-EAMS";
export const APP_TAGLINE = "Employee Attendance Management";
