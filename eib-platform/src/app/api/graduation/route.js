// The Student Manager's Graduation tab. Super admin only.
//
// GET                                        every student's deliverable progress and credential
// PATCH { storyDeliverableId?, hidden?, criteria? }   what a credential page shows
// POST  { action: "releaseAll" }             a credential for everyone who completed every deliverable
// POST  { action: "release", studentId }     one student (also brings back a revoked credential)
// POST  { action: "revoke", studentId }      one student
//
// Releasing never emails anyone.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { graduationOverview, saveGraduationSettings, releaseAll, releaseOne, revokeOne } from "@/lib/data/credentials";

export const dynamic = "force-dynamic";

export const GET = guarded(["superAdmin"], async () => Response.json(await graduationOverview()));

export const PATCH = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  if (body.storyDeliverableId === undefined && body.hidden === undefined && body.criteria === undefined) throw new HttpError(400, "Nothing to change: send storyDeliverableId, hidden or criteria.");
  await saveGraduationSettings(body);
  return Response.json(await graduationOverview());
});

export const POST = guarded(["superAdmin"], async ({ req }) => {
  const body = await readJson(req);
  let released = [];
  if (body.action === "releaseAll") released = await releaseAll();
  else if (body.action === "release" && body.studentId) released = [(await releaseOne(String(body.studentId))).studentName];
  else if (body.action === "revoke" && body.studentId) await revokeOne(String(body.studentId));
  else throw new HttpError(400, "Send action releaseAll, or release / revoke with a studentId.");
  return Response.json({ ...(await graduationOverview()), released });
});
