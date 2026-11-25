"use client";

// AIDA for a student: a chat that takes over the whole screen, opened from a lesson card. "Back to
// lessons" (or Esc, or the browser's Back button) closes it and the Lessons page is where it was.
// AIDA reads their work and never changes it itself: a deliverable it writes out in the chat goes in only
// when the student presses its "Add to 1A" button. When AIDA pulls deliverables into the chat they appear as
// buttons above the reply box; opening one turns the reply box into that deliverable (see AidaChat.jsx).

import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, Sparkles } from "lucide-react";
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
    // the Lessons page behind does not scroll while the chat covers it
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  // On a wide screen the list of deliverables sits in a column beside the conversation.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const fit = () => setWide(window.innerWidth >= 900);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

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

  const barButton = { display: "flex", alignItems: "center", gap: 8, minHeight: 40, border: "1px solid rgba(255,255,255,0.5)", background: "transparent", color: COLORS.white, padding: "0 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AIDA"
      data-aida-screen
      style={{ position: "fixed", inset: 0, zIndex: 200, background: COLORS.bg, display: "flex", flexDirection: "column", "--aida-text-size": "16px", "--aida-input-size": "16px" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", background: COLORS.ink, borderBottom: `2px solid ${COLORS.accent}`, flexShrink: 0 }}>
        <button type="button" onClick={onClose} style={{ ...barButton, background: COLORS.white, borderColor: COLORS.white, color: COLORS.ink }}>
          <ArrowLeft size={17} strokeWidth={2} /> Back to lessons
        </button>
        <Sparkles size={20} color={COLORS.white} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: COLORS.white, lineHeight: 1.25 }}>AIDA</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.74)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Lesson {lesson.number}: {lesson.title}</div>
        </div>
        {messages?.length > 0 && (
          <button type="button" onClick={newChat} title="Start a new chat" style={barButton}>
            <RotateCcw size={15} /> New chat
          </button>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.muted, padding: "8px 20px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface, lineHeight: 1.45, textAlign: "center", flexShrink: 0 }}>
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
          wide={wide}
          column={820}
          emptyHint={`Ask about your work, or pick a deliverable from the Deliverables list ${wide ? "on the left" : "below"} to work on it here.`}
          disabledReason={closed ? closed : remaining === 0 ? "You have reached today's limit for AIDA. It resets tomorrow." : ""}
        />
      )}
    </div>
  );
}
