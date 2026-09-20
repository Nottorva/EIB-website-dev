// LOCAL DEVELOPMENT ONLY. Sets the "viewing as" cookie used by src/lib/auth.js
// when Google sign-in is not configured. Disabled in production builds and
// whenever AUTH_GOOGLE_* is set, so it can never be reached on Vercel.
//
//   GET  /api/dev/switch-user?email=amara.chen@tfs.ca   -> sets cookie, redirects to /
//   POST /api/dev/switch-user  { email }                 -> sets cookie (used by tests)
// Any email works, like Google would hand us any account: an email with no
// allow-list row behaves as an applicant (sent to /apply). Use "__stranger__"
// to simulate someone not signed in at all.
import { cookies } from "next/headers";
import { DEV_COOKIE, open, readJson, HttpError } from "@/lib/auth";
import { authEnabled } from "@/lib/nextauth";

const available = () => !authEnabled && process.env.NODE_ENV !== "production";

async function setViewingAs(email) {
  if (!email) throw new HttpError(400, "email is required.");
  const jar = await cookies();
  jar.set(DEV_COOKIE, String(email).trim().toLowerCase(), { path: "/", httpOnly: true, sameSite: "lax" });
}

export const GET = open(async ({ req }) => {
  if (!available()) throw new HttpError(404, "Not found.");
  const url = new URL(req.url);
  await setViewingAs(url.searchParams.get("email"));
  return Response.redirect(new URL("/platform", url.origin), 303);
});

export const POST = open(async ({ req }) => {
  if (!available()) throw new HttpError(404, "Not found.");
  const { email } = await readJson(req);
  await setViewingAs(email);
  return Response.json({ ok: true });
});
