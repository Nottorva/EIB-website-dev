"use client";

// AIDA Unlocked (super admin), at /aida-unlocked: the demo AI cofounder. No lesson and no deliverables:
// it works with any founder on any part of a venture, from the EIB method, and it can search the web.
// The method is one text file (the textbook chapters and class slides) uploaded here and kept in the
// database. The conversation is kept in this browser only, so a refresh does not lose it.

import { useEffect, useRef, useState } from "react";
import { Rocket, RotateCcw, Maximize2, Upload, BookOpen } from "lucide-react";
import { COLORS, Notice, Loading } from "./ui";
import { api } from "@/lib/api";
import AidaChat from "./AidaChat";
import ChatFrame from "./ChatFrame";

const API = "/api/aida/unlocked";
const SAVED = "eib:aida-unlocked:chat";
const card = { background: COLORS.card, borderRadius: 18, padding: "16px 20px", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" };
const button = { display: "flex", alignItems: "center", gap: 7, border: `1px solid ${COLORS.border}`, background: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700, color: COLORS.text, cursor: "pointer", fontFamily: "inherit" };

const STARTERS = [
  "I have a problem I think is worth solving. Help me find out if it is.",
  "Research my competitors and what they charge.",
  "Size my market, and show me the math.",
  "Write an interview guide to validate my problem.",
  "Work out my pricing and unit economics.",
  "Build my pitch, then grill me like an investor.",
];

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
      <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 6 }}>Your AI cofounder</span>
      Tell it about your venture, or start with something like:
      <span style={{ display: "block", marginTop: 10, textAlign: "left" }}>
        {STARTERS.map((s) => <span key={s} style={{ display: "block", padding: "3px 0" }}>· {s}</span>)}
      </span>
    </span>
  );

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Rocket size={26} color={COLORS.indigo} />
            <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.text }}>AIDA Unlocked</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.amber, background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 999, padding: "3px 10px" }}>Demo</span>
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
        <div style={{ fontSize: 14.5, color: COLORS.sub, marginBottom: 18 }}>The AI cofounder for any founder: the whole EIB method, live web research, and finished work instead of advice. Only super admins can open it.</div>

        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {!data ? (
          !error && <Loading />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!data.live && <Notice tone="amber">No AI key is set on this server, so replies here are a sandbox stand-in, not the real AIDA Unlocked.</Notice>}

            <div style={{ ...card, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <BookOpen size={20} color={k.words ? COLORS.indigo : COLORS.amber} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 220, fontSize: 13.5, lineHeight: 1.5, color: COLORS.sub }}>
                <span style={{ fontWeight: 800, color: COLORS.text }}>The EIB method: </span>
                {k.words
                  ? `${k.name || "a file"}, ${k.words.toLocaleString()} words, loaded ${new Date(k.updatedAt).toLocaleDateString("en-CA")}. It is read on every message.`
                  : "nothing loaded yet. Until you load the method file (the chapters and class slides as one text file), AIDA Unlocked works from general knowledge only."}
                {note && <span style={{ color: COLORS.indigo, fontWeight: 700 }}> {note}</span>}
              </div>
              <input ref={fileRef} type="file" accept=".txt,.md,text/plain" aria-label="Method file" onChange={(e) => upload(e.target.files?.[0])} style={{ display: "none" }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...button, opacity: uploading ? 0.6 : 1 }}>
                <Upload size={15} /> {uploading ? "Loading…" : k.words ? "Replace the method file" : "Load the method file"}
              </button>
            </div>

            <ChatFrame full={full} onExit={() => setFull(false)} title="AIDA Unlocked" onNew={messages.length ? () => setMessages([]) : null}>
              <AidaChat messages={messages} setMessages={setMessages} post={post} maxChars={data.maxChars} placeholder="Tell AIDA Unlocked about your venture, or ask for anything a cofounder would do…" emptyHint={hint} />
            </ChatFrame>
          </div>
        )}
      </div>
    </div>
  );
}
