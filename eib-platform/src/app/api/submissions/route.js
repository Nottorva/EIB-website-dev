// GET  ?studentId=&lessonId=   (students: own only; leaders/admin: any)
// PUT  { lessonId, deliverableId, studentId?, payload? | grade?, feedback?, released? }
//   students may send payload only; leaders/super admin may send grade/feedback only.
import { guarded, readJson, HttpError } from "@/lib/auth";
import { listSubmissions, savePayload, saveGrade, stripUnreleased } from "@/lib/data/submissions";

export const GET = guarded(null, async ({ req, user }) => {
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId") || undefined;
  let studentId = url.searchParams.get("studentId") || undefined;
  if (user.role === "student") studentId = user.id; // never anyone else's
  const rows = await listSubmissions({ studentId, lessonId });
  return Response.json(user.role === "student" ? rows.map(stripUnreleased) : rows);
});

export const PUT = guarded(null, async ({ req, user }) => {
  const body = await readJson(req);
  if (!body.lessonId || !body.deliverableId) throw new HttpError(400, "lessonId and deliverableId are required.");

  if (user.role === "student") {
    if ("grade" in body || "feedback" in body || "released" in body) throw new HttpError(403, "Students cannot set grade, feedback or release state.");
    if (!("payload" in body)) throw new HttpError(400, "payload is required.");
    const key = { studentId: user.id, lessonId: body.lessonId, deliverableId: body.deliverableId };
    return Response.json(stripUnreleased(await savePayload(key, body.payload)));
  }

  // studentLeader / superAdmin
  if ("payload" in body) throw new HttpError(403, "Leaders cannot edit a student submission payload.");
  if (!body.studentId) throw new HttpError(400, "studentId is required when grading.");
  const key = { studentId: body.studentId, lessonId: body.lessonId, deliverableId: body.deliverableId };
  return Response.json(await saveGrade(key, { grade: body.grade, feedback: body.feedback, released: body.released }));
});
