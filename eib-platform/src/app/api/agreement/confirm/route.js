// The link in the guardian's email. Public: the token is the proof. Marks
// the agreement signed and sends the guardian to a plain result page.
// POST with { token } from that page asks for a fresh link when the old one
// has expired.
import { open, readJson, HttpError } from "@/lib/auth";
import { confirmAgreement, resendFromToken } from "@/lib/data/agreement";

export const GET = open(async ({ req }) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const result = await confirmAgreement(token);
  const target = new URL("/agreement/confirmed", url.origin);
  target.searchParams.set("state", result.state);
  if (result.user) target.searchParams.set("student", result.user.name);
  if (result.state === "expired") target.searchParams.set("token", token);
  return Response.redirect(target, 303);
});

export const POST = open(async ({ req }) => {
  const body = await readJson(req);
  const result = await resendFromToken(String(body.token || ""), { origin: new URL(req.url).origin });
  if (result.error) throw new HttpError(result.status || 400, result.error);
  return Response.json({ ok: true });
});
