import { redirect } from "next/navigation";
import { gatePage } from "@/lib/gate";
import { needsAgreement } from "@/lib/data/agreement";
import LessonView from "@/components/LessonView";

export default async function LessonsPage() {
  const user = await gatePage(["superAdmin", "studentLeader", "student"], { path: "/lessons" });
  // A student who has not signed the current Student Agreement goes to
  // onboarding first; the view API refuses them too.
  if (await needsAgreement(user)) redirect("/onboarding");
  return <LessonView user={user} />;
}
