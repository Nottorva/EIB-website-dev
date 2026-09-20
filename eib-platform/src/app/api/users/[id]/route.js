import { guarded, readJson, HttpError } from "@/lib/auth";
import { getUser, deleteUser, setSuspended } from "@/lib/data/users";

export const DELETE = guarded(["superAdmin"], async ({ params, user }) => {
  const target = await getUser(params.id);
  if (!target) throw new HttpError(404, "User not found.");
  if (target.role !== "studentLeader") throw new HttpError(403, "Only student leader accounts can be removed here.");
  if (target.id === user.id) throw new HttpError(400, "You cannot remove yourself.");
  await deleteUser(params.id);
  return Response.json({ ok: true });
});

// PATCH { suspended: true | false } - suspend or reinstate a student account.
export const PATCH = guarded(["superAdmin"], async ({ req, params }) => {
  const body = await readJson(req);
  if (typeof body.suspended !== "boolean") throw new HttpError(400, "suspended (true/false) is required.");
  const target = await getUser(params.id);
  if (!target) throw new HttpError(404, "User not found.");
  if (target.role !== "student") throw new HttpError(403, "Only student accounts can be suspended here.");
  return Response.json(await setSuspended(params.id, body.suspended));
});
