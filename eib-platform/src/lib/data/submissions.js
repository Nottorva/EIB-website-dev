// `submissions` collection: one document per (studentId, lessonId,
// deliverableId). The student lesson view and the Student Manager's grading
// view both read and write this collection, which is what keeps them in sync.
//
// Students write `payload` only. Leaders and super admins write `grade` and
// `feedback` only. The API route enforces which fields a caller may send;
// the functions below just do the field-scoped upsert.

import { findAll, findOne, insert, updateOne, newId } from "./store";

export async function listSubmissions({ studentId, lessonId } = {}) {
  return findAll(
    "submissions",
    (s) => (studentId ? s.studentId === studentId : true) && (lessonId ? s.lessonId === lessonId : true)
  );
}

export async function getSubmission({ studentId, lessonId, deliverableId }) {
  return findOne(
    "submissions",
    (s) => s.studentId === studentId && s.lessonId === lessonId && s.deliverableId === deliverableId
  );
}

async function upsert(key, fields) {
  const existing = await getSubmission(key);
  if (existing) return updateOne("submissions", existing.id, fields);
  return insert("submissions", {
    id: newId("sub"),
    studentId: key.studentId,
    lessonId: key.lessonId,
    deliverableId: key.deliverableId,
    payload: null,
    grade: null,
    feedback: "",
    released: false,
    releasedAt: null,
    submittedAt: null,
    ...fields,
  });
}

export async function savePayload(key, payload) {
  return upsert(key, { payload, submittedAt: new Date().toISOString() });
}

// Grade and feedback are drafts until `released` is true; the student-facing
// routes strip them until then (see stripUnreleased).
export async function saveGrade(key, { grade, feedback, released }) {
  const fields = {};
  if (grade !== undefined) fields.grade = grade === "" || grade === null ? null : String(grade);
  if (feedback !== undefined) fields.feedback = String(feedback);
  if (released !== undefined) {
    const existing = await getSubmission(key);
    fields.released = Boolean(released);
    fields.releasedAt = fields.released ? existing?.releasedAt || new Date().toISOString() : null;
  }
  return upsert(key, fields);
}

// What a student is allowed to see of their own submission.
export function stripUnreleased(sub) {
  if (!sub) return sub;
  if (sub.released) return sub;
  return { ...sub, grade: null, feedback: "", released: false, releasedAt: null };
}
