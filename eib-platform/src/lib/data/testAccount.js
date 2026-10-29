// The one test student account. The super admin types an email (their own
// school address, typically) and gets a student named "Test" with no
// application behind it, so nothing they do touches the class count or the
// applicant pipeline. Wiping it deletes everything that account produced
// (submissions, the signed agreement, any application or draft under that
// email) and leaves the account ready to go through again. Only one exists.

import { findAll, findOneBy, insert, updateOne, removeOne, newId } from "./store";
import { getUserByEmail } from "./users";
import { deleteSubmissionsFor } from "./submissions";
import { findApplicationByEmail } from "./applications";
import { deleteDraftByEmail } from "./drafts";

export const TEST_NAME = "Test";

export async function getTestStudent() {
  return findOneBy("users", "isTest", true, (u) => u.isTest === true);
}

export async function createTestStudent(email) {
  const key = String(email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(key)) return { error: "Enter a valid email address.", status: 400 };
  if (await getTestStudent()) return { error: "There is already a test account. Wipe or remove it first.", status: 409 };
  if (await getUserByEmail(key)) return { error: `${key} already has an account.`, status: 409 };
  const user = await insert("users", { id: newId("user"), name: TEST_NAME, email: key, role: "student", isTest: true, createdAt: new Date().toISOString() });
  return { user };
}

// Everything the test account did, gone; the account itself stays.
export async function wipeTestStudent() {
  const user = await getTestStudent();
  if (!user) return null;
  const removed = { submissions: await deleteSubmissionsFor(user.id), application: 0, draft: 0, agreement: user.agreement ? 1 : 0 };
  const app = await findApplicationByEmail(user.email);
  if (app) { await removeOne("applications", app.id); removed.application = 1; }
  if (await deleteDraftByEmail(user.email)) removed.draft = 1;
  const fresh = await updateOne("users", user.id, { name: TEST_NAME, agreement: null, welcomedAt: null, suspended: false, suspendedAt: null, wipedAt: new Date().toISOString() });
  return { user: fresh, removed };
}

// Wipe, then delete the account too.
export async function removeTestStudent() {
  const wiped = await wipeTestStudent();
  if (!wiped) return null;
  await removeOne("users", wiped.user.id);
  return wiped.removed;
}

export async function listTestIds() {
  return (await findAll("users", (u) => u.isTest === true)).map((u) => u.id);
}
