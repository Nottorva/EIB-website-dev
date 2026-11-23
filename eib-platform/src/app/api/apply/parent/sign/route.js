// Public, no sign-in: the parent signs the Student Agreement from their
// emailed link. POST { token, readConfirmed, parentSignature,
// parentRelationship, parentConfirmed, answers }. Their signature alone
// completes the agreement.
import { open, readJson, HttpError } from "@/lib/auth";
import { openParentLink } from "@/lib/data/parentSignup";
import { recordParentAgreement } from "@/lib/data/agreement";

export const POST = open(async ({ req }) => {
  const body = await readJson(req);
  const link = await openParentLink(body.token, { origin: new URL(req.url).origin });
  if (link.state === "invalid") throw new HttpError(404, "This link is not recognised or has expired.");
  if (link.state !== "seat" || !link.application.studentId) throw new HttpError(409, "There is no seat to sign for yet.");
  const result = await recordParentAgreement(link.application.studentId, link.application.parent, body);
  if (result.error) throw new HttpError(400, result.error);
  return Response.json({ ok: true, agreement: result.record });
});
