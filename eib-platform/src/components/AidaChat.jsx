"use client";

// The AIDA conversation box: the messages, the input, and the reply appearing as it is written.
// Used by the student panel on the Lessons page and by the super admin's Chat with AIDA page; each passes
// `post(text, history)`, which returns the fetch for its own route.
//
// Deliverables in the chat. AIDA can pull deliverables into the conversation by writing [[show:ID]] lines
// (see lib/aida/context.js). Those lines are never shown as text. The deliverables from AIDA's latest such
// reply appear as buttons ("1A", "1B") just above the reply box, so they stay put while the chat scrolls.
// Opening one turns the reply box into that deliverable, and Send becomes "Submit to AIDA".
// `deliverableOf(id)` describes one: { label, title, task, editor } (no editor = it can only be named).

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X } from "lucide-react";
import { COLORS, Notice, fieldStyle } from "./ui";

const ERROR_MARK = "[[AIDA_ERROR]]";
const CARD = /\[\[show:([^\]\s]+)\]\]/g;
export const AIDA_MAX_CHARS = 2000;

// A reply without its markers (one still being written is hidden too).
const visible = (content) => String(content).replace(CARD, "").replace(/\[\[[^\]]*\]?$/, "").replace(/\n{3,}/g, "\n\n").trim();
const shownIn = (content) => [...new Set([...String(content).matchAll(CARD)].map((m) => m[1]))];

export default function AidaChat({ messages, setMessages, post, emptyHint, disabledReason = "", deliverableOf, editorNote = "This is your deliverable. It saves as you type." }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // The buttons: whatever AIDA pulled in most recently.
  let pulled = [];
  for (let i = messages.length - 1; i >= 0 && !pulled.length; i--) if (messages[i].role === "assistant") pulled = shownIn(messages[i].content);
  const buttons = deliverableOf ? pulled.map((id) => ({ id, ...(deliverableOf(id) || {}) })).filter((d) => d.label) : [];
  const open = buttons.find((d) => d.id === openId && d.editor) || null;

  // The box's own text, or (from "Submit to AIDA") a message written for the student.
  const send = async (preset) => {
    const fromBox = typeof preset !== "string";
    const said = (fromBox ? text : preset).trim();
    if (!said || busy || disabledReason) return;
    const history = messages;
    setError(null);
    setBusy(true);
    if (fromBox) setText("");
    setMessages([...history, { role: "user", content: said }, { role: "assistant", content: "" }]);
    const fail = (message) => {
      setMessages(history);
      if (fromBox) setText(said);
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
    const shown = mine ? m.content : visible(m.content);
    return (
      <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
        <div style={{ maxWidth: "88%", padding: "11px 14px", borderRadius: 14, fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: mine ? COLORS.indigo : "#fff", color: mine ? "#fff" : COLORS.text, border: mine ? "none" : `1px solid ${COLORS.border}` }}>
          {shown || <span style={{ color: COLORS.faint }}>{busy && i === messages.length - 1 ? "AIDA is thinking…" : "Your deliverables are just above the reply box."}</span>}
        </div>
      </div>
    );
  };

  const off = Boolean(disabledReason);
  const sendButton = (label, onClick, disabled) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label || "Send"}
      style={{ height: 44, minWidth: 44, flexShrink: 0, borderRadius: 12, border: "none", padding: label ? "0 16px" : 0, background: COLORS.indigo, color: "#fff", fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
    >
      {label} <Send size={label ? 16 : 18} />
    </button>
  );

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

        {buttons.length > 0 && (
          <div aria-label="Deliverables AIDA pulled in" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {buttons.map((d) => {
              const on = open?.id === d.id;
              return (
                <button key={d.id} type="button" title={d.title} aria-pressed={on} disabled={!d.editor} onClick={() => setOpenId(on ? null : d.id)} style={{ display: "flex", alignItems: "center", gap: 7, maxWidth: "100%", border: `1px solid ${on ? COLORS.indigo : COLORS.indigoBorder}`, background: on ? COLORS.indigo : COLORS.indigoSoft, color: on ? "#fff" : COLORS.indigo, borderRadius: 10, padding: "7px 11px", fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: d.editor ? "pointer" : "default" }}>
                  {d.label}
                  <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{d.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {open ? (
          <div style={{ border: `1px solid ${COLORS.indigoBorder}`, borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{open.label} · {open.title}</div>
                {open.task && <div style={{ fontSize: 12.5, color: COLORS.sub, lineHeight: 1.45, marginTop: 2 }}>{open.task}</div>}
              </div>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Back to the message box" title="Back to the message box" style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.sub, padding: 2, display: "flex" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ maxHeight: "38vh", overflow: "auto" }}>{open.editor}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: COLORS.faint }}>{editorNote}</span>
              {sendButton("Submit to AIDA", () => send(`I've updated ${open.label}, "${open.title}". What do you think?`), busy || off)}
            </div>
          </div>
        ) : (
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
              disabled={off}
              style={{ ...fieldStyle, resize: "none", fontSize: 14.5, lineHeight: 1.45, padding: "10px 12px" }}
            />
            {sendButton("", () => send(), busy || !text.trim() || off)}
          </div>
        )}
      </div>
    </div>
  );
}
