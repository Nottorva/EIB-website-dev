// Files attached to a lesson: the slides and the teaching plan. One file of
// each kind per lesson, stored in the `lessonFiles` collection (base64, up
// to 4 MB because that is what a Vercel request can carry) and served by
// /api/lessons/[id]/file/[kind]. Uploading sets the lesson's slidesLink /
// teachingPlanLink to that URL, so the Lessons page keeps opening them the
// same way it opened links.

import { findById, insert, replaceOne, removeOne, updateOne } from "./store";

export const FILE_KINDS = ["slides", "teachingPlan"];
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
const COLLECTION = "lessonFiles";

const fileId = (lessonId, kind) => `${lessonId}:${kind}`;
const linkKey = (kind) => (kind === "slides" ? "slidesLink" : "teachingPlanLink");
const metaKey = (kind) => (kind === "slides" ? "slidesFile" : "teachingPlanFile");
export const fileUrl = (lessonId, kind) => `/api/lessons/${lessonId}/file/${kind}`;

export async function getLessonFile(lessonId, kind) {
  if (!FILE_KINDS.includes(kind)) return null;
  return findById(COLLECTION, fileId(lessonId, kind));
}

export async function saveLessonFile(lessonId, kind, { name, type, size, data }) {
  if (!FILE_KINDS.includes(kind)) return null;
  const lesson = await findById("lessons", lessonId);
  if (!lesson) return null;
  const id = fileId(lessonId, kind);
  const doc = { id, lessonId, kind, name: String(name || "file"), type: String(type || "application/octet-stream"), size: Number(size) || 0, data, uploadedAt: new Date().toISOString() };
  if (await findById(COLLECTION, id)) await replaceOne(COLLECTION, id, doc);
  else await insert(COLLECTION, doc);
  const meta = { name: doc.name, type: doc.type, size: doc.size, uploadedAt: doc.uploadedAt };
  return updateOne("lessons", lessonId, { [metaKey(kind)]: meta, [linkKey(kind)]: fileUrl(lessonId, kind) });
}

export async function deleteLessonFile(lessonId, kind) {
  if (!FILE_KINDS.includes(kind)) return null;
  await removeOne(COLLECTION, fileId(lessonId, kind));
  const lesson = await findById("lessons", lessonId);
  if (!lesson) return null;
  const patch = { [metaKey(kind)]: null };
  if (lesson[linkKey(kind)] === fileUrl(lessonId, kind)) patch[linkKey(kind)] = "";
  return updateOne("lessons", lessonId, patch);
}

// When a lesson goes, its files go.
export async function deleteLessonFiles(lessonId) {
  for (const kind of FILE_KINDS) await removeOne(COLLECTION, fileId(lessonId, kind));
}
