"use client";

// The first thing an accepted student sees when they sign in: a
// congratulations, and one button that takes them to the Student Agreement
// (or straight to their lessons when no agreement is required). Pressing it
// marks the account as welcomed, so this page shows once.

import { useState } from "react";
import { PartyPopper, ArrowRight } from "lucide-react";
import { COLORS, Notice } from "./ui";
import { api } from "@/lib/api";

export default function Welcome({ user }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const preview = user.role !== "student";
  const go = async () => {
    if (preview) { window.location.href = "/onboarding"; return; }
    setBusy(true);
    setError(null);
    try {
      const r = await api.post("/api/welcome", {});
      window.location.href = r.next || "/lessons";
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  const first = (user.name || "").split(" ")[0];
  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "60px 20px 80px" }}>
      <main style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        {preview && <Notice tone="info">Preview: this is what an accepted student sees the first time they sign in.</Notice>}
        <div style={{ width: 84, height: 84, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 26px" }}>
          <PartyPopper size={40} color={COLORS.ink} strokeWidth={2} />
        </div>
        <h1 style={{ fontSize: "clamp(40px, 7vw, 64px)", fontWeight: 600, color: COLORS.ink, margin: "0 0 14px", lineHeight: 1.05, letterSpacing: -1 }}>Congratulations{first ? `, ${first}` : ""}.</h1>
        <p style={{ fontSize: 18, color: COLORS.text2, lineHeight: 1.6, margin: "0 auto 34px", maxWidth: 520 }}>
          You're in. Welcome to EIB. One thing before your lessons open: read and sign the Student Agreement, with a parent or legal guardian.
        </p>
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        <button
          type="button"
          onClick={go}
          disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", gap: 10, border: "none", background: COLORS.ink, color: COLORS.white, fontWeight: 600, fontSize: 18, padding: "16px 28px", cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}
        >
          {busy ? "One moment…" : "Go to the Student Agreement"} <ArrowRight size={20} />
        </button>
      </main>
    </div>
  );
}
