// Server-side page gate. Pages call this before rendering their client tool.
// API routes have their own gate in auth.js; both must agree, and the API
// gate is the one that actually protects data.
import { redirect } from "next/navigation";
import { getCurrentUser, getSessionIdentity, authMode } from "./auth";

export async function gatePage(roles, { path = "/platform" } = {}) {
  const user = await getCurrentUser();
  if (!user) {
    if (authMode === "google") {
      const identity = await getSessionIdentity();
      // Signed in to Google but not on the allow-list vs. not signed in at all.
      if (identity) redirect("/denied?reason=signin");
      redirect(`/signin?callbackUrl=${encodeURIComponent(path)}`);
    }
    redirect("/denied?reason=signin");
  }
  if (roles && !roles.includes(user.role)) redirect(`/denied?reason=role&need=${encodeURIComponent(roles.join(","))}`);
  return user;
}
