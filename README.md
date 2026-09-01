# X-EAMS — Employee Attendance Management System

Two portals over one attendance record: employees punch IN/OUT, administrators
manage people, correct records and export for payroll.

Built with Next.js 16 (App Router), TypeScript, Prisma + PostgreSQL and Tailwind CSS v4.

---

## Features

### Employee portal (`/employee`)
- **Live punch panel** — one-tap Check IN / Check OUT with a running worked-time
  clock and progress against a full working day.
- **Multiple sessions per day** — breaks and split shifts are recorded as
  separate IN→OUT pairs and summed into the day's total.
- **Monthly timesheet** — calendar heat grid plus a daily table with in/out
  times, worked hours, late/early flags and notes.
- **Month-by-month history** and a personal attendance percentage.
- **Self-service password change** (signs out every device afterwards).

### Admin portal (`/admin`)
- **Daily roster** — every active employee's status for today, who is currently
  on the clock, late arrivals, and who has no record yet.
- **Employee management** — create accounts with auto-generated one-time
  passwords, edit profiles, promote/demote, deactivate, reset passwords, and
  delete accounts that have no attendance history.
- **Attendance corrections** — add or fix any employee-day; every change is
  stamped with the editing admin and written to the audit log.
- **Monthly reports** — per-employee present/half/absent/leave/late counts,
  total hours and attendance %, filterable by department.
- **CSV exports** for both raw attendance and the monthly summary (Excel-safe,
  with formula-injection neutralised).
- **Default work policy** — shift times, late grace, full/half-day thresholds,
  working weekdays and timezone.
- **Per-employee schedules** — give an individual a different shift, thresholds,
  working week or timezone; every unset field inherits the company default.
- **Holiday calendar** — excluded from expected working days everywhere.
- **Audit trail** of sign-ins, punches, corrections and admin actions.

### Security
- Username/password with **bcrypt** (cost 12); passwords are never logged.
- Session as an **HS256 JWT in an HttpOnly, SameSite=Lax, Secure cookie**.
- **Two-layer authorisation**: the edge proxy gates routes on the token, then
  every page and API handler re-validates against the database — so
  deactivations and password changes take effect immediately, not at expiry.
- **Session revocation** via a per-user `tokenVersion`, bumped on password
  change, reset, role change and deactivation.
- **Per-account lockout** after 5 failed attempts (15 minutes), plus per-IP and
  per-username rate limiting on login.
- Login errors are deliberately vague and timing-padded so the form cannot be
  used to enumerate usernames.
- Safety rails: an admin cannot demote, deactivate or delete themselves, and the
  last active administrator cannot be removed.

---

## Local development

**Requirements:** Node 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and AUTH_SECRET
npm run db:deploy             # apply migrations
npm run db:seed               # create the work policy + first administrator
npm run dev                   # http://localhost:3000
```

Need a throwaway database?

```bash
docker run -d --name eams-pg \
  -e POSTGRES_USER=eams -e POSTGRES_PASSWORD=eams -e POSTGRES_DB=eams \
  -p 55432:5432 postgres:16-alpine
# then in .env.local:
# DATABASE_URL="postgresql://eams:eams@127.0.0.1:55432/eams"
```

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL connection string. |
| `AUTH_SECRET` | yes | — | JWT signing key, **minimum 32 characters**. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `SESSION_TTL_HOURS` | no | `9` | Session lifetime. |
| `APP_TIMEZONE` | no | `Asia/Kolkata` | Fallback company timezone (the saved work policy wins once set). |
| `APP_NAME` | no | `X-EAMS` | Product name in the UI. |
| `SEED_ADMIN_USERNAME` | seed only | `admin` | First administrator's username. |
| `SEED_ADMIN_PASSWORD` | seed only | `Admin@12345` | First administrator's password — **change it**. |
| `SEED_DEMO_DATA` | seed only | `false` | `true` also creates 8 demo employees with 45 days of backdated attendance. |
| `BOOTSTRAP_TOKEN` | no | unset | When set (16+ chars), enables the one-time `POST /api/bootstrap` first-admin endpoint. Remove it once used. |

Rotating `AUTH_SECRET` invalidates every active session — a valid emergency
"sign everyone out" lever.

### Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` | `prisma generate` + `prisma migrate deploy` + production build. |
| `npm run build:no-migrate` | Build without applying migrations. |
| `npm start` | Serve the production build. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint. |
| `npm run db:deploy` | Apply migrations (production-safe). |
| `npm run db:migrate` | Create a new migration during development. |
| `npm run db:seed` | Idempotent seed. |
| `npm run db:setup` | `db:deploy` then `db:seed`. |
| `npm run db:studio` | Prisma Studio. |
| `npm run create-admin` | Create or reset an administrator (works over HTTPS). |

---

## Deploying to Vercel

1. Push this repository to GitHub and import it in Vercel (or run `vercel`).
2. Set **Environment Variables** for Production, Preview and Development:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `APP_TIMEZONE`, `APP_NAME` (optional)
3. Deploy. `npm run build` runs `prisma generate` automatically, and
   `postinstall` covers preview builds.
4. **Schema migrations run automatically.** The build script is
   `prisma generate && prisma migrate deploy && next build`, so each deployment
   applies any pending migrations from Vercel's network. If you would rather run
   migrations from CI, switch the Vercel build command to `npm run build:no-migrate`.
5. **Create the first administrator.** Two options:

   *If you can reach the database directly:*
   ```bash
   DATABASE_URL="<production url>" SEED_ADMIN_PASSWORD="<strong password>" npm run db:seed
   ```

   *If the database is only reachable from the deployment* (common with managed
   Postgres behind a corporate firewall), set a `BOOTSTRAP_TOKEN` environment
   variable in Vercel — any long random string — redeploy, then call the
   one-time endpoint:
   ```bash
   curl -X POST https://<your-app>.vercel.app/api/bootstrap \
     -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" \
     -H "content-type: application/json" \
     -d '{"username":"admin","password":"<strong password>","fullName":"HR Administrator"}'
   ```
   The endpoint is inert without the token and refuses to run once any
   administrator exists. **Delete `BOOTSTRAP_TOKEN` from Vercel afterwards.**
6. Sign in at `/login` and add your employees from **Admin → Employees**.

### Creating an admin when port 5432 is blocked

Many corporate networks block outbound PostgreSQL. Prisma Postgres also exposes
your database over **HTTPS**, so the admin script works from anywhere:

```bash
# Connection strings → the string beginning prisma+postgres://
ADMIN_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=..." \
  npm run create-admin -- admin 'YourStrongPass1' 'HR Administrator'
```

Re-running it for an existing username resets that password, clears any lockout
and restores the account to an active administrator — so it is also the recovery
path if you are ever locked out of every admin account.

`GET /api/health` returns `{ ok, database }` for uptime monitoring.

---

## Per-employee schedules

The `WorkPolicy` row is the company default. An employee may additionally have an
`EmployeeSchedule` row holding **only the fields that differ** — every other
field inherits, so putting someone on an early shift needs just two values:

| Field | Company default | Riya's override | Effective |
| --- | --- | --- | --- |
| Shift | 09:30–18:30 | 06:00–14:00 | **06:00–14:00** |
| Late grace | 15 min | *(blank)* | **15 min** |
| Full day | 480 min | 360 min | **360 min** |
| Working days | Mon–Fri | *(blank)* | **Mon–Fri** |

Set them in **Admin → Employees → Schedule**. A blank field shows the company
value it will inherit, and **Follow company default** clears every override —
which deletes the row rather than leaving a no-op behind.

The effective policy drives everything for that person: their day boundary, late
detection, full/half-day classification, and the expected working days their
attendance percentage is measured against. Two employees can therefore log the
same six hours and be recorded as `PRESENT` and `HALF_DAY` respectively.

**Timezone overrides** are resolved per employee, so admin corrections entered as
`HH:mm` are interpreted in *that employee's* wall clock and the CSV export carries
a Timezone column. The admin dashboard's notion of "today" stays on the company
timezone.

## How attendance is calculated

- **Day bucketing.** A "day" is a calendar day in the *company* timezone, stored
  as UTC midnight of that key. Server locale and DST never shift a record into
  the wrong day (see `src/lib/time.ts`).
- **Sessions are the source of truth.** `PunchSession` rows hold each IN→OUT
  pair; `Attendance` caches the roll-up (first in, last out, total minutes,
  status, flags) and is recomputed from sessions on every change.
- **Effective policy.** Every calculation resolves the employee's own schedule
  merged over the company default; reports batch this into one query rather than
  one per employee.
- **Status.** `workedMinutes >= fullDayMinutes` → `PRESENT`, otherwise
  `HALF_DAY`. `ABSENT` is never derived from a punch — it means a working day
  with no record at all, or an explicit admin override. Admin-set `ON_LEAVE`,
  `HOLIDAY` and `WEEK_OFF` are never overwritten by later punches.
- **Late / early.** Compared against the policy's shift start (plus grace) and
  shift end, in company time.
- **Expected working days** exclude non-working weekdays, holidays, and any date
  in the future — so a mid-month report is never unfairly penalised.

## Project layout

```
prisma/
  schema.prisma            # User, Attendance, PunchSession, WorkPolicy,
                           # EmployeeSchedule, Holiday, AuditLog
  migrations/              # committed SQL migrations
  seed.ts                  # idempotent bootstrap + optional demo data
src/
  proxy.ts                 # edge auth/role gate (Next 16 "proxy" convention)
  lib/
    jwt.ts                 # edge-safe token sign/verify
    auth.ts                # bcrypt, lockout, password rules
    session.ts             # getCurrentUser + requirePage/requireApi guards
    attendance.ts          # punch, recompute, admin upsert, summaries
    time.ts                # timezone-correct day keys and wall-clock conversion
    policy.ts, csv.ts, http.ts, audit.ts, validation.ts
  app/
    login/                 # shared sign-in
    employee/              # employee portal
    admin/                 # admin portal
    api/                   # REST handlers
  components/              # UI primitives, shell, portal components
```

## Notes and limitations

- **Portals are role-exclusive.** An `ADMIN` uses `/admin` and an `EMPLOYEE`
  uses `/employee`; admins do not punch. Give an administrator who also needs to
  record attendance a second employee account.
- **Login rate limiting is per warm serverless instance.** The per-account
  lockout is the durable defence; put a WAF in front for network-level limits.
- Attendance list views are capped (1000 records on screen, 20 000 per export).
  Add pagination before running very large orgs off the UI.
- **Overnight shifts that cross midnight are not fully modelled.** A schedule
  such as 22:00–06:00 is accepted, and late detection against the 22:00 start
  works, but the day bucket is still the calendar day of the check-in — so one
  night's work is split across two attendance records, and the early-out flag is
  unreliable for those shifts. Treat night-shift totals as per-calendar-day.
- There is no geofencing, device binding, or leave-request workflow — leave is
  recorded by an administrator setting `ON_LEAVE` on a day.
