"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Mail, Phone, MessageCircle, Calendar, Star, Eye, BookOpen, UserCheck, Lock, UserPlus, Users } from "lucide-react";
import {
  COLORS,
  EditableInput,
  EditableTextarea,
  StatusBadge,
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
  { id: "confirmed", label: "Confirmed", color: COLORS.amber, soft: COLORS.amberSoft, border: COLORS.amberBorder },
];
const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];

const CONTACT_METHODS = ["Email", "Phone", "Discord", "Other"];
const methodIcon = (method) => (method === "Email" ? Mail : method === "Phone" ? Phone : MessageCircle);

/* Same derivation the server uses for the student-facing route. */
function publicContactPreview(mentor) {
  const options = mentor.contacts.filter((c) => c.public && c.value.trim());
  if (options.length === 0) return null;
  const chosen = options.find((c) => c.preferred) || options[0];
  return `${chosen.method} (${chosen.value})`;
}

function ownerOfLesson(mentors, lessonNumber, cohortYear, excludeId) {
  return mentors.find((m) => m.id !== excludeId && m.assignedLessons.some((a) => a.lessonNumber === lessonNumber && a.cohortYear === cohortYear));
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

/* ---------- Lesson assignment editor ---------- */
function LessonAssignmentRow({ lesson, assigned, ownerName, onToggle }) {
  const takenByOther = !assigned && Boolean(ownerName);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${assigned ? COLORS.amberBorder : COLORS.border}`,
        background: assigned ? COLORS.amberSoft : "#fff",
        borderRadius: 12,
        padding: "10px 12px",
        opacity: takenByOther ? 0.7 : 1,
      }}
    >
      <button type="button" onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", flex: 1, textAlign: "left", padding: 0 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            border: `1.5px solid ${assigned ? COLORS.amber : COLORS.faint}`,
            background: assigned ? COLORS.amber : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {assigned && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
            Lesson {lesson.number} · {lesson.title}
          </div>
          <div style={{ fontSize: 12, color: COLORS.faint }}>{lesson.chapterLabel}</div>
        </div>
      </button>
      {takenByOther && <span style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.faint, whiteSpace: "nowrap" }}>Assigned to {ownerName}</span>}
    </div>
  );
}

function LessonAssignmentsEditor({ mentor, mentors, lessons, cohortYear, onToggle }) {
  const mentorLessons = lessons.filter((l) => l.mentorEnabled);
  if (mentorLessons.length === 0) {
    return <div style={{ fontSize: 13.5, color: COLORS.faint, fontStyle: "italic" }}>No lessons are flagged "Yes Mentor" in the Lesson Editor yet.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {mentorLessons.map((lesson) => {
        const assigned = mentor.assignedLessons.some((a) => a.lessonNumber === lesson.number && a.cohortYear === cohortYear);
        const owner = ownerOfLesson(mentors, lesson.number, cohortYear, mentor.id);
        return <LessonAssignmentRow key={lesson.id} lesson={lesson} assigned={assigned} ownerName={owner ? owner.name : null} onToggle={() => onToggle(lesson.number, !assigned)} />;
      })}
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
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{mentor.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: COLORS.faint }}>{mentor.lastContactedAt ? `Last contacted ${mentor.lastContactedAt}` : "Not contacted yet"}</span>
          {thisYear.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: COLORS.amber }}>
              <BookOpen size={12} />
              {thisYear.map((a) => `L${a.lessonNumber}`).join(", ")}
            </span>
          )}
        </div>
      </div>
      <StatusDropdown value={mentor.status} onChange={onStatusChange} statuses={STATUSES} />
    </div>
  );
}

/* ---------- Detail view ---------- */
function MentorDetail({ mentor, mentors, lessons, cohortYear, onBack, onUpdate, onDelete, onToggleLesson }) {
  const [tab, setTab] = useState("internal");
  const contactPreview = publicContactPreview(mentor);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
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
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: COLORS.text, minWidth: 120, flex: 1 }}>
                <EditableInput value={mentor.name} onChange={(v) => onUpdate({ ...mentor, name: v })} style={{ fontSize: 19, fontWeight: 900 }} />
              </div>
              <StatusBadge status={statusOf(mentor.status)} size="sm" />
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                <MessageCircle size={12} /> {contactPreview || "No public contact set"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                <Calendar size={12} /> {mentor.lastContactedAt || "Never contacted"}
              </span>
            </div>
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
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginBottom: 10 }}>Status</div>
            <StatusDropdown value={mentor.status} onChange={(status) => onUpdate({ ...mentor, status })} statuses={STATUSES} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginBottom: 10 }}>Last contacted</div>
            <input
              type="date"
              value={mentor.lastContactedAt || ""}
              onChange={(e) => onUpdate({ ...mentor, lastContactedAt: e.target.value })}
              style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "8px 12px", fontSize: 14, color: COLORS.text }}
            />
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

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginBottom: 10 }}>Assigned to lessons · Cohort {cohortYear}</div>
            <LessonAssignmentsEditor mentor={mentor} mentors={mentors} lessons={lessons} cohortYear={cohortYear} onToggle={(lessonNumber, assign) => onToggleLesson(mentor.id, lessonNumber, assign)} />
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

  const addMentor = () =>
    saver.immediate(async () => {
      const fresh = await api.post("/api/mentors", {});
      setMentors((prev) => [fresh, ...prev]);
      setOpenId(fresh.id);
    });

  const removeMentor = async (id) => {
    const m = mentors.find((x) => x.id === id);
    if (!(await confirmDanger({ title: `Remove ${m.name} from the CRM?`, body: "Their contact history and lesson assignments go with them.", label: "Remove mentor" }))) return;
    saver.immediate(async () => {
      await api.del(`/api/mentors/${id}`);
      setMentors((prev) => prev.filter((x) => x.id !== id));
      setOpenId(null);
    });
  };

  // Server enforces one mentor per lesson per cohort year; a conflict comes
  // back as 409 and is shown as-is.
  const toggleLesson = (mentorId, lessonNumber, assign) =>
    saver.immediate(async () => {
      try {
        const saved = await api.post(`/api/mentors/${mentorId}/assign`, { lessonNumber, cohortYear, assign });
        replaceMentor(saved);
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    });

  const openMentor = mentors?.find((m) => m.id === openId);
  const filtered = (mentors || []).filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "28px 20px" }}>
      {confirmUI}
      {teamOpen && <AdvancementModal onClose={() => setTeamOpen(false)} />}
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
      </div>

      {!mentors ? (
        <Loading />
      ) : openMentor ? (
        <MentorDetail
          mentor={openMentor}
          mentors={mentors}
          lessons={lessons}
          cohortYear={cohortYear}
          onBack={() => setOpenId(null)}
          onUpdate={updateMentor}
          onDelete={() => removeMentor(openMentor.id)}
          onToggleLesson={toggleLesson}
        />
      ) : (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <FilterBar
            filter={filter}
            setFilter={setFilter}
            statuses={STATUSES}
            search={search}
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
