// `applicationDrafts` collection: who has signed in to the application form
// and not submitted yet, with the answers they have typed so far. One row
// per email. Created the first time the form is shown to a signed-in
// applicant, refreshed as they type, deleted the moment they submit (or when
// the super admin clean-resets the applicant). Read only by the Student
// Manager's Unfinished tab.

import { findAll, findOneBy, upsertBy, removeOne, newId } from "./store";

const COLLECTION = "applicationDrafts";

export async function listDrafts() {
  const rows = await findAll(COLLECTION);
  return [...rows].sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
}

export async function findDraftByEmail(email) {
  const key = String(email || "").toLowerCase();
  return findOneBy(COLLECTION, "email", key);
}

function cleanAnswers(answers) {
  if (!Array.isArray(answers)) return [];
  return answers
    .filter((a) => a && typeof a.questionId === "string")
    .map((a) => ({ questionId: a.questionId, answer: String(a.answer ?? "").slice(0, 20000) }))
    .slice(0, 100);
}

// Upsert by email, in one atomic write (two saves arriving together still
// leave one row). `answers` undefined = just mark them seen.
export async function touchDraft({ name, email, answers }) {
  const key = String(email || "").toLowerCase();
  const now = new Date().toISOString();
  const patch = { name: String(name || key), lastSeenAt: now };
  if (answers !== undefined) patch.answers = cleanAnswers(answers);
  const insertDoc = { id: newId("draft"), email: key, startedAt: now, ...(answers === undefined ? { answers: [] } : {}) };
  return upsertBy(COLLECTION, "email", key, insertDoc, patch);
}

export async function deleteDraft(id) {
  return removeOne(COLLECTION, id);
}

export async function deleteDraftByEmail(email) {
  const row = await findDraftByEmail(email);
  return row ? removeOne(COLLECTION, row.id) : false;
}
