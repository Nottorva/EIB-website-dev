// The test student account feature is gone. All that is left is this
// clean-up: a database that still holds a test student (a user row with
// isTest) loses it, together with everything it produced: submissions, AIDA
// conversations and usage, and any application or draft under its email.
// Runs when the super admin opens the home menu. Once the live database has
// no such row, this file and its one call in the home menu page can go.

import { findOneBy, removeOne } from "./store";
import { deleteSubmissionsFor } from "./submissions";
import { findApplicationByEmail } from "./applications";
import { deleteDraftByEmail } from "./drafts";
import { deleteAidaFor } from "../aida/store";

export async function removeLeftoverTestAccount() {
  const user = await findOneBy("users", "isTest", true, (u) => u.isTest === true);
  if (!user) return false;
  await deleteSubmissionsFor(user.id);
  await deleteAidaFor(user.id);
  const app = await findApplicationByEmail(user.email);
  if (app) await removeOne("applications", app.id);
  await deleteDraftByEmail(user.email);
  await removeOne("users", user.id);
  return true;
}
