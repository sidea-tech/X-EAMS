import { audit } from "@/lib/audit";
import { badRequest, clientIp, handler, ok, parseJson } from "@/lib/http";
import { savePolicy } from "@/lib/policy";
import { requireApi } from "@/lib/session";
import { policySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const PUT = handler(async (request: Request) => {
  const admin = await requireApi("ADMIN");
  const input = await parseJson(request, policySchema);

  try {
    // Rejects nonsense timezones before they poison every day calculation.
    new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
  } catch {
    throw badRequest(`"${input.timezone}" is not a valid IANA timezone (e.g. Asia/Kolkata).`);
  }

  const policy = await savePolicy({
    ...input,
    workingDays: [...new Set(input.workingDays)].sort((a, b) => a - b),
  });

  await audit({
    actorId: admin.id,
    action: "policy.updated",
    entity: "WorkPolicy",
    entityId: "default",
    detail: `${policy.workStart}-${policy.workEnd} grace=${policy.graceMinutes}m tz=${policy.timezone}`,
    ip: clientIp(request),
  });

  return ok({ policy });
});
