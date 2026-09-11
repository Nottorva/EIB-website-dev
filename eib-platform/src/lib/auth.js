// Auth for the local sandbox.
//
// Real deployment: Google OAuth via NextAuth. On sign-in, look the email up in
// `users`; no row, no access; role comes from the row.
//
// Sandbox: a dev cookie holds the email of the user we are "viewing as". The
// lookup and role gating below are identical to what the real flow will do,
// so swapping in NextAuth only changes how getCurrentUser() finds the email.

import { cookies } from "next/headers";
import { listUsers, getUserByEmail } from "./data/users";

export const DEV_COOKIE = "eib_dev_user";
export const NO_ACCESS_SENTINEL = "__stranger__";

export async function getCurrentUser() {
  const jar = await cookies();
  const email = jar.get(DEV_COOKIE)?.value;
  if (email === NO_ACCESS_SENTINEL) return null;
  if (!email) {
    // First visit with no cookie: default to the seeded super admin so the
    // sandbox opens on something useful.
    const users = await listUsers({ role: "superAdmin" });
    return users[0] || null;
  }
  return getUserByEmail(email);
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
