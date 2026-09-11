import { guarded, HttpError } from "@/lib/auth";
import { getUser, deleteUser } from "@/lib/data/users";

export const DELETE = guarded(["superAdmin"], async ({ params, user }) => {
  const target = await getUser(params.id);
  if (!target) throw new HttpError(404, "User not found.");
  if (target.role !== "studentLeader") throw new HttpError(403, "Only student leader accounts can be removed here.");
  if (target.id === user.id) throw new HttpError(400, "You cannot remove yourself.");
  await deleteUser(params.id);
  return Response.json({ ok: true });
});
