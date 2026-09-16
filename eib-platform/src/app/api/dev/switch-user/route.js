// DEV ONLY. Sets the "viewing as" cookie used by src/lib/auth.js.
// Delete this route when real Google OAuth is wired in.
import { cookies } from "next/headers";
import { DEV_COOKIE, NO_ACCESS_SENTINEL, open, readJson, HttpError } from "@/lib/auth";
import { getUserByEmail } from "@/lib/data/users";
import { authEnabled } from "@/lib/nextauth";

export const POST = open(async ({ req }) => {
  if (authEnabled || process.env.NODE_ENV === "production") throw new HttpError(404, "Not found.");
  const { email } = await readJson(req);
  if (email !== NO_ACCESS_SENTINEL) {
    const user = await getUserByEmail(email);
    if (!user) throw new HttpError(404, "No such user on the allow-list.");
  }
  const jar = await cookies();
  jar.set(DEV_COOKIE, email, { path: "/", httpOnly: true, sameSite: "lax" });
  return Response.json({ ok: true });
});
