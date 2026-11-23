import { gatePage } from "@/lib/gate";
import StyleGuide from "@/components/StyleGuide";

export const metadata = { title: "EIB design system", robots: { index: false } };

export default async function StyleGuidePage() {
  await gatePage(["superAdmin"], { path: "/styleguide" });
  return <StyleGuide />;
}
