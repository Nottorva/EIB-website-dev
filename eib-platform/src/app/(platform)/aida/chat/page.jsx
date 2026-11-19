import { gatePage } from "@/lib/gate";
import AidaLab from "@/components/AidaLab";

// Chat with AIDA: the super admin talks to the same AIDA students get.
export default async function AidaChatPage() {
  await gatePage(["superAdmin"], { path: "/aida/chat" });
  return <AidaLab />;
}
