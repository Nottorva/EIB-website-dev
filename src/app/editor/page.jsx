import { gatePage } from "@/lib/gate";
import LessonEditor from "@/components/LessonEditor";

export default async function EditorPage() {
  const user = await gatePage(["superAdmin"]);
  return <LessonEditor user={user} />;
}
