// A student signs the current agreement.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { recordAgreement } from "@/lib/data/agreement";

export const POST = guarded(["student"], async ({ req, user }) => {
  const body = await readJson(req);
  const result = await recordAgreement(user, body);
  if (result.error) throw new HttpError(400, result.error);
  return Response.json({ ok: true, agreement: result.record });
});
