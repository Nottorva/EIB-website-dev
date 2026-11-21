import { gatePage } from "@/lib/gate";
import AidaUnlocked from "@/components/AidaUnlocked";

// AIDA Unlocked: the demo AI cofounder, with the whole EIB method and web research.
export default async function AidaUnlockedPage() {
  await gatePage(["superAdmin"], { path: "/aida-unlocked" });
  return <AidaUnlocked />;
}
