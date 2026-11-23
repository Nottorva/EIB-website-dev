import { redirect } from "next/navigation";
import { gatePage } from "@/lib/gate";
import { needsAgreement } from "@/lib/data/agreement";
import { getClassStarted } from "@/lib/data/settings";
import LessonView from "@/components/LessonView";
import ClassOnHold from "@/components/ClassOnHold";

export default async function LessonsPage() {
  const user = await gatePage(["superAdmin", "studentLeader", "student"], { path: "/lessons" });
  // First sign-in: the welcome page. Then a student who has not signed the
  // current Student Agreement goes to onboarding; the view API refuses them too.
  if (user.role === "student" && !user.welcomedAt) redirect("/welcome");
  if (await needsAgreement(user)) redirect("/onboarding");
  // Signed up and signed, but the super admin has not pressed "Start class" yet.
  if (user.role === "student" && !(await getClassStarted())) return <ClassOnHold user={user} />;
  return <LessonView user={user} />;
}
