// LOCAL DEVELOPMENT ONLY. Sets the "viewing as" cookie used by src/lib/auth.js
// when Google sign-in is not configured. Disabled in production builds and
// whenever AUTH_GOOGLE_* is set, so it can never be reached on Vercel.
//
//   GET  /api/dev/switch-user?email=amara.chen@tfs.ca   -> sets cookie, redirects to /
//   POST /api/dev/switch-user  { email }                 -> sets cookie (used by tests)
// Use email "__stranger__" to simulate someone not on the allow-list.
import { cookies } from "next/headers";
import { DEV_COOKIE, NO_ACCESS_SENTINEL, open, readJson, HttpError } from "@/lib/auth";
import { getUserByEmail } from "@/lib/data/users";
import { authEnabled } from "@/lib/nextauth";

const available = () => !authEnabled && process.env.NODE_ENV !== "production";

async function setViewingAs(email) {
  if (!email) throw new HttpError(400, "email is required.");
  if (email !== NO_ACCESS_SENTINEL) {
    const user = await getUserByEmail(email);
    if (!user) throw new HttpError(404, `No such user on the allow-list: ${email}`);
  }
  const jar = await cookies();
  jar.set(DEV_COOKIE, email, { path: "/", httpOnly: true, sameSite: "lax" });
}

export const GET = open(async ({ req }) => {
  if (!available()) throw new HttpError(404, "Not found.");
  const url = new URL(req.url);
  await setViewingAs(url.searchParams.get("email"));
  return Response.redirect(new URL("/", url.origin), 303);
});

export const POST = open(async ({ req }) => {
  if (!available()) throw new HttpError(404, "Not found.");
  const { email } = await readJson(req);
  await setViewingAs(email);
  return Response.json({ ok: true });
});
