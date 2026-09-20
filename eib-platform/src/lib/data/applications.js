// `applications` collection: intake answers plus pipeline status.
//
// Decisions are two-step. Leaders and the super admin move applications
// through the statuses as they review; nothing is visible to the applicant
// and no account exists yet. Then the super admin RELEASES decisions: every
// final decision (approved / waitlist / denied) that has not been released
// becomes visible on the applicant's status page, and each approved
// applicant gets their `users` row in the same pass. Changing a status again
// after release un-releases it, so the applicant sees "under review" until
// the next release. Accounts are never revoked here (open item in the spec);
// the super admin can suspend one from the Student Manager instead.

import { findAll, findOne, findById, insert, updateOne, newId } from "./store";
import { upsertStudent } from "./users";

export const APPLICATION_STATUSES = ["pending", "interview", "waitlist", "approved", "denied"];
// Statuses an applicant can be told about. Pending and interview stay "under review".
export const FINAL_STATUSES = ["approved", "waitlist", "denied"];

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
    submittedAt: new Date().toISOString(),
    decisionReleased: false,
    releasedAt: null,
  });
}

// Review step: change the status only. No account, nothing shown to the applicant.
export async function setStatus(id, status) {
  if (!APPLICATION_STATUSES.includes(status)) {
    const err = new Error(`Unknown status "${status}".`);
    err.status = 400;
    throw err;
  }
  const app = await getApplication(id);
  if (!app) return null;
  if (app.status === status) return app;
  return updateOne("applications", id, { status, decisionReleased: false, releasedAt: null });
}

// Which applications the next release would touch.
export function isUnreleasedDecision(app) {
  return FINAL_STATUSES.includes(app.status) && !app.decisionReleased;
}

// Release step (super admin): make every unreleased final decision visible
// and create accounts for the approved ones. Returns what happened.
export async function releaseDecisions() {
  const apps = (await listApplications()).filter(isUnreleasedDecision);
  const releasedAt = new Date().toISOString();
  const result = { released: 0, accountsCreated: 0, approved: 0, waitlisted: 0, denied: 0 };
  for (const app of apps) {
    const patch = { decisionReleased: true, releasedAt };
    if (app.status === "approved") {
      const user = await upsertStudent({ name: app.name, email: app.email });
      if (!app.studentId) result.accountsCreated += 1;
      patch.studentId = user.id;
      result.approved += 1;
    } else if (app.status === "waitlist") result.waitlisted += 1;
    else result.denied += 1;
    await updateOne("applications", app.id, patch);
    result.released += 1;
  }
  return result;
}

// What the applicant themselves may see: only a released decision.
export function applicantView(app) {
  if (!app) return null;
  return {
    submittedAt: app.submittedAt,
    decision: app.decisionReleased && FINAL_STATUSES.includes(app.status) ? app.status : null,
    releasedAt: app.decisionReleased ? app.releasedAt : null,
  };
}
