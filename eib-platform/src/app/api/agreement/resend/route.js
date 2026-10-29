// Send the guardian a fresh confirmation link. A student resends their own
// (rate limited); the super admin may resend for any student by userId.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { issueConfirmation, publicRecord } from "@/lib/data/agreement";

export const POST = guarded(["student", "superAdmin"], async ({ req, user }) => {
  const body = await readJson(req).catch(() => ({}));
  const byAdmin = user.role === "superAdmin";
  const targetId = byAdmin ? body.userId : user.id;
  if (!targetId) throw new HttpError(400, "userId is required.");
  const result = await issueConfirmation(targetId, { origin: new URL(req.url).origin, byAdmin });
  if (result.error) throw new HttpError(result.status || 400, result.error);
  return Response.json({ ok: true, agreement: publicRecord(result.record) });
});
