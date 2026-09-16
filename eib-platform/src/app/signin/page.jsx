import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getCurrentUser, authMode } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/GoogleButtons";

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = typeof params?.callbackUrl === "string" && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/";

  if (authMode !== "google") redirect("/");
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl);

  return (
    <div style={{ maxWidth: 440, margin: "80px auto", padding: "0 24px" }}>
      <div style={{ background: "#fff", border: "1px solid #eef1f6", borderRadius: 20, padding: 32, textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <BookOpen size={24} color="#fff" strokeWidth={2.25} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#0f1222", marginBottom: 8 }}>EIB Platform</div>
        <div style={{ fontSize: 14.5, color: "#64748b", lineHeight: 1.6, marginBottom: 22 }}>
          Sign in with the Google account that was added to EIB. Students, student leaders and admins all sign in here.
        </div>
        <GoogleSignInButton callbackUrl={callbackUrl} style={{ width: "100%" }} />
        <div style={{ fontSize: 12.5, color: "#94a3b8", marginTop: 16, lineHeight: 1.5 }}>
          Applying to EIB? Use the application link you were sent instead.
        </div>
      </div>
    </div>
  );
}
