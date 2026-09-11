// Server-side page gate. Pages call this before rendering their client tool.
// API routes have their own gate in auth.js; both must agree, and the API
// gate is the one that actually protects data.
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

export async function gatePage(roles) {
  const user = await getCurrentUser();
  if (!user) redirect("/denied?reason=signin");
  if (roles && !roles.includes(user.role)) redirect(`/denied?reason=role&need=${encodeURIComponent(roles.join(","))}`);
  return user;
}
