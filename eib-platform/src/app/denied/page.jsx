import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { authMode, getSessionIdentity } from "@/lib/auth";
import { GoogleSignOutButton } from "@/components/GoogleButtons";

export default async function Denied({ searchParams }) {
  const params = await searchParams;
  const reason = params?.reason;
  const need = params?.need;
  const identity = authMode === "google" ? await getSessionIdentity() : null;

  const message =
    reason === "signin"
      ? identity
        ? `${identity.email} is signed in to Google but has not been added to EIB. Students get access when their application is approved; student leaders are added by the super admin.`
        : "This email is not on the allow-list, so there is nothing to show."
      : `This page requires role ${need ? need.split(",").join(" or ") : "(unknown)"}. Your current role does not have it.`;

  return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
        <ShieldAlert size={26} strokeWidth={2.25} />
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#0f1222", marginBottom: 10 }}>No access</div>
      <div style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6, marginBottom: 22 }}>{message}</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <Link href="/" style={{ display: "inline-block", background: "#4f46e5", color: "#fff", fontWeight: 800, fontSize: 14, borderRadius: 10, padding: "10px 18px", textDecoration: "none" }}>
          Back home
        </Link>
        {identity && <GoogleSignOutButton label="Sign out and try another account" style={{ padding: "10px 18px", fontSize: 14 }} />}
      </div>
    </div>
  );
}
