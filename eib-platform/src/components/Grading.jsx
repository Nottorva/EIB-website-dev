"use client";

// Grading. Two things live here:
//   - GradeCard + useGrades: one submission's grade, feedback and release
//     state. The Student Manager's Deliverables view uses the same pair.
//   - Grading (default export): the /grading tool. "By student" opens one
//     student's whole record, chapter by chapter; "By deliverable" walks one
//     deliverable student by student.

import { useCallback, useEffect, useState } from "react";
import { Send, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
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

  const smallLabel = { fontSize: 11.5, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 };

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, padding: 16, display: "flex", flexDirection: "column", gap: 12, background: COLORS.surface }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <TypeChip type={deliverable.type} points={deliverable.points} />
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>{deliverable.title}</div>
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: released ? COLORS.successText : COLORS.muted,
            background: released ? COLORS.successBg : COLORS.bg,
            border: `1px solid ${released ? COLORS.successBorder : COLORS.border}`,
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

      <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
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
                style={{ width: 72, border: `1px solid ${hasGrade ? COLORS.border2 : COLORS.border}`, background: canGrade ? COLORS.white : COLORS.bg, padding: "9px 12px", fontSize: 16, fontWeight: 600, color: COLORS.ink, textAlign: "right" }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.muted }}>/ {max}</span>
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
              style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${COLORS.border}`, background: canGrade ? COLORS.white : COLORS.bg, padding: "9px 12px", fontSize: 13.5, color: COLORS.ink, lineHeight: 1.5, resize: "vertical" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: COLORS.text2, lineHeight: 1.5 }}>
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
            <button type="button" onClick={() => onRelease(false)} style={{ border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.text2, fontWeight: 600, fontSize: 13, padding: "8px 14px", cursor: "pointer" }}>
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
  todo: { label: "To grade", color: COLORS.ink, soft: COLORS.bg, border: COLORS.border2 },
  draft: { label: "Draft", color: COLORS.warnText, soft: COLORS.warnBg, border: COLORS.warnBorder },
  released: { label: "Released", color: COLORS.successText, soft: COLORS.successBg, border: COLORS.successBorder },
  missing: { label: "Not submitted", color: COLORS.muted, soft: COLORS.bg, border: COLORS.border },
};
const stateOf = (deliverable, sub) => (sub?.released ? "released" : hasMark(sub) ? "draft" : isPayloadEmpty(deliverable.type, sub?.payload) ? "missing" : "todo");
// Work that still needs something from the grader.
const isWaiting = (row) => row.state === "todo" || row.state === "draft";

const navButton = (enabled) => ({ display: "flex", alignItems: "center", border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: enabled ? COLORS.text2 : COLORS.disabled, padding: 6, cursor: enabled ? "pointer" : "default" });

/* One student's whole record: click a student, then a chapter, and every
   deliverable in that chapter is there to grade in one place. */
const rowButton = { width: "100%", display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" };
const waitingBadge = (n) => (n ? <StatusBadge status={{ ...STATES.todo, label: `${n} to grade` }} size="sm" /> : null);

function ByStudent({ data, sub, change }) {
  const [openStudent, setOpenStudent] = useState(null);
  const [openChapters, setOpenChapters] = useState(() => new Set());

  const cells = (student, lesson) =>
    lesson.deliverables.map((deliverable, i) => {
      const id = { studentId: student.id, lessonId: lesson.id, deliverableId: deliverable.id };
      return { deliverable, id, sub: sub(id), state: stateOf(deliverable, sub(id)), label: `${lesson.number}${String.fromCharCode(65 + i)}` };
    });
  // Opening a student opens their first chapter with work waiting.
  const pickStudent = (student) => {
    if (openStudent === student.id) return setOpenStudent(null);
    const first = data.lessons.find((l) => cells(student, l).some(isWaiting));
    setOpenStudent(student.id);
    setOpenChapters(new Set(first ? [first.id] : []));
  };
  const toggleChapter = (id) =>
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.students.map((student) => {
        const isOpen = openStudent === student.id;
        const chapters = data.lessons.map((lesson) => ({ lesson, cells: cells(student, lesson) }));
        const all = chapters.flatMap((c) => c.cells);
        const submitted = all.filter((c) => c.state !== "missing").length;
        return (
          <div key={student.id} data-student={student.id} style={{ background: COLORS.surface, border: `1px solid ${isOpen ? COLORS.border2 : COLORS.border}` }}>
            <button type="button" aria-expanded={isOpen} onClick={() => pickStudent(student)} style={{ ...rowButton, padding: "10px 14px" }}>
              {isOpen ? <ChevronDown size={16} color={COLORS.text2} /> : <ChevronRight size={16} color={COLORS.text2} />}
              <Avatar name={student.name} size={30} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{student.name}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.muted, whiteSpace: "nowrap" }}>{submitted} of {all.length} submitted</span>
              {waitingBadge(all.filter(isWaiting).length)}
            </button>

            {isOpen && (
              <div style={{ padding: "0 14px 12px 40px", display: "flex", flexDirection: "column", gap: 4 }}>
                {chapters.map(({ lesson, cells: list }) => {
                  const chapterOpen = openChapters.has(lesson.id);
                  return (
                    <div key={lesson.id} data-chapter={lesson.id}>
                      <button type="button" aria-expanded={chapterOpen} onClick={() => toggleChapter(lesson.id)} style={{ ...rowButton, padding: "8px 6px" }}>
                        {chapterOpen ? <ChevronDown size={15} color={COLORS.text2} /> : <ChevronRight size={15} color={COLORS.text2} />}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: COLORS.ink }}>{lesson.chapterLabel || `Lesson ${lesson.number}`}</span>
                          <span style={{ display: "block", fontSize: 12.5, color: COLORS.muted }}>{lesson.title}</span>
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.muted, whiteSpace: "nowrap" }}>{list.filter((c) => c.state === "released").length} of {list.length} released</span>
                        {waitingBadge(list.filter(isWaiting).length)}
                      </button>
                      {chapterOpen && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "4px 0 10px 21px" }}>
                          {list.map((c) => (
                            <GradeCard key={c.deliverable.id} deliverable={{ ...c.deliverable, title: `${c.label} · ${c.deliverable.title}` }} submission={c.sub} canGrade onChange={(fields) => change(c.id, fields)} onRelease={(released) => change(c.id, { released })} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Grading() {
  const saver = useDebouncedSaver();
  const { subs, load, sub, change } = useGrades(saver);
  const [data, setData] = useState(null); // { students, lessons }
  const [error, setError] = useState(null);
  const [pick, setPick] = useState(null); // "lessonId:deliverableId"
  const [mode, setMode] = useState("student");
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
        if (mode === "deliverable" && e.key === "Enter" && (e.ctrlKey || e.metaKey) && current && !current.sub?.released && hasMark(current.sub)) {
          e.preventDefault();
          releaseAndNext(current);
        }
      }}
    >
      {confirmUI}
      <PageTitle title="Grading" style={{ maxWidth: 1080 }} right={<><SaveIndicator status={saver.status} /><span style={{ fontSize: 13, fontWeight: 600, color: totalWaiting ? COLORS.ink : COLORS.successText }}>{totalWaiting ? `${totalWaiting} waiting in total` : "All caught up"}</span></>} />

      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {saver.error && <Notice onClose={saver.clearError}>{saver.error}</Notice>}
        {!item ? (
          <EmptyState>No lessons with deliverables yet. Add them in the Lesson Editor.</EmptyState>
        ) : data.students.length === 0 ? (
          <EmptyState>No student accounts yet. They are created when decisions are released in the Student Manager.</EmptyState>
        ) : (
          <>
            <SegmentedTabs value={mode} onChange={setMode} style={{ background: COLORS.surface, marginBottom: 14, width: "fit-content" }} options={[{ id: "student", label: "By student" }, { id: "deliverable", label: "By deliverable" }]} />
            {mode === "student" ? <ByStudent data={data} sub={sub} change={change} /> : <>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <select aria-label="Deliverable" value={item.key} onChange={(e) => open(items.find((it) => it.key === e.target.value))} style={{ ...fieldStyle, flex: "1 1 280px", width: "auto", fontWeight: 600, background: COLORS.surface, cursor: "pointer" }}>
                {data.lessons.map((lesson) => (
                  <optgroup key={lesson.id} label={[lesson.chapterLabel, lesson.title].filter(Boolean).join(": ")}>
                    {items.filter((it) => it.lesson === lesson).map((it) => {
                      const n = waitingIn(it);
                      return <option key={it.key} value={it.key}>{it.deliverable.title}{n ? ` (${n} waiting)` : ""}</option>;
                    })}
                  </optgroup>
                ))}
              </select>
              <SegmentedTabs value={filter} onChange={setFilter} style={{ background: COLORS.surface }} options={[{ id: "waiting", label: `Waiting · ${rows.filter(isWaiting).length}` }, { id: "all", label: `Everyone · ${rows.length}` }]} />
              {drafts.length > 0 && (
                <button type="button" onClick={releaseDrafts} style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${COLORS.warnBorder}`, background: COLORS.warnBg, color: COLORS.warnText, fontWeight: 600, fontSize: 13, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit" }}>
                  <Send size={14} /> Release {drafts.length} draft{drafts.length === 1 ? "" : "s"}
                </button>
              )}
            </div>

            {item.deliverable.instructions && (
              <details style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, padding: "10px 14px", marginBottom: 14, fontSize: 13.5, color: COLORS.text2, lineHeight: 1.55 }}>
                <summary style={{ fontWeight: 600, cursor: "pointer" }}>What students were asked</summary>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{item.deliverable.instructions}</div>
              </details>
            )}

            {!current ? (
              <EmptyState>
                Nothing is waiting on this deliverable.
                <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
                  {nextItem && <PrimaryButton onClick={() => open(nextItem)} icon={ChevronRight}>Next: {nextItem.deliverable.title} ({waitingIn(nextItem)} waiting)</PrimaryButton>}
                  <button type="button" onClick={() => setFilter("all")} style={{ border: `1px solid ${COLORS.border}`, background: COLORS.surface, color: COLORS.text2, fontWeight: 600, fontSize: 13.5, padding: "9px 14px", cursor: "pointer", fontFamily: "inherit" }}>
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
                      <button key={r.student.id} type="button" onClick={() => setStudentId(r.student.id)} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: active ? COLORS.bg : COLORS.white, border: `1px solid ${active ? COLORS.border2 : COLORS.border}`, padding: "8px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                        <Avatar name={r.student.name} size={28} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: COLORS.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.student.name}</span>
                        {(r.sub?.grade ?? "") !== "" && <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.text2 }}>{r.sub.grade}/{item.deliverable.points ?? 10}</span>}
                        <StatusBadge status={STATES[r.state]} size="sm" />
                      </button>
                    );
                  })}
                </div>

                <div style={{ flex: "3 1 420px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <Avatar name={current.student.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 600, color: COLORS.ink }}>{current.student.name}</div>
                      <div style={{ fontSize: 12.5, color: COLORS.muted }}>{current.sub?.submittedAt ? `Submitted ${fmtSmart(current.sub.submittedAt)}` : "Nothing submitted"}</div>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.muted }}>{index + 1} of {list.length}</span>
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
                  <div style={{ fontSize: 12.5, color: COLORS.muted, marginTop: 8 }}>Tip: type the grade, press Tab for feedback, then Ctrl+Enter to release and move to the next student.</div>
                </div>
              </div>
            )}
            </>}
          </>
        )}
      </div>
    </div>
  );
}
