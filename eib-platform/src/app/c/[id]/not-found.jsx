// A credential link that was never issued (or was removed with its student).
export const metadata = { title: "Credential not found · EIB", robots: { index: false, follow: false } };

export default function CredentialNotFound() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#fff", border: "1px solid #eef1f6", borderRadius: 22, padding: "30px 26px", textAlign: "center" }}>
        <div style={{ fontSize: 21, fontWeight: 900, color: "#0f1222" }}>This credential link is not valid</div>
        <p style={{ fontSize: 14.5, color: "#64748b", lineHeight: 1.6, margin: "10px 0 0" }}>No EIB credential exists at this address. Part of the link may be missing: ask the person who shared it to send it again.</p>
      </div>
    </div>
  );
}
