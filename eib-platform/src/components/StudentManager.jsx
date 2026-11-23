"use client";

import { useEffect, useState, useRef } from "react";
import { Users, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Mail, Calendar, Link2, UserPlus, Lock, ExternalLink, Send, Pencil, Copy, Check, CalendarClock, Megaphone, ShieldOff, ShieldCheck, Clock, ChartColumn, Table2, Signature, Upload, Download, X, CircleCheck, Circle, Award } from "lucide-react";
import { buildDays, TimeChart, DaysTable, Stat } from "./ApplicationsChart";
import {
  COLORS,
  QUESTION_TYPES,
  fieldStyle,
  questionType,
  EditableInput,
  useDangerConfirm,
  StatusBadge,
  Avatar,
  EmptyState,
  Notice,
  SaveIndicator,
  Loading,
  SegmentedTabs,
  PageTitle,
  PrimaryButton,
  nextId,
} from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";
import { fmtSmart, fmtDateTime, fmtLongDate, fmtShortDateTime } from "@/lib/format";
import { GradeCard, useGrades } from "./Grading";
import GraduationTab from "./GraduationTab";

// First come, first served: a person is in the class or on the waitlist.
// Rows from the old review process that were never accepted are not shown.
const inClass = (a) => a.status === "approved";
const onWaitlist = (a) => a.status === "waitlist" && a.fcfs === true;
const placeOf = (a) => (inClass(a) ? { label: "In the class", color: COLORS.green, soft: COLORS.greenSoft, border: COLORS.greenBorder } : { label: "Waitlist", color: COLORS.amber, soft: COLORS.amberSoft, border: COLORS.amberBorder });
// Older applications stored a date only; newer ones a full timestamp.
const fmtDate = (v) => fmtSmart(v, "—");

/* ================= Question editor (the agreement's extra questions) ================= */
function QuestionEditor({ question, index, total, onChange, onDelete, onMove, headerExtra }) {
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
          {headerExtra}
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

// A notice is shown the way it is edited here: the headline
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

/* ================= Students tab ================= */
// One person in the list: their number in the class (or in the waitlist
// line), the state of their account and agreement, and, for someone waiting,
// the super admin's button to give them a seat.
function StudentRow({ student, account, number, waiting, onOpen, onGiveSeat }) {
  const suspended = Boolean(account?.suspended);
  return (
    <div onClick={onOpen} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: COLORS.card, border: `1px solid ${suspended ? COLORS.redBorder : COLORS.border}`, borderRadius: 14, padding: "12px 16px", cursor: "pointer" }}>
      <span style={{ width: 26, textAlign: "right", fontSize: 13, fontWeight: 800, color: COLORS.faint, flexShrink: 0 }}>{number}</span>
      <Avatar name={student.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 800, color: COLORS.text }}>
          {student.name}
          {student.studentId && account && <AgreementMark agreement={account.agreement} />}
        </div>
        <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 2 }}>
          Signed up {fmtDate(student.submittedAt)}
          {waiting ? (
            ""
          ) : suspended ? (
            <span style={{ color: COLORS.red, fontWeight: 800 }}> · account suspended</span>
          ) : !student.studentId ? (
            <span style={{ color: COLORS.amber, fontWeight: 800 }}> · no account yet</span>
          ) : account ? (
            account.agreement?.status === "signed" ? <span> · <span style={{ color: COLORS.green, fontWeight: 800 }}>agreement signed</span></span>
            : account.agreement ? <span> · <span style={{ color: COLORS.amber, fontWeight: 800 }}>guardian confirmation pending</span></span>
            : <span> · <span style={{ color: COLORS.faint, fontWeight: 800 }}>agreement not started</span></span>
          ) : (
            ""
          )}
        </div>
      </div>
      {!waiting && (
        <span style={{ fontSize: 12, fontWeight: 800, color: student.paidAt ? COLORS.green : COLORS.faint, background: student.paidAt ? COLORS.greenSoft : "#f1f3f7", border: `1px solid ${student.paidAt ? COLORS.greenBorder : COLORS.border}`, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
          {student.paidAt ? "Fee paid" : "Fee not paid"}
        </span>
      )}
      {onGiveSeat && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onGiveSeat(); }} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.indigoBorder}`, background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          <UserPlus size={13} /> Give a seat
        </button>
      )}
    </div>
  );
}

function DeliverablesPanel({ student, lessons, saver }) {
  const { subs, load, sub, change } = useGrades(saver);
  const [error, setError] = useState(null);
  const studentId = student.studentId;

  useEffect(() => {
    if (!studentId) return load([]);
    api.get(`/api/submissions?studentId=${encodeURIComponent(studentId)}`).then(load).catch((e) => setError(e.message));
  }, [studentId, load]);

  if (error) return <Notice>{error}</Notice>;
  if (!subs) return <Loading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {!studentId && (
        <Notice tone="amber">
          This person is on the waitlist and has no student account yet, so there is nothing to grade. They get an account the moment a seat is theirs.
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
            {lesson.deliverables.map((d) => {
              const id = { studentId, lessonId: lesson.id, deliverableId: d.id };
              return <GradeCard key={d.id} deliverable={d} submission={sub(id)} canGrade={Boolean(studentId)} onChange={(fields) => change(id, fields)} onRelease={(released) => change(id, { released })} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Super admin only: suspend or reinstate the student's account. */
function AccountCard({ student, account, onSuspend, onAgreement }) {
  const suspended = Boolean(account?.suspended);
  const [busy, setBusy] = useState(false);
  const [confirmDanger, confirmUI] = useDangerConfirm();
  const toggle = async () => {
    const ok = suspended
      ? await confirmDanger({ title: `Reinstate ${student.name}'s account?`, body: "They will be able to sign in again straight away.", label: "Reinstate", note: "Reversible" })
      : await confirmDanger({ title: `Suspend ${student.name}'s account?`, body: "They are signed out of EIB and cannot sign back in until you reinstate them. Their work is kept.", label: "Suspend", note: "Reversible: you can reinstate later" });
    if (!ok) return;
    setBusy(true);
    try {
      await onSuspend(!suspended);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: suspended ? COLORS.redSoft : COLORS.card, border: `1px solid ${suspended ? COLORS.redBorder : COLORS.border}`, borderRadius: 16, padding: "14px 18px", marginBottom: 16, flexWrap: "wrap" }}>
      {confirmUI}
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
      <AgreementStatus account={account} onAgreement={onAgreement} />
    </div>
  );
}

// The Student Agreement line on an account card: signed (with the parent's
// details) or still pending.
function AgreementStatus({ account, onAgreement }) {
  const a = account?.agreement;
  const signed = a?.status === "signed";
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const resend = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post("/api/agreement/resend", { userId: account.id });
      onAgreement?.(r.agreement);
      setMsg({ ok: true, text: `Confirmation email sent to ${r.agreement.parentEmail}.` });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(false);
    }
  };
  // Correct a mistyped guardian address: saves it and sends a fresh link there.
  const saveEmail = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.put("/api/agreement/guardian-email", { userId: account.id, parentEmail: newEmail });
      onAgreement?.(r.agreement);
      setEditing(false);
      setMsg(r.warning ? { ok: false, text: r.warning } : { ok: true, text: `Email changed. Confirmation email sent to ${r.agreement.parentEmail}; the link sent to the old address no longer works.` });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const pill = { border: `1px solid ${COLORS.indigoBorder}`, background: COLORS.indigoSoft, color: COLORS.indigo, fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: "6px 12px", cursor: busy ? "default" : "pointer", fontFamily: "inherit" };
  const tone = signed ? COLORS.green : a ? COLORS.amber : COLORS.faint;
  const title = signed ? "Student Agreement signed" : a ? "Student Agreement: guardian confirmation pending" : "Student Agreement not started";
  const fee = a?.feeAcknowledgement;
  return (
    <div style={{ width: "100%", borderTop: `1px solid ${COLORS.border}`, paddingTop: 12, marginTop: 2, display: "flex", alignItems: "flex-start", gap: 10 }}>
      <Signature size={17} color={tone} style={{ marginTop: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 13, color: COLORS.sub, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 800, color: tone }}>{title}</span>
        {a ? (
          <>
            {signed ? <> · confirmed {fmtDate(a.confirmedAt)}</> : <> · submitted {fmtDate(a.studentSignedAt || a.acceptedAt)}{a.confirmation?.lastSentAt || a.lastSentAt ? <> · email sent {fmtDate(a.confirmation?.lastSentAt || a.lastSentAt)}</> : <> · no email sent yet</>}</>}
            {" "}· version {a.versionLabel || `v${a.version}`} · {a.signedBy === "guardian" ? <strong>signed by the parent or guardian alone</strong> : <>student signature <strong>{a.studentInitials}</strong></>}
            <br />
            {a.parentRelationship}: <strong>{a.parentName}</strong> ({a.parentInitials}) · {a.parentEmail}
            {fee ? <><br /><span style={{ color: COLORS.faint }}>Fee acknowledged at application on {fmtDate(fee.acknowledgedAt)} ("{fee.answer}")</span></> : null}
            {(a.answers || []).map((x) => (
              <span key={x.questionId}><br />{x.askedOf === "guardian" ? "Guardian" : "Student"} · {x.label.length > 90 ? `${x.label.slice(0, 90)}…` : x.label}: <strong style={{ whiteSpace: "pre-wrap" }}>{x.answer}</strong></span>
            ))}
            {!signed && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {editing ? (
                  <form onSubmit={saveEmail} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Guardian's correct email"
                      aria-label="Guardian's correct email"
                      style={{ flex: "1 1 220px", minWidth: 0, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", color: COLORS.text }}
                    />
                    <button type="submit" disabled={busy} style={pill}>{busy ? "Saving…" : "Save and send confirmation"}</button>
                    <button type="button" onClick={() => setEditing(false)} disabled={busy} style={{ ...pill, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub }}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <button type="button" onClick={resend} disabled={busy} style={pill}>
                      {busy ? "Sending…" : "Resend confirmation email"}
                    </button>
                    <button type="button" onClick={() => { setNewEmail(a.parentEmail || ""); setMsg(null); setEditing(true); }} disabled={busy} style={{ ...pill, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub }}>
                      Edit guardian's email
                    </button>
                  </>
                )}
                {msg && <span style={{ fontSize: 12.5, fontWeight: 700, color: msg.ok ? COLORS.green : COLORS.red }}>{msg.text}</span>}
              </div>
            )}
          </>
        ) : (
          <> · their lessons stay closed until they sign and their guardian confirms</>
        )}
      </div>
    </div>
  );
}

// Super admin only: remove this person completely so the email can sign up
// again from scratch. Irreversible, so it asks first.
function ResetCard({ student, onReset }) {
  const [busy, setBusy] = useState(false);
  const [confirmDanger, confirmUI] = useDangerConfirm();
  const go = async () => {
    const what = student.studentId ? "their sign-up, their student account and all their submissions" : "their sign-up";
    if (!(await confirmDanger({ title: `Delete ${student.name} completely?`, body: `${student.email}: this removes ${what}. Nothing is kept, and they can sign up again from scratch.${inClass(student) ? " Their seat goes to the first person on the waitlist, who is emailed." : ""}`, label: "Delete sign-up and account" }))) return;
    setBusy(true);
    try {
      await onReset();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 16 }}>
      {confirmUI}
      <div style={{ fontSize: 13, color: COLORS.sub }}>
        <span style={{ fontWeight: 800, color: COLORS.text }}>Remove.</span> Deletes the sign-up{student.studentId ? ", the account and their work" : ""} so this email can sign up again from scratch.{inClass(student) ? " The free seat goes to the first person on the waitlist." : ""}
      </div>
      <button type="button" onClick={go} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft, color: COLORS.red, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: busy ? "default" : "pointer" }}>
        <Trash2 size={14} /> {busy ? "Deleting…" : "Delete sign-up and account"}
      </button>
    </div>
  );
}

// The program fee on a student's page: paid or not, and the super admin's tick.
function FeeCard({ student, canEdit, onPaid }) {
  const paid = Boolean(student.paidAt);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await onPaid(!paid);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: paid ? COLORS.greenSoft : COLORS.card, border: `1px solid ${paid ? COLORS.greenBorder : COLORS.border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, color: COLORS.sub }}>
        <span style={{ fontWeight: 800, color: paid ? COLORS.green : COLORS.text }}>{paid ? "Program fee paid" : "Program fee not paid yet"}</span>
        {paid ? ` · ticked ${fmtDate(student.paidAt)}` : ""}
      </div>
      {canEdit && (
        <button type="button" onClick={toggle} disabled={busy} style={{ border: `1px solid ${paid ? COLORS.border : COLORS.greenBorder}`, background: "#fff", color: paid ? COLORS.sub : COLORS.green, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "8px 14px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}>
          {paid ? "Mark as not paid" : "Mark fee as paid"}
        </button>
      )}
    </div>
  );
}

function StudentDetail({ student, account, isSuperAdmin, onSuspend, onAgreement, onReset, onPaid, questions, lessons, saver, onBack }) {
  const [view, setView] = useState("application");
  const answerFor = (qid) => student.answers.find((a) => a.questionId === qid)?.answer ?? "";
  // sign-up is one click now; only people from the old application form have answers
  const answered = questions.filter((q) => String(answerFor(q.id)).trim() !== "");

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
              <StatusBadge status={placeOf(student)} size="sm" />
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                <Mail size={12} /> {student.email}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                <Calendar size={12} /> Signed up {fmtDate(student.submittedAt)}
              </span>
              {student.parent && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                  <UserPlus size={12} /> by their parent or guardian, {student.parent.name} ({student.parent.email})
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
            { id: "application", label: "Sign-up answers" },
            { id: "deliverables", label: "Deliverables" },
          ]}
        />
      </div>

      {isSuperAdmin && student.studentId && account && <AccountCard student={student} account={account} onSuspend={onSuspend} onAgreement={onAgreement} />}
      {inClass(student) && <FeeCard student={student} canEdit={isSuperAdmin} onPaid={onPaid} />}
      {isSuperAdmin && <ResetCard student={student} onReset={onReset} />}

      {view === "application" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {answered.length === 0 && <EmptyState>Signing up is one click, so there are no answers here. Anything you ask on the Student Agreement shows on the account card above.</EmptyState>}
          {answered.map((q) => {
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

/* ---------- Sign-up link + open/close window (super admin) ---------- */
const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const fmtWhen = (iso) => fmtDateTime(iso, "not set");

const WINDOW_STATE = {
  upcoming: { label: "Not open yet", color: COLORS.amber, soft: COLORS.amberSoft, border: COLORS.amberBorder },
  open: { label: "Live", color: COLORS.green, soft: COLORS.greenSoft, border: COLORS.greenBorder },
  closed: { label: "Closed", color: COLORS.red, soft: COLORS.redSoft, border: COLORS.redBorder },
};

function SignupLinkPanel({ saver }) {
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
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>Sign-up link</div>
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
        Send this link once. It shows "not open yet" until the open time, the sign-up form between the two times, and "closed" after. Seats go in the order people submit. Everyone signs in with their school account, so name and email are collected automatically and only that email domain can sign up.
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
          <div style={label}>School email domain</div>
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

/* ---------- Class bar: seats, waitlist, and whether class has started ---------- */
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

// A number the super admin changes in place: click the label, type, Enter.
function EditNumber({ value, min, label, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (Number.isFinite(n) && n >= min && n !== value) onSave(n);
    else setDraft(String(value));
  };
  return (
    <div style={{ marginTop: 8 }}>
      {editing ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            min={min}
            autoFocus
            aria-label={label}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(String(value));
                setEditing(false);
              }
            }}
            style={{ width: 70, border: `1px solid ${COLORS.indigo}`, borderRadius: 8, padding: "5px 8px", fontSize: 13.5, fontWeight: 800, outline: "none" }}
          />
          <span style={{ fontSize: 12, color: COLORS.faint }}>Enter to save</span>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: COLORS.indigo, fontWeight: 800, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
          <Pencil size={12} /> {label}
        </button>
      )}
    </div>
  );
}

function ClassBar({ seated, waitlisted, settings, canEdit, onSave, onStart, onHold }) {
  const { classSizeCap: cap, waitlistSpots: spots, classStarted: started } = settings;
  const over = seated > cap;
  const full = seated === cap;
  const waitFull = waitlisted >= spots;
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <StatTile label="In the class" value={`${seated} / ${cap}`} sub={over ? "over the class size" : full ? "class is full" : `${cap - seated} seat${cap - seated === 1 ? "" : "s"} left`} tone={over ? "red" : full ? "amber" : "green"}>
        {canEdit && <EditNumber value={cap} min={1} label="Set class size" onSave={(n) => onSave({ classSizeCap: n })} />}
      </StatTile>
      <StatTile label="Waitlist" value={`${waitlisted} / ${spots}`} sub={spots === 0 ? "no waitlist" : waitFull ? "waitlist is full" : `${spots - waitlisted} spot${spots - waitlisted === 1 ? "" : "s"} left`} tone={waitFull && spots > 0 ? "amber" : "indigo"}>
        {canEdit && <EditNumber value={spots} min={0} label="Set waitlist spots" onSave={(n) => onSave({ waitlistSpots: n })} />}
      </StatTile>
      <StatTile label="Class" value={started ? "Started" : "On hold"} sub={started ? "lessons are open" : "seats are held, lessons are closed"} tone={started ? "green" : "amber"}>
        {canEdit && (
          <div style={{ marginTop: 10 }}>
            {started ? (
              <button type="button" onClick={onHold} style={{ border: "none", background: "transparent", color: COLORS.faint, fontWeight: 800, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                Put the class on hold
              </button>
            ) : (
              <PrimaryButton onClick={onStart} icon={Megaphone} style={{ fontSize: 13.5, padding: "9px 14px" }}>
                Start class!
              </PrimaryButton>
            )}
          </div>
        )}
      </StatTile>
    </div>
  );
}

function StudentsTab({ saver, user }) {
  const [applications, setApplications] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [settings, setSettings] = useState({ classSizeCap: 23, waitlistSpots: 8, classStarted: true });
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [accounts, setAccounts] = useState({}); // student users by id (super admin only)
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [confirmDanger, confirmUI] = useDangerConfirm();
  const isSuperAdmin = user.role === "superAdmin";

  const loadAccounts = () =>
    isSuperAdmin
      ? api.get("/api/users?role=student").then((rows) => setAccounts(Object.fromEntries(rows.map((u) => [u.id, u]))))
      : Promise.resolve();
  const reload = async () => {
    const [a] = await Promise.all([api.get("/api/applications"), loadAccounts()]);
    setApplications(a);
  };

  useEffect(() => {
    Promise.all([api.get("/api/applications"), api.get("/api/form"), api.get("/api/lessons"), api.get("/api/settings"), loadAccounts()])
      .then(([a, q, l, s]) => {
        setApplications(a);
        setQuestions(q);
        setLessons(l);
        setSettings(s);
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const names = (people) => people.map((p) => p.name).join(", ");

  // A waitlisted person into the class, whatever the class size says.
  const giveSeat = async (student) => {
    if (!(await confirmDanger({ title: `Give ${student.name} a seat?`, body: "They move from the waitlist into the class and get their student account now, even if the class is already full. They are emailed that a seat opened up.", label: "Give a seat", note: "This skips the line" }))) return;
    saver.immediate(async () => {
      try {
        await api.patch(`/api/applications/${student.id}`, { status: "approved" });
        await reload();
        setInfo(`${student.name} is in the class and has been emailed.`);
      } catch (e) {
        setError(e.message);
      }
    });
  };

  const resetApplicant = async (student) => {
    try {
      const r = await api.del(`/api/applications/${student.id}`);
      await reload();
      setOpenId(null);
      setInfo(`${student.name} deleted: sign-up${r.removed.account ? ", account" : ""}${r.removed.submissions ? ` and ${r.removed.submissions} submission${r.removed.submissions === 1 ? "" : "s"}` : ""} removed. ${student.email} can sign up again.${r.removed.promoted?.length ? ` The free seat went to ${names(r.removed.promoted)} from the waitlist, who has been emailed.` : ""}`);
    } catch (e) {
      setError(e.message);
    }
  };
  const suspend = async (student, suspended) => {
    try {
      const saved = await api.patch(`/api/users/${student.studentId}`, { suspended });
      setAccounts((prev) => ({ ...prev, [saved.id]: saved }));
      setInfo(suspended ? `${student.name}'s account is suspended. They can no longer sign in.` : `${student.name}'s account is active again.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const setPaid = async (student, paid) => {
    try {
      const saved = await api.patch(`/api/applications/${student.id}`, { paid });
      setApplications((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    } catch (e) {
      setError(e.message);
    }
  };

  const saveSettings = (patch) =>
    saver.immediate(async () => {
      try {
        const s = await api.patch("/api/settings", patch);
        setSettings(s);
        if (s.promoted?.length) {
          await reload();
          setInfo(`${names(s.promoted)} moved from the waitlist into the class and ${s.promoted.length === 1 ? "has" : "have"} been emailed.`);
        }
      } catch (e) {
        setError(e.message);
      }
    });

  const students = (applications || []).filter(inClass);
  const waitlist = (applications || []).filter(onWaitlist);
  const hidden = (applications || []).length - students.length - waitlist.length;
  const matches = (s) => !search || s.name.toLowerCase().includes(search.toLowerCase());

  const startClass = async () => {
    if (await confirmDanger({ title: "Start class?", body: `Lessons open right away for the ${students.length} student${students.length === 1 ? "" : "s"} in the class (each one still has to sign the Student Agreement first). Anyone who gets a seat later goes straight in.`, label: "Start class", note: "You can put the class back on hold" })) saveSettings({ classStarted: true });
  };
  const holdClass = async () => {
    if (await confirmDanger({ title: "Put the class on hold?", body: "Every student's lessons close until you press Start class. They keep their seat and their work, and can still sign the Student Agreement.", label: "Put on hold", note: "Reversible" })) saveSettings({ classStarted: false });
  };

  const openStudent = applications?.find((s) => s.id === openId);

  if (error) return <Notice onClose={() => setError(null)}>{error}</Notice>;
  if (!applications) return <Loading />;

  if (openStudent) {
    return (
      <StudentDetail
        student={openStudent}
        account={openStudent.studentId ? accounts[openStudent.studentId] : null}
        isSuperAdmin={isSuperAdmin}
        onSuspend={(suspended) => suspend(openStudent, suspended)}
        onAgreement={(agreement) => setAccounts((prev) => (prev[openStudent.studentId] ? { ...prev, [openStudent.studentId]: { ...prev[openStudent.studentId], agreement } } : prev))}
        onReset={() => resetApplicant(openStudent)}
        onPaid={(paid) => setPaid(openStudent, paid)}
        questions={questions}
        lessons={lessons}
        saver={saver}
        onBack={() => setOpenId(null)}
      />
    );
  }

  const sectionTitle = { fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, margin: "18px 0 8px" };
  const shownStudents = students.filter(matches);
  const shownWaitlist = waitlist.filter(matches);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {confirmUI}
      {info && (
        <Notice tone="info" onClose={() => setInfo(null)}>
          {info}
        </Notice>
      )}
      {isSuperAdmin && <SignupLinkPanel saver={saver} />}
      <ClassBar seated={students.length} waitlisted={waitlist.length} settings={settings} canEdit={isSuperAdmin} onSave={saveSettings} onStart={startClass} onHold={holdClass} />
      <div style={{ fontSize: 12.5, color: COLORS.faint, margin: "-6px 2px 12px", lineHeight: 1.5 }}>
        First come, first served: whoever signs up while a seat is free (a student with one click, or a parent for their child) is in the class and goes straight to the Student Agreement and payment. After that, people join the waitlist; when a seat frees up, the first in line moves in and is emailed.
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name" aria-label="Search by name" style={{ ...fieldStyle, padding: "9px 12px", fontSize: 14, borderRadius: 10 }} />

      <div style={sectionTitle}>In the class · {students.length}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shownStudents.length === 0 && <EmptyState>{students.length ? "No student matches that name." : "Nobody has signed up yet."}</EmptyState>}
        {shownStudents.map((s) => (
          <StudentRow key={s.id} student={s} account={s.studentId ? accounts[s.studentId] : null} number={students.indexOf(s) + 1} onOpen={() => setOpenId(s.id)} />
        ))}
      </div>

      {(waitlist.length > 0 || settings.waitlistSpots > 0) && (
        <>
          <div style={sectionTitle}>Waitlist · {waitlist.length} of {settings.waitlistSpots}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {shownWaitlist.length === 0 && <EmptyState>{waitlist.length ? "Nobody on the waitlist matches that name." : "Nobody is waiting."}</EmptyState>}
            {shownWaitlist.map((s) => (
              <StudentRow key={s.id} student={s} account={null} number={waitlist.indexOf(s) + 1} waiting onOpen={() => setOpenId(s.id)} onGiveSeat={isSuperAdmin ? () => giveSeat(s) : null} />
            ))}
          </div>
        </>
      )}

      {hidden > 0 && (
        <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 18 }}>
          {hidden} earlier applicant{hidden === 1 ? "" : "s"} who {hidden === 1 ? "was" : "were"} not accepted {hidden === 1 ? "is" : "are"} kept on file but not listed here.
        </div>
      )}
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

  const [confirmDanger, confirmUI] = useDangerConfirm();
  const removeLeader = async (l) => {
    if (!(await confirmDanger({ title: `Remove ${l.name}?`, body: `${l.email} will no longer be able to sign in.`, label: "Remove account" }))) return;
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
      {confirmUI}
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
// Beside a student's name: green check once the agreement is signed, amber
// clock while the guardian's confirmation is pending, hollow circle before.
function AgreementMark({ agreement }) {
  const signed = agreement?.status === "signed";
  const pending = agreement && !signed;
  const title = signed ? "Student Agreement signed" : pending ? "Student Agreement: guardian confirmation pending" : "Student Agreement not signed";
  return (
    <span title={title} aria-label={title} role="img" style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      {signed ? <CircleCheck size={16} color={COLORS.green} strokeWidth={2.5} /> : pending ? <Clock size={15} color={COLORS.amber} strokeWidth={2.5} /> : <Circle size={15} color={COLORS.faint} strokeWidth={2} />}
    </span>
  );
}

/* ================= Student agreement (super admin) ================= */
// The words on the signing form's own fields. Left empty, a label or a
// statement goes back to its original wording; a helper line or the note is hidden.
const WORDING_FIELDS = [
  { key: "studentSignatureLabel", label: "Student signature: label" },
  { key: "studentSignatureHelp", label: "Student signature: line underneath", optional: true },
  { key: "readStatement", label: "Student's tick-box statement", long: true },
  { key: "guardianNote", label: "Note above the guardian's part", long: true, optional: true },
  { key: "parentSignatureLabel", label: "Guardian signature: label" },
  { key: "parentEmailLabel", label: "Guardian email: label" },
  { key: "parentEmailHelp", label: "Guardian email: line underneath", optional: true },
  { key: "relationshipLabel", label: "Relationship: label" },
  { key: "parentStatement", label: "Guardian's tick-box statement", long: true, hint: "{student} is replaced with the student's name." },
  { key: "parentOnlyStatement", label: "Guardian's tick-box statement when a parent signs up on their own", long: true, hint: "Shown to a parent who signed their child up themselves: their signature alone completes the agreement. {student} is replaced with the student's name." },
];

// The signing form: the words on every field, the relationship options, and
// the super admin's own questions. Saved a moment after each change.
function AgreementFields({ meta, saver }) {
  const [form, setForm] = useState({ wording: meta.wording, relationships: meta.relationships, questions: meta.questions });
  const commit = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    saver.schedule("agreement-form", () => api.put("/api/agreement", next));
  };
  const { wording, relationships, questions } = form;
  const setQuestions = (next) => commit({ questions: next });
  const move = (index, dir) => {
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item);
    setQuestions(next);
  };
  const add = (q) => setQuestions([...questions, { id: nextId("aq"), help: "", detail: "", ack: "I understand", required: true, options: [], maxWords: 0, askedOf: "student", ...q }]);

  const label = { fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };
  const box = { ...fieldStyle, padding: "9px 12px", fontSize: 14, borderRadius: 10 };
  const heading = { fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, margin: "22px 0 10px" };

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: COLORS.text }}>What students fill out</div>
      <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 2, lineHeight: 1.5 }}>
        The signing form under the PDF. Changes apply to everyone who signs from now on; students who have already signed are not asked again. The student's name and the dates are filled in automatically.
      </div>

      <div style={heading}>Wording of the signing fields</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {WORDING_FIELDS.map((w) => (
          <div key={w.key}>
            <div style={label}>{w.label}</div>
            {w.long ? (
              <textarea aria-label={w.label} value={wording[w.key] ?? ""} onChange={(e) => commit({ wording: { ...wording, [w.key]: e.target.value } })} rows={3} placeholder={w.optional ? "Leave empty to hide this" : "Leave empty to use the original wording"} style={{ ...box, resize: "vertical" }} />
            ) : (
              <input aria-label={w.label} value={wording[w.key] ?? ""} onChange={(e) => commit({ wording: { ...wording, [w.key]: e.target.value } })} placeholder={w.optional ? "Leave empty to hide this" : "Leave empty to use the original wording"} style={box} />
            )}
            {w.hint && <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 4 }}>{w.hint}</div>}
          </div>
        ))}
      </div>

      <div style={heading}>Relationship options</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {relationships.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: COLORS.faint, flexShrink: 0 }} />
            <EditableInput value={r} onChange={(v) => commit({ relationships: relationships.map((x, j) => (j === i ? v : x)) })} style={{ fontSize: 14, color: COLORS.sub }} />
            <button type="button" aria-label={`Remove ${r}`} onClick={() => commit({ relationships: relationships.filter((_, j) => j !== i) })} disabled={relationships.length === 1} style={{ border: "none", background: "transparent", color: relationships.length === 1 ? "#d7dbe4" : COLORS.faint, cursor: relationships.length === 1 ? "default" : "pointer" }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => commit({ relationships: [...relationships, "New option"] })} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.indigo, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: "4px 0", alignSelf: "flex-start", fontFamily: "inherit" }}>
          <Plus size={14} /> Add option
        </button>
      </div>

      <div style={heading}>Your own questions</div>
      <div style={{ fontSize: 12.5, color: COLORS.faint, marginBottom: 10, lineHeight: 1.5 }}>
        Extra fields on the signing form. A question asked of the student sits under the student's signature; one asked of the parent or guardian sits in the guardian's part. The answers show on each student's account card in EIB Students.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {questions.map((q, i) => (
          <QuestionEditor
            key={q.id}
            question={q}
            index={i}
            total={questions.length}
            onChange={(next) => setQuestions(questions.map((x) => (x.id === q.id ? next : x)))}
            onDelete={() => setQuestions(questions.filter((x) => x.id !== q.id))}
            onMove={(dir) => move(i, dir)}
            headerExtra={
              <select aria-label="Who answers this" value={q.askedOf === "guardian" ? "guardian" : "student"} onChange={(e) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, askedOf: e.target.value } : x)))} style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.sub, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "4px 6px", background: "#fff" }}>
                <option value="student">Asked of the student</option>
                <option value="guardian">Asked of the parent or guardian</option>
              </select>
            }
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" onClick={() => add({ type: "short", label: "New question" })} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${COLORS.border}`, background: "#fff", color: COLORS.indigo, fontWeight: 800, fontSize: 14, borderRadius: 14, padding: "12px 16px", cursor: "pointer", justifyContent: "center", fontFamily: "inherit" }}>
          <Plus size={16} /> Add question
        </button>
        <button type="button" onClick={() => add({ type: "notice", label: "Important notice" })} title="A bold statement that must be ticked to sign" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: `1px dashed ${COLORS.amberBorder}`, background: COLORS.amberSoft, color: COLORS.amber, fontWeight: 800, fontSize: 14, borderRadius: 14, padding: "12px 16px", cursor: "pointer", justifyContent: "center", fontFamily: "inherit" }}>
          <Megaphone size={16} /> Add notice
        </button>
      </div>
    </div>
  );
}

// Upload the PDF students must sign, decide whether signing is required,
// edit the title and intro, and edit the signing form. Replacing the PDF
// starts a new version, so everyone signs again.
// How the program fee is paid: a link to a payment page EIB already has, the
// words on the button, and a note. Students and parents see it once the
// agreement is signed.
function PaymentSettings({ meta, onSave }) {
  const [draft, setDraft] = useState({ url: meta.payment?.url || "", label: meta.payment?.label || "", note: meta.payment?.note || "" });
  const saveIfChanged = (key) => () => {
    if ((meta.payment?.[key] || "") !== draft[key]) onSave({ payment: { [key]: draft[key] } });
  };
  const label = { fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };
  const box = { ...fieldStyle, padding: "9px 12px", fontSize: 14, borderRadius: 10 };
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: COLORS.text }}>Payment</div>
      <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 2, lineHeight: 1.5 }}>
        Shown right after the agreement is signed, to the student and to a parent who signed up for them. The button opens your payment page in a new tab. When the money arrives, tick "Fee paid" on the student in EIB Students.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        <div>
          <div style={label}>Payment link</div>
          <input aria-label="Payment link" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} onBlur={saveIfChanged("url")} placeholder="https://… (leave empty for no button)" style={box} />
        </div>
        <div>
          <div style={label}>Words on the button</div>
          <input aria-label="Words on the payment button" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} onBlur={saveIfChanged("label")} placeholder="Pay the program fee" style={box} />
        </div>
        <div>
          <div style={label}>Note above the button</div>
          <textarea aria-label="Note above the payment button" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} onBlur={saveIfChanged("note")} rows={3} placeholder="For example: the amount, the deadline, and what to put in the reference field." style={{ ...box, resize: "vertical" }} />
        </div>
      </div>
    </div>
  );
}

function AgreementCard({ saver }) {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [confirmDanger, confirmUI] = useDangerConfirm();
  const [draft, setDraft] = useState({ title: "", intro: "" });
  const fileRef = useRef(null);

  useEffect(() => {
    api.get("/api/agreement").then((m) => { setMeta(m); setDraft({ title: m.title, intro: m.intro }); }).catch((e) => setError(e.message));
  }, []);

  const save = async (patch) => {
    try {
      const m = await api.put("/api/agreement", patch);
      setMeta((prev) => ({ ...prev, ...m }));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };
  const upload = async (file) => {
    if (!file) return;
    if (meta.pdf && !(await confirmDanger({ title: "Replace the agreement PDF?", body: "This starts a new version. Every student will have to read and sign the new one before their lessons open again.", label: "Replace the PDF" }))) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/agreement/pdf", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
      setMeta((prev) => ({ ...prev, ...data }));
      setInfo(`Uploaded ${data.pdf.name}. This is version ${data.version}; students sign it before their lessons open.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: "Remove the agreement PDF?", body: "Students will not be asked to sign anything until a new PDF is uploaded. Signatures already given are kept on the accounts.", label: "Remove the PDF" }))) return;
    try {
      const m = await api.del("/api/agreement/pdf");
      setMeta((prev) => ({ ...prev, ...m }));
    } catch (e) {
      setError(e.message);
    }
  };

  const label = { fontSize: 11.5, fontWeight: 800, color: COLORS.faint, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };
  const box = { ...fieldStyle, padding: "9px 12px", fontSize: 14, borderRadius: 10 };
  const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto 22px" }}>
      {confirmUI}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Signature size={18} color={COLORS.indigo} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: COLORS.text }}>Student agreement</div>
              <div style={{ fontSize: 12.5, color: COLORS.faint }}>Students read it to the end and sign (with a parent or legal guardian) before their lessons open.</div>
            </div>
          </div>
          {meta && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: COLORS.text, cursor: "pointer" }}>
              <input type="checkbox" checked={Boolean(meta.required)} onChange={(e) => save({ required: e.target.checked })} style={{ width: 16, height: 16 }} />
              Required before lessons
            </label>
          )}
        </div>
        {error && <div style={{ marginTop: 12 }}><Notice onClose={() => setError(null)}>{error}</Notice></div>}
        {info && <div style={{ marginTop: 12 }}><Notice tone="info" onClose={() => setInfo(null)}>{info}</Notice></div>}
        {!meta ? (
          <Loading />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, background: meta.pdf ? COLORS.greenSoft : COLORS.amberSoft, border: `1px solid ${meta.pdf ? COLORS.greenBorder : COLORS.amberBorder}`, borderRadius: 12, padding: "12px 14px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200, fontSize: 13.5, color: COLORS.text }}>
                {meta.pdf ? (
                  <>
                    <strong>{meta.pdf.name}</strong> · {kb(meta.pdf.size)} · version {meta.version} · uploaded {fmtDate(meta.pdf.uploadedAt)}
                  </>
                ) : (
                  <>No PDF yet. Upload the agreement to switch onboarding on.</>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {meta.pdf && (
                  <a href="/api/agreement/pdf?download=1" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: "6px 12px", textDecoration: "none" }}>
                    <Download size={13} /> Download
                  </a>
                )}
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: "6px 12px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                  <Upload size={13} /> {busy ? "Uploading…" : meta.pdf ? "Replace PDF" : "Upload PDF"}
                  <input ref={fileRef} type="file" accept="application/pdf" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} style={{ display: "none" }} />
                </label>
                {meta.pdf && (
                  <button type="button" onClick={remove} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.faint, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                    <Trash2 size={13} /> Remove
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, marginTop: 14 }}>
              <div>
                <div style={label}>Title</div>
                <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onBlur={() => draft.title !== meta.title && save({ title: draft.title })} style={box} />
              </div>
              <div>
                <div style={label}>Intro shown above the PDF</div>
                <textarea value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} onBlur={() => draft.intro !== meta.intro && save({ intro: draft.intro })} rows={3} style={{ ...box, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: COLORS.faint, marginTop: 10 }}>
              Preview what students see at <a href="/onboarding" style={{ color: COLORS.indigo, fontWeight: 700 }}>/onboarding</a>. Signatures show on each student's account card in EIB Students.
            </div>
          </>
        )}
      </div>
      {meta && <PaymentSettings meta={meta} onSave={save} />}
      {meta && <AgreementFields meta={meta} saver={saver} />}
    </div>
  );
}

/* ================= Analytics ================= */
// Applications over time (auto-extending day axis), headline numbers, and
// the unfinished applications underneath.
function AnalyticsTab({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/api/applications"), api.get("/api/applications/drafts"), api.get("/api/form"), api.get("/api/settings"), api.get("/api/apply/status")])
      .then(([applications, drafts, questions, settings, status]) => setData({ applications, drafts, questions, cap: settings.classSizeCap, opensAt: status.opensAt, closesAt: status.closesAt, state: status.state }))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div style={{ maxWidth: 720, margin: "0 auto" }}><Notice onClose={() => setError(null)}>{error}</Notice></div>;
  if (!data) return <Loading />;

  const { applications, drafts, questions, cap, opensAt, closesAt, state } = data;
  const days = buildDays({ applications, drafts, opensAt, closesAt });
  const submitted = applications.length;
  const daysOpen = Math.max(1, days.length);
  const perDay = submitted / daysOpen;
  const msLeft = closesAt ? new Date(closesAt) - Date.now() : null;
  const daysLeft = msLeft == null ? null : Math.max(0, Math.ceil(msLeft / 86400000));
  const fmtDate = (iso) => fmtLongDate(iso, null);
  const closing = state === "closed" ? "Applications closed" : state === "upcoming" ? `Opens ${fmtDate(opensAt)}` : closesAt ? `Closes ${fmtDate(closesAt)}` : "No close date set";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Stat label="Submitted" value={submitted} sub={cap ? `of ${cap} seats` : null} />
        <Stat label="Unfinished" value={drafts.length} sub="signed in, not submitted" />
        <Stat label="Per day" value={perDay >= 10 ? Math.round(perDay) : perDay.toFixed(1)} sub={`over ${daysOpen} day${daysOpen === 1 ? "" : "s"}`} />
        <Stat label={daysLeft == null || state !== "open" ? "Window" : "Days left"} value={daysLeft != null && state === "open" ? daysLeft : state === "closed" ? "Closed" : state === "upcoming" ? "Soon" : "Open"} sub={closing} />
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4 }}>Applications over time</div>
        <button type="button" onClick={() => setTable((t) => !t)} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 12.5, borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>
          {table ? <ChartColumn size={13} /> : <Table2 size={13} />} {table ? "Show charts" : "Show as table"}
        </button>
      </div>
      {table ? (
        <DaysTable days={days} />
      ) : (
        <>
          <TimeChart days={days} field="count" kind="bar" title="New applications per day" empty="No applications yet" />
          <TimeChart days={days} field="total" kind="line" title="Running total" refLine={cap ? { value: cap, label: `${cap} seats` } : null} />
        </>
      )}

      <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.indigo, letterSpacing: 0.4, marginTop: 8 }}>Unfinished applications</div>
      <UnfinishedList user={user} drafts={drafts} questions={questions} onChange={(next) => setData((d) => ({ ...d, drafts: next }))} />
    </div>
  );
}

/* ================= Unfinished applications ================= */
// People who signed in to the form and have not submitted, with what they
// typed so far. The super admin can clear one.
function UnfinishedList({ user, drafts, questions, onChange }) {
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDanger, confirmUI] = useDangerConfirm();
  const isSuperAdmin = user.role === "superAdmin";
  const setDrafts = (fn) => onChange(typeof fn === "function" ? fn(drafts) : fn);

  const answerable = questions.filter((q) => q.type !== "notice");
  const progress = (d) => {
    const filled = answerable.filter((q) => String((d.answers || []).find((a) => a.questionId === q.id)?.answer || "").trim() !== "").length;
    return { filled, total: answerable.length };
  };
  const when = (iso) => fmtShortDateTime(iso);

  // Super admin: submit the draft for them. Two clicks on the same button.
  const [armedId, setArmedId] = useState(null);
  const [info, setInfo] = useState(null);
  const submitFor = async (d) => {
    if (armedId !== d.id) {
      setArmedId(d.id);
      return;
    }
    setArmedId(null);
    try {
      const created = await api.post(`/api/applications/drafts/${d.id}/submit`);
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
      if (openId === d.id) setOpenId(null);
      setInfo(`Submitted ${created.name}'s application with what they had. It is now in EIB Students like any sign-up: in the class if a seat was free, otherwise on the waitlist.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (d) => {
    if (!(await confirmDanger({ title: `Clear ${d.name}'s unfinished application?`, body: "Their saved answers are deleted. They can still start again from the application link.", label: "Clear it" }))) return;
    try {
      await api.del(`/api/applications/drafts/${d.id}`);
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
      if (openId === d.id) setOpenId(null);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      {confirmUI}
      {error && <Notice onClose={() => setError(null)}>{error}</Notice>}
      {info && <Notice tone="info" onClose={() => setInfo(null)}>{info}</Notice>}
      <div style={{ fontSize: 12.5, color: COLORS.faint, marginBottom: 12 }}>
        Someone appears here the moment they sign in to the application form, and leaves the list when they submit. Newest activity first.
      </div>
      {!drafts ? (
        <Loading />
      ) : drafts.length === 0 ? (
        <EmptyState>Nobody has an unfinished application right now.</EmptyState>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {drafts.map((d) => {
            const p = progress(d);
            const open = openId === d.id;
            return (
              <div key={d.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
                <div onClick={() => setOpenId(open ? null : d.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}>
                  <Avatar name={d.name} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text }}>{d.name}</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 2, fontSize: 12.5, color: COLORS.faint, fontWeight: 600 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Mail size={12} /> {d.email}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} /> last seen {when(d.lastSeenAt)}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={12} /> started {when(d.startedAt)}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: p.filled ? COLORS.amber : COLORS.faint, background: p.filled ? COLORS.amberSoft : "#f1f3f7", border: `1px solid ${p.filled ? COLORS.amberBorder : COLORS.border}`, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
                    {p.filled} of {p.total} answered
                  </span>
                  {open ? <ChevronUp size={16} color={COLORS.faint} /> : <ChevronDown size={16} color={COLORS.faint} />}
                </div>
                {open && (
                  <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {answerable.map((q) => {
                      const a = String((d.answers || []).find((x) => x.questionId === q.id)?.answer || "").trim();
                      return (
                        <div key={q.id}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>{q.label}</div>
                          <div style={{ fontSize: 13.5, color: a ? COLORS.text : COLORS.faint, fontStyle: a ? "normal" : "italic", lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 2 }}>{a || "Not answered yet"}</div>
                        </div>
                      );
                    })}
                    {isSuperAdmin && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => submitFor(d)}
                            onBlur={() => setArmedId((a) => (a === d.id ? null : a))}
                            style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: armedId === d.id ? COLORS.amber : COLORS.indigo, color: "#fff", fontWeight: 800, fontSize: 13, borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit" }}
                          >
                            <Send size={14} /> {armedId === d.id ? "Click again to submit it for them" : "Submit this for them"}
                          </button>
                          <span style={{ fontSize: 12, color: COLORS.faint }}>Creates their application with what they have, as if they had pressed Submit.</span>
                        </div>
                        <button type="button" onClick={() => remove(d)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: COLORS.faint, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                          <Trash2 size={14} /> Clear this unfinished application
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StudentManager({ user }) {
  const [tab, setTab] = useState("students");
  // bumping this remounts the students tab, which drops any open student,
  // filter and search back to the plain list
  const [listKey, setListKey] = useState(0);
  const saver = useDebouncedSaver();
  const isSuperAdmin = user.role === "superAdmin";

  // /manager?tab=agreement deep-links to a tab (forms is the old name of the agreement tab).
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && ["agreement", "students", "analytics", "accmanager", "graduation"].includes(wanted)) setTab(wanted);
    if (wanted === "forms") setTab("agreement");
    if (wanted === "unfinished") setTab("analytics");
  }, []);
  // The Student Manager link in the top bar always comes back to the
  // students list, whatever tab or student was open.
  useEffect(() => {
    const onHome = (e) => {
      if (e.detail !== "/manager") return;
      setTab("students");
      setListKey((k) => k + 1);
    };
    window.addEventListener("eib:tool-home", onHome);
    return () => window.removeEventListener("eib:tool-home", onHome);
  }, []);

  const tabs = [
    ...(isSuperAdmin ? [{ id: "agreement", label: "Student agreement", icon: Signature }] : []),
    { id: "students", label: "EIB Students", icon: Users },
    // Analytics has no tab; it still opens at /manager?tab=analytics.
    ...(isSuperAdmin ? [{ id: "graduation", label: "Graduation", icon: Award }] : []),
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

      {tab === "agreement" && isSuperAdmin ? <AgreementCard saver={saver} /> : tab === "analytics" ? <AnalyticsTab key={listKey} user={user} /> : tab === "graduation" && isSuperAdmin ? <GraduationTab /> : tab === "accmanager" && isSuperAdmin ? <AccManagerTab saver={saver} /> : <StudentsTab key={listKey} saver={saver} user={user} />}
    </div>
  );
}
