import { guarded, readJson, HttpError } from "@/lib/auth";
import { getApplication, setStatus } from "@/lib/data/applications";

const MANAGER_ROLES = ["superAdmin", "studentLeader"];

export const GET = guarded(MANAGER_ROLES, async ({ params }) => {
  const app = await getApplication(params.id);
  if (!app) throw new HttpError(404, "Application not found.");
  return Response.json(app);
});

// PATCH { status } - approving also creates the student's `users` row.
export const PATCH = guarded(MANAGER_ROLES, async ({ req, params }) => {
  const body = await readJson(req);
  if (!body.status) throw new HttpError(400, "status is required.");
  const saved = await setStatus(params.id, body.status);
  if (!saved) throw new HttpError(404, "Application not found.");
  return Response.json(saved);
});
