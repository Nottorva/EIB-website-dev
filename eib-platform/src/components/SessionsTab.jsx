"use client";

// Mentor CRM · Sessions tab. One row per lesson flagged "Yes Mentor" in the
// Lesson Editor. Opening a session shows its details (time, room, a brief
// for the mentor; the super admin edits these in place, everyone else reads)
// and the mentor assigned for the current cohort, with a chooser that either
// picks an existing mentor or creates a new one and assigns them.

import React, { useState } from "react";
import { ArrowLeft, Plus, Search, Clock, MapPin, ExternalLink, UserCheck, X, BookOpen } from "lucide-react";
import { COLORS, Avatar, EmptyState, EditableInput, EditableTextarea, SegmentedTabs } from "./ui";

export function ownerOfLesson(mentors, lessonNumber, cohortYear) {
  return mentors.find((m) => (m.assignedLessons || []).some((a) => a.lessonNumber === lessonNumber && a.cohortYear === cohortYear)) || null;
}

const whenText = (l) => (l.startTime ? `${l.startTime}${l.endTime ? ` to ${l.endTime}` : ""}` : "Time to be set");
const whereText = (l) => l.room || "Room to be set";
const kicker = (l) => [`Lesson ${l.number}`, l.chapterLabel].filter(Boolean).join(" · ");

export default function SessionsTab({ user, lessons, mentors, cohortYear, statuses, onPatchLesson, onAssign, onUnassign, onCreateMentor, onOpenMentor }) {
  const [openId, setOpenId] = useState(null);
  const sessions = lessons.filter((l) => l.mentorEnabled);
  const open = sessions.find((l) => l.id === openId);

  if (open) {
    return (
      <SessionDetail
        lesson={open}
        mentors={mentors}
        cohortYear={cohortYear}
        statuses={statuses}
        canEdit={user?.role === "superAdmin"}
        onBack={() => setOpenId(null)}
        onPatch={(fields) => onPatchLesson(open.id, fields)}
        onAssign={(mentorId) => onAssign(open.number, mentorId)}
        onUnassign={(mentorId) => onUnassign(open.number, mentorId)}
        onCreateMentor={onCreateMentor}
        onOpenMentor={onOpenMentor}
      />
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ fontSize: 12.5, color: COLORS.faint, margin: "0 0 12px" }}>
        Sessions a mentor leads this year. Flag a lesson "Yes Mentor" in the Lesson Editor to add one here.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.length === 0 && <EmptyState>No lessons are flagged "Yes Mentor" yet.</EmptyState>}
        {sessions.map((l) => {
          const owner = ownerOfLesson(mentors, l.number, cohortYear);
          return (
            <div
              key={l.id}
              onClick={() => setOpenId(l.id)}
              style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer" }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.amberSoft, color: COLORS.amber, fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {l.number}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{l.title || "Untitled lesson"}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 3, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {whenText(l)}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {whereText(l)}</span>
                </div>
              </div>
              {owner ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: COLORS.text, whiteSpace: "nowrap" }}>
                  <Avatar name={owner.name} size={28} /> {owner.name}
                </div>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.faint, border: `1px dashed ${COLORS.border}`, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>No mentor yet</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- One session ---------- */
function SessionDetail({ lesson, mentors, cohortYear, statuses, canEdit, onBack, onPatch, onAssign, onUnassign, onCreateMentor, onOpenMentor }) {
  const [choosing, setChoosing] = useState(false);
  const owner = ownerOfLesson(mentors, lesson.number, cohortYear);
  const status = owner ? statuses.find((s) => s.id === owner.status) || statuses[0] : null;

  const pick = async (mentorId) => {
    await onAssign(mentorId);
    setChoosing(false);
  };
  const create = async (name) => {
    const fresh = await onCreateMentor(name);
    if (fresh) await onAssign(fresh.id);
    setChoosing(false);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.sub, fontWeight: 700, fontSize: 13.5, cursor: "pointer", padding: "4px 0" }}>
          <ArrowLeft size={15} /> Back to sessions
        </button>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.amber, letterSpacing: 0.5, textTransform: "uppercase" }}>{kicker(lesson)}</div>
        <div style={{ fontSize: 21, fontWeight: 900, color: COLORS.text, marginTop: 4 }}>{lesson.title || "Untitled lesson"}</div>
      </div>

      <Section title="Session details" hint={canEdit ? "Only you can change these." : null}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <Field icon={Clock} label="When">
            {canEdit ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <EditableInput value={lesson.startTime} onChange={(v) => onPatch({ startTime: v })} placeholder="4:00 PM" style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, width: 92 }} />
                <span style={{ color: COLORS.faint, fontSize: 13 }}>to</span>
                <EditableInput value={lesson.endTime} onChange={(v) => onPatch({ endTime: v })} placeholder="5:30 PM" style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, width: 92 }} />
              </div>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 700, color: lesson.startTime ? COLORS.text : COLORS.faint }}>{whenText(lesson)}</div>
            )}
          </Field>
          <Field icon={MapPin} label="Where">
            {canEdit ? (
              <EditableInput value={lesson.room} onChange={(v) => onPatch({ room: v })} placeholder="Room 214" style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }} />
            ) : (
              <div style={{ fontSize: 14, fontWeight: 700, color: lesson.room ? COLORS.text : COLORS.faint }}>{whereText(lesson)}</div>
            )}
          </Field>
        </div>
        <div style={{ background: "#f7f8fb", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.faint, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Brief for the mentor</div>
          {canEdit ? (
            <EditableTextarea
              value={lesson.mentorBrief}
              onChange={(v) => onPatch({ mentorBrief: v })}
              placeholder="What this session covers, what the mentor should bring, how the hour runs..."
              rows={3}
              style={{ fontSize: 13.5, color: COLORS.text, lineHeight: 1.5, background: "transparent" }}
            />
          ) : (
            <div style={{ fontSize: 13.5, color: lesson.mentorBrief ? COLORS.text : COLORS.faint, lineHeight: 1.5, whiteSpace: "pre-wrap", fontStyle: lesson.mentorBrief ? "normal" : "italic" }}>
              {lesson.mentorBrief || "No brief written yet."}
            </div>
          )}
        </div>
      </Section>

      <Section title={`Mentor · Cohort ${cohortYear}`}>
        {owner ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 14, padding: "12px 14px", flexWrap: "wrap" }}>
            <Avatar name={owner.name} size={40} />
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{owner.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ color: status.color, background: status.soft, border: `1px solid ${status.border}`, borderRadius: 999, padding: "2px 9px" }}>{status.label}</span>
                {owner.years && <span style={{ color: COLORS.text }}>{owner.years}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <SmallButton onClick={() => onOpenMentor(owner.id)} icon={ExternalLink}>Open profile</SmallButton>
              <SmallButton onClick={() => setChoosing((c) => !c)}>Change mentor</SmallButton>
              <SmallButton onClick={() => onUnassign(owner.id)} tone="quiet" icon={X}>Unassign</SmallButton>
            </div>
          </div>
        ) : (
          !choosing && (
            <button
              type="button"
              onClick={() => setChoosing(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 13.5, borderRadius: 999, padding: "9px 16px", cursor: "pointer" }}
            >
              <UserCheck size={15} /> Assign mentor
            </button>
          )
        )}
        {choosing && (
          <MentorChooser mentors={mentors} cohortYear={cohortYear} currentId={owner?.id || null} lessonNumber={lesson.number} onPick={pick} onCreate={create} onClose={() => setChoosing(false)} />
        )}
      </Section>
    </div>
  );
}

/* ---------- Existing or new ---------- */
function MentorChooser({ mentors, cohortYear, currentId, lessonNumber, onPick, onCreate, onClose }) {
  const [mode, setMode] = useState("existing");
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const q = search.trim().toLowerCase();
  const list = [...mentors]
    .filter((m) => m.id !== currentId && (!q || m.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <SegmentedTabs
          value={mode}
          onChange={setMode}
          style={{ flex: 1 }}
          options={[
            { id: "existing", label: "Use an existing mentor" },
            { id: "new", label: "Add a new mentor", icon: Plus },
          ]}
        />
        <button type="button" onClick={onClose} title="Close" style={{ border: "none", background: "transparent", color: COLORS.faint, cursor: "pointer", display: "flex", padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {mode === "existing" ? (
        <>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={14} color={COLORS.faint} style={{ position: "absolute", left: 11, top: 10 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search mentors"
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "8px 12px 8px 32px", fontSize: 13.5, outline: "none", fontFamily: "inherit" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
            {list.length === 0 && <div style={{ fontSize: 13, color: COLORS.faint, fontStyle: "italic", padding: "6px 2px" }}>No mentors match.</div>}
            {list.map((m) => {
              const mine = (m.assignedLessons || []).filter((a) => a.cohortYear === cohortYear).map((a) => a.lessonNumber);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => onPick(m.id))}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: `1px solid ${COLORS.border}`, background: "#fff", borderRadius: 12, padding: "8px 12px", cursor: busy ? "default" : "pointer", fontFamily: "inherit" }}
                >
                  <Avatar name={m.name} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{m.name}{m.years ? <span style={{ fontWeight: 700, marginLeft: 8 }}>{m.years}</span> : null}</div>
                    {mine.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: COLORS.amber, marginTop: 2 }}>
                        <BookOpen size={12} /> {mine.map((n) => `L${n}`).join(", ")}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.indigo }}>Assign to L{lessonNumber}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mentor's name"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim() && !busy) run(() => onCreate(name.trim())); }}
            style={{ flex: 1, minWidth: 200, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none", fontFamily: "inherit" }}
          />
          <button
            type="button"
            disabled={!name.trim() || busy}
            onClick={() => run(() => onCreate(name.trim()))}
            style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: name.trim() ? COLORS.indigo : COLORS.border, color: name.trim() ? "#fff" : COLORS.faint, fontWeight: 800, fontSize: 13.5, borderRadius: 999, padding: "9px 16px", cursor: name.trim() && !busy ? "pointer" : "default" }}
          >
            <Plus size={14} /> Create and assign
          </button>
          <div style={{ width: "100%", fontSize: 12, color: COLORS.faint }}>Contact details, notes and tags go on their profile in the Mentors tab afterwards.</div>
        </div>
      )}
    </div>
  );
}

/* ---------- bits ---------- */
function Section({ title, hint, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4 }}>{title}</div>
        {hint && <div style={{ fontSize: 12, color: COLORS.faint }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: COLORS.faint, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>
        <Icon size={12} /> {label}
      </div>
      {children}
    </div>
  );
}

function SmallButton({ onClick, icon: Icon, tone = "indigo", children }) {
  const quiet = tone === "quiet";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${quiet ? COLORS.border : COLORS.indigoBorder}`, background: quiet ? "#fff" : COLORS.indigoSoft, color: quiet ? COLORS.sub : COLORS.indigo, fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}
    >
      {Icon && <Icon size={13} />} {children}
    </button>
  );
}
