// `lessons` collection: canonical curriculum. Written only by the Lesson
// Editor (super admin). Everyone else reads.

import { findAll, findById, insert, replaceOne, updateOne, removeOne, newId } from "./store";
import { deleteLessonFiles } from "./lessonFiles";

export const DELIVERABLE_TYPE_IDS = ["text", "link", "table", "checklist"];
// Older documents used a "file" type (uploads); links replaced it.
const LEGACY_TYPE = { file: "link" };

function numberSort(a, b) {
  const na = parseFloat(a.number);
  const nb = parseFloat(b.number);
  if (Number.isNaN(na) || Number.isNaN(nb)) return String(a.number).localeCompare(String(b.number));
  return na - nb;
}

export async function listLessons() {
  const rows = await findAll("lessons");
  return [...rows].sort(numberSort);
}

export async function getLesson(id) {
  return findById("lessons", id);
}

// Examples are stored in the same shape as a student submission payload for
// that deliverable type ({text} | {columns,rowLabels,rows} | {items} | {url}).
// Older string examples are migrated to {text}.
export function normalizeExample(ex) {
  if (ex === null || ex === undefined || ex === "") return null;
  if (typeof ex === "string") return { text: ex };
  if (typeof ex === "object") return "fileName" in ex && !("url" in ex) ? null : ex;
  return null;
}

export function normalizeDeliverable(d) {
  return {
    id: d.id || newId("del"),
    type: DELIVERABLE_TYPE_IDS.includes(LEGACY_TYPE[d.type] || d.type) ? LEGACY_TYPE[d.type] || d.type : "text",
    title: String(d.title || "Untitled Deliverable"),
    instructions: String(d.instructions || ""),
    example: normalizeExample(d.example),
    points: d.points === null || d.points === undefined || d.points === "" ? null : Number(d.points),
    columns: Array.isArray(d.columns) ? d.columns.map(String) : [],
    rowLabels: Array.isArray(d.rowLabels) ? d.rowLabels.map(String) : [],
    checklistItems: Array.isArray(d.checklistItems) ? d.checklistItems.map(String) : [],
  };
}

export function normalizeLesson(input, id) {
  return {
    id,
    number: String(input.number ?? ""),
    chapterLabel: String(input.chapterLabel ?? ""),
    title: String(input.title ?? ""),
    // Slides and the teaching plan are uploaded files (see lessonFiles.js);
    // the *Link fields then hold the file's URL. overviewLink is no longer
    // edited anywhere and is kept only so older records round-trip.
    slidesLink: String(input.slidesLink ?? ""),
    slidesFile: input.slidesFile && typeof input.slidesFile === "object" ? input.slidesFile : null,
    overviewLink: String(input.overviewLink ?? ""),
    teachingPlanLink: String(input.teachingPlanLink ?? ""),
    teachingPlanFile: input.teachingPlanFile && typeof input.teachingPlanFile === "object" ? input.teachingPlanFile : null,
    mentorEnabled: Boolean(input.mentorEnabled),
    // Published to the Lessons page. Until the super admin publishes, students
    // and student leaders do not receive the lesson there. Nothing else
    // (CRM, Student Manager, the public website) looks at this.
    studentVisible: Boolean(input.studentVisible),
    // Student-facing session: what /lessons shows and leaders edit there.
    room: String(input.room ?? ""),
    date: String(input.date ?? ""),
    startTime: String(input.startTime ?? ""),
    endTime: String(input.endTime ?? ""),
    // Mentor-facing session (same date): what the Mentor CRM shows and the
    // super admin edits. Blank = the defaults in lib/sessionDefaults.js.
    mentorLocation: String(input.mentorLocation ?? ""),
    mentorStartTime: String(input.mentorStartTime ?? ""),
    mentorEndTime: String(input.mentorEndTime ?? ""),
    overview: String(input.overview ?? ""),
    // Shown on the CRM's Sessions tab; the super admin writes it. Never sent
    // to students (see the lessons routes).
    mentorBrief: String(input.mentorBrief ?? ""),
    // Public website fields. Only `published` lessons appear on the site, and
    // only through toPublicLesson() below (never deliverables or links).
    published: Boolean(input.published),
    stage: String(input.stage ?? ""),
    week: String(input.week ?? ""),
    blurb: String(input.blurb ?? ""),
    deliverables: Array.isArray(input.deliverables) ? input.deliverables.map(normalizeDeliverable) : [],
  };
}

export async function createLesson(input) {
  const existing = await listLessons();
  const nextNumber = existing.length + 1;
  const lesson = normalizeLesson(
    {
      number: String(nextNumber),
      chapterLabel: `Chapter ${nextNumber}`,
      title: "Untitled Lesson",
      ...input,
    },
    newId("lesson")
  );
  return insert("lessons", lesson);
}

export async function saveLesson(id, input) {
  return replaceOne("lessons", id, normalizeLesson(input, id));
}

// Student leaders may change where and when a lesson meets, nothing else.
export const STUDENT_SESSION_KEYS = ["room", "date", "startTime", "endTime"];
export const MENTOR_SESSION_KEYS = ["mentorLocation", "mentorStartTime", "mentorEndTime", "mentorBrief"];

// Students never receive the mentor-facing fields.
export function forStudent(lesson) {
  const { mentorBrief, mentorLocation, mentorStartTime, mentorEndTime, teachingPlanFile, ...rest } = lesson;
  return rest;
}

export async function updateLessonLogistics(id, fields) {
  const patch = {};
  for (const key of [...STUDENT_SESSION_KEYS, ...MENTOR_SESSION_KEYS]) if (fields[key] !== undefined) patch[key] = String(fields[key]);
  return updateOne("lessons", id, patch);
}

// One pass over every lesson: student values on all, mentor values on the
// "Yes Mentor" ones. Blank request fields are skipped; dates are untouched.
export async function bulkSessionDefaults({ student = {}, mentor = {} }) {
  const all = await listLessons();
  const pick = (src, keys) => Object.fromEntries(keys.filter((k) => String(src[k] ?? "").trim() !== "").map((k) => [k, String(src[k]).trim()]));
  const studentPatch = pick(student, ["room", "startTime", "endTime"]);
  const mentorPatch = pick(mentor, ["mentorLocation", "mentorStartTime", "mentorEndTime"]);
  let changed = 0;
  let mentorLessons = 0;
  for (const l of all) {
    const patch = { ...studentPatch, ...(l.mentorEnabled ? mentorPatch : {}) };
    if (l.mentorEnabled) mentorLessons += 1;
    if (Object.keys(patch).length === 0) continue;
    await updateOne("lessons", l.id, patch);
    changed += 1;
  }
  return { lessons: all.length, mentorLessons, changed, studentPatch, mentorPatch };
}

export async function deleteLesson(id) {
  await deleteLessonFiles(id);
  return removeOne("lessons", id);
}
