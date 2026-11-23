// A credential link that was never issued (or was removed with its student).
import { COLORS, FONTS } from "@/lib/tokens";

export const metadata = { title: "Credential not found · EIB", robots: { index: false, follow: false } };

export default function CredentialNotFound() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 20px" }}>
      <div className="eib-card" style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <h1 className="eib-h2" style={{ fontFamily: FONTS.serif, fontSize: 32 }}>
          This credential link is not valid
        </h1>
        <p style={{ fontSize: 15, color: COLORS.text2, lineHeight: 1.6, margin: "12px 0 0" }}>No EIB credential exists at this address. Part of the link may be missing: ask the person who shared it to send it again.</p>
      </div>
    </div>
  );
}
