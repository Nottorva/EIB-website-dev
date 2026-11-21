import { cookies } from "next/headers";
import AidaDemo from "@/components/AidaDemo";
import { getDemoLink, demoState, demoCookie, DEMO_HOURS, DEMO_MAX_MESSAGES } from "@/lib/aida/demo";

// A one-time AIDA Unlocked demo link (see lib/aida/demo.js). No sign-in and no platform menu: the visitor
// sees the invitation, then the chat. Opening this page never uses the link up; pressing Start does.
export const metadata = { title: "AIDA Unlocked · EIB", description: "An AI cofounder built on the EIB method.", robots: { index: false, follow: false } };
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };
export const dynamic = "force-dynamic";

export default async function DemoPage({ params }) {
  const { token } = await params;
  const jar = await cookies();
  const state = demoState(await getDemoLink(token), jar.get(demoCookie(token))?.value);
  return <AidaDemo token={token} initial={state} hours={DEMO_HOURS} maxMessages={DEMO_MAX_MESSAGES} />;
}
