// /changes: the EIB Assistant's proposed changes (tickets) waiting for Josef's approval, and the history.
import { gatePage } from "@/lib/gate";
import ChangesPanel from "@/components/ChangesPanel";

export default async function ChangesPage() {
  await gatePage(["superAdmin"], { path: "/changes" });
  return <ChangesPanel />;
}
