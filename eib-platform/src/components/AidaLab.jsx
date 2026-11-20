"use client";

// Chat with AIDA (super admin), at /aida/chat. The same AIDA students get: pick the lesson it is opened
// from and whose deliverables it reads, then talk to it. Nothing here is saved.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, RotateCcw, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { COLORS, Notice, Loading, FieldLabel, fieldStyle } from "./ui";
import { api } from "@/lib/api";
import AidaChat from "./AidaChat";
import { DeliverableInput } from "./DeliverableInputs";

const ADMIN = "/api/aida/admin";
const card = { background: COLORS.card, borderRadius: 18, padding: "20px 24px", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" };
const selectStyle = { ...fieldStyle, width: "auto", maxWidth: "100%", padding: "9px 12px", fontSize: 13.5, cursor: "pointer" };
const button = { display: "flex", alignItems: "center", gap: 7, border: `1px solid ${COLORS.border}`, background: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700, color: COLORS.text, cursor: "pointer", fontFamily: "inherit" };
const pre = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, overflowY: "auto" };

export default function AidaLab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lessonId, setLessonId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [messages, setMessages] = useState([]);
  const [preview, setPreview] = useState(null);
  const [work, setWork] = useState({}); // the chosen student's saved answers
  const [edits, setEdits] = useState({}); // trial changes made here
  const told = useRef({}); // each trial change as AIDA was last sent it

  useEffect(() => {
    api
      .get(ADMIN)
      .then((d) => {
        setData(d);
        setLessonId(d.lessons[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }, []);

  // A different lesson or student is a different conversation.
  useEffect(() => {
    setMessages([]);
    setPreview(null);
  }, [lessonId, studentId]);
  useEffect(() => {
    setEdits({});
    setWork({});
    told.current = {};
    if (!studentId) return;
    api
      .get(`/api/submissions?studentId=${encodeURIComponent(studentId)}`)
      .then((rows) => setWork(Object.fromEntries(rows.map((s) => [`${s.lessonId}:${s.deliverableId}`, s.payload]))))
      .catch((e) => setError(e.message));
  }, [studentId]);

  // AIDA is told which answers changed since its last reply, as it is for a student.
  const post = (text, history) => {
    const changed = Object.keys(edits).filter((key) => JSON.stringify(edits[key]) !== (key in told.current ? told.current[key] : JSON.stringify(work[key] ?? null)));
    for (const key of changed) told.current[key] = JSON.stringify(edits[key]);
    return fetch(ADMIN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId, studentId, edits, changed, messages: [...history, { role: "user", content: text }] }) });
  };
  const togglePreview = async () => {
    if (preview) return setPreview(null);
    try {
      setPreview(await api.post(ADMIN, { preview: true, lessonId, studentId, edits }));
    } catch (e) {
      setError(e.message);
    }
  };

  // The deliverables AIDA pulls in appear as buttons above the reply box. Opening one shows the chosen
  // student's answer as a test copy to edit and submit, exactly as the student would.
  const deliverableOf = (id) => {
    for (const l of data.lessons) {
      const i = l.deliverables.findIndex((d) => d.id === id);
      if (i < 0) continue;
      const item = l.deliverables[i];
      const key = `${l.id}:${id}`;
      return {
        label: `${l.number}${String.fromCharCode(65 + i)}`,
        title: item.title,
        task: item.instructions,
        editor: <DeliverableInput item={item} payload={key in edits ? edits[key] : work[key]} onChange={(payload) => setEdits((e) => ({ ...e, [key]: payload }))} />,
        stamp: JSON.stringify((key in edits ? edits[key] : work[key]) ?? null),
        item,
        payload: key in edits ? edits[key] : work[key],
        apply: (payload) => setEdits((e) => ({ ...e, [key]: payload })),
      };
    }
    return null;
  };
  // The list beside the chat: every deliverable, chapter by chapter. Picking one puts its button above
  // the reply box without having to ask AIDA for it.
  const catalog = (data?.lessons || []).filter((l) => l.studentVisible || l.id === lessonId).map((l) => ({ id: l.id, label: l.chapterLabel || `Lesson ${l.number}`, title: l.title, items: l.deliverables.map((d, i) => ({ id: d.id, label: `${l.number}${String.fromCharCode(65 + i)}`, title: d.title })) }));
  const who = data?.students.find((s) => s.id === studentId);
  const whose = who ? `${who.name}'s` : "blank";

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 24px 60px" }}>
        <Link href="/aida" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 800, color: COLORS.indigo, textDecoration: "none", marginBottom: 12 }}>
          <ArrowLeft size={15} /> AIDA's context
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <Sparkles size={26} color={COLORS.indigo} />
          <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.text }}>Chat with AIDA</span>
        </div>

        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {!data ? (
          !error && <Loading />
        ) : data.lessons.length === 0 ? (
          <div style={{ ...card, color: COLORS.faint }}>Create a lesson first, then chat with AIDA about it.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ ...card, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>
                Opened from lesson
                <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} style={selectStyle}>
                  {data.lessons.map((l) => <option key={l.id} value={l.id}>Lesson {l.number}: {l.title}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>
                Reading the deliverables of
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={selectStyle}>
                  <option value="">Nobody (blank deliverables)</option>
                  {data.students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isTest ? " (test account)" : ""}</option>)}
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                <button type="button" onClick={togglePreview} style={button}>
                  {preview ? <EyeOff size={15} /> : <Eye size={15} />} {preview ? "Hide what AIDA sees" : "Show what AIDA sees"}
                </button>
                <button type="button" onClick={() => setMessages([])} disabled={!messages.length} style={{ ...button, cursor: messages.length ? "pointer" : "default", opacity: messages.length ? 1 : 0.5 }}>
                  <RotateCcw size={15} /> New chat
                </button>
              </div>
            </div>

            {!data.live && <Notice tone="amber">No AI key is set on this server, so replies here are a sandbox stand-in, not the real AIDA.</Notice>}

            {preview && (
              <div style={card}>
                <div style={{ fontSize: 13, color: COLORS.faint, lineHeight: 1.5, marginBottom: 12 }}>Exactly this, then the conversation. No student name or email is included.</div>
                <FieldLabel>1. Same for every student: how AIDA behaves, your context, every lesson</FieldLabel>
                <pre style={{ ...pre, maxHeight: 300, margin: "0 0 14px" }}>{preview.shared}</pre>
                <FieldLabel>2. This student: the lesson they are on and all of their work</FieldLabel>
                <pre style={{ ...pre, maxHeight: 420, margin: 0 }}>{preview.context}</pre>
              </div>
            )}

            <div style={{ ...card, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "min(680px, 74vh)" }}>
              <AidaChat messages={messages} setMessages={setMessages} post={post} deliverableOf={deliverableOf} catalog={catalog} currentGroup={lessonId} wide editorNote="A test copy. Nothing you type here is saved to the student's work." emptyHint={`This is the AIDA students get. It is reading ${whose} deliverables. Nothing here is saved.`} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
