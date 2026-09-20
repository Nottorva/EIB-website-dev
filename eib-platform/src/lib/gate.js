// Server-side page gate. Pages call this before rendering their client tool.
// API routes have their own gate in auth.js; both must agree, and the API
// gate is the one that actually protects data.
import { redirect } from "next/navigation";
import { getAccessState, authMode } from "./auth";

export async function gatePage(roles, { path = "/platform" } = {}) {
  const { user, identity } = await getAccessState();
  if (!user) {
    // Signed in but without a working account: they are an applicant (or a
    // suspended student). The application page shows them their status.
    if (identity) redirect("/apply");
    if (authMode === "google") redirect(`/signin?callbackUrl=${encodeURIComponent(path)}`);
    redirect("/denied?reason=signin");
  }
  if (roles && !roles.includes(user.role)) redirect(`/denied?reason=role&need=${encodeURIComponent(roles.join(","))}`);
  return user;
}
