// /memory: the EIB Assistant's long-term memory, as its own page (super admin). The same list also sits in
// the Mentor CRM under the Memory tab.
import { gatePage } from "@/lib/gate";
import MemoryTab from "@/components/MemoryTab";
import { PageTitle } from "@/components/ui";

export default async function MemoryPage() {
  await gatePage(["superAdmin"], { path: "/memory" });
  return (
    <div style={{ padding: "30px 0 0" }}>
      <PageTitle title="Long-term memory" />
      <MemoryTab />
    </div>
  );
}
