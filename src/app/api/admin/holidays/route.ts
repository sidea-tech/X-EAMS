import { audit } from "@/lib/audit";
import { clientIp, handler, ok, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireApi } from "@/lib/session";
import { dateFromDayKey } from "@/lib/time";
import { holidaySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const POST = handler(async (request: Request) => {
  const admin = await requireApi("ADMIN");
  const input = await parseJson(request, holidaySchema);

  const holiday = await prisma.holiday.create({
    data: { date: dateFromDayKey(input.date), name: input.name },
  });

  await audit({
    actorId: admin.id,
    action: "holiday.created",
    entity: "Holiday",
    entityId: holiday.id,
    detail: `${input.date} ${input.name}`,
    ip: clientIp(request),
  });

  return ok({ holiday: { id: holiday.id, date: input.date, name: holiday.name } });
});
