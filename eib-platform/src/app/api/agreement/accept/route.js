// A student submits the signing form. The record is saved as pending and
// the guardian is emailed a confirmation link.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { recordAgreement } from "@/lib/data/agreement";

export const POST = guarded(["student"], async ({ req, user }) => {
  const body = await readJson(req);
  const result = await recordAgreement(user, body, { origin: new URL(req.url).origin });
  if (result.error) throw new HttpError(400, result.error);
  return Response.json({ ok: true, agreement: result.record, warning: result.warning || null });
});
