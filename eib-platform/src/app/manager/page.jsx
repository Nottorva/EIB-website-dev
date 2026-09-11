import { gatePage } from "@/lib/gate";
import StudentManager from "@/components/StudentManager";

export default async function ManagerPage() {
  const user = await gatePage(["superAdmin", "studentLeader"]);
  return <StudentManager user={user} />;
}
