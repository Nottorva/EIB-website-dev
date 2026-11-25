"use client";

import { useEffect, useState, useRef } from "react";
import { Presentation, UserCheck, MapPin, Clock, ChevronDown, ChevronUp, MessageCircle, FileText, User, ExternalLink, Pencil, CalendarDays, EyeOff, Download, Sparkles, Check, AlertCircle, CalendarClock } from "lucide-react";
import { COLORS, FONTS, Pill, ModalShell, HeaderButton, Notice, SaveIndicator, Loading, TypeChip, fieldStyle } from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";
import { MENTOR_DEFAULTS, mentorWhere, mentorWhen } from "@/lib/sessionDefaults";
import { DeliverableInput, DeliverablePreview, ExampleBlock } from "./DeliverableInputs";
import PdfReader from "./PdfReader";
import OfficeReader, { officeKind } from "./OfficeReader";
import AidaPanel from "./AidaPanel";
import { isComplete, dueDay, dueState, formatDue } from "@/lib/deliverables";

// A small coloured tag: red for past due, amber for due today, green for done.
function DueTag({ tone, icon: Icon, children, wrap }) {
  const look = {
    past: { color: COLORS.errorText, bg: COLORS.errorBg, border: COLORS.errorBorder },
    today: { color: COLORS.warnText, bg: COLORS.warnBg, border: COLORS.warnBorder },
    done: { color: COLORS.successText, bg: COLORS.successBg, border: COLORS.successBorder },
    plain: { color: COLORS.text2, bg: COLORS.bg, border: COLORS.border },
  }[tone || "plain"];
  return (
    <span data-due={tone || "plain"} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: look.color, background: look.bg, border: `1px solid ${look.border}`, padding: "3px 10px", whiteSpace: wrap ? "normal" : "nowrap" }}>
      {Icon && <Icon size={13} strokeWidth={2} style={{ flexShrink: 0 }} />}
      {children}
    </span>
  );
}

/* ---------- Modals ---------- */
// Shown only when a resource button is clicked and no link has been set yet.
function MissingLinkModal({ eyebrow, lesson, what, onClose }) {
  return (
    <ModalShell eyebrow={`${eyebrow} · ${what}`} title={lesson.title} onClose={onClose} maxWidth={520}>
      <div style={{ fontSize: 15, color: COLORS.text2, lineHeight: 1.6 }}>No {what.toLowerCase()} link has been added for this lesson yet. It is set in the Lesson Editor.</div>
    </ModalShell>
  );
}

// How to show a slides / teaching plan link inside the page.
//   uploaded PDF           -> drawn page by page (pdf.js), download = the file
//   uploaded .pptx / .docx  -> drawn in the browser (OfficeReader), download = the file
//   other uploaded files   -> browsers cannot draw these: download only
//   Google Slides/Docs/Drive link -> Google's own embeddable preview, download as PDF
//   any other link         -> framed as is, with "open in a new tab" as the way out
function resourceView(link, file) {
  if (link.startsWith("/api/lessons/")) {
    const pdf = !file || file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    const office = pdf ? null : officeKind(file);
    return { kind: pdf ? "pdf" : office ? "office" : "file", office, src: link, download: `${link}?download=1`, name: file?.name || "" };
  }
  const g = link.match(/^https:\/\/docs\.google\.com\/(presentation|document|spreadsheets)\/d\/([\w-]+)/);
  if (g && g[2] !== "e") return { kind: "frame", src: `https://docs.google.com/${g[1]}/d/${g[2]}/preview`, download: `https://docs.google.com/${g[1]}/d/${g[2]}/export?format=pdf`, open: link };
  const d = link.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (d) return { kind: "frame", src: `https://drive.google.com/file/d/${d[1]}/preview`, download: `https://drive.google.com/uc?export=download&id=${d[1]}`, open: link };
  return { kind: "frame", src: link, download: null, open: link };
}

// Slides or the teaching plan, previewed in a popup with a download button.
function ResourceModal({ eyebrow, lesson, what, link, file, onClose }) {
  const v = resourceView(link, file);
  const [failed, setFailed] = useState(false);
  const frame = { width: "100%", height: "72vh", border: `1px solid ${COLORS.border}`, background: COLORS.bg, display: "block" };
  return (
    <ModalShell
      eyebrow={`${eyebrow} · ${what}`}
      title={lesson.title}
      onClose={onClose}
      maxWidth={980}
      headerRight={
        <>
          {v.open && <HeaderButton icon={ExternalLink} label="Open in new tab" href={v.open} tone="soft" />}
          {v.download && <HeaderButton icon={Download} label="Download" href={v.download} />}
        </>
      }
    >
      {v.kind === "pdf" && !failed && <PdfReader src={v.src} onError={() => setFailed(true)} loadingText={`Loading the ${what.toLowerCase()}…`} />}
      {v.kind === "office" && !failed && <OfficeReader src={v.src} kind={v.office} onError={() => setFailed(true)} loadingText={`Loading the ${what.toLowerCase()}…`} />}
      {["pdf", "office"].includes(v.kind) && failed && <div style={{ fontSize: 15, color: COLORS.text2, lineHeight: 1.6 }}>The preview could not load. Use the Download button to open the file instead.</div>}
      {v.kind === "file" && (
        <div style={{ fontSize: 15, color: COLORS.text2, lineHeight: 1.6 }}>
          <strong style={{ color: COLORS.ink }}>{v.name || "This file"}</strong> is in a format that cannot be previewed here. Use the Download button to open it. (PDF, PowerPoint .pptx and Word .docx files show a preview.)
        </div>
      )}
      {v.kind === "frame" && (
        <>
          <iframe src={v.src} title={`${what}: ${lesson.title}`} style={frame} allow="fullscreen" allowFullScreen />
          <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 8 }}>If the preview stays blank, the site it comes from does not allow previews. Use "Open in new tab".</div>
        </>
      )}
    </ModalShell>
  );
}

/* Receives ONLY the public mentor shape from /api/lessons/view. A session
   can have up to two mentors; each gets its own block. */
const mentorNames = (lesson) => (lesson.mentors || []).map((m) => m.name).filter(Boolean);

function MentorInfoModal({ eyebrow, mentors, onClose }) {
  const list = (mentors || []).filter((m) => m && m.name);
  const title = list.length === 0 ? "No Mentor Assigned" : list.length === 1 ? list[0].name : "Mentors";
  return (
    <ModalShell eyebrow={`${eyebrow} · ${list.length > 1 ? "Mentors" : "Mentor"}`} title={title} onClose={onClose} maxWidth={560}>
      {list.length === 0 ? (
        <div style={{ fontSize: 15, color: COLORS.text2 }}>This lesson doesn't have a mentor assigned yet.</div>
      ) : (
        list.map((mentor, i) => (
          <div key={mentor.id || i} style={i ? { borderTop: `1px solid ${COLORS.border}`, marginTop: 24, paddingTop: 24 } : undefined}>
            {list.length > 1 && <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{mentor.name}</div>}
            {mentor.role && <div style={{ fontSize: 15.5, color: COLORS.text2, fontWeight: 600, marginBottom: 22 }}>{mentor.role}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.warnBg, border: `1px solid ${COLORS.warnBorder}`, padding: "14px 16px", marginBottom: 22 }}>
              <MessageCircle size={17} color={COLORS.warnText} strokeWidth={2} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.warnText, letterSpacing: 0.4 }}>Preferred contact</div>
                <div style={{ fontSize: 15, color: COLORS.ink, fontWeight: 600 }}>{mentor.contactMethod || "Not specified"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: COLORS.ink, letterSpacing: 0.5, marginBottom: 10 }}>
              <User size={16} color={COLORS.ink} strokeWidth={2} />
              Bio
            </div>
            <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: "16px 18px", fontSize: 15, color: COLORS.ink, lineHeight: 1.6 }}>
              {mentor.bio || "No bio added yet."}
            </div>
          </div>
        ))
      )}
    </ModalShell>
  );
}

/* ---------- Deliverable accordion ---------- */
function DeliverableAccordion({ item, mode, submission, onChangePayload, due, dueStatus }) {
  const [open, setOpen] = useState(false);
  const grade = submission?.grade;
  const hasGrade = grade !== null && grade !== undefined && grade !== "";
  // Done means every field is filled in (the same rule the credential and the reminder emails use).
  const done = isComplete(item, submission?.payload);


  return (
    <div style={{ border: `1px solid ${open ? COLORS.ink : COLORS.border2}`, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "18px 22px", background: open ? COLORS.bg : COLORS.surface, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <TypeChip type={item.type} points={item.points} />
          <div style={{ fontSize: 17, fontWeight: 600, color: COLORS.ink }}>{item.title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0, marginLeft: "auto" }}>
          {mode === "student" && done && <DueTag tone="done" icon={Check}>{hasGrade ? "Done" : "Done · awaiting grade"}</DueTag>}
          {mode === "student" && !done && dueStatus === "past" && <DueTag tone="past" icon={AlertCircle}>Past due</DueTag>}
          {mode === "student" && !done && dueStatus === "today" && <DueTag tone="today" icon={AlertCircle}>Due today</DueTag>}
          {mode === "student" && !done && dueStatus === "upcoming" && <DueTag>Due {formatDue(due, { short: true })}</DueTag>}
          {mode === "student" && (
            <span style={{ fontSize: 14.5, fontWeight: 600, color: hasGrade ? COLORS.successText : COLORS.muted, background: hasGrade ? COLORS.successBg : COLORS.bg, border: `1px solid ${hasGrade ? COLORS.successBorder : COLORS.border}`, padding: "4px 14px", minWidth: 30, textAlign: "center", whiteSpace: "nowrap" }}>
              {hasGrade ? `${grade}${item.points != null ? ` / ${item.points}` : ""}` : "—"}
            </span>
          )}
          {open ? <ChevronUp size={18} color={COLORS.text2} /> : <ChevronDown size={18} color={COLORS.text2} />}
        </div>
      </button>

      {open && (
        <div style={{ padding: "0 22px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16, fontSize: 14.5, color: COLORS.text2, lineHeight: 1.55 }}>{item.instructions}</div>

          {mode === "leader" ? (
            <>
              <ExampleBlock item={item} />
              <DeliverablePreview item={item} />
            </>
          ) : (
            <>
              <DeliverableInput item={item} payload={submission?.payload} onChange={onChangePayload} />
              <div>
                <span className="eib-label" style={{ fontWeight: 600 }}>Feedback</span>
                <div style={{ marginTop: 8, background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: "14px 16px", fontSize: 14.5, color: submission?.feedback ? COLORS.ink : COLORS.muted, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
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
function Logistics({ lesson, editable, onChange, showMentor }) {
  const [editing, setEditing] = useState(false);

  if (!editable || !editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 22, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text2, fontSize: 15, fontWeight: 600 }}>
          <MapPin size={17} color={COLORS.ink} strokeWidth={2} />
          {lesson.room || "Room TBD"}
        </div>
        {lesson.date && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text2, fontSize: 15, fontWeight: 600 }}>
            <CalendarDays size={17} color={COLORS.ink} strokeWidth={2} />
            {lesson.date}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text2, fontSize: 15, fontWeight: 600 }}>
          <Clock size={17} color={COLORS.ink} strokeWidth={2} />
          {lesson.startTime || "TBD"}
          {lesson.endTime ? ` – ${lesson.endTime}` : ""}
        </div>
        {showMentor && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text2, fontSize: 13.5, fontWeight: 600, background: COLORS.warnBg, border: `1px solid ${COLORS.warnBorder}`, padding: "4px 12px" }}>
            <UserCheck size={14} color={COLORS.warnText} strokeWidth={2} />
            Mentor arrival · {mentorWhere(lesson)} · {mentorWhen(lesson)}
          </div>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.ink, fontWeight: 600, fontSize: 13, padding: "6px 12px", cursor: "pointer" }}
          >
            <Pencil size={13} /> Edit location & time
          </button>
        )}
      </div>
    );
  }

  const small = { ...fieldStyle, padding: "9px 12px", fontSize: 14 };
  const label = { fontSize: 11.5, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 };
  return (
    <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <div>
          <div style={label}>Room / location</div>
          <input value={lesson.room} onChange={(e) => onChange({ room: e.target.value })} placeholder="Room 214" style={small} />
        </div>
        <div>
          <div style={label}>Date</div>
          <input value={lesson.date || ""} onChange={(e) => onChange({ date: e.target.value })} placeholder="Nov 17, 2026" style={small} />
        </div>
        <div>
          <div style={label}>Start</div>
          <input value={lesson.startTime} onChange={(e) => onChange({ startTime: e.target.value })} placeholder="3:30 PM" style={small} />
        </div>
        <div>
          <div style={label}>End</div>
          <input value={lesson.endTime} onChange={(e) => onChange({ endTime: e.target.value })} placeholder="4:15 PM" style={small} />
        </div>
        <button type="button" onClick={() => setEditing(false)} style={{ border: "none", background: COLORS.action, color: COLORS.white, fontWeight: 600, fontSize: 13.5, padding: "10px 16px", cursor: "pointer" }}>
          Done
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 8 }}>Saves as you type. This is what students see; the date is shared with the mentor side.</div>
      {showMentor && (
        <div style={{ marginTop: 16, background: COLORS.warnBg, border: `1px solid ${COLORS.warnBorder}`, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: COLORS.warnText, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
            <UserCheck size={13} strokeWidth={2} /> Mentor arrival
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, alignItems: "end" }}>
            <div>
              <div style={label}>Mentor location</div>
              <input value={lesson.mentorLocation || ""} onChange={(e) => onChange({ mentorLocation: e.target.value })} placeholder={MENTOR_DEFAULTS.mentorLocation} style={small} />
            </div>
            <div>
              <div style={label}>Mentor start</div>
              <input value={lesson.mentorStartTime || ""} onChange={(e) => onChange({ mentorStartTime: e.target.value })} placeholder={MENTOR_DEFAULTS.mentorStartTime} style={small} />
            </div>
            <div>
              <div style={label}>Mentor end</div>
              <input value={lesson.mentorEndTime || ""} onChange={(e) => onChange({ mentorEndTime: e.target.value })} placeholder={MENTOR_DEFAULTS.mentorEndTime} style={small} />
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.text2, marginTop: 8 }}>What the Mentor CRM shows for this session. Blank means {MENTOR_DEFAULTS.mentorLocation}, {MENTOR_DEFAULTS.mentorStartTime} to {MENTOR_DEFAULTS.mentorEndTime}.</div>
        </div>
      )}
    </div>
  );
}

/* ---------- Lesson card ---------- */
function LessonCard({ lesson, mode, submissions, onChangePayload, onChangeLogistics, superAdmin }) {
  const [activeModal, setActiveModal] = useState(null);
  const eyebrow = lesson.chapterLabel || "Chapter";
  // Deliverables are due the Thursday after the lesson. A student is told when theirs are late.
  const due = dueDay(lesson);
  const dueStatus = dueState(due);
  const unfinished = mode === "student" ? lesson.deliverables.filter((d) => !isComplete(d, submissions[`${lesson.id}:${d.id}`]?.payload)).length : 0;
  const late = unfinished > 0 && dueStatus === "past";
  const dueNow = unfinished > 0 && dueStatus === "today";

  return (
    <div id={`lesson-${lesson.id}`} style={{ background: COLORS.surface, padding: "34px 36px 36px", border: `1px solid ${COLORS.border}`, scrollMarginTop: 84 }}>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ width: 54, height: 54, background: COLORS.ink, color: COLORS.white, fontWeight: 600, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {lesson.number}
        </div>
        <div style={{ flex: 1 }}>
          <div className="eib-label" style={{ fontWeight: 600, marginBottom: 4 }}>{lesson.chapterLabel}</div>
          <div style={{ fontFamily: FONTS.serif, fontSize: 32, fontWeight: 600, color: COLORS.ink }}>{lesson.title}</div>
        </div>
        {superAdmin && !lesson.studentVisible && (
          <div title="Students and student leaders cannot see this lesson yet. Publish it from the Lesson Editor." style={{ display: "flex", alignItems: "center", gap: 6, alignSelf: "flex-start", fontSize: 12.5, fontWeight: 600, color: COLORS.text2, background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: "5px 11px", whiteSpace: "nowrap" }}>
            <EyeOff size={13} /> Draft · hidden from students
          </div>
        )}
      </div>

      <Logistics lesson={lesson} editable={mode === "leader"} onChange={(fields) => onChangeLogistics(lesson.id, fields)}  showMentor={superAdmin && Boolean(lesson.mentorEnabled)} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24, paddingBottom: 24, borderBottom: `1px solid ${COLORS.border}` }}>
        <Pill icon={Presentation} label="Slides" onClick={() => setActiveModal("slides")} />
        {mode === "leader" && <Pill icon={FileText} label="Teaching Plan" onClick={() => setActiveModal("plan")} />}
        {lesson.mentorEnabled && <Pill icon={UserCheck} label={mentorNames(lesson).length > 1 ? `Mentors: ${mentorNames(lesson).join(" & ")}` : `Mentor: ${mentorNames(lesson)[0] || "Unassigned"}`} tone="amber" onClick={() => setActiveModal("mentor")} />}
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px 16px", flexWrap: "wrap", marginBottom: 16 }}>
          <div className="eib-eyebrow">Deliverables</div>
          {lesson.deliverables.length > 0 && due && (
            <DueTag wrap tone={late ? "past" : dueNow ? "today" : mode === "student" && unfinished === 0 ? "done" : "plain"} icon={mode === "student" && unfinished === 0 ? Check : CalendarClock}>
              {late ? `Past due: was due ${formatDue(due)}` : dueNow ? `Due today, ${formatDue(due)}` : mode === "student" && unfinished === 0 ? `All done · due ${formatDue(due)}` : `Due ${formatDue(due)}`}
            </DueTag>
          )}
          {lesson.deliverables.length > 0 && !due && mode === "leader" && <span style={{ fontSize: 13, color: COLORS.muted }}>No due date yet: it is the Thursday after the lesson's date.</span>}
        </div>
        {(late || dueNow) && (
          <Notice tone={late ? "error" : "amber"} lead={late ? `${unfinished} of these ${unfinished === 1 ? "is" : "are"} past due.` : `${unfinished} of these ${unfinished === 1 ? "is" : "are"} due today.`}>
            Not completing deliverables before Thursday will result in a loss of feedback. Not completing deliverables before the end of the course will result in a loss of credential.
          </Notice>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lesson.deliverables.length === 0 && <div style={{ fontSize: 14, color: COLORS.muted, fontStyle: "italic" }}>No deliverables for this lesson.</div>}
          {lesson.deliverables.map((d) => (
            <DeliverableAccordion key={d.id} item={d} mode={mode} submission={submissions[`${lesson.id}:${d.id}`]} onChangePayload={(payload) => onChangePayload(lesson.id, d.id, payload)} due={due} dueStatus={dueStatus} />
          ))}
        </div>
      </div>

      {["slides", "plan"].includes(activeModal) && (() => {
        const [what, link, file] = activeModal === "slides" ? ["Slides", lesson.slidesLink, lesson.slidesFile] : ["Teaching Plan", lesson.teachingPlanLink, lesson.teachingPlanFile];
        const Modal = link ? ResourceModal : MissingLinkModal;
        return <Modal eyebrow={eyebrow} lesson={lesson} what={what} link={link} file={file} onClose={() => setActiveModal(null)} />;
      })()}
      {activeModal === "mentor" && <MentorInfoModal eyebrow={eyebrow} mentors={lesson.mentors} onClose={() => setActiveModal(null)} />}
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
      .catch((e) => {
        // the server says the agreement is not signed: go and sign it
        if (e.status === 403 && /Student Agreement/.test(e.message)) { window.location.href = "/onboarding"; return; }
        setError(e.message);
      });
  }, []);

  const changePayload = (lessonId, deliverableId, payload) => {
    const key = `${lessonId}:${deliverableId}`;
    setSubmissions((prev) => ({ ...prev, [key]: { ...(prev[key] || { lessonId, deliverableId, grade: null, feedback: "" }), payload } }));
    saver.schedule(key, async () => {
      const saved = await api.put("/api/submissions", { lessonId, deliverableId, payload });
      setSubmissions((prev) => ({ ...prev, [key]: { ...prev[key], grade: saved.grade, feedback: saved.feedback, submittedAt: saved.submittedAt } }));
    });
  };

  // Leaders: room / date / start / end only. The route rejects anything
  // else. Fields changed within the debounce window are sent together.
  const pendingLogistics = useRef({});
  const changeLogistics = (lessonId, fields) => {
    setData((prev) => ({ ...prev, lessons: prev.lessons.map((l) => (l.id === lessonId ? { ...l, ...fields } : l)) }));
    pendingLogistics.current[lessonId] = { ...(pendingLogistics.current[lessonId] || {}), ...fields };
    saver.schedule(`logistics:${lessonId}`, () => {
      const body = pendingLogistics.current[lessonId] || {};
      delete pendingLogistics.current[lessonId];
      return api.patch(`/api/lessons/${lessonId}`, body);
    });
  };

  // Waits for answers still being saved (AIDA reads the saved copy).
  const savingRef = useRef(saver.status);
  savingRef.current = saver.status;
  const saved = async () => {
    for (let i = 0; i < 40 && savingRef.current === "saving"; i++) await new Promise((r) => setTimeout(r, 100));
  };

  // AIDA, the AI cofounder: a full-screen chat for one lesson at a time (students, when it is switched
  // on), opened from the "Ask AIDA" button that floats in the bottom right corner of the page. It opens
  // on the lesson the student is looking at. Opening it adds a step to the browser's history, so the Back button (or the back swipe on a
  // phone) leaves the chat and lands on the lessons again instead of leaving the page.
  const [aidaLesson, setAidaLesson] = useState(null);
  const openAida = useRef((lesson) => {
    setAidaLesson(lesson);
    window.history.pushState({ ...(window.history.state || {}), eibAida: true }, "");
  }).current;
  const closeAida = useRef(() => {
    if (window.history.state?.eibAida) window.history.back();
    else setAidaLesson(null);
  }).current;
  // The lesson on screen: the last card whose top has passed just under the top bar (the same rule the
  // "Jump to" list uses for its highlight), or the first lesson at the top of the page.
  const lessonInView = () => {
    let best = null;
    for (const l of lessons) {
      const el = document.getElementById(`lesson-${l.id}`);
      if (el && el.getBoundingClientRect().top <= 140) best = l;
    }
    return best || lessons[0];
  };
  useEffect(() => {
    const onPop = () => setAidaLesson(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const mode = data?.mode || (user.role === "student" ? "student" : "leader");
  const lessons = data?.lessons || [];

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 24px 110px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
          <span style={{ fontFamily: FONTS.serif, fontSize: 36, fontWeight: 600, color: COLORS.ink }}>Lessons</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <SaveIndicator status={saver.status} />
          </div>
        </div>

        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}

        {!data ? (
          <Loading />
        ) : lessons.length === 0 ? (
          <div style={{ fontSize: 15, color: COLORS.muted }}>No lessons have been published yet.</div>
        ) : (
          <LessonLayout lessons={lessons} flags={mode === "student" ? Object.fromEntries(lessons.map((l) => {
            const state = dueState(dueDay(l));
            const open = l.deliverables.some((d) => !isComplete(d, submissions[`${l.id}:${d.id}`]?.payload));
            return [l.id, open && (state === "past" || state === "today") ? state : ""];
          })) : {}}>
            {lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} mode={mode} submissions={submissions} onChangePayload={changePayload} onChangeLogistics={changeLogistics} superAdmin={user.role === "superAdmin"} />
            ))}
          </LessonLayout>
        )}
      </div>
      {data?.aida && lessons.length > 0 && !aidaLesson && (
        <button
          type="button"
          data-aida-float
          onClick={() => openAida(lessonInView())}
          style={{ position: "fixed", right: "max(20px, env(safe-area-inset-right))", bottom: "max(20px, env(safe-area-inset-bottom))", zIndex: 55, display: "flex", alignItems: "center", gap: 10, minHeight: 56, padding: "0 24px", background: COLORS.action, color: COLORS.white, border: `2px solid ${COLORS.white}`, outline: `1px solid ${COLORS.action}`, fontSize: 16, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
        >
          <Sparkles size={20} strokeWidth={2} /> Ask AIDA
        </button>
      )}
      {aidaLesson && <AidaPanel lesson={aidaLesson} lessons={lessons} submissions={submissions} onChangePayload={changePayload} onClose={closeAida} beforeSend={saved} />}
    </div>
  );
}

/* Lesson cards with a jump list beside them: a sticky column on wide
   screens, a scrollable row of chips above the cards on narrow ones. The
   highlighted entry follows whichever card is nearest the top of the screen. */
function LessonLayout({ lessons, children, flags = {} }) {
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
          border: `1px solid ${active ? COLORS.ink : "transparent"}`,
          background: active ? COLORS.ink : "transparent",
          color: active ? COLORS.white : COLORS.text2,
          padding: narrow ? "8px 12px 8px 8px" : "9px 10px",
          cursor: "pointer",
          fontFamily: "inherit",
          flexShrink: 0,
        }}
      >
        <span style={{ width: 28, height: 28, background: COLORS.white, border: `1px solid ${active ? COLORS.white : COLORS.border2}`, color: COLORS.ink, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {l.number}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: narrow ? "nowrap" : "normal", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>{l.title}</span>
        {flags[l.id] && <span title={flags[l.id] === "past" ? "Past due" : "Due today"} aria-label={flags[l.id] === "past" ? "Past due" : "Due today"} style={{ width: 10, height: 10, flexShrink: 0, background: flags[l.id] === "past" ? COLORS.errorIcon : COLORS.warnIcon, border: `1px solid ${COLORS.white}` }} />}
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
        <div style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.12em", padding: "0 10px", marginBottom: 6 }}>Jump to</div>
        {lessons.map(item)}
      </nav>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>
    </div>
  );
}
