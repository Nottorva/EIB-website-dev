import { gatePage } from "@/lib/gate";
import MentorCRM from "@/components/MentorCRM";

export default async function CrmPage() {
  const user = await gatePage(["superAdmin", "studentLeader", "advancement"], { path: "/crm" });
  return <MentorCRM user={user} />;
}
