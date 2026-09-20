// Who is making this request, and what may they do.
//
// Identity comes from one of two places:
//   - Google sign-in via NextAuth when AUTH_GOOGLE_* is configured (production)
//   - the dev "viewing as" cookie otherwise (local sandbox only)
// Either way the email is then looked up in `users`. No row, no access; the
// role comes from the row. That lookup and the role gating below are the same
// in both modes.

import { cookies } from "next/headers";
import { listUsers, getUserByEmail } from "./data/users";
import { auth, authEnabled } from "./nextauth";

export const DEV_COOKIE = "eib_dev_user";
export const NO_ACCESS_SENTINEL = "__stranger__";
export const authMode = authEnabled ? "google" : "dev";

// The signed-in Google identity, whether or not it is on the allow-list.
export async function getSessionIdentity() {
  if (!authEnabled) return null;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return { email: String(email).toLowerCase(), name: session.user.name || email };
}

// A suspended row exists but grants nothing.
const active = (user) => (user && !user.suspended ? user : null);

export async function getCurrentUser() {
  if (authEnabled) {
    const identity = await getSessionIdentity();
    if (!identity) return null;
    return active(await getUserByEmail(identity.email));
  }

  // No Google sign-in configured. In a production build that means nobody
  // can be identified, so nobody gets in. The dev-cookie convenience below
  // is for local development only; it must never apply on a live URL.
  if (process.env.NODE_ENV === "production") return null;

  const jar = await cookies();
  const email = jar.get(DEV_COOKIE)?.value;
  if (email === NO_ACCESS_SENTINEL) return null;
  if (!email) {
    // First visit with no cookie: default to the seeded super admin so the
    // sandbox opens on something useful.
    const users = await listUsers({ role: "superAdmin" });
    return users[0] || null;
  }
  return active(await getUserByEmail(email));
}

// Who is signed in, whether or not they have access. Used by the pages that
// decide where a signed-in person without a working account should go.
//   identity: the sign-in (Google, or the dev cookie's email)
//   user:     their active allow-list row, or null
//   suspended: true when the row exists but has been suspended
export async function getAccessState() {
  const user = await getCurrentUser();
  if (user) return { user, identity: { name: user.name, email: user.email }, suspended: false };
  let identity = null;
  if (authEnabled) identity = await getSessionIdentity();
  else if (process.env.NODE_ENV !== "production") {
    const jar = await cookies();
    const email = jar.get(DEV_COOKIE)?.value;
    if (email && email !== NO_ACCESS_SENTINEL) identity = { name: email, email };
  }
  if (!identity) return { user: null, identity: null, suspended: false };
  const row = await getUserByEmail(identity.email);
  return { user: null, identity: { name: row?.name || identity.name, email: identity.email }, suspended: Boolean(row?.suspended) };
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(roles) {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Not signed in, or this email is not on the allow-list.");
  if (roles && !roles.includes(user.role)) {
    throw new HttpError(403, `This action requires role ${roles.join(" or ")}; you are ${user.role}.`);
  }
  return user;
}

export function errorResponse(e) {
  const status = e?.status || 500;
  if (status >= 500) console.error(e);
  return Response.json({ error: e?.message || "Server error" }, { status });
}

// Wraps a route handler with role gating and error handling.
//   export const GET = guarded(["superAdmin"], async ({ req, user, params }) => Response.json(...));
// Pass `null` for roles to allow any signed-in user.
export function guarded(roles, handler) {
  return async (req, ctx) => {
    try {
      const user = await requireUser(roles);
      const params = ctx?.params ? await ctx.params : {};
      return await handler({ req, user, params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

// Same wrapper for routes with no auth at all (the public application form).
export function open(handler) {
  return async (req, ctx) => {
    try {
      const params = ctx?.params ? await ctx.params : {};
      return await handler({ req, params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}
