import { gatePage } from "@/lib/gate";
import Aida from "@/components/Aida";

// /aida            the Context tab
// /aida?lesson=ID  the Context tab, scrolled to that lesson (the Lesson Editor's "AI Instructions" link)
// /aida?tab=test   the Test tab
export default async function AidaPage({ searchParams }) {
  await gatePage(["superAdmin"], { path: "/aida" });
  const q = await searchParams;
  return <Aida startTab={String(q?.tab || "context")} startLesson={String(q?.lesson || "")} />;
}
