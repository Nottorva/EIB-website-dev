"use client";

// The AIDA page (super admin). Two tabs:
//   Context  everything AIDA is told: the general context, the core prompt, and each lesson's AI
//            instructions, with deliverables placed inline in the text or linked to the lesson.
//   Test     talk to AIDA as it would answer a student on a chosen lesson, seeing a chosen student's work.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Link2, X, RotateCcw, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import { COLORS, Notice, SaveIndicator, Loading, FieldLabel, fieldStyle } from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";
import AidaChat from "./AidaChat";

const ADMIN = "/api/aida/admin";
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 13.5, lineHeight: 1.55 };
const card = { background: COLORS.card, borderRadius: 18, padding: "24px 26px", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" };
const selectStyle = { ...fieldStyle, width: "auto", maxWidth: "100%", padding: "9px 12px", fontSize: 13.5, cursor: "pointer" };
const hint = { fontSize: 12.5, color: COLORS.faint, lineHeight: 1.5 };
const MODES = [
  { id: "off", label: "Off", note: "No student sees AIDA." },
  { id: "test", label: "Test account only", note: "Only the Test student sees AIDA on the Lessons page." },
  { id: "on", label: "On for students", note: "Every student sees an Ask AIDA button on each lesson." },
];

function Tabs({ value, onChange }) {
  return (
    <div role="tablist" style={{ display: "inline-flex", gap: 6, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 5 }}>
      {[["context", "Context"], ["test", "Test"]].map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} type="button" onClick={() => onChange(id)} style={{ border: "none", borderRadius: 9, padding: "9px 22px", fontSize: 14.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", background: value === id ? COLORS.indigo : "transparent", color: value === id ? "#fff" : COLORS.sub }}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* A dropdown of every deliverable, grouped by lesson. Picking one calls onPick and resets. */
function DeliverablePicker({ lessons, label, onPick, skip = () => false }) {
  return (
    <select aria-label={label} value="" onChange={(e) => e.target.value && onPick(...e.target.value.split("|"))} style={selectStyle}>
      <option value="">{label}</option>
      {lessons.filter((l) => l.deliverables.length).map((l) => (
        <optgroup key={l.id} label={`Lesson ${l.number}: ${l.title}`}>
          {l.deliverables.map((d) => (
            <option key={d.id} value={`${l.id}|${d.id}`} disabled={skip(l.id, d.id)}>{d.title}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function LessonContext({ lesson, lessons, onChange, highlight }) {
  const box = useRef(null);
  const ref = useRef(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "start" });
  }, [highlight]);

  const find = (lessonId, deliverableId) => {
    const l = lessons.find((x) => x.id === lessonId);
    const d = l?.deliverables.find((x) => x.id === deliverableId);
    return d ? { l, d } : null;
  };
  // Put the deliverable into the text where the cursor is. AIDA reads the student's answer there.
  const insertInline = (lessonId, deliverableId) => {
    const hit = find(lessonId, deliverableId);
    if (!hit) return;
    const token = `{{deliverable:${deliverableId}|Lesson ${hit.l.number}: ${hit.d.title.replace(/[{}|]/g, "")}}}`;
    const el = box.current;
    const at = el ? el.selectionStart : lesson.aiInstructions.length;
    const end = el ? el.selectionEnd : at;
    onChange({ aiInstructions: lesson.aiInstructions.slice(0, at) + token + lesson.aiInstructions.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };
  const linked = (lessonId, deliverableId) => lesson.aidaLinks.some((x) => x.lessonId === lessonId && x.deliverableId === deliverableId);

  return (
    <div ref={ref} id={`aida-lesson-${lesson.id}`} style={{ ...card, scrollMarginTop: 84, outline: highlight ? `2px solid ${COLORS.indigoBorder}` : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{lesson.number}</div>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: COLORS.text }}>{lesson.title}</div>
        {!lesson.studentVisible && <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.sub, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 9px" }}>Draft</span>}
      </div>

      <FieldLabel>AI instructions for this lesson</FieldLabel>
      <textarea
        ref={box}
        value={lesson.aiInstructions}
        onChange={(e) => onChange({ aiInstructions: e.target.value })}
        placeholder="What AIDA should know and do for this lesson: what it is about, what good work looks like, and how to coach the student on it."
        rows={Math.min(18, Math.max(5, lesson.aiInstructions.split("\n").length + 1))}
        style={{ ...fieldStyle, ...mono, resize: "vertical" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <DeliverablePicker lessons={lessons} label="Insert a deliverable inline…" onPick={insertInline} />
        <span style={hint}>Places the student's answer at the cursor, shown as {"{{deliverable:…}}"} in the text.</span>
      </div>

      <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <FieldLabel>Deliverables AIDA reads for this lesson</FieldLabel>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {lesson.deliverables.map((d) => (
            <span key={d.id} title="This lesson's own deliverables are always included" style={{ fontSize: 13, fontWeight: 700, color: COLORS.sub, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "6px 10px" }}>{d.title}</span>
          ))}
          {lesson.aidaLinks.map((x) => {
            const hit = find(x.lessonId, x.deliverableId);
            return (
              <span key={`${x.lessonId}:${x.deliverableId}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: COLORS.indigo, background: COLORS.indigoSoft, border: `1px solid ${COLORS.indigoBorder}`, borderRadius: 9, padding: "6px 6px 6px 10px" }}>
                <Link2 size={13} /> {hit ? `L${hit.l.number} · ${hit.d.title}` : "Deleted deliverable"}
                <button type="button" aria-label="Remove link" onClick={() => onChange({ aidaLinks: lesson.aidaLinks.filter((y) => y !== x) })} style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.indigo, display: "flex", padding: 2 }}>
                  <X size={14} />
                </button>
              </span>
            );
          })}
          {lesson.deliverables.length === 0 && lesson.aidaLinks.length === 0 && <span style={hint}>None yet.</span>}
        </div>
        <DeliverablePicker
          lessons={lessons.filter((l) => l.id !== lesson.id)}
          label="Link a deliverable from another lesson…"
          skip={linked}
          onPick={(lessonId, deliverableId) => onChange({ aidaLinks: [...lesson.aidaLinks, { lessonId, deliverableId }] })}
        />
        <div style={{ ...hint, marginTop: 8 }}>Grey: this lesson's own deliverables, always included. Blue: linked from another lesson, so AIDA also sees the student's answer to it here.</div>
      </div>
    </div>
  );
}

function ContextTab({ data, setData, saver, focusLesson }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const { settings, lessons } = data;

  const patchSettings = (fields) => {
    const next = { ...settings, ...fields };
    setData((d) => ({ ...d, settings: next }));
    saver.schedule(`settings:${Object.keys(fields).join(",")}`, () => api.put(ADMIN, { settings: fields }));
  };
  const pending = useRef({});
  const patchLesson = (id, fields) => {
    setData((d) => ({ ...d, lessons: d.lessons.map((l) => (l.id === id ? { ...l, ...fields } : l)) }));
    pending.current[id] = { ...(pending.current[id] || {}), ...fields };
    saver.schedule(`lesson:${id}`, () => {
      const body = pending.current[id] || {};
      delete pending.current[id];
      return api.put(ADMIN, { lesson: { id, ...body } });
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={card}>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>General context</div>
        <div style={{ ...hint, marginBottom: 12 }}>Given to AIDA on every lesson, for every student. Use it for things that are true all year: how EIB works, what you expect from students, house rules.</div>
        <textarea value={settings.general} onChange={(e) => patchSettings({ general: e.target.value })} placeholder="For example: Students work alone or in pairs. The showcase is on April 23. Ventures must be something a student could really start this year." rows={Math.min(16, Math.max(5, settings.general.split("\n").length + 1))} style={{ ...fieldStyle, ...mono, resize: "vertical" }} />

        <button type="button" onClick={() => setShowPrompt((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, border: "none", background: "transparent", color: COLORS.indigo, fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          {showPrompt ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Core behaviour (how AIDA coaches)
        </button>
        {showPrompt && (
          <div style={{ marginTop: 12 }}>
            <div style={{ ...hint, marginBottom: 10 }}>The rules AIDA follows with every student: coach, do not write their work, stay on the lesson, stay appropriate for high school. Edit with care.</div>
            <textarea value={settings.prompt || data.defaultPrompt} onChange={(e) => patchSettings({ prompt: e.target.value })} rows={22} style={{ ...fieldStyle, ...mono, resize: "vertical" }} />
            {settings.prompt && settings.prompt !== data.defaultPrompt && (
              <button type="button" onClick={() => patchSettings({ prompt: "" })} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, border: `1px solid ${COLORS.border}`, background: "#fff", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, color: COLORS.sub, cursor: "pointer", fontFamily: "inherit" }}>
                <RotateCcw size={13} /> Reset to the original
              </button>
            )}
          </div>
        )}
      </div>

      {lessons.length === 0 && <div style={{ ...card, color: COLORS.faint }}>No lessons yet. Create them in the <Link href="/editor" style={{ color: COLORS.indigo, fontWeight: 700 }}>Lesson Editor</Link>.</div>}
      {lessons.map((l) => (
        <LessonContext key={l.id} lesson={l} lessons={lessons} onChange={(fields) => patchLesson(l.id, fields)} highlight={focusLesson === l.id} />
      ))}
    </div>
  );
}

function TestTab({ data, saver, startLesson }) {
  const { lessons, students } = data;
  const [lessonId, setLessonId] = useState(lessons.some((l) => l.id === startLesson) ? startLesson : lessons[0]?.id || "");
  const [studentId, setStudentId] = useState("");
  const [messages, setMessages] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  // A different lesson or student is a different conversation.
  useEffect(() => {
    setMessages([]);
    setPreview(null);
  }, [lessonId, studentId]);

  // Edits made on the Context tab a moment ago must be saved before AIDA is asked.
  const status = useRef(saver.status);
  status.current = saver.status;
  const settle = async () => {
    for (let i = 0; i < 40 && status.current === "saving"; i++) await new Promise((r) => setTimeout(r, 100));
  };
  const post = async (text, history) => {
    await settle();
    return fetch(ADMIN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId, studentId, messages: [...history, { role: "user", content: text }] }) });
  };
  const togglePreview = async () => {
    if (preview) return setPreview(null);
    try {
      await settle();
      setPreview(await api.get(`${ADMIN}?preview=1&lesson=${encodeURIComponent(lessonId)}&student=${encodeURIComponent(studentId)}`));
    } catch (e) {
      setError(e.message);
    }
  };

  if (!lessons.length) return <div style={{ ...card, color: COLORS.faint }}>Create a lesson first, then test AIDA on it.</div>;
  const who = students.find((s) => s.id === studentId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...card, display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>
          Lesson
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)} style={selectStyle}>
            {lessons.map((l) => <option key={l.id} value={l.id}>Lesson {l.number}: {l.title}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>
          See the deliverables of
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={selectStyle}>
            <option value="">Nobody (blank deliverables)</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isTest ? " (test account)" : ""}</option>)}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button type="button" onClick={togglePreview} style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${COLORS.border}`, background: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700, color: COLORS.text, cursor: "pointer", fontFamily: "inherit" }}>
            {preview ? <EyeOff size={15} /> : <Eye size={15} />} {preview ? "Hide what AIDA sees" : "Show what AIDA sees"}
          </button>
          <button type="button" onClick={() => setMessages([])} disabled={!messages.length} style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${COLORS.border}`, background: "#fff", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700, color: COLORS.text, cursor: messages.length ? "pointer" : "default", opacity: messages.length ? 1 : 0.5, fontFamily: "inherit" }}>
            <RotateCcw size={15} /> New chat
          </button>
        </div>
      </div>

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {!data.live && <Notice tone="amber">No AI key is set on this server, so replies here are a sandbox stand-in, not the real AIDA.</Notice>}

      {preview && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>What AIDA is given</div>
          <div style={{ ...hint, marginBottom: 12 }}>Exactly this, then the conversation. The first part is the same for every student; the second is this lesson with {who ? `${who.name}'s` : "blank"} deliverables. No student name or email is included.</div>
          <FieldLabel>1. Same for everyone</FieldLabel>
          <pre style={{ ...mono, fontSize: 12.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, maxHeight: 260, overflowY: "auto", margin: "0 0 14px" }}>{preview.shared}</pre>
          <FieldLabel>2. This lesson and this student's work</FieldLabel>
          <pre style={{ ...mono, fontSize: 12.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, maxHeight: 420, overflowY: "auto", margin: 0 }}>{preview.context}</pre>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "min(640px, 72vh)" }}>
        <AidaChat messages={messages} setMessages={setMessages} post={post} emptyHint={`Talk to AIDA as a student on this lesson would. It is reading ${who ? `${who.name}'s` : "blank"} deliverables. Nothing here is saved.`} />
      </div>
    </div>
  );
}

export default function Aida({ startTab = "context", startLesson = "" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(startTab === "test" ? "test" : "context");
  const saver = useDebouncedSaver();

  useEffect(() => {
    api.get(ADMIN).then(setData).catch((e) => setError(e.message));
  }, []);

  const setMode = (mode) => {
    setData((d) => ({ ...d, settings: { ...d.settings, mode } }));
    saver.immediate(() => api.put(ADMIN, { settings: { mode } }));
  };
  const setLimit = (dailyLimit) => {
    setData((d) => ({ ...d, settings: { ...d.settings, dailyLimit } }));
    if (Number(dailyLimit) > 0) saver.schedule("limit", () => api.put(ADMIN, { settings: { dailyLimit: Number(dailyLimit) } }));
  };

  const money = (n) => `$${(n || 0).toFixed(2)}`;
  const mode = data ? MODES.find((m) => m.id === data.settings.mode) : null;

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "36px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Sparkles size={26} color={COLORS.indigo} />
            <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.text }}>AIDA</span>
          </div>
          <SaveIndicator status={saver.status} />
        </div>
        <div style={{ fontSize: 14.5, color: COLORS.sub, marginBottom: 22 }}>Artificial Intelligence Deliverable Assistant: the AI cofounder students open from a lesson. It reads their deliverables and coaches them; it never writes or changes their work.</div>

        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}

        {!data ? (
          !error && <Loading />
        ) : (
          <>
            <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ flex: "1 1 320px" }}>
                <FieldLabel>Who can use AIDA</FieldLabel>
                <div style={{ display: "inline-flex", gap: 6, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 11, padding: 4, flexWrap: "wrap" }}>
                  {MODES.map((m) => (
                    <button key={m.id} type="button" aria-pressed={data.settings.mode === m.id} onClick={() => setMode(m.id)} style={{ border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", background: data.settings.mode === m.id ? (m.id === "off" ? COLORS.sub : COLORS.green) : "transparent", color: data.settings.mode === m.id ? "#fff" : COLORS.sub }}>
                      {m.label}
                    </button>
                  ))}
                </div>
                <div style={{ ...hint, marginTop: 8 }}>{mode?.note}</div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>
                Messages per student per day
                <input type="number" min={1} max={1000} value={data.settings.dailyLimit} onChange={(e) => setLimit(e.target.value)} style={{ ...fieldStyle, width: 110, padding: "9px 12px", fontSize: 14 }} />
              </label>
              <div style={{ fontSize: 13.5, color: COLORS.sub, lineHeight: 1.7 }}>
                <div><b style={{ color: COLORS.text }}>Today:</b> {data.usage.today.messages} messages, {money(data.usage.today.cost)} USD</div>
                <div><b style={{ color: COLORS.text }}>So far:</b> {data.usage.total.messages} messages, {money(data.usage.total.cost)} USD</div>
                <div style={hint}>{data.live ? `Model: ${data.model}` : "No AI key set: sandbox replies"}</div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}><Tabs value={tab} onChange={setTab} /></div>
            <div style={{ display: tab === "context" ? "block" : "none" }}>
              <ContextTab data={data} setData={setData} saver={saver} focusLesson={startLesson} />
            </div>
            {tab === "test" && <TestTab data={data} saver={saver} startLesson={startLesson} />}
          </>
        )}
      </div>
    </div>
  );
}
