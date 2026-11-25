"use client";

// What someone sees when they open a one-time AIDA Unlocked demo link (/demo/<id>), most often on a phone.
// First the invitation, with one button; then the chat, filling the screen. The conversation is kept in
// this browser only.

import { useEffect, useRef, useState } from "react";
import { BookOpen, Rocket, RotateCcw, Search, FileText, Compass, ArrowRight } from "lucide-react";
import { COLORS, FONTS } from "./ui";
import AidaChat from "./AidaChat";

const page = { minHeight: "100dvh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px calc(24px + env(safe-area-inset-bottom))" };
const panel = { width: "100%", maxWidth: 440, background: COLORS.surface, padding: "30px 26px", border: `1px solid ${COLORS.border}` };

function Brand({ small }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <div style={{ width: small ? 32 : 40, height: small ? 32 : 40, background: COLORS.ink, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Rocket size={small ? 16 : 20} color={COLORS.white} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: small ? 15.5 : 19, fontWeight: 600, color: COLORS.ink, lineHeight: 1.15, whiteSpace: "nowrap" }}>AIDA Unlocked</div>
        <div style={{ fontSize: small ? 11.5 : 12.5, color: COLORS.muted, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
          <BookOpen size={small ? 11 : 12} /> by EIB
        </div>
      </div>
    </div>
  );
}

const POINTS = [
  { icon: Compass, text: "Works from the EIB method, from finding a problem worth solving to the pitch." },
  { icon: Search, text: "Researches your market live: competitors, pricing, market size, regulations." },
  { icon: FileText, text: "Hands you finished work: interview guides, pricing, plans, pitch decks." },
];

const CLOSED = {
  spent: ["This demo link has already been used", "Each link opens one demo, in one browser. If you started this demo yourself, open the link again in the same browser you used. Otherwise, ask the person who sent it for a new link."],
  expired: ["This demo link has expired", "It was not opened in time. Ask the person who sent it for a new link."],
  missing: ["This demo link is not available", "The link may have been removed, or part of it may be missing. Ask the person who sent it for a new link."],
};

export default function AidaDemo({ token, initial, hours, maxMessages }) {
  const [state, setState] = useState(initial);
  const [messages, setMessages] = useState([]);
  const [starting, setStarting] = useState(false);
  const [left, setLeft] = useState(initial.left ?? maxMessages);
  const restored = useRef(false);
  const SAVED = `eib:aida-demo:${token}`;
  const API = `/api/demo/${token}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVED) || "[]");
      if (Array.isArray(saved)) setMessages(saved.filter((m) => m && typeof m.content === "string" && m.content));
    } catch {}
    restored.current = true;
  }, [SAVED]);
  useEffect(() => {
    if (!restored.current) return;
    try {
      window.localStorage.setItem(SAVED, JSON.stringify(messages));
    } catch {}
  }, [messages, SAVED]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: true }) });
      const next = res.ok ? await res.json() : { status: "spent" };
      setState(next);
      if (next.left != null) setLeft(next.left);
    } catch {
      setStarting(false);
    }
  };
  const post = async (text, history) => {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [...history, { role: "user", content: text }] }) });
    if (res.ok) setLeft((n) => Math.max(0, n - 1));
    return res;
  };

  if (state.status === "ready") {
    return (
      <div style={page}>
        <div style={panel}>
          <Brand />
          <h1 style={{ fontFamily: FONTS.serif, fontSize: 30, lineHeight: 1.2, fontWeight: 600, color: COLORS.ink, margin: "26px 0 10px" }}>Meet your AI cofounder.</h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.55, color: COLORS.text2, margin: "0 0 20px" }}>Tell it about a venture, or just a problem that bothers you, and put it to work.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 13, marginBottom: 26 }}>
            {POINTS.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 30, height: 30, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} color={COLORS.ink} />
                </div>
                <span style={{ fontSize: 14.5, lineHeight: 1.45, color: COLORS.ink, paddingTop: 4 }}>{text}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={start} disabled={starting} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none", padding: "15px 18px", background: COLORS.action, color: COLORS.white, fontSize: 16, fontWeight: 600, fontFamily: "inherit", cursor: starting ? "default" : "pointer", opacity: starting ? 0.7 : 1 }}>
            {starting ? "Starting…" : "Start the demo"} {!starting && <ArrowRight size={18} />}
          </button>
          <p style={{ fontSize: 12.5, lineHeight: 1.5, color: COLORS.muted, margin: "16px 0 0", textAlign: "center" }}>
            This link opens one demo. Once you start, it stays yours in this browser for {hours} hours and {maxMessages} messages. Your conversation is kept on this device and is not saved by EIB.
          </p>
        </div>
      </div>
    );
  }

  if (state.status !== "active" && state.status !== "ended") {
    const [title, body] = CLOSED[state.status] || CLOSED.missing;
    return (
      <div style={page}>
        <div style={{ ...panel, textAlign: "left" }}>
          <Brand />
          <h1 style={{ fontFamily: FONTS.serif, fontSize: 26, lineHeight: 1.25, fontWeight: 600, color: COLORS.ink, margin: "24px 0 10px" }}>{title}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: COLORS.text2, margin: 0 }}>{body}</p>
        </div>
      </div>
    );
  }

  const over = state.status === "ended" ? (state.why === "time" ? "This demo has ended. Thank you for trying AIDA Unlocked." : "This demo has used all of its messages. Thank you for trying AIDA Unlocked.") : left <= 0 ? "This demo has used all of its messages. Thank you for trying AIDA Unlocked." : "";
  const hint = (
    <span>
      <span style={{ display: "block", fontSize: 16, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>What are you building?</span>
      Tell me about your venture, or a problem you keep running into. I can research the market, pressure-test the idea, and write what you need.
    </span>
  );
  return (
    <div style={{ position: "fixed", inset: 0, height: "100dvh", display: "flex", flexDirection: "column", background: COLORS.surface }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "calc(10px + env(safe-area-inset-top)) 14px 10px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface, flexShrink: 0 }}>
        <Brand small />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {!over && left <= 10 && <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.warnText }}>{left} left</span>}
          <button type="button" onClick={() => setMessages([])} disabled={!messages.length} aria-label="New chat" title="New chat" style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: COLORS.surface, padding: "8px 11px", fontSize: 13, fontWeight: 600, color: COLORS.ink, fontFamily: "inherit", cursor: messages.length ? "pointer" : "default", opacity: messages.length ? 1 : 0.45 }}>
            <RotateCcw size={14} /> New chat
          </button>
        </div>
      </header>
      <AidaChat messages={messages} setMessages={setMessages} post={post} maxChars={8000} placeholder="Message AIDA Unlocked…" emptyHint={hint} disabledReason={over} />
    </div>
  );
}
