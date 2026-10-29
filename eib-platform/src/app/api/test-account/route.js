// Super admin only: the one test student account.
//   GET    -> the current test account (or null)
//   POST   -> create it from { email }
//   PATCH  -> wipe everything it did, keep the account; with { email },
//             also move the account to that email
//   DELETE -> wipe and remove it
import { guarded, readJson, HttpError } from "@/lib/auth";
import { getTestStudent, createTestStudent, wipeTestStudent, removeTestStudent, retargetTestStudent } from "@/lib/data/testAccount";

const shape = (u) => (u ? { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt || null, wipedAt: u.wipedAt || null, agreement: u.agreement ? u.agreement.status || "pending" : null } : null);

export const GET = guarded(["superAdmin"], async () => Response.json({ account: shape(await getTestStudent()) }));

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  const result = await createTestStudent(body.email);
  if (result.error) throw new HttpError(result.status, result.error);
  return Response.json({ account: shape(result.user) }, { status: 201 });
});

export const PATCH = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req).catch(() => ({}));
  const result = body.email ? await retargetTestStudent(body.email) : await wipeTestStudent();
  if (!result) throw new HttpError(404, "There is no test account.");
  if (result.error) throw new HttpError(result.status, result.error);
  return Response.json({ account: shape(result.user), removed: result.removed });
});

export const DELETE = guarded(["superAdmin"], async () => {
  const removed = await removeTestStudent();
  if (!removed) throw new HttpError(404, "There is no test account.");
  return Response.json({ ok: true, removed });
});
