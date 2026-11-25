"use client";

// The AIDA conversation box: the messages, the input, and the reply appearing as it is written.
// Used by the student panel on the Lessons page and by the super admin's Chat with AIDA page; each passes
// `post(text, history)`, which returns the fetch for its own route.
//
// Deliverables in the chat. Buttons ("1A", "1B") sit just above the reply box, so they stay put while the
// chat scrolls. A button gets there in two ways: the student picks the deliverable from the list (`catalog`,
// grouped by chapter: a column on the left when `wide`, a drop-down above the reply box otherwise), or AIDA
// pulls it in by writing a [[show:ID]] line (see lib/aida/context.js; never shown as text). Opening a button
// turns the reply box into that deliverable, and Send becomes "Submit to AIDA".
// `deliverableOf(id)` describes one: { label, title, task, editor, stamp, item, payload, apply }
// (stamp changes when the answer does; apply(payload) writes the answer).
//
// A deliverable AIDA has written out arrives between [[draft:ID]] and [[/draft]] (see lib/aida/draft.js).
// It is shown in a box with an "Add to 1A" button, which puts it into that deliverable.
//
// AIDA Unlocked uses the same box with no deliverables. Web addresses in a reply are links, and while it
// searches the web the reply carries [[searching]] (never shown as text), which shows as a status line.

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, X, ChevronDown, ChevronRight, ListChecks, Check, FilePlus2 } from "lucide-react";
import { COLORS, Notice, fieldStyle } from "./ui";
import { PayloadView } from "./DeliverableInputs";
import { splitReply, draftPayload, sameAnswer } from "@/lib/aida/draft";

const ERROR_MARK = "[[AIDA_ERROR]]";
const CARD = /\[\[show:([^\]\s]+)\]\]/g;
export const AIDA_MAX_CHARS = 2000;

// A reply without its markers (one still being written is hidden too).
const SEARCHING = "[[searching]]";
const visible = (content) => String(content).replaceAll(SEARCHING, "").replace(CARD, "").replace(/\[\[[^\]]*\]?$/, "").replace(/\n{3,}/g, "\n\n").trim();
// Text with its web addresses as links.
const LINK = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/;
const linked = (str) => (LINK.test(str) ? str.split(LINK).map((part, i) => (i % 2 ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.action }}>{part}</a> : part)) : str);
const shownIn = (content) => [...new Set([...String(content).matchAll(CARD)].map((m) => m[1]))];
// The deliverables AIDA wrote out in a reply (finished ones only).
const draftedIn = (content) => splitReply(content).filter((p) => p.draft?.done).map((p) => p.draft.id);

/* A deliverable AIDA wrote out: the answer as it will look, and the button that puts it in. */
function Draft({ draft, d, onAdd }) {
  const payload = d?.item ? draftPayload(d.item, draft.body) : null;
  const box = { border: `1px solid ${COLORS.border2}`, padding: 10, margin: "8px 0", background: COLORS.bg };
  // Still being written, or not something a button can put in: plain text.
  if (!payload) return <div style={box}>{draft.body}</div>;
  const isIn = sameAnswer(d.item, d.payload, payload);
  const hasOther = !isIn && !isEmpty(d.item, d.payload);
  return (
    <div style={box} data-draft={draft.id}>
      {d.item.type === "table" ? <PayloadView type="table" payload={payload} /> : <div>{payload.text}</div>}
      {draft.done && d.apply && (
        <button type="button" disabled={isIn} onClick={() => onAdd(draft.id, payload)} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, border: "none", padding: "8px 13px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: isIn ? "default" : "pointer", background: isIn ? "transparent" : COLORS.action, color: isIn ? COLORS.ink : COLORS.white }}>
          {isIn ? <Check size={15} /> : <FilePlus2 size={15} />}
          {isIn ? `Added to ${d.label}` : hasOther ? `Replace ${d.label} with this` : `Add to ${d.label}`}
        </button>
      )}
    </div>
  );
}
const isEmpty = (item, payload) => (item.type === "text" ? !String(payload?.text || "").trim() : !(payload?.rows || []).some((r) => r.some((c) => String(c || "").trim())));

/* The deliverables, chapter by chapter. Picking one puts (or removes) its button above the reply box. */
function Catalog({ catalog, startOpen, active, onPick }) {
  const [openGroups, setOpenGroups] = useState(() => new Set(startOpen ? [startOpen] : []));
  const toggle = (id) => setOpenGroups((prev) => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {catalog.map((g) => {
        const isOpen = openGroups.has(g.id);
        return (
          <div key={g.id}>
            <button type="button" aria-expanded={isOpen} onClick={() => toggle(g.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", padding: "8px 6px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              {isOpen ? <ChevronDown size={15} color={COLORS.text2} /> : <ChevronRight size={15} color={COLORS.text2} />}
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>{g.label}</span>
                <span style={{ display: "block", fontSize: 12, color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
              </span>
            </button>
            {isOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 0 6px 21px" }}>
                {g.items.length === 0 && <span style={{ fontSize: 12.5, color: COLORS.muted, padding: "4px 8px" }}>No deliverables.</span>}
                {g.items.map((d) => {
                  const on = active.includes(d.id);
                  return (
                    <button key={d.id} type="button" aria-pressed={on} title={on ? "Remove from the chat" : "Bring into the chat"} onClick={() => onPick(d.id)} style={{ display: "flex", alignItems: "baseline", gap: 8, border: "none", padding: "6px 8px", cursor: "pointer", fontFamily: "inherit", textAlign: "left", background: on ? COLORS.actionBg : "transparent", color: COLORS.ink }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: on ? COLORS.action : COLORS.ink, flexShrink: 0 }}>{d.label}</span>
                      <span style={{ fontSize: 13, lineHeight: 1.35 }}>{d.title}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AidaChat({ messages, setMessages, post, emptyHint, disabledReason = "", deliverableOf, catalog = [], currentGroup = "", wide = false, column = 0, editorNote = "This is your deliverable. It saves as you type.", maxChars = AIDA_MAX_CHARS, placeholder = "Ask AIDA about your work…" }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [picked, setPicked] = useState([]); // chosen from the list
  const [removed, setRemoved] = useState([]); // pulled in by AIDA, then taken out from the list: "id@message"
  const [listOpen, setListOpen] = useState(false); // the drop-down, when not wide
  const endRef = useRef(null);
  const submitted = useRef({}); // id -> the answer as it was when opened or last submitted

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // The buttons: what the student picked, plus whatever AIDA pulled in most recently.
  // Taking one out lasts until AIDA pulls it in again with a later reply.
  let pulled = [];
  let pulledAt = -1;
  for (let i = messages.length - 1; i >= 0 && !pulled.length; i--) {
    if (messages[i].role !== "assistant") continue;
    pulled = [...shownIn(messages[i].content), ...draftedIn(messages[i].content)];
    pulledAt = i;
  }
  pulled = pulled.filter((id) => !removed.includes(`${id}@${pulledAt}`));
  const buttons = deliverableOf ? [...new Set([...picked, ...pulled])].map((id) => ({ id, ...(deliverableOf(id) || {}) })).filter((d) => d.label) : [];
  const open = buttons.find((d) => d.id === openId && d.editor) || null;

  const openButton = (d) => {
    if (open?.id === d.id) return setOpenId(null);
    if (!(d.id in submitted.current)) submitted.current[d.id] = d.stamp;
    setOpenId(d.id);
  };
  // "Add to 1A": AIDA's version becomes the answer, and the deliverable's button stays above the reply box.
  const addDraft = (id, payload) => {
    deliverableOf?.(id)?.apply?.(payload);
    setPicked((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  // The list turns a deliverable's button on or off, whoever put it there.
  const pick = (id) => {
    const on = picked.includes(id) || pulled.includes(id);
    setPicked((prev) => (on ? prev.filter((x) => x !== id) : [...prev, id]));
    setRemoved((prev) => (on ? [...prev, `${id}@${pulledAt}`] : prev.filter((x) => !x.startsWith(`${id}@`))));
    if (openId === id) setOpenId(null);
    setListOpen(false);
  };

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
  // Say "updated" only when the answer really changed since it was opened or last submitted.
  const submit = () => {
    const changed = submitted.current[open.id] !== open.stamp;
    submitted.current[open.id] = open.stamp;
    send(changed ? `I've updated ${open.label}, "${open.title}". What do you think?` : `Here is my ${open.label}, "${open.title}", as it stands. What do you think of it?`);
  };

  const bubble = (m, i) => {
    const mine = m.role === "user";
    const parts = mine ? [] : splitReply(m.content);
    const shown = mine ? m.content : parts.some((p) => p.draft)
      ? parts.map((p, k) => (p.draft ? <Draft key={k} draft={p.draft} d={deliverableOf?.(p.draft.id)} onAdd={addDraft} /> : visible(p.text) && <div key={k}>{linked(visible(p.text))}</div>))
      : linked(visible(m.content));
    const writing = busy && i === messages.length - 1;
    // The last thing in the reply so far is a web search that has not produced words yet.
    const searching = !mine && writing && String(m.content).trimEnd().endsWith(SEARCHING);
    const waiting = searching ? "Searching the web…" : writing ? "AIDA is thinking…" : deliverableOf ? "Your deliverables are just above the reply box." : "";
    return (
      <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
        <div style={{ maxWidth: "min(88%, 760px)", padding: "11px 14px", fontSize: "var(--aida-text-size, 14.5px)", lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: mine ? COLORS.ink : COLORS.white, color: mine ? COLORS.white : COLORS.ink, border: mine ? "none" : `1px solid ${COLORS.border}` }}>
          {shown}
          {(!shown || searching) && waiting && <span style={{ color: COLORS.muted, display: "block", marginTop: shown ? 8 : 0 }}>{waiting}</span>}
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
      style={{ height: 44, minWidth: 44, flexShrink: 0, border: "none", padding: label ? "0 16px" : 0, background: COLORS.action, color: COLORS.white, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
    >
      {label} <Send size={label ? 16 : 18} />
    </button>
  );
  const hasList = catalog.length > 0 && Boolean(deliverableOf);
  // `column` (a width in px) keeps the conversation in a centred column when the chat has a whole screen.
  const side = column ? `max(16px, calc((100% - ${column}px) / 2))` : "16px";
  const list = hasList && <Catalog catalog={catalog} startOpen={currentGroup} active={buttons.map((d) => d.id)} onPick={pick} />;

  return (
    <div style={{ display: "flex", minHeight: 0, flex: 1 }}>
      {hasList && wide && (
        <nav aria-label="Deliverables" style={{ width: 250, flexShrink: 0, borderRight: `1px solid ${COLORS.border}`, background: COLORS.surface, overflowY: "auto", padding: "14px 10px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.12em", textTransform: "uppercase", padding: "0 6px 8px" }}>Deliverables</div>
          {list}
        </nav>
      )}
      <div style={{ display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, flex: 1 }}>
        <div aria-live="polite" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: `16px ${side} 8px`, background: COLORS.bg }}>
          {messages.length === 0 && (
            <div style={{ margin: "auto", textAlign: "center", color: COLORS.muted, fontSize: 14, lineHeight: 1.55, maxWidth: 380 }}>
              <Sparkles size={22} color={COLORS.action} style={{ marginBottom: 8 }} />
              <div>{emptyHint}</div>
            </div>
          )}
          {messages.map(bubble)}
          <div ref={endRef} />
        </div>

        <div style={{ padding: `10px ${side} max(14px, env(safe-area-inset-bottom))`, borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
          {error && <div style={{ marginBottom: 8 }}><Notice onClose={() => setError(null)}>{error}</Notice></div>}
          {disabledReason && <div style={{ marginBottom: 8 }}><Notice tone="amber">{disabledReason}</Notice></div>}

          {hasList && !wide && listOpen && (
            <nav aria-label="Deliverables" style={{ border: `1px solid ${COLORS.border}`, padding: 8, marginBottom: 10, maxHeight: "40vh", overflowY: "auto" }}>{list}</nav>
          )}
          {(buttons.length > 0 || (hasList && !wide)) && (
            <div aria-label="Deliverables in this chat" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {hasList && !wide && (
                <button type="button" aria-expanded={listOpen} onClick={() => setListOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.ink, padding: "7px 11px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                  <ListChecks size={15} /> Deliverables {listOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              {buttons.map((d) => {
                const on = open?.id === d.id;
                return (
                  <button key={d.id} type="button" data-deliverable={d.id} title={d.title} aria-pressed={on} disabled={!d.editor} onClick={() => openButton(d)} style={{ display: "flex", alignItems: "center", gap: 7, maxWidth: "100%", border: `1px solid ${on ? COLORS.ink : COLORS.border2}`, background: on ? COLORS.ink : COLORS.bg, color: on ? COLORS.white : COLORS.ink, padding: "7px 11px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: d.editor ? "pointer" : "default" }}>
                    {d.label}
                    <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{d.title}</span>
                  </button>
                );
              })}
            </div>
          )}

          {open ? (
            <div style={{ border: `1px solid ${COLORS.border2}`, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{open.label} · {open.title}</div>
                  {open.task && <div style={{ fontSize: 12.5, color: COLORS.text2, lineHeight: 1.45, marginTop: 2 }}>{open.task}</div>}
                </div>
                <button type="button" onClick={() => setOpenId(null)} aria-label="Back to the message box" title="Back to the message box" style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.text2, padding: 2, display: "flex" }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ maxHeight: "38vh", overflow: "auto" }}>{open.editor}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: COLORS.muted }}>{editorNote}</span>
                {sendButton("Submit to AIDA", submit, busy || off)}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                aria-label="Message to AIDA"
                value={text}
                maxLength={maxChars}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  // On a touch keyboard Enter starts a new line, as in any messaging app; the button sends.
                  if (e.key === "Enter" && !e.shiftKey && !window.matchMedia?.("(pointer: coarse)").matches) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={placeholder}
                rows={2}
                disabled={off}
                style={{ ...fieldStyle, resize: "none", fontSize: "var(--aida-input-size, 14.5px)", lineHeight: 1.45, padding: "10px 12px" }}
              />
              {sendButton("", () => send(), busy || !text.trim() || off)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
