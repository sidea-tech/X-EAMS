import { revalidatePath } from "next/cache";
import { punch } from "@/lib/attendance";
import { audit } from "@/lib/audit";
import { clientIp, handler, ok, parseJson, rateLimit } from "@/lib/http";
import { requireApi } from "@/lib/session";
import { formatTime } from "@/lib/time";
import { punchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (request: Request) => {
  const user = await requireApi("EMPLOYEE");
  const { action } = await parseJson(request, punchSchema);
  const ip = clientIp(request);

  rateLimit(`punch:${user.id}`, 12, 60_000);

  const result = await punch(user.id, action, ip);

  await audit({
    actorId: user.id,
    action: action === "IN" ? "attendance.check_in" : "attendance.check_out",
    entity: "Attendance",
    entityId: result.dayKey,
    detail: `at=${result.at.toISOString()} worked=${result.workedMinutes}m`,
    ip,
  });

  revalidatePath("/employee");

  return ok({
    ...result,
    at: result.at.toISOString(),
    message:
      action === "IN"
        ? `Checked in at ${formatTime(result.at)}.`
        : `Checked out at ${formatTime(result.at)}.`,
  });
});
