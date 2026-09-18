// Layout for the platform tools (everything except the public site at "/").
// The top bar needs to know who is signed in; the site has its own chrome.
import { getCurrentUser, getSessionIdentity, authMode } from "@/lib/auth";
import TopBar from "@/components/TopBar";

export const metadata = {
  title: "EIB Platform",
  description: "EIB teaching platform",
};

export default async function PlatformLayout({ children }) {
  const [user, identity] = await Promise.all([getCurrentUser(), authMode === "google" ? getSessionIdentity() : null]);
  return (
    <>
      <TopBar user={user} authMode={authMode} identity={identity} />
      <main style={{ minHeight: "calc(100vh - 64px)" }}>{children}</main>
    </>
  );
}
