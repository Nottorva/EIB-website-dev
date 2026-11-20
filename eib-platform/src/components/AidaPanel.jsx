"use client";

// AIDA for a student: a panel down the right side of the Lessons page, opened from a lesson card.
// AIDA reads their work and never changes it itself: a deliverable it writes out in the chat goes in only
// when the student presses its "Add to 1A" button. When AIDA pulls deliverables into the chat they appear as
// buttons above the reply box; opening one turns the reply box into that deliverable (see AidaChat.jsx).

import { useEffect, useState } from "react";
import { X, RotateCcw, Sparkles } from "lucide-react";
import { COLORS, Loading, Notice } from "./ui";
import { api } from "@/lib/api";
import AidaChat from "./AidaChat";
import { DeliverableInput } from "./DeliverableInputs";

export default function AidaPanel({ lesson, lessons = [], submissions = {}, onChangePayload, onClose, beforeSend }) {
  const [messages, setMessages] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [closed, setClosed] = useState("");
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
        setClosed(d.closed || "");
      })
      .catch((e) => setError(e.message));
  }, [url]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Answers still being saved must reach the server first: AIDA reads the saved copy, and is sent
  // only what changed since its last reply.
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

  // A deliverable AIDA pulled into the chat: its short name for the button above the reply box, and the
  // student's own answer to write in. Saved exactly as on the lesson card.
  const deliverableOf = (id) => {
    for (const l of lessons) {
      const i = l.deliverables.findIndex((d) => d.id === id);
      if (i < 0) continue;
      const item = l.deliverables[i];
      return {
        label: `${l.number}${String.fromCharCode(65 + i)}`,
        title: item.title,
        task: item.instructions,
        editor: <DeliverableInput item={item} payload={submissions[`${l.id}:${id}`]?.payload} onChange={(payload) => onChangePayload?.(l.id, id, payload)} />,
        stamp: JSON.stringify(submissions[`${l.id}:${id}`]?.payload ?? null),
        item,
        payload: submissions[`${l.id}:${id}`]?.payload,
        apply: (payload) => onChangePayload?.(l.id, id, payload),
      };
    }
    return null;
  };
  // The list beside the chat: every deliverable, chapter by chapter. Picking one puts its button above
  // the reply box without having to ask AIDA for it.
  const catalog = lessons.map((l) => ({ id: l.id, label: l.chapterLabel || `Lesson ${l.number}`, title: l.title, items: l.deliverables.map((d, i) => ({ id: d.id, label: `${l.number}${String.fromCharCode(65 + i)}`, title: d.title })) }));

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
        AIDA is an AI. It reads your EIB deliverables, asks you for what it needs, and writes drafts from your answers. Check every draft: the venture is yours. Chats are saved and EIB staff may review them. Don't share personal details.
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
          deliverableOf={deliverableOf}
          catalog={catalog}
          currentGroup={lesson.id}
          emptyHint="Ask about your work, or pick a deliverable from the Deliverables list below to work on it here."
          disabledReason={closed ? closed : remaining === 0 ? "You have reached today's limit for AIDA. It resets tomorrow." : ""}
        />
      )}
    </aside>
  );
}
