// Super admin only: correct the guardian's email on a student's pending
// agreement. The link sent to the old address stops working and a fresh
// confirmation email goes to the new one.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { changeGuardianEmail, publicRecord } from "@/lib/data/agreement";

export const PUT = guarded(["superAdmin"], async ({ req, user }) => {
  const body = await readJson(req).catch(() => ({}));
  if (!body.userId) throw new HttpError(400, "userId is required.");
  const result = await changeGuardianEmail(body.userId, body.parentEmail, { origin: new URL(req.url).origin, by: user.email });
  if (result.error) throw new HttpError(result.status || 400, result.error);
  return Response.json({ ok: true, agreement: publicRecord(result.record), warning: result.warning || null });
});
