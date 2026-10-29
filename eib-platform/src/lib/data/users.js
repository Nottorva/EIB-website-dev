// `users` collection: the sign-in allow-list. Rows are created in exactly two
// places: createLeader (Acc Manager tab, super admin only) and
// upsertStudent (called when an application is approved).

import { findAll, findOne, findById, insert, updateOne, removeOne, newId, findOneBy } from "./store";

// "advancement": the advancement team. They get the Mentor CRM and nothing
// else. Only the super admin creates or removes them.
export const ROLES = ["superAdmin", "studentLeader", "advancement", "student"];
// Accounts the super admin creates by hand (students come from applications).
export const STAFF_ROLES = ["studentLeader", "advancement"];

export async function listUsers(filter = {}) {
  return findAll("users", (u) => (filter.role ? u.role === filter.role : true));
}

// Student accounts without the test account.
export async function listRealStudents() {
  return findAll("users", (u) => u.role === "student" && !u.isTest);
}

export async function getUser(id) {
  return findById("users", id);
}

export async function getUserByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  return findOneBy("users", "email", target, (u) => String(u.email).toLowerCase() === target);
}

// A readable name from an email when none was typed: jane.doe@x -> Jane Doe.
export function nameFromEmail(email) {
  return String(email || "").split("@")[0].split(/[._-]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") || String(email || "");
}

export async function createStaff({ name, email, role }) {
  if (!STAFF_ROLES.includes(role)) {
    const err = new Error(`Cannot create a ${role} account here.`);
    err.status = 400;
    throw err;
  }
  const existing = await getUserByEmail(email);
  if (existing) {
    const err = new Error(`A user with email ${email} already exists (${existing.role}).`);
    err.status = 409;
    throw err;
  }
  return insert("users", { id: newId("user"), name: String(name || "").trim() || nameFromEmail(email), email: email.trim(), role });
}

export async function createLeader({ name, email }) {
  return createStaff({ name, email, role: "studentLeader" });
}

// Called by the application-approval handler. If the email already has a row,
// the name is refreshed but the role is left alone so approving an applicant
// who happens to be a leader or super admin never demotes them.
export async function upsertStudent({ name, email }) {
  const existing = await getUserByEmail(email);
  // an approved applicant being (re)released gets a live account, even if it
  // was suspended when their status was moved off approved earlier
  if (existing) return updateOne("users", existing.id, { name: name.trim(), suspended: false, suspendedAt: null });
  return insert("users", { id: newId("user"), name: name.trim(), email: email.trim(), role: "student" });
}

// The welcome page has been seen (and its button pressed) once.
export async function markWelcomed(id) {
  return updateOne("users", id, { welcomedAt: new Date().toISOString() });
}

export async function deleteUser(id) {
  return removeOne("users", id);
}

// Suspended rows stay on the allow-list (so the record and submissions are
// kept) but getCurrentUser() treats them as signed out. Super admin only.
export async function setSuspended(id, suspended) {
  return updateOne("users", id, { suspended: Boolean(suspended), suspendedAt: suspended ? new Date().toISOString() : null });
}
