// SANDBOX stand-in for "Sign in with your TFS Google account" on /apply.
// POST { name, email } sets the applicant cookie; DELETE clears it.
// Replace with the NextAuth Google sign-in flow in production.
import { cookies } from "next/headers";
import { open, readJson, HttpError } from "@/lib/auth";
import { APPLICANT_COOKIE, emailOnDomain } from "@/lib/applicant";
import { getApplicationWindow } from "@/lib/data/settings";
import { authEnabled } from "@/lib/nextauth";

export const POST = open(async ({ req }) => {
  if (authEnabled || process.env.NODE_ENV === "production") throw new HttpError(404, "Use Google sign-in.");
  const { name, email } = await readJson(req);
  if (!String(name || "").trim() || !String(email || "").includes("@")) throw new HttpError(400, "Name and email are required.");
  const win = await getApplicationWindow();
  if (!emailOnDomain(email, win.applicantDomain)) {
    throw new HttpError(403, `Please sign in with your @${win.applicantDomain} account.`);
  }
  const jar = await cookies();
  jar.set(APPLICANT_COOKIE, JSON.stringify({ name: String(name).trim(), email: String(email).trim().toLowerCase() }), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  return Response.json({ ok: true });
});

export const DELETE = open(async () => {
  const jar = await cookies();
  jar.delete(APPLICANT_COOKIE);
  return Response.json({ ok: true });
});
