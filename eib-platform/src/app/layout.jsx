import "./globals.css";
import { getCurrentUser, getSessionIdentity, authMode } from "@/lib/auth";
import { listUsers } from "@/lib/data/users";
import TopBar from "@/components/TopBar";

export const metadata = {
  title: "EIB Platform",
  description: "EIB teaching platform",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();
  // The dev switcher needs the whole allow-list; Google mode only needs the
  // signed-in identity (which may not be on the allow-list).
  const [users, identity] = await Promise.all([authMode === "dev" ? listUsers() : [], authMode === "google" ? getSessionIdentity() : null]);
  return (
    <html lang="en">
      <body>
        <TopBar user={user} users={users} authMode={authMode} identity={identity} />
        <main style={{ minHeight: "calc(100vh - 64px)" }}>{children}</main>
      </body>
    </html>
  );
}
