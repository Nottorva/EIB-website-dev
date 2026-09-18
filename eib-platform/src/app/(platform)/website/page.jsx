import { gatePage } from "@/lib/gate";
import SiteAdmin from "@/components/SiteAdmin";

export default async function WebsitePage() {
  await gatePage(["superAdmin"], { path: "/website" });
  return <SiteAdmin />;
}
