import { redirect } from "next/navigation";
import { getCurrentUser, authMode } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/GoogleButtons";
import { COLORS } from "@/lib/tokens";

export default async function SignInPage({ searchParams }) {
  const params = await searchParams;
  const callbackUrl = typeof params?.callbackUrl === "string" && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/platform";

  if (authMode !== "google") redirect("/platform");
  const user = await getCurrentUser();
  if (user) redirect(callbackUrl);

  return (
    <div style={{ maxWidth: 480, margin: "64px auto", padding: "0 20px" }}>
      <div className="eib-card eib-card--feature" style={{ textAlign: "center" }}>
        <div className="eib-eyebrow" style={{ marginBottom: 10 }}>
          Sign in
        </div>
        <h1 className="eib-h2">EIB Platform</h1>
        <hr className="eib-rule" style={{ marginLeft: "auto", marginRight: "auto" }} />
        <div style={{ fontSize: 15, color: COLORS.text2, lineHeight: 1.6, marginBottom: 24 }}>
          Sign in with the Google account that was added to EIB. Students, student leaders and admins all sign in here.
        </div>
        <GoogleSignInButton callbackUrl={callbackUrl} style={{ width: "100%" }} />
        <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 16, lineHeight: 1.5 }}>
          Applying to EIB? Use the application link you were sent instead.
        </div>
      </div>
    </div>
  );
}
