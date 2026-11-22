"use client";

// The AIDA page (super admin): everything AIDA is told, in one place. The general context, the core
// behaviour prompt, and one block of AI instructions per lesson. AIDA reads all of it, plus every
// deliverable the student has written. Talking to AIDA is on its own page, /aida/chat.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, RotateCcw, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { COLORS, Notice, SaveIndicator, Loading, FieldLabel, fieldStyle } from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";

const ADMIN = "/api/aida/admin";
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 13.5, lineHeight: 1.55 };
const card = { background: COLORS.card, borderRadius: 18, padding: "24px 26px", boxShadow: "0 1px 3px rgba(15,23,42,0.05)" };
const hint = { fontSize: 12.5, color: COLORS.faint, lineHeight: 1.5 };
const rowsFor = (text, min = 5) => Math.min(18, Math.max(min, String(text).split("\n").length + 1));
const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const MODES = [
  { id: "off", label: "Off", note: "No student sees AIDA." },
  { id: "test", label: "Test account only", note: "Only the Test student sees AIDA on the Lessons page." },
  { id: "on", label: "On for students", note: "Every student sees an Ask AIDA button on each lesson." },
];

export default function Aida() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
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
  // Opening hours save at once; a time that is still being typed (or an end before the start) waits.
  const setHours = (fields) => {
    const hours = { ...data.settings.hours, ...fields };
    setData((d) => ({ ...d, settings: { ...d.settings, hours } }));
    if (hours.start && hours.end && hours.start < hours.end) saver.schedule("hours", () => api.put(ADMIN, { settings: { hours } }));
  };
  const patchSettings = (fields) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...fields } }));
    saver.schedule(`settings:${Object.keys(fields).join(",")}`, () => api.put(ADMIN, { settings: fields }));
  };
  const latest = useRef({});
  const patchLesson = (id, aiInstructions) => {
    setData((d) => ({ ...d, lessons: d.lessons.map((l) => (l.id === id ? { ...l, aiInstructions } : l)) }));
    latest.current[id] = aiInstructions;
    saver.schedule(`lesson:${id}`, () => api.put(ADMIN, { lesson: { id, aiInstructions: latest.current[id] } }));
  };

  const money = (n) => `$${(n || 0).toFixed(2)}`;
  const mode = data ? MODES.find((m) => m.id === data.settings.mode) : null;

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "36px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Sparkles size={26} color={COLORS.indigo} />
            <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.text }}>AIDA</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <SaveIndicator status={saver.status} />
            <Link href="/aida/chat" style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.indigo, color: "#fff", borderRadius: 12, padding: "11px 18px", fontSize: 14.5, fontWeight: 800, textDecoration: "none" }}>
              <MessageCircle size={17} /> Chat with AIDA
            </Link>
          </div>
        </div>
        <div style={{ fontSize: 14.5, color: COLORS.sub, marginBottom: 22 }}>Artificial Intelligence Deliverable Assistant: the AI cofounder students open from a lesson. It reads everything on this page and all of the student's deliverables, asks them for what a deliverable needs, looks up outside facts on the web, and writes the deliverable from their answers. Nothing goes into their work until they press the button under its draft.</div>

        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}

        {!data ? (
          !error && <Loading />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ ...card, display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
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

            <div style={card}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 800, color: COLORS.text, cursor: "pointer" }}>
                <input type="checkbox" checked={data.settings.hours.enabled} onChange={(e) => setHours({ enabled: e.target.checked })} style={{ width: 18, height: 18, accentColor: COLORS.indigo }} />
                Only open at set hours
              </label>
              <div style={{ ...hint, margin: "4px 0 0 28px" }}>{data.settings.hours.enabled ? "Students can use AIDA only on these days, between these times (Toronto time). Outside them they can read their chat but not send." : "Off: students can use AIDA at any time, up to their daily limit."}</div>
              {data.settings.hours.enabled && (
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-end", margin: "14px 0 0 28px" }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.sub, marginBottom: 6 }}>Days</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {DAYS.map(([d, name]) => {
                        const on = data.settings.hours.days.includes(d);
                        return (
                          <button key={d} type="button" aria-pressed={on} onClick={() => setHours({ days: on ? data.settings.hours.days.filter((x) => x !== d) : [...data.settings.hours.days, d] })} style={{ border: `1px solid ${on ? COLORS.indigo : COLORS.border}`, background: on ? COLORS.indigo : "#fff", color: on ? "#fff" : COLORS.sub, borderRadius: 9, padding: "8px 12px", fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>
                    From
                    <input type="time" value={data.settings.hours.start} onChange={(e) => setHours({ start: e.target.value })} style={{ ...fieldStyle, width: 140, padding: "8px 12px", fontSize: 14 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>
                    To
                    <input type="time" value={data.settings.hours.end} onChange={(e) => setHours({ end: e.target.value })} style={{ ...fieldStyle, width: 140, padding: "8px 12px", fontSize: 14 }} />
                  </label>
                  {!(data.settings.hours.start < data.settings.hours.end) && <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.red }}>The end time must be after the start time.</span>}
                  {data.settings.hours.days.length === 0 && <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.red }}>No day is selected, so AIDA is closed all week.</span>}
                </div>
              )}
            </div>

            <div style={card}>
              <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>General context</div>
              <div style={{ ...hint, marginBottom: 12 }}>For things that are true all year: how EIB works, what you expect from students, house rules.</div>
              <textarea aria-label="General context" value={data.settings.general} onChange={(e) => patchSettings({ general: e.target.value })} placeholder="For example: Students work alone or in pairs. The showcase is on April 23. Ventures must be something a student could really start this year." rows={rowsFor(data.settings.general)} style={{ ...fieldStyle, ...mono, resize: "vertical" }} />

              <button type="button" onClick={() => setShowPrompt((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, border: "none", background: "transparent", color: COLORS.indigo, fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                {showPrompt ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Core behaviour (how AIDA works with students)
              </button>
              {showPrompt && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ ...hint, marginBottom: 10 }}>The rules AIDA follows with every student: ask for what a deliverable needs without leading, write it from the student's answers, stay on the lesson, stay appropriate for high school. Edit with care.</div>
                  <textarea aria-label="Core behaviour" value={data.settings.prompt || data.defaultPrompt} onChange={(e) => patchSettings({ prompt: e.target.value })} rows={22} style={{ ...fieldStyle, ...mono, resize: "vertical" }} />
                  {data.settings.prompt && data.settings.prompt !== data.defaultPrompt && (
                    <button type="button" onClick={() => patchSettings({ prompt: "" })} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, border: `1px solid ${COLORS.border}`, background: "#fff", borderRadius: 9, padding: "7px 12px", fontSize: 13, fontWeight: 700, color: COLORS.sub, cursor: "pointer", fontFamily: "inherit" }}>
                      <RotateCcw size={13} /> Reset to the original
                    </button>
                  )}
                </div>
              )}
            </div>

            {data.lessons.length === 0 && <div style={{ ...card, color: COLORS.faint }}>No lessons yet. Create them in the <Link href="/editor" style={{ color: COLORS.indigo, fontWeight: 700 }}>Lesson Editor</Link>.</div>}
            {data.lessons.map((l) => (
              <div key={l.id} id={`aida-lesson-${l.id}`} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{l.number}</div>
                  <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: COLORS.text }}>{l.title}</div>
                  {!l.studentVisible && <span title="AIDA only reads published lessons" style={{ fontSize: 12, fontWeight: 800, color: COLORS.sub, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 9px" }}>Draft · not read yet</span>}
                </div>
                <textarea aria-label={`AI instructions for lesson ${l.number}`} value={l.aiInstructions} onChange={(e) => patchLesson(l.id, e.target.value)} placeholder="What AIDA should know and do for this lesson: what it is about, what good work looks like, and how to coach the student on it." rows={rowsFor(l.aiInstructions)} style={{ ...fieldStyle, ...mono, resize: "vertical" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
