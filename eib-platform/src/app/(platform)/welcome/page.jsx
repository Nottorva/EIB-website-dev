import { redirect } from "next/navigation";
import { gatePage } from "@/lib/gate";
import Welcome from "@/components/Welcome";

// Shown once, on an accepted student's first sign-in. The super admin can
// open it to see it. A student who has already been welcomed is sent on.
export default async function WelcomePage() {
  const user = await gatePage(["student", "superAdmin"], { path: "/welcome" });
  if (user.role === "student" && user.welcomedAt) redirect("/lessons");
  return <Welcome user={user} />;
}
