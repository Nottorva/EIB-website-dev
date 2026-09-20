"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Eye, Presentation, UserCheck, MapPin, Clock, ChevronDown, ChevronUp, MessageCircle, FileText, User, Lightbulb, ExternalLink, Pencil } from "lucide-react";
import { COLORS, Pill, ModalShell, HeaderButton, Notice, SaveIndicator, Loading, TypeChip, fieldStyle } from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";
import { DeliverableInput, DeliverablePreview, ExampleBlock } from "./DeliverableInputs";

/* ---------- Modals ---------- */
// Shown only when a resource button is clicked and no link has been set yet.
function MissingLinkModal({ eyebrow, lesson, what, onClose }) {
  return (
    <ModalShell eyebrow={`${eyebrow} · ${what}`} title={lesson.title} onClose={onClose} maxWidth={520}>
      <div style={{ fontSize: 15, color: COLORS.sub, lineHeight: 1.6 }}>No {what.toLowerCase()} link has been added for this lesson yet. It is set in the Lesson Editor.</div>
    </ModalShell>
  );
}

function StudentOverviewModal({ eyebrow, lesson, onClose }) {
  return (
    <ModalShell
      eyebrow={`${eyebrow} · Student Overview`}
      title={lesson.title}
      onClose={onClose}
      maxWidth={620}
      headerRight={lesson.overviewLink ? <HeaderButton icon={ExternalLink} label="Open overview" href={lesson.overviewLink} /> : null}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.sub, fontSize: 15, fontWeight: 600, marginBottom: 22, flexWrap: "wrap" }}>
        <MapPin size={17} color={COLORS.indigo} strokeWidth={2.25} />
        {lesson.room || "Room TBD"}
        <span style={{ color: COLORS.faint, margin: "0 4px" }}>·</span>
        <Clock size={17} color={COLORS.indigo} strokeWidth={2.25} />
        {lesson.startTime || "TBD"}
        {lesson.endTime ? ` – ${lesson.endTime}` : ""}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: COLORS.indigoSoft, borderRadius: 14, padding: "18px 20px" }}>
        <Lightbulb size={20} color={COLORS.indigo} strokeWidth={2.25} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.6 }}>{lesson.overview || "No overview has been added for this lesson yet."}</div>
      </div>
    </ModalShell>
  );
}

/* Receives ONLY the public mentor shape from /api/lessons/view. */
function MentorInfoModal({ eyebrow, mentor, onClose }) {
  const assigned = Boolean(mentor && mentor.name);
  return (
    <ModalShell eyebrow={`${eyebrow} · Mentor`} title={assigned ? mentor.name : "No Mentor Assigned"} onClose={onClose} maxWidth={560}>
      {!assigned ? (
        <div style={{ fontSize: 15, color: COLORS.sub }}>This lesson doesn't have a mentor assigned yet.</div>
      ) : (
        <>
          {mentor.role && <div style={{ fontSize: 15.5, color: COLORS.sub, fontWeight: 600, marginBottom: 22 }}>{mentor.role}</div>}
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 12, padding: "14px 16px", marginBottom: 22 }}>
            <MessageCircle size={17} color={COLORS.amber} strokeWidth={2.25} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.amber, letterSpacing: 0.4 }}>Preferred contact</div>
              <div style={{ fontSize: 15, color: COLORS.text, fontWeight: 700 }}>{mentor.contactMethod || "Not specified"}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: COLORS.text, letterSpacing: 0.5, marginBottom: 10 }}>
            <User size={16} color={COLORS.indigo} strokeWidth={2.25} />
            Bio
          </div>
          <div style={{ background: "#f7f8fb", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 18px", fontSize: 15, color: COLORS.text, lineHeight: 1.6 }}>
            {mentor.bio || "No bio added yet."}
          </div>
        </>
      )}
    </ModalShell>
  );
}

/* ---------- Deliverable accordion ---------- */
function DeliverableAccordion({ item, mode, submission, onChangePayload }) {
  const [open, setOpen] = useState(false);
  const grade = submission?.grade;
  const hasGrade = grade !== null && grade !== undefined && grade !== "";
  const submitted = Boolean(submission?.payload);


  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 22px", background: "#fff", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TypeChip type={item.type} points={item.points} />
          <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text }}>{item.title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {mode === "student" && submitted && !hasGrade && <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.green }}>Submitted · awaiting grade</span>}
          {mode === "student" && (
            <span style={{ fontSize: 14.5, fontWeight: 800, color: hasGrade ? COLORS.indigo : COLORS.faint, background: hasGrade ? COLORS.indigoSoft : "#f1f3f7", borderRadius: 999, padding: "4px 14px", minWidth: 30, textAlign: "center", whiteSpace: "nowrap" }}>
              {hasGrade ? `${grade}${item.points != null ? ` / ${item.points}` : ""}` : "—"}
            </span>
          )}
          {open ? <ChevronUp size={18} color={COLORS.sub} /> : <ChevronDown size={18} color={COLORS.sub} />}
        </div>
      </button>

      {open && (
        <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, fontSize: 14.5, color: COLORS.sub, lineHeight: 1.55 }}>{item.instructions}</div>

          {mode === "leader" ? (
            <>
              <ExampleBlock item={item} />
              <DeliverablePreview item={item} />
            </>
          ) : (
            <>
              <DeliverableInput item={item} payload={submission?.payload} onChange={onChangePayload} />
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.faint, letterSpacing: 0.4 }}>Feedback</span>
                <div style={{ marginTop: 8, background: "#f7f8fb", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 16px", fontSize: 14.5, color: submission?.feedback ? COLORS.text : COLORS.faint, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {submission?.feedback || "No feedback yet."}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Room / time (read-only for students, editable for leaders) ---------- */
function Logistics({ lesson, editable, onChange }) {
  const [editing, setEditing] = useState(false);

  if (!editable || !editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 22, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.sub, fontSize: 15, fontWeight: 600 }}>
          <MapPin size={17} color={COLORS.indigo} strokeWidth={2.25} />
          {lesson.room || "Room TBD"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.sub, fontSize: 15, fontWeight: 600 }}>
          <Clock size={17} color={COLORS.indigo} strokeWidth={2.25} />
          {lesson.startTime || "TBD"}
          {lesson.endTime ? ` – ${lesson.endTime}` : ""}
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.indigo, fontWeight: 800, fontSize: 13, borderRadius: 999, padding: "6px 12px", cursor: "pointer" }}
          >
            <Pencil size={13} /> Edit location & time
          </button>
        )}
      </div>
    );
  }

  const small = { ...fieldStyle, padding: "9px 12px", fontSize: 14, borderRadius: 10 };
  const label = { fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };
  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <div>
          <div style={label}>Room / location</div>
          <input value={lesson.room} onChange={(e) => onChange({ room: e.target.value })} placeholder="Room 214" style={small} />
        </div>
        <div>
          <div style={label}>Start</div>
          <input value={lesson.startTime} onChange={(e) => onChange({ startTime: e.target.value })} placeholder="3:30 PM" style={small} />
        </div>
        <div>
          <div style={label}>End</div>
          <input value={lesson.endTime} onChange={(e) => onChange({ endTime: e.target.value })} placeholder="4:15 PM" style={small} />
        </div>
        <button type="button" onClick={() => setEditing(false)} style={{ border: "none", background: COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 13.5, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>
          Done
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 8 }}>Saves as you type. Students see the new room and time immediately.</div>
    </div>
  );
}

/* ---------- Lesson card ---------- */
function LessonCard({ lesson, mode, submissions, onChangePayload, onChangeLogistics }) {
  const [activeModal, setActiveModal] = useState(null);
  const eyebrow = lesson.chapterLabel || "Chapter";

  const openLink = (link, fallbackModal) => {
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    else setActiveModal(fallbackModal);
  };

  return (
    <div id={`lesson-${lesson.id}`} style={{ background: COLORS.card, borderRadius: 22, padding: "34px 36px 36px", boxShadow: "0 1px 3px rgba(15,23,42,0.05)", scrollMarginTop: 84 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ width: 54, height: 54, borderRadius: 14, background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 800, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {lesson.number}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.indigo, marginBottom: 4 }}>{lesson.chapterLabel}</div>
          <div style={{ fontSize: 27, fontWeight: 800, color: COLORS.text }}>{lesson.title}</div>
        </div>
      </div>

      <Logistics lesson={lesson} editable={mode === "leader"} onChange={(fields) => onChangeLogistics(lesson.id, fields)} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24, paddingBottom: 24, borderBottom: `1px solid ${COLORS.border}` }}>
        <Pill icon={Eye} label="Student Overview" onClick={() => setActiveModal("overview")} />
        <Pill icon={lesson.slidesLink ? ExternalLink : Presentation} label="Slides" onClick={() => openLink(lesson.slidesLink, "noSlides")} />
        {mode === "leader" && <Pill icon={lesson.teachingPlanLink ? ExternalLink : FileText} label="Teaching Plan" onClick={() => openLink(lesson.teachingPlanLink, "noPlan")} />}
        {lesson.mentorEnabled && <Pill icon={UserCheck} label={`Mentor: ${lesson.mentor?.name || "Unassigned"}`} tone="amber" onClick={() => setActiveModal("mentor")} />}
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.5, marginBottom: 16 }}>Deliverables</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lesson.deliverables.length === 0 && <div style={{ fontSize: 14, color: COLORS.faint, fontStyle: "italic" }}>No deliverables for this lesson.</div>}
          {lesson.deliverables.map((d) => (
            <DeliverableAccordion key={d.id} item={d} mode={mode} submission={submissions[`${lesson.id}:${d.id}`]} onChangePayload={(payload) => onChangePayload(lesson.id, d.id, payload)} />
          ))}
        </div>
      </div>

      {activeModal === "overview" && <StudentOverviewModal eyebrow={eyebrow} lesson={lesson} onClose={() => setActiveModal(null)} />}
      {activeModal === "noSlides" && <MissingLinkModal eyebrow={eyebrow} lesson={lesson} what="Slides" onClose={() => setActiveModal(null)} />}
      {activeModal === "noPlan" && <MissingLinkModal eyebrow={eyebrow} lesson={lesson} what="Teaching Plan" onClose={() => setActiveModal(null)} />}
      {activeModal === "mentor" && <MentorInfoModal eyebrow={eyebrow} mentor={lesson.mentor} onClose={() => setActiveModal(null)} />}
    </div>
  );
}

/* ---------- Main page ---------- */
export default function LessonView({ user }) {
  const [data, setData] = useState(null);
  const [submissions, setSubmissions] = useState({});
  const [error, setError] = useState(null);
  const saver = useDebouncedSaver();

  useEffect(() => {
    api
      .get("/api/lessons/view")
      .then((d) => {
        setData(d);
        const map = {};
        for (const s of d.submissions) map[`${s.lessonId}:${s.deliverableId}`] = s;
        setSubmissions(map);
      })
      .catch((e) => setError(e.message));
  }, []);

  const changePayload = (lessonId, deliverableId, payload) => {
    const key = `${lessonId}:${deliverableId}`;
    setSubmissions((prev) => ({ ...prev, [key]: { ...(prev[key] || { lessonId, deliverableId, grade: null, feedback: "" }), payload } }));
    saver.schedule(key, async () => {
      const saved = await api.put("/api/submissions", { lessonId, deliverableId, payload });
      setSubmissions((prev) => ({ ...prev, [key]: { ...prev[key], grade: saved.grade, feedback: saved.feedback, submittedAt: saved.submittedAt } }));
    });
  };

  // Leaders: room / start / end only. The route rejects anything else.
  const changeLogistics = (lessonId, fields) => {
    setData((prev) => ({ ...prev, lessons: prev.lessons.map((l) => (l.id === lessonId ? { ...l, ...fields } : l)) }));
    saver.schedule(`logistics:${lessonId}`, () => api.patch(`/api/lessons/${lessonId}`, fields));
  };

  const mode = data?.mode || (user.role === "student" ? "student" : "leader");
  const lessons = data?.lessons || [];

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: COLORS.text }}>Lessons</span>
          <SaveIndicator status={saver.status} />
        </div>

        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}

        {!data ? (
          <Loading />
        ) : lessons.length === 0 ? (
          <div style={{ fontSize: 15, color: COLORS.faint }}>No lessons have been published yet.</div>
        ) : (
          <LessonLayout lessons={lessons}>
            {lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} mode={mode} submissions={submissions} onChangePayload={changePayload} onChangeLogistics={changeLogistics} />
            ))}
          </LessonLayout>
        )}
      </div>
    </div>
  );
}

/* Lesson cards with a jump list beside them: a sticky column on wide
   screens, a scrollable row of chips above the cards on narrow ones. The
   highlighted entry follows whichever card is nearest the top of the screen. */
function LessonLayout({ lessons, children }) {
  const [narrow, setNarrow] = useState(false);
  const [activeId, setActiveId] = useState(lessons[0]?.id || null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const line = 140; // just under the top bar
        let best = null;
        for (const l of lessons) {
          const el = document.getElementById(`lesson-${l.id}`);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (top <= line) best = l.id; // the last card whose top has passed the line
        }
        setActiveId(best || lessons[0]?.id || null);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lessons]);

  const jump = (id) => {
    const el = document.getElementById(`lesson-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const item = (l) => {
    const active = l.id === activeId;
    return (
      <button
        key={l.id}
        type="button"
        onClick={() => jump(l.id)}
        title={l.title}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: narrow ? "auto" : "100%",
          textAlign: "left",
          border: `1px solid ${active ? COLORS.indigoBorder : "transparent"}`,
          background: active ? COLORS.indigoSoft : "transparent",
          color: active ? COLORS.indigo : COLORS.sub,
          borderRadius: 12,
          padding: narrow ? "8px 12px 8px 8px" : "9px 10px",
          cursor: "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 28, height: 28, borderRadius: 8, background: active ? COLORS.indigo : "#fff", border: `1px solid ${active ? COLORS.indigo : COLORS.border}`, color: active ? "#fff" : COLORS.text, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {l.number}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: narrow ? "nowrap" : "normal", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>{l.title}</span>
      </button>
    );
  };

  if (narrow) {
    return (
      <div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "4px 0 10px", marginBottom: 12, scrollbarWidth: "none" }}>{lessons.map(item)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "230px minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
      <nav aria-label="Jump to lesson" style={{ position: "sticky", top: 84, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.6, padding: "0 10px", marginBottom: 6 }}>Jump to</div>
        {lessons.map(item)}
      </nav>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>
    </div>
  );
}
