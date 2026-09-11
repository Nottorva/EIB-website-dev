import { gatePage } from "@/lib/gate";
import MentorCRM from "@/components/MentorCRM";

export default async function CrmPage() {
  const user = await gatePage(["superAdmin", "studentLeader"]);
  return <MentorCRM user={user} />;
}
