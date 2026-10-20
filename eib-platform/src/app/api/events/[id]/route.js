import { guarded, readJson, HttpError } from "@/lib/auth";
import { getEvent, updateEvent, deleteEvent, EVENT_FIELDS } from "@/lib/data/events";

const CRM_ROLES = ["superAdmin", "studentLeader", "advancement"];

export const GET = guarded(CRM_ROLES, async ({ params }) => {
  const ev = await getEvent(params.id);
  if (!ev) throw new HttpError(404, "Event not found.");
  return Response.json(ev);
});

// The super admin edits everything; the other CRM roles may only change who
// is on the event (mentorIds), the same way they assign mentors to lessons.
export const PATCH = guarded(CRM_ROLES, async ({ req, params, user }) => {
  const body = await readJson(req);
  const keys = user.role === "superAdmin" ? EVENT_FIELDS : ["mentorIds"];
  const extra = Object.keys(body).filter((k) => !keys.includes(k));
  if (extra.length) throw new HttpError(403, `Only ${keys.join(", ")} can be changed here (got ${extra.join(", ")}).`);
  const saved = await updateEvent(params.id, body, keys);
  if (!saved) throw new HttpError(404, "Event not found.");
  return Response.json(saved);
});

export const DELETE = guarded(["superAdmin"], async ({ params }) => {
  const ok = await deleteEvent(params.id);
  if (!ok) throw new HttpError(404, "Event not found.");
  return Response.json({ ok: true });
});
