import { getTodayState } from "@/lib/attendance";
import { handler, ok } from "@/lib/http";
import { requireApi } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireApi("EMPLOYEE");
  const state = await getTodayState(user.id);
  return ok({
    dayKey: state.dayKey,
    isCheckedIn: state.isCheckedIn,
    openSince: state.openSince?.toISOString() ?? null,
    firstCheckIn: state.firstCheckIn?.toISOString() ?? null,
    lastCheckOut: state.lastCheckOut?.toISOString() ?? null,
    workedMinutes: state.workedMinutes,
    status: state.status,
    isLate: state.isLate,
    sessions: state.sessions.map((s) => ({
      id: s.id,
      checkInAt: s.checkInAt.toISOString(),
      checkOutAt: s.checkOutAt?.toISOString() ?? null,
    })),
  });
});
