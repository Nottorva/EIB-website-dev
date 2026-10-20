"use client";

import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Trash2, Mail, Phone, MessageCircle, Star, X, Eye, BookOpen, UserCheck, Lock, UserPlus, Users, CalendarDays } from "lucide-react";
import SessionsTab, { ownerOfLesson } from "./SessionsTab";
import {
  COLORS,
  EditableInput,
  EditableTextarea,
  StatusDropdown,
  FilterBar,
  Avatar,
  EmptyState,
  Notice,
  SaveIndicator,
  Loading,
  SegmentedTabs,
  PageTitle,
  nextId,
  ModalShell,
  PrimaryButton,
  useDangerConfirm,
} from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";

const STATUSES = [
  { id: "contacted", label: "Contacted", color: COLORS.indigo, soft: COLORS.indigoSoft, border: COLORS.indigoBorder },
  { id: "responsive", label: "Responsive", color: COLORS.green, soft: COLORS.greenSoft, border: COLORS.greenBorder },
  { id: "unresponsive", label: "Unresponsive", color: COLORS.red, soft: COLORS.redSoft, border: COLORS.redBorder },
  { id: "unsure", label: "Unsure", color: COLORS.sub, soft: "#f3f4f8", border: "#e2e6ee" },
  { id: "confirmed", label: "Confirmed", color: COLORS.amber, soft: COLORS.amberSoft, border: COLORS.amberBorder },
];

const CONTACT_METHODS = ["Email", "Phone", "Discord", "Other"];

// What a mentor has done with EIB. Shown in the list and the profile; edited
// only in the profile. Keep in step with MENTOR_TAGS on the server.
const MENTOR_TAGS = [
  { id: "speaker", label: "Speaker" },
  { id: "mentor", label: "Mentor" },
  { id: "panelist", label: "Panelist" },
];
const tagLabel = (id) => MENTOR_TAGS.find((t) => t.id === id)?.label || id;

function TagChip({ id, onRemove }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 800, color: COLORS.sub, background: "#f3f4f8", border: `1px solid ${COLORS.border}`, borderRadius: 999, padding: "3px 9px", lineHeight: 1.2, whiteSpace: "nowrap" }}>
      {tagLabel(id)}
      {onRemove && (
        <button type="button" title="Remove tag" onClick={(e) => { e.stopPropagation(); onRemove(); }} style={{ border: "none", background: "transparent", padding: 0, margin: "0 -3px 0 1px", display: "flex", cursor: "pointer", color: COLORS.faint }}>
          <X size={11} strokeWidth={3} />
        </button>
      )}
    </span>
  );
}

/* Read-only chips (list rows). */
function TagChips({ tags }) {
  if (!tags?.length) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {tags.map((t) => <TagChip key={t} id={t} />)}
    </span>
  );
}

/* Editable chips plus an "Add tag" menu (profile view). */
function TagsEditor({ tags, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const remaining = MENTOR_TAGS.filter((t) => !tags.includes(t.id));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      {tags.map((t) => <TagChip key={t} id={t} onRemove={() => onChange(tags.filter((x) => x !== t))} />)}
      {remaining.length > 0 && (
        <div ref={ref} style={{ position: "relative" }}>
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 800, color: COLORS.indigo, background: "#fff", border: `1px dashed ${COLORS.indigoBorder}`, borderRadius: 999, padding: "3px 9px", cursor: "pointer", lineHeight: 1.2, fontFamily: "inherit" }}>
            <Plus size={11} strokeWidth={3} /> Add tag
          </button>
          {open && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 6, boxShadow: "0 8px 24px rgba(20,20,40,0.12)", display: "flex", flexDirection: "column", minWidth: 130 }}>
              {remaining.map((t) => (
                <button key={t.id} type="button" onClick={() => { onChange([...tags, t.id]); setOpen(false); }} style={{ textAlign: "left", border: "none", background: "transparent", padding: "7px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: COLORS.text, cursor: "pointer", fontFamily: "inherit" }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* An inline input exactly as wide as its text, so the fields beside it move
   as you type. A hidden mirror span sets the width; the input sits on top. */
function AutoInput({ value, onChange, placeholder, style }) {
  const text = value ?? "";
  const font = { lineHeight: 1.3, ...style };
  return (
    <span style={{ position: "relative", display: "inline-block", maxWidth: "100%", whiteSpace: "pre", padding: "0 2px", ...font }}>
      <span aria-hidden style={{ visibility: "hidden" }}>{text || placeholder}</span>
      <EditableInput
        value={text}
        onChange={onChange}
        placeholder={placeholder}
        style={{ position: "absolute", left: -7, top: -3, margin: 0, width: "calc(100% + 14px)", height: "calc(100% + 6px)", minWidth: 0, ...font, padding: "3px 7px" }}
      />
    </span>
  );
}
const methodIcon = (method) => (method === "Email" ? Mail : method === "Phone" ? Phone : MessageCircle);

/* Same derivation the server uses for the student-facing route. */
function publicContactPreview(mentor) {
  const options = mentor.contacts.filter((c) => c.public && c.value.trim());
  if (options.length === 0) return null;
  const chosen = options.find((c) => c.preferred) || options[0];
  return `${chosen.method} (${chosen.value})`;
}

function TogglePill({ active, onClick, icon: Icon, label, tone = "indigo" }) {
  const toneColor = tone === "amber" ? COLORS.amber : COLORS.indigo;
  const toneSoft = tone === "amber" ? COLORS.amberSoft : COLORS.indigoSoft;
  const toneBorder = tone === "amber" ? COLORS.amberBorder : COLORS.indigoBorder;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 800,
        color: active ? toneColor : COLORS.faint,
        background: active ? toneSoft : "#fff",
        border: `1px solid ${active ? toneBorder : COLORS.border}`,
        borderRadius: 999,
        padding: "4px 10px",
        cursor: "pointer",
      }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {label}
    </button>
  );
}

/* ---------- Contact methods editor ---------- */
function ContactRow({ contact, onChange, onDelete, onMakePreferred }) {
  const Icon = methodIcon(contact.method);
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Icon size={15} color={COLORS.faint} style={{ flexShrink: 0 }} />
      <select
        value={contact.method}
        onChange={(e) => onChange({ ...contact, method: e.target.value })}
        style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.sub, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 6px", background: "#fff" }}
      >
        {CONTACT_METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <div style={{ flex: 1, minWidth: 140 }}>
        <EditableInput
          value={contact.value}
          onChange={(v) => onChange({ ...contact, value: v })}
          placeholder={contact.method === "Email" ? "name@example.com" : "Contact detail"}
          style={{ fontSize: 14, color: COLORS.text }}
        />
      </div>
      <TogglePill active={contact.preferred} onClick={onMakePreferred} icon={Star} label="Preferred" tone="indigo" />
      <TogglePill active={contact.public} onClick={() => onChange({ ...contact, public: !contact.public })} icon={contact.public ? Eye : Lock} label={contact.public ? "Public" : "Private"} tone="amber" />
      <button type="button" onClick={onDelete} style={{ border: "none", background: "transparent", color: COLORS.faint, cursor: "pointer", padding: 4 }}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function ContactsEditor({ contacts, onChange }) {
  const update = (id, next) => onChange(contacts.map((c) => (c.id === id ? next : c)));
  const remove = (id) => onChange(contacts.filter((c) => c.id !== id));
  const makePreferred = (id) => onChange(contacts.map((c) => ({ ...c, preferred: c.id === id })));
  const add = () => onChange([...contacts, { id: nextId("contact"), method: "Email", value: "", preferred: contacts.length === 0, public: false }]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {contacts.length === 0 && <div style={{ fontSize: 13, color: COLORS.faint, fontStyle: "italic", padding: "4px 2px" }}>No contact info yet.</div>}
      {contacts.map((c) => (
        <ContactRow key={c.id} contact={c} onChange={(next) => update(c.id, next)} onDelete={() => remove(c.id)} onMakePreferred={() => makePreferred(c.id)} />
      ))}
      <button
        type="button"
        onClick={add}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: `1px dashed ${COLORS.border}`,
          background: "#fff",
          color: COLORS.indigo,
          fontWeight: 700,
          fontSize: 13,
          borderRadius: 10,
          padding: "8px 12px",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        <Plus size={14} /> Add contact method
      </button>
    </div>
  );
}

/* ---------- Student-facing preview ---------- */
function StudentFacingPreview({ mentor }) {
  const contactPreview = publicContactPreview(mentor);
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, background: "#fbfbfd" }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>What students see</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: COLORS.text }}>{mentor.name}</div>
      {mentor.publicRole && <div style={{ fontSize: 13.5, color: COLORS.sub, fontWeight: 600, marginTop: 2, marginBottom: 14 }}>{mentor.publicRole}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14, marginTop: mentor.publicRole ? 0 : 12 }}>
        <MessageCircle size={16} color={COLORS.amber} strokeWidth={2.25} />
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.amber, letterSpacing: 0.4 }}>Preferred contact</div>
          <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 700 }}>{contactPreview || "Not specified"}</div>
        </div>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 16px", fontSize: 14, color: COLORS.text, lineHeight: 1.55 }}>
        {mentor.publicBio || "No bio added yet."}
      </div>
      {!contactPreview && <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 10 }}>Mark a contact method "Public" on the Internal tab for it to show up here.</div>}
    </div>
  );
}

/* ---------- List row ---------- */
function MentorRow({ mentor, cohortYear, onOpen, onStatusChange }) {
  const thisYear = mentor.assignedLessons.filter((a) => a.cohortYear === cohortYear);
  return (
    <div
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer" }}
    >
      <Avatar name={mentor.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{mentor.name}</span>
          {mentor.years && <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.text, whiteSpace: "pre" }}>{mentor.years}</span>}
          <TagChips tags={mentor.tags} />
        </div>
        {thisYear.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 12, fontWeight: 700, color: COLORS.amber }}>
            <BookOpen size={12} />
            {thisYear.map((a) => `L${a.lessonNumber}`).join(", ")}
          </span>
        )}
      </div>
      <StatusDropdown value={mentor.status} onChange={onStatusChange} statuses={STATUSES} />
    </div>
  );
}

/* ---------- Detail view ---------- */
function MentorDetail({ mentor, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = useState("internal");
  const contactPreview = publicContactPreview(mentor);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.sub, fontWeight: 700, fontSize: 13.5, cursor: "pointer", padding: "4px 0" }}>
          <ArrowLeft size={15} /> Back to list
        </button>
        <button type="button" onClick={onDelete} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.faint, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          <Trash2 size={14} /> Remove mentor
        </button>
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={mentor.name} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name, years and tags wrap as a group; the status pill stays top-right outside the wrap. */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minHeight: 30 }}>
              <AutoInput value={mentor.name} onChange={(v) => onUpdate({ ...mentor, name: v })} placeholder="Name" style={{ fontSize: 19, fontWeight: 900, color: COLORS.text }} />
              <AutoInput value={mentor.years} onChange={(v) => onUpdate({ ...mentor, years: v })} placeholder="Add years" style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }} />
              <TagsEditor tags={mentor.tags || []} onChange={(tags) => onUpdate({ ...mentor, tags })} />
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                <MessageCircle size={12} /> {contactPreview || "No public contact set"}
              </span>
            </div>
          </div>
          <div style={{ alignSelf: "flex-start", flexShrink: 0 }}>
            <StatusDropdown value={mentor.status} onChange={(status) => onUpdate({ ...mentor, status })} statuses={STATUSES} />
          </div>
        </div>

        <SegmentedTabs
          value={tab}
          onChange={setTab}
          style={{ marginTop: 16 }}
          options={[
            { id: "internal", label: "Internal" },
            { id: "studentFacing", label: "Student-Facing" },
          ]}
        />
      </div>

      {tab === "internal" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginBottom: 10 }}>Contact methods</div>
            <ContactsEditor contacts={mentor.contacts} onChange={(contacts) => onUpdate({ ...mentor, contacts })} />
            <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 8 }}>Private contacts never leave the server on student-facing routes.</div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginBottom: 10 }}>Notes</div>
            <div style={{ background: "#f7f8fb", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px" }}>
              <EditableTextarea
                value={mentor.notes}
                onChange={(v) => onUpdate({ ...mentor, notes: v })}
                placeholder="Anything worth remembering about this mentor..."
                rows={3}
                style={{ fontSize: 13.5, color: COLORS.text, lineHeight: 1.5, background: "transparent" }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginBottom: 10 }}>Public role or title</div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px" }}>
              <EditableInput value={mentor.publicRole} onChange={(v) => onUpdate({ ...mentor, publicRole: v })} placeholder="e.g. CEO, Terra CO2 · EIB Panelist" style={{ fontSize: 14, color: COLORS.text }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginBottom: 10 }}>Bio shown to students</div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px" }}>
              <EditableTextarea value={mentor.publicBio} onChange={(v) => onUpdate({ ...mentor, publicBio: v })} placeholder="A couple sentences students will read about this mentor..." rows={4} style={{ fontSize: 14, color: COLORS.text, lineHeight: 1.5 }} />
            </div>
          </div>
          <StudentFacingPreview mentor={mentor} />
        </div>
      )}
    </div>
  );
}

/* ---------- App ---------- */
export default function MentorCRM({ user }) {
  const [teamOpen, setTeamOpen] = useState(false);
  const [confirmDanger, confirmUI] = useDangerConfirm();
  const [mentors, setMentors] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [cohortYear, setCohortYear] = useState(new Date().getFullYear());
  const [openId, setOpenId] = useState(null);
  const [tab, setTab] = useState("mentors");
  // the New mentor popup: null, or { lessonNumber } (null lessonNumber = from the Mentors tab)
  const [newMentor, setNewMentor] = useState(null);
  // bumping this remounts the Sessions tab, dropping any open session
  const [sessionsKey, setSessionsKey] = useState(0);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const saver = useDebouncedSaver();

  useEffect(() => {
    Promise.all([api.get("/api/mentors"), api.get("/api/lessons")])
      .then(([m, l]) => {
        setMentors(m.mentors);
        setCohortYear(m.cohortYear);
        setLessons(l);
      })
      .catch((e) => setError(e.message));
  }, []);

  // /crm?tab=sessions deep-links to the Sessions tab.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted === "sessions") setTab("sessions");
  }, []);
  // The Mentor CRM link in the top bar always comes back to the mentors list.
  useEffect(() => {
    const onHome = (e) => {
      if (e.detail !== "/crm") return;
      setTab("mentors");
      setOpenId(null);
      setSessionsKey((k) => k + 1);
    };
    window.addEventListener("eib:tool-home", onHome);
    return () => window.removeEventListener("eib:tool-home", onHome);
  }, []);

  const replaceMentor = (updated) => setMentors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));

  const updateMentor = (updated) => {
    replaceMentor(updated);
    const { assignedLessons, id, ...fields } = updated;
    saver.schedule(id, () => api.patch(`/api/mentors/${id}`, fields));
  };

  const setStatus = (id, status) => {
    setMentors((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
    saver.immediate(() => api.patch(`/api/mentors/${id}`, { status }));
  };

  // Both "Add mentor" buttons open the popup; on create the mentor is
  // assigned to the session it came from, or its profile opens.
  const addMentor = () => setNewMentor({ lessonNumber: null });
  const createMentor = async ({ name, status, contacts, notes }) => {
    const made = await api.post("/api/mentors", { name, status });
    const fresh = await api.patch(`/api/mentors/${made.id}`, { contacts, notes });
    setMentors((prev) => [fresh, ...prev]);
    const { lessonNumber } = newMentor;
    setNewMentor(null);
    if (lessonNumber) await assignMentor(lessonNumber, fresh.id);
    else { setTab("mentors"); setOpenId(fresh.id); }
  };

  const removeMentor = async (id) => {
    const m = mentors.find((x) => x.id === id);
    if (!(await confirmDanger({ title: `Remove ${m.name} from the CRM?`, body: "Their contact history and lesson assignments go with them.", label: "Remove mentor" }))) return;
    saver.immediate(async () => {
      await api.del(`/api/mentors/${id}`);
      setMentors((prev) => prev.filter((x) => x.id !== id));
      setOpenId(null);
    });
  };

  // Server enforces one mentor per lesson per cohort year (409 on conflict),
  // so a change of mentor unassigns the current one first.
  const setAssignment = (mentorId, lessonNumber, assign) =>
    api.post(`/api/mentors/${mentorId}/assign`, { lessonNumber, cohortYear, assign }).then(replaceMentor);
  const assignMentor = (lessonNumber, mentorId) =>
    saver.immediate(async () => {
      try {
        const current = ownerOfLesson(mentors, lessonNumber, cohortYear);
        if (current && current.id !== mentorId) await setAssignment(current.id, lessonNumber, false);
        if (!current || current.id !== mentorId) await setAssignment(mentorId, lessonNumber, true);
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    });
  const unassignMentor = (lessonNumber, mentorId) =>
    saver.immediate(async () => {
      try {
        await setAssignment(mentorId, lessonNumber, false);
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    });
  // Session details (time, room, brief): super admin only; the server checks.
  const patchLesson = (id, fields) => {
    setLessons((prev) => prev.map((l) => (l.id === id ? { ...l, ...fields } : l)));
    saver.schedule(`lesson:${id}`, async () => {
      const merged = lessons.find((l) => l.id === id) || {};
      const body = {};
      for (const k of ["room", "startTime", "endTime", "mentorBrief"]) if (k in fields || k in merged) body[k] = k in fields ? fields[k] : merged[k];
      await api.patch(`/api/lessons/${id}`, body);
    });
  };
  const openMentorFromSession = (id) => {
    setTab("mentors");
    setOpenId(id);
  };

  const openMentor = mentors?.find((m) => m.id === openId);
  // Search covers the name, the years text and the tag labels; apostrophes
  // are ignored so "26" finds "'26".
  const norm = (s) => String(s || "").toLowerCase().replace(/['’]/g, "");
  const query = norm(search).trim();
  const filtered = (mentors || []).filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    if (!query) return true;
    const hay = norm([m.name, m.years, ...(m.tags || []).map(tagLabel)].join(" "));
    return hay.includes(query);
  });

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "28px 20px" }}>
      {confirmUI}
      {teamOpen && <AdvancementModal onClose={() => setTeamOpen(false)} />}
      {newMentor && <NewMentorModal forLesson={newMentor.lessonNumber} onClose={() => setNewMentor(null)} onCreate={createMentor} />}
      <PageTitle
        title="EIB Mentor CRM"
        right={
          <>
            <SaveIndicator status={saver.status} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, fontWeight: 800, color: COLORS.sub, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "8px 14px" }}>
              <UserCheck size={15} /> {(mentors || []).filter((m) => m.status === "confirmed").length} confirmed · {(mentors || []).length} total · Cohort {cohortYear}
            </div>
          </>
        }
      />

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}
        <SegmentedTabs
          value={tab}
          onChange={(t) => { setTab(t); setOpenId(null); }}
          style={{ marginBottom: 18 }}
          options={[
            { id: "mentors", label: "Mentors", icon: Users },
            { id: "sessions", label: "Sessions", icon: CalendarDays },
          ]}
        />
      </div>

      {!mentors ? (
        <Loading />
      ) : tab === "sessions" ? (
        <SessionsTab
          key={sessionsKey}
          user={user}
          lessons={lessons}
          mentors={mentors}
          cohortYear={cohortYear}
          statuses={STATUSES}
          onPatchLesson={patchLesson}
          onAssign={assignMentor}
          onUnassign={unassignMentor}
          onNewMentor={(lessonNumber) => setNewMentor({ lessonNumber })}
          onOpenMentor={openMentorFromSession}
        />
      ) : openMentor ? (
        <MentorDetail
          mentor={openMentor}
          onBack={() => setOpenId(null)}
          onUpdate={updateMentor}
          onDelete={() => removeMentor(openMentor.id)}
        />
      ) : (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <FilterBar
            filter={filter}
            setFilter={setFilter}
            statuses={STATUSES}
            search={search}
            placeholder="Search name, year or tag"
            setSearch={setSearch}
            right={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={addMentor}
                  style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 13, borderRadius: 999, padding: "7px 14px", cursor: "pointer" }}
                >
                  <Plus size={14} /> Add mentor
                </button>
                {user?.role === "superAdmin" && (
                  <button
                    type="button"
                    onClick={() => setTeamOpen(true)}
                    title="Create and remove advancement team accounts (they get this CRM and nothing else)"
                    style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.indigoBorder}`, background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 800, fontSize: 13, borderRadius: 999, padding: "7px 14px", cursor: "pointer" }}
                  >
                    <UserPlus size={14} /> New advancement team member
                  </button>
                )}
              </div>
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.length === 0 && <EmptyState>No mentors match this filter.</EmptyState>}
            {filtered.map((m) => (
              <MentorRow key={m.id} mentor={m} cohortYear={cohortYear} onOpen={() => setOpenId(m.id)} onStatusChange={(status) => setStatus(m.id, status)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
/* ================= New mentor (popup) ================= */
// The Internal side of a profile, filled in before the mentor exists: name,
// status, contact methods and notes. Years, tags and the student-facing
// fields are edited on the profile afterwards.
function NewMentorModal({ forLesson, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("contacted");
  const [contacts, setContacts] = useState([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const can = name.trim().length > 0 && !busy;
  const label = { fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginBottom: 10 };
  const submit = async () => {
    if (!can) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), status, contacts, notes });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <ModalShell eyebrow={forLesson ? `Lesson ${forLesson}` : "Mentor CRM"} title="New mentor" onClose={onClose} maxWidth={640}>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={label}>Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mentor's name"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 15, fontWeight: 700, outline: "none", fontFamily: "inherit", color: COLORS.text }}
            />
          </div>
          <div>
            <div style={label}>Status</div>
            <StatusDropdown value={status} onChange={setStatus} statuses={STATUSES} />
          </div>
        </div>
        <div>
          <div style={label}>Contact methods</div>
          <ContactsEditor contacts={contacts} onChange={setContacts} />
          <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 8 }}>Private contacts never leave the server on student-facing routes.</div>
        </div>
        <div>
          <div style={label}>Notes</div>
          <div style={{ background: "#f7f8fb", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px" }}>
            <EditableTextarea value={notes} onChange={setNotes} placeholder="Where they came from, what they said, anything worth remembering..." rows={3} style={{ fontSize: 13.5, color: COLORS.text, lineHeight: 1.5, background: "transparent" }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13.5, borderRadius: 999, padding: "9px 16px", cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
          <PrimaryButton onClick={submit} disabled={!can} icon={Plus}>
            {forLesson ? `Create and assign to L${forLesson}` : "Create mentor"}
          </PrimaryButton>
        </div>
      </div>
    </ModalShell>
  );
}

/* ================= Advancement team (super admin) ================= */
// Lists the advancement team accounts, creates one from an email (name is
// optional; it is derived from the email until they sign in), and removes
// one behind the two-step confirm. These accounts open the Mentor CRM only.
function AdvancementModal({ onClose }) {
  const [rows, setRows] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDanger, confirmUI] = useDangerConfirm();
  const canCreate = /\S+@\S+\.\S+/.test(email.trim());

  useEffect(() => {
    api.get("/api/users?role=advancement").then(setRows).catch((e) => setError(e.message));
  }, []);

  const create = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      const created = await api.post("/api/users", { name: name.trim(), email: email.trim(), role: "advancement" });
      setRows((prev) => [...(prev || []), created]);
      setName("");
      setEmail("");
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    if (!(await confirmDanger({ title: `Remove ${u.name}?`, body: `${u.email} will no longer be able to sign in.`, label: "Remove account" }))) return;
    try {
      await api.del(`/api/users/${u.id}`);
      setRows((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none" };
  const label = { fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };

  return (
    <ModalShell eyebrow="Super admin" title="Advancement team" onClose={onClose} maxWidth={640}>
      {confirmUI}
      <div style={{ fontSize: 14, color: COLORS.sub, marginBottom: 16, lineHeight: 1.55 }}>
        Advancement team accounts open the Mentor CRM and nothing else. Add an email; they sign in with that Google account straight away.
      </div>
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14, marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px" }}>
          <div style={label}>Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="name@example.com" autoFocus style={inputStyle} />
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <div style={label}>Name (optional)</div>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Full name" style={inputStyle} />
        </div>
        <PrimaryButton onClick={create} disabled={!canCreate || busy} icon={UserPlus}>
          {busy ? "Creating…" : "Create account"}
        </PrimaryButton>
      </div>
      {!rows ? (
        <Loading />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.length === 0 && <EmptyState>No advancement team accounts yet.</EmptyState>}
          {rows.map((u) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px" }}>
              <Avatar name={u.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{u.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, marginTop: 2 }}>
                  <Mail size={12} /> {u.email}
                </div>
              </div>
              <button type="button" onClick={() => remove(u)} title="Remove this account" style={{ border: "none", background: "transparent", color: COLORS.faint, cursor: "pointer", padding: 4 }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
