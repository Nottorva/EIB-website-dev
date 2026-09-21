import { guarded, readJson, HttpError } from "@/lib/auth";
import { getApplication, setStatus, deleteApplicant } from "@/lib/data/applications";

const MANAGER_ROLES = ["superAdmin", "studentLeader"];

export const GET = guarded(MANAGER_ROLES, async ({ params }) => {
  const app = await getApplication(params.id);
  if (!app) throw new HttpError(404, "Application not found.");
  return Response.json(app);
});

// DELETE (super admin): remove the application, the student account it
// created and that account's submissions. A clean slate for that email.
export const DELETE = guarded(["superAdmin"], async ({ params }) => {
  const removed = await deleteApplicant(params.id);
  if (!removed) throw new HttpError(404, "Application not found.");
  return Response.json({ ok: true, removed });
});

// PATCH { status } - the review step; accounts are created on release.
export const PATCH = guarded(MANAGER_ROLES, async ({ req, params }) => {
  const body = await readJson(req);
  if (!body.status) throw new HttpError(400, "status is required.");
  const saved = await setStatus(params.id, body.status);
  if (!saved) throw new HttpError(404, "Application not found.");
  return Response.json(saved);
});
