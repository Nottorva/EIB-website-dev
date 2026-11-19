"use client";

// The AIDA conversation box: the messages, the input, and the reply appearing as it is written.
// Used by the student panel on the Lessons page and by the super admin's Chat with AIDA page; each passes
// `post(text, history)`, which returns the fetch for its own route.

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { COLORS, Notice, fieldStyle } from "./ui";

const ERROR_MARK = "[[AIDA_ERROR]]";
export const AIDA_MAX_CHARS = 2000;

export default function AidaChat({ messages, setMessages, post, emptyHint, disabledReason = "" }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const send = async () => {
    const said = text.trim();
    if (!said || busy || disabledReason) return;
    const history = messages;
    setError(null);
    setBusy(true);
    setText("");
    setMessages([...history, { role: "user", content: said }, { role: "assistant", content: "" }]);
    const fail = (message) => {
      setMessages(history);
      setText(said);
      setError(message);
    };
    try {
      const res = await post(said, history);
      if (!res.ok) {
        let message = `AIDA could not answer (${res.status}).`;
        try { message = (await res.json()).error || message; } catch {}
        fail(message);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        if (reply.includes(ERROR_MARK)) continue;
        setMessages([...history, { role: "user", content: said }, { role: "assistant", content: reply }]);
      }
      if (reply.includes(ERROR_MARK)) fail(reply.split(ERROR_MARK)[1] || "AIDA could not answer just now.");
      else if (!reply.trim()) fail("AIDA did not answer. Please try again.");
    } catch {
      fail("The connection dropped before AIDA finished. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const bubble = (m, i) => {
    const mine = m.role === "user";
    return (
      <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
        <div
          style={{ maxWidth: "88%", padding: "11px 14px", borderRadius: 14, fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: mine ? COLORS.indigo : "#fff", color: mine ? "#fff" : COLORS.text, border: mine ? "none" : `1px solid ${COLORS.border}` }}
        >
          {m.content || <span style={{ color: COLORS.faint }}>AIDA is thinking…</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      <div aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "16px 16px 8px", background: COLORS.bg }}>
        {messages.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", color: COLORS.faint, fontSize: 14, lineHeight: 1.55, maxWidth: 300 }}>
            <Sparkles size={22} color={COLORS.indigo} style={{ marginBottom: 8 }} />
            <div>{emptyHint}</div>
          </div>
        )}
        {messages.map(bubble)}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${COLORS.border}`, background: "#fff" }}>
        {error && <div style={{ marginBottom: 8 }}><Notice onClose={() => setError(null)}>{error}</Notice></div>}
        {disabledReason && <div style={{ marginBottom: 8 }}><Notice tone="amber">{disabledReason}</Notice></div>}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            aria-label="Message to AIDA"
            value={text}
            maxLength={AIDA_MAX_CHARS}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask AIDA about your work…"
            rows={2}
            disabled={Boolean(disabledReason)}
            style={{ ...fieldStyle, resize: "none", fontSize: 14.5, lineHeight: 1.45, padding: "10px 12px" }}
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !text.trim() || Boolean(disabledReason)}
            aria-label="Send"
            style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: "none", background: COLORS.indigo, color: "#fff", cursor: busy || !text.trim() ? "default" : "pointer", opacity: busy || !text.trim() || disabledReason ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
