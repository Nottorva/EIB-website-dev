import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { authMode, getSessionIdentity } from "@/lib/auth";
import { GoogleSignOutButton } from "@/components/GoogleButtons";
import { COLORS } from "@/lib/tokens";

export default async function Denied({ searchParams }) {
  const params = await searchParams;
  const reason = params?.reason;
  const identity = authMode === "google" ? await getSessionIdentity() : null;

  const signInMissing = authMode !== "google" && process.env.NODE_ENV === "production";
  const message =
    reason === "signin"
      ? signInMissing
        ? "Sign-in hasn't been set up on this site yet. Please check back later."
        : identity
          ? `${identity.email} does not have access to EIB yet.`
          : "You need to sign in to see this page."
      : "Your account does not have access to this page.";

  return (
    <div style={{ maxWidth: 560, margin: "64px auto", padding: "0 20px" }}>
      <div className="eib-card" style={{ textAlign: "center" }}>
        <div style={{ width: 56, height: 56, background: COLORS.errorBg, border: `1px solid ${COLORS.errorBorder}`, color: COLORS.errorIcon, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <ShieldAlert size={26} strokeWidth={2} />
        </div>
        <h1 className="eib-h2" style={{ marginBottom: 10 }}>
          No access
        </h1>
        <div style={{ fontSize: 15, color: COLORS.text2, lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/platform" className="eib-btn">
            Back home
          </Link>
          {identity && <GoogleSignOutButton label="Sign out and try another account" style={{ minHeight: 48, fontSize: 15 }} />}
        </div>
      </div>
    </div>
  );
}
