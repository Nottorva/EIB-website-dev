// "Export as MD": a Markdown file a student drops into a Claude project (or
// any prompt) to keep working on their venture. For each lesson it is the
// AI instructions the super admin wrote in the Lesson Editor, followed by
// that student's own answers to the lesson's deliverables. One lesson, or
// every lesson the student can see, in lesson order.

import { fmtLongDateYear } from "../format";

const isUrl = (v) => /^https?:\/\/\S+$/i.test(String(v || "").trim());
const cell = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
const EMPTY = "_Not completed yet._";

// A student's answer to one deliverable, as Markdown.
export function answerMd(d, payload) {
  if (d.type === "text") return String(payload?.text || "").trim() || EMPTY;
  if (d.type === "link") return isUrl(payload?.url) ? String(payload.url).trim() : EMPTY;
  if (d.type === "checklist") {
    if (!d.checklistItems.length) return EMPTY;
    const done = new Set((payload?.items || []).filter((i) => i.checked).map((i) => i.label));
    return d.checklistItems.map((label) => `- [${done.has(label) ? "x" : " "}] ${label}`).join("\n");
  }
  if (d.type === "table") {
    const columns = payload?.columns?.length ? payload.columns : d.columns;
    const labels = payload?.rowLabels?.length ? payload.rowLabels : d.rowLabels;
    const rows = (payload?.rows || []).map((r, i) => ({ label: labels[i] || "", cells: columns.map((_, c) => r[c] || "") })).filter((r) => r.cells.some((c) => String(c).trim()));
    if (!rows.length || !columns.length) return EMPTY;
    const lead = labels.length ? [""] : [];
    const line = (cells) => `| ${cells.map(cell).join(" | ")} |`;
    return [line([...lead, ...columns]), line([...lead, ...columns].map(() => "---")), ...rows.map((r) => line([...(labels.length ? [r.label] : []), ...r.cells]))].join("\n");
  }
  return EMPTY;
}

// AI instructions may carry inline deliverables, written on the AIDA page as
// {{deliverable:ID|Label}}. Each becomes that student's answer, in place. The
// deliverable can belong to any lesson in `allLessons`.
export const INLINE_TOKEN = /\{\{deliverable:([^|}\s]+)(?:\|[^}]*)?\}\}/g;
export function findDeliverable(allLessons, deliverableId) {
  for (const lesson of allLessons) {
    const deliverable = lesson.deliverables.find((d) => d.id === deliverableId);
    if (deliverable) return { lesson, deliverable };
  }
  return null;
}
export function resolveInline(text, allLessons, payloadOf) {
  return String(text || "").replace(INLINE_TOKEN, (_, id) => {
    const hit = findDeliverable(allLessons, id);
    if (!hit) return "";
    return `
[The student's answer to "${hit.deliverable.title}" (Lesson ${hit.lesson.number})]
${answerMd(hit.deliverable, payloadOf(hit.lesson.id, id))}
[End of answer]
`;
  });
}

const lessonName = (lesson) => `Lesson ${lesson.number}: ${lesson.title}`;

// One lesson's section. `payloads` maps deliverableId -> the student's payload.
export function lessonMarkdown(lesson, payloads = {}, inline = (t) => t) {
  const out = [`## ${lessonName(lesson)}`, ""];
  const instructions = inline(String(lesson.aiInstructions || "")).trim();
  if (instructions) out.push(instructions, "");
  if (lesson.deliverables.length) {
    out.push(`### My work for Lesson ${lesson.number}`, "");
    for (const d of lesson.deliverables) {
      out.push(`#### ${d.title}`, "");
      if (d.instructions.trim()) out.push(`*The task:* ${d.instructions.trim()}`, "");
      out.push("**My answer:**", "", answerMd(d, payloads[d.id]), "");
    }
  }
  return out.join("\n");
}

// The whole file: a short header, then each lesson's section. Lessons with
// neither instructions nor deliverables are left out.
export function exportMarkdown({ user, lessons, submissions, cohortYear, allLessons = lessons }) {
  const byLesson = {};
  for (const s of submissions) (byLesson[s.lessonId] ||= {})[s.deliverableId] = s.payload;
  const inline = (text) => resolveInline(text, allLessons, (lessonId, deliverableId) => byLesson[lessonId]?.[deliverableId]);
  const sections = lessons.filter((l) => String(l.aiInstructions || "").trim() || l.deliverables.length).map((l) => lessonMarkdown(l, byLesson[l.id], inline));
  const head = [
    `# EIB venture context: ${user.name}`,
    "",
    `Exported from the EIB platform on ${fmtLongDateYear(new Date())}${cohortYear ? ` (cohort ${cohortYear})` : ""}.`,
    "",
    lessons.length === 1
      ? `This file covers ${lessonName(lessons[0])}: the instructions for that lesson, followed by my own work on it.`
      : "This file goes lesson by lesson: the instructions for each lesson, followed by my own work on it. Together they describe the venture I am building in EIB (Entrepreneurship, Innovation & Business).",
    "",
  ];
  return [...head, sections.join("\n---\n\n")].join("\n").trimEnd() + "\n";
}

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
export const exportFileName = (lessons, one) => (one ? `EIB-lesson-${slug(lessons[0].number)}-${slug(lessons[0].title) || "export"}.md` : "EIB-venture-context.md");
