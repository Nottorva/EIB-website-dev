"use client";

// The guardian's result page after clicking the confirmation link.
import React, { useState } from "react";
import { CircleCheck, Clock, AlertTriangle, Mail } from "lucide-react";
import { COLORS, Notice } from "./ui";
import { api } from "@/lib/api";

const COPY = {
  ok: { icon: CircleCheck, tone: COLORS.green, soft: COLORS.greenSoft, title: "Thank you. The agreement is confirmed.", body: (s) => `${s ? `${s}'s` : "The"} EIB Student Agreement is now signed. ${s || "The student"} can open their lessons the next time they sign in. You can close this page.` },
  used: { icon: CircleCheck, tone: COLORS.green, soft: COLORS.greenSoft, title: "Already confirmed.", body: (s) => `This link has been used and ${s ? `${s}'s` : "the"} agreement is already signed. There is nothing more to do.` },
  expired: { icon: Clock, tone: COLORS.amber, soft: COLORS.amberSoft, title: "This link has expired.", body: () => "Confirmation links work for 7 days. Ask for a new one and we will email it to the same address." },
  invalid: { icon: AlertTriangle, tone: COLORS.red, soft: COLORS.redSoft, title: "This link is not recognised.", body: () => "It may have been copied incompletely, or a newer link has since been sent. Please use the most recent email, or ask the student to send a new link from their EIB page." },
};

export default function ConfirmResult({ state, student, token }) {
  const c = COPY[state] || COPY.invalid;
  const Icon = c.icon;
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/agreement/confirm", { token });
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "60px 20px" }}>
      <main style={{ maxWidth: 520, margin: "0 auto", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: c.soft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Icon size={26} color={c.tone} strokeWidth={2.25} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: COLORS.text, margin: "0 0 8px" }}>{c.title}</h1>
        <p style={{ fontSize: 15, color: COLORS.sub, lineHeight: 1.6, margin: 0 }}>{c.body(student)}</p>
        {state === "expired" && token && (
          <div style={{ marginTop: 20 }}>
            {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
            {sent ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.green, fontWeight: 800, fontSize: 14 }}>
                <Mail size={16} /> A new link is on its way. Check your inbox.
              </div>
            ) : (
              <button type="button" onClick={resend} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 14, borderRadius: 999, padding: "11px 18px", cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}>
                <Mail size={16} /> {busy ? "Sending…" : "Send me a new link"}
              </button>
            )}
          </div>
        )}
        <p style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 22, marginBottom: 0 }}>EIB · Entrepreneurship, Innovation &amp; Business</p>
      </main>
    </div>
  );
}
