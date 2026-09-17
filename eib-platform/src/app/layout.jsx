import "./globals.css";
import { getCurrentUser, getSessionIdentity, authMode } from "@/lib/auth";
import TopBar from "@/components/TopBar";

export const metadata = {
  title: "EIB Platform",
  description: "EIB teaching platform",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const [user, identity] = await Promise.all([getCurrentUser(), authMode === "google" ? getSessionIdentity() : null]);
  return (
    <html lang="en">
      <body>
        <TopBar user={user} authMode={authMode} identity={identity} />
        <main style={{ minHeight: "calc(100vh - 64px)" }}>{children}</main>
      </body>
    </html>
  );
}
