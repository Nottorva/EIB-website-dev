"use client";

// Grading. Two things live here:
//   - GradeCard + useGrades: one submission's grade, feedback and release
//     state. The Student Manager's Deliverables view uses the same pair.
//   - Grading (default export): the /grading tool, which walks one
//     deliverable student by student instead of one student at a time.

import { useCallback, useEffect, useState } from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS, TypeChip, PrimaryButton, PageTitle, SaveIndicator, Notice, Loading, EmptyState, SegmentedTabs, Avatar, StatusBadge, fieldStyle, useDangerConfirm } from "./ui";
import { api, useDebouncedSaver } from "@/lib/api";
import { fmtDate, fmtSmart } from "@/lib/format";
import { PayloadView, isPayloadEmpty } from "./DeliverableInputs";

const hasMark = (sub) => (sub?.grade ?? "") !== "" || String(sub?.feedback || "").trim() !== "";

/* ================= Grading card ================= */
export function GradeCard({ deliverable, submission, canGrade, onChange, onRelease, autoFocus = false, releaseLabel = "Release to student" }) {
  const grade = submission?.grade ?? "";
  const feedback = submission?.feedback ?? "";
  const released = Boolean(submission?.released);
  const hasGrade = grade !== "";
  const max = deliverable.points ?? 10;
  const canRelease = canGrade && hasMark(submission);
  const releasedDate = submission?.releasedAt ? fmtDate(submission.releasedAt) : null;

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
                autoFocus={autoFocus}
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
              {releaseLabel}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Grade state ================= */
// Submissions held by (student, lesson, deliverable), with the one function
// that edits a grade. `id` is always { studentId, lessonId, deliverableId }.
const subKey = (id) => `${id.studentId}:${id.lessonId}:${id.deliverableId}`;

export function useGrades(saver) {
  const [subs, setSubs] = useState(null);
  const load = useCallback((list) => setSubs(Object.fromEntries(list.map((s) => [subKey(s), s]))), []);
  const sub = (id) => subs?.[subKey(id)];

  // Typing saves grade and feedback after a pause. Release and withdraw save
  // straight away, and only they send `released`, so a typing save that lands
  // late can never undo a release.
  const change = (id, fields) => {
    const key = subKey(id);
    const next = { payload: null, grade: null, feedback: "", released: false, ...id, ...subs[key], ...fields };
    setSubs((prev) => ({ ...prev, [key]: next }));
    const releasing = "released" in fields;
    const send = async () => {
      const saved = await api.put("/api/submissions", { ...id, grade: next.grade, feedback: next.feedback, ...(releasing ? { released: next.released } : {}) });
      if (releasing) setSubs((prev) => ({ ...prev, [key]: { ...prev[key], released: saved.released, releasedAt: saved.releasedAt } }));
    };
    return releasing ? saver.immediate(send) : saver.schedule(key, send);
  };

  return { subs, load, sub, change };
}

/* ================= The Grading tool ================= */
const STATES = {
  todo: { label: "To grade", color: COLORS.indigo, soft: COLORS.indigoSoft, border: COLORS.indigoBorder },
  draft: { label: "Draft", color: COLORS.amber, soft: COLORS.amberSoft, border: COLORS.amberBorder },
  released: { label: "Released", color: COLORS.green, soft: COLORS.greenSoft, border: COLORS.greenBorder },
  missing: { label: "Not submitted", color: COLORS.faint, soft: "#f1f3f7", border: COLORS.border },
};
const stateOf = (deliverable, sub) => (sub?.released ? "released" : hasMark(sub) ? "draft" : isPayloadEmpty(deliverable.type, sub?.payload) ? "missing" : "todo");
// Work that still needs something from the grader.
const isWaiting = (row) => row.state === "todo" || row.state === "draft";

const navButton = (enabled) => ({ display: "flex", alignItems: "center", border: `1px solid ${COLORS.border}`, background: "#fff", color: enabled ? COLORS.sub : "#d7dbe4", borderRadius: 9, padding: 6, cursor: enabled ? "pointer" : "default" });

export default function Grading() {
  const saver = useDebouncedSaver();
  const { subs, load, sub, change } = useGrades(saver);
  const [data, setData] = useState(null); // { students, lessons }
  const [error, setError] = useState(null);
  const [pick, setPick] = useState(null); // "lessonId:deliverableId"
  const [filter, setFilter] = useState("waiting");
  const [studentId, setStudentId] = useState(null);
  const [confirmDanger, confirmUI] = useDangerConfirm();

  useEffect(() => {
    api
      .get("/api/grading")
      .then((d) => {
        load(d.submissions);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [load]);

  const items = (data?.lessons || []).flatMap((lesson) => lesson.deliverables.map((deliverable) => ({ key: `${lesson.id}:${deliverable.id}`, lesson, deliverable })));
  const rowsFor = (it) =>
    data.students.map((student) => {
      const id = { studentId: student.id, lessonId: it.lesson.id, deliverableId: it.deliverable.id };
      return { student, id, sub: sub(id), state: stateOf(it.deliverable, sub(id)) };
    });
  const waitingIn = (it) => rowsFor(it).filter(isWaiting).length;

  // Open on the first deliverable with work waiting, then stay put: finishing
  // a deliverable must not move the page on its own.
  const item = items.find((it) => it.key === pick) || items.find((it) => waitingIn(it) > 0) || items[0];
  useEffect(() => {
    if (!pick && item) setPick(item.key);
  }, [pick, item]);

  if (error) return <div style={{ padding: "28px 20px" }}><Notice>{error}</Notice></div>;
  if (!data || !subs) return <Loading />;

  const rows = item ? rowsFor(item) : [];
  const list = filter === "all" ? rows : rows.filter(isWaiting);
  const index = Math.max(0, list.findIndex((r) => r.student.id === studentId));
  const current = list[index];
  const drafts = rows.filter((r) => r.state === "draft");
  const nextItem = items.find((it) => it.key !== item?.key && waitingIn(it) > 0);
  const totalWaiting = items.reduce((n, it) => n + waitingIn(it), 0);

  const open = (it) => {
    setPick(it.key);
    setStudentId(null);
  };
  // Release, then move on. In the waiting list the released row drops out, so
  // "next" is whoever is still waiting; in the full list it is the next row.
  const releaseAndNext = (row) => {
    const after = list[list.indexOf(row) + 1] || (filter === "all" ? row : list.find((r) => r !== row));
    change(row.id, { released: true });
    setStudentId(after ? after.student.id : null);
  };
  const releaseDrafts = async () => {
    const n = drafts.length;
    if (!(await confirmDanger({ title: `Release ${n} draft${n === 1 ? "" : "s"} for ${item.deliverable.title}?`, body: "Each of these students will see their grade and feedback straight away.", label: `Release ${n} draft${n === 1 ? "" : "s"}`, note: "Reversible: you can withdraw each one" }))) return;
    for (const r of drafts) await change(r.id, { released: true });
  };

  return (
    <div
      style={{ background: COLORS.bg, minHeight: "100%", padding: "28px 20px" }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && current && !current.sub?.released && hasMark(current.sub)) {
          e.preventDefault();
          releaseAndNext(current);
        }
      }}
    >
      {confirmUI}
      <PageTitle title="Grading" style={{ maxWidth: 1080 }} right={<><SaveIndicator status={saver.status} /><span style={{ fontSize: 13, fontWeight: 800, color: totalWaiting ? COLORS.indigo : COLORS.green }}>{totalWaiting ? `${totalWaiting} waiting in total` : "All caught up"}</span></>} />

      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}
        {!item ? (
          <EmptyState>No lessons with deliverables yet. Add them in the Lesson Editor.</EmptyState>
        ) : data.students.length === 0 ? (
          <EmptyState>No student accounts yet. They are created when decisions are released in the Student Manager.</EmptyState>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <select aria-label="Deliverable" value={item.key} onChange={(e) => open(items.find((it) => it.key === e.target.value))} style={{ ...fieldStyle, flex: "1 1 280px", width: "auto", fontWeight: 800, background: "#fff", cursor: "pointer" }}>
                {data.lessons.map((lesson) => (
                  <optgroup key={lesson.id} label={[lesson.chapterLabel, lesson.title].filter(Boolean).join(": ")}>
                    {items.filter((it) => it.lesson === lesson).map((it) => {
                      const n = waitingIn(it);
                      return <option key={it.key} value={it.key}>{it.deliverable.title}{n ? ` (${n} waiting)` : ""}</option>;
                    })}
                  </optgroup>
                ))}
              </select>
              <SegmentedTabs value={filter} onChange={setFilter} style={{ background: "#fff" }} options={[{ id: "waiting", label: `Waiting · ${rows.filter(isWaiting).length}` }, { id: "all", label: `Everyone · ${rows.length}` }]} />
              {drafts.length > 0 && (
                <button type="button" onClick={releaseDrafts} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.amberBorder}`, background: COLORS.amberSoft, color: COLORS.amber, fontWeight: 800, fontSize: 13, borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                  <Send size={14} /> Release {drafts.length} draft{drafts.length === 1 ? "" : "s"}
                </button>
              )}
            </div>

            {item.deliverable.instructions && (
              <details style={{ background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13.5, color: COLORS.sub, lineHeight: 1.55 }}>
                <summary style={{ fontWeight: 800, cursor: "pointer" }}>What students were asked</summary>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{item.deliverable.instructions}</div>
              </details>
            )}

            {!current ? (
              <EmptyState>
                Nothing is waiting on this deliverable.
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                  {nextItem && <PrimaryButton onClick={() => open(nextItem)} icon={ChevronRight}>Next: {nextItem.deliverable.title} ({waitingIn(nextItem)} waiting)</PrimaryButton>}
                  <button type="button" onClick={() => setFilter("all")} style={{ border: `1px solid ${COLORS.border}`, background: "#fff", color: COLORS.sub, fontWeight: 800, fontSize: 13.5, borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                    Show everyone
                  </button>
                </div>
              </EmptyState>
            ) : (
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", maxWidth: 320, display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.map((r) => {
                    const active = r === current;
                    return (
                      <button key={r.student.id} type="button" onClick={() => setStudentId(r.student.id)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: active ? COLORS.indigoSoft : "#fff", border: `1px solid ${active ? COLORS.indigoBorder : COLORS.border}`, borderRadius: 12, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                        <Avatar name={r.student.name} size={28} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 800, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.student.name}</span>
                        {(r.sub?.grade ?? "") !== "" && <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.sub }}>{r.sub.grade}/{item.deliverable.points ?? 10}</span>}
                        <StatusBadge status={STATES[r.state]} size="sm" />
                      </button>
                    );
                  })}
                </div>

                <div style={{ flex: "3 1 420px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <Avatar name={current.student.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: COLORS.text }}>{current.student.name}</div>
                      <div style={{ fontSize: 12.5, color: COLORS.faint }}>{current.sub?.submittedAt ? `Submitted ${fmtSmart(current.sub.submittedAt)}` : "Nothing submitted"}</div>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.faint }}>{index + 1} of {list.length}</span>
                    <button type="button" aria-label="Previous student" disabled={index === 0} onClick={() => setStudentId(list[index - 1].student.id)} style={navButton(index > 0)}><ChevronLeft size={16} /></button>
                    <button type="button" aria-label="Next student" disabled={index === list.length - 1} onClick={() => setStudentId(list[index + 1].student.id)} style={navButton(index < list.length - 1)}><ChevronRight size={16} /></button>
                  </div>
                  <GradeCard
                    key={current.student.id}
                    deliverable={item.deliverable}
                    submission={current.sub}
                    canGrade
                    autoFocus
                    releaseLabel="Release & next"
                    onChange={(fields) => change(current.id, fields)}
                    onRelease={(released) => (released ? releaseAndNext(current) : change(current.id, { released }))}
                  />
                  <div style={{ fontSize: 12.5, color: COLORS.faint, marginTop: 8 }}>Tip: type the grade, press Tab for feedback, then Ctrl+Enter to release and move to the next student.</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
