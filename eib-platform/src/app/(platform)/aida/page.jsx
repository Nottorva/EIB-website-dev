import { gatePage } from "@/lib/gate";
import Aida from "@/components/Aida";

// AIDA's context: everything it is told. Chatting with it is at /aida/chat.
export default async function AidaPage() {
  await gatePage(["superAdmin"], { path: "/aida" });
  return <Aida />;
}
