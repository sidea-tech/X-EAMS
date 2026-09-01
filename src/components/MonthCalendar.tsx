import { WEEKDAY_SHORT } from "@/lib/policy";
import { dayKeyRange, weekdayOfDayKey } from "@/lib/time";
import { cx } from "@/components/ui";

export type CalendarDay = {
  status: string | null;
  workedMinutes: number;
  isLate: boolean;
};

const TONE: Record<string, string> = {
  PRESENT: "bg-ok-soft text-ok border-ok/30",
  HALF_DAY: "bg-warn-soft text-warn border-warn/30",
  ABSENT: "bg-danger-soft text-danger border-danger/30",
  ON_LEAVE: "bg-info-soft text-info border-info/30",
  HOLIDAY: "bg-brand-soft text-brand-soft-fg border-brand/30",
  WEEK_OFF: "bg-surface-2 text-subtle border-line",
};

const LEGEND: [string, string][] = [
  ["PRESENT", "Present"],
  ["HALF_DAY", "Half day"],
  ["ABSENT", "Absent"],
  ["ON_LEAVE", "Leave"],
  ["HOLIDAY", "Holiday"],
  ["WEEK_OFF", "Week off"],
];

/**
 * Month grid of one employee's days. `days` is keyed by "YYYY-MM-DD"; keys not
 * present render as untracked (future days, or days before joining).
 */
export function MonthCalendar({
  from,
  to,
  days,
  workingDays,
  todayKey,
}: {
  from: string;
  to: string;
  days: Record<string, CalendarDay>;
  workingDays: number[];
  todayKey: string;
}) {
  const keys = dayKeyRange(from, to);
  const leadingBlanks = weekdayOfDayKey(from);

  return (
    <div className="p-5">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="pb-1 text-center text-[11px] font-semibold text-subtle">
            {label}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}

        {keys.map((key) => {
          const day = days[key];
          const dayNumber = Number(key.slice(8));
          const isWorkingDay = workingDays.includes(weekdayOfDayKey(key));
          const isFuture = key > todayKey;
          const tone = day?.status ? TONE[day.status] : null;

          return (
            <div
              key={key}
              title={
                day
                  ? `${key} · ${day.status} · ${(day.workedMinutes / 60).toFixed(2)}h`
                  : isFuture
                    ? `${key} · upcoming`
                    : `${key} · ${isWorkingDay ? "no record" : "non-working day"}`
              }
              className={cx(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg border text-xs",
                tone ??
                  (isFuture
                    ? "border-dashed border-line bg-surface text-subtle"
                    : isWorkingDay
                      ? "border-line bg-surface text-subtle"
                      : "border-line bg-surface-2 text-subtle"),
                key === todayKey && "ring-2 ring-brand ring-offset-1 ring-offset-surface",
              )}
            >
              <span className="nums font-semibold">{dayNumber}</span>
              {day && day.workedMinutes > 0 ? (
                <span className="nums text-[10px] opacity-80">
                  {(day.workedMinutes / 60).toFixed(1)}h
                </span>
              ) : null}
              {day?.isLate ? (
                <span
                  aria-hidden
                  className="absolute top-1 right-1 size-1.5 rounded-full bg-warn"
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {LEGEND.map(([status, label]) => (
          <li key={status} className="flex items-center gap-1.5 text-xs text-muted">
            <span className={cx("size-3 rounded border", TONE[status])} />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-warn" />
          Late arrival
        </li>
      </ul>
    </div>
  );
}
