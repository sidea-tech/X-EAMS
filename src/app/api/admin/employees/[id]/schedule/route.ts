import { audit } from "@/lib/audit";
import { badRequest, clientIp, handler, notFound, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  getPolicy,
  getPolicyFor,
  hasOverrides,
  overrideSummary,
  saveOverride,
} from "@/lib/policy";
import { requireApi } from "@/lib/session";
import { scheduleSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Replaces one employee's schedule overrides. Blank fields inherit the default. */
export const PUT = handler(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireApi("ADMIN");
    const { id } = await params;

    const employee = await prisma.user.findUnique({
      where: { id },
      select: { id: true, employeeCode: true, fullName: true },
    });
    if (!employee) throw notFound("Employee not found.");

    const input = await parseJson(request, scheduleSchema);

    if (input.timezone) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
      } catch {
        throw badRequest(`"${input.timezone}" is not a valid IANA timezone (e.g. Asia/Kolkata).`);
      }
    }

    const saved = await saveOverride(id, input, admin.id);
    const base = await getPolicy();
    const effective = await getPolicyFor(id);

    const description = saved && hasOverrides(saved) ? overrideSummary(saved, base).join(", ") : "inherits default";

    await audit({
      actorId: admin.id,
      action: saved ? "schedule.updated" : "schedule.cleared",
      entity: "EmployeeSchedule",
      entityId: id,
      detail: `${employee.employeeCode}: ${description}`,
      ip: clientIp(request),
    });

    return ok({ override: saved, effective, customised: hasOverrides(saved) });
  },
);
