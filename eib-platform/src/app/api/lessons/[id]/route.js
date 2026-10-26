import { guarded, readJson, HttpError } from "@/lib/auth";
import { getLesson, saveLesson, deleteLesson, updateLessonLogistics, forStudent, STUDENT_SESSION_KEYS, MENTOR_SESSION_KEYS } from "@/lib/data/lessons";

export const GET = guarded(null, async ({ params, user }) => {
  const lesson = await getLesson(params.id);
  if (!lesson) throw new HttpError(404, "Lesson not found.");
  return Response.json(user.role === "student" ? forStudent(lesson) : lesson);
});

export const PUT = guarded(["superAdmin"], async ({ req, params }) => {
  const body = await readJson(req);
  const saved = await saveLesson(params.id, body);
  if (!saved) throw new HttpError(404, "Lesson not found.");
  return Response.json(saved);
});

// Student leaders may update the student-facing session (room / date /
// start / end). The mentor-facing fields are the super admin's alone.
export const PATCH = guarded(["superAdmin", "studentLeader"], async ({ req, params, user }) => {
  const body = await readJson(req);
  const allowedKeys = user.role === "superAdmin" ? [...STUDENT_SESSION_KEYS, ...MENTOR_SESSION_KEYS] : STUDENT_SESSION_KEYS;
  const extra = Object.keys(body).filter((k) => !allowedKeys.includes(k));
  if (extra.length) throw new HttpError(403, `Only ${allowedKeys.join(", ")} can be changed here (got ${extra.join(", ")}).`);
  const saved = await updateLessonLogistics(params.id, body);
  if (!saved) throw new HttpError(404, "Lesson not found.");
  return Response.json(saved);
});

export const DELETE = guarded(["superAdmin"], async ({ params }) => {
  const ok = await deleteLesson(params.id);
  if (!ok) throw new HttpError(404, "Lesson not found.");
  return Response.json({ ok: true });
});
