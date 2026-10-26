"use client";

// Mentor CRM · Sessions tab. One row per lesson flagged "Yes Mentor" in the
// Lesson Editor, plus CRM-only events (EIB Night, a panel, a visit) in light
// purple that the super admin adds and drags into place among the lessons.
// Opening a session or an event shows its details (time, place, and a note
// on the kind of mentor the advancement team should find; the super admin
// edits these in place, everyone else reads) and who is on it, with a chooser
// that picks an existing mentor or opens the new-mentor popup.

import React, { useRef, useState } from "react";
import { ArrowLeft, Plus, Search, Clock, MapPin, ExternalLink, UserCheck, X, BookOpen, CalendarDays, GripVertical, Trash2 } from "lucide-react";
import { COLORS, Avatar, EmptyState, EditableInput, EditableTextarea, SegmentedTabs } from "./ui";

export function ownerOfLesson(mentors, lessonNumber, cohortYear) {
  return mentors.find((m) => (m.assignedLessons || []).some((a) => a.lessonNumber === lessonNumber && a.cohortYear === cohortYear)) || null;
}

// Lessons in curriculum order with each event slotted after the lesson it
// is anchored to ("start" = before the first). Events anchored to a lesson
// that no longer exists go last.
export function orderItems(lessons, events) {
  const slots = new Map([["start", []]]);
  for (const l of lessons) slots.set(l.number, []);
  const orphans = [];
  for (const ev of events) (slots.get(ev.anchor) || orphans).push(ev);
  const byRank = (a, b) => (a.rank || 0) - (b.rank || 0);
  const item = (ev) => ({ kind: "event", id: ev.id, event: ev });
  const out = slots.get("start").sort(byRank).map(item);
  for (const l of lessons) {
    out.push({ kind: "lesson", id: l.id, lesson: l });
    out.push(...slots.get(l.number).sort(byRank).map(item));
  }
  out.push(...orphans.sort(byRank).map(item));
  return out;
}

// Where an event lands when dropped before `items[index]` (index === length
// means the end): it takes the slot of whatever sits above it.
export function placement(items, draggedId, index) {
  const rest = items.filter((it) => it.id !== draggedId);
  const target = items[index];
  const at = target ? rest.findIndex((it) => it.id === target.id) : rest.length;
  const above = at > 0 ? rest[at - 1] : null;
  const slotOf = (anchor) => rest.filter((it) => it.kind === "event" && it.event.anchor === anchor).map((it) => it.event.rank || 0);
  if (!above) {
    const ranks = slotOf("start");
    return { anchor: "start", rank: ranks.length ? Math.min(...ranks) - 1 : 0 };
  }
  if (above.kind === "lesson") {
    const ranks = slotOf(above.lesson.number);
    return { anchor: above.lesson.number, rank: ranks.length ? Math.min(...ranks) - 1 : 0 };
  }
  const anchor = above.event.anchor;
  const next = rest[at];
  const aboveRank = above.event.rank || 0;
  if (next && next.kind === "event" && next.event.anchor === anchor) return { anchor, rank: (aboveRank + (next.event.rank || 0)) / 2 };
  return { anchor, rank: aboveRank + 1 };
}

const whenText = (x) => (x.startTime ? `${x.startTime}${x.endTime ? ` to ${x.endTime}` : ""}` : "Time to be set");
const whereText = (x, fallback) => x.room || x.location || fallback;
const kicker = (l) => [`Lesson ${l.number}`, l.chapterLabel].filter(Boolean).join(" · ");
const peopleOf = (ev, mentors) => (ev.mentorIds || []).map((id) => mentors.find((m) => m.id === id)).filter(Boolean);

export default function SessionsTab({ user, lessons, events, mentors, cohortYear, statuses, open, setOpen, onPatchLesson, onAssign, onUnassign, onNewMentor, onOpenMentor, onAddEvent, onPatchEvent, onPlaceEvent, onSetPeople, onDeleteEvent }) {
  const canEdit = user?.role === "superAdmin";
  const sessions = lessons.filter((l) => l.mentorEnabled);
  const items = orderItems(sessions, events);
  const [dragId, setDragId] = useState(null);
  const dragRef = useRef(null); // same id, readable before React re-renders
  const [over, setOver] = useState(null); // index the drop would go before
  const startDrag = (id) => { dragRef.current = id; setDragId(id); };
  const endDrag = () => { dragRef.current = null; setDragId(null); setOver(null); };

  const openLesson = open?.kind === "lesson" ? sessions.find((l) => l.id === open.id) : null;
  const openEvent = open?.kind === "event" ? events.find((e) => e.id === open.id) : null;

  if (openLesson) {
    return (
      <SessionDetail
        lesson={openLesson}
        mentors={mentors}
        cohortYear={cohortYear}
        statuses={statuses}
        canEdit={canEdit}
        onBack={() => setOpen(null)}
        onPatch={(fields) => onPatchLesson(openLesson.id, fields)}
        onAssign={(mentorId) => onAssign(openLesson.number, mentorId)}
        onUnassign={(mentorId) => onUnassign(openLesson.number, mentorId)}
        onNewMentor={() => onNewMentor({ lessonNumber: openLesson.number })}
        onOpenMentor={onOpenMentor}
      />
    );
  }
  if (openEvent) {
    return (
      <EventDetail
        event={openEvent}
        mentors={mentors}
        statuses={statuses}
        canEdit={canEdit}
        onBack={() => setOpen(null)}
        onPatch={(fields) => onPatchEvent(openEvent.id, fields)}
        onSetPeople={(ids) => onSetPeople(openEvent.id, ids)}
        onNewMentor={() => onNewMentor({ eventId: openEvent.id })}
        onOpenMentor={onOpenMentor}
        onDelete={() => onDeleteEvent(openEvent.id)}
      />
    );
  }

  const drop = (index) => {
    const id = dragRef.current;
    if (id == null) return;
    const ev = events.find((e) => e.id === id);
    const pos = placement(items, id, index);
    if (ev && (ev.anchor !== pos.anchor || ev.rank !== pos.rank)) onPlaceEvent(id, pos);
    endDrag();
  };
  const dragProps = (index) =>
    canEdit
      ? {
          onDragOver: (e) => { if (dragRef.current != null) { e.preventDefault(); setOver(index); } },
          onDragLeave: () => setOver((o) => (o === index ? null : o)),
          onDrop: (e) => { e.preventDefault(); drop(index); },
        }
      : {};

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "0 0 12px", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: COLORS.faint }}>
          {canEdit ? "Lessons come from the Lesson Editor (\"Yes Mentor\"). Events are CRM-only: add one and drag it into place." : "Sessions and events that need a mentor this year."}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={onAddEvent}
            style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.indigoBorder}`, background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 800, fontSize: 13, borderRadius: 999, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit" }}
          >
            <CalendarDays size={14} /> Add event
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 && <EmptyState>No lessons are flagged "Yes Mentor" yet, and no events have been added.</EmptyState>}
        {items.map((it, index) => {
          const indicator = over === index && dragId != null ? { boxShadow: `0 -3px 0 0 ${COLORS.indigo}` } : {};
          if (it.kind === "lesson") {
            const l = it.lesson;
            const owner = ownerOfLesson(mentors, l.number, cohortYear);
            return (
              <div
                key={it.id}
                {...dragProps(index)}
                onClick={() => setOpen({ kind: "lesson", id: l.id })}
                style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer", ...indicator }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: COLORS.amberSoft, color: COLORS.amber, fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {l.number}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{l.title || "Untitled lesson"}</div>
                  <Meta date={l.date} when={whenText(l)} where={whereText(l, "Room to be set")} />
                </div>
                {owner ? <Person mentor={owner} /> : <NoOne>No mentor yet</NoOne>}
              </div>
            );
          }
          const ev = it.event;
          const people = peopleOf(ev, mentors);
          return (
            <div
              key={it.id}
              draggable={canEdit}
              onDragStart={(e) => { startDrag(ev.id); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", ev.id); } catch {} }}
              onDragEnd={endDrag}
              {...dragProps(index)}
              onClick={() => setOpen({ kind: "event", id: ev.id })}
              data-event-id={ev.id}
              style={{ display: "flex", alignItems: "center", gap: 14, background: COLORS.indigoSoft, border: `1px solid ${COLORS.indigoBorder}`, borderRadius: 14, padding: "12px 16px", cursor: canEdit ? "grab" : "pointer", opacity: dragId === ev.id ? 0.5 : 1, ...indicator }}
            >
              {canEdit && <GripVertical size={16} color={COLORS.indigo} style={{ flexShrink: 0, marginLeft: -6, opacity: 0.7 }} />}
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff", color: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CalendarDays size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{ev.title || "Untitled event"}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: COLORS.indigo, background: "#fff", border: `1px solid ${COLORS.indigoBorder}`, borderRadius: 999, padding: "1px 7px", letterSpacing: 0.5 }}>EVENT</span>
                </div>
                <Meta date={ev.date} when={whenText(ev)} where={whereText(ev, "Place to be set")} />
              </div>
              {people.length ? <People people={people} /> : <NoOne>No one yet</NoOne>}
            </div>
          );
        })}
        {canEdit && dragId != null && (
          <div {...dragProps(items.length)} style={{ height: 36, borderRadius: 12, border: `1px dashed ${over === items.length ? COLORS.indigo : COLORS.indigoBorder}`, background: over === items.length ? COLORS.indigoSoft : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: COLORS.indigo, fontWeight: 700 }}>
            Drop here to put it last
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({ date, when, where }) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 3, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
      {date && <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.indigo }}><CalendarDays size={12} /> {date}</span>}
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {when}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {where}</span>
    </div>
  );
}
function Person({ mentor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: COLORS.text, whiteSpace: "nowrap" }}>
      <Avatar name={mentor.name} size={28} /> {mentor.name}
    </div>
  );
}
function People({ people }) {
  const shown = people.slice(0, 2);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: COLORS.text, whiteSpace: "nowrap" }}>
      <span style={{ display: "flex" }}>
        {people.slice(0, 3).map((m, i) => (
          <span key={m.id} style={{ marginLeft: i ? -8 : 0, border: "2px solid #fff", borderRadius: 999, display: "flex" }}><Avatar name={m.name} size={28} /></span>
        ))}
      </span>
      {shown.map((m) => m.name.split(" ")[0]).join(", ")}{people.length > 2 ? ` +${people.length - 2}` : ""}
    </div>
  );
}
function NoOne({ children }) {
  return <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.faint, border: `1px dashed ${COLORS.border}`, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap", background: "#fff" }}>{children}</span>;
}

/* ---------- One session ---------- */
function SessionDetail({ lesson, mentors, cohortYear, statuses, canEdit, onBack, onPatch, onAssign, onUnassign, onNewMentor, onOpenMentor }) {
  const [choosing, setChoosing] = useState(false);
  const owner = ownerOfLesson(mentors, lesson.number, cohortYear);

  const pick = async (mentorId) => {
    await onAssign(mentorId);
    setChoosing(false);
  };
  const addNew = () => {
    setChoosing(false);
    onNewMentor();
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <BackRow onBack={onBack} />
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.amber, letterSpacing: 0.5, textTransform: "uppercase" }}>{kicker(lesson)}</div>
        <div style={{ fontSize: 21, fontWeight: 900, color: COLORS.text, marginTop: 4 }}>{lesson.title || "Untitled lesson"}</div>
      </div>

      <Details item={lesson} canEdit={canEdit} onPatch={onPatch} whereKey="room" noteKey="mentorBrief" dateField title="Session details" placeholders={{ date: "Nov 17, 2026", where: "Room 214" }} />

      <Section title={`Mentor · Cohort ${cohortYear}`}>
        {owner ? (
          <PersonCard mentor={owner} statuses={statuses} onOpen={() => onOpenMentor(owner.id)} onRemove={() => onUnassign(owner.id)} removeLabel="Unassign" extra={<SmallButton onClick={() => setChoosing((c) => !c)}>Change mentor</SmallButton>} />
        ) : (
          !choosing && <BigButton onClick={() => setChoosing(true)} icon={UserCheck}>Assign mentor</BigButton>
        )}
        {choosing && <MentorChooser mentors={mentors} cohortYear={cohortYear} excludeIds={owner ? [owner.id] : []} action={`Assign to L${lesson.number}`} onPick={pick} onNew={addNew} onClose={() => setChoosing(false)} />}
      </Section>
    </div>
  );
}

/* ---------- One event ---------- */
function EventDetail({ event, mentors, statuses, canEdit, onBack, onPatch, onSetPeople, onNewMentor, onOpenMentor, onDelete }) {
  const [choosing, setChoosing] = useState(false);
  const people = peopleOf(event, mentors);
  const ids = event.mentorIds || [];

  const pick = async (mentorId) => {
    if (!ids.includes(mentorId)) await onSetPeople([...ids, mentorId]);
    setChoosing(false);
  };
  const remove = (mentorId) => onSetPeople(ids.filter((id) => id !== mentorId));
  const addNew = () => {
    setChoosing(false);
    onNewMentor();
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <BackRow
        onBack={onBack}
        right={
          canEdit && (
            <button type="button" onClick={onDelete} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.faint, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
              <Trash2 size={14} /> Delete event
            </button>
          )
        }
      />
      <div style={{ background: COLORS.indigoSoft, border: `1px solid ${COLORS.indigoBorder}`, borderRadius: 16, padding: 20, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.5, textTransform: "uppercase" }}>
          <CalendarDays size={13} /> Event
        </div>
        <div style={{ fontSize: 21, fontWeight: 900, color: COLORS.text, marginTop: 4 }}>
          {canEdit ? <EditableInput value={event.title} onChange={(v) => onPatch({ title: v })} placeholder="Event name" style={{ fontSize: 21, fontWeight: 900, color: COLORS.text }} /> : event.title || "Untitled event"}
        </div>
      </div>

      <Details item={event} canEdit={canEdit} onPatch={onPatch} whereKey="location" noteKey="note" dateField title="Event details" placeholders={{ date: "Oct 16, 2026", where: "Auditorium" }} />

      <Section title="People" hint="Mentors and community members on this event.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {people.map((m) => (
            <PersonCard key={m.id} mentor={m} statuses={statuses} onOpen={() => onOpenMentor(m.id)} onRemove={() => remove(m.id)} removeLabel="Remove" />
          ))}
          {!choosing && <BigButton onClick={() => setChoosing(true)} icon={Plus}>{people.length ? "Add another person" : "Add a person"}</BigButton>}
        </div>
        {choosing && <MentorChooser mentors={mentors} cohortYear={null} excludeIds={ids} action={`Add to ${event.title || "event"}`} onPick={pick} onNew={addNew} onClose={() => setChoosing(false)} />}
      </Section>
    </div>
  );
}

/* ---------- Details card (shared) ---------- */
function Details({ item, canEdit, onPatch, whereKey, noteKey, dateField, title, placeholders = {} }) {
  const where = item[whereKey];
  const note = item[noteKey];
  return (
    <Section title={title} hint={canEdit ? "Only you can change these." : null}>
      <div style={{ display: "grid", gridTemplateColumns: dateField ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {dateField && (
          <Field icon={CalendarDays} label="Date">
            {canEdit ? (
              <EditableInput value={item.date} onChange={(v) => onPatch({ date: v })} placeholder={placeholders.date || "Oct 16, 2026"} style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }} />
            ) : (
              <div style={{ fontSize: 14, fontWeight: 700, color: item.date ? COLORS.text : COLORS.faint }}>{item.date || "Date to be set"}</div>
            )}
          </Field>
        )}
        <Field icon={Clock} label="When">
          {canEdit ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <EditableInput value={item.startTime} onChange={(v) => onPatch({ startTime: v })} placeholder="4:00 PM" style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, width: 92 }} />
              <span style={{ color: COLORS.faint, fontSize: 13 }}>to</span>
              <EditableInput value={item.endTime} onChange={(v) => onPatch({ endTime: v })} placeholder="5:30 PM" style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, width: 92 }} />
            </div>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: item.startTime ? COLORS.text : COLORS.faint }}>{whenText(item)}</div>
          )}
        </Field>
        <Field icon={MapPin} label="Where">
          {canEdit ? (
            <EditableInput value={where} onChange={(v) => onPatch({ [whereKey]: v })} placeholder={placeholders.where || "Room 214"} style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }} />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: where ? COLORS.text : COLORS.faint }}>{where || (whereKey === "location" ? "Place to be set" : "Room to be set")}</div>
          )}
        </Field>
      </div>
      <div style={{ background: "#f7f8fb", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.faint, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>Mentor we're looking for</div>
        {canEdit ? (
          <EditableTextarea
            value={note}
            onChange={(v) => onPatch({ [noteKey]: v })}
            placeholder="For the advancement team: the kind of person to find, their field, their experience, what they'd do with the room..."
            rows={3}
            style={{ fontSize: 13.5, color: COLORS.text, lineHeight: 1.5, background: "transparent" }}
          />
        ) : (
          <div style={{ fontSize: 13.5, color: note ? COLORS.text : COLORS.faint, lineHeight: 1.5, whiteSpace: "pre-wrap", fontStyle: note ? "normal" : "italic" }}>
            {note || "Nothing written yet about who to find."}
          </div>
        )}
      </div>
    </Section>
  );
}

/* ---------- Existing or new ---------- */
function MentorChooser({ mentors, cohortYear, excludeIds, action, onPick, onNew, onClose }) {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const q = search.trim().toLowerCase();
  const list = [...mentors]
    .filter((m) => !excludeIds.includes(m.id) && (!q || m.name.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <SegmentedTabs
          value="existing"
          onChange={(id) => { if (id === "new") onNew(); }}
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
          const mine = cohortYear ? (m.assignedLessons || []).filter((a) => a.cohortYear === cohortYear).map((a) => a.lessonNumber) : [];
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
              <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.indigo }}>{action}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- bits ---------- */
function BackRow({ onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.sub, fontWeight: 700, fontSize: 13.5, cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>
        <ArrowLeft size={15} /> Back to sessions
      </button>
      {right || null}
    </div>
  );
}

function PersonCard({ mentor, statuses, onOpen, onRemove, removeLabel, extra }) {
  const status = statuses.find((s) => s.id === mentor.status) || statuses[0];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 14, padding: "12px 14px", flexWrap: "wrap" }}>
      <Avatar name={mentor.name} size={40} />
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{mentor.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, fontSize: 12.5, fontWeight: 700 }}>
          <span style={{ color: status.color, background: status.soft, border: `1px solid ${status.border}`, borderRadius: 999, padding: "2px 9px" }}>{status.label}</span>
          {mentor.years && <span style={{ color: COLORS.text }}>{mentor.years}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <SmallButton onClick={onOpen} icon={ExternalLink}>Open profile</SmallButton>
        {extra}
        <SmallButton onClick={onRemove} tone="quiet" icon={X}>{removeLabel}</SmallButton>
      </div>
    </div>
  );
}

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
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 800, color: COLORS.faint, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>
        <Icon size={12} /> {label}
      </div>
      {children}
    </div>
  );
}

function BigButton({ onClick, icon: Icon, children }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 13.5, borderRadius: 999, padding: "9px 16px", cursor: "pointer", alignSelf: "flex-start", fontFamily: "inherit" }}>
      {Icon && <Icon size={15} />} {children}
    </button>
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
