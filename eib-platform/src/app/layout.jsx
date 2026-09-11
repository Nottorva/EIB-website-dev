import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { listUsers } from "@/lib/data/users";
import TopBar from "@/components/TopBar";

export const metadata = {
  title: "EIB Platform (sandbox)",
  description: "Local sandbox for the EIB teaching platform",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const [user, users] = await Promise.all([getCurrentUser(), listUsers()]);
  return (
    <html lang="en">
      <body>
        <TopBar user={user} users={users} />
        <main style={{ minHeight: "calc(100vh - 64px)" }}>{children}</main>
      </body>
    </html>
  );
}
