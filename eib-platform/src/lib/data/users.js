// `users` collection: the sign-in allow-list. Rows are created in exactly two
// places: createLeader (Acc Manager tab, super admin only) and
// upsertStudent (called when an application is approved).

import { findAll, findOne, findById, insert, updateOne, removeOne, newId } from "./store";

export const ROLES = ["superAdmin", "studentLeader", "student"];

export async function listUsers(filter = {}) {
  return findAll("users", (u) => (filter.role ? u.role === filter.role : true));
}

export async function getUser(id) {
  return findById("users", id);
}

export async function getUserByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  return findOne("users", (u) => u.email.toLowerCase() === target);
}

export async function createLeader({ name, email }) {
  const existing = await getUserByEmail(email);
  if (existing) {
    const err = new Error(`A user with email ${email} already exists (${existing.role}).`);
    err.status = 409;
    throw err;
  }
  return insert("users", { id: newId("user"), name: name.trim(), email: email.trim(), role: "studentLeader" });
}

// Called by the application-approval handler. If the email already has a row,
// the name is refreshed but the role is left alone so approving an applicant
// who happens to be a leader or super admin never demotes them.
export async function upsertStudent({ name, email }) {
  const existing = await getUserByEmail(email);
  if (existing) return updateOne("users", existing.id, { name: name.trim() });
  return insert("users", { id: newId("user"), name: name.trim(), email: email.trim(), role: "student" });
}

export async function deleteUser(id) {
  return removeOne("users", id);
}
