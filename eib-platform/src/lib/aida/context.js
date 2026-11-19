// What AIDA is given on each request, in two parts. AIDA reads everything: every published lesson's
// instructions and tasks, and every deliverable the student has written.
//
//   shared   the core prompt, the general context, and every lesson (its overview, the AI instructions
//            written on the AIDA page, and each deliverable's task). The same for every student, so
//            Anthropic caches it once for the whole class.
//   context  one student: which lesson they opened AIDA from, and all of their answers, lesson by lesson.
//
// Nothing here names the student. `parts` maps every deliverable to the answer text AIDA saw, so a
// later message can send only what the student has changed since (see the chat route).

import { createHash } from "node:crypto";
import { answerMd } from "../data/exportMd";
import { DEFAULT_PROMPT } from "./prompt";

export const hash = (text) => createHash("sha1").update(String(text)).digest("hex").slice(0, 16);
const partKey = (lessonId, deliverableId) => `${lessonId}:${deliverableId}`;
const TYPE_NOTE = { text: "written answer", link: "a link; you cannot open it", table: "table", checklist: "checklist" };
// Older instructions may still carry the inline-deliverable markers that the AIDA page once offered.
const clean = (text) => String(text || "").replace(/\{\{deliverable:[^}]*\}\}/g, "").trim();

function lessonBlock(l) {
  const out = [`## Lesson ${l.number}: ${l.title}`];
  if (String(l.overview || "").trim()) out.push(`What the lesson is about: ${l.overview.trim()}`);
  const instructions = clean(l.aiInstructions);
  if (instructions) out.push(`Instructions from the EIB team for this lesson:\n${instructions}`);
  if (l.deliverables.length) out.push(`Deliverables:\n${l.deliverables.map((d) => `- ${d.title} [${TYPE_NOTE[d.type] || d.type}]${d.instructions.trim() ? `: ${d.instructions.trim()}` : ""}`).join("\n")}`);
  return out.join("\n");
}

export function sharedText({ settings, lessons }) {
  const prompt = String(settings?.prompt || "").trim() || DEFAULT_PROMPT;
  const general = String(settings?.general || "").trim();
  return [prompt, general ? `GENERAL CONTEXT FROM THE EIB TEAM\n\n${general}` : "", lessons.length ? `<program_lessons>\n${lessons.map(lessonBlock).join("\n\n")}\n</program_lessons>` : ""].filter(Boolean).join("\n\n");
}

/**
 * One student's side: the lesson they are on and all of their work.
 * `payloads` maps "lessonId:deliverableId" to the stored payload (missing = not started).
 */
export function buildContext({ lesson, lessons, payloads = {} }) {
  const parts = {};
  const sections = lessons
    .filter((l) => l.deliverables.length)
    .map((l) => {
      const answers = l.deliverables.map((d) => {
        const text = answerMd(d, payloads[partKey(l.id, d.id)]);
        parts[partKey(l.id, d.id)] = text;
        return `### ${d.title}\n${text}`;
      });
      return `## Lesson ${l.number}: ${l.title}${l.id === lesson.id ? " (the lesson they are on now)" : ""}\n\n${answers.join("\n\n")}`;
    });
  const text = [
    `<current_lesson>\nThe student opened you from Lesson ${lesson.number}: ${lesson.title}. That is what they are working on now.\n</current_lesson>`,
    sections.length ? `<student_work note="Everything this student has written in their deliverables so far.">\n${sections.join("\n\n")}\n</student_work>` : "There are no deliverables in the program yet.",
  ].join("\n\n");
  return { text, parts };
}

/** Changes when the lessons or their deliverables change (not when the student's answers do). */
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
