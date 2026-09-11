import { guarded, readJson, HttpError } from "@/lib/auth";
import { getMentor, updateMentor, deleteMentor } from "@/lib/data/mentors";

const CRM_ROLES = ["superAdmin", "studentLeader"];

export const GET = guarded(CRM_ROLES, async ({ params }) => {
  const m = await getMentor(params.id);
  if (!m) throw new HttpError(404, "Mentor not found.");
  return Response.json(m);
});

export const PATCH = guarded(CRM_ROLES, async ({ req, params }) => {
  const body = await readJson(req);
  const saved = await updateMentor(params.id, body);
  if (!saved) throw new HttpError(404, "Mentor not found.");
  return Response.json(saved);
});

export const DELETE = guarded(CRM_ROLES, async ({ params }) => {
  const ok = await deleteMentor(params.id);
  if (!ok) throw new HttpError(404, "Mentor not found.");
  return Response.json({ ok: true });
});
