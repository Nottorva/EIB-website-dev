import { gatePage } from "@/lib/gate";
import AgentAdmin from "@/components/AgentAdmin";

export default async function AgentPage() {
  await gatePage(["superAdmin"], { path: "/agent" });
  return <AgentAdmin />;
}
