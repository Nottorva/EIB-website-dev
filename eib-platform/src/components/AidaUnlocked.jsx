"use client";

// AIDA Unlocked (super admin), at /aida-unlocked: the demo AI cofounder. No lesson and no deliverables:
// it works with any founder on any part of a venture, from the EIB method, and it can search the web.
// The method is one text file (the textbook chapters and class slides) uploaded here and kept in the
// database. The conversation is kept in this browser only, so a refresh does not lose it.

import { useEffect, useRef, useState } from "react";
import { Rocket, RotateCcw, Maximize2, Upload, BookOpen, Link2, Copy, Check, Trash2 } from "lucide-react";
import { COLORS, Notice, Loading, fieldStyle } from "./ui";
import { api } from "@/lib/api";
import AidaChat from "./AidaChat";
import ChatFrame from "./ChatFrame";

const API = "/api/aida/unlocked";
const SAVED = "eib:aida-unlocked:chat";
const card = { background: COLORS.surface, padding: "16px 20px", border: `1px solid ${COLORS.border}` };
const button = { display: "flex", alignItems: "center", gap: 7, border: `1px solid ${COLORS.border}`, background: COLORS.surface, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, color: COLORS.ink, cursor: "pointer", fontFamily: "inherit" };

const STARTERS = [
  "I have a problem I think is worth solving. Help me find out if it is.",
  "Research my competitors and what they charge.",
  "Size my market, and show me the math.",
  "Write an interview guide to validate my problem.",
  "Work out my pricing and unit economics.",
  "Build my pitch, then grill me like an investor.",
];

const LINKS = "/api/aida/demo-links";
const day = (iso) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
const PILL = {
  unused: { text: "Not opened yet", color: COLORS.ink, bg: COLORS.bg },
  open: { text: "In use", color: COLORS.successText, bg: COLORS.successBg },
  spent: { text: "Spent", color: COLORS.text2, bg: COLORS.bg },
  expired: { text: "Expired", color: COLORS.text2, bg: COLORS.bg },
};

/* One-time demo links: make one, copy it, send it. See lib/aida/demo.js for the rules. */
function DemoLinks({ onError }) {
  const [data, setData] = useState(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [fresh, setFresh] = useState("");

  useEffect(() => {
    api.get(LINKS).then(setData).catch((e) => onError(e.message));
  }, [onError]);

  const urlOf = (id) => `${window.location.origin}/demo/${id}`;
  const copy = async (id) => {
    try {
      await navigator.clipboard.writeText(urlOf(id));
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? "" : c)), 2000);
    } catch {
      window.prompt("Copy this link:", urlOf(id));
    }
  };
  const create = async () => {
    setBusy(true);
    try {
      const made = await api.post(LINKS, { label });
      setData(made);
      setFresh(made.id);
      setLabel("");
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (l) => {
    if (!window.confirm(l.status === "open" ? "Delete this link? The person using it will be cut off." : "Delete this link?")) return;
    try {
      setData(await api.del(`${LINKS}?id=${encodeURIComponent(l.id)}`));
    } catch (e) {
      onError(e.message);
    }
  };
  const detail = (l) =>
    l.status === "unused" ? `Made ${day(l.createdAt)}. Lapses ${day(l.expiresAt)} if nobody opens it.`
    : l.status === "expired" ? `Made ${day(l.createdAt)}. Nobody opened it.`
    : `Opened ${day(l.usedAt)}. ${l.messages} of ${data.rules.messages} messages${l.cost ? `, $${l.cost.toFixed(2)}` : ""}.`;
  const small = { ...button, padding: "7px 11px", fontSize: 13 };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Link2 size={19} color={COLORS.ink} />
        <span style={{ fontSize: 15.5, fontWeight: 600, color: COLORS.ink }}>Demo links</span>
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: COLORS.text2, marginBottom: 12 }}>
        Send someone a link to try AIDA Unlocked with no account. Each link works for one person: the first to press Start gets it{data ? `, for ${data.rules.hours} hours and ${data.rules.messages} messages` : ""}, and after that the link is spent for everyone else.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input aria-label="Who the link is for" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !busy && create()} placeholder="Who is it for? (optional, only you see this)" style={{ ...fieldStyle, flex: "1 1 220px", width: "auto", padding: "9px 12px", fontSize: "var(--aida-input-size, 14px)" }} />
        <button type="button" onClick={create} disabled={busy} style={{ ...button, border: "none", background: COLORS.action, color: COLORS.white, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
          <Link2 size={15} /> {busy ? "Making…" : "Create demo link"}
        </button>
      </div>

      {data?.links.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 14 }}>
          {data.links.map((l) => {
            const pill = PILL[l.status];
            return (
              <div key={l.id} data-demo-link={l.status} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "11px 0", borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{l.label || "Demo link"}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: pill.color, background: pill.bg, padding: "2px 9px" }}>{pill.text}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 2 }}>{detail(l)}</div>
                  {l.status === "unused" && l.id === fresh && <div style={{ fontSize: 12.5, color: COLORS.ink, marginTop: 4, overflowWrap: "anywhere" }}>{urlOf(l.id)}</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {l.status === "unused" && (
                    <button type="button" onClick={() => copy(l.id)} style={small}>
                      {copied === l.id ? <Check size={14} color={COLORS.successText} /> : <Copy size={14} />} {copied === l.id ? "Copied" : "Copy link"}
                    </button>
                  )}
                  <button type="button" onClick={() => remove(l)} aria-label="Delete this link" title="Delete this link" style={{ ...small, color: COLORS.text2 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AidaUnlocked() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [full, setFull] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const restored = useRef(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api.get(API).then(setData).catch((e) => setError(e.message));
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVED) || "[]");
      if (Array.isArray(saved)) setMessages(saved.filter((m) => m && typeof m.content === "string" && m.content));
    } catch {}
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      window.localStorage.setItem(SAVED, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const post = (text, history) => fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [...history, { role: "user", content: text }] }) });

  const upload = async (file) => {
    if (!file) return;
    setError(null);
    setNote("");
    setUploading(true);
    try {
      const text = await file.text();
      if (!text.trim()) throw new Error("That file is empty.");
      const saved = await api.put(API, { knowledge: text, name: file.name });
      setData((d) => ({ ...d, knowledge: saved.knowledge }));
      setNote("Loaded. AIDA Unlocked uses it from the next message.");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const k = data?.knowledge;
  const hint = (
    <span>
      <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>Your AI cofounder</span>
      Tell it about your venture, or start with something like:
      <span style={{ display: "block", marginTop: 10, textAlign: "left" }}>
        {STARTERS.map((s) => <span key={s} style={{ display: "block", padding: "3px 0" }}>· {s}</span>)}
      </span>
    </span>
  );

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(16px, 4vw, 28px) clamp(12px, 4vw, 24px) 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Rocket size={26} color={COLORS.ink} />
            <span style={{ fontSize: "clamp(23px, 6.4vw, 30px)", fontWeight: 600, color: COLORS.ink, whiteSpace: "nowrap" }}>AIDA Unlocked</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.warnText, background: COLORS.warnBg, border: `1px solid ${COLORS.warnBorder}`, padding: "3px 10px" }}>Demo</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setFull(true)} style={button}>
              <Maximize2 size={15} /> Full screen
            </button>
            <button type="button" onClick={() => setMessages([])} disabled={!messages.length} style={{ ...button, cursor: messages.length ? "pointer" : "default", opacity: messages.length ? 1 : 0.5 }}>
              <RotateCcw size={15} /> New chat
            </button>
          </div>
        </div>
        <div style={{ fontSize: 14.5, color: COLORS.text2, marginBottom: 18 }}>The AI cofounder for any founder: the whole EIB method, live web research, and finished work instead of advice. Only super admins can open it.</div>

        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {!data ? (
          !error && <Loading />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!data.live && <Notice tone="amber">No AI key is set on this server, so replies here are a sandbox stand-in, not the real AIDA Unlocked.</Notice>}

            <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <BookOpen size={20} color={k.words ? COLORS.ink : COLORS.warnText} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 220, fontSize: 13.5, lineHeight: 1.5, color: COLORS.text2 }}>
                <span style={{ fontWeight: 600, color: COLORS.ink }}>The EIB method: </span>
                {k.words
                  ? `${k.name || "a file"}, ${k.words.toLocaleString()} words, loaded ${new Date(k.updatedAt).toLocaleDateString("en-CA")}. It is read on every message.`
                  : "nothing loaded yet. Until you load the method file (the chapters and class slides as one text file), AIDA Unlocked works from general knowledge only."}
                {note && <span style={{ color: COLORS.ink, fontWeight: 600 }}> {note}</span>}
              </div>
              <input ref={fileRef} type="file" accept=".txt,.md,text/plain" aria-label="Method file" onChange={(e) => upload(e.target.files?.[0])} style={{ display: "none" }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...button, opacity: uploading ? 0.6 : 1 }}>
                <Upload size={15} /> {uploading ? "Loading…" : k.words ? "Replace the method file" : "Load the method file"}
              </button>
            </div>

            <DemoLinks onError={setError} />

            <ChatFrame full={full} onExit={() => setFull(false)} title="AIDA Unlocked" onNew={messages.length ? () => setMessages([]) : null}>
              <AidaChat messages={messages} setMessages={setMessages} post={post} maxChars={data.maxChars} placeholder="Message AIDA Unlocked…" emptyHint={hint} />
            </ChatFrame>
          </div>
        )}
      </div>
    </div>
  );
}
