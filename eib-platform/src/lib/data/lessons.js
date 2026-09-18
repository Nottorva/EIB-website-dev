// `lessons` collection: canonical curriculum. Written only by the Lesson
// Editor (super admin). Everyone else reads.

import { findAll, findById, insert, replaceOne, updateOne, removeOne, newId } from "./store";

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
    slidesLink: String(input.slidesLink ?? ""),
    overviewLink: String(input.overviewLink ?? ""),
    teachingPlanLink: String(input.teachingPlanLink ?? ""),
    mentorEnabled: Boolean(input.mentorEnabled),
    room: String(input.room ?? ""),
    startTime: String(input.startTime ?? ""),
    endTime: String(input.endTime ?? ""),
    overview: String(input.overview ?? ""),
    // Public website fields. Only `published` lessons appear on the site, and
    // only through toPublicLesson() below (never deliverables or links).
    published: Boolean(input.published),
    stage: String(input.stage ?? ""),
    week: String(input.week ?? ""),
    blurb: String(input.blurb ?? ""),
    deliverables: Array.isArray(input.deliverables) ? input.deliverables.map(normalizeDeliverable) : [],
  };
}

// The shape the public site receives: no links, no deliverables, no room.
export function toPublicLesson(l) {
  return {
    id: l.id,
    number: String(l.number ?? ""),
    title: String(l.title ?? ""),
    stage: String(l.stage ?? ""),
    week: String(l.week ?? ""),
    blurb: String(l.blurb || l.overview || ""),
  };
}

export async function listPublishedLessons() {
  return (await listLessons()).filter((l) => l.published).map(toPublicLesson);
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
export async function updateLessonLogistics(id, { room, startTime, endTime }) {
  const patch = {};
  if (room !== undefined) patch.room = String(room);
  if (startTime !== undefined) patch.startTime = String(startTime);
  if (endTime !== undefined) patch.endTime = String(endTime);
  return updateOne("lessons", id, patch);
}

export async function deleteLesson(id) {
  return removeOne("lessons", id);
}
