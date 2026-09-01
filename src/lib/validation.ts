import { z } from "zod";
import { passwordProblem } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v && v.length ? v : null));

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Username must be at least 3 characters.")
  .max(40, "Username must be 40 characters or fewer.")
  .regex(/^[a-z0-9._-]+$/, "Username may only contain letters, numbers, dot, underscore and hyphen.");

export const passwordSchema = z.string().superRefine((value, ctx) => {
  const problem = passwordProblem(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

export const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.");

export const monthKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format.");

export const attendanceStatusSchema = z.enum([
  "PRESENT",
  "HALF_DAY",
  "ABSENT",
  "ON_LEAVE",
  "HOLIDAY",
  "WEEK_OFF",
]);

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(40),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const punchSchema = z.object({
  action: z.enum(["IN", "OUT"]),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmPassword"],
  });

export const createEmployeeSchema = z.object({
  employeeCode: trimmed(24)
    .min(1, "Employee code is required.")
    .regex(/^[A-Za-z0-9/-]+$/, "Employee code may only contain letters, numbers, hyphen and slash."),
  fullName: trimmed(120).min(2, "Full name is required."),
  username: usernameSchema,
  password: passwordSchema.optional(),
  email: optionalText(160).refine((v) => v === null || EMAIL_RE.test(v), {
    message: "Enter a valid email address.",
  }),
  phone: optionalText(24),
  department: optionalText(80),
  designation: optionalText(80),
  role: z.enum(["EMPLOYEE", "ADMIN"]).default("EMPLOYEE"),
  joinedAt: dayKeySchema.optional(),
});

export const updateEmployeeSchema = z.object({
  fullName: trimmed(120).min(2, "Full name is required.").optional(),
  email: optionalText(160).refine((v) => v === null || v === undefined || EMAIL_RE.test(v), {
    message: "Enter a valid email address.",
  }),
  phone: optionalText(24),
  department: optionalText(80),
  designation: optionalText(80),
  role: z.enum(["EMPLOYEE", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  joinedAt: dayKeySchema.optional(),
});

export const adminAttendanceSchema = z
  .object({
    userId: z.string().min(1, "Select an employee."),
    date: dayKeySchema,
    /** "HH:mm" in company time, or empty to clear. */
    checkIn: z.string().regex(/^(\d{1,2}:\d{2})?$/, "Use HH:mm.").optional(),
    checkOut: z.string().regex(/^(\d{1,2}:\d{2})?$/, "Use HH:mm.").optional(),
    status: attendanceStatusSchema.optional(),
    note: optionalText(300),
  })
  .strict();

export const policySchema = z.object({
  workStart: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:mm."),
  workEnd: z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:mm."),
  graceMinutes: z.coerce.number().int().min(0).max(240),
  fullDayMinutes: z.coerce.number().int().min(60).max(1440),
  halfDayMinutes: z.coerce.number().int().min(30).max(1440),
  workingDays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one working day."),
  timezone: trimmed(64).min(1),
}).refine((v) => v.halfDayMinutes <= v.fullDayMinutes, {
  message: "Half-day minutes cannot exceed full-day minutes.",
  path: ["halfDayMinutes"],
});

export const holidaySchema = z.object({
  date: dayKeySchema,
  name: trimmed(120).min(2, "Holiday name is required."),
});

/* ------------------------------------------- per-employee schedule override */

/**
 * A field left blank means "inherit the company default", so empty string,
 * null and a missing key all normalise to null.
 */
function inheritable<S extends z.ZodTypeAny>(inner: S) {
  return z
    // The blank/null members must come FIRST: a union takes the first matching
    // option, and `z.coerce.number()` happily turns "" into 0 — which would
    // record a real "0 minutes" override where the admin meant "inherit".
    .union([z.literal(""), z.null(), inner])
    .optional()
    .transform((value) => (value === "" || value === null || value === undefined ? null : value));
}

export const scheduleSchema = z
  .object({
    workStart: inheritable(z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:mm.")),
    workEnd: inheritable(z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:mm.")),
    graceMinutes: inheritable(z.coerce.number().int().min(0).max(240)),
    fullDayMinutes: inheritable(z.coerce.number().int().min(60).max(1440)),
    halfDayMinutes: inheritable(z.coerce.number().int().min(30).max(1440)),
    workingDays: z
      .array(z.coerce.number().int().min(0).max(6))
      .max(7)
      .optional()
      .transform((v) => [...new Set(v ?? [])].sort((a, b) => a - b)),
    timezone: inheritable(trimmed(64).min(1)),
    note: inheritable(trimmed(300).min(1)),
  })
  .refine(
    (v) =>
      v.fullDayMinutes === null ||
      v.halfDayMinutes === null ||
      v.halfDayMinutes <= v.fullDayMinutes,
    { message: "Half-day minutes cannot exceed full-day minutes.", path: ["halfDayMinutes"] },
  );
