import { gatePage } from "@/lib/gate";
import LessonView from "@/components/LessonView";

export default async function LessonsPage() {
  const user = await gatePage(["superAdmin", "studentLeader", "student"], { path: "/lessons" });
  return <LessonView user={user} />;
}
