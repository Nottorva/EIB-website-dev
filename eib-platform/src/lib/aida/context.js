// What AIDA is given on each request, in two parts:
//
//   shared   the core prompt, the general context and the program outline. The same for every student,
//            so Anthropic caches it once for the whole class.
//   context  one lesson for one student: the lesson's AI instructions (inline deliverables filled in with
//            that student's answers), the lesson's own deliverables with the student's answers, and any
//            deliverables from other lessons the super admin linked on the AIDA page.
//
// Nothing here names the student. `parts` maps every deliverable AIDA was shown to the answer text it
// saw, so a later message can send only what the student has changed since (see store.js).

import { createHash } from "node:crypto";
import { answerMd, resolveInline, findDeliverable, INLINE_TOKEN } from "../data/exportMd";
import { DEFAULT_PROMPT } from "./prompt";

export const hash = (text) => createHash("sha1").update(String(text)).digest("hex").slice(0, 16);
const partKey = (lessonId, deliverableId) => `${lessonId}:${deliverableId}`;

export function sharedText({ settings, lessons }) {
  const prompt = String(settings?.prompt || "").trim() || DEFAULT_PROMPT;
  const general = String(settings?.general || "").trim();
  const outline = lessons.map((l) => `Lesson ${l.number}: ${l.title}`).join("\n");
  return [prompt, general ? `GENERAL CONTEXT FROM THE EIB TEAM\n\n${general}` : "", outline ? `<program_outline>\n${outline}\n</program_outline>` : ""].filter(Boolean).join("\n\n");
}

const TYPE_NOTE = { text: "written answer", link: "a link; you cannot open it", table: "table", checklist: "checklist" };

function deliverableBlock(lesson, d, payload, { withLesson = false } = {}) {
  const out = [`### ${d.title}${withLesson ? ` (Lesson ${lesson.number}: ${lesson.title})` : ""} [${TYPE_NOTE[d.type] || d.type}]`];
  if (d.instructions.trim()) out.push(`The task: ${d.instructions.trim()}`);
  out.push("The student's current answer:", answerMd(d, payload));
  return out.join("\n");
}

/**
 * The context for one lesson and one student's payloads.
 * `payloads` maps "lessonId:deliverableId" to the stored payload (missing = not started).
 */
export function buildContext({ lesson, lessons, payloads = {} }) {
  const parts = {};
  const payloadOf = (lessonId, deliverableId) => payloads[partKey(lessonId, deliverableId)];
  const note = (l, d) => { parts[partKey(l.id, d.id)] = answerMd(d, payloadOf(l.id, d.id)); };

  for (const m of String(lesson.aiInstructions || "").matchAll(INLINE_TOKEN)) {
    const hit = findDeliverable(lessons, m[1]);
    if (hit) note(hit.lesson, hit.deliverable);
  }
  const instructions = resolveInline(lesson.aiInstructions, lessons, payloadOf).trim();

  const own = lesson.deliverables.map((d) => { note(lesson, d); return deliverableBlock(lesson, d, payloadOf(lesson.id, d.id)); });

  const linked = [];
  for (const link of lesson.aidaLinks || []) {
    const from = lessons.find((l) => l.id === link.lessonId);
    const d = from?.deliverables.find((x) => x.id === link.deliverableId);
    if (!d || (from.id === lesson.id)) continue;
    note(from, d);
    linked.push(deliverableBlock(from, d, payloadOf(from.id, d.id), { withLesson: true }));
  }

  const text = [
    `<current_lesson>\nLesson ${lesson.number}: ${lesson.title}`,
    String(lesson.overview || "").trim() ? `What the lesson is about: ${lesson.overview.trim()}` : "",
    instructions ? `<instructions_for_this_lesson>\n${instructions}\n</instructions_for_this_lesson>` : "",
    own.length ? `<deliverables_for_this_lesson>\n${own.join("\n\n")}\n</deliverables_for_this_lesson>` : "This lesson has no deliverables.",
    "</current_lesson>",
    linked.length ? `<student_work_from_other_lessons>\n${linked.join("\n\n")}\n</student_work_from_other_lessons>` : "",
  ].filter(Boolean).join("\n\n");

  return { text, parts };
}

/** Changes when the lesson's instructions, deliverables or links change (not when the student's answers do). */
export const contextKey = ({ lesson, lessons }) => hash(buildContext({ lesson, lessons }).text);

/** The deliverables whose answer text differs from what AIDA last saw, as a block for the next message. */
export function changedWork({ parts, sent = {}, lessons }) {
  const blocks = [];
  for (const [key, text] of Object.entries(parts)) {
    if (sent[key] === hash(text)) continue;
    const [lessonId, deliverableId] = key.split(":");
    const l = lessons.find((x) => x.id === lessonId);
    const d = l?.deliverables.find((x) => x.id === deliverableId);
    if (d) blocks.push(`### ${d.title} (Lesson ${l.number})\n${text}`);
  }
  return blocks.length ? `<updated_work note="The student has changed these answers since your last reply. These are the latest versions and replace any earlier ones.">\n${blocks.join("\n\n")}\n</updated_work>` : "";
}

export const sentHashes = (parts) => Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, hash(v)]));

export function payloadMap(submissions) {
  const map = {};
  for (const s of submissions) map[partKey(s.lessonId, s.deliverableId)] = s.payload;
  return map;
}
