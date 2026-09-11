// `applications` collection: intake answers plus pipeline status.
// setStatus() is the two-write approval handler from the spec: moving an
// application to "approved" also upserts a `users` row so the applicant can
// sign in. Moving off "approved" deliberately does NOT revoke that row; that
// behaviour is an open item in the spec and is not built.

import { findAll, findOne, findById, insert, updateOne, newId } from "./store";
import { upsertStudent } from "./users";

export const APPLICATION_STATUSES = ["pending", "interview", "waitlist", "approved", "denied"];

export async function listApplications() {
  const rows = await findAll("applications");
  return [...rows].sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
}

export async function getApplication(id) {
  return findById("applications", id);
}

export async function findApplicationByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  return findOne("applications", (a) => String(a.email).toLowerCase() === target);
}

export async function createApplication({ name, email, answers }) {
  return insert("applications", {
    id: newId("app"),
    studentId: null,
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    answers: Array.isArray(answers) ? answers.map((a) => ({ questionId: String(a.questionId), answer: a.answer ?? "" })) : [],
    status: "pending",
    submittedAt: new Date().toISOString().slice(0, 10),
  });
}

export async function setStatus(id, status) {
  if (!APPLICATION_STATUSES.includes(status)) {
    const err = new Error(`Unknown status "${status}".`);
    err.status = 400;
    throw err;
  }
  const app = await getApplication(id);
  if (!app) return null;

  const patch = { status };
  if (status === "approved") {
    // Write 2 of 2: create (or refresh) the student's allow-list row.
    const user = await upsertStudent({ name: app.name, email: app.email });
    patch.studentId = user.id;
  }
  // Write 1 of 2 (order doesn't matter for the file store; with Mongo this
  // pair should become a transaction).
  return updateOne("applications", id, patch);
}
