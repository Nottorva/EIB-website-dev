// CRM-only events. The CRM roles read; the super admin creates.
import { guarded, readJson } from "@/lib/auth";
import { listEvents, createEvent } from "@/lib/data/events";

const CRM_ROLES = ["superAdmin", "studentLeader", "advancement"];

export const GET = guarded(CRM_ROLES, async () => Response.json({ events: await listEvents() }));

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  return Response.json(await createEvent(body), { status: 201 });
});
