"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, Eye, Presentation, UserCheck, FileText, Trash2, Plus, Pencil, ExternalLink } from "lucide-react";
import {
  COLORS,
  DELIVERABLE_TYPES,
  EditableInput,
  Pill,
  ModalShell,
  HeaderButton,
  FieldLabel,
  SectionLabel,
  fieldStyle,
  Notice,
  SaveIndicator,
  Loading,
  TypeChip,
  nextId,
} from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";
import { DeliverablePreview, DeliverableInput, ExampleBlock } from "./DeliverableInputs";

/* ---------- Link field (shared by the three resource modals) ---------- */
function LinkField({ label, link, onChange, placeholder, hint }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input value={link} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={fieldStyle} />
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#fff", background: COLORS.indigo, fontWeight: 700, textDecoration: "none", borderRadius: 12, padding: "12px 16px", whiteSpace: "nowrap" }}
          >
            Open <ExternalLink size={14} />
          </a>
        )}
      </div>
      {hint && <div style={{ fontSize: 13, color: COLORS.faint, marginTop: 8, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

/* ---------- Slides modal (link) ---------- */
function SlidesModal({ eyebrow, lesson, onPatch, onClose }) {
  return (
    <ModalShell eyebrow={`${eyebrow} · Slides`} title={lesson.title} onClose={onClose} maxWidth={620}>
      <LinkField
        label="Slides link"
        link={lesson.slidesLink}
        onChange={(v) => onPatch({ slidesLink: v })}
        placeholder="https://docs.google.com/presentation/..."
        hint='Students and leaders open this from the "Slides" button on the lesson card.'
      />
    </ModalShell>
  );
}

/* ---------- Teaching plan modal (link, leaders only) ---------- */
function TeachingPlanModal({ eyebrow, lesson, onPatch, onClose }) {
  return (
    <ModalShell eyebrow={`${eyebrow} · Teaching Plan`} title={lesson.title} onClose={onClose} maxWidth={620}>
      <LinkField
        label="Teaching plan link"
        link={lesson.teachingPlanLink}
        onChange={(v) => onPatch({ teachingPlanLink: v })}
        placeholder="https://docs.google.com/document/..."
        hint="Only student leaders see this button. Students never receive this link."
      />
    </ModalShell>
  );
}

/* ---------- Student overview modal (link + room/time/overview text) ---------- */
function StudentOverviewModal({ eyebrow, lesson, onPatch, onClose }) {
  return (
    <ModalShell eyebrow={`${eyebrow} · Student Overview`} title={lesson.title} onClose={onClose} maxWidth={680}>
      <div style={{ marginBottom: 22 }}>
        <LinkField
          label="Student overview link"
          link={lesson.overviewLink}
          onChange={(v) => onPatch({ overviewLink: v })}
          placeholder="https://docs.google.com/document/..."
          hint='Opens from the "Student Overview" button. The fields below show on the lesson card itself.'
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <FieldLabel>Room</FieldLabel>
          <input value={lesson.room} onChange={(e) => onPatch({ room: e.target.value })} placeholder="Room 214" style={fieldStyle} />
        </div>
        <div>
          <FieldLabel>Start</FieldLabel>
          <input value={lesson.startTime} onChange={(e) => onPatch({ startTime: e.target.value })} placeholder="3:30 PM" style={fieldStyle} />
        </div>
        <div>
          <FieldLabel>End</FieldLabel>
          <input value={lesson.endTime} onChange={(e) => onPatch({ endTime: e.target.value })} placeholder="4:15 PM" style={fieldStyle} />
        </div>
      </div>
      <div>
        <FieldLabel>Short overview shown on the card</FieldLabel>
        <textarea
          value={lesson.overview}
          onChange={(e) => onPatch({ overview: e.target.value })}
          rows={3}
          placeholder="What is this session about, in two or three sentences?"
          style={{ ...fieldStyle, resize: "vertical", fontSize: 14.5 }}
        />
      </div>
      <div style={{ fontSize: 13, color: COLORS.faint, marginTop: 14, lineHeight: 1.5 }}>Student leaders can also change room and time from their Lessons view.</div>
    </ModalShell>
  );
}

/* ---------- Add / Edit Deliverable modal ---------- */
function DeliverableEditorModal({ eyebrow, initial, onSave, onDelete, onClose }) {
  const [type, setType] = useState(initial?.type || "text");
  const [title, setTitle] = useState(initial?.title || "");
  const [instructions, setInstructions] = useState(initial?.instructions || "");
  const [example, setExample] = useState(initial?.example || null);
  const [points, setPoints] = useState(initial?.points ?? 10);
  const [columnsText, setColumnsText] = useState((initial?.columns || []).join(", "));
  const [rowsText, setRowsText] = useState((initial?.rowLabels || []).join("\n"));
  const [checklistText, setChecklistText] = useState((initial?.checklistItems || []).join("\n"));
  const isEdit = Boolean(initial);

  const splitLines = (t) => t.split("\n").map((s) => s.trim()).filter(Boolean);
  const draft = {
    id: initial?.id || nextId("del"),
    type,
    title: title || "Untitled Deliverable",
    instructions,
    example,
    points: points === "" ? null : Number(points),
    columns: type === "table" ? columnsText.split(",").map((s) => s.trim()).filter(Boolean) : [],
    rowLabels: type === "table" ? splitLines(rowsText) : [],
    checklistItems: type === "checklist" ? splitLines(checklistText) : [],
  };
  const save = () => onSave(draft);

  return (
    <ModalShell
      eyebrow={`${eyebrow} · ${isEdit ? "Edit Deliverable" : "New Deliverable"}`}
      title={isEdit ? "Edit Deliverable" : "Add a Deliverable"}
      onClose={onClose}
      maxWidth={620}
      headerRight={isEdit ? <HeaderButton icon={Trash2} label="Delete" tone="danger" onClick={() => onDelete(initial.id)} /> : null}
    >
      <div style={{ marginBottom: 22 }}>
        <FieldLabel style={{ marginBottom: 10 }}>Deliverable Type</FieldLabel>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {DELIVERABLE_TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 16px",
                  borderRadius: 11,
                  fontSize: 14.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${active ? COLORS.indigo : COLORS.border}`,
                  background: active ? COLORS.indigoSoft : "#fff",
                  color: active ? COLORS.indigo : COLORS.text,
                }}
              >
                <Icon size={16} strokeWidth={2.25} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12, marginBottom: 18 }}>
        <div>
          <FieldLabel>Title</FieldLabel>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Problem Journal Entry" style={fieldStyle} />
        </div>
        <div>
          <FieldLabel>Points</FieldLabel>
          <input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} style={fieldStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <FieldLabel>Subtitle / Instructions</FieldLabel>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="What should the student do for this deliverable?"
          rows={4}
          style={{ ...fieldStyle, resize: "vertical", fontSize: 14.5 }}
        />
      </div>

      {type === "table" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
          <div>
            <FieldLabel>Table columns (comma separated)</FieldLabel>
            <input value={columnsText} onChange={(e) => setColumnsText(e.target.value)} placeholder="Who is affected, How often, Evidence" style={fieldStyle} />
            <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 6 }}>Headers across the top.</div>
          </div>
          <div>
            <FieldLabel>Table rows (one per line, optional)</FieldLabel>
            <textarea value={rowsText} onChange={(e) => setRowsText(e.target.value)} rows={3} placeholder={"Fellow students\nTeachers\nParents"} style={{ ...fieldStyle, resize: "vertical", fontSize: 14.5 }} />
            <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 6 }}>Leave empty to let students add their own rows.</div>
          </div>
        </div>
      )}

      {type === "checklist" && (
        <div style={{ marginBottom: 22 }}>
          <FieldLabel>Checklist items (one per line)</FieldLabel>
          <textarea
            value={checklistText}
            onChange={(e) => setChecklistText(e.target.value)}
            rows={4}
            placeholder={"Interviewed at least 3 people\nLogged a negative reaction"}
            style={{ ...fieldStyle, resize: "vertical", fontSize: 14.5 }}
          />
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <FieldLabel style={{ marginBottom: 0 }}>Example</FieldLabel>
          {example && (
            <button type="button" onClick={() => setExample(null)} style={{ border: "none", background: "transparent", color: COLORS.faint, fontWeight: 700, fontSize: 12.5, cursor: "pointer", padding: 0 }}>
              Clear example
            </button>
          )}
        </div>
        <div style={{ border: `1px dashed ${COLORS.indigoBorder}`, background: "#fbfbfd", borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.5, marginBottom: 12 }}>
            Fill this in exactly the way a strong student would. Once you save, this filled-in version is the example shown to students and leaders.
          </div>
          <DeliverableInput key={`${type}:${columnsText}:${rowsText}:${checklistText}`} item={draft} payload={example} onChange={setExample} uploadPurpose="example" />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        style={{
          width: "100%",
          background: COLORS.indigo,
          color: "#fff",
          border: "none",
          borderRadius: 13,
          padding: "15px",
          fontSize: 16,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {isEdit ? "Save Changes" : "Add Deliverable"}
      </button>
    </ModalShell>
  );
}

/* ---------- Deliverable card (in-lesson) ---------- */
function DeliverableCard({ item, onEdit }) {
  const [preview, setPreview] = useState(false);
  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <TypeChip type={item.type} points={item.points} uppercase />
          <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>{item.title}</div>
          <div style={{ fontSize: 14.5, color: COLORS.sub, lineHeight: 1.55 }}>{item.instructions}</div>
          {item.type === "table" && item.columns?.length > 0 && (
            <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 8 }}>
              Columns: {item.columns.join(" · ")}
              {item.rowLabels?.length > 0 ? ` · Rows: ${item.rowLabels.join(" · ")}` : " · rows added by students"}
            </div>
          )}
          {item.type === "checklist" && item.checklistItems?.length > 0 && (
            <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 8 }}>{item.checklistItems.length} checklist items</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            title="Preview as a student"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 12px",
              borderRadius: 9,
              border: `1px solid ${preview ? COLORS.indigo : COLORS.border}`,
              background: preview ? COLORS.indigoSoft : "#fff",
              cursor: "pointer",
              color: preview ? COLORS.indigo : COLORS.sub,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <Eye size={14} /> {preview ? "Hide preview" : "Preview"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: 9,
              border: `1px solid ${COLORS.border}`,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: COLORS.sub,
            }}
          >
            <Pencil size={15} />
          </button>
        </div>
      </div>

      {preview && <DeliverablePreview item={item} />}

      <ExampleBlock item={item} />
    </div>
  );
}

/* ---------- Mentor toggle ---------- */
function MentorToggle({ enabled, onToggle }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: `1px solid ${enabled ? COLORS.amberBorder : COLORS.border}`,
        background: enabled ? COLORS.amberSoft : "#fff",
        borderRadius: 12,
        padding: 4,
      }}
    >
      <button
        type="button"
        onClick={() => onToggle(false)}
        style={{
          padding: "9px 14px",
          borderRadius: 9,
          fontSize: 14.5,
          fontWeight: 700,
          cursor: "pointer",
          border: "none",
          background: enabled ? "transparent" : COLORS.indigo,
          color: enabled ? COLORS.sub : "#fff",
        }}
      >
        No Mentor
      </button>
      <button
        type="button"
        onClick={() => onToggle(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "9px 14px",
          borderRadius: 9,
          fontSize: 14.5,
          fontWeight: 700,
          cursor: "pointer",
          border: "none",
          background: enabled ? COLORS.amber : "transparent",
          color: enabled ? "#fff" : COLORS.faint,
        }}
      >
        <UserCheck size={16} strokeWidth={2.25} />
        Yes Mentor
      </button>
    </div>
  );
}

/* ---------- Lesson card ---------- */
function LessonCard({ lesson, onPatch, onDelete }) {
  const [activeModal, setActiveModal] = useState(null);
  const [editingDeliverableId, setEditingDeliverableId] = useState(null);

  const saveDeliverable = (deliverable) => {
    const exists = lesson.deliverables.some((d) => d.id === deliverable.id);
    onPatch({
      deliverables: exists ? lesson.deliverables.map((d) => (d.id === deliverable.id ? deliverable : d)) : [...lesson.deliverables, deliverable],
    });
    setActiveModal(null);
    setEditingDeliverableId(null);
  };

  const deleteDeliverable = (id) => {
    onPatch({ deliverables: lesson.deliverables.filter((d) => d.id !== id) });
    setActiveModal(null);
    setEditingDeliverableId(null);
  };

  const editingDeliverable = lesson.deliverables.find((d) => d.id === editingDeliverableId) || null;
  const eyebrow = lesson.chapterLabel || "Chapter";

  return (
    <div style={{ background: COLORS.card, borderRadius: 22, padding: "34px 36px 36px", boxShadow: "0 1px 3px rgba(15,23,42,0.05)", position: "relative" }}>
      <button
        type="button"
        onClick={onDelete}
        title="Delete lesson"
        style={{
          position: "absolute",
          top: 26,
          right: 30,
          width: 38,
          height: 38,
          borderRadius: 10,
          border: `1px solid ${COLORS.redBorder}`,
          background: COLORS.redSoft,
          color: COLORS.red,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Trash2 size={16} />
      </button>

      <div style={{ display: "flex", gap: 20, paddingRight: 50 }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            background: COLORS.indigoSoft,
            color: COLORS.indigo,
            fontWeight: 800,
            fontSize: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <EditableInput value={lesson.number} onChange={(v) => onPatch({ number: v })} style={{ textAlign: "center", fontSize: 24, fontWeight: 800, color: COLORS.indigo, width: 36 }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.indigo, marginBottom: 4 }}>
            <EditableInput value={lesson.chapterLabel} onChange={(v) => onPatch({ chapterLabel: v })} style={{ fontSize: 14, fontWeight: 800, color: COLORS.indigo }} />
          </div>
          <div style={{ fontSize: 27, fontWeight: 800, color: COLORS.text }}>
            <EditableInput value={lesson.title} onChange={(v) => onPatch({ title: v })} placeholder="Lesson title" style={{ fontSize: 27, fontWeight: 800, color: COLORS.text }} />
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginTop: 20,
          paddingTop: 20,
          paddingBottom: 24,
          borderTop: `1px solid ${COLORS.border}`,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <Pill icon={Eye} label={lesson.overviewLink ? "Student Overview · linked" : "Student Overview"} onClick={() => setActiveModal("studentOverview")} />
        <Pill icon={Presentation} label={lesson.slidesLink ? "Slides · linked" : "Slides"} onClick={() => setActiveModal("slides")} />
        <Pill icon={FileText} label={lesson.teachingPlanLink ? "Teaching Plan · linked" : "Teaching Plan"} onClick={() => setActiveModal("teachingPlan")} />
        <MentorToggle enabled={lesson.mentorEnabled} onToggle={(enabled) => onPatch({ mentorEnabled: enabled })} />
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionLabel style={{ marginBottom: 16 }}>Deliverables</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {lesson.deliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              item={d}
              onEdit={() => {
                setEditingDeliverableId(d.id);
                setActiveModal("editDeliverable");
              }}
            />
          ))}
          <button
            type="button"
            onClick={() => setActiveModal("addDeliverable")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: `1.5px dashed ${COLORS.border}`,
              borderRadius: 14,
              padding: "16px",
              background: "transparent",
              color: COLORS.indigo,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            Add Deliverable
          </button>
        </div>
      </div>

      {activeModal === "studentOverview" && <StudentOverviewModal eyebrow={eyebrow} lesson={lesson} onPatch={onPatch} onClose={() => setActiveModal(null)} />}
      {activeModal === "slides" && <SlidesModal eyebrow={eyebrow} lesson={lesson} onPatch={onPatch} onClose={() => setActiveModal(null)} />}
      {activeModal === "teachingPlan" && <TeachingPlanModal eyebrow={eyebrow} lesson={lesson} onPatch={onPatch} onClose={() => setActiveModal(null)} />}
      {activeModal === "addDeliverable" && <DeliverableEditorModal eyebrow={eyebrow} initial={null} onSave={saveDeliverable} onClose={() => setActiveModal(null)} />}
      {activeModal === "editDeliverable" && editingDeliverable && (
        <DeliverableEditorModal
          eyebrow={eyebrow}
          initial={editingDeliverable}
          onSave={saveDeliverable}
          onDelete={deleteDeliverable}
          onClose={() => {
            setActiveModal(null);
            setEditingDeliverableId(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Main page ---------- */
export default function LessonEditor({ user }) {
  const [lessons, setLessons] = useState(null);
  const [error, setError] = useState(null);
  const saver = useDebouncedSaver();

  useEffect(() => {
    api.get("/api/lessons").then(setLessons).catch((e) => setError(e.message));
  }, []);

  const patchLesson = (id, fields) => {
    const updated = { ...lessons.find((l) => l.id === id), ...fields };
    setLessons((prev) => prev.map((l) => (l.id === id ? updated : l)));
    saver.schedule(id, () => api.put(`/api/lessons/${id}`, updated));
  };

  const addLesson = () =>
    saver.immediate(async () => {
      const created = await api.post("/api/lessons", {});
      setLessons((prev) => [...prev, created]);
    });

  const deleteLesson = (id) => {
    const lesson = lessons.find((l) => l.id === id);
    if (!window.confirm(`Delete "${lesson.title}"? Student submissions for it will no longer be visible.`)) return;
    saver.immediate(async () => {
      await api.del(`/api/lessons/${id}`);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    });
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: `1px solid ${COLORS.border}`, background: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={20} color="#fff" strokeWidth={2.25} />
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>EIB Textbook</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <SaveIndicator status={saver.status} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <span style={{ fontSize: 15.5, fontWeight: 600, color: COLORS.text }}>{user.name}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "44px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
          <BookOpen size={30} color={COLORS.indigo} strokeWidth={2.25} />
          <div style={{ width: 3, height: 30, background: COLORS.text, borderRadius: 2 }} />
          <span style={{ fontSize: 34, fontWeight: 800, color: COLORS.text }}>Teaching</span>
        </div>

        {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
        {saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}

        {!lessons ? (
          <Loading />
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {lessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} onPatch={(fields) => patchLesson(lesson.id, fields)} onDelete={() => deleteLesson(lesson.id)} />
              ))}
            </div>
            <button
              type="button"
              onClick={addLesson}
              style={{
                marginTop: 24,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                border: `1.5px dashed ${COLORS.indigo}`,
                borderRadius: 22,
                padding: "26px",
                background: COLORS.indigoSoft,
                color: COLORS.indigo,
                fontSize: 17,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              <Plus size={22} strokeWidth={2.5} />
              Add Lesson
            </button>
          </>
        )}
      </div>
    </div>
  );
}
