"use client";

// AIDA for a student: a panel down the right side of the Lessons page, opened from a lesson card.
// The student keeps their deliverables in view and types their own work; AIDA can read it, never change it.

import { useEffect, useState } from "react";
import { X, RotateCcw, Sparkles } from "lucide-react";
import { COLORS, Loading, Notice } from "./ui";
import { api } from "@/lib/api";
import AidaChat from "./AidaChat";

export default function AidaPanel({ lesson, onClose, beforeSend }) {
  const [messages, setMessages] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [error, setError] = useState(null);
  const url = `/api/aida/chat?lesson=${encodeURIComponent(lesson.id)}`;

  useEffect(() => {
    setMessages(null);
    setError(null);
    api
      .get(url)
      .then((d) => {
        setMessages(d.messages.map(({ role, content }) => ({ role, content })));
        setRemaining(d.remaining);
      })
      .catch((e) => setError(e.message));
  }, [url]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Answers still being saved must reach the server first: AIDA reads the saved copy.
  const post = async (text) => {
    await beforeSend?.();
    const res = await fetch("/api/aida/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId: lesson.id, message: text }) });
    if (res.ok) setRemaining((n) => (n === null ? n : Math.max(0, n - 1)));
    return res;
  };

  const newChat = async () => {
    try {
      await api.del(url);
      setMessages([]);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <aside
      aria-label="AIDA"
      style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(440px, 100vw)", zIndex: 60, background: "#fff", borderLeft: `1px solid ${COLORS.border}`, boxShadow: "-12px 0 32px rgba(15,23,42,0.10)", display: "flex", flexDirection: "column" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: COLORS.indigoSoft, color: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Sparkles size={17} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: COLORS.text }}>AIDA</div>
          <div style={{ fontSize: 12.5, color: COLORS.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Lesson {lesson.number}: {lesson.title}</div>
        </div>
        {messages?.length > 0 && (
          <button type="button" onClick={newChat} title="Start a new chat" style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: "#fff", borderRadius: 9, padding: "7px 10px", fontSize: 12.5, fontWeight: 700, color: COLORS.sub, cursor: "pointer", fontFamily: "inherit" }}>
            <RotateCcw size={13} /> New chat
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close AIDA" style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.sub, padding: 6, display: "flex" }}>
          <X size={20} />
        </button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.faint, padding: "8px 16px", borderBottom: `1px solid ${COLORS.border}`, lineHeight: 1.45 }}>
        AIDA is an AI. It can read your EIB deliverables and coach you on them; the writing is yours. Chats are saved and EIB staff may review them. Don't share personal details.
      </div>
      {error ? (
        <div style={{ padding: 16 }}><Notice onClose={onClose}>{error}</Notice></div>
      ) : messages === null ? (
        <Loading />
      ) : (
        <AidaChat
          messages={messages}
          setMessages={setMessages}
          post={post}
          emptyHint="Ask about your work for this lesson. For example: “What is the weakest part of my answer?”"
          disabledReason={remaining === 0 ? "You have reached today's limit for AIDA. It resets tomorrow." : ""}
        />
      )}
    </aside>
  );
}
