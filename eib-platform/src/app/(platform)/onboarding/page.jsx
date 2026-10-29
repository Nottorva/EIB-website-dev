import { redirect } from "next/navigation";
import { gatePage } from "@/lib/gate";
import Onboarding from "@/components/Onboarding";

// Students sign the Student Agreement here before their lessons open. The
// super admin can open it to see what students see.
export default async function OnboardingPage() {
  const user = await gatePage(["student", "superAdmin"], { path: "/onboarding" });
  if (user.role === "student" && !user.welcomedAt) redirect("/welcome");
  return <Onboarding user={user} />;
}
