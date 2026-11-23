import { guarded, readJson, HttpError } from "@/lib/auth";
import { getApplication, setStatus, setPaid, deleteApplicant } from "@/lib/data/applications";

const MANAGER_ROLES = ["superAdmin", "studentLeader"];

export const GET = guarded(MANAGER_ROLES, async ({ params }) => {
  const app = await getApplication(params.id);
  if (!app) throw new HttpError(404, "Application not found.");
  return Response.json(app);
});

// DELETE (super admin): remove the sign-up, the student account it created
// and that account's submissions. A clean slate for that email. A freed seat
// goes to the first person on the waitlist.
export const DELETE = guarded(["superAdmin"], async ({ req, params }) => {
  const removed = await deleteApplicant(params.id, { origin: new URL(req.url).origin });
  if (!removed) throw new HttpError(404, "Application not found.");
  return Response.json({ ok: true, removed });
});

// PATCH { status }: "approved" gives the person a seat and an account at once.
// PATCH { paid: true | false }: tick or untick the program fee.
export const PATCH = guarded(["superAdmin"], async ({ req, params, user }) => {
  const body = await readJson(req);
  if (!body.status && typeof body.paid !== "boolean") throw new HttpError(400, "status or paid is required.");
  let saved = body.status ? await setStatus(params.id, body.status, { origin: new URL(req.url).origin }) : await getApplication(params.id);
  if (saved && typeof body.paid === "boolean") saved = await setPaid(params.id, body.paid, user.email);
  if (!saved) throw new HttpError(404, "Application not found.");
  return Response.json(saved);
});
