"use client";

import React, { useEffect, useState } from "react";
import { FileText, Users, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Mail, Calendar, Link2, UserPlus, Lock, ExternalLink, Send, Pencil, Copy, Check, CalendarClock, Megaphone, ShieldOff, ShieldCheck } from "lucide-react";
import {
  COLORS,
  QUESTION_TYPES,
  fieldStyle,
  questionType,
  EditableInput,
  ModalShell,
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
  TypeChip,
  PrimaryButton,
  nextId,
} from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";
import { PayloadView } from "./DeliverableInputs";

const STATUSES = [
  { id: "pending", label: "Pending", color: COLORS.faint, soft: "#f1f3f7", border: COLORS.border },
  { id: "interview", label: "Interview", color: COLORS.indigo, soft: COLORS.indigoSoft, border: COLORS.indigoBorder },
  { id: "waitlist", label: "Waitlist", color: COLORS.amber, soft: COLORS.amberSoft, border: COLORS.amberBorder },
  { id: "approved", label: "Approved", color: COLORS.green, soft: COLORS.greenSoft, border: COLORS.greenBorder },
  { id: "denied", label: "Denied", color: COLORS.red, soft: COLORS.redSoft, border: COLORS.redBorder },
];
const statusOf = (id) => STATUSES.find((s) => s.id === id) || STATUSES[0];
const FINAL = ["approved", "waitlist", "denied"];
// A final decision the applicant has not been told about yet.
const isUnreleased = (a) => FINAL.includes(a.status) && !a.decisionReleased;
// Older applications stored a date only; newer ones a full timestamp.
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return /T/.test(String(v)) ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : d.toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
};

/* ================= Grading card ================= */
function GradeCard({ deliverable, submission, canGrade, onChange, onRelease }) {
  const grade = submission?.grade ?? "";
  const feedback = submission?.feedback ?? "";
  const released = Boolean(submission?.released);
  const hasGrade = grade !== null && grade !== undefined && grade !== "";
  const hasFeedback = feedback.trim() !== "";
  const max = deliverable.points ?? 10;
  const canRelease = canGrade && (hasGrade || hasFeedback);
  const releasedDate = submission?.releasedAt ? new Date(submission.releasedAt).toLocaleDateString() : null;

  const smallLabel = { fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 12, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <TypeChip type={deliverable.type} points={deliverable.points} />
          <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{deliverable.title}</div>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: released ? COLORS.green : COLORS.faint,
            background: released ? COLORS.greenSoft : "#f1f3f7",
            border: `1px solid ${released ? COLORS.greenBorder : COLORS.border}`,
            borderRadius: 999,
            padding: "4px 10px",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {released ? "Released to student" : "Draft · hidden from student"}
        </span>
      </div>

      <div>
        <div style={smallLabel}>Student submission</div>
        <PayloadView type={deliverable.type} payload={submission?.payload} />
      </div>

      <div style={{ background: "#f7f8fb", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0 }}>
            <div style={smallLabel}>Grade</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min={0}
                max={max}
                value={grade}
                disabled={!canGrade}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return onChange({ grade: "" });
                  const n = Math.max(0, Math.min(max, parseInt(v, 10) || 0));
                  onChange({ grade: String(n) });
                }}
                placeholder="—"
                style={{ width: 72, border: `1px solid ${hasGrade ? COLORS.indigoBorder : COLORS.border}`, background: canGrade ? "#fff" : "#f1f3f7", borderRadius: 10, padding: "9px 12px", fontSize: 16, fontWeight: 800, color: COLORS.indigo, textAlign: "right", outline: "none" }}
              />
              <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.faint }}>/ {max}</span>
            </div>
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <div style={smallLabel}>Feedback</div>
            <textarea
              value={feedback}
              disabled={!canGrade}
              onChange={(e) => onChange({ feedback: e.target.value })}
              placeholder={canGrade ? "Write feedback on this submission..." : "Grading opens once this applicant's account exists."}
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, background: canGrade ? "#fff" : "#f1f3f7", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, color: COLORS.text, lineHeight: 1.5, resize: "vertical", outline: "none" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: COLORS.sub, lineHeight: 1.5 }}>
            {released ? (
              <>Visible to the student{releasedDate ? ` since ${releasedDate}` : ""}. Edits save and show immediately.</>
            ) : canRelease ? (
              <>The student cannot see this yet. Release when you're happy with it.</>
            ) : canGrade ? (
              <>Enter a grade or feedback, then release it to the student.</>
            ) : (
              <>Grading unlocks once the applicant is approved and decisions are released.</>
            )}
          </div>
          {released ? (
            <button type="button" onClick={() => onRelease(false)} style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}>
              Withdraw from student
            </button>
          ) : (
            <PrimaryButton onClick={() => onRelease(true)} disabled={!canRelease} icon={Send} style={{ fontSize: 13, padding: "9px 14px" }}>
              Release to student
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Forms tab ================= */
function QuestionEditor({ question, index, total, onChange, onDelete, onMove }) {
  const info = questionType(question.type);
  const Icon = info.icon;
  const locked = Boolean(question.locked);

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16, display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} style={{ border: "none", background: "transparent", cursor: index === 0 ? "default" : "pointer", color: index === 0 ? "#d7dbe4" : COLORS.faint, padding: 2 }}>
          <ChevronUp size={16} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} style={{ border: "none", background: "transparent", cursor: index === total - 1 ? "default" : "pointer", color: index === total - 1 ? "#d7dbe4" : COLORS.faint, padding: 2 }}>
          <ChevronDown size={16} />
        </button>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: COLORS.indigo, background: COLORS.indigoSoft, borderRadius: 999, padding: "4px 10px" }}>
            <Icon size={13} />
            {info.label}
          </span>
          {locked ? (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: COLORS.amber, background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 999, padding: "3px 9px" }} title="Used to create the student's account on approval">
              <Lock size={11} /> Identity field
            </span>
          ) : (
            <select
              value={question.type}
              onChange={(e) => onChange({ ...question, type: e.target.value })}
              style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.sub, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 6px", background: "#fff" }}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.sub, fontWeight: 700, marginLeft: "auto" }}>
            <input type="checkbox" checked={question.required} disabled={locked} onChange={(e) => onChange({ ...question, required: e.target.checked })} />
            {question.type === "notice" ? "Must be ticked to submit" : "Required"}
          </label>
          <button type="button" onClick={onDelete} disabled={locked} style={{ border: "none", background: "transparent", color: locked ? "#d7dbe4" : COLORS.faint, cursor: locked ? "default" : "pointer", padding: 4 }}>
            <Trash2 size={16} />
          </button>
        </div>

        {question.type === "notice" ? (
          <NoticeEditor question={question} onChange={onChange} />
        ) : (
          <>
            <EditableInput value={question.label} onChange={(v) => onChange({ ...question, label: v })} placeholder="Question" style={{ fontSize: 15.5, fontWeight: 700, color: COLORS.text }} />
            <EditableInput value={question.help || ""} onChange={(v) => onChange({ ...question, help: v })} placeholder="Helper text under the question (optional)" style={{ fontSize: 13.5, color: COLORS.sub, marginTop: 2 }} />
            {question.type === "long" && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12.5, fontWeight: 700, color: COLORS.sub }}>
                Word limit
                <input
                  type="number"
                  min={0}
                  value={question.maxWords || ""}
                  onChange={(e) => onChange({ ...question, maxWords: parseInt(e.target.value, 10) || 0 })}
                  placeholder="none"
                  style={{ width: 80, fontSize: 13, fontWeight: 700, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 8px" }}
                />
              </label>
            )}
          </>
        )}

        {question.type === "choice" && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {question.options.map((opt, oi) => (
              <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: COLORS.faint, flexShrink: 0 }} />
                <EditableInput
                  value={opt}
                  onChange={(v) => {
                    const options = [...question.options];
                    options[oi] = v;
                    onChange({ ...question, options });
                  }}
                  style={{ fontSize: 14, color: COLORS.sub }}
                />
                <button type="button" onClick={() => onChange({ ...question, options: question.options.filter((_, i) => i !== oi) })} style={{ border: "none", background: "transparent", color: COLORS.faint, cursor: "pointer" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange({ ...question, options: [...question.options, "New option"] })}
              style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.indigo, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "4px 0", alignSelf: "flex-start" }}
            >
              <Plus size={14} /> Add option
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// A notice is shown to applicants the way it is edited here: the headline
// big and bold, the detail under it, and the tick-box text.
function NoticeEditor({ question, onChange }) {
  return (
    <div style={{ background: COLORS.amberSoft, border: `1px solid ${COLORS.amberBorder}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <textarea
        value={question.label}
        onChange={(e) => onChange({ ...question, label: e.target.value })}
        placeholder="The statement, shown bold. A short one is set large; a paragraph is set as bold text."
        rows={Math.min(6, Math.max(1, Math.ceil((question.label || "").length / 70)))}
        style={{ ...fieldStyle, resize: "vertical", fontSize: question.label && question.label.length > 70 ? 15 : 20, fontWeight: 800, color: COLORS.text, background: "#fff", lineHeight: 1.4 }}
      />
      <textarea
        value={question.detail || ""}
        onChange={(e) => onChange({ ...question, detail: e.target.value })}
        placeholder="Smaller text under the headline (optional)"
        rows={3}
        style={{ ...fieldStyle, resize: "vertical", fontSize: 14, background: "#fff" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>Tick-box says</span>
        <EditableInput value={question.ack ?? "I understand"} onChange={(v) => onChange({ ...question, ack: v })} placeholder="I understand" style={{ fontSize: 14, fontWeight: 800, color: COLORS.text, background: "#fff", flex: 1 }} />
      </div>
    </div>
  );
}

/* ---------- Application link + open/close window ---------- */
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "not set");

const WINDOW_STATE = {
  upcoming: { label: "Not open yet", color: COLORS.amber, soft: COLORS.amberSoft, border: COLORS.amberBorder },
  open: { label: "Live", color: COLORS.green, soft: COLORS.greenSoft, border: COLORS.greenBorder },
  closed: { label: "Closed", color: COLORS.red, soft: COLORS.redSoft, border: COLORS.redBorder },
};

function ApplicationLinkPanel({ saver }) {
  const [win, setWin] = useState(null);
  const [draft, setDraft] = useState({ opensAt: "", closesAt: "", applicantDomain: "" });
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const link = typeof window !== "undefined" ? `${window.location.origin}/apply` : "/apply";

  useEffect(() => {
    api
      .get("/api/application-window")
      .then((w) => {
        setWin(w);
        setDraft({ opensAt: toLocalInput(w.opensAt), closesAt: toLocalInput(w.closesAt), applicantDomain: w.applicantDomain });
      })
      .catch((e) => setError(e.message));
  }, []);

  const edit = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const save = () =>
    saver.immediate(async () => {
      try {
        const w = await api.put("/api/application-window", {
          opensAt: fromLocalInput(draft.opensAt),
          closesAt: fromLocalInput(draft.closesAt),
          applicantDomain: draft.applicantDomain,
        });
        setWin(w);
        setDirty(false);
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link:", link);
    }
  };

  if (error && !win) return <Notice>{error}</Notice>;
  if (!win) return <Loading />;
  const st = WINDOW_STATE[win.state];
  const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none", color: COLORS.text };
  const label = { fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>Application link</div>
        <StatusBadge status={st} size="sm" />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <input readOnly value={link} onFocus={(e) => e.target.select()} style={{ ...inputStyle, fontFamily: "ui-monospace, monospace", fontSize: 13.5, background: "#fbfbfd" }} />
        <PrimaryButton onClick={copy} icon={copied ? Check : Copy} style={{ whiteSpace: "nowrap" }}>
          {copied ? "Copied" : "Copy link"}
        </PrimaryButton>
        <a href="/apply" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 800, color: COLORS.indigo, textDecoration: "none", whiteSpace: "nowrap" }}>
          Open <ExternalLink size={13} />
        </a>
      </div>
      <div style={{ fontSize: 12.5, color: COLORS.sub, lineHeight: 1.5, marginBottom: 16 }}>
        Send this link once. It shows "not open yet" until the open time, the live form between the two times, and "closed" after. Applicants sign in with their school account, so name and email are collected automatically.
      </div>

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "end" }}>
        <div>
          <div style={label}>Opens</div>
          <input type="datetime-local" value={draft.opensAt} onChange={(e) => edit({ opensAt: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={label}>Closes</div>
          <input type="datetime-local" value={draft.closesAt} onChange={(e) => edit({ closesAt: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={label}>Applicant email domain</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.faint }}>@</span>
            <input value={draft.applicantDomain} onChange={(e) => edit({ applicantDomain: e.target.value })} placeholder="tfs.ca" style={inputStyle} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: COLORS.faint }}>
          Currently: opens {fmtWhen(win.opensAt)} · closes {fmtWhen(win.closesAt)}. Leave a field blank for no limit on that side.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setDraft({ opensAt: toLocalInput(win.opensAt), closesAt: toLocalInput(win.closesAt), applicantDomain: win.applicantDomain });
                setDirty(false);
              }}
              style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: "pointer" }}
            >
              Discard
            </button>
          )}
          <PrimaryButton onClick={save} disabled={!dirty} icon={CalendarClock} style={{ fontSize: 13, padding: "9px 14px" }}>
            Save window
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function FormsTab({ saver, user }) {
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState(null);
  const [loadingCanonical, setLoadingCanonical] = useState(false);

  const loadCanonical = async () => {
    if (!window.confirm("Replace the current form with the 2026-27 application? Every question currently in the form will be removed. Applications already submitted keep their answers.")) return;
    setLoadingCanonical(true);
    try {
      setQuestions(await api.post("/api/form/reset", {}));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingCanonical(false);
    }
  };

  useEffect(() => {
    api.get("/api/form").then(setQuestions).catch((e) => setError(e.message));
  }, []);

  const commit = (next) => {
    setQuestions(next);
    saver.schedule("form", () => api.put("/api/form", next));
  };
  const update = (id, next) => commit(questions.map((q) => (q.id === id ? next : q)));
  const remove = (id) => commit(questions.filter((q) => q.id !== id));
  const move = (index, dir) => {
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    commit(next);
  };
  const addQuestion = () => commit([...questions, { id: nextId("q"), type: "short", label: "New question", required: true, options: [] }]);
  const addNotice = () => commit([...questions, { id: nextId("q"), type: "notice", label: "Important notice", detail: "", ack: "I understand", required: true, options: [] }]);

  if (error) return <Notice>{error}</Notice>;
  if (!questions) return <Loading />;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 18, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.text }}>EIB Application 2026-27</div>
          <div style={{ fontSize: 14, color: COLORS.sub, marginTop: 4 }}>Share the link, set when it opens and closes, and edit the questions applicants answer.</div>
        </div>
        {user?.role === "superAdmin" && (
          <button
            type="button"
            onClick={loadCanonical}
            disabled={loadingCanonical}
            title="Replace the saved form with the 2026-27 application defined in code"
            style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: loadingCanonical ? "default" : "pointer" }}
          >
            {loadingCanonical ? "Loading…" : "Load the 2026-27 application"}
          </button>
        )}
      </div>

      <ApplicationLinkPanel saver={saver} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.indigoSoft, border: `1px solid ${COLORS.indigoBorder}`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, fontWeight: 700, color: COLORS.indigo }}>
        <Lock size={14} /> Name and school email come from the applicant's sign-in, so you don't need questions for them.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {questions.map((q, i) => (
          <QuestionEditor key={q.id} question={q} index={i} total={questions.length} onChange={(next) => update(q.id, next)} onDelete={() => remove(q.id)} onMove={(dir) => move(i, dir)} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={addQuestion}
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${COLORS.border}`, background: "#fff", color: COLORS.indigo, fontWeight: 800, fontSize: 14, borderRadius: 14, padding: "12px 16px", cursor: "pointer", justifyContent: "center" }}
        >
          <Plus size={16} /> Add question
        </button>
        <button
          type="button"
          onClick={addNotice}
          title="A big, bold statement applicants must tick to acknowledge (a fee, a commitment)"
          style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${COLORS.amberBorder}`, background: COLORS.amberSoft, color: COLORS.amber, fontWeight: 800, fontSize: 14, borderRadius: 14, padding: "12px 16px", cursor: "pointer", justifyContent: "center" }}
        >
          <Megaphone size={16} /> Add notice
        </button>
      </div>
    </div>
  );
}

/* ================= Students tab ================= */
function StudentRow({ student, account, onOpen, onStatusChange }) {
  const suspended = Boolean(account?.suspended);
  return (
    <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: COLORS.card, border: `1px solid ${suspended ? COLORS.redBorder : COLORS.border}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer" }}>
        <Avatar name={student.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{student.name}</div>
        <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 2 }}>
          Submitted {fmtDate(student.submittedAt)}
          {suspended ? (
            <span style={{ color: COLORS.red, fontWeight: 800 }}> · account suspended</span>
          ) : student.studentId ? (
            " · has account"
          ) : isUnreleased(student) ? (
            <span style={{ color: COLORS.amber, fontWeight: 800 }}> · decision not released</span>
          ) : student.decisionReleased ? (
            " · decision released"
          ) : (
            ""
          )}
        </div>
      </div>
      <StatusDropdown value={student.status} onChange={onStatusChange} statuses={STATUSES} />
    </div>
  );
}

function DeliverablesPanel({ student, lessons, saver }) {
  const [subs, setSubs] = useState(null);
  const [error, setError] = useState(null);
  const studentId = student.studentId;

  useEffect(() => {
    if (!studentId) {
      setSubs({});
      return;
    }
    api
      .get(`/api/submissions?studentId=${encodeURIComponent(studentId)}`)
      .then((list) => {
        const map = {};
        for (const s of list) map[`${s.lessonId}:${s.deliverableId}`] = s;
        setSubs(map);
      })
      .catch((e) => setError(e.message));
  }, [studentId]);

  const change = (lesson, deliverable, fields, { immediate = false } = {}) => {
    const key = `${lesson.id}:${deliverable.id}`;
    const next = { ...(subs[key] || { lessonId: lesson.id, deliverableId: deliverable.id, studentId, payload: null, grade: null, feedback: "", released: false }), ...fields };
    setSubs((prev) => ({ ...prev, [key]: next }));
    const send = async () => {
      const saved = await api.put("/api/submissions", { studentId, lessonId: lesson.id, deliverableId: deliverable.id, grade: next.grade, feedback: next.feedback, released: next.released });
      setSubs((prev) => ({ ...prev, [key]: { ...prev[key], releasedAt: saved.releasedAt, released: saved.released } }));
    };
    if (immediate) saver.immediate(send);
    else saver.schedule(key, send);
  };

  if (error) return <Notice>{error}</Notice>;
  if (!subs) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {!studentId && (
        <Notice tone="amber">
          This applicant has no student account yet, so there is nothing to grade. Set their status to <strong>Approved</strong>, then the super admin releases decisions: that creates the account, and they can sign in and submit work.
        </Notice>
      )}
      {lessons.map((lesson) => (
        <div key={lesson.id}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.indigo, textTransform: "uppercase", letterSpacing: 0.4 }}>{lesson.chapterLabel}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.text }}>{lesson.title}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lesson.deliverables.length === 0 && <div style={{ fontSize: 13.5, color: COLORS.faint, fontStyle: "italic" }}>No deliverables in this lesson.</div>}
            {lesson.deliverables.map((d) => (
              <GradeCard
                key={d.id}
                deliverable={d}
                submission={subs[`${lesson.id}:${d.id}`]}
                canGrade={Boolean(studentId)}
                onChange={(fields) => change(lesson, d, fields)}
                onRelease={(released) => change(lesson, d, { released }, { immediate: true })}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Super admin only: suspend or reinstate the student's account. */
function AccountCard({ student, account, onSuspend }) {
  const suspended = Boolean(account?.suspended);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const question = suspended
      ? `Reinstate ${student.name}'s account? They will be able to sign in again straight away.`
      : `Suspend ${student.name}'s account? They will be signed out of EIB and cannot sign back in until you reinstate them. Their work is kept.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    try {
      await onSuspend(!suspended);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: suspended ? COLORS.redSoft : COLORS.card, border: `1px solid ${suspended ? COLORS.redBorder : COLORS.border}`, borderRadius: 16, padding: "14px 18px", marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {suspended ? <ShieldOff size={18} color={COLORS.red} /> : <ShieldCheck size={18} color={COLORS.green} />}
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{suspended ? "Account suspended" : "Account active"}</div>
          <div style={{ fontSize: 12.5, color: COLORS.faint }}>
            {suspended ? `Since ${fmtDate(account.suspendedAt)} · cannot sign in` : `${student.email} can sign in and open Lessons`}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        style={{ border: `1px solid ${suspended ? COLORS.greenBorder : COLORS.redBorder}`, background: "#fff", color: suspended ? COLORS.green : COLORS.red, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
      >
        {suspended ? "Reinstate account" : "Suspend account"}
      </button>
    </div>
  );
}

function StudentDetail({ student, account, isSuperAdmin, onSuspend, questions, lessons, saver, onBack }) {
  const [view, setView] = useState("application");
  const answerFor = (qid) => student.answers.find((a) => a.questionId === qid)?.answer ?? "";

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.sub, fontWeight: 700, fontSize: 13.5, cursor: "pointer", padding: "4px 0", marginBottom: 14 }}>
        <ArrowLeft size={15} /> Back to list
      </button>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={student.name} size={48} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: COLORS.text }}>{student.name}</div>
              <StatusBadge status={statusOf(student.status)} size="sm" />
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                <Mail size={12} /> {student.email}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                <Calendar size={12} /> Submitted {fmtDate(student.submittedAt)}
              </span>
              {FINAL.includes(student.status) && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: student.decisionReleased ? COLORS.green : COLORS.amber, fontWeight: 700 }}>
                  <Megaphone size={12} /> {student.decisionReleased ? `Decision released ${fmtDate(student.releasedAt)}` : "Decision not released yet"}
                </span>
              )}
            </div>
          </div>
        </div>
        <SegmentedTabs
          value={view}
          onChange={setView}
          style={{ marginTop: 16 }}
          options={[
            { id: "application", label: "Application" },
            { id: "deliverables", label: "Deliverables" },
          ]}
        />
      </div>

      {isSuperAdmin && student.studentId && account && <AccountCard student={student} account={account} onSuspend={onSuspend} />}

      {view === "application" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {questions.map((q) => {
            const answer = answerFor(q.id);
            return (
              <div key={q.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.sub, marginBottom: 8 }}>{q.label}</div>
                {q.type === "notice" ? (
                  answer ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: COLORS.green }}>
                      <Check size={15} /> Ticked "{String(answer)}"
                    </div>
                  ) : (
                    <div style={{ fontSize: 13.5, color: COLORS.faint, fontStyle: "italic" }}>Not acknowledged</div>
                  )
                ) : q.type === "link" ? (
                  answer ? (
                    <a href={String(answer)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: COLORS.indigo, fontWeight: 700, textDecoration: "none", wordBreak: "break-all" }}>
                      <Link2 size={14} /> {String(answer)} <ExternalLink size={13} />
                    </a>
                  ) : (
                    <div style={{ fontSize: 13.5, color: COLORS.faint, fontStyle: "italic" }}>No link provided</div>
                  )
                ) : (
                  <div style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{answer || "—"}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <DeliverablesPanel student={student} lessons={lessons} saver={saver} />
      )}
    </div>
  );
}

/* ---------- Stats bar: applicants, interviews, class size vs cap ---------- */
function StatTile({ label, value, sub, tone = "indigo", children }) {
  const color = tone === "amber" ? COLORS.amber : tone === "red" ? COLORS.red : tone === "green" ? COLORS.green : COLORS.indigo;
  return (
    <div style={{ flex: "1 1 160px", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12.5, color: COLORS.sub, fontWeight: 600 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function StatsBar({ applications, cap, canEditCap, onSaveCap }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(cap));
  useEffect(() => setDraft(String(cap)), [cap]);

  const total = applications.length;
  const interviews = applications.filter((a) => a.status === "interview").length;
  const approved = applications.filter((a) => a.status === "approved").length;
  const over = approved > cap;
  const full = approved === cap;

  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n >= 1 && n !== cap) onSaveCap(n);
    else setDraft(String(cap));
  };

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <StatTile label="Applicants" value={total} sub="total received" />
      <StatTile label="Interviews" value={interviews} sub="currently at interview stage" />
      <StatTile label="Class size" value={`${approved} / ${cap}`} sub={over ? "over the cap" : full ? "class is full" : `${cap - approved} spots left`} tone={over ? "red" : full ? "amber" : "green"}>
        {canEditCap && (
          <div style={{ marginTop: 8 }}>
            {editing ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  min={1}
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") {
                      setDraft(String(cap));
                      setEditing(false);
                    }
                  }}
                  style={{ width: 70, border: `1px solid ${COLORS.indigo}`, borderRadius: 8, padding: "5px 8px", fontSize: 13.5, fontWeight: 800, outline: "none" }}
                />
                <span style={{ fontSize: 12, color: COLORS.faint }}>Enter to save</span>
              </div>
            ) : (
              <button type="button" onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: COLORS.indigo, fontWeight: 800, fontSize: 12.5, cursor: "pointer", padding: 0 }}>
                <Pencil size={12} /> Set max class size
              </button>
            )}
          </div>
        )}
        {!canEditCap && <div style={{ fontSize: 11.5, color: COLORS.faint, marginTop: 8 }}>Cap is set by the super admin.</div>}
      </StatTile>
    </div>
  );
}

/* ---------- Approve confirmation ---------- */
function ApproveModal({ student, approvedCount, cap, onConfirm, onCancel }) {
  const after = approvedCount + 1;
  const over = after > cap;
  return (
    <ModalShell eyebrow="Student Manager · Approve" title={`Approve ${student.name}?`} onClose={onCancel} maxWidth={520}>
      <div style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.6, marginBottom: 16 }}>
        This marks <strong>{student.name}</strong> as approved. Nothing happens for them yet: their student account is created, and they find out, when the super admin clicks <strong>Release decisions</strong>.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: over ? COLORS.amberSoft : COLORS.indigoSoft, border: `1px solid ${over ? COLORS.amberBorder : COLORS.indigoBorder}`, borderRadius: 12, padding: "12px 14px", marginBottom: 22, fontSize: 14, fontWeight: 700, color: over ? COLORS.amber : COLORS.indigo }}>
        <Users size={16} />
        Class size after approval: {after} / {cap}
        {over ? " · this goes over the cap" : ""}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.text, fontWeight: 800, fontSize: 14, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>
          Cancel
        </button>
        <PrimaryButton onClick={onConfirm} icon={UserPlus}>
          Mark as approved
        </PrimaryButton>
      </div>
    </ModalShell>
  );
}

/* ---------- Release decisions (super admin) ---------- */
function ReleaseModal({ pending, onConfirm, onCancel }) {
  const approved = pending.filter((a) => a.status === "approved");
  const newAccounts = approved.filter((a) => !a.studentId).length;
  const waitlist = pending.filter((a) => a.status === "waitlist").length;
  const denied = pending.filter((a) => a.status === "denied").length;
  return (
    <ModalShell eyebrow="Student Manager · Release" title={`Release ${pending.length} decision${pending.length === 1 ? "" : "s"}?`} onClose={onCancel} maxWidth={540}>
      <div style={{ fontSize: 15, color: COLORS.text, lineHeight: 1.6, marginBottom: 16 }}>
        Every applicant below will see their result the next time they sign in. Approved applicants get their student account now and can open Lessons straight away. Applicants still at Pending or Interview are not affected.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
        {[
          ["Approved", approved.length, COLORS.green, COLORS.greenSoft, COLORS.greenBorder, `${newAccounts} new account${newAccounts === 1 ? "" : "s"}`],
          ["Waitlist", waitlist, COLORS.amber, COLORS.amberSoft, COLORS.amberBorder, "told to wait"],
          ["Denied", denied, COLORS.red, COLORS.redSoft, COLORS.redBorder, "told no"],
        ].map(([label, n, color, soft, border, sub]) => (
          <div key={label} style={{ background: soft, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color }}>{n}</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color }}>{label}</div>
            <div style={{ fontSize: 11.5, color: COLORS.faint, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.text, fontWeight: 800, fontSize: 14, borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>
          Cancel
        </button>
        <PrimaryButton onClick={onConfirm} icon={Megaphone}>
          Release decisions
        </PrimaryButton>
      </div>
    </ModalShell>
  );
}

function StudentsTab({ saver, user }) {
  const [applications, setApplications] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [cap, setCap] = useState(23);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [pendingApproval, setPendingApproval] = useState(null);
  const [releasing, setReleasing] = useState(false);
  const [accounts, setAccounts] = useState({}); // student users by id (super admin only)
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const isSuperAdmin = user.role === "superAdmin";

  const loadAccounts = () =>
    isSuperAdmin
      ? api.get("/api/users?role=student").then((rows) => setAccounts(Object.fromEntries(rows.map((u) => [u.id, u]))))
      : Promise.resolve();

  useEffect(() => {
    Promise.all([api.get("/api/applications"), api.get("/api/form"), api.get("/api/lessons"), api.get("/api/settings"), loadAccounts()])
      .then(([a, q, l, s]) => {
        setApplications(a);
        setQuestions(q);
        setLessons(l);
        setCap(s.classSizeCap);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyStatus = (id, status) => {
    setApplications((prev) => prev.map((s) => (s.id === id ? { ...s, status, decisionReleased: false } : s)));
    saver.immediate(async () => {
      try {
        const saved = await api.patch(`/api/applications/${id}`, { status });
        setApplications((prev) => prev.map((s) => (s.id === id ? saved : s)));
        if (status === "approved") setInfo(`${saved.name} marked as approved. ${isSuperAdmin ? "Click Release decisions when you are ready to create accounts and tell applicants." : "The super admin releases decisions, which creates the account."}`);
      } catch (e) {
        setError(e.message);
      }
    });
  };

  const release = () =>
    saver.immediate(async () => {
      try {
        const r = await api.post("/api/applications/release");
        const [a] = await Promise.all([api.get("/api/applications"), loadAccounts()]);
        setApplications(a);
        setInfo(`Released ${r.released} decision${r.released === 1 ? "" : "s"}: ${r.approved} approved (${r.accountsCreated} new account${r.accountsCreated === 1 ? "" : "s"}), ${r.waitlisted} waitlisted, ${r.denied} denied.`);
      } catch (e) {
        setError(e.message);
      }
    });

  const suspend = async (student, suspended) => {
    try {
      const saved = await api.patch(`/api/users/${student.studentId}`, { suspended });
      setAccounts((prev) => ({ ...prev, [saved.id]: saved }));
      setInfo(suspended ? `${student.name}'s account is suspended. They can no longer sign in.` : `${student.name}'s account is active again.`);
    } catch (e) {
      setError(e.message);
    }
  };

  // Approval is the one status that creates an account, so it goes through
  // a confirmation first. Every other status applies straight away.
  const requestStatus = (student, status) => {
    if (status === "approved" && student.status !== "approved") setPendingApproval(student);
    else applyStatus(student.id, status);
  };

  const saveCap = (n) =>
    saver.immediate(async () => {
      try {
        const s = await api.patch("/api/settings", { classSizeCap: n });
        setCap(s.classSizeCap);
      } catch (e) {
        setError(e.message);
      }
    });

  const openStudent = applications?.find((s) => s.id === openId);
  const filtered = (applications || []).filter((s) => {
    if (filter !== "all" && s.status !== filter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const approvedCount = (applications || []).filter((a) => a.status === "approved").length;
  const unreleased = (applications || []).filter(isUnreleased);

  if (error) return <Notice onClose={() => setError(null)}>{error}</Notice>;
  if (!applications) return <Loading />;

  if (openStudent) {
    return (
      <StudentDetail
        student={openStudent}
        account={openStudent.studentId ? accounts[openStudent.studentId] : null}
        isSuperAdmin={isSuperAdmin}
        onSuspend={(suspended) => suspend(openStudent, suspended)}
        questions={questions}
        lessons={lessons}
        saver={saver}
        onBack={() => setOpenId(null)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {info && (
        <Notice tone="info" onClose={() => setInfo(null)}>
          {info}
        </Notice>
      )}
      <StatsBar applications={applications} cap={cap} canEditCap={isSuperAdmin} onSaveCap={saveCap} />
      {isSuperAdmin && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: unreleased.length ? COLORS.amberSoft : COLORS.card, border: `1px solid ${unreleased.length ? COLORS.amberBorder : COLORS.border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5, color: unreleased.length ? COLORS.amber : COLORS.sub, fontWeight: 700, lineHeight: 1.5 }}>
            {unreleased.length
              ? `${unreleased.length} decision${unreleased.length === 1 ? "" : "s"} not yet released. Applicants see "under review" until you release.`
              : "All decisions are released. Approved, waitlisted and denied applicants can see their result."}
          </div>
          <PrimaryButton icon={Megaphone} onClick={() => setReleasing(true)} disabled={!unreleased.length}>
            Release decisions
          </PrimaryButton>
        </div>
      )}
      {releasing && (
        <ReleaseModal
          pending={unreleased}
          onCancel={() => setReleasing(false)}
          onConfirm={() => {
            setReleasing(false);
            release();
          }}
        />
      )}
      <FilterBar filter={filter} setFilter={setFilter} statuses={STATUSES} search={search} setSearch={setSearch} />
      {pendingApproval && (
        <ApproveModal
          student={pendingApproval}
          approvedCount={approvedCount}
          cap={cap}
          onCancel={() => setPendingApproval(null)}
          onConfirm={() => {
            applyStatus(pendingApproval.id, "approved");
            setPendingApproval(null);
          }}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && <EmptyState>No students match this filter.</EmptyState>}
        {filtered.map((s) => (
          <StudentRow key={s.id} student={s} account={s.studentId ? accounts[s.studentId] : null} onOpen={() => setOpenId(s.id)} onStatusChange={(status) => requestStatus(s, status)} />
        ))}
      </div>
    </div>
  );
}

/* ================= Acc Manager tab (super admin) ================= */
function AccManagerTab({ saver }) {
  const [leaders, setLeaders] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const canCreate = name.trim() !== "" && email.trim() !== "";

  useEffect(() => {
    api.get("/api/users?role=studentLeader").then(setLeaders).catch((e) => setError(e.message));
  }, []);

  const createLeader = () => {
    if (!canCreate) return;
    saver.immediate(async () => {
      try {
        const created = await api.post("/api/users", { name: name.trim(), email: email.trim() });
        setLeaders((prev) => [...prev, created]);
        setName("");
        setEmail("");
        setError(null);
      } catch (e) {
        setError(e.message);
      }
    });
  };

  const removeLeader = (l) => {
    if (!window.confirm(`Remove ${l.name}? They will no longer be able to sign in.`)) return;
    saver.immediate(async () => {
      try {
        await api.del(`/api/users/${l.id}`);
        setLeaders((prev) => prev.filter((x) => x.id !== l.id));
      } catch (e) {
        setError(e.message);
      }
    });
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 14, outline: "none" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.text }}>Student Leaders</div>
        <div style={{ fontSize: 14, color: COLORS.sub, marginTop: 4 }}>Enter a name and email, then create the student leader. They can sign in with that Google account straight away.</div>
      </div>

      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16, marginBottom: 18, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createLeader()} placeholder="Full name" style={inputStyle} />
        </div>
        <div style={{ flex: "1 1 220px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createLeader()} placeholder="name@tfs.ca" style={inputStyle} />
        </div>
        <PrimaryButton onClick={createLeader} disabled={!canCreate} icon={UserPlus}>
          Create
        </PrimaryButton>
      </div>

      {!leaders ? (
        <Loading />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {leaders.length === 0 && <EmptyState>No student leaders yet.</EmptyState>}
          {leaders.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px" }}>
              <Avatar name={l.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{l.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, marginTop: 2 }}>
                  <Mail size={12} /> {l.email}
                </div>
              </div>
              <button type="button" onClick={() => removeLeader(l)} style={{ border: "none", background: "transparent", color: COLORS.faint, cursor: "pointer", padding: 4 }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= App ================= */
export default function StudentManager({ user }) {
  const [tab, setTab] = useState("students");
  const saver = useDebouncedSaver();
  const isSuperAdmin = user.role === "superAdmin";

  // /manager?tab=forms deep-links to a tab.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && ["forms", "students", "accmanager"].includes(wanted)) setTab(wanted);
  }, []);

  const tabs = [
    { id: "forms", label: "Forms", icon: FileText },
    { id: "students", label: "EIB Students", icon: Users },
    ...(isSuperAdmin ? [{ id: "accmanager", label: "Acc Manager", icon: UserPlus }] : []),
  ];

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", padding: "28px 20px" }}>
      <PageTitle
        title="EIB Student Manager"
        right={
          <>
            <SaveIndicator status={saver.status} />
            <SegmentedTabs value={tab} onChange={setTab} options={tabs} style={{ background: "#fff", borderRadius: 12 }} />
          </>
        }
      />
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}</div>

      {tab === "forms" ? <FormsTab saver={saver} user={user} /> : tab === "students" ? <StudentsTab saver={saver} user={user} /> : <AccManagerTab saver={saver} />}
    </div>
  );
}
