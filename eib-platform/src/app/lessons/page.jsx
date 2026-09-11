import { gatePage } from "@/lib/gate";
import LessonView from "@/components/LessonView";

export default async function LessonsPage() {
  const user = await gatePage(["superAdmin", "studentLeader", "student"]);
  return <LessonView user={user} />;
}
