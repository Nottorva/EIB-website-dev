// Applicant identity for the public application form.
//
// Production: the same Google sign-in as everyone else, but with NO
// allow-list lookup; applicants are not in `users` yet. Name and email come
// from the Google profile.
//
// Sandbox: a stand-in cookie set by POST /api/apply/session that holds the
// same {name, email} shape a Google profile would give us.

import { cookies } from "next/headers";
import { getSessionIdentity } from "./auth";
import { authEnabled } from "./nextauth";

export const APPLICANT_COOKIE = "eib_applicant";

export async function getApplicant() {
  if (authEnabled) return getSessionIdentity();

  const jar = await cookies();
  const raw = jar.get(APPLICANT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !parsed?.name) return null;
    return { name: String(parsed.name), email: String(parsed.email).toLowerCase() };
  } catch {
    return null;
  }
}

export function emailOnDomain(email, domain) {
  if (!domain) return true;
  const at = String(email || "").toLowerCase().lastIndexOf("@");
  if (at === -1) return false;
  return String(email).slice(at + 1).toLowerCase() === domain.toLowerCase();
}
